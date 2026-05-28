import * as THREE from "three";
import type { Enemy, EncounterDef, BossPhaseDef } from "../types";
import { TUNING } from "../data/tuning";
import { ENCOUNTERS } from "../data/encounters";

import { GameState, refreshEnemyPrompt } from "./GameState";
import { InputManager, InputEventLite } from "./InputManager";
import { TypingSystem } from "./TypingSystem";
import { CombatSystem } from "./CombatSystem";
import { EncounterManager } from "./EncounterManager";
import { UpgradeSystem } from "./UpgradeSystem";
import { BossSystem } from "./BossSystem";
import { AudioEngine } from "./AudioEngine";

import { SceneRenderer } from "../render/SceneRenderer";
import { ParallaxScene } from "../render/ParallaxScene";
import { EnemyView } from "../render/EnemyView";
import { Effects } from "../render/Effects";
import { UI } from "../render/UI";
import type { EndScreenStats } from "../render/UI";

/**
 * Game: top-level orchestrator. Owns every system, runs the main loop, and
 * routes input through Typing → Combat → feedback (UI + Effects + Audio).
 */
export class Game {
  private state = new GameState();
  private input = new InputManager();
  private typing = new TypingSystem();
  private combat = new CombatSystem(this.state);
  private upgrades = new UpgradeSystem();
  private audio = new AudioEngine();

  private renderer: SceneRenderer;
  private parallax: ParallaxScene;
  private enemyView: EnemyView;
  private effects: Effects;
  private ui: UI;

  private encounter: EncounterManager;
  private boss: BossSystem;

  private lastFrameTime = 0;
  private rafHandle = 0;
  /** Suppress input routing when modals are open. */
  private acceptingTypingInput = false;
  /** Number of encounters remaining before victory check */
  private bossEncounterStarted = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new SceneRenderer(canvas);
    this.parallax = new ParallaxScene(this.renderer);
    this.enemyView = new EnemyView(this.renderer);
    this.effects = new Effects(this.renderer);
    this.ui = new UI();

    this.encounter = new EncounterManager(this.state, {
      onEncounterStart: (i, def) => this.handleEncounterStart(i, def),
      onEncounterCleared: (i, def) => this.handleEncounterCleared(i, def),
      onAllEncountersCleared: () => this.handleAllCleared(),
      onBossEncounterStart: (def) => this.handleBossEncounterStart(def),
      onEnemySpawned: () => {
        /* nothing required — UI lazily creates card on first frame */
      },
    });

    this.boss = new BossSystem(this.state, {
      onPhaseChange: (phase) => this.handleBossPhaseChange(phase),
      onBossDefeated: () => this.handleBossDefeated(),
      onSummon: () => {
        /* spawn handled inside BossSystem.update via injected fn */
      },
    });

    this.input.attach();
    this.input.on((ev) => this.handleInput(ev));
  }

  start(): void {
    this.state.mode = "title";
    this.ui.showTitleScreen(() => {
      /* placeholder — actual start gated by input below */
    });
    this.lastFrameTime = performance.now();
    this.loop();
  }

  // ---------- Main loop ----------

  private loop = (): void => {
    const now = performance.now();
    const delta = Math.min(50, now - this.lastFrameTime);
    this.lastFrameTime = now;
    this.tick(delta);
    this.rafHandle = requestAnimationFrame(this.loop);
  };

  private tick(deltaMs: number): void {
    // Always render scene + parallax
    this.parallax.update(deltaMs);

    if (
      this.state.mode === "encounter" ||
      this.state.mode === "boss" ||
      this.state.mode === "transition"
    ) {
      this.updateEnemies(deltaMs);
      this.encounter.update(deltaMs);
      if (this.boss.active) {
        this.boss.update(deltaMs, () => {
          /* spawn cb — Encounter manager handles spawn list, BossSystem inserts directly */
        });
      }
      // Combo decay
      if (this.state.combo > 0 && this.state.lastWordAt > 0) {
        if (performance.now() - this.state.lastWordAt > TUNING.combo.decayTimeoutMs) {
          this.state.setCombo(Math.max(0, this.state.combo - TUNING.combo.decayPerTick));
          this.state.lastWordAt = performance.now();
        }
      }
      // Validate input vs alive enemies
      this.typing.validateAgainstEnemies(this.state.enemies);
      // Player HP check
      if (this.state.hp <= 0) {
        this.triggerDefeat();
      }
    }

    this.enemyView.update(this.state.enemies, deltaMs, performance.now());
    this.effects.update(deltaMs);

    // UI overlay update
    this.ui.update(
      this.state,
      this.renderer,
      this.enemyView,
      this.typing,
      this.upgrades.buildIdentity(this.state),
    );

    // Boss bar update
    if (this.boss.active && this.boss.getBoss()) {
      const b = this.boss.getBoss()!;
      this.ui.updateBoss(b.hp, b.maxHp, this.boss.getCurrentPhase());
    }

    this.renderer.render(deltaMs);
  }

  /** Update enemy approach + attack timers. */
  private updateEnemies(deltaMs: number): void {
    for (let i = this.state.enemies.length - 1; i >= 0; i--) {
      const e = this.state.enemies[i];
      if (e.dying) {
        e.dyingMs -= deltaMs;
        if (e.dyingMs <= 0) {
          this.state.enemies.splice(i, 1);
          this.enemyView.remove(e.id);
          continue;
        }
        continue;
      }
      if (!e.alive) continue;
      // Drift forward slowly (visual)
      const targetDepth = 0.42;
      const dz =
        (e.def.approachSpeed * deltaMs) / TUNING.enemyApproach.baseApproachMs;
      e.depth = Math.max(targetDepth, e.depth - dz);
      // Attack timer
      e.attackTimer += deltaMs;
      if (e.attackTimer >= e.def.attackTimerMs) {
        this.handleEnemyAttack(e);
        e.attackTimer = 0;
      }
    }
  }

  // ---------- Input routing ----------

  private handleInput(ev: InputEventLite): void {
    // Unlock audio on first keypress
    this.audio.unlock();

    // Title screen: any key starts run
    if (this.state.mode === "title") {
      if (ev.type === "any") {
        this.ui.hideTitleScreen();
        this.startRun();
      }
      return;
    }

    // End screen: Enter or Space replays
    if (this.state.mode === "victory" || this.state.mode === "defeat") {
      if (
        ev.type === "enter" ||
        (ev.type === "char" && ev.value === " ") ||
        (ev.type === "char" && (ev.value === "r"))
      ) {
        this.replay();
      }
      return;
    }

    // Upgrade modal: digits select choices
    if (this.state.mode === "upgrade") {
      if (ev.type === "digit") {
        const idx = parseInt(ev.value, 10) - 1;
        this.ui.selectUpgradeAt(idx);
      }
      return;
    }

    // Combat input
    if (
      this.state.mode === "encounter" ||
      this.state.mode === "boss" ||
      this.state.mode === "transition"
    ) {
      if (!this.acceptingTypingInput) return;
      if (ev.type === "backspace") {
        this.typing.backspace();
        return;
      }
      if (ev.type === "char") {
        this.processTypingChar(ev.value);
      }
      if (ev.type === "escape") {
        this.typing.reset();
      }
    }
  }

  private processTypingChar(c: string): void {
    const result = this.typing.processChar(c, this.state.enemies);
    if (result.type === "letter") {
      this.audio.play("tick");
      // Small spark on best-target world position
      const target = result.bestTarget;
      const worldPos = this.enemyView.getCardAnchor(target);
      this.effects.hitSpark(worldPos, target.colorHint);
      // Card hit flash (subtle pulse)
    } else if (result.type === "wordComplete") {
      this.handleWordComplete(result.enemy, result.word, result.perfect, result.durationMs);
    } else if (result.type === "mistake") {
      this.audio.play("miss");
      this.combat.applyMistake(result.expected, result.got, result.nearestEnemy);
      this.ui.flashMistake(result.nearestEnemy ? result.nearestEnemy.id : null);
      this.effects.domShake("light");
    }
  }

  private handleWordComplete(
    enemy: Enemy,
    word: string,
    perfect: boolean,
    durationMs: number,
  ): void {
    const prevCombo = this.state.combo;
    const result = this.combat.applyWordComplete(enemy, word, perfect, durationMs);
    this.audio.play(result.killed ? "kill" : "impact");
    if (result.comboDelta > 0) this.audio.play("comboUp");
    if (result.shieldGained > 0) this.audio.play("shield");

    const anchor = this.enemyView.getCardAnchor(enemy);
    if (result.killed) {
      this.effects.killBurst(anchor, enemy.colorHint);
      this.effects.domShake(enemy.def.kind === "boss" ? "heavy" : "medium");
    } else {
      this.effects.burst(anchor, enemy.colorHint, 8, {
        speed: 2.0,
        lifeMs: 380,
        scale: 0.15,
      });
      this.effects.domShake("light");
      this.ui.flashHit(enemy.id);
    }

    // Refresh card prompt visually if enemy survived and refreshOnSurvive
    if (!result.killed && enemy.def.refreshOnSurvive) {
      this.ui.refreshCardPrompt(enemy.id, enemy.promptDisplay);
    }
    // If this was the boss and it survived, refresh from boss phase pool
    if (!result.killed && enemy.def.kind === "boss") {
      this.boss.refreshBossPrompt();
      this.ui.refreshCardPrompt(enemy.id, enemy.promptDisplay);
    }

    // Chain VFX
    for (const c of result.chains) {
      const cAnchor = this.enemyView.getCardAnchor(c.enemy);
      this.effects.chainArc(anchor, cAnchor, enemy.colorHint);
      if (c.killed) {
        this.effects.killBurst(cAnchor, c.enemy.colorHint);
      } else {
        this.effects.hitSpark(cAnchor, c.enemy.colorHint);
        this.ui.flashHit(c.enemy.id);
      }
    }

    // Popup
    const screen = this.ui.worldToScreen(anchor, this.renderer);
    const popupKind = result.damage >= 50 ? "crit" : "damage";
    this.ui.spawnPopup(`-${result.damage}`, popupKind, screen.x, screen.y);
    if (result.healed > 0) {
      this.ui.spawnPopup(`+${result.healed} HP`, "heal", screen.x, screen.y - 20);
    }
    if (result.shieldGained > 0) {
      this.ui.spawnPopup(
        `+${result.shieldGained} shield`,
        "shield",
        screen.x,
        screen.y - 40,
      );
    }
    if (this.state.combo - prevCombo > 1) {
      this.ui.spawnPopup(`+${this.state.combo - prevCombo} combo`, "combo", screen.x, screen.y - 60);
    }
  }

  private handleEnemyAttack(enemy: Enemy): void {
    this.enemyView.lunge(enemy.id);
    const lost = this.combat.applyEnemyAttack(enemy);
    if (lost > 0) {
      this.audio.play("playerHit");
      this.effects.damageFlash();
      this.effects.domShake("medium");
    } else {
      // Shield absorbed
      this.audio.play("shield");
      this.effects.domShake("light");
    }
    // Popup near player area (bottom center)
    if (lost > 0) {
      const x = window.innerWidth / 2;
      const y = window.innerHeight - 120;
      this.ui.spawnPopup(`-${lost}`, "damage", x, y);
    }
  }

  // ---------- Encounter / mode flow ----------

  private startRun(): void {
    this.state.reset();
    this.upgrades.reset();
    this.enemyView.clear();
    this.effects.clear();
    this.parallax.setBossMode(false);
    this.renderer.cameraTargetZ = 0;
    this.renderer.cameraDollyOffset = 0;
    this.state.mode = "encounter";
    this.state.runStartTime = performance.now();
    this.acceptingTypingInput = true;
    this.encounter.startRun();
  }

  private handleEncounterStart(index: number, def: EncounterDef): void {
    this.state.encounterIndex = index;
    if (def.id === "boss") {
      this.state.mode = "boss";
      this.parallax.setBossMode(true);
    } else {
      this.state.mode = "encounter";
    }
    this.combat.applyEncounterStart(index);
    if (this.state.shield > 0) this.audio.play("shield");
    this.ui.showEncounterBanner(def.name, def.subtitle, def.id === "boss");
  }

  private handleEncounterCleared(index: number, def: EncounterDef): void {
    if (def.id === "boss") {
      // Boss handled separately by BossSystem (onBossDefeated)
      return;
    }
    // Show upgrade choices if this encounter rewards them
    if (def.rewardUpgrade && index < ENCOUNTERS.length - 1) {
      this.showUpgradeChoice();
    } else {
      // Transition straight to next
      this.encounter.beginTransition();
    }
  }

  private showUpgradeChoice(): void {
    this.state.mode = "upgrade";
    this.acceptingTypingInput = false;
    const choices = this.upgrades.drawChoices(this.state);
    this.audio.play("uiSelect");
    this.ui.showUpgradeModal(choices, (picked) => {
      this.upgrades.acquire(this.state, picked);
      this.audio.play("upgrade");
      this.ui.hideUpgradeModal();
      this.acceptingTypingInput = true;
      this.state.mode = "transition";
      this.encounter.beginTransition();
    });
  }

  private handleAllCleared(): void {
    // If we have a boss encounter, BossSystem handles victory.
    // If somehow we run out without a boss, treat as victory.
    if (!this.state.bossDefeated) {
      this.triggerVictory();
    }
  }

  private handleBossEncounterStart(_def: EncounterDef): void {
    this.bossEncounterStarted = true;
    // Defer binding until boss enemy actually spawns
    window.setTimeout(() => {
      this.boss.bindBoss();
      const boss = this.boss.getBoss();
      if (boss) {
        this.ui.showBossBar(boss.def.displayName, this.boss.totalPhases());
        this.ui.updateBoss(boss.hp, boss.maxHp, this.boss.getCurrentPhase());
        // Refresh the card to show the phase-correct prompt
        this.ui.refreshCardPrompt(boss.id, boss.promptDisplay);
        this.audio.play("phaseChange");
      }
    }, 1500);
  }

  private handleBossPhaseChange(phase: BossPhaseDef): void {
    this.audio.play("phaseChange");
    this.effects.domShake("medium");
    // Refresh boss card visually
    const boss = this.boss.getBoss();
    if (boss) this.ui.refreshCardPrompt(boss.id, boss.promptDisplay);
    this.ui.showEncounterBanner(`Phase ${phase.index + 1}`, phase.name, true);
  }

  private handleBossDefeated(): void {
    this.audio.play("victory");
    this.effects.domShake("heavy");
    // Trigger explosive feedback at boss position
    const boss = this.boss.getBoss();
    if (boss) {
      const anchor = this.enemyView.getCardAnchor(boss);
      this.effects.killBurst(anchor, "#ff8848");
      this.effects.killBurst(anchor, "#ffd060");
    }
    this.ui.hideBossBar();
    window.setTimeout(() => this.triggerVictory(), 1400);
  }

  // ---------- End game ----------

  private triggerVictory(): void {
    this.state.mode = "victory";
    this.state.runEndTime = performance.now();
    this.audio.play("victory");
    this.acceptingTypingInput = false;
    const stats = this.buildEndScreenStats(true);
    this.ui.showEndScreen(stats, () => this.replay());
  }

  private triggerDefeat(): void {
    this.state.mode = "defeat";
    this.state.runEndTime = performance.now();
    this.audio.play("defeat");
    this.effects.domShake("heavy");
    this.acceptingTypingInput = false;
    const stats = this.buildEndScreenStats(false);
    this.ui.showEndScreen(stats, () => this.replay());
  }

  private buildEndScreenStats(victory: boolean): EndScreenStats {
    const totalTyped = this.state.wordsTyped + this.state.mistakes;
    const accuracy =
      totalTyped > 0 ? (this.state.wordsTyped / totalTyped) * 100 : 100;
    const bossMaxHp = this.boss.getBoss()?.maxHp ?? 500;
    const rankTitle = computeRankTitle(this.state, victory, accuracy);
    const buildId = this.upgrades.buildIdentity(this.state);
    const shareLine = composeShareLine(this.state, victory, accuracy);
    return {
      victory,
      accuracy,
      wordsTyped: this.state.wordsTyped,
      mistakes: this.state.mistakes,
      highestCombo: this.state.highestCombo,
      enemiesDefeated: this.state.enemiesDefeated,
      damageTaken: Math.round(this.state.damageTaken),
      bossDefeated: this.state.bossDefeated,
      bossHpRemaining: this.state.bossHpRemaining,
      bossMaxHp,
      rankTitle,
      buildId,
      shareLine,
      runDurationMs:
        this.state.runEndTime > 0 && this.state.runStartTime > 0
          ? this.state.runEndTime - this.state.runStartTime
          : 0,
    };
  }

  private replay(): void {
    this.ui.hideEndScreen();
    this.boss.reset();
    this.state.enemies = [];
    this.enemyView.clear();
    this.effects.clear();
    this.ui.hideBossBar();
    this.bossEncounterStarted = false;
    this.startRun();
  }
}

// ---------- Rank title + share line helpers ----------

function computeRankTitle(
  state: GameState,
  victory: boolean,
  accuracy: number,
): string {
  if (!victory) {
    if (accuracy < 60) return "Panic Typist";
    if (state.highestCombo < 5) return "Nervous Apprentice";
    if (state.damageTaken > 200) return "Bone Typist";
    return "Castle Menace";
  }
  if (accuracy >= 98 && state.highestCombo >= 20) return "Perfect Scribe";
  if (state.highestCombo >= 25) return "Combo Exorcist";
  if (state.damageTaken < 30) return "Knightbreaker";
  if (accuracy >= 92) return "Cursed Keyboard";
  return "Castle Menace";
}

function composeShareLine(
  state: GameState,
  victory: boolean,
  accuracy: number,
): string {
  if (victory) {
    if (accuracy >= 95) {
      return `I beat the Cursed Knight with ${accuracy.toFixed(1)}% accuracy.`;
    }
    if (state.highestCombo >= 20) {
      return `I cleared the hallway with a ${state.highestCombo}-word combo.`;
    }
    return `I defeated the Cursed Knight. ${state.wordsTyped} words typed.`;
  }
  if (state.hp <= 0 && state.bossHpRemaining > 0) {
    return `I died typing at ${state.bossHpRemaining} boss HP remaining.`;
  }
  return `I fell after ${state.enemiesDefeated} kills.`;
}
