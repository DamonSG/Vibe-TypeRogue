import type {
  Enemy,
  EnemyDef,
  EnemyKind,
  GameStateSnapshot,
  UpgradeDef,
  GameMode,
} from "../types";
import type { RunModeId } from "../data/modes";
import { TUNING } from "../data/tuning";
import { ENEMY_DEFS } from "../data/enemies";
import {
  normalizePrompt,
  pickPromptDistinctFirstLetter,
  pickPrompt,
} from "../data/words";

export class GameState implements GameStateSnapshot {
  // --- Player & run stats
  hp: number = TUNING.player.maxHp;
  maxHp: number = TUNING.player.maxHp;
  shield: number = 0;
  combo: number = 0;
  score: number = 0;
  wordsTyped: number = 0;
  mistakes: number = 0;
  perfectWords: number = 0;
  damageTaken: number = 0;
  enemiesDefeated: number = 0;
  highestCombo: number = 0;
  encounterIndex: number = 0;

  // For Echo Type
  lastWordFirstLetter: string | null = null;
  echoChainCount: number = 0;
  // For Shield Script (resets on grant)
  perfectWordsSinceBarrier: number = 0;

  // --- Mode / flow
  mode: GameMode = "title";
  /** Which game mode this run is using (drives stage source / win condition). */
  runMode: RunModeId = "cursedCastleRun";
  runStartTime: number = 0;
  runEndTime: number = 0;
  bossDefeated: boolean = false;
  bossHpRemaining: number = 0;
  /** Running count of bosses felled this run (Endless can defeat many). */
  bossesDefeated: number = 0;

  // --- Speed / WPM tracking
  /** Total non-space characters in completed words — basis for WPM. */
  charsTyped: number = 0;
  /** Whether every completed word should instantly kill its enemy (40 Words). */
  oneShotEnemies: boolean = false;

  // --- Time-attack (40 Words) tracking
  /** performance.now() when the first word appeared (timer start). */
  timeAttackStartMs: number = 0;
  /** performance.now() when the final word was cleared (timer stop). */
  timeAttackEndMs: number = 0;
  /** Words cleared in the current time-attack run. */
  wordsCleared: number = 0;

  // --- Acquired upgrades
  ownedUpgrades: UpgradeDef[] = [];

  // --- Active enemies for this encounter
  enemies: Enemy[] = [];

  // --- Time tracking
  /** Last word completion timestamp — used for combo decay */
  lastWordAt: number = 0;

  /** Reset everything for a fresh run. */
  reset(): void {
    this.hp = TUNING.player.maxHp;
    this.maxHp = TUNING.player.maxHp;
    this.shield = TUNING.player.startingShield;
    this.combo = 0;
    this.score = 0;
    this.wordsTyped = 0;
    this.mistakes = 0;
    this.perfectWords = 0;
    this.damageTaken = 0;
    this.enemiesDefeated = 0;
    this.highestCombo = 0;
    this.encounterIndex = 0;
    this.lastWordFirstLetter = null;
    this.echoChainCount = 0;
    this.perfectWordsSinceBarrier = 0;
    this.mode = "title";
    this.runStartTime = 0;
    this.runEndTime = 0;
    this.bossDefeated = false;
    this.bossHpRemaining = 0;
    this.bossesDefeated = 0;
    this.charsTyped = 0;
    this.oneShotEnemies = false;
    this.timeAttackStartMs = 0;
    this.timeAttackEndMs = 0;
    this.wordsCleared = 0;
    this.ownedUpgrades = [];
    this.enemies = [];
    this.lastWordAt = 0;
  }

  /** Elapsed run time in ms (time-attack uses its own start/stop clock). */
  getElapsedMs(now: number): number {
    if (this.runMode === "fortyWords") {
      if (this.timeAttackStartMs === 0) return 0;
      const end = this.timeAttackEndMs > 0 ? this.timeAttackEndMs : now;
      return Math.max(0, end - this.timeAttackStartMs);
    }
    if (this.runStartTime === 0) return 0;
    const end = this.runEndTime > 0 ? this.runEndTime : now;
    return Math.max(0, end - this.runStartTime);
  }

  /** Live words-per-minute: (chars / 5) per elapsed minute. */
  getWpm(now: number): number {
    const ms = this.getElapsedMs(now);
    if (ms <= 0) return 0;
    const minutes = ms / 60000;
    if (minutes <= 0) return 0;
    return Math.round(this.charsTyped / 5 / minutes);
  }

  /** Used by CombatSystem: check if an upgrade is owned. */
  hasUpgrade(id: string): boolean {
    return this.ownedUpgrades.some((u) => u.id === id);
  }

  /** Bump combo, tracking high. */
  addCombo(amount: number): void {
    this.combo = Math.max(0, this.combo + amount);
    if (this.combo > this.highestCombo) this.highestCombo = this.combo;
  }

  /** Set combo to a specific value (used by mistake handling). */
  setCombo(value: number): void {
    this.combo = Math.max(0, value);
  }

  /** Apply HP damage, accounting for shield. Returns actual HP loss. */
  applyDamage(amount: number): number {
    let remaining = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) {
      this.hp = Math.max(0, this.hp - remaining);
      this.damageTaken += remaining;
    }
    return remaining;
  }

  /** Heal HP (clamped to maxHp). */
  applyHeal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Add shield (uncapped). */
  applyShield(amount: number): void {
    this.shield = Math.max(0, this.shield + amount);
  }
}

let enemyIdCounter = 0;

/**
 * Spawn an enemy of the given kind. Caller supplies world position via laneX/depth.
 * Chooses a prompt that doesn't collide with first letters of currently alive enemies.
 */
export function spawnEnemy(
  state: GameState,
  kind: EnemyKind,
  options: {
    laneX: number;
    depth: number;
    promptOverride?: string;
    defOverride?: Partial<EnemyDef>;
  },
): Enemy {
  const baseDef = ENEMY_DEFS[kind];
  const def: EnemyDef = options.defOverride
    ? { ...baseDef, ...options.defOverride }
    : baseDef;
  const aliveDisplays = state.enemies
    .filter((e) => e.alive)
    .map((e) => e.promptDisplay);
  const promptDisplay =
    options.promptOverride ??
    pickPromptDistinctFirstLetter(def.promptPool, aliveDisplays);
  const id = `e${++enemyIdCounter}`;
  const now = performance.now();
  // Boss always anchors top so its big card stays prominently above its head;
  // other enemies alternate top/bottom so adjacent cards rarely overlap.
  const cardAnchorSide: "top" | "bottom" =
    kind === "boss"
      ? "top"
      : enemyIdCounter % 2 === 0
        ? "top"
        : "bottom";
  return {
    id,
    def,
    hp: def.hp,
    maxHp: def.hp,
    promptDisplay,
    promptMatch: normalizePrompt(promptDisplay),
    typedCount: 0,
    laneX: options.laneX,
    depth: options.depth,
    attackTimer: 0,
    alive: true,
    dying: false,
    dyingMs: 0,
    spawnedAt: now,
    mistakeOnCurrent: false,
    wordStartedAt: now,
    cardStyle: def.cardStyle ?? "default",
    colorHint: def.colorHint ?? "#cccccc",
    cardAnchorSide,
  };
}

/** Replace an enemy's current prompt with a new one from its pool. */
export function refreshEnemyPrompt(state: GameState, enemy: Enemy): void {
  const aliveOthers = state.enemies
    .filter((e) => e.alive && e !== enemy)
    .map((e) => e.promptDisplay);
  const newPrompt = pickPromptDistinctFirstLetter(
    enemy.def.promptPool,
    aliveOthers,
  );
  enemy.promptDisplay = newPrompt;
  enemy.promptMatch = normalizePrompt(newPrompt);
  enemy.typedCount = 0;
  enemy.mistakeOnCurrent = false;
  enemy.wordStartedAt = performance.now();
}

/** Force a specific new prompt (used for boss phase transitions). */
export function setEnemyPrompt(enemy: Enemy, prompt: string): void {
  enemy.promptDisplay = prompt;
  enemy.promptMatch = normalizePrompt(prompt);
  enemy.typedCount = 0;
  enemy.mistakeOnCurrent = false;
  enemy.wordStartedAt = performance.now();
}

/** Pick a prompt freshly from any pool. */
export function pickFreshPrompt(pool: readonly string[]): string {
  return pickPrompt(pool);
}
