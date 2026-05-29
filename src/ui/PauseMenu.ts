import type { SettingsScreen } from "./SettingsScreen";

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
 */
export class PauseMenu {
  private overlay: HTMLElement | null = null;
  private pauseButton: HTMLElement;

  constructor(
    private root: HTMLElement,
    private settings: SettingsScreen,
    private cbs: PauseMenuCallbacks,
    onPauseClicked: () => void,
  ) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pause-button hidden";
    btn.setAttribute("aria-label", "Pause");
    btn.innerHTML = `<span class="pause-icon"></span>`;
    btn.addEventListener("click", () => onPauseClicked());
    this.root.appendChild(btn);
    this.pauseButton = btn;
  }

  get isOverlayOpen(): boolean {
    return this.overlay !== null;
  }

  /** Show/hide the small top-right pause button (only during active gameplay). */
  setPauseButtonVisible(visible: boolean): void {
    this.pauseButton.classList.toggle("hidden", !visible);
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
