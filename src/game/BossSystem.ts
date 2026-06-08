import type { BossDef, BossPhaseDef, Enemy, EnemyKind } from "../types";
import { BOSS_REGISTRY } from "../data/bosses";
import { GameState, spawnEnemy, setEnemyPrompt } from "./GameState";
import { normalizePrompt, pickPrompt } from "../data/words";
import {
  createGimmick,
  type BossGimmick,
  type BossGimmickContext,
} from "./boss/gimmicks";

export interface BossCallbacks {
  onPhaseChange(phase: BossPhaseDef): void;
  onBossDefeated(): void;
  onSummon(enemyId: string): void;
}

/**
 * BossSystem manages whichever boss is currently active: selection from the
 * registry, phase progression, the prompt pool, summons, and a modular gimmick
 * layer. Operates on the boss Enemy (kind === 'boss') currently in state.enemies.
 */
export class BossSystem {
  private def: BossDef = BOSS_REGISTRY[0];
  private bossEnemy: Enemy | null = null;
  private currentPhaseIndex = 0;
  private summonTimer = 0;
  /** HP/damage multiplier applied to the boss (Endless scales this up). */
  private scale = 1;
  active = false;

  /** Boss-wide gimmick instances (whole fight). */
  private bossGimmicks: BossGimmick[] = [];
  /** Gimmick instances scoped to the current phase. */
  private phaseGimmicks: BossGimmick[] = [];
  /** Ids of bosses already used this run (for no-repeat random selection). */
  private usedBossIds = new Set<string>();
  /** True once a boss def has been chosen for the upcoming fight. */
  private prepared = false;
  /** Recently used boss words (display form) to avoid back-to-back repeats. */
  private recentWords: string[] = [];
  /** How many recent boss words to remember when avoiding repeats. */
  private static readonly RECENT_WORD_MEMORY = 3;
  /**
   * Candidate horizontal lanes for summons/weak points. Deliberately excludes
   * the center (0.0) where the boss sits, so minions flank it instead of
   * stacking on top of it.
   */
  private static readonly SUMMON_LANES = [-0.75, -0.4, 0.4, 0.75];
  /** Lazily-built context shared with gimmicks. */
  private gimmickCtx: BossGimmickContext | null = null;

  constructor(
    private state: GameState,
    private cbs: BossCallbacks,
  ) {}

  /** Full reset for a brand new run — also forgets which bosses were used. */
  reset(): void {
    this.clearForNextBoss();
    this.usedBossIds.clear();
  }

  /** Per-fight teardown that preserves run-level no-repeat tracking. */
  clearForNextBoss(): void {
    this.bossEnemy = null;
    this.currentPhaseIndex = 0;
    this.summonTimer = 0;
    this.scale = 1;
    this.active = false;
    this.prepared = false;
    this.recentWords = [];
    this.bossGimmicks = [];
    this.phaseGimmicks = [];
    this.gimmickCtx = null;
    this.state.bossDamageModifier = undefined;
    this.state.bossShielded = false;
  }

  /**
   * Choose the boss def for the upcoming fight. Called before the boss enemy
   * spawns so its sprite/scale/color can be applied at spawn time (no morph).
   */
  prepareBoss(): BossDef {
    this.def = this.selectBoss();
    this.prepared = true;
    return this.def;
  }

  /**
   * Pick the next boss def at random, avoiding ids already used this run. When
   * every boss has been seen, the pool resets so long runs keep cycling.
   */
  selectBoss(): BossDef {
    let pool = BOSS_REGISTRY.filter((b) => !this.usedBossIds.has(b.id));
    if (pool.length === 0) {
      this.usedBossIds.clear();
      pool = [...BOSS_REGISTRY];
    }
    const def = pool[Math.floor(Math.random() * pool.length)];
    this.usedBossIds.add(def.id);
    return def;
  }

  /** Which boss is currently bound. */
  getDef(): BossDef {
    return this.def;
  }

  /** Bind to the boss enemy spawned by the encounter. */
  bindBoss(scale = 1): void {
    const boss = this.state.enemies.find((e) => e.def.kind === "boss" && e.alive);
    if (!boss) return;
    // Selection normally happens in prepareBoss() before the boss spawns; fall
    // back to selecting here if something skipped the prepare step.
    if (!this.prepared) this.def = this.selectBoss();
    this.bossEnemy = boss;
    this.currentPhaseIndex = 0;
    this.summonTimer = 0;
    this.scale = Math.max(1, scale);
    this.active = true;

    // Detach this boss enemy's def from the shared ENEMY_DEFS.boss singleton so
    // per-fight overrides never leak across bosses, then apply the selected
    // boss's identity + visuals.
    boss.def = { ...boss.def };
    boss.def.displayName = this.def.displayName;
    boss.def.spriteKey = this.def.spriteKey;
    boss.def.scale = this.def.scale;
    if (this.def.colorHint) {
      boss.def.colorHint = this.def.colorHint;
      boss.colorHint = this.def.colorHint;
    }

    const phase0 = this.def.phases[0];
    // Override boss HP from def with the proper (scaled) number
    boss.hp = Math.round(this.def.hp * this.scale);
    boss.maxHp = Math.round(this.def.hp * this.scale);
    // Apply phase 0 cadence + prompts
    boss.def.attackTimerMs = phase0.attackTimerMs;
    boss.def.damage = Math.round(phase0.damage * this.scale);
    setEnemyPrompt(boss, this.pickBossPrompt(phase0.promptPool));

    // Build gimmicks + wire the damage modifier.
    this.gimmickCtx = this.buildContext(boss);
    this.bossGimmicks = this.instantiate(this.def.gimmicks);
    this.phaseGimmicks = this.instantiate(phase0.gimmicks);
    for (const g of this.allGimmicks()) g.onBind?.(this.gimmickCtx);
    this.state.bossDamageModifier = (dmg) => this.applyDamageModifiers(dmg);
  }

  /** Update boss state — handles phase transitions, summons, and gimmicks. */
  update(deltaMs: number, spawnFn: (id: string) => void): void {
    if (!this.active || !this.bossEnemy) return;
    const boss = this.bossEnemy;
    if (!boss.alive) {
      this.active = false;
      this.state.bossDefeated = true;
      this.state.bossHpRemaining = 0;
      const ctx = this.gimmickCtx;
      if (ctx) for (const g of this.allGimmicks()) g.onBossDefeated?.(ctx);
      this.state.bossDamageModifier = undefined;
      this.state.bossShielded = false;
      this.cbs.onBossDefeated();
      return;
    }
    this.state.bossHpRemaining = boss.hp;
    const fraction = boss.hp / boss.maxHp;

    // Check phase transition
    while (
      this.currentPhaseIndex < this.def.phases.length - 1 &&
      fraction <= this.def.phases[this.currentPhaseIndex].endsAtHpFraction
    ) {
      this.currentPhaseIndex++;
      const newPhase = this.def.phases[this.currentPhaseIndex];
      boss.def.attackTimerMs = newPhase.attackTimerMs;
      boss.def.damage = Math.round(newPhase.damage * this.scale);
      this.summonTimer = 0;
      // Set new prompt from phase pool
      setEnemyPrompt(boss, this.pickBossPrompt(newPhase.promptPool));
      // Swap in this phase's gimmicks and notify everyone of the transition.
      this.phaseGimmicks = this.instantiate(newPhase.gimmicks);
      if (this.gimmickCtx) {
        for (const g of this.phaseGimmicks) g.onBind?.(this.gimmickCtx);
        for (const g of this.allGimmicks())
          g.onPhaseEnter?.(this.gimmickCtx, newPhase);
      }
      this.cbs.onPhaseChange(newPhase);
    }

    const phase = this.def.phases[this.currentPhaseIndex];

    // Gimmick per-frame updates (may alter cadence, spawn weak points, etc.)
    if (this.gimmickCtx) {
      for (const g of this.allGimmicks()) g.onUpdate?.(this.gimmickCtx, deltaMs);
    }

    // Summons
    if (phase.summon) {
      this.summonTimer += deltaMs;
      if (this.summonTimer >= phase.summon.intervalMs) {
        this.summonTimer = 0;
        const aliveMinions = this.state.enemies.filter(
          (e) => e.alive && !e.dying && e.def.kind !== "boss",
        ).length;
        if (aliveMinions < phase.summon.maxAlive) {
          const kinds = phase.summon.kinds;
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          const laneX = this.pickSummonLane();
          const minion = spawnEnemy(this.state, kind, {
            laneX,
            depth: 0.95,
          });
          this.state.enemies.push(minion);
          spawnFn(minion.id);
          this.cbs.onSummon(minion.id);
        }
      }
    }
  }

  /**
   * Choose the flank lane farthest from every currently-alive non-boss enemy so
   * summoned minions and weak points spread out instead of stacking on the same
   * column. Falls back to a random lane when no minions are alive.
   */
  private pickSummonLane(): number {
    const taken = this.state.enemies
      .filter((e) => e.alive && !e.dying && e.def.kind !== "boss")
      .map((e) => e.laneX);
    if (taken.length === 0) {
      return BossSystem.SUMMON_LANES[
        Math.floor(Math.random() * BossSystem.SUMMON_LANES.length)
      ];
    }
    let bestLane = BossSystem.SUMMON_LANES[0];
    let bestDist = -Infinity;
    for (const lane of BossSystem.SUMMON_LANES) {
      const nearest = Math.min(...taken.map((t) => Math.abs(lane - t)));
      if (nearest > bestDist) {
        bestDist = nearest;
        bestLane = lane;
      }
    }
    return bestLane;
  }

  /** Called after boss survives a word completion. Refresh from phase pool. */
  refreshBossPrompt(): void {
    if (!this.bossEnemy || !this.active) return;
    const phase = this.def.phases[this.currentPhaseIndex];
    setEnemyPrompt(this.bossEnemy, this.pickBossPrompt(phase.promptPool));
  }

  /** Notify gimmicks that the player completed the boss's word. */
  notifyBossWordComplete(perfect: boolean, killed: boolean): void {
    if (!this.active || !this.gimmickCtx) return;
    for (const g of this.allGimmicks())
      g.onBossWordComplete?.(this.gimmickCtx, perfect, killed);
  }

  /** Notify gimmicks that the player mistyped against the boss. */
  notifyMistake(): void {
    if (!this.active || !this.gimmickCtx) return;
    for (const g of this.allGimmicks()) g.onPlayerMistake?.(this.gimmickCtx);
  }

  getCurrentPhase(): BossPhaseDef | null {
    if (!this.active) return null;
    return this.def.phases[this.currentPhaseIndex];
  }

  getBoss(): Enemy | null {
    return this.bossEnemy;
  }

  totalPhases(): number {
    return this.def.phases.length;
  }

  // ---------- Internals ----------

  private allGimmicks(): BossGimmick[] {
    return [...this.bossGimmicks, ...this.phaseGimmicks];
  }

  /**
   * Pick the boss's next word, avoiding its current word, the last few boss
   * words, and any word currently shown by an alive enemy (minions / wards).
   * Records the choice in the recent-word history so repeats stay rare even
   * with the small per-phase pools.
   */
  private pickBossPrompt(pool: readonly string[]): string {
    const avoid = new Set<string>();
    if (this.bossEnemy) avoid.add(normalizePrompt(this.bossEnemy.promptDisplay));
    for (const w of this.recentWords) avoid.add(normalizePrompt(w));
    for (const e of this.state.enemies) {
      if (e.alive && e !== this.bossEnemy) {
        avoid.add(normalizePrompt(e.promptDisplay));
      }
    }
    const fresh = pool.filter((p) => !avoid.has(normalizePrompt(p)));
    const pick = fresh.length > 0 ? pickPrompt(fresh) : pickPrompt(pool);
    this.recentWords.push(pick);
    if (this.recentWords.length > BossSystem.RECENT_WORD_MEMORY) {
      this.recentWords.shift();
    }
    return pick;
  }

  private instantiate(
    configs: BossDef["gimmicks"] | BossPhaseDef["gimmicks"],
  ): BossGimmick[] {
    if (!configs) return [];
    const out: BossGimmick[] = [];
    for (const c of configs) {
      const g = createGimmick(c.id, c.params ?? {});
      if (g) out.push(g);
    }
    return out;
  }

  private applyDamageModifiers(dmg: number): number {
    const ctx = this.gimmickCtx;
    if (!ctx) return dmg;
    let d = dmg;
    for (const g of this.allGimmicks()) {
      if (g.modifyBossDamage) d = g.modifyBossDamage(d, ctx);
    }
    return d;
  }

  private buildContext(boss: Enemy): BossGimmickContext {
    return {
      state: this.state,
      boss,
      getPhase: () => this.def.phases[this.currentPhaseIndex],
      spawnWeakPoint: (kind: EnemyKind, opts) => {
        const minion = spawnEnemy(this.state, kind, {
          laneX: opts?.laneX ?? this.pickSummonLane(),
          depth: opts?.depth ?? 0.95,
          promptOverride: opts?.promptOverride,
        });
        minion.bossLinked = true;
        this.state.enemies.push(minion);
        this.cbs.onSummon(minion.id);
        return minion.id;
      },
      aliveWeakPoints: () =>
        this.state.enemies.filter(
          (e) => e.bossLinked && e.alive && !e.dying,
        ).length,
      refreshBossPrompt: () => this.refreshBossPrompt(),
    };
  }
}
