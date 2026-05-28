export const TUNING = {
  player: {
    maxHp: 100,
    startingShield: 0,
    /** Below this fraction of HP, "low HP" feedback kicks in */
    lowHpFraction: 0.3,
  },

  combat: {
    /** Damage dealt when a word is completed (base, before upgrades). */
    completedWordDamage: 25,
    /** Damage scaling per letter in the word — small but encourages longer words. */
    perLetterDamageBonus: 1.5,
    /** Multiplier on damage when word completed without any mistakes. */
    perfectMultiplier: 1.35,
    /** Combo damage multiplier curve: every N combo points adds X. */
    comboBonusPer: 5,
    comboMultiplierStep: 0.08,
    comboMultiplierMax: 1.6,
  },

  combo: {
    /** Default combo gain per completed word. */
    perWord: 1,
    /** Combo decay timer in ms — if no word completed in this time, combo decays. */
    decayTimeoutMs: 8000,
    /** How many combo points lost per decay tick. */
    decayPerTick: 1,
  },

  enemyApproach: {
    /** Total time it takes (base) for an enemy to walk from spawn depth to attack. */
    baseApproachMs: 2200,
    /** Multiplier for camera dolly progress affecting approach speed. */
    cameraInfluence: 0.3,
  },

  scene: {
    /** Camera Z dolly distance traveled per encounter. Disabled (0) to keep enemy spawn distance consistent across encounters. */
    dollyPerEncounter: 0,
    /** Camera dolly tween duration. */
    dollyTweenMs: 1400,
  },

  audio: {
    masterVolume: 0.6,
    tickVolume: 0.22,
    missVolume: 0.32,
    impactVolume: 0.5,
    killVolume: 0.7,
    phaseVolume: 0.8,
    musicVolume: 0.0, // no music in V1
  },

  feedback: {
    /** ms for word card death animation */
    cardDyingMs: 320,
    /** ms for damage flash overlay */
    damageFlashMs: 320,
    /** ms input bar mistake flash */
    inputMistakeMs: 320,
  },

  encounter: {
    /** Time after wave clear before next wave / transition triggers */
    postWaveDelayMs: 600,
    /** Time for the encounter banner to remain on screen */
    bannerMs: 1800,
    /** Delay between transition and next encounter start */
    transitionMs: 1600,
  },

  upgrade: {
    /** Number of upgrade choices shown */
    choices: 3,
  },
} as const;

export type Tuning = typeof TUNING;
