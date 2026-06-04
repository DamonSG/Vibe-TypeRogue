import type { EncounterDef } from "../types";

export const ENCOUNTERS: EncounterDef[] = [
  {
    id: "enc1",
    name: "The Outer Hall",
    subtitle: "Skeletons stir from the dust",
    ambient: "intro",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 600,
        spawns: [
          { kind: "skeleton", laneX: -0.55, startDepth: 0.9 },
          { kind: "skeleton", laneX: 0.55, startDepth: 0.95, delayMs: 600 },
        ],
      },
      {
        delayMs: 1200,
        spawns: [
          { kind: "skeleton", laneX: 0.0, startDepth: 1.0 },
          { kind: "ghoul", laneX: -0.65, startDepth: 0.85, delayMs: 500 },
          { kind: "ghoul", laneX: 0.65, startDepth: 0.85, delayMs: 900 },
        ],
      },
    ],
  },
  {
    id: "enc2",
    name: "Cracked Atrium",
    subtitle: "Old guards refuse to fall",
    ambient: "deep",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 600,
        spawns: [
          { kind: "ghoul", laneX: -0.7, startDepth: 0.9 },
          { kind: "ghoul", laneX: 0.7, startDepth: 0.9, delayMs: 300 },
          { kind: "guard", laneX: 0.0, startDepth: 1.0, delayMs: 800 },
        ],
      },
      {
        delayMs: 1200,
        spawns: [
          { kind: "skeleton", laneX: -0.8, startDepth: 0.85 },
          { kind: "skeleton", laneX: 0.8, startDepth: 0.85, delayMs: 200 },
          { kind: "ghost", laneX: 0.0, startDepth: 1.0, delayMs: 1000 },
        ],
      },
    ],
  },
  {
    id: "elite",
    name: "The Iron Watch",
    subtitle: "An elite blocks the way",
    ambient: "elite",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 1000,
        spawns: [
          { kind: "elite", laneX: 0.0, startDepth: 1.0 },
          { kind: "skeleton", laneX: -0.7, startDepth: 0.9, delayMs: 800 },
          { kind: "skeleton", laneX: 0.7, startDepth: 0.9, delayMs: 1200 },
        ],
      },
    ],
  },
  {
    id: "enc3",
    name: "The Whispering Gallery",
    subtitle: "Ghosts and casters await",
    ambient: "deep",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 700,
        spawns: [
          { kind: "ghost", laneX: -0.7, startDepth: 0.9 },
          { kind: "ghost", laneX: 0.7, startDepth: 0.9, delayMs: 400 },
          { kind: "caster", laneX: 0.0, startDepth: 1.05, delayMs: 1000 },
        ],
      },
      {
        delayMs: 1400,
        spawns: [
          { kind: "ghoul", laneX: -0.8, startDepth: 0.8 },
          { kind: "guard", laneX: 0.0, startDepth: 1.0, delayMs: 600 },
          { kind: "caster", laneX: 0.8, startDepth: 1.0, delayMs: 1100 },
        ],
      },
    ],
  },
  {
    id: "boss",
    name: "The Cursed Knight",
    subtitle: "The keep's heart will not yield",
    ambient: "boss",
    rewardUpgrade: false,
    waves: [
      {
        delayMs: 1200,
        spawns: [{ kind: "boss", laneX: 0.0, startDepth: 1.0 }],
      },
    ],
  },
];
