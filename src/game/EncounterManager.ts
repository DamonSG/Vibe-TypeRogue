import type { EncounterDef, EnemyKind, EnemyDef } from "../types";
import { CASTLE_ENCOUNTERS } from "../data/encounters";
import { TUNING } from "../data/tuning";
import { ENEMY_DEFS } from "../data/enemies";
import { GAME_MODES, type RunModeId } from "../data/modes";
import {
  generateEndlessLevel,
  endlessEnemyScale,
} from "./EndlessGenerator";
import { GameState, spawnEnemy } from "./GameState";

export type EncounterPhase =
  | "idle"
  | "intro"
  | "active"
  | "cleared"
  | "transition";

export interface EncounterCallbacks {
  onEncounterStart(index: number, def: EncounterDef): void;
  onEncounterCleared(index: number, def: EncounterDef): void;
  onAllEncountersCleared(): void;
  onBossEncounterStart(def: EncounterDef): void;
  onEnemySpawned(enemyId: string): void;
}

interface PendingSpawn {
  kind: EnemyKind;
  promptOverride?: string;
  laneX: number;
  startDepth: number;
  /** Absolute scheduled time (performance.now ms) */
  fireAt: number;
}

export class EncounterManager {
  phase: EncounterPhase = "idle";
  currentIndex = -1;
  currentDef: EncounterDef | null = null;
  private mode: RunModeId = "cursedCastleRun";
  private currentWaveIndex = 0;
  private pendingSpawns: PendingSpawn[] = [];
  private waveTimer = 0;
  private postClearTimer = 0;
  private transitionTimer = 0;

  constructor(
    private state: GameState,
    private cbs: EncounterCallbacks,
  ) {}

  /** Select which mode's stage source this manager draws from. */
  configure(mode: RunModeId): void {
    this.mode = mode;
    this.reset();
  }

  reset(): void {
    this.phase = "idle";
    this.currentIndex = -1;
    this.currentDef = null;
    this.currentWaveIndex = 0;
    this.pendingSpawns = [];
    this.waveTimer = 0;
    this.postClearTimer = 0;
    this.transitionTimer = 0;
  }

  /** Resolve the encounter definition for a 0-based index in the current mode. */
  private defForIndex(index: number): EncounterDef | null {
    if (index < 0) return null;
    if (this.mode === "endlessCrypt") {
      const level = index + 1;
      if (level > GAME_MODES.endlessCrypt.maxStages) return null;
      return generateEndlessLevel(level);
    }
    return CASTLE_ENCOUNTERS[index] ?? null;
  }

  /** Start the run — kick off encounter 0. */
  startRun(): void {
    this.reset();
    this.startEncounter(0);
  }

  /** Begin encounter at given index. */
  startEncounter(index: number): void {
    const def = this.defForIndex(index);
    if (!def) {
      this.cbs.onAllEncountersCleared();
      return;
    }
    this.currentIndex = index;
    this.currentDef = def;
    this.currentWaveIndex = 0;
    this.pendingSpawns = [];
    this.waveTimer = 0;
    this.phase = "intro";
    this.state.encounterIndex = index;
    if (this.currentDef.id === "boss") {
      this.cbs.onBossEncounterStart(this.currentDef);
    }
    this.cbs.onEncounterStart(index, this.currentDef);
    // Queue first wave
    this.queueWave(0);
  }

  /** Called every frame with delta time in ms. */
  update(deltaMs: number): void {
    if (this.phase === "idle" || !this.currentDef) return;

    // Fire scheduled spawns whose fireAt has passed
    const now = performance.now();
    if (this.pendingSpawns.length > 0) {
      const ready: PendingSpawn[] = [];
      const remain: PendingSpawn[] = [];
      for (const s of this.pendingSpawns) {
        if (s.fireAt <= now) ready.push(s);
        else remain.push(s);
      }
      this.pendingSpawns = remain;
      for (const s of ready) {
        const e = spawnEnemy(this.state, s.kind, {
          laneX: s.laneX,
          depth: s.startDepth,
          promptOverride: s.promptOverride,
          defOverride: this.scaledDefOverride(s.kind),
        });
        this.state.enemies.push(e);
        this.cbs.onEnemySpawned(e.id);
      }
    }

    if (this.phase === "intro") {
      this.waveTimer += deltaMs;
      // After the wave's delay, switch to active
      const wave = this.currentDef.waves[this.currentWaveIndex];
      if (wave && this.waveTimer >= wave.delayMs && this.pendingSpawns.length === 0) {
        // Wave finished spawning queue and delay reached
        this.phase = "active";
      }
      return;
    }

    if (this.phase === "active") {
      // Check if current wave is done (no more pending spawns + no enemies alive from it)
      const anyAlive = this.state.enemies.some((e) => e.alive);
      if (!anyAlive && this.pendingSpawns.length === 0) {
        // Move to next wave or clear encounter
        const next = this.currentWaveIndex + 1;
        if (next < this.currentDef.waves.length) {
          this.currentWaveIndex = next;
          this.waveTimer = 0;
          this.phase = "intro";
          this.queueWave(next);
        } else {
          this.phase = "cleared";
          this.postClearTimer = 0;
          this.cbs.onEncounterCleared(this.currentIndex, this.currentDef);
        }
      }
      return;
    }

    if (this.phase === "cleared") {
      this.postClearTimer += deltaMs;
      return;
    }

    if (this.phase === "transition") {
      this.transitionTimer += deltaMs;
      if (this.transitionTimer >= TUNING.encounter.transitionMs) {
        // Advance to next encounter
        this.startEncounter(this.currentIndex + 1);
      }
      return;
    }
  }

  /** Called by the Game after the upgrade modal completes (or skipped). */
  beginTransition(): void {
    this.phase = "transition";
    this.transitionTimer = 0;
  }

  /** Queue up the spawns of wave i with their stagger delays. */
  private queueWave(i: number): void {
    if (!this.currentDef) return;
    const wave = this.currentDef.waves[i];
    if (!wave) return;
    const baseAt = performance.now() + wave.delayMs;
    for (const s of wave.spawns) {
      this.pendingSpawns.push({
        kind: s.kind,
        promptOverride: s.promptOverride,
        laneX: s.laneX ?? 0,
        startDepth: s.startDepth ?? 0.9,
        fireAt: baseAt + (s.delayMs ?? 0),
      });
    }
  }

  /** Endless: scale non-boss enemy stats by current depth. Boss unscaled here. */
  private scaledDefOverride(kind: EnemyKind): Partial<EnemyDef> | undefined {
    if (this.mode !== "endlessCrypt" || kind === "boss") return undefined;
    const base = ENEMY_DEFS[kind];
    const sc = endlessEnemyScale(this.currentIndex + 1);
    return {
      hp: Math.round(base.hp * sc.hp),
      damage: Math.round(base.damage * sc.damage),
      approachSpeed: base.approachSpeed * sc.speed,
    };
  }

  /** Advance to the next level after a boss checkpoint (Endless). */
  advanceAfterBoss(): void {
    this.beginTransition();
  }

  /** Number of encounters configured for the current mode. */
  totalEncounters(): number {
    if (this.mode === "endlessCrypt") return GAME_MODES.endlessCrypt.maxStages;
    return CASTLE_ENCOUNTERS.length;
  }

  /**
   * Shift absolute spawn timestamps forward by `ms` so a pause doesn't cause
   * queued spawns to fire instantly on resume. Delta-accumulated timers
   * (waveTimer/postClearTimer/transitionTimer) are unaffected.
   */
  shiftTimers(ms: number): void {
    for (const s of this.pendingSpawns) {
      s.fireAt += ms;
    }
  }
}
