import type { SettingsScreen } from "./SettingsScreen";
import type { SettingsStore } from "./SettingsStore";
import { GAME_MODES, MODE_ORDER, DEFAULT_MODE, type RunModeId } from "../data/modes";
import { MUSIC_TRACK_ORDER, MUSIC_TRACKS, type MusicTrackId } from "../game/AudioEngine";

export interface MainMenuCallbacks {
  onStartGame(mode: RunModeId): void;
  onShowRecords(): void;
  /** Optional UI click sound. */
  onUiSound?(): void;
}

/**
 * MainMenu — title screen with Start Game / Game Mode / Records / Settings.
 * Hosts a Game Mode sub-screen (three playable modes) and delegates Settings to
 * the shared screen. Records opens the dedicated records overlay.
 */
export class MainMenu {
  private el: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    private settings: SettingsScreen,
    private settingsStore: SettingsStore,
    private cbs: MainMenuCallbacks,
  ) {}

  get isOpen(): boolean {
    return this.el !== null;
  }

  show(): void {
    this.hide();

    const musicMode = this.settingsStore.get().musicMode;
    const trackOptions = [
      `<option value="random"${musicMode === "random" ? " selected" : ""}>Random</option>`,
      ...MUSIC_TRACK_ORDER.map(
        (id) =>
          `<option value="${id}"${musicMode === id ? " selected" : ""}>${MUSIC_TRACKS[id].label}</option>`,
      ),
    ].join("");

    const el = document.createElement("div");
    el.className = "menu-overlay main-menu";
    el.dataset.mainMenu = "1";
    el.innerHTML = `
      <div class="main-menu-content">
        <div class="menu-eyebrow">A TYPING LIGHTGUN</div>
        <h1 class="menu-title">TypeRogue</h1>
        <div class="menu-subtitle">Cursed Castle &mdash; Vol. I</div>
        <div class="menu-buttons">
          <button type="button" class="menu-button primary" data-start>Start Game</button>
          <button type="button" class="menu-button" data-mode>Game Mode</button>
          <button type="button" class="menu-button" data-records>Records</button>
          <button type="button" class="menu-button" data-settings>Settings</button>
        </div>
        <div class="menu-song-picker">
          <label class="menu-song-label" for="menu-music-track">Music</label>
          <select id="menu-music-track" class="settings-select" data-menu-track>
            ${trackOptions}
          </select>
        </div>
        <div class="menu-mute-buttons" data-mute-area></div>
        <div class="menu-footer">Type the words above enemies to attack. Survive the castle and fell the Cursed Knight.</div>
      </div>
    `;
    el.querySelector<HTMLButtonElement>("[data-start]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.cbs.onStartGame(DEFAULT_MODE);
      },
    );
    el.querySelector<HTMLButtonElement>("[data-mode]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.showGameMode();
      },
    );
    el.querySelector<HTMLButtonElement>("[data-records]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.cbs.onShowRecords();
      },
    );
    el.querySelector<HTMLButtonElement>("[data-settings]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.hide();
        this.settings.open(() => this.show());
      },
    );

    const trackSelect = el.querySelector<HTMLSelectElement>("[data-menu-track]")!;
    trackSelect.addEventListener("change", () => {
      const v = trackSelect.value;
      this.settingsStore.setMusicMode(v === "random" ? "random" : (v as MusicTrackId));
      this.cbs.onUiSound?.();
    });

    // Mute buttons (top-right of menu content)
    const muteArea = el.querySelector<HTMLElement>("[data-mute-area]")!;
    this.buildMuteButtons(muteArea);

    this.root.appendChild(el);
    this.el = el;
  }

  hide(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  /** Fallback: any-key while the menu is showing starts the default run. */
  handleAnyKey(): boolean {
    if (!this.isOpen) return false;
    this.cbs.onUiSound?.();
    this.cbs.onStartGame(DEFAULT_MODE);
    return true;
  }

  private showGameMode(): void {
    this.hide();
    const el = document.createElement("div");
    el.className = "menu-overlay game-mode-screen";
    const cards = MODE_ORDER.map((id) => {
      const m = GAME_MODES[id];
      return `
        <button type="button" class="mode-card" data-mode-id="${id}">
          <div class="mode-name">${m.label}</div>
          <div class="mode-desc">${m.description}</div>
        </button>`;
    }).join("");
    el.innerHTML = `
      <div class="menu-panel">
        <h2 class="menu-heading">Game Mode</h2>
        <div class="mode-list">
          ${cards}
        </div>
        <div class="menu-actions">
          <button type="button" class="menu-button" data-records>Records</button>
          <button type="button" class="menu-button back" data-back>
            <span class="back-arrow">&larr;</span> Back
          </button>
        </div>
      </div>
    `;
    el.querySelectorAll<HTMLButtonElement>("[data-mode-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.cbs.onUiSound?.();
        const id = btn.dataset.modeId as RunModeId;
        el.remove();
        this.cbs.onStartGame(id);
      });
    });
    el.querySelector<HTMLButtonElement>("[data-records]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        el.remove();
        this.cbs.onShowRecords();
      },
    );
    el.querySelector<HTMLButtonElement>("[data-back]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        el.remove();
        this.show();
      },
    );
    this.root.appendChild(el);
  }

  private buildMuteButtons(container: HTMLElement): void {
    container.innerHTML = `
      <button type="button" class="mute-btn" data-mute-sfx title="Mute SFX">
        <span class="mute-icon">🔊</span><span class="mute-label">SFX</span>
      </button>
      <button type="button" class="mute-btn" data-mute-music title="Mute Music">
        <span class="mute-icon">🎵</span><span class="mute-label">Music</span>
      </button>
    `;
    const sfxBtn = container.querySelector<HTMLButtonElement>("[data-mute-sfx]")!;
    const musicBtn = container.querySelector<HTMLButtonElement>("[data-mute-music]")!;

    const syncState = (): void => {
      const s = this.settingsStore.get();
      sfxBtn.classList.toggle("muted", s.sfxVolume === 0);
      sfxBtn.querySelector(".mute-icon")!.textContent = s.sfxVolume === 0 ? "🔇" : "🔊";
      musicBtn.classList.toggle("muted", s.musicVolume === 0);
      musicBtn.querySelector(".mute-icon")!.textContent = s.musicVolume === 0 ? "🔇" : "🎵";
    };
    syncState();

    sfxBtn.addEventListener("click", () => {
      const cur = this.settingsStore.get().sfxVolume;
      this.settingsStore.setSfxVolume(cur > 0 ? 0 : 0.5);
      syncState();
    });
    musicBtn.addEventListener("click", () => {
      const cur = this.settingsStore.get().musicVolume;
      this.settingsStore.setMusicVolume(cur > 0 ? 0 : 0.1);
      syncState();
    });
  }
}
