import type { EnemyKind } from "../types";
import { GameState, spawnEnemy } from "./GameState";

export interface TimeAttackCallbacks {
  onWordSpawned(enemyId: string): void;
  /** Fired exactly when the first word appears — timer should start now. */
  onFirstWord(): void;
}

/**
 * TimeAttackManager drives the 40 Words mode: it keeps a small number of
 * one-shot, single-word enemies on screen, spawning replacements from a
 * pre-generated list until the target count has been spawned. The owning Game
 * reports clears so completion can be detected exactly on the final word.
 */
export class TimeAttackManager {
  private queue: string[] = [];
  private spawnedCount = 0;
  clearedCount = 0;
  active = false;
  /** How many words may be on screen at once. */
  private concurrency = 3;
  /** Candidate lane positions; the emptiest one is chosen per spawn. */
  private lanes = [-0.9, -0.45, 0.0, 0.45, 0.9];
  private laneCursor = 0;

  constructor(
    private state: GameState,
    private cbs: TimeAttackCallbacks,
  ) {}

  reset(): void {
    this.queue = [];
    this.spawnedCount = 0;
    this.clearedCount = 0;
    this.active = false;
    this.laneCursor = 0;
  }

  /** Begin the run with a fresh word list. */
  start(words: string[]): void {
    this.reset();
    this.queue = words.slice();
    this.active = true;
  }

  get target(): number {
    return this.queue.length || this.spawnedCount;
  }

  get isComplete(): boolean {
    return this.active && this.clearedCount >= this.queue.length;
  }

  /** Called by Game when a one-shot enemy is cleared in this mode. */
  notifyCleared(): void {
    if (!this.active) return;
    this.clearedCount++;
  }

  update(_deltaMs: number): void {
    if (!this.active) return;
    if (this.spawnedCount >= this.queue.length) return;
    const aliveCount = this.state.enemies.filter(
      (e) => e.alive && !e.dying,
    ).length;
    if (aliveCount < this.concurrency) {
      this.spawnNext();
    }
  }

  private spawnNext(): void {
    if (this.spawnedCount >= this.queue.length) return;
    // Prefer the next queued word whose first letter doesn't collide with an
    // alive enemy, so the player can commit a keystroke unambiguously.
    const aliveFirst = new Set(
      this.state.enemies
        .filter((e) => e.alive && !e.dying)
        .map((e) => e.promptMatch.charAt(0)),
    );
    let pickIndex = this.spawnedCount;
    for (let i = this.spawnedCount; i < this.queue.length; i++) {
      const first = this.queue[i].charAt(0).toLowerCase();
      if (!aliveFirst.has(first)) {
        pickIndex = i;
        break;
      }
    }
    // Swap the chosen word into the current spawn slot to preserve count/order.
    if (pickIndex !== this.spawnedCount) {
      const tmp = this.queue[this.spawnedCount];
      this.queue[this.spawnedCount] = this.queue[pickIndex];
      this.queue[pickIndex] = tmp;
    }
    const word = this.queue[this.spawnedCount];

    const laneX = this.pickLane();
    const kind: EnemyKind = "skeleton";
    const e = spawnEnemy(this.state, kind, {
      laneX,
      depth: 0.85,
      promptOverride: word,
      defOverride: { hp: 1, attackTimerMs: 999999, refreshOnSurvive: false },
    });
    e.hp = 1;
    e.maxHp = 1;
    this.state.enemies.push(e);

    const isFirst = this.spawnedCount === 0;
    this.spawnedCount++;
    if (isFirst) {
      this.state.timeAttackStartMs = performance.now();
      this.cbs.onFirstWord();
    }
    this.cbs.onWordSpawned(e.id);
  }

  /**
   * Choose the candidate lane farthest from every currently-alive enemy so the
   * on-screen word cards stay well separated. Falls back to round-robin when no
   * enemies are alive (e.g. the very first spawn).
   */
  private pickLane(): number {
    const aliveLanes = this.state.enemies
      .filter((e) => e.alive && !e.dying)
      .map((e) => e.laneX);
    if (aliveLanes.length === 0) {
      const lane = this.lanes[this.laneCursor % this.lanes.length];
      this.laneCursor++;
      return lane;
    }
    let bestLane = this.lanes[0];
    let bestDist = -Infinity;
    for (const lane of this.lanes) {
      let nearest = Infinity;
      for (const a of aliveLanes) {
        nearest = Math.min(nearest, Math.abs(lane - a));
      }
      if (nearest > bestDist) {
        bestDist = nearest;
        bestLane = lane;
      }
    }
    return bestLane;
  }
}
