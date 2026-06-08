/**
 * AudioEngine — Web Audio sound engine.
 * Most sounds are procedurally synthesized from oscillators + filtered noise.
 * The keystroke "tick" uses an mp3 sample when available.
 * Background music loops one of three selectable tracks through the Music bus.
 */

import { TUNING } from "../data/tuning";

export type MusicTrackId = "graveyardGlitch" | "ghastlyGarrison" | "chapelCannon";

export const MUSIC_TRACKS: Record<MusicTrackId, { file: string; label: string }> = {
  graveyardGlitch: { file: "Graveyard Glitch.mp3", label: "Graveyard Glitch" },
  ghastlyGarrison: { file: "Ghastly Garrison.mp3", label: "Ghastly Garrison" },
  chapelCannon: { file: "Chapel Cannon.mp3", label: "Chapel Cannon" },
};

export const MUSIC_TRACK_ORDER: MusicTrackId[] = [
  "graveyardGlitch",
  "ghastlyGarrison",
  "chapelCannon",
];

/** A single entry in the rotating background-music playlist. */
export type PlaylistItem =
  | { kind: "builtin"; id: MusicTrackId }
  | { kind: "custom"; id: string; url: string };

type SoundEvent =
  | "tick"
  | "miss"
  | "impact"
  | "kill"
  | "comboUp"
  | "playerHit"
  | "warning"
  | "phaseChange"
  | "victory"
  | "defeat"
  | "upgrade"
  | "shield"
  | "uiSelect"
  | "perfect"
  | "extraLife"
  | "victorySong";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private tickBuffer: AudioBuffer | null = null;
  private perfectBuffer: AudioBuffer | null = null;
  private victorySongBuffer: AudioBuffer | null = null;
  private unlocked = false;
  private tickIndex = 0;
  private sfxVolume: number = TUNING.audio.defaultSfxVolume;
  private musicVolume: number = TUNING.audio.defaultMusicVolume;

  // --- Music state ---
  /** Ordered list of enabled tracks; rotation advances through these. */
  private playlist: PlaylistItem[] = [];
  private playlistIndex = 0;
  /** When true, rotation jumps to a random next track instead of sequentially. */
  private shuffle = false;
  /** True while music should be playing (menu / gameplay), false on end screens. */
  private musicActive = false;
  private currentItemId: string | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicTrackGain: GainNode | null = null;
  /** Decoded buffers keyed by playlist item id. */
  private musicBufferCache = new Map<string, AudioBuffer>();
  /** Guards against stale async loads when the playlist changes mid-load. */
  private musicLoadToken = 0;

  /** Must be called from a user gesture (first keydown or click). */
  unlock(): void {
    if (this.unlocked) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = TUNING.audio.masterVolume;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.master);
      this.noiseBuffer = this.buildNoiseBuffer(this.ctx, 0.8);
      this.unlocked = true;
      this.loadTickSound();
      this.loadSampleSound("Perfect Sound.mp3").then((buf) => {
        this.perfectBuffer = buf;
      });
      this.loadSampleSound("Victory Song.mp3").then((buf) => {
        this.victorySongBuffer = buf;
      });
    } catch (err) {
      console.warn("[Audio] unlock failed", err);
    }
  }

  setMasterVolume(v: number): void {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.03);
    }
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
    }
  }

  // --- Music playback ---

  /**
   * Replace the rotation playlist. If music is active, keeps the current track
   * playing when it's still enabled, otherwise restarts from the top. An empty
   * playlist falls silent.
   */
  setPlaylist(items: PlaylistItem[]): void {
    this.playlist = items.slice();
    if (!this.musicActive) return;
    if (items.length === 0) {
      this.stopCurrentSource();
      return;
    }
    // If the current track is still in the list, keep it playing.
    const idx = this.currentItemId
      ? items.findIndex((i) => i.id === this.currentItemId)
      : -1;
    if (idx >= 0 && this.musicSource) {
      this.playlistIndex = idx;
      return;
    }
    // Otherwise (re)start from the beginning of the new list.
    this.stopCurrentSource();
    this.playlistIndex = 0;
    void this.playCurrent();
  }

  startMusic(): void {
    if (!this.unlocked || !this.ctx || !this.musicGain) return;
    this.musicActive = true;
    if (this.musicSource) return;
    if (this.playlist.length === 0) return;
    if (this.playlistIndex >= this.playlist.length) this.playlistIndex = 0;
    void this.playCurrent();
  }

  stopMusic(): void {
    this.musicActive = false;
    this.stopCurrentSource();
  }

  private stopCurrentSource(): void {
    // Bump the token so any in-flight load won't start a stale source.
    this.musicLoadToken++;
    if (this.musicSource) {
      this.musicSource.onended = null;
      try {
        this.musicSource.stop();
      } catch { /* already stopped */ }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
    if (this.musicTrackGain) {
      this.musicTrackGain.disconnect();
      this.musicTrackGain = null;
    }
    this.currentItemId = null;
  }

  /** Toggle random (shuffle) playback for the rotation playlist. */
  setShuffle(enabled: boolean): void {
    this.shuffle = enabled;
  }

  private advanceTrack(): void {
    if (!this.musicActive || this.playlist.length === 0) return;
    if (this.shuffle && this.playlist.length > 1) {
      // Pick a random next track that isn't the one we just finished.
      let next = this.playlistIndex;
      while (next === this.playlistIndex) {
        next = Math.floor(Math.random() * this.playlist.length);
      }
      this.playlistIndex = next;
    } else {
      this.playlistIndex = (this.playlistIndex + 1) % this.playlist.length;
    }
    void this.playCurrent();
  }

  private async playCurrent(): Promise<void> {
    if (!this.ctx || !this.musicGain || !this.musicActive) return;
    if (this.playlist.length === 0) return;
    const item = this.playlist[this.playlistIndex % this.playlist.length];
    const token = ++this.musicLoadToken;
    const buffer = await this.loadPlaylistItem(item);
    // Bail if the playlist changed / music stopped while loading.
    if (token !== this.musicLoadToken || !this.musicActive) return;
    if (!this.ctx || !this.musicGain || this.musicSource) return;
    if (!buffer) {
      // Skip a track that failed to load (avoid tight-looping on one item).
      if (this.playlist.length > 1) this.advanceTrack();
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    // Rotate via onended (single-track playlists naturally repeat).
    source.loop = false;
    const trackGain = this.ctx.createGain();
    trackGain.gain.value = TUNING.audio.musicTrackVolume;
    source.connect(trackGain);
    trackGain.connect(this.musicGain);
    source.onended = () => {
      if (source !== this.musicSource) return;
      this.musicSource = null;
      this.currentItemId = null;
      if (this.musicTrackGain) {
        this.musicTrackGain.disconnect();
        this.musicTrackGain = null;
      }
      this.advanceTrack();
    };
    source.start();
    this.musicSource = source;
    this.musicTrackGain = trackGain;
    this.currentItemId = item.id;
  }

  private async loadPlaylistItem(item: PlaylistItem): Promise<AudioBuffer | null> {
    const cached = this.musicBufferCache.get(item.id);
    if (cached) return cached;
    const src =
      item.kind === "builtin"
        ? `${import.meta.env.BASE_URL}Sounds/${MUSIC_TRACKS[item.id].file}`
        : item.url;
    const buf = await this.loadUrl(src);
    if (buf) this.musicBufferCache.set(item.id, buf);
    return buf;
  }

  // --- SFX play ---

  play(event: SoundEvent): void {
    if (!this.ctx || !this.master) return;
    switch (event) {
      case "tick":
        this.playTick();
        break;
      case "miss":
        this.playMiss();
        break;
      case "impact":
        this.playImpact();
        break;
      case "kill":
        this.playKill();
        break;
      case "comboUp":
        this.playComboUp();
        break;
      case "playerHit":
        this.playPlayerHit();
        break;
      case "warning":
        this.playWarning();
        break;
      case "phaseChange":
        this.playPhaseChange();
        break;
      case "victory":
        this.playVictory();
        break;
      case "defeat":
        this.playDefeat();
        break;
      case "upgrade":
        this.playUpgrade();
        break;
      case "shield":
        this.playShield();
        break;
      case "uiSelect":
        this.playUiSelect();
        break;
      case "perfect":
        this.playPerfect();
        break;
      case "extraLife":
        this.playExtraLife();
        break;
      case "victorySong":
        this.playVictorySong();
        break;
    }
  }

  // ---------- Sound recipes ----------

  private playTick(): void {
    if (!this.ctx || !this.sfxGain) return;

    if (this.tickBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.tickBuffer;
      const g = this.ctx.createGain();
      g.gain.value = TUNING.audio.tickVolume;
      src.connect(g);
      g.connect(this.sfxGain);
      src.start();
      return;
    }

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const variations = [880, 920, 960, 900, 940];
    const freq = variations[this.tickIndex % variations.length];
    this.tickIndex++;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(TUNING.audio.tickVolume, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  private playMiss(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(TUNING.audio.missVolume, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 800;
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  private playImpact(): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(TUNING.audio.impactVolume * 0.7, t);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(2200, t);
    filt.frequency.exponentialRampToValueAtTime(400, t + 0.18);
    noise.connect(filt);
    filt.connect(nGain);
    nGain.connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.22);

    const sine = ctx.createOscillator();
    sine.type = "sine";
    sine.frequency.setValueAtTime(240, t);
    sine.frequency.exponentialRampToValueAtTime(80, t + 0.14);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(TUNING.audio.impactVolume * 0.55, t);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    sine.connect(sg);
    sg.connect(this.sfxGain!);
    sine.start(t);
    sine.stop(t + 0.2);
  }

  /**
   * Subtle kill-confirm: a short, bright ping so a felled enemy reads clearly
   * without the heavy, attention-grabbing thud the old recipe used.
   */
  private playKill(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(1650, t + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(TUNING.audio.killVolume, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  private playComboUp(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.linearRampToValueAtTime(990, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  private playPlayerHit(): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 400;
    filt.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    noise.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.4);

    const sine = ctx.createOscillator();
    sine.type = "sine";
    sine.frequency.setValueAtTime(140, t);
    sine.frequency.exponentialRampToValueAtTime(60, t + 0.3);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.4, t);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    sine.connect(sg);
    sg.connect(this.sfxGain!);
    sine.start(t);
    sine.stop(t + 0.35);
  }

  private playWarning(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.linearRampToValueAtTime(540, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.2);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 1800;
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  private playPhaseChange(): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const sine = ctx.createOscillator();
    sine.type = "sine";
    sine.frequency.setValueAtTime(60, t);
    sine.frequency.exponentialRampToValueAtTime(220, t + 0.45);
    sine.frequency.exponentialRampToValueAtTime(40, t + 0.9);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.linearRampToValueAtTime(TUNING.audio.phaseVolume * 0.7, t + 0.1);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    sine.connect(sg);
    sg.connect(this.sfxGain!);
    sine.start(t);
    sine.stop(t + 1.0);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 1200;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.18, t);
    nG.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    noise.connect(filt);
    filt.connect(nG);
    nG.connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.65);
  }

  private playVictory(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes = [392, 523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + i * 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.14);
      g.gain.linearRampToValueAtTime(0.32, t + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.5);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t + i * 0.14);
      osc.stop(t + i * 0.14 + 0.6);
    });
  }

  private playDefeat(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes = [392, 311.13, 261.63, 196];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t + i * 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.linearRampToValueAtTime(0.28, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.7);
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 900;
      osc.connect(filt);
      filt.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.8);
    });
  }

  private playUpgrade(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + i * 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.linearRampToValueAtTime(0.24, t + i * 0.07 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.3);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.32);
    });
  }

  private playShield(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  private playUiSelect(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.setValueAtTime(880, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 1800;
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private playPerfect(): void {
    if (!this.ctx || !this.sfxGain || !this.perfectBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.perfectBuffer;
    const g = this.ctx.createGain();
    g.gain.value = TUNING.audio.perfectVolume;
    src.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  /**
   * Extra-life flourish: a quick rising arpeggio (C5-E5-G5) so earning a candle
   * feels rewarding. Placeholder recipe — easy to swap for a sample later.
   */
  private playExtraLife(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const start = t + i * 0.07;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(TUNING.audio.extraLifeVolume, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  private playVictorySong(): void {
    if (!this.ctx || !this.sfxGain || !this.victorySongBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.victorySongBuffer;
    const g = this.ctx.createGain();
    g.gain.value = TUNING.audio.victorySongVolume;
    src.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  // ---------- Internals ----------

  private async loadTickSound(): Promise<void> {
    if (!this.ctx) return;
    try {
      const base = import.meta.env.BASE_URL;
      const resp = await fetch(`${base}Sounds/Keyboard Typing.mp3`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      this.tickBuffer = await this.ctx.decodeAudioData(arrayBuf);
    } catch (e) {
      console.warn("[Audio] Failed to load tick sound, using fallback", e);
    }
  }

  private async loadSampleSound(filename: string): Promise<AudioBuffer | null> {
    const base = import.meta.env.BASE_URL;
    return this.loadUrl(`${base}Sounds/${filename}`);
  }

  /** Fetch + decode an audio file from any URL (built-in path, http, or data URI). */
  private async loadUrl(src: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      const resp = await fetch(src);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      return await this.ctx.decodeAudioData(arrayBuf);
    } catch (e) {
      console.warn(`[Audio] Failed to load ${src}`, e);
      return null;
    }
  }

  private buildNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
