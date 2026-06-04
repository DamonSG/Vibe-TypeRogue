import * as THREE from "three";
import type {
  BossPhaseDef,
  Enemy,
  GameStateSnapshot,
  UpgradeDef,
} from "../types";
import { TUNING } from "../data/tuning";
import type { SceneRenderer } from "./SceneRenderer";
import type { EnemyView } from "./EnemyView";
import type { TypingSystem } from "../game/TypingSystem";

export interface EndScreenStats {
  victory: boolean;
  accuracy: number;
  wordsTyped: number;
  mistakes: number;
  highestCombo: number;
  enemiesDefeated: number;
  damageTaken: number;
  bossDefeated: boolean;
  bossHpRemaining: number;
  bossMaxHp: number;
  rankTitle: string;
  buildId: string;
  shareLine: string;
  runDurationMs: number;
}

/**
 * UI overlay: HTML/CSS layer above the Three.js canvas. Word cards are HTML
 * elements positioned each frame to follow enemy world-space anchors.
 */
export class UI {
  private root: HTMLElement;
  // HUD
  private hudEl: HTMLElement;
  private hpBarFill: HTMLElement;
  private hpText: HTMLElement;
  private shieldEl: HTMLElement;
  private comboEl: HTMLElement;
  private scoreEl: HTMLElement;
  private buildBadgeEl: HTMLElement;
  private inputBar: HTMLElement;
  private cardsRoot: HTMLElement;
  // Boss
  private bossBar: HTMLElement;
  private bossBarFill: HTMLElement;
  private bossBarLabel: HTMLElement;
  private bossPhaseEl: HTMLElement;
  // Cards
  private cards = new Map<string, EnemyCardEl>();
  private lastCombo = 0;
  private comboBumpTimeout: number | null = null;

  constructor() {
    const r = document.getElementById("ui-root");
    if (!r) throw new Error("ui-root not found");
    this.root = r;
    const { hud, hpFill, hpText, shield, combo, score, badge, input } =
      this.buildHUD();
    this.hudEl = hud;
    this.hpBarFill = hpFill;
    this.hpText = hpText;
    this.shieldEl = shield;
    this.comboEl = combo;
    this.scoreEl = score;
    this.buildBadgeEl = badge;
    this.inputBar = input;
    const { bar, fill, label, phase } = this.buildBossBar();
    this.bossBar = bar;
    this.bossBarFill = fill;
    this.bossBarLabel = label;
    this.bossPhaseEl = phase;
    this.cardsRoot = document.createElement("div");
    this.cardsRoot.className = "cards-root";
    this.cardsRoot.style.cssText =
      "position:absolute;inset:0;pointer-events:none;";
    this.root.appendChild(this.cardsRoot);
  }

  // ---------- Frame update ----------

  update(
    state: GameStateSnapshot & {
      enemies: Enemy[];
      hp: number;
      maxHp: number;
      shield: number;
      combo: number;
      score: number;
      damageTaken: number;
    },
    renderer: SceneRenderer,
    enemyView: EnemyView,
    typing: TypingSystem,
    buildIdentity: string,
  ): void {
    this.updateHUD(state, typing, buildIdentity);
    this.updateCards(state, renderer, enemyView, typing);
  }

  private updateHUD(
    state: GameStateSnapshot & {
      hp: number;
      maxHp: number;
      shield: number;
      combo: number;
      score: number;
    },
    typing: TypingSystem,
    buildIdentity: string,
  ): void {
    // HP
    const pct = Math.max(0, state.hp / Math.max(1, state.maxHp));
    this.hpBarFill.style.width = `${pct * 100}%`;
    this.hpBarFill.classList.toggle("low", pct < TUNING.player.lowHpFraction);
    this.hpText.textContent = `${Math.ceil(state.hp)} / ${state.maxHp}`;
    // Shield
    if (state.shield > 0) {
      this.shieldEl.classList.remove("hidden");
      this.shieldEl.textContent = `◆ Shield ${Math.ceil(state.shield)}`;
    } else {
      this.shieldEl.classList.add("hidden");
    }
    // Combo
    const combo = state.combo;
    const comboMult = Math.min(
      TUNING.combat.comboMultiplierMax,
      1 +
        Math.floor(combo / TUNING.combat.comboBonusPer) *
          TUNING.combat.comboMultiplierStep,
    );
    if (combo > 0) {
      const multStr = combo >= TUNING.combat.comboBonusPer
        ? ` <span class="multiplier">×${comboMult.toFixed(2)}</span>`
        : "";
      this.comboEl.innerHTML = `${combo} combo${multStr}`;
      this.comboEl.classList.remove("broken");
    } else {
      this.comboEl.textContent = "—";
      this.comboEl.classList.remove("broken");
    }
    if (combo > this.lastCombo) {
      this.bumpCombo();
    } else if (combo === 0 && this.lastCombo > 0) {
      this.comboEl.classList.add("broken");
    }
    this.lastCombo = combo;
    // Score
    this.scoreEl.textContent = state.score.toString().padStart(4, "0");
    // Build
    this.buildBadgeEl.textContent = buildIdentity;
    // Input bar
    const input = typing.getCurrentInput();
    if (input.length === 0) {
      this.inputBar.classList.add("empty");
      this.inputBar.textContent = "Type something";
    } else {
      this.inputBar.classList.remove("empty");
      this.inputBar.textContent = input;
    }
  }

  private updateCards(
    state: { enemies: Enemy[] },
    renderer: SceneRenderer,
    enemyView: EnemyView,
    typing: TypingSystem,
  ): void {
    const seen = new Set<string>();
    const bestTarget = typing.getBestTarget(state.enemies);
    const currentInput = typing.getCurrentInput();

    for (const e of state.enemies) {
      seen.add(e.id);
      let card = this.cards.get(e.id);
      if (!card) {
        card = this.createCard(e);
        this.cards.set(e.id, card);
        this.cardsRoot.appendChild(card.el);
      }
      // Position
      const worldPos = enemyView.getCardAnchor(e);
      const proj = renderer.projectToScreen(worldPos);
      if (!proj.inFront) {
        card.el.style.opacity = "0";
        continue;
      }
      card.el.style.left = `${proj.x}px`;
      card.el.style.top = `${proj.y}px`;
      // Scale based on depth — closer = bigger
      const depthScale = 1 + (1 - proj.depth01) * 0.0;
      const yOffset = e.cardAnchorSide === "top" ? "-100%" : "0";
      card.el.style.transform = `translate(-50%, ${yOffset}) scale(${depthScale})`;
      card.el.style.opacity = e.dying ? "0.6" : "1";
      // Target highlight
      const isTarget = bestTarget?.id === e.id && currentInput.length > 0;
      card.el.classList.toggle("targeted", isTarget);
      // Mistake flash (set by CombatController via flashCard)
      // Update letter classes
      this.updateLetters(card, e, currentInput, isTarget);
      // HP pips
      this.updateHpPips(card, e);
      // Intent: damage value + numeric attack countdown
      const remainingMs = Math.max(0, e.def.attackTimerMs - e.attackTimer);
      card.dmgEl.textContent = `\u2694 ${e.def.damage}`;
      card.timerEl.textContent = `${(remainingMs / 1000).toFixed(1)}s`;
      card.el.classList.toggle("danger", remainingMs < 1500);
      // Dying anim
      if (e.dying && !card.el.classList.contains("dying")) {
        card.el.classList.add("dying");
      }
    }
    // Remove cards for enemies that no longer exist
    for (const [id, card] of this.cards) {
      if (!seen.has(id)) {
        card.el.remove();
        this.cards.delete(id);
      }
    }
  }

  /** Highlight letters that match the player's current input on this card. */
  private updateLetters(
    card: EnemyCardEl,
    enemy: Enemy,
    currentInput: string,
    isTarget: boolean,
  ): void {
    const matches =
      currentInput.length > 0 &&
      enemy.promptMatch.startsWith(currentInput);
    const typedLen = matches ? currentInput.length : 0;
    for (let i = 0; i < card.letters.length; i++) {
      const letterEl = card.letters[i];
      letterEl.classList.remove("typed", "next");
      if (i < typedLen) {
        letterEl.classList.add("typed");
      } else if (i === typedLen && isTarget) {
        letterEl.classList.add("next");
      }
    }
  }

  private updateHpPips(card: EnemyCardEl, enemy: Enemy): void {
    // Show up to 5 pips representing HP fractions for clarity.
    const pipCount = card.pips.length;
    const filledRaw = (enemy.hp / enemy.maxHp) * pipCount;
    for (let i = 0; i < pipCount; i++) {
      const filled = i < Math.ceil(filledRaw);
      card.pips[i].classList.toggle("full", filled);
    }
  }

  /** Trigger a mistake flash animation on the enemy's card. */
  flashMistake(enemyId: string | null): void {
    this.inputBar.classList.remove("mistake");
    void this.inputBar.offsetWidth;
    this.inputBar.classList.add("mistake");
    window.setTimeout(
      () => this.inputBar.classList.remove("mistake"),
      TUNING.feedback.inputMistakeMs,
    );
    if (!enemyId) return;
    const card = this.cards.get(enemyId);
    if (!card) return;
    card.el.classList.remove("mistake-flash");
    void card.el.offsetWidth;
    card.el.classList.add("mistake-flash");
    window.setTimeout(() => card.el.classList.remove("mistake-flash"), 320);
  }

  /** Trigger a hit flash on a card. */
  flashHit(enemyId: string): void {
    const card = this.cards.get(enemyId);
    if (!card) return;
    card.el.classList.remove("hit-flash");
    void card.el.offsetWidth;
    card.el.classList.add("hit-flash");
    window.setTimeout(() => card.el.classList.remove("hit-flash"), 220);
  }

  /** Floating popup (damage, combo, etc.) at screen pos. */
  spawnPopup(
    text: string,
    kind: "damage" | "crit" | "combo" | "heal" | "shield",
    screenX: number,
    screenY: number,
  ): void {
    const el = document.createElement("div");
    el.className = `popup ${kind}`;
    el.textContent = text;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    this.root.appendChild(el);
    window.setTimeout(() => el.remove(), 950);
  }

  private bumpCombo(): void {
    this.comboEl.classList.remove("bump");
    void this.comboEl.offsetWidth;
    this.comboEl.classList.add("bump");
    if (this.comboBumpTimeout !== null) {
      window.clearTimeout(this.comboBumpTimeout);
    }
    this.comboBumpTimeout = window.setTimeout(
      () => this.comboEl.classList.remove("bump"),
      160,
    );
  }

  // ---------- Boss bar ----------

  showBossBar(name: string, totalPhases: number): void {
    this.bossBar.classList.add("visible");
    this.bossBarLabel.textContent = name;
    // Build phase markers
    const markers = this.bossBar.querySelector(".boss-bar-phase-markers");
    if (markers) {
      markers.innerHTML = "";
      for (let i = 0; i < totalPhases; i++) {
        const m = document.createElement("div");
        m.className = "marker";
        markers.appendChild(m);
      }
    }
    this.bossBarFill.style.width = "100%";
  }

  hideBossBar(): void {
    this.bossBar.classList.remove("visible");
  }

  updateBoss(hp: number, maxHp: number, phase: BossPhaseDef | null): void {
    if (!this.bossBar.classList.contains("visible")) return;
    const pct = Math.max(0, hp / Math.max(1, maxHp));
    this.bossBarFill.style.width = `${pct * 100}%`;
    if (phase) {
      this.bossPhaseEl.textContent = `Phase ${phase.index + 1} — ${phase.name}`;
    }
  }

  // ---------- Title screen ----------

  showTitleScreen(onStart: () => void): void {
    const el = document.createElement("div");
    el.className = "title-screen";
    el.innerHTML = `
      <div class="subtitle">A Typing Roguelike</div>
      <h1>TypeRogue</h1>
      <div class="subtitle">Cursed Castle — Vol. I</div>
      <div class="start-prompt">Press any key to begin</div>
      <div class="hint">
        Type the words above enemies to attack. Survive 4 encounters and defeat the Cursed Knight.<br />
        Mistakes break your combo but don't damage you. Pick wisely between fights.
      </div>
    `;
    el.addEventListener("keydown", onStart);
    el.tabIndex = 0;
    this.root.appendChild(el);
    // External InputManager handles "any key" — we just store ref for removal
    el.dataset.titleScreen = "1";
  }

  hideTitleScreen(): void {
    const el = this.root.querySelector('[data-title-screen="1"]');
    if (el) el.remove();
  }

  // ---------- Encounter banner ----------

  showEncounterBanner(name: string, subtitle: string, isBoss: boolean): void {
    const el = document.createElement("div");
    el.className = "encounter-banner";
    if (isBoss) el.style.color = "var(--boss)";
    el.innerHTML = `${name}<span class="subtitle">${subtitle}</span>`;
    this.root.appendChild(el);
    window.setTimeout(() => el.remove(), TUNING.encounter.bannerMs);
  }

  // ---------- Upgrade modal ----------

  showUpgradeModal(
    choices: UpgradeDef[],
    onPick: (u: UpgradeDef) => void,
  ): void {
    this.hideUpgradeModal();
    const el = document.createElement("div");
    el.className = "upgrade-modal";
    el.dataset.upgradeModal = "1";
    const heading = document.createElement("h2");
    heading.textContent = "Choose your boon";
    el.appendChild(heading);
    const sub = document.createElement("div");
    sub.className = "subtitle";
    sub.textContent = "Press 1, 2, or 3 — or click a card";
    el.appendChild(sub);
    const cards = document.createElement("div");
    cards.className = "upgrade-cards";
    choices.forEach((u, i) => {
      const c = document.createElement("button");
      c.className = `upgrade-card category-${u.category}`;
      c.type = "button";
      c.innerHTML = `
        <div class="key-hint">${i + 1}</div>
        <div class="category">${u.category}</div>
        <div class="name">${u.name}</div>
        <div class="description">${u.description}</div>
        ${u.flavor ? `<div class="flavor">"${u.flavor}"</div>` : ""}
      `;
      c.addEventListener("click", () => onPick(u));
      c.dataset.upgradeIndex = String(i);
      cards.appendChild(c);
    });
    el.appendChild(cards);
    this.root.appendChild(el);
  }

  hideUpgradeModal(): void {
    const el = this.root.querySelector('[data-upgrade-modal="1"]');
    if (el) el.remove();
  }

  /** Programmatic upgrade selection (from 1/2/3 key). */
  selectUpgradeAt(index: number): UpgradeDef | null {
    const modal = this.root.querySelector('[data-upgrade-modal="1"]');
    if (!modal) return null;
    const buttons = modal.querySelectorAll<HTMLButtonElement>(".upgrade-card");
    if (index < 0 || index >= buttons.length) return null;
    buttons[index].click();
    return null;
  }

  // ---------- End screen ----------

  showEndScreen(stats: EndScreenStats, onReplay: () => void): void {
    this.hideEndScreen();
    const el = document.createElement("div");
    el.className = `end-screen ${stats.victory ? "victory" : "defeat"}`;
    el.dataset.endScreen = "1";

    const title = stats.victory ? "Victory" : "Defeat";
    const buildLine = stats.buildId !== "No Build" ? stats.buildId : "Wandering Hand";
    const bossLine = stats.victory
      ? "Cursed Knight defeated"
      : stats.bossDefeated
        ? "Boss defeated, but you fell"
        : stats.bossHpRemaining > 0
          ? `Boss survived (${Math.ceil(stats.bossHpRemaining)}/${stats.bossMaxHp} HP)`
          : "Never reached the boss";

    el.innerHTML = `
      <h1>${title}</h1>
      <div class="rank-title">${stats.rankTitle}</div>
      <div class="build-id">Build · ${buildLine}</div>
      <div class="stats-grid">
        <div class="stat-row"><span class="stat-label">Accuracy</span><span class="stat-value ${stats.accuracy >= 90 ? "good" : stats.accuracy < 70 ? "bad" : ""}">${stats.accuracy.toFixed(1)}%</span></div>
        <div class="stat-row"><span class="stat-label">Words Typed</span><span class="stat-value">${stats.wordsTyped}</span></div>
        <div class="stat-row"><span class="stat-label">Mistakes</span><span class="stat-value ${stats.mistakes > 30 ? "bad" : ""}">${stats.mistakes}</span></div>
        <div class="stat-row"><span class="stat-label">Highest Combo</span><span class="stat-value good">${stats.highestCombo}</span></div>
        <div class="stat-row"><span class="stat-label">Enemies Defeated</span><span class="stat-value">${stats.enemiesDefeated}</span></div>
        <div class="stat-row"><span class="stat-label">Damage Taken</span><span class="stat-value ${stats.damageTaken < 50 ? "good" : stats.damageTaken > 200 ? "bad" : ""}">${stats.damageTaken}</span></div>
        <div class="stat-row"><span class="stat-label">Run Time</span><span class="stat-value">${formatDuration(stats.runDurationMs)}</span></div>
        <div class="stat-row"><span class="stat-label">Outcome</span><span class="stat-value ${stats.victory ? "good" : "bad"}">${bossLine}</span></div>
      </div>
      <div class="share-line">${stats.shareLine}</div>
      <div class="actions">
        <button data-replay>Replay</button>
      </div>
    `;
    const btn = el.querySelector<HTMLButtonElement>("[data-replay]")!;
    btn.addEventListener("click", onReplay);
    this.root.appendChild(el);
  }

  hideEndScreen(): void {
    const el = this.root.querySelector('[data-end-screen="1"]');
    if (el) el.remove();
  }

  // ---------- Builders ----------

  private buildHUD(): {
    hud: HTMLElement;
    hpFill: HTMLElement;
    hpText: HTMLElement;
    shield: HTMLElement;
    combo: HTMLElement;
    score: HTMLElement;
    badge: HTMLElement;
    input: HTMLElement;
  } {
    const hud = document.createElement("div");
    hud.className = "hud";
    hud.innerHTML = `
      <div class="hud-cluster left">
        <div class="hud-label">Vitae</div>
        <div class="hp-bar"><div class="hp-bar-fill"></div></div>
        <div class="hp-text">100 / 100</div>
        <div class="shield-indicator hidden">◆ Shield 0</div>
      </div>
      <div class="hud-cluster right">
        <div class="hud-label">Combo</div>
        <div class="combo-display">—</div>
        <div class="hud-label" style="margin-top:8px;">Score</div>
        <div class="score-display">0000</div>
        <div class="build-badge">No Build</div>
      </div>
    `;
    this.root.appendChild(hud);
    const input = document.createElement("div");
    input.className = "input-bar empty";
    input.textContent = "Type something";
    this.root.appendChild(input);
    return {
      hud,
      hpFill: hud.querySelector(".hp-bar-fill") as HTMLElement,
      hpText: hud.querySelector(".hp-text") as HTMLElement,
      shield: hud.querySelector(".shield-indicator") as HTMLElement,
      combo: hud.querySelector(".combo-display") as HTMLElement,
      score: hud.querySelector(".score-display") as HTMLElement,
      badge: hud.querySelector(".build-badge") as HTMLElement,
      input,
    };
  }

  private buildBossBar(): {
    bar: HTMLElement;
    fill: HTMLElement;
    label: HTMLElement;
    phase: HTMLElement;
  } {
    const bar = document.createElement("div");
    bar.className = "boss-bar";
    bar.innerHTML = `
      <div class="boss-bar-label">The Cursed Knight</div>
      <div class="boss-bar-track">
        <div class="boss-bar-fill"></div>
        <div class="boss-bar-phase-markers"></div>
      </div>
      <div class="boss-bar-phase">Phase 1</div>
    `;
    this.root.appendChild(bar);
    return {
      bar,
      fill: bar.querySelector(".boss-bar-fill") as HTMLElement,
      label: bar.querySelector(".boss-bar-label") as HTMLElement,
      phase: bar.querySelector(".boss-bar-phase") as HTMLElement,
    };
  }

  private createCard(enemy: Enemy): EnemyCardEl {
    const el = document.createElement("div");
    el.className = `word-card`;
    el.classList.add(
      enemy.cardAnchorSide === "top" ? "anchor-top" : "anchor-bottom",
    );
    if (enemy.cardStyle === "phrase") el.classList.add("phrase");
    if (enemy.cardStyle === "elite") el.classList.add("elite");
    if (enemy.cardStyle === "boss") el.classList.add("boss");
    const prompt = document.createElement("div");
    prompt.className = "prompt";
    const letters: HTMLElement[] = [];
    const display = enemy.promptDisplay;
    for (let i = 0; i < display.length; i++) {
      const ch = display.charAt(i);
      const span = document.createElement("span");
      span.className = "letter";
      if (ch === " ") span.classList.add("space");
      span.textContent = ch === " " ? "\u00A0" : ch;
      prompt.appendChild(span);
      letters.push(span);
    }
    el.appendChild(prompt);
    // HP pips
    const pipsRow = document.createElement("div");
    pipsRow.className = "hp-pips";
    const pipCount = Math.min(
      6,
      Math.max(3, Math.ceil(enemy.maxHp / 20)),
    );
    const pips: HTMLElement[] = [];
    for (let i = 0; i < pipCount; i++) {
      const p = document.createElement("div");
      p.className = "pip full";
      pipsRow.appendChild(p);
      pips.push(p);
    }
    el.appendChild(pipsRow);
    // Intent row: damage + attack timer countdown (Slay-the-Spire style)
    const intent = document.createElement("div");
    intent.className = "intent";
    const dmgEl = document.createElement("span");
    dmgEl.className = "dmg";
    dmgEl.textContent = `\u2694 ${enemy.def.damage}`;
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "\u00B7";
    const timerEl = document.createElement("span");
    timerEl.className = "timer";
    timerEl.textContent = `${(enemy.def.attackTimerMs / 1000).toFixed(1)}s`;
    intent.appendChild(dmgEl);
    intent.appendChild(sep);
    intent.appendChild(timerEl);
    el.appendChild(intent);
    return { el, prompt, letters, pips, dmgEl, timerEl, enemyId: enemy.id };
  }

  /** Force a card to refresh its rendered prompt (when refreshOnSurvive triggers). */
  refreshCardPrompt(enemyId: string, newDisplay: string): void {
    const card = this.cards.get(enemyId);
    if (!card) return;
    card.prompt.innerHTML = "";
    card.letters = [];
    for (let i = 0; i < newDisplay.length; i++) {
      const ch = newDisplay.charAt(i);
      const span = document.createElement("span");
      span.className = "letter";
      if (ch === " ") span.classList.add("space");
      span.textContent = ch === " " ? "\u00A0" : ch;
      card.prompt.appendChild(span);
      card.letters.push(span);
    }
  }

  /** Compute and return screen position of a world point (used for popups). */
  worldToScreen(
    worldPos: THREE.Vector3,
    renderer: SceneRenderer,
  ): { x: number; y: number } {
    const p = renderer.projectToScreen(worldPos);
    return { x: p.x, y: p.y };
  }
}

interface EnemyCardEl {
  el: HTMLElement;
  prompt: HTMLElement;
  letters: HTMLElement[];
  pips: HTMLElement[];
  dmgEl: HTMLElement;
  timerEl: HTMLElement;
  enemyId: string;
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
