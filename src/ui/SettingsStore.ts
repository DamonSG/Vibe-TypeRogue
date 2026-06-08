import { TUNING } from "../data/tuning";
import {
  MUSIC_TRACK_ORDER,
  type AudioEngine,
  type MusicTrackId,
  type PlaylistItem,
} from "../game/AudioEngine";

/** A user-supplied track (URL or uploaded file stored as a data URI). */
export interface CustomTrack {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

/** How background music is selected: shuffle all, or loop one specific track. */
export type MusicMode = "random" | MusicTrackId;

export interface Settings {
  /** SFX bus volume 0..1 */
  sfxVolume: number;
  /** Music bus volume 0..1 */
  musicVolume: number;
  /** Music selection mode: "random" shuffles all built-ins, else a single track. */
  musicMode: MusicMode;
  /** Built-in songs enabled for the rotation playlist. */
  enabledTracks: MusicTrackId[];
  /** Player-added tracks (URL / uploaded file). */
  customTracks: CustomTrack[];
  /** Whether screen shake feedback is enabled. */
  screenShake: boolean;
}

const STORAGE_KEY = "typerogue.settings";

/** Max custom tracks a player can keep (avoids localStorage bloat). */
export const MAX_CUSTOM_TRACKS = 5;

const BUILTIN_TRACK_SET: ReadonlySet<string> = new Set(MUSIC_TRACK_ORDER);

/**
 * SettingsStore — persists player audio preferences to localStorage and applies
 * them to the AudioEngine. Restored on load; saved on every change.
 */
export class SettingsStore {
  private settings: Settings;

  constructor(private audio: AudioEngine) {
    this.settings = this.load();
  }

  /** Apply current settings to the audio engine (call after load / on change). */
  apply(): void {
    this.audio.setSfxVolume(this.settings.sfxVolume);
    this.audio.setMusicVolume(this.settings.musicVolume);
    this.audio.setShuffle(this.settings.musicMode === "random");
    this.applyPlaylist();
  }

  get(): Readonly<Settings> {
    return this.settings;
  }

  setSfxVolume(v: number): void {
    this.settings.sfxVolume = clamp01(v);
    this.audio.setSfxVolume(this.settings.sfxVolume);
    this.save();
  }

  setMusicVolume(v: number): void {
    this.settings.musicVolume = clamp01(v);
    this.audio.setMusicVolume(this.settings.musicVolume);
    this.save();
  }

  /**
   * Choose the music mode: "random" enables every built-in track and shuffles
   * playback; a specific track id loops that one track only.
   */
  setMusicMode(mode: MusicMode): void {
    this.settings.musicMode = mode;
    if (mode === "random") {
      this.settings.enabledTracks = [...MUSIC_TRACK_ORDER];
      this.audio.setShuffle(true);
    } else {
      this.settings.enabledTracks = MUSIC_TRACK_ORDER.filter((t) => t === mode);
      this.audio.setShuffle(false);
    }
    this.applyPlaylist();
    this.save();
  }

  /** Enable/disable a built-in track in the rotation. */
  setTrackEnabled(id: MusicTrackId, enabled: boolean): void {
    const set = new Set(this.settings.enabledTracks);
    if (enabled) set.add(id);
    else set.delete(id);
    // Preserve canonical order.
    this.settings.enabledTracks = MUSIC_TRACK_ORDER.filter((t) => set.has(t));
    this.applyPlaylist();
    this.save();
  }

  /** Add a player track. Returns false if the cap is reached. */
  addCustomTrack(name: string, url: string): boolean {
    if (this.settings.customTracks.length >= MAX_CUSTOM_TRACKS) return false;
    const id = `custom:${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    this.settings.customTracks.push({
      id,
      name: name.trim() || "Custom Track",
      url,
      enabled: true,
    });
    this.applyPlaylist();
    this.save();
    return true;
  }

  removeCustomTrack(id: string): void {
    this.settings.customTracks = this.settings.customTracks.filter(
      (t) => t.id !== id,
    );
    this.applyPlaylist();
    this.save();
  }

  setCustomTrackEnabled(id: string, enabled: boolean): void {
    const track = this.settings.customTracks.find((t) => t.id === id);
    if (!track) return;
    track.enabled = enabled;
    this.applyPlaylist();
    this.save();
  }

  setScreenShake(enabled: boolean): void {
    this.settings.screenShake = enabled;
    this.save();
  }

  /** Build the engine playlist from enabled built-in + custom tracks. */
  private applyPlaylist(): void {
    const items: PlaylistItem[] = [];
    for (const id of MUSIC_TRACK_ORDER) {
      if (this.settings.enabledTracks.includes(id)) {
        items.push({ kind: "builtin", id });
      }
    }
    for (const t of this.settings.customTracks) {
      if (t.enabled) items.push({ kind: "custom", id: t.id, url: t.url });
    }
    this.audio.setPlaylist(items);
  }

  private load(): Settings {
    const fallback: Settings = {
      sfxVolume: TUNING.audio.defaultSfxVolume,
      musicVolume: TUNING.audio.defaultMusicVolume,
      musicMode: "random",
      enabledTracks: [...MUSIC_TRACK_ORDER],
      customTracks: [],
      screenShake: true,
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<Settings>;
      const enabledTracks = sanitizeEnabledTracks(
        parsed.enabledTracks,
        fallback.enabledTracks,
      );
      return {
        sfxVolume:
          typeof parsed.sfxVolume === "number"
            ? clamp01(parsed.sfxVolume)
            : fallback.sfxVolume,
        musicVolume:
          typeof parsed.musicVolume === "number"
            ? clamp01(parsed.musicVolume)
            : fallback.musicVolume,
        musicMode: sanitizeMusicMode(parsed.musicMode, enabledTracks),
        enabledTracks,
        customTracks: sanitizeCustomTracks(parsed.customTracks),
        screenShake:
          typeof parsed.screenShake === "boolean"
            ? parsed.screenShake
            : fallback.screenShake,
      };
    } catch {
      return fallback;
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      /* localStorage unavailable / quota exceeded — keep session-only state. */
    }
  }
}

function sanitizeMusicMode(
  value: unknown,
  enabledTracks: MusicTrackId[],
): MusicMode {
  if (value === "random") return "random";
  if (typeof value === "string" && BUILTIN_TRACK_SET.has(value)) {
    return value as MusicTrackId;
  }
  // No saved mode (older settings): infer from enabled tracks. A single enabled
  // track means single-track mode; anything else falls back to random.
  if (enabledTracks.length === 1) return enabledTracks[0];
  return "random";
}

function sanitizeEnabledTracks(
  value: unknown,
  fallback: MusicTrackId[],
): MusicTrackId[] {
  if (!Array.isArray(value)) return fallback;
  const filtered = value.filter(
    (v): v is MusicTrackId => typeof v === "string" && BUILTIN_TRACK_SET.has(v),
  );
  // Preserve canonical order, drop duplicates.
  return MUSIC_TRACK_ORDER.filter((t) => filtered.includes(t));
}

function sanitizeCustomTracks(value: unknown): CustomTrack[] {
  if (!Array.isArray(value)) return [];
  const out: CustomTrack[] = [];
  for (const raw of value) {
    if (
      raw &&
      typeof raw === "object" &&
      typeof (raw as CustomTrack).id === "string" &&
      typeof (raw as CustomTrack).url === "string"
    ) {
      const t = raw as CustomTrack;
      out.push({
        id: t.id,
        name: typeof t.name === "string" ? t.name : "Custom Track",
        url: t.url,
        enabled: typeof t.enabled === "boolean" ? t.enabled : true,
      });
    }
    if (out.length >= MAX_CUSTOM_TRACKS) break;
  }
  return out;
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
