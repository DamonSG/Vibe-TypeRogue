import { TUNING } from "../data/tuning";
import type { AudioEngine } from "../game/AudioEngine";

export interface Settings {
  /** SFX bus volume 0..1 */
  sfxVolume: number;
  /** Music bus volume 0..1 */
  musicVolume: number;
}

const STORAGE_KEY = "typerogue.settings";

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

  private load(): Settings {
    const fallback: Settings = {
      sfxVolume: TUNING.audio.defaultSfxVolume,
      musicVolume: TUNING.audio.defaultMusicVolume,
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        sfxVolume:
          typeof parsed.sfxVolume === "number"
            ? clamp01(parsed.sfxVolume)
            : fallback.sfxVolume,
        musicVolume:
          typeof parsed.musicVolume === "number"
            ? clamp01(parsed.musicVolume)
            : fallback.musicVolume,
      };
    } catch {
      return fallback;
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      /* localStorage unavailable (private mode) — ignore. */
    }
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
