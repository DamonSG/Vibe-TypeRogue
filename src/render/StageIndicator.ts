import { CASTLE_ENCOUNTERS } from "../data/encounters";
import { GAME_MODES, type RunModeId } from "../data/modes";
import { isEndlessBossLevel } from "../game/EndlessGenerator";
import { formatClock } from "../data/format";

interface StageNode {
  el: HTMLElement;
  isBoss: boolean;
}

/**
 * StageIndicator — bottom run tracker above the input bar. Adapts per mode:
 *  - Cursed Castle Run: 10 fixed nodes (1-9 + Boss).
 *  - Endless Crypt: a sliding window of the current group of 5 (N N N N BOSS).
 *  - 40 Words: a word/time/WPM readout instead of stage tiles.
 * Purely presentational; never blocks input.
 */
export class StageIndicator {
  private el: HTMLElement;
  private nodes: StageNode[] = [];
  private mode: RunModeId = "cursedCastleRun";
  private currentGroup = -1;
  private readout: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "stage-indicator hidden";
    root.appendChild(this.el);
    this.buildCastleNodes();
  }

  /** Rebuild the tracker for the given mode. */
  configure(mode: RunModeId): void {
    this.mode = mode;
    this.currentGroup = -1;
    this.clear();
    if (mode === "cursedCastleRun") {
      this.buildCastleNodes();
    } else if (mode === "endlessCrypt") {
      this.el.classList.remove("readout-mode");
      // Window built lazily on first update().
    } else if (mode === "fortyWords") {
      this.buildReadout();
    }
  }

  setVisible(visible: boolean): void {
    this.el.classList.toggle("hidden", !visible);
  }

  /** Update node highlight from the active 0-based encounter/level index. */
  update(currentIndex: number): void {
    if (this.mode === "fortyWords") return;
    if (this.mode === "endlessCrypt") {
      const group = Math.floor(currentIndex / 5);
      if (group !== this.currentGroup) {
        this.currentGroup = group;
        this.buildEndlessWindow(group);
      }
      this.nodes.forEach((node, i) => {
        const nodeIndex = group * 5 + i;
        node.el.classList.toggle("completed", nodeIndex < currentIndex);
        node.el.classList.toggle("current", nodeIndex === currentIndex);
        node.el.classList.toggle("upcoming", nodeIndex > currentIndex);
      });
      return;
    }
    // Standard castle run.
    this.nodes.forEach((node, i) => {
      node.el.classList.toggle("completed", i < currentIndex);
      node.el.classList.toggle("current", i === currentIndex);
      node.el.classList.toggle("upcoming", i > currentIndex);
    });
  }

  /** 40 Words: update the word/time/WPM readout. */
  setReadout(p: {
    wordsCleared: number;
    targetWords: number;
    elapsedMs: number;
    wpm: number;
  }): void {
    if (!this.readout) return;
    const words = this.readout.querySelector(".readout-words");
    const time = this.readout.querySelector(".readout-time");
    const wpm = this.readout.querySelector(".readout-wpm");
    if (words) words.textContent = `Words ${p.wordsCleared} / ${p.targetWords}`;
    if (time) time.textContent = formatClock(p.elapsedMs);
    if (wpm) wpm.textContent = `WPM ${p.wpm}`;
  }

  // ---------- Builders ----------

  private clear(): void {
    this.el.innerHTML = "";
    this.nodes = [];
    this.readout = null;
  }

  private buildCastleNodes(): void {
    this.el.classList.remove("readout-mode");
    CASTLE_ENCOUNTERS.forEach((enc, i) => {
      const isBoss = enc.id === "boss";
      this.appendNode(isBoss ? "Boss" : String(i + 1), isBoss);
    });
  }

  private buildEndlessWindow(group: number): void {
    this.clear();
    this.el.classList.remove("readout-mode");
    const maxStages = GAME_MODES.endlessCrypt.maxStages;
    for (let i = 0; i < 5; i++) {
      const level = group * 5 + i + 1;
      if (level > maxStages) break;
      const isBoss = isEndlessBossLevel(level);
      this.appendNode(isBoss ? "Boss" : String(level), isBoss);
    }
  }

  private appendNode(label: string, isBoss: boolean): void {
    if (this.nodes.length > 0) {
      const link = document.createElement("div");
      link.className = "stage-link";
      this.el.appendChild(link);
    }
    const node = document.createElement("div");
    node.className = `stage-node${isBoss ? " boss" : ""}`;
    const labelEl = document.createElement("span");
    labelEl.className = "stage-label";
    labelEl.textContent = label;
    node.appendChild(labelEl);
    this.el.appendChild(node);
    this.nodes.push({ el: node, isBoss });
  }

  private buildReadout(): void {
    this.clear();
    this.el.classList.add("readout-mode");
    const wrap = document.createElement("div");
    wrap.className = "stage-readout";
    wrap.innerHTML = `
      <span class="readout-words">Words 0 / 40</span>
      <span class="readout-sep">·</span>
      <span class="readout-time">00:00.000</span>
      <span class="readout-sep">·</span>
      <span class="readout-wpm">WPM 0</span>
    `;
    this.el.appendChild(wrap);
    this.readout = wrap;
  }
}
