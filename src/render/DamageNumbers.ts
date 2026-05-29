import { TUNING } from "../data/tuning";

/**
 * DamageNumbers — lightweight floating combat text. Each number is an
 * independent self-removing DOM node, so many can animate at once. Used for
 * the "-N" damage feedback that floats up from an enemy and fades over ~0.6s.
 */
export class DamageNumbers {
  private layer: HTMLElement;

  constructor(root: HTMLElement) {
    this.layer = document.createElement("div");
    this.layer.className = "dmg-number-layer";
    this.layer.style.cssText =
      "position:absolute;inset:0;pointer-events:none;z-index:24;";
    root.appendChild(this.layer);
  }

  /** Spawn a floating damage number at a screen position. */
  spawn(
    amount: number,
    screenX: number,
    screenY: number,
    kind: "damage" | "crit" = "damage",
  ): void {
    const el = document.createElement("div");
    el.className = `dmg-number ${kind}`;
    el.textContent = `-${amount}`;
    // Slight horizontal jitter so stacked hits fan out instead of overlapping.
    const jitter = (Math.random() - 0.5) * 28;
    el.style.left = `${screenX + jitter}px`;
    el.style.top = `${screenY}px`;
    this.layer.appendChild(el);
    window.setTimeout(() => el.remove(), TUNING.feedback.damageNumberMs + 60);
  }

  /** Remove all active numbers (between runs). */
  clear(): void {
    this.layer.innerHTML = "";
  }
}
