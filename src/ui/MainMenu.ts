import type { SettingsScreen } from "./SettingsScreen";
import { GAME_MODES, MODE_ORDER, DEFAULT_MODE, type RunModeId } from "../data/modes";

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
    private cbs: MainMenuCallbacks,
  ) {}

  get isOpen(): boolean {
    return this.el !== null;
  }

  show(): void {
    this.hide();
    const el = document.createElement("div");
    el.className = "menu-overlay main-menu";
    el.dataset.mainMenu = "1";
    el.innerHTML = `
      <div class="main-menu-content">
        <div class="menu-eyebrow">A Typing Roguelike</div>
        <h1 class="menu-title">TypeRogue</h1>
        <div class="menu-subtitle">Cursed Castle &mdash; Vol. I</div>
        <div class="menu-buttons">
          <button type="button" class="menu-button primary" data-start>Start Game</button>
          <button type="button" class="menu-button" data-mode>Game Mode</button>
          <button type="button" class="menu-button" data-records>Records</button>
          <button type="button" class="menu-button" data-settings>Settings</button>
        </div>
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
}
