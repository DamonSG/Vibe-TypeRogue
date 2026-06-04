import * as THREE from "three";
import type { Enemy, EncounterDef, BossPhaseDef } from "../types";
import { TUNING } from "../data/tuning";
import { GAME_MODES, DEFAULT_MODE, type RunModeId } from "../data/modes";
import { generateFortyWords } from "../data/fortyWords";
import { endlessBossScale } from "./EndlessGenerator";

import { GameState, refreshEnemyPrompt } from "./GameState";
import { InputManager, InputEventLite } from "./InputManager";
import { TypingSystem } from "./TypingSystem";
import { CombatSystem } from "./CombatSystem";
import { EncounterManager } from "./EncounterManager";
import { TimeAttackManager } from "./TimeAttackManager";
import { UpgradeSystem } from "./UpgradeSystem";
import { BossSystem } from "./BossSystem";
import { AudioEngine } from "./AudioEngine";
import { StatsStore } from "./StatsStore";

import { SceneRenderer } from "../render/SceneRenderer";
import { ParallaxScene } from "../render/ParallaxScene";
import { EnemyView } from "../render/EnemyView";
import { Effects } from "../render/Effects";
import { UI } from "../render/UI";
import type { EndScreenStats } from "../render/UI";
import { DamageNumbers } from "../render/DamageNumbers";
import { StageIndicator } from "../render/StageIndicator";
import { SettingsStore } from "../ui/SettingsStore";
import { SettingsScreen } from "../ui/SettingsScreen";
import { MainMenu } from "../ui/MainMenu";
import { PauseMenu } from "../ui/PauseMenu";
import { RecordsScreen } from "../ui/RecordsScreen";

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
  private damageNumbers: DamageNumbers;
  private stageIndicator: StageIndicator;

  private settingsStore: SettingsStore;
  private settingsScreen: SettingsScreen;
  private mainMenu: MainMenu;
  private pauseMenu: PauseMenu;
  private statsStore: StatsStore;
  private records: RecordsScreen;

  private encounter: EncounterManager;
  private timeAttack: TimeAttackManager;
  private boss: BossSystem;
  /** Set once per finished run so stats are recorded exactly once. */
  private statsRecorded = false;

  private lastFrameTime = 0;
  private rafHandle = 0;
  /** Suppress input routing when modals are open. */
  private acceptingTypingInput = false;
  /** Number of encounters remaining before victory check */
  private bossEncounterStarted = false;
  /** Whether the run is currently paused. */
  private paused = false;
  /** performance.now() at the moment the run was paused (for timer shifting). */
  private pauseStartedAt = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new SceneRenderer(canvas);
    this.parallax = new ParallaxScene(this.renderer);
    this.enemyView = new EnemyView(this.renderer);
    this.effects = new Effects(this.renderer);
    this.ui = new UI();
    const uiRoot = document.getElementById("ui-root")!;
    this.damageNumbers = new DamageNumbers(uiRoot);
    this.stageIndicator = new StageIndicator(uiRoot);

    // Settings (persisted) + shared settings screen
    this.settingsStore = new SettingsStore(this.audio);
    this.settingsStore.apply();
    this.settingsScreen = new SettingsScreen(uiRoot, this.settingsStore, () =>
      this.audio.play("uiSelect"),
    );

    // Persisted records / lifetime stats + records screen
    this.statsStore = new StatsStore();
    this.records = new RecordsScreen(uiRoot, this.statsStore, {
      onBack: () => this.showTitleMenu(),
      onUiSound: () => this.audio.play("uiSelect"),
    });

    // Main menu (replaces the old press-any-key title)
    this.mainMenu = new MainMenu(uiRoot, this.settingsScreen, {
      onStartGame: (mode) => this.startRun(mode),
      onShowRecords: () => this.showRecords(),
      onUiSound: () => this.audio.play("uiSelect"),
    });

    // Pause menu + top-right pause button
    this.pauseMenu = new PauseMenu(
      uiRoot,
      this.settingsScreen,
      {
        onResume: () => this.resumeRun(),
        onRestart: () => this.restartRun(),
        onAbandon: () => this.abandonRun(),
        onExitToMenu: () => this.exitToMenu(),
        onUiSound: () => this.audio.play("uiSelect"),
      },
      () => this.togglePause(),
    );

    this.encounter = new EncounterManager(this.state, {
      onEncounterStart: (i, def) => this.handleEncounterStart(i, def),
      onEncounterCleared: (i, def) => this.handleEncounterCleared(i, def),
      onAllEncountersCleared: () => this.handleAllCleared(),
      onBossEncounterStart: (def) => this.handleBossEncounterStart(def),
      onEnemySpawned: () => {
        /* nothing required — UI lazily creates card on first frame */
      },
    });

    this.timeAttack = new TimeAttackManager(this.state, {
      onWordSpawned: () => {
        /* UI lazily creates the card on the next frame */
      },
      onFirstWord: () => {
        /* timer start handled inside TimeAttackManager */
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
    this.showTitleMenu();
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

    const isTimeAttack = this.state.runMode === "fortyWords";
    const inCombat =
      this.state.mode === "encounter" ||
      this.state.mode === "boss" ||
      this.state.mode === "transition";

    // Stage indicator + pause button visibility track active gameplay.
    const showTracker = inCombat || this.state.mode === "countdown";
    this.stageIndicator.setVisible(showTracker);
    const showGameplayUi =
      inCombat ||
      this.state.mode === "countdown" ||
      this.state.mode === "upgrade" ||
      this.state.mode === "victory" ||
      this.state.mode === "defeat" ||
      this.state.mode === "results";
    this.ui.setGameplayVisible(showGameplayUi);
    const now = performance.now();
    if (isTimeAttack) {
      this.stageIndicator.setReadout({
        wordsCleared: this.state.wordsCleared,
        targetWords: GAME_MODES.fortyWords.targetWords ?? 40,
        elapsedMs: this.state.getElapsedMs(now),
        wpm: this.state.getWpm(now),
      });
    } else if (inCombat) {
      this.stageIndicator.update(this.state.encounterIndex);
    }
    this.pauseMenu.setPauseButtonVisible(inCombat && !this.paused);

    if (inCombat && !this.paused) {
      this.updateEnemies(deltaMs);
      if (isTimeAttack) {
        this.timeAttack.update(deltaMs);
      } else {
        this.encounter.update(deltaMs);
        if (this.boss.active) {
          this.boss.update(deltaMs, () => {
            /* spawn cb — Encounter manager handles spawn list, BossSystem inserts directly */
          });
        }
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
      // Player HP check (time-attack has no enemy attacks / death)
      if (!isTimeAttack && this.state.hp <= 0) {
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
      {
        wpm: this.state.getWpm(now),
        elapsedMs: this.state.getElapsedMs(now),
        modeType: GAME_MODES[this.state.runMode].modeType,
        wordsCleared: this.state.wordsCleared,
        targetWords: GAME_MODES.fortyWords.targetWords ?? 40,
      },
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
      // Attack timer — disabled in 40 Words (pure speedrun, no player damage).
      if (this.state.runMode !== "fortyWords") {
        e.attackTimer += deltaMs;
        if (e.attackTimer >= e.def.attackTimerMs) {
          this.handleEnemyAttack(e);
          e.attackTimer = 0;
        }
      }
    }
  }

  // ---------- Input routing ----------

  private handleInput(ev: InputEventLite): void {
    // Unlock audio on first keypress
    this.audio.unlock();

    // Title screen: any key starts run (fallback only while the main menu is up,
    // not while Settings / Game Mode / Records sub-screens are open).
    if (this.state.mode === "title") {
      if (
        ev.type === "any" &&
        !this.settingsScreen.isOpen &&
        !this.records.isOpen
      ) {
        this.mainMenu.handleAnyKey();
      }
      return;
    }

    // Countdown / results screens: typing is inert (buttons drive results).
    if (this.state.mode === "countdown" || this.state.mode === "results") {
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
      // Escape toggles the pause menu during gameplay.
      if (ev.type === "escape") {
        this.togglePause();
        return;
      }
      // While paused (or any menu overlay is open) typing must not affect combat.
      if (this.paused || this.settingsScreen.isOpen) return;
      if (!this.acceptingTypingInput) return;
      if (ev.type === "backspace") {
        this.typing.backspace();
        return;
      }
      if (ev.type === "char") {
        this.processTypingChar(ev.value);
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
      this.enemyView.hit(enemy.id);
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
        this.enemyView.hit(c.enemy.id);
      }
      // Floating damage number for each chained hit.
      const cScreen = this.ui.worldToScreen(cAnchor, this.renderer);
      this.damageNumbers.spawn(c.damage, cScreen.x, cScreen.y);
    }

    // Floating damage number for the primary hit.
    const screen = this.ui.worldToScreen(anchor, this.renderer);
    const dmgKind = result.damage >= 50 ? "crit" : "damage";
    this.damageNumbers.spawn(result.damage, screen.x, screen.y, dmgKind);
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

    // 40 Words: count clears and stop the clock exactly on the final word.
    if (this.state.runMode === "fortyWords" && result.killed) {
      this.timeAttack.notifyCleared();
      this.state.wordsCleared = this.timeAttack.clearedCount;
      if (this.timeAttack.isComplete && this.state.mode !== "results") {
        this.state.timeAttackEndMs = performance.now();
        this.completeFortyWords();
      }
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

  private showTitleMenu(): void {
    this.paused = false;
    this.pauseMenu.close();
    this.settingsScreen.close();
    this.pauseMenu.setPauseButtonVisible(false);
    this.stageIndicator.setVisible(false);
    this.ui.hideEndScreen();
    this.ui.hideCountdown();
    this.ui.setGameplayVisible(false);
    this.timeAttack.reset();
    document.body.classList.remove("mode-forty-words");
    this.boss.reset();
    this.bossEncounterStarted = false;
    this.state.enemies = [];
    this.enemyView.clear();
    this.effects.clear();
    this.damageNumbers.clear();
    this.ui.hideBossBar();
    this.acceptingTypingInput = false;
    this.state.mode = "title";
    this.parallax.setBossMode(false);
    this.renderer.cameraTargetZ = 0;
    this.renderer.cameraDollyOffset = 0;
    this.mainMenu.show();
  }

  private startRun(mode: RunModeId = DEFAULT_MODE): void {
    this.mainMenu.hide();
    this.records.close();
    this.settingsScreen.close();
    this.pauseMenu.close();
    this.ui.hideEndScreen();
    this.ui.hideCountdown();
    this.paused = false;
    this.boss.reset();
    this.ui.hideBossBar();
    this.bossEncounterStarted = false;
    this.statsRecorded = false;
    this.state.reset();
    this.state.runMode = mode;
    const cfg = GAME_MODES[mode];
    this.state.oneShotEnemies = !!cfg.oneShotEnemies;
    this.upgrades.reset();
    this.enemyView.clear();
    this.effects.clear();
    this.damageNumbers.clear();
    this.timeAttack.reset();
    this.encounter.configure(mode);
    this.stageIndicator.configure(mode);
    this.parallax.setBossMode(false);
    this.renderer.cameraTargetZ = 0;
    this.renderer.cameraDollyOffset = 0;
    document.body.classList.toggle("mode-forty-words", mode === "fortyWords");

    if (cfg.modeType === "timeAttack") {
      this.startTimeAttack();
    } else {
      this.state.mode = "encounter";
      this.state.runStartTime = performance.now();
      this.acceptingTypingInput = true;
      this.encounter.startRun();
    }
  }

  /** 40 Words: run the countdown, then begin spawning words (clock starts then). */
  private startTimeAttack(): void {
    this.state.mode = "countdown";
    this.acceptingTypingInput = false;
    const words = generateFortyWords(GAME_MODES.fortyWords.targetWords ?? 40);
    this.ui.showCountdown(() => {
      this.state.mode = "encounter";
      this.acceptingTypingInput = true;
      this.timeAttack.start(words);
    });
  }

  private showRecords(): void {
    this.mainMenu.hide();
    this.records.open();
  }

  // ---------- Pause system ----------

  private togglePause(): void {
    if (this.paused) {
      this.resumeRun();
    } else {
      this.pauseRun();
    }
  }

  private pauseRun(): void {
    if (this.paused) return;
    const inCombat =
      this.state.mode === "encounter" ||
      this.state.mode === "boss" ||
      this.state.mode === "transition";
    if (!inCombat) return;
    this.paused = true;
    this.pauseStartedAt = performance.now();
    this.audio.play("uiSelect");
    this.pauseMenu.setPauseButtonVisible(false);
    this.pauseMenu.open();
  }

  private resumeRun(): void {
    if (!this.paused) return;
    // Shift all absolute timestamps forward by the paused duration so nothing
    // (combo decay, queued spawns, attack pacing) jumps on resume.
    const pausedMs = performance.now() - this.pauseStartedAt;
    if (pausedMs > 0) this.shiftTimers(pausedMs);
    this.paused = false;
    this.pauseMenu.close();
    this.settingsScreen.close();
  }

  /** Offset wall-clock timestamps used by combat/encounter pacing. */
  private shiftTimers(ms: number): void {
    if (this.state.lastWordAt > 0) this.state.lastWordAt += ms;
    if (this.state.runStartTime > 0) this.state.runStartTime += ms;
    if (this.state.timeAttackStartMs > 0) this.state.timeAttackStartMs += ms;
    for (const e of this.state.enemies) {
      e.spawnedAt += ms;
      e.wordStartedAt += ms;
    }
    this.encounter.shiftTimers(ms);
  }

  private restartRun(): void {
    this.paused = false;
    this.pauseMenu.close();
    this.settingsScreen.close();
    // Restart the *current* mode (not the default) so Endless / 40 Words
    // don't silently drop the player into a Cursed Castle Run.
    this.startRun(this.state.runMode);
  }

  private abandonRun(): void {
    this.paused = false;
    this.pauseMenu.close();
    this.settingsScreen.close();
    this.pauseMenu.setPauseButtonVisible(false);
    this.stageIndicator.setVisible(false);
    this.triggerDefeat();
  }

  private exitToMenu(): void {
    this.showTitleMenu();
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
    // Show upgrade choices if this encounter rewards them and the mode uses
    // roguelike systems (40 Words never reaches here; Endless/Castle do).
    const cfg = GAME_MODES[this.state.runMode];
    if (
      def.rewardUpgrade &&
      cfg.roguelikeEnabled &&
      index < this.encounter.totalEncounters() - 1
    ) {
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
      const scale =
        this.state.runMode === "endlessCrypt"
          ? endlessBossScale(this.state.encounterIndex + 1)
          : 1;
      this.boss.bindBoss(scale);
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
    this.state.bossDefeated = true;
    this.state.bossesDefeated++;
    // Trigger explosive feedback at boss position
    const boss = this.boss.getBoss();
    if (boss) {
      const anchor = this.enemyView.getCardAnchor(boss);
      this.effects.killBurst(anchor, "#ff8848");
      this.effects.killBurst(anchor, "#ffd060");
    }
    this.ui.hideBossBar();

    // Endless Crypt: a defeated boss is a checkpoint, not the end of the run —
    // keep descending until the final level. Only the last level ends the run.
    const cfg = GAME_MODES[this.state.runMode];
    if (this.state.runMode === "endlessCrypt") {
      const level = this.state.encounterIndex + 1;
      if (level < cfg.maxStages) {
        window.setTimeout(() => {
          this.parallax.setBossMode(false);
          this.state.enemies = [];
          this.enemyView.clear();
          this.boss.reset();
          this.bossEncounterStarted = false;
          this.encounter.beginTransition();
        }, 1400);
        return;
      }
    }
    window.setTimeout(() => this.triggerVictory(), 1400);
  }

  // ---------- End game ----------

  /**
   * 40 Words completion: stop the clock, persist the result, and show the
   * time-attack results screen. Called exactly once when the 40th word clears.
   */
  private completeFortyWords(): void {
    this.state.mode = "results";
    this.acceptingTypingInput = false;
    this.stageIndicator.setVisible(false);
    this.pauseMenu.setPauseButtonVisible(false);
    this.audio.play("victory");
    this.effects.domShake("medium");

    const timeMs = this.state.getElapsedMs(this.state.timeAttackEndMs);
    const wpm = this.state.getWpm(this.state.timeAttackEndMs);
    const totalTyped = this.state.wordsTyped + this.state.mistakes;
    const accuracy =
      totalTyped > 0 ? (this.state.wordsTyped / totalTyped) * 100 : 100;

    const { newRecord, bestTimeMs } = this.statsStore.recordFortyWords({
      timeMs,
      wpm,
    });
    this.statsStore.recordGlobalRun({
      wordsTyped: this.state.wordsTyped,
      enemiesDefeated: this.state.enemiesDefeated,
      bossesDefeated: 0,
      wpm,
      playTimeMs: timeMs,
    });

    this.ui.showFortyWordsResults(
      { timeMs, wpm, accuracy, bestTimeMs, newRecord },
      () => this.startRun("fortyWords"),
      () => this.exitToMenu(),
    );
  }

  /** Persist lifetime + per-mode stats for a finished standard/endless run. */
  private recordRunStats(completed: boolean): void {
    if (this.statsRecorded) return;
    this.statsRecorded = true;
    const ref = this.state.runEndTime || performance.now();
    const wpm = this.state.getWpm(ref);
    const playTimeMs = this.state.getElapsedMs(ref);
    this.statsStore.recordGlobalRun({
      wordsTyped: this.state.wordsTyped,
      enemiesDefeated: this.state.enemiesDefeated,
      bossesDefeated: this.state.bossesDefeated,
      wpm,
      playTimeMs,
    });
    const stageReached = this.state.encounterIndex + 1;
    if (this.state.runMode === "endlessCrypt") {
      this.statsStore.recordEndless({
        levelReached: stageReached,
        bossesDefeated: this.state.bossesDefeated,
        furthestBoss: Math.floor(stageReached / 5),
        wpm,
      });
    } else if (this.state.runMode === "cursedCastleRun") {
      this.statsStore.recordCastle({
        stageReached,
        wpm,
        completed,
        timeMs: completed ? playTimeMs : 0,
      });
    }
  }

  private triggerVictory(): void {
    this.state.mode = "victory";
    this.state.runEndTime = performance.now();
    this.audio.play("victory");
    this.acceptingTypingInput = false;
    this.stageIndicator.setVisible(false);
    this.pauseMenu.setPauseButtonVisible(false);
    this.recordRunStats(true);
    const stats = this.buildEndScreenStats(true);
    this.ui.showEndScreen(
      stats,
      () => this.replay(),
      () => this.exitToMenu(),
    );
  }

  private triggerDefeat(): void {
    this.state.mode = "defeat";
    this.state.runEndTime = performance.now();
    this.audio.play("defeat");
    this.effects.domShake("heavy");
    this.acceptingTypingInput = false;
    this.stageIndicator.setVisible(false);
    this.pauseMenu.setPauseButtonVisible(false);
    this.recordRunStats(false);
    const stats = this.buildEndScreenStats(false);
    this.ui.showEndScreen(
      stats,
      () => this.replay(),
      () => this.exitToMenu(),
    );
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
      wpm: this.state.getWpm(this.state.runEndTime || performance.now()),
    };
  }

  private replay(): void {
    this.startRun(this.state.runMode);
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
