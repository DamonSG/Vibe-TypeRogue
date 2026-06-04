import { TUNING } from "../data/tuning";
import type {
  CombatContext,
  Enemy,
  HookEvent,
  HookEventType,
  WordCompleteEvent,
  KillEvent,
  MistakeEvent,
  EncounterEvent,
  HitEvent,
} from "../types";
import type { GameState } from "./GameState";
import { refreshEnemyPrompt } from "./GameState";

export interface CombatResult {
  /** Damage that landed on the primary target. */
  damage: number;
  /** Whether the primary target was killed. */
  killed: boolean;
  /** List of chain-hit enemies and their damage. */
  chains: { enemy: Enemy; damage: number; killed: boolean }[];
  /** Shield gained as a result of this event. */
  shieldGained: number;
  /** HP healed as a result. */
  healed: number;
  /** Combo points actually added (after upgrade bonuses). */
  comboDelta: number;
  /** Whether this completion was perfect. */
  perfect: boolean;
  /** Whether a chain triggered (for VFX). */
  chainTriggered: boolean;
}

/**
 * CombatSystem applies damage, chain effects, and combo/shield gains based
 * on the player's typing events. Upgrade hooks are dispatched here.
 */
export class CombatSystem {
  constructor(private state: GameState) {}

  /** Process a completed word: compute damage, apply hooks, kill if HP <= 0. */
  applyWordComplete(
    enemy: Enemy,
    word: string,
    perfect: boolean,
    durationMs: number,
  ): CombatResult {
    // Pre-increment wordsTyped/perfectWords so hooks see updated state.
    this.state.wordsTyped++;
    this.state.charsTyped += word.replace(/\s+/g, "").length;
    if (perfect) {
      this.state.perfectWords++;
      this.state.perfectWordsSinceBarrier++;
    } else {
      this.state.perfectWordsSinceBarrier = 0;
    }

    // Echo chain tracking
    const fl = word.trim().charAt(0).toLowerCase();
    if (this.state.lastWordFirstLetter && fl === this.state.lastWordFirstLetter) {
      this.state.echoChainCount++;
    } else {
      this.state.echoChainCount = 0;
    }

    // Compute base damage
    const charLen = word.replace(/\s+/g, "").length;
    let baseDamage =
      TUNING.combat.completedWordDamage +
      Math.max(0, charLen - 3) * TUNING.combat.perLetterDamageBonus;
    if (perfect) baseDamage *= TUNING.combat.perfectMultiplier;

    // Combo multiplier
    const comboMult = Math.min(
      TUNING.combat.comboMultiplierMax,
      1 +
        Math.floor(this.state.combo / TUNING.combat.comboBonusPer) *
          TUNING.combat.comboMultiplierStep,
    );
    baseDamage *= comboMult;

    // Compute hook event
    const willKill = enemy.hp <= baseDamage; // rough — re-check after multipliers
    const evt: WordCompleteEvent = {
      type: "wordComplete",
      enemy,
      word,
      perfect,
      durationMs,
      willKill,
    };
    const ctx = this.buildCtx(evt);
    this.dispatchHooks(ctx, "wordComplete");

    // Apply multipliers/flats from hooks
    let finalDamage = Math.round(
      baseDamage * ctx.damageMultiplier + ctx.flatBonusDamage,
    );
    if (finalDamage < 1) finalDamage = 1;

    // One-shot modes (40 Words): any completed word instantly fells its enemy.
    if (this.state.oneShotEnemies) {
      finalDamage = Math.max(finalDamage, enemy.hp);
    }

    // Apply damage to primary
    const killedPrimary = this.applyDamageToEnemy(enemy, finalDamage);

    // Combo gain
    const comboGain = TUNING.combo.perWord + ctx.comboBonus;
    if (comboGain !== 0) this.state.addCombo(Math.trunc(comboGain));

    // Shield + heal applied
    if (ctx.shieldGain > 0) {
      this.state.applyShield(ctx.shieldGain);
      if (
        this.state.hasUpgrade("shield_script") &&
        this.state.perfectWordsSinceBarrier >= 3
      ) {
        this.state.perfectWordsSinceBarrier = 0;
      }
    }
    if (ctx.heal > 0) this.state.applyHeal(ctx.heal);

    // Chain damage
    const chains: { enemy: Enemy; damage: number; killed: boolean }[] = [];
    if (ctx.chainEnemies > 0 && ctx.chainDamage > 0) {
      const others = this.state.enemies
        .filter((e) => e.alive && !e.dying && e !== enemy)
        .sort(
          (a, b) =>
            Math.abs(a.laneX - enemy.laneX) - Math.abs(b.laneX - enemy.laneX),
        );
      for (let i = 0; i < ctx.chainEnemies && i < others.length; i++) {
        const target = others[i];
        const killed = this.applyDamageToEnemy(target, ctx.chainDamage);
        chains.push({ enemy: target, damage: ctx.chainDamage, killed });
      }
    }

    // If primary killed → fire kill event (may add more chains/heal)
    if (killedPrimary) {
      this.fireKill(enemy, perfect);
    } else {
      // Survives — handle refresh-on-survive (tanky enemies get new prompts)
      if (enemy.def.refreshOnSurvive) {
        refreshEnemyPrompt(this.state, enemy);
      }
    }

    // Score
    this.state.score += Math.round(finalDamage * (1 + this.state.combo * 0.04));
    this.state.lastWordAt = performance.now();
    this.state.lastWordFirstLetter = fl;

    return {
      damage: finalDamage,
      killed: killedPrimary,
      chains,
      shieldGained: ctx.shieldGain,
      healed: ctx.heal,
      comboDelta: Math.trunc(comboGain),
      perfect,
      chainTriggered: chains.length > 0,
    };
  }

  /** Process a mistake event. Returns the new combo value. */
  applyMistake(expected: string, got: string, nearest: Enemy | null): number {
    this.state.mistakes++;
    const evt: MistakeEvent = {
      type: "mistake",
      enemy: nearest,
      expected,
      got,
    };
    const ctx = this.buildCtx(evt);
    this.dispatchHooks(ctx, "mistake");

    // Default: combo breaks. Steady Hands halves it instead.
    if (this.state.hasUpgrade("steady_hands")) {
      this.state.setCombo(Math.floor(this.state.combo / 2));
    } else {
      this.state.setCombo(0);
    }
    this.state.echoChainCount = 0;
    return this.state.combo;
  }

  /** Called when an enemy attack lands on the player. */
  applyEnemyAttack(enemy: Enemy): number {
    const dmg = enemy.def.damage;
    const lost = this.state.applyDamage(dmg);
    return lost;
  }

  /** Fire encounterStart hooks (e.g., Safe Start). */
  applyEncounterStart(encounterIndex: number): CombatContext {
    const evt: EncounterEvent = {
      type: "encounterStart",
      encounterIndex,
    };
    const ctx = this.buildCtx(evt);
    this.dispatchHooks(ctx, "encounterStart");
    if (ctx.shieldGain > 0) this.state.applyShield(ctx.shieldGain);
    return ctx;
  }

  // ---------- Internals ----------

  private fireKill(enemy: Enemy, perfect: boolean): void {
    this.state.enemiesDefeated++;
    const evt: KillEvent = { type: "kill", enemy, perfect };
    const ctx = this.buildCtx(evt);
    this.dispatchHooks(ctx, "kill");

    if (ctx.heal > 0) this.state.applyHeal(ctx.heal);
    if (ctx.shieldGain > 0) this.state.applyShield(ctx.shieldGain);
    if (ctx.comboBonus > 0) this.state.addCombo(Math.trunc(ctx.comboBonus));

    if (ctx.chainEnemies > 0 && ctx.chainDamage > 0) {
      const others = this.state.enemies
        .filter((e) => e.alive && !e.dying && e !== enemy)
        .sort(
          (a, b) =>
            Math.abs(a.laneX - enemy.laneX) - Math.abs(b.laneX - enemy.laneX),
        );
      for (let i = 0; i < ctx.chainEnemies && i < others.length; i++) {
        const target = others[i];
        this.applyDamageToEnemy(target, ctx.chainDamage);
      }
    }
  }

  /** Apply damage to an enemy. Returns true if killed. */
  private applyDamageToEnemy(enemy: Enemy, dmg: number): boolean {
    if (!enemy.alive || enemy.dying) return false;
    enemy.hp = Math.max(0, enemy.hp - dmg);
    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.dying = true;
      enemy.dyingMs = TUNING.feedback.cardDyingMs;

      // Fire hit event so upgrades that need it can react
      const hitEvt: HitEvent = {
        type: "hit",
        enemy,
        damage: dmg,
        willKill: true,
      };
      this.dispatchHooks(this.buildCtx(hitEvt), "hit");
      return true;
    }
    const hitEvt: HitEvent = {
      type: "hit",
      enemy,
      damage: dmg,
      willKill: false,
    };
    this.dispatchHooks(this.buildCtx(hitEvt), "hit");
    return false;
  }

  private buildCtx(event: HookEvent): CombatContext {
    return {
      event,
      damageMultiplier: 1,
      flatBonusDamage: 0,
      shieldGain: 0,
      heal: 0,
      comboBonus: 0,
      chainEnemies: 0,
      chainDamage: 0,
      state: this.state,
    };
  }

  private dispatchHooks(ctx: CombatContext, type: HookEventType): void {
    for (const upgrade of this.state.ownedUpgrades) {
      const hook = upgrade.hooks[type];
      if (hook) {
        try {
          hook(ctx);
        } catch (err) {
          console.warn(`[Combat] upgrade ${upgrade.id} hook error`, err);
        }
      }
    }
  }
}
