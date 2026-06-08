import type { BossDef } from "../types";
import { CURSED_KNIGHT } from "./boss";

/**
 * The Hollow Wraith — a fast, evasive caster boss. Its words scramble the moment
 * you slip, it crowds you with drifting wisps, and its final phase puts every
 * word on a timer.
 */
export const HOLLOW_WRAITH: BossDef = {
  id: "hollow-wraith",
  displayName: "The Hollow Wraith",
  hp: 440,
  scale: 2.0,
  spriteKey: "bossWraith",
  colorHint: "#5fd6e0",
  // Sloppy typing is punished the entire fight.
  gimmicks: [{ id: "scramble" }],
  phases: [
    {
      index: 0,
      name: "Cold Drift",
      endsAtHpFraction: 0.7,
      attackTimerMs: 10500,
      damage: 15,
      usePhrases: false,
      promptPool: [
        "Drift",
        "Hollow",
        "Wisp",
        "Vapor",
        "Silence",
        "Fading",
        "Spectre",
        "Veiled",
      ],
    },
    {
      index: 1,
      name: "Splitting Echoes",
      endsAtHpFraction: 0.4,
      attackTimerMs: 9500,
      damage: 17,
      usePhrases: true,
      gimmicks: [{ id: "multitarget", params: { intervalMs: 5200, maxAlive: 2 } }],
      promptPool: [
        "We are many",
        "Look behind you",
        "Cold hands reach",
        "Echo and echo",
        "No warmth here",
        "The hollow sings",
      ],
    },
    {
      index: 2,
      name: "Hour of Vapor",
      endsAtHpFraction: 0,
      attackTimerMs: 8000,
      damage: 19,
      usePhrases: true,
      gimmicks: [
        { id: "timed", params: { limitMs: 4200, healPct: 0.03 } },
        { id: "multitarget", params: { intervalMs: 6000, maxAlive: 2 } },
      ],
      promptPool: [
        "Faster, faster",
        "Time slips away",
        "Catch me now",
        "The clock is mine",
        "You are too slow",
        "Vanish with me",
      ],
    },
  ],
};

/**
 * The Rusted Bastion — a hulking armored golem. It periodically raises armor and
 * spawns rune wards that must be cleared to break through, then enrages as its
 * shell crumbles.
 */
export const RUSTED_BASTION: BossDef = {
  id: "rusted-bastion",
  displayName: "The Rusted Bastion",
  hp: 560,
  scale: 2.35,
  spriteKey: "bossGolem",
  colorHint: "#b08a3c",
  gimmicks: [
    { id: "shield", params: { reduction: 0.8, intervalMs: 9000, runeCount: 2 } },
  ],
  phases: [
    {
      index: 0,
      name: "Iron Wakes",
      endsAtHpFraction: 0.66,
      attackTimerMs: 11500,
      damage: 16,
      usePhrases: false,
      promptPool: [
        "Rust",
        "Boulder",
        "Anvil",
        "Bastion",
        "Granite",
        "Forged",
        "Mantle",
        "Bulwark",
      ],
    },
    {
      index: 1,
      name: "Ward and Wall",
      endsAtHpFraction: 0.33,
      attackTimerMs: 10500,
      damage: 18,
      usePhrases: true,
      summon: {
        kinds: ["guard"],
        intervalMs: 8000,
        maxAlive: 2,
      },
      promptPool: [
        "Break the wards",
        "Stone does not tire",
        "Hold the gate",
        "Rust never sleeps",
        "The wall endures",
        "Strike the seams",
      ],
    },
    {
      index: 2,
      name: "Crumbling Fury",
      endsAtHpFraction: 0,
      attackTimerMs: 9000,
      damage: 21,
      usePhrases: true,
      gimmicks: [{ id: "enrage", params: { startFraction: 0.33, minFactor: 0.5 } }],
      promptPool: [
        "Tear it down",
        "No more patience",
        "Crush them all",
        "The bastion falls",
        "Iron and ruin",
        "Bury them deep",
      ],
    },
  ],
};

/**
 * All bosses available to the run. The Cursed Knight stays first as Boss 1; the
 * selector draws randomly (without in-run repeats) from this list.
 */
export const BOSS_REGISTRY: BossDef[] = [
  CURSED_KNIGHT,
  HOLLOW_WRAITH,
  RUSTED_BASTION,
];
