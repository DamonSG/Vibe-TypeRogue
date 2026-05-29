import type { StatsStore } from "../game/StatsStore";
import { formatClock, formatDurationShort, formatInt } from "../data/format";

export interface RecordsCallbacks {
  onBack(): void;
  onUiSound?(): void;
}

/**
 * RecordsScreen — local records / lifetime stats overlay. Reads the StatsStore
 * and renders per-mode + global sections in the shared gothic menu style.
 * Includes a Reset Records action guarded by a confirm dialog.
 */
export class RecordsScreen {
  private el: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    private stats: StatsStore,
    private cbs: RecordsCallbacks,
  ) {}

  get isOpen(): boolean {
    return this.el !== null;
  }

  open(): void {
    this.close();
    const el = document.createElement("div");
    el.className = "menu-overlay records-screen";
    el.innerHTML = `
      <div class="menu-panel records-panel">
        <h2 class="menu-heading">Records</h2>
        <div class="records-body">${this.renderBody()}</div>
        <div class="menu-actions records-actions">
          <button type="button" class="menu-button" data-reset>Reset Records</button>
          <button type="button" class="menu-button back" data-back>
            <span class="back-arrow">&larr;</span> Back
          </button>
        </div>
      </div>
    `;
    el.querySelector<HTMLButtonElement>("[data-back]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.close();
        this.cbs.onBack();
      },
    );
    el.querySelector<HTMLButtonElement>("[data-reset]")!.addEventListener(
      "click",
      () => {
        this.cbs.onUiSound?.();
        this.confirmReset();
      },
    );
    this.root.appendChild(el);
    this.el = el;
  }

  close(): void {
    this.removeConfirm();
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  private renderBody(): string {
    const d = this.stats.get();
    const c = d.castle;
    const e = d.endless;
    const f = d.fortyWords;
    const g = d.global;
    const avgWpm = this.stats.averageWpm();
    const fortyAvg = this.stats.fortyWordsAverageMs();

    return `
      <div class="records-section">
        <div class="records-heading">Cursed Castle Run</div>
        ${row("Best Stage", c.bestStage > 0 ? `${c.bestStage} / 10` : "—")}
        ${row("Runs", formatInt(c.runs))}
        ${row("Deaths", formatInt(c.deaths))}
        ${row("Best WPM", c.bestWpm > 0 ? String(c.bestWpm) : "—")}
        ${row("Fastest Clear", c.fastestMs > 0 ? formatDurationShort(c.fastestMs) : "—")}
      </div>
      <div class="records-section">
        <div class="records-heading">Endless Crypt</div>
        ${row("Highest Level", e.highestLevel > 0 ? String(e.highestLevel) : "—")}
        ${row("Bosses Defeated", formatInt(e.bossesDefeated))}
        ${row("Furthest Boss", e.furthestBoss > 0 ? `Lvl ${e.furthestBoss}` : "—")}
        ${row("Best WPM", e.bestWpm > 0 ? String(e.bestWpm) : "—")}
        ${row("Runs", formatInt(e.runs))}
      </div>
      <div class="records-section">
        <div class="records-heading">40 Words</div>
        ${row("Best Time", f.bestTimeMs > 0 ? formatClock(f.bestTimeMs) : "—")}
        ${row("Best WPM", f.bestWpm > 0 ? String(f.bestWpm) : "—")}
        ${row("Attempts", formatInt(f.attempts))}
        ${row("Average Time", fortyAvg > 0 ? formatClock(fortyAvg) : "—")}
        ${row("Last Time", f.lastTimeMs > 0 ? formatClock(f.lastTimeMs) : "—")}
      </div>
      <div class="records-section">
        <div class="records-heading">Global</div>
        ${row("Total Runs", formatInt(g.totalRuns))}
        ${row("Total Words Typed", formatInt(g.totalWordsTyped))}
        ${row("Enemies Defeated", formatInt(g.totalEnemiesDefeated))}
        ${row("Bosses Defeated", formatInt(g.totalBossesDefeated))}
        ${row("Best WPM", g.bestWpm > 0 ? String(g.bestWpm) : "—")}
        ${row("Average WPM", avgWpm > 0 ? String(avgWpm) : "—")}
        ${row("Total Play Time", g.totalPlayTimeMs > 0 ? formatDurationShort(g.totalPlayTimeMs) : "—")}
      </div>
    `;
  }

  private confirmReset(): void {
    this.removeConfirm();
    const dlg = document.createElement("div");
    dlg.className = "menu-overlay confirm-dialog";
    dlg.dataset.confirm = "1";
    dlg.innerHTML = `
      <div class="confirm-panel">
        <h3 class="confirm-title">Reset Records?</h3>
        <div class="confirm-body">All saved records and lifetime stats will be permanently erased.</div>
        <div class="confirm-actions">
          <button type="button" class="menu-button" data-cancel>Cancel</button>
          <button type="button" class="menu-button danger" data-ok>Reset</button>
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
        this.stats.reset();
        this.removeConfirm();
        // Re-render the body in place with cleared data.
        const body = this.el?.querySelector(".records-body");
        if (body) body.innerHTML = this.renderBody();
      },
    );
    this.root.appendChild(dlg);
  }

  private removeConfirm(): void {
    const dlg = this.root.querySelector('[data-confirm="1"]');
    if (dlg) dlg.remove();
  }
}

function row(label: string, value: string): string {
  return `<div class="records-row"><span class="records-label">${label}</span><span class="records-value">${value}</span></div>`;
}
