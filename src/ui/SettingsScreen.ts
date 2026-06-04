import type { SettingsStore } from "./SettingsStore";

/**
 * SettingsScreen — shared settings overlay used by both the main menu and the
 * pause menu. SFX + Music volume sliders persist via SettingsStore. The Back
 * button returns control to whoever opened it (callback supplied per open).
 */
export class SettingsScreen {
  private el: HTMLElement | null = null;
  private onBack: (() => void) | null = null;

  constructor(
    private root: HTMLElement,
    private store: SettingsStore,
    private onUiSound?: () => void,
  ) {}

  get isOpen(): boolean {
    return this.el !== null;
  }

  open(onBack: () => void): void {
    this.close();
    this.onBack = onBack;
    const s = this.store.get();

    const el = document.createElement("div");
    el.className = "menu-overlay settings-screen";
    el.innerHTML = `
      <div class="menu-panel">
        <h2 class="menu-heading">Settings</h2>
        <div class="settings-row">
          <label class="settings-label" for="sfx-vol">SFX Volume</label>
          <div class="slider-wrap">
            <input id="sfx-vol" class="settings-slider" type="range" min="0" max="100" step="1" />
            <span class="settings-value" data-sfx-value></span>
          </div>
        </div>
        <div class="settings-row">
          <label class="settings-label" for="music-vol">Music Volume</label>
          <div class="slider-wrap">
            <input id="music-vol" class="settings-slider" type="range" min="0" max="100" step="1" />
            <span class="settings-value" data-music-value></span>
          </div>
        </div>
        <div class="menu-actions">
          <button type="button" class="menu-button back" data-back>
            <span class="back-arrow">&larr;</span> Back
          </button>
        </div>
      </div>
    `;

    const sfx = el.querySelector<HTMLInputElement>("#sfx-vol")!;
    const music = el.querySelector<HTMLInputElement>("#music-vol")!;
    const sfxVal = el.querySelector<HTMLElement>("[data-sfx-value]")!;
    const musicVal = el.querySelector<HTMLElement>("[data-music-value]")!;

    sfx.value = String(Math.round(s.sfxVolume * 100));
    music.value = String(Math.round(s.musicVolume * 100));
    sfxVal.textContent = `${sfx.value}%`;
    musicVal.textContent = `${music.value}%`;

    sfx.addEventListener("input", () => {
      sfxVal.textContent = `${sfx.value}%`;
      this.store.setSfxVolume(Number(sfx.value) / 100);
    });
    // Light click feedback when releasing the SFX slider.
    sfx.addEventListener("change", () => this.onUiSound?.());
    music.addEventListener("input", () => {
      musicVal.textContent = `${music.value}%`;
      this.store.setMusicVolume(Number(music.value) / 100);
    });

    const backBtn = el.querySelector<HTMLButtonElement>("[data-back]")!;
    backBtn.addEventListener("click", () => this.back());

    this.root.appendChild(el);
    this.el = el;
  }

  back(): void {
    this.onUiSound?.();
    const cb = this.onBack;
    this.close();
    cb?.();
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.onBack = null;
  }
}
