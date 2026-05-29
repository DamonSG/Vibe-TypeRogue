import type { BossPhaseDef, Enemy } from "../types";
import { CURSED_KNIGHT } from "../data/boss";
import { GameState, spawnEnemy, setEnemyPrompt, pickFreshPrompt } from "./GameState";

export interface BossCallbacks {
  onPhaseChange(phase: BossPhaseDef): void;
  onBossDefeated(): void;
  onSummon(enemyId: string): void;
}

/**
 * BossSystem manages the Cursed Knight: phase progression, prompt pool,
 * summons. Operates on the boss Enemy (kind === 'boss') currently in state.enemies.
 */
export class BossSystem {
  private bossEnemy: Enemy | null = null;
  private currentPhaseIndex = 0;
  private summonTimer = 0;
  /** HP/damage multiplier applied to the boss (Endless scales this up). */
  private scale = 1;
  active = false;

  constructor(
    private state: GameState,
    private cbs: BossCallbacks,
  ) {}

  reset(): void {
    this.bossEnemy = null;
    this.currentPhaseIndex = 0;
    this.summonTimer = 0;
    this.scale = 1;
    this.active = false;
  }

  /** Bind to the boss enemy spawned by the encounter. */
  bindBoss(scale = 1): void {
    const boss = this.state.enemies.find((e) => e.def.kind === "boss" && e.alive);
    if (!boss) return;
    this.bossEnemy = boss;
    this.currentPhaseIndex = 0;
    this.summonTimer = 0;
    this.scale = Math.max(1, scale);
    this.active = true;
    const phase0 = CURSED_KNIGHT.phases[0];
    // Override boss HP from def with the proper (scaled) number
    boss.hp = Math.round(CURSED_KNIGHT.hp * this.scale);
    boss.maxHp = Math.round(CURSED_KNIGHT.hp * this.scale);
    // Apply phase 0 cadence + prompts
    boss.def.attackTimerMs = phase0.attackTimerMs;
    boss.def.damage = Math.round(phase0.damage * this.scale);
    setEnemyPrompt(boss, pickFreshPrompt(phase0.promptPool));
  }

  /** Update boss state — handles phase transitions and summons. */
  update(deltaMs: number, spawnFn: (id: string) => void): void {
    if (!this.active || !this.bossEnemy) return;
    const boss = this.bossEnemy;
    if (!boss.alive) {
      this.active = false;
      this.state.bossDefeated = true;
      this.state.bossHpRemaining = 0;
      this.cbs.onBossDefeated();
      return;
    }
    this.state.bossHpRemaining = boss.hp;
    const fraction = boss.hp / boss.maxHp;

    // Check phase transition
    while (
      this.currentPhaseIndex < CURSED_KNIGHT.phases.length - 1 &&
      fraction <= CURSED_KNIGHT.phases[this.currentPhaseIndex].endsAtHpFraction
    ) {
      this.currentPhaseIndex++;
      const newPhase = CURSED_KNIGHT.phases[this.currentPhaseIndex];
      boss.def.attackTimerMs = newPhase.attackTimerMs;
      boss.def.damage = Math.round(newPhase.damage * this.scale);
      this.summonTimer = 0;
      // Set new prompt from phase pool
      setEnemyPrompt(boss, pickFreshPrompt(newPhase.promptPool));
      this.cbs.onPhaseChange(newPhase);
    }

    const phase = CURSED_KNIGHT.phases[this.currentPhaseIndex];

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
          const laneX = (Math.random() - 0.5) * 1.4;
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

  /** Called after boss survives a word completion. Refresh from phase pool. */
  refreshBossPrompt(): void {
    if (!this.bossEnemy || !this.active) return;
    const phase = CURSED_KNIGHT.phases[this.currentPhaseIndex];
    setEnemyPrompt(this.bossEnemy, pickFreshPrompt(phase.promptPool));
  }

  getCurrentPhase(): BossPhaseDef | null {
    if (!this.active) return null;
    return CURSED_KNIGHT.phases[this.currentPhaseIndex];
  }

  getBoss(): Enemy | null {
    return this.bossEnemy;
  }

  totalPhases(): number {
    return CURSED_KNIGHT.phases.length;
  }
}
