/**
 * InputManager — listens to keydown, filters to meaningful characters
 * (letters, digits, space, common punctuation), ignores modifier-only keys,
 * and forwards normalized chars + special keys to subscribers.
 */

export type InputHandler = (input: InputEventLite) => void;

export interface InputEventLite {
  type: "char" | "backspace" | "enter" | "escape" | "digit" | "any";
  /** Single character (case-preserving) for type='char'; digit (0-9) string for type='digit'. */
  value: string;
  /** Original keyboard event for fallback. */
  raw: KeyboardEvent;
}

const IGNORED_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
  "Delete",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "ContextMenu",
  "ScrollLock",
  "Pause",
  "NumLock",
  "OS",
]);

/** A "char" we accept: printable single character including punctuation we support. */
const ACCEPTED_PRINTABLE = /^[A-Za-z0-9 ,.'!?\-:;"]$/;

export class InputManager {
  private handlers = new Set<InputHandler>();
  private enabled = true;
  private bound = false;

  attach(): void {
    if (this.bound) return;
    window.addEventListener("keydown", this.onKeyDown, { capture: false });
    this.bound = true;
  }

  detach(): void {
    if (!this.bound) return;
    window.removeEventListener("keydown", this.onKeyDown);
    this.bound = false;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  on(handler: InputHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(ev: InputEventLite): void {
    for (const h of this.handlers) h(ev);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    // Ignore IME composition
    if (e.isComposing) return;
    // Ignore if user is typing in an actual input element (none in V1, but safe)
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    if (IGNORED_KEYS.has(e.key)) return;
    // Drop modifier+letter combos (Cmd+R, Ctrl+W etc) — let browser handle them.
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;
    if (key === "Backspace") {
      e.preventDefault();
      this.emit({ type: "backspace", value: "", raw: e });
      this.emit({ type: "any", value: "Backspace", raw: e });
      return;
    }
    if (key === "Enter") {
      this.emit({ type: "enter", value: "", raw: e });
      this.emit({ type: "any", value: "Enter", raw: e });
      return;
    }
    if (key === "Escape") {
      this.emit({ type: "escape", value: "", raw: e });
      this.emit({ type: "any", value: "Escape", raw: e });
      return;
    }

    if (key.length === 1 && ACCEPTED_PRINTABLE.test(key)) {
      // Digits 1..0 broadcast separately for upgrade selection / hotkeys
      if (/^[0-9]$/.test(key)) {
        this.emit({ type: "digit", value: key, raw: e });
      }
      // Case-preserving: emit the key as typed so prompt matching is strict.
      this.emit({ type: "char", value: key, raw: e });
      this.emit({ type: "any", value: key, raw: e });
      e.preventDefault();
    }
  };
}
