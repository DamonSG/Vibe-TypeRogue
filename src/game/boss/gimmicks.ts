import type { BossPhaseDef, Enemy, EnemyKind } from "../../types";
import type { GameState } from "../GameState";

/**
 * Shared context handed to every gimmick hook. The BossSystem owns the real
 * implementations; gimmicks only ever touch the boss through this surface so
 * they stay decoupled from spawning / prompt internals.
 */
export interface BossGimmickContext {
  readonly state: GameState;
  readonly boss: Enemy;
  /** The phase that is currently active. */
  getPhase(): BossPhaseDef;
  /**
   * Spawn a weak-point / rune linked to the boss. Returns the new enemy id, or
   * null if the cap was hit.
   */
  spawnWeakPoint(
    kind: EnemyKind,
    opts?: { laneX?: number; depth?: number; promptOverride?: string },
  ): string | null;
  /** Count alive enemies that were spawned as boss-linked weak points. */
  aliveWeakPoints(): number;
  /** Re-roll the boss's current typed word from the active phase pool. */
  refreshBossPrompt(): void;
}

/**
 * A modular boss behaviour. Every hook is optional, so a gimmick implements only
 * what it needs. Instances are created per fight by a factory in GIMMICKS.
 */
export interface BossGimmick {
  readonly id: string;
  /** Called once when the boss is bound (fight starts). */
  onBind?(ctx: BossGimmickContext): void;
  /** Called when a new phase becomes active. */
  onPhaseEnter?(ctx: BossGimmickContext, phase: BossPhaseDef): void;
  /** Called every frame while the boss is active. */
  onUpdate?(ctx: BossGimmickContext, deltaMs: number): void;
  /** Called after the player completes the boss's word. */
  onBossWordComplete?(
    ctx: BossGimmickContext,
    perfect: boolean,
    killed: boolean,
  ): void;
  /** Called when the player mistypes (nearest target is the boss). */
  onPlayerMistake?(ctx: BossGimmickContext): void;
  /** Called once when the boss dies. */
  onBossDefeated?(ctx: BossGimmickContext): void;
  /** Adjust damage about to land on the boss. Return the new value. */
  modifyBossDamage?(dmg: number, ctx: BossGimmickContext): number;
}

export type GimmickParams = Record<string, number | string | boolean | string[]>;
export type GimmickFactory = (params: GimmickParams) => BossGimmick;

// ---------- Param helpers ----------

function num(p: GimmickParams, key: string, fallback: number): number {
  const v = p[key];
  return typeof v === "number" ? v : fallback;
}
function str(p: GimmickParams, key: string, fallback: string): string {
  const v = p[key];
  return typeof v === "string" ? v : fallback;
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// ---------- Gimmick implementations ----------

/**
 * Enrage: as the boss drops below `startFraction` HP, its attack cadence
 * accelerates toward `minFactor` of the active phase's base timer. Works across
 * phase transitions because it re-captures the phase's base timer each phase.
 */
function makeEnrage(params: GimmickParams): BossGimmick {
  const startFraction = num(params, "startFraction", 0.5);
  const minFactor = num(params, "minFactor", 0.55);
  let phaseBaseMs = 0;
  const capture = (ctx: BossGimmickContext) => {
    phaseBaseMs = ctx.getPhase().attackTimerMs;
  };
  return {
    id: "enrage",
    onBind: capture,
    onPhaseEnter: (ctx) => capture(ctx),
    onUpdate: (ctx) => {
      if (phaseBaseMs <= 0) return;
      const frac = ctx.boss.hp / Math.max(1, ctx.boss.maxHp);
      const progress = clamp01((startFraction - frac) / Math.max(0.01, startFraction));
      const factor = 1 + (minFactor - 1) * progress;
      ctx.boss.def.attackTimerMs = Math.round(phaseBaseMs * factor);
    },
  };
}

/**
 * Scramble: any mistype on the boss instantly swaps its word for a fresh one,
 * punishing sloppy typing by forcing the player to re-read.
 */
function makeScramble(_params: GimmickParams): BossGimmick {
  return {
    id: "scramble",
    onPlayerMistake: (ctx) => {
      ctx.refreshBossPrompt();
    },
  };
}

/**
 * Timed words: the player must finish the boss's word within `limitMs`. On
 * expiry the boss heals `healPct` of its max HP (capped) and the word refreshes,
 * creating relentless time pressure.
 */
function makeTimed(params: GimmickParams): BossGimmick {
  const limitMs = num(params, "limitMs", 5000);
  const healPct = num(params, "healPct", 0.04);
  return {
    id: "timed",
    onUpdate: (ctx) => {
      const boss = ctx.boss;
      if (!boss.alive) return;
      const elapsed = performance.now() - boss.wordStartedAt;
      if (elapsed >= limitMs) {
        const heal = Math.round(boss.maxHp * healPct);
        boss.hp = Math.min(boss.maxHp, boss.hp + heal);
        ctx.refreshBossPrompt();
      }
    },
  };
}

/**
 * Shield: every `intervalMs` the boss raises armor and spawns `runeCount`
 * weak-point runes. While the armor is up, incoming boss damage is multiplied by
 * (1 - `reduction`). Clearing all the runes shatters the armor.
 */
function makeShield(params: GimmickParams): BossGimmick {
  const reduction = clamp01(num(params, "reduction", 0.85));
  const intervalMs = num(params, "intervalMs", 9000);
  const runeKind = str(params, "runeKind", "glyph") as EnemyKind;
  const runeCount = Math.max(1, Math.round(num(params, "runeCount", 2)));
  let timer = 0;
  let armorActive = false;
  const setArmor = (ctx: BossGimmickContext, active: boolean) => {
    armorActive = active;
    ctx.state.bossShielded = active;
  };
  return {
    id: "shield",
    onUpdate: (ctx, deltaMs) => {
      if (armorActive) {
        if (ctx.aliveWeakPoints() === 0) {
          setArmor(ctx, false);
          timer = 0;
        }
        return;
      }
      timer += deltaMs;
      if (timer >= intervalMs) {
        timer = 0;
        let spawned = 0;
        for (let i = 0; i < runeCount; i++) {
          if (ctx.spawnWeakPoint(runeKind, { depth: 0.9 })) spawned++;
        }
        if (spawned > 0) setArmor(ctx, true);
      }
    },
    modifyBossDamage: (dmg) => (armorActive ? dmg * (1 - reduction) : dmg),
    onBossDefeated: (ctx) => {
      setArmor(ctx, false);
    },
  };
}

/**
 * Multi-target: periodically spawns up to `maxAlive` weak-point targets that
 * crowd the boss, splitting the player's attention. Pure pressure — they behave
 * like ordinary enemies once spawned.
 */
function makeMultiTarget(params: GimmickParams): BossGimmick {
  const intervalMs = num(params, "intervalMs", 5000);
  const maxAlive = Math.max(1, Math.round(num(params, "maxAlive", 2)));
  const kind = str(params, "kind", "glyph") as EnemyKind;
  let timer = 0;
  return {
    id: "multitarget",
    onUpdate: (ctx, deltaMs) => {
      timer += deltaMs;
      if (timer < intervalMs) return;
      timer = 0;
      if (ctx.aliveWeakPoints() >= maxAlive) return;
      ctx.spawnWeakPoint(kind, { depth: 0.95 });
    },
  };
}

/**
 * Registry of gimmick factories. BossDef entries reference these by id; unknown
 * ids resolve to a no-op so a typo can never crash a fight.
 */
export const GIMMICKS: Record<string, GimmickFactory> = {
  enrage: makeEnrage,
  scramble: makeScramble,
  timed: makeTimed,
  shield: makeShield,
  multitarget: makeMultiTarget,
};

/** Build a gimmick instance from a config, or null if the id is unknown. */
export function createGimmick(
  id: string,
  params: GimmickParams = {},
): BossGimmick | null {
  const factory = GIMMICKS[id];
  if (!factory) {
    console.warn(`[Boss] unknown gimmick id "${id}"`);
    return null;
  }
  return factory(params);
}
