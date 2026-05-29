/**
 * Data-driven game mode configuration. Each playable run mode is described
 * declaratively here so behaviour (stage caps, roguelike systems, win
 * conditions) can be tuned without touching the systems that read it.
 */

export type RunModeId = "cursedCastleRun" | "endlessCrypt" | "fortyWords";

export type ModeType = "standard" | "endless" | "timeAttack";

export interface GameModeConfig {
  id: RunModeId;
  label: string;
  /** Short blurb shown on the Game Mode card. */
  description: string;
  modeType: ModeType;
  /** Max stages/levels in the run (used as the cap / victory point). */
  maxStages: number;
  /** Whether upgrade choices appear between encounters. */
  roguelikeEnabled: boolean;
  /** Whether phrase-style (multi-word) prompts are allowed. */
  sentencesEnabled: boolean;
  /** Whether boss encounters can appear. */
  bossesEnabled: boolean;
  /** For endless: a boss appears every Nth level. */
  bossEvery?: number;
  /** For time-attack: number of words to clear. */
  targetWords?: number;
  /** Whether any completed word instantly kills its enemy. */
  oneShotEnemies?: boolean;
  /** Whether a 3-2-1 countdown precedes gameplay. */
  countdownEnabled?: boolean;
  /** Whether a live speed clock is shown. */
  timerEnabled?: boolean;
}

export const GAME_MODES: Record<RunModeId, GameModeConfig> = {
  cursedCastleRun: {
    id: "cursedCastleRun",
    label: "Cursed Castle Run",
    description:
      "Standard 10-stage descent. Survive the castle and face the Cursed Knight.",
    modeType: "standard",
    maxStages: 10,
    roguelikeEnabled: true,
    sentencesEnabled: true,
    bossesEnabled: true,
  },

  endlessCrypt: {
    id: "endlessCrypt",
    label: "Endless Crypt",
    description: "100-level test descent. Bosses appear every 5 levels.",
    modeType: "endless",
    maxStages: 100,
    roguelikeEnabled: true,
    sentencesEnabled: true,
    bossesEnabled: true,
    bossEvery: 5,
  },

  fortyWords: {
    id: "fortyWords",
    label: "40 Words",
    description:
      "Clear 40 words as fast as possible. Pure speed typing challenge.",
    modeType: "timeAttack",
    maxStages: 0,
    roguelikeEnabled: false,
    sentencesEnabled: false,
    bossesEnabled: false,
    targetWords: 40,
    oneShotEnemies: true,
    countdownEnabled: true,
    timerEnabled: true,
  },
};

export const DEFAULT_MODE: RunModeId = "cursedCastleRun";

/** Ordered list of mode ids for menu rendering. */
export const MODE_ORDER: RunModeId[] = [
  "cursedCastleRun",
  "endlessCrypt",
  "fortyWords",
];
