import { MAX_CUSTOM_TRACKS, type SettingsStore } from "./SettingsStore";
import { MUSIC_TRACK_ORDER, MUSIC_TRACKS, type MusicTrackId } from "../game/AudioEngine";

/**
 * SettingsScreen — shared settings overlay used by both the main menu and the
 * pause menu. SFX + Music volume sliders, a song-picker dropdown, optional
 * custom tracks, and screen-shake all persist via SettingsStore.
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

    const trackOptions = [
      `<option value="random"${s.musicMode === "random" ? " selected" : ""}>Random</option>`,
      ...MUSIC_TRACK_ORDER.map(
        (id) =>
          `<option value="${id}"${s.musicMode === id ? " selected" : ""}>${MUSIC_TRACKS[id].label}</option>`,
      ),
    ].join("");

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
        <div class="settings-row">
          <label class="settings-label" for="music-track">Background Music</label>
          <select id="music-track" class="settings-select" data-music-track>
            ${trackOptions}
          </select>
        </div>
        <div class="settings-row">
          <label class="settings-label">Custom Tracks</label>
          <div class="music-list" data-custom-list></div>
        </div>
        <div class="settings-row settings-row-toggle">
          <label class="settings-label" for="screen-shake">Screen Shake</label>
          <button id="screen-shake" type="button" class="settings-toggle" data-shake></button>
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
    const trackSelect = el.querySelector<HTMLSelectElement>("[data-music-track]")!;

    sfx.value = String(Math.round(s.sfxVolume * 100));
    music.value = String(Math.round(s.musicVolume * 100));
    sfxVal.textContent = `${sfx.value}%`;
    musicVal.textContent = `${music.value}%`;

    sfx.addEventListener("input", () => {
      sfxVal.textContent = `${sfx.value}%`;
      this.store.setSfxVolume(Number(sfx.value) / 100);
    });
    sfx.addEventListener("change", () => this.onUiSound?.());
    music.addEventListener("input", () => {
      musicVal.textContent = `${music.value}%`;
      this.store.setMusicVolume(Number(music.value) / 100);
    });

    trackSelect.addEventListener("change", () => {
      const v = trackSelect.value;
      this.store.setMusicMode(v === "random" ? "random" : (v as MusicTrackId));
      this.onUiSound?.();
    });

    const customList = el.querySelector<HTMLElement>("[data-custom-list]")!;
    this.renderCustomList(customList);

    const shakeBtn = el.querySelector<HTMLButtonElement>("[data-shake]")!;
    const renderShake = (enabled: boolean): void => {
      shakeBtn.textContent = enabled ? "On" : "Off";
      shakeBtn.classList.toggle("active", enabled);
      shakeBtn.setAttribute("aria-pressed", String(enabled));
    };
    renderShake(s.screenShake);
    shakeBtn.addEventListener("click", () => {
      const next = !this.store.get().screenShake;
      this.store.setScreenShake(next);
      renderShake(next);
      this.onUiSound?.();
    });

    const backBtn = el.querySelector<HTMLButtonElement>("[data-back]")!;
    backBtn.addEventListener("click", () => this.back());

    this.root.appendChild(el);
    this.el = el;
  }

  private renderCustomList(container: HTMLElement): void {
    const s = this.store.get();
    container.innerHTML = "";

    for (const t of s.customTracks) {
      const row = document.createElement("div");
      row.className = "music-row";
      const name = document.createElement("span");
      name.className = "music-name";
      name.textContent = t.name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "music-remove";
      remove.textContent = "✕";
      remove.title = "Remove track";
      remove.addEventListener("click", () => {
        this.store.removeCustomTrack(t.id);
        this.onUiSound?.();
        this.renderCustomList(container);
      });
      row.appendChild(name);
      row.appendChild(remove);
      container.appendChild(row);
    }

    container.appendChild(this.buildAddControls(container));
  }

  private buildAddControls(container: HTMLElement): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "music-add";
    const atCap = this.store.get().customTracks.length >= MAX_CUSTOM_TRACKS;

    wrap.innerHTML = `
      <div class="music-add-label">Add your own music${atCap ? " (limit reached)" : ""}</div>
      <div class="music-add-url">
        <input type="text" class="music-url-input" placeholder="Paste an audio URL" ${atCap ? "disabled" : ""} />
        <button type="button" class="music-add-btn" data-add-url ${atCap ? "disabled" : ""}>Add</button>
      </div>
      <label class="music-file-btn ${atCap ? "disabled" : ""}">
        Upload file
        <input type="file" accept="audio/*" class="music-file-input" ${atCap ? "disabled" : ""} hidden />
      </label>
      <div class="music-add-error" data-add-error></div>
    `;

    const urlInput = wrap.querySelector<HTMLInputElement>(".music-url-input")!;
    const addBtn = wrap.querySelector<HTMLButtonElement>("[data-add-url]")!;
    const fileInput = wrap.querySelector<HTMLInputElement>(".music-file-input")!;
    const errEl = wrap.querySelector<HTMLElement>("[data-add-error]")!;

    const showError = (msg: string): void => {
      errEl.textContent = msg;
    };

    addBtn.addEventListener("click", () => {
      const url = urlInput.value.trim();
      if (!url) {
        showError("Enter a URL first.");
        return;
      }
      const name = deriveName(url);
      if (!this.store.addCustomTrack(name, url)) {
        showError(`Limit of ${MAX_CUSTOM_TRACKS} custom tracks reached.`);
        return;
      }
      this.onUiSound?.();
      this.renderCustomList(container);
    });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (!this.store.addCustomTrack(stripExtension(file.name), dataUrl)) {
          showError(`Limit of ${MAX_CUSTOM_TRACKS} custom tracks reached.`);
          return;
        }
        this.onUiSound?.();
        this.renderCustomList(container);
      };
      reader.onerror = () => showError("Could not read that file.");
      reader.readAsDataURL(file);
    });

    return wrap;
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

function deriveName(url: string): string {
  try {
    const u = new URL(url, window.location.href);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return stripExtension(decodeURIComponent(last));
  } catch {
    /* fall through */
  }
  return "Custom Track";
}

function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "") || name;
}
