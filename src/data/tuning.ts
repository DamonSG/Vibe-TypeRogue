export const TUNING = {
  player: {
    maxHp: 100,
    startingShield: 0,
    /** Below this fraction of HP, "low HP" feedback kicks in */
    lowHpFraction: 0.3,
    /** Lives (candles) for lives-based modes like Cursed Castle Run. */
    maxLives: 3,
    /** Consecutive perfect words needed to earn an extra life (lives modes). */
    perfectStreakForLife: 10,
    /** Hard cap on lives/candles so the candle HUD never overflows. */
    maxLivesCap: 6,
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
    /** Cursed Castle Run: ms of attack-countdown reprieve when a hit enemy survives. */
    surviveReprieveMs: 2000,
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
    tickVolume: 0.6,
    missVolume: 0.18,
    impactVolume: 0.25,
    /** Kill-confirm ping — subtle so it sits under the keyboard tick. */
    killVolume: 0.14,
    phaseVolume: 0.4,
    /** Celebratory chime when a perfect streak earns an extra life. */
    extraLifeVolume: 0.3,
    /** Per-track gain applied to background music (keeps songs below SFX). */
    musicTrackVolume: 0.5,
    /** Perfect-word chime — subtle so the keyboard tick stays loudest. */
    perfectVolume: 0.08,
    victorySongVolume: 0.6,
    /** Default SFX/music bus levels (0..1) — overridden by saved settings. */
    defaultSfxVolume: 0.5,
    defaultMusicVolume: 0.1,
  },

  feedback: {
    /** ms for word card death animation */
    cardDyingMs: 320,
    /** ms for damage flash overlay */
    damageFlashMs: 320,
    /** ms input bar mistake flash */
    inputMistakeMs: 320,
    /** ms for a floating damage number to rise and fade out */
    damageNumberMs: 800,
    /** ms for the per-enemy sprite hit flash/shake */
    spriteHitMs: 180,
  },

  encounter: {
    /** Time after wave clear before next wave / transition triggers */
    postWaveDelayMs: 300,
    /** Time for the encounter banner to remain on screen */
    bannerMs: 1800,
    /** Delay between transition and next encounter start */
    transitionMs: 800,
  },

  upgrade: {
    /** Number of upgrade choices shown */
    choices: 3,
  },
} as const;

export type Tuning = typeof TUNING;
