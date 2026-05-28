export type EnemyKind =
  | "skeleton"
  | "ghoul"
  | "guard"
  | "ghost"
  | "caster"
  | "elite"
  | "boss";

export type UpgradeCategory =
  | "offense"
  | "defense"
  | "combo"
  | "risk"
  | "utility";

export type GameMode =
  | "title"
  | "encounter"
  | "transition"
  | "upgrade"
  | "boss"
  | "victory"
  | "defeat";

export interface EnemyDef {
  kind: EnemyKind;
  displayName: string;
  hp: number;
  attackTimerMs: number;
  damage: number;
  promptPool: string[];
  spriteKey: string;
  refreshOnSurvive: boolean;
  scale: number;
  approachSpeed: number;
  cardStyle?: "default" | "phrase" | "elite" | "boss";
  isPhrase?: boolean;
  /** Visual color hint for procedural fallback sprite */
  colorHint?: string;
}

export interface Enemy {
  id: string;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  promptDisplay: string;
  promptMatch: string;
  typedCount: number;
  laneX: number;
  depth: number;
  attackTimer: number;
  alive: boolean;
  dying: boolean;
  dyingMs: number;
  spawnedAt: number;
  /** Whether the player has made a mistake on this enemy's current word (kills "perfect" flag) */
  mistakeOnCurrent: boolean;
  /** ms timestamp when current word started being typed */
  wordStartedAt: number;
  /** For caster/elite phrase-style cards */
  cardStyle: "default" | "phrase" | "elite" | "boss";
  /** Visual tint */
  colorHint: string;
  /** Whether the word card anchors above the enemy's head or below their feet — alternates per spawn for visual variety. */
  cardAnchorSide: "top" | "bottom";
}

export interface EncounterDef {
  id: string;
  name: string;
  subtitle: string;
  waves: WaveDef[];
  /** Whether this encounter offers an upgrade after clear */
  rewardUpgrade: boolean;
  /** Background variant — affects fog density, lighting tint */
  ambient?: "intro" | "deep" | "elite" | "boss";
}

export interface WaveDef {
  /** Delay before this wave starts (ms after previous wave clears, or encounter start) */
  delayMs: number;
  /** Enemies to spawn in this wave */
  spawns: SpawnSpec[];
}

export interface SpawnSpec {
  kind: EnemyKind;
  /** Optional prompt override (used for boss / scripted prompts) */
  promptOverride?: string;
  /** Stagger delay in ms */
  delayMs?: number;
  /** Lane x position from -1 to 1 */
  laneX?: number;
  /** Start depth 0..1 (0 = at player, 1 = far back) */
  startDepth?: number;
}

export type HookEventType =
  | "letter"
  | "wordComplete"
  | "hit"
  | "kill"
  | "mistake"
  | "encounterStart"
  | "encounterEnd"
  | "runStart";

export interface HookEventBase {
  type: HookEventType;
}

export interface LetterEvent extends HookEventBase {
  type: "letter";
  enemy: Enemy;
  char: string;
  perfectSoFar: boolean;
}

export interface WordCompleteEvent extends HookEventBase {
  type: "wordComplete";
  enemy: Enemy;
  word: string;
  perfect: boolean;
  durationMs: number;
  /** Whether this completion will kill the enemy */
  willKill: boolean;
}

export interface HitEvent extends HookEventBase {
  type: "hit";
  enemy: Enemy;
  damage: number;
  willKill: boolean;
}

export interface KillEvent extends HookEventBase {
  type: "kill";
  enemy: Enemy;
  perfect: boolean;
}

export interface MistakeEvent extends HookEventBase {
  type: "mistake";
  enemy: Enemy | null;
  expected: string;
  got: string;
}

export interface EncounterEvent extends HookEventBase {
  type: "encounterStart" | "encounterEnd";
  encounterIndex: number;
}

export interface RunStartEvent extends HookEventBase {
  type: "runStart";
}

export type HookEvent =
  | LetterEvent
  | WordCompleteEvent
  | HitEvent
  | KillEvent
  | MistakeEvent
  | EncounterEvent
  | RunStartEvent;

export interface CombatContext {
  event: HookEvent;
  /** Multiplier on base damage for this event (1.0 = no change). */
  damageMultiplier: number;
  /** Flat damage added on top of base. */
  flatBonusDamage: number;
  /** Shield gain to apply after event. */
  shieldGain: number;
  /** HP heal to apply after event. */
  heal: number;
  /** Combo points to add (beyond default +1 on word). */
  comboBonus: number;
  /** Whether to trigger a chain/AOE effect — attacker can read this. */
  chainEnemies: number;
  /** Damage to chained targets (if chainEnemies > 0). */
  chainDamage: number;
  /** Reference to game state (read/write allowed in hooks) */
  state: GameStateSnapshot;
}

export type UpgradeHook = (ctx: CombatContext) => void;

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  category: UpgradeCategory;
  flavor?: string;
  tags?: string[];
  hooks: Partial<Record<HookEventType, UpgradeHook>>;
}

export interface BossPhaseDef {
  index: number;
  name: string;
  /** Fraction of max HP at which this phase ends (e.g., 0.75) */
  endsAtHpFraction: number;
  promptPool: string[];
  /** Whether boss summons in this phase */
  summon?: {
    kinds: EnemyKind[];
    intervalMs: number;
    maxAlive: number;
  };
  /** Attack timer base in ms */
  attackTimerMs: number;
  /** Damage dealt per attack */
  damage: number;
  /** Use phrase-style cards */
  usePhrases: boolean;
}

export interface BossDef {
  id: string;
  displayName: string;
  hp: number;
  scale: number;
  spriteKey: string;
  phases: BossPhaseDef[];
}

/** Mutable view of player state exposed to hooks. */
export interface GameStateSnapshot {
  hp: number;
  maxHp: number;
  shield: number;
  combo: number;
  score: number;
  wordsTyped: number;
  mistakes: number;
  perfectWords: number;
  encounterIndex: number;
  /** First letter of the previous completed word — for Echo Type. */
  lastWordFirstLetter: string | null;
  /** How many consecutive words shared a first letter — for Echo Type. */
  echoChainCount: number;
  /** Count of perfect words since last barrier — for Shield Script. */
  perfectWordsSinceBarrier: number;
}
