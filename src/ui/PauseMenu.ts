import type { SettingsScreen } from "./SettingsScreen";
import type { SettingsStore } from "./SettingsStore";

export interface PauseMenuCallbacks {
  onResume(): void;
  onRestart(): void;
  onAbandon(): void;
  onExitToMenu(): void;
  onUiSound?(): void;
}

/**
 * PauseMenu — in-run pause overlay with Resume / Settings / Restart / Abandon /
 * Exit. Destructive actions (Restart, Abandon, Exit) show a confirm dialog
 * first. The pause button itself lives here and is mounted top-right.
 * Also hosts inline SFX/Music mute toggles next to the pause icon.
 */
export class PauseMenu {
  private overlay: HTMLElement | null = null;
  private pauseButton: HTMLElement;
  private muteGroup: HTMLElement;
  private sfxMuteBtn: HTMLButtonElement;
  private musicMuteBtn: HTMLButtonElement;

  constructor(
    private root: HTMLElement,
    private settings: SettingsScreen,
    private settingsStore: SettingsStore,
    private cbs: PauseMenuCallbacks,
    onPauseClicked: () => void,
  ) {
    // Wrapper for pause button + mute buttons
    const group = document.createElement("div");
    group.className = "pause-group hidden";

    const sfxBtn = document.createElement("button");
    sfxBtn.type = "button";
    sfxBtn.className = "mute-btn ingame";
    sfxBtn.setAttribute("aria-label", "Mute SFX");
    sfxBtn.innerHTML = `<span class="mute-icon">🔊</span>`;
    sfxBtn.addEventListener("click", () => {
      const cur = this.settingsStore.get().sfxVolume;
      this.settingsStore.setSfxVolume(cur > 0 ? 0 : 0.5);
      this.syncMuteState();
    });

    const musicBtn = document.createElement("button");
    musicBtn.type = "button";
    musicBtn.className = "mute-btn ingame";
    musicBtn.setAttribute("aria-label", "Mute Music");
    musicBtn.innerHTML = `<span class="mute-icon">🎵</span>`;
    musicBtn.addEventListener("click", () => {
      const cur = this.settingsStore.get().musicVolume;
      this.settingsStore.setMusicVolume(cur > 0 ? 0 : 0.1);
      this.syncMuteState();
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pause-button";
    btn.setAttribute("aria-label", "Pause");
    btn.innerHTML = `<span class="pause-icon"></span>`;
    btn.addEventListener("click", () => onPauseClicked());

    group.appendChild(sfxBtn);
    group.appendChild(musicBtn);
    group.appendChild(btn);
    this.root.appendChild(group);
    this.muteGroup = group;
    this.pauseButton = btn;
    this.sfxMuteBtn = sfxBtn;
    this.musicMuteBtn = musicBtn;
    this.syncMuteState();
  }

  private syncMuteState(): void {
    const s = this.settingsStore.get();
    this.sfxMuteBtn.classList.toggle("muted", s.sfxVolume === 0);
    this.sfxMuteBtn.querySelector(".mute-icon")!.textContent =
      s.sfxVolume === 0 ? "🔇" : "🔊";
    this.musicMuteBtn.classList.toggle("muted", s.musicVolume === 0);
    this.musicMuteBtn.querySelector(".mute-icon")!.textContent =
      s.musicVolume === 0 ? "🔇" : "🎵";
  }

  get isOverlayOpen(): boolean {
    return this.overlay !== null;
  }

  /** Show/hide the top-right pause + mute group (only during active gameplay). */
  setPauseButtonVisible(visible: boolean): void {
    this.muteGroup.classList.toggle("hidden", !visible);
    this.syncMuteState();
  }

  open(): void {
    this.close();
    const el = document.createElement("div");
    el.className = "menu-overlay pause-menu";
    el.innerHTML = `
      <div class="menu-panel">
        <h2 class="menu-heading">Paused</h2>
        <div class="menu-buttons">
          <button type="button" class="menu-button primary" data-resume>Resume</button>
          <button type="button" class="menu-button" data-settings>Settings</button>
          <button type="button" class="menu-button" data-restart>Restart Run</button>
          <button type="button" class="menu-button" data-abandon>Abandon Run</button>
          <button type="button" class="menu-button danger" data-exit>Exit to Main Menu</button>
        </div>
      </div>
    `;
    el.querySelector<HTMLButtonElement>("[data-resume]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.cbs.onResume();
      },
    );
    el.querySelector<HTMLButtonElement>("[data-settings]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.hideOverlayOnly();
        this.settings.open(() => this.open());
      },
    );
    el.querySelector<HTMLButtonElement>("[data-restart]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.confirm(
          "Restart Run?",
          "Return to Stage 1. Current progress will be lost.",
          "Restart",
          () => this.cbs.onRestart(),
        );
      },
    );
    el.querySelector<HTMLButtonElement>("[data-abandon]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.confirm(
          "Abandon Run?",
          "End this run and view your summary.",
          "Abandon",
          () => this.cbs.onAbandon(),
        );
      },
    );
    el.querySelector<HTMLButtonElement>("[data-exit]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.confirm(
          "Exit to Main Menu?",
          "This run will be discarded.",
          "Exit",
          () => this.cbs.onExitToMenu(),
        );
      },
    );
    this.root.appendChild(el);
    this.overlay = el;
  }

  /** Fully close the pause overlay (and any confirm dialog). */
  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.removeConfirm();
  }

  /** Hide just the overlay element (used when opening Settings over it). */
  private hideOverlayOnly(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private confirm(
    title: string,
    body: string,
    confirmLabel: string,
    onConfirm: () => void,
  ): void {
    this.removeConfirm();
    const dlg = document.createElement("div");
    dlg.className = "menu-overlay confirm-dialog";
    dlg.dataset.confirm = "1";
    dlg.innerHTML = `
      <div class="confirm-panel">
        <h3 class="confirm-title">${title}</h3>
        <div class="confirm-body">${body}</div>
        <div class="confirm-actions">
          <button type="button" class="menu-button" data-cancel>Cancel</button>
          <button type="button" class="menu-button danger" data-ok>${confirmLabel}</button>
        </div>
      </div>
    `;
    dlg.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.removeConfirm();
      },
    );
    dlg.querySelector<HTMLButtonElement>("[data-ok]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.removeConfirm();
        onConfirm();
      },
    );
    this.root.appendChild(dlg);
  }

  private removeConfirm(): void {
    const dlg = this.root.querySelector('[data-confirm="1"]');
    if (dlg) dlg.remove();
  }
}
