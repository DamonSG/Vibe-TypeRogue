/**
 * AudioEngine — procedural Web Audio sound synthesis.
 * No assets. Every sound is built from oscillators + filtered noise.
 */

import { TUNING } from "../data/tuning";

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
  | "uiSelect";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** SFX bus — all sound effects route here. Controlled by the SFX slider. */
  private sfxGain: GainNode | null = null;
  /** Music bus — background music routes here (no source yet). Controlled by the Music slider. */
  private musicGain: GainNode | null = null;
  /** Pre-built noise buffer used for "shh"/impact components. */
  private noiseBuffer: AudioBuffer | null = null;
  /** Track when audio is first unlocked (browser requires user gesture). */
  private unlocked = false;
  /** Slight variation in tick pitch for satisfying rolls. */
  private tickIndex = 0;
  /** Cached volumes (0..1) so settings set before unlock still apply on unlock. */
  private sfxVolume: number = TUNING.audio.defaultSfxVolume;
  private musicVolume: number = TUNING.audio.defaultMusicVolume;

  /** Must be called from a user gesture (first keydown). */
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
      // SFX + Music buses both feed the master.
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.master);
      this.noiseBuffer = this.buildNoiseBuffer(this.ctx, 0.8);
      this.unlocked = true;
    } catch (err) {
      console.warn("[Audio] unlock failed", err);
    }
  }

  setMasterVolume(v: number): void {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  /** Set SFX bus volume (0..1) — typing, UI, hits, deaths, rewards, combat. */
  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.03);
    }
  }

  /** Set Music bus volume (0..1) — background music only. */
  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
    }
  }

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
    }
  }

  // ---------- Sound recipes ----------

  private playTick(): void {
    if (!this.ctx || !this.master) return;
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
    g.connect(this.sfxGain!);
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

  private playKill(): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Big impact body
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(3000, t);
    filt.frequency.exponentialRampToValueAtTime(300, t + 0.35);
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(TUNING.audio.killVolume * 0.7, t);
    nG.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    noise.connect(filt);
    filt.connect(nG);
    nG.connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.45);

    // Boomy sine drop
    const sine = ctx.createOscillator();
    sine.type = "sine";
    sine.frequency.setValueAtTime(220, t);
    sine.frequency.exponentialRampToValueAtTime(50, t + 0.3);
    const sG = ctx.createGain();
    sG.gain.setValueAtTime(TUNING.audio.killVolume * 0.6, t);
    sG.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    sine.connect(sG);
    sG.connect(this.sfxGain!);
    sine.start(t);
    sine.stop(t + 0.4);

    // High shimmer
    const sh = ctx.createOscillator();
    sh.type = "triangle";
    sh.frequency.setValueAtTime(1320, t);
    sh.frequency.exponentialRampToValueAtTime(660, t + 0.18);
    const shG = ctx.createGain();
    shG.gain.setValueAtTime(TUNING.audio.killVolume * 0.25, t);
    shG.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    sh.connect(shG);
    shG.connect(this.sfxGain!);
    sh.start(t);
    sh.stop(t + 0.22);
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
    // Sweeping bass
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
    // Noise tail
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

  // ---------- Internals ----------

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
