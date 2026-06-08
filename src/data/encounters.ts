import type { EncounterDef } from "../types";

/** A boss-stage encounter. The actual boss is chosen at runtime by BossSystem. */
function bossEncounter(name: string, subtitle: string): EncounterDef {
  return {
    id: "boss",
    name,
    subtitle,
    ambient: "boss",
    rewardUpgrade: false,
    waves: [
      {
        delayMs: 600,
        spawns: [{ kind: "boss", laneX: 0.0, startDepth: 1.0 }],
      },
    ],
  };
}

/**
 * Cursed Castle Run — a curated 15-stage descent. A boss guards every fifth
 * stage (5, 10, 15); the others are fights, with an elite gauntlet sprinkled in.
 * The specific boss at each boss stage is selected at random by BossSystem.
 */
export const CASTLE_ENCOUNTERS: EncounterDef[] = [
  {
    id: "enc1",
    name: "The Outer Hall",
    subtitle: "Skeletons stir from the dust",
    ambient: "intro",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 300,
        spawns: [
          { kind: "skeleton", laneX: -0.55, startDepth: 0.9 },
          { kind: "skeleton", laneX: 0.55, startDepth: 0.95, delayMs: 300 },
        ],
      },
      {
        delayMs: 600,
        spawns: [
          { kind: "skeleton", laneX: 0.0, startDepth: 1.0 },
          { kind: "ghoul", laneX: -0.65, startDepth: 0.85, delayMs: 250 },
          { kind: "ghoul", laneX: 0.65, startDepth: 0.85, delayMs: 450 },
          { kind: "glyph", laneX: 0.9, startDepth: 0.7, delayMs: 700 },
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
        delayMs: 300,
        spawns: [
          { kind: "ghoul", laneX: -0.7, startDepth: 0.9 },
          { kind: "ghoul", laneX: 0.7, startDepth: 0.9, delayMs: 150 },
          { kind: "guard", laneX: 0.0, startDepth: 1.0, delayMs: 400 },
        ],
      },
      {
        delayMs: 600,
        spawns: [
          { kind: "skeleton", laneX: -0.8, startDepth: 0.85 },
          { kind: "skeleton", laneX: 0.8, startDepth: 0.85, delayMs: 100 },
          { kind: "ghost", laneX: 0.0, startDepth: 1.0, delayMs: 500 },
        ],
      },
    ],
  },
  {
    id: "enc3",
    name: "The Sunken Stair",
    subtitle: "Cold water laps at broken steps",
    ambient: "deep",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 350,
        spawns: [
          { kind: "ghoul", laneX: -0.6, startDepth: 0.9 },
          { kind: "ghost", laneX: 0.6, startDepth: 0.95, delayMs: 200 },
          { kind: "skeleton", laneX: 0.0, startDepth: 1.0, delayMs: 450 },
        ],
      },
      {
        delayMs: 600,
        spawns: [
          { kind: "guard", laneX: -0.55, startDepth: 0.9 },
          { kind: "ghoul", laneX: 0.7, startDepth: 0.85, delayMs: 300 },
          { kind: "glyph", laneX: -0.9, startDepth: 0.65, delayMs: 200 },
          { kind: "glyph", laneX: 0.95, startDepth: 0.7, delayMs: 550 },
        ],
      },
    ],
  },
  {
    id: "enc4",
    name: "Gallery of Bone",
    subtitle: "The dead are stacked to the ceiling",
    ambient: "deep",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 300,
        spawns: [
          { kind: "skeleton", laneX: -0.85, startDepth: 0.85 },
          { kind: "skeleton", laneX: -0.28, startDepth: 0.95, delayMs: 150 },
          { kind: "skeleton", laneX: 0.85, startDepth: 0.85, delayMs: 300 },
          { kind: "caster", laneX: 0.3, startDepth: 1.25, delayMs: 600 },
        ],
      },
    ],
  },
  bossEncounter("The First Seal", "Something ancient bars the descent"),
  {
    id: "elite",
    name: "The Iron Watch",
    subtitle: "An elite blocks the way",
    ambient: "elite",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 500,
        spawns: [
          { kind: "elite", laneX: 0.0, startDepth: 1.0 },
          { kind: "skeleton", laneX: -0.7, startDepth: 0.9, delayMs: 400 },
          { kind: "skeleton", laneX: 0.7, startDepth: 0.9, delayMs: 600 },
        ],
      },
    ],
  },
  {
    id: "enc6",
    name: "The Whispering Gallery",
    subtitle: "Ghosts and casters await",
    ambient: "deep",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 350,
        spawns: [
          { kind: "ghost", laneX: -0.7, startDepth: 0.9 },
          { kind: "ghost", laneX: 0.7, startDepth: 0.9, delayMs: 200 },
          { kind: "caster", laneX: 0.0, startDepth: 1.05, delayMs: 500 },
          { kind: "glyph", laneX: -0.95, startDepth: 0.6, delayMs: 350 },
          { kind: "glyph", laneX: 0.95, startDepth: 0.6, delayMs: 650 },
        ],
      },
      {
        delayMs: 700,
        spawns: [
          { kind: "ghoul", laneX: -0.8, startDepth: 0.8 },
          { kind: "guard", laneX: 0.0, startDepth: 1.0, delayMs: 300 },
          { kind: "caster", laneX: 0.8, startDepth: 1.0, delayMs: 550 },
        ],
      },
    ],
  },
  {
    id: "enc7",
    name: "The Black Armory",
    subtitle: "Wards of iron and rust",
    ambient: "deep",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 350,
        spawns: [
          { kind: "guard", laneX: -0.7, startDepth: 0.9 },
          { kind: "guard", laneX: 0.7, startDepth: 0.9, delayMs: 250 },
        ],
      },
      {
        delayMs: 650,
        spawns: [
          { kind: "ghoul", laneX: -0.6, startDepth: 0.85 },
          { kind: "ghost", laneX: 0.6, startDepth: 0.95, delayMs: 200 },
          { kind: "caster", laneX: 0.0, startDepth: 1.1, delayMs: 450 },
        ],
      },
    ],
  },
  {
    id: "enc8",
    name: "The Hall of Mourning",
    subtitle: "Sorrow given shape and teeth",
    ambient: "deep",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 350,
        spawns: [
          { kind: "ghost", laneX: -0.8, startDepth: 0.9 },
          { kind: "ghost", laneX: 0.0, startDepth: 0.95, delayMs: 200 },
          { kind: "ghost", laneX: 0.8, startDepth: 0.9, delayMs: 350 },
        ],
      },
      {
        delayMs: 700,
        spawns: [
          { kind: "caster", laneX: -0.5, startDepth: 1.0 },
          { kind: "caster", laneX: 0.5, startDepth: 1.0, delayMs: 300 },
        ],
      },
    ],
  },
  bossEncounter("The Second Seal", "A deeper guardian awakens"),
  {
    id: "enc9",
    name: "The Throne Approach",
    subtitle: "The keep's last guardians make their stand",
    ambient: "elite",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 450,
        spawns: [
          { kind: "elite", laneX: 0.0, startDepth: 1.0 },
          { kind: "ghoul", laneX: -0.75, startDepth: 0.85, delayMs: 350 },
          { kind: "ghoul", laneX: 0.75, startDepth: 0.85, delayMs: 500 },
        ],
      },
      {
        delayMs: 700,
        spawns: [
          { kind: "guard", laneX: -0.55, startDepth: 0.95 },
          { kind: "caster", laneX: 0.55, startDepth: 1.05, delayMs: 250 },
        ],
      },
    ],
  },
  {
    id: "enc11",
    name: "The Shattered Vault",
    subtitle: "Wards crack under their own weight",
    ambient: "deep",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 350,
        spawns: [
          { kind: "guard", laneX: -0.7, startDepth: 0.9 },
          { kind: "caster", laneX: 0.0, startDepth: 1.1, delayMs: 300 },
          { kind: "guard", laneX: 0.7, startDepth: 0.9, delayMs: 550 },
        ],
      },
      {
        delayMs: 700,
        spawns: [
          { kind: "ghoul", laneX: -0.6, startDepth: 0.85 },
          { kind: "ghost", laneX: 0.6, startDepth: 0.9, delayMs: 250 },
          { kind: "glyph", laneX: 0.95, startDepth: 0.65, delayMs: 500 },
        ],
      },
    ],
  },
  {
    id: "enc12",
    name: "Choir of the Damned",
    subtitle: "A hundred voices, one dirge",
    ambient: "deep",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 350,
        spawns: [
          { kind: "ghost", laneX: -0.8, startDepth: 0.9 },
          { kind: "ghost", laneX: 0.0, startDepth: 0.95, delayMs: 200 },
          { kind: "ghost", laneX: 0.8, startDepth: 0.9, delayMs: 400 },
        ],
      },
      {
        delayMs: 700,
        spawns: [
          { kind: "caster", laneX: -0.5, startDepth: 1.05 },
          { kind: "caster", laneX: 0.5, startDepth: 1.05, delayMs: 300 },
          { kind: "ghoul", laneX: 0.0, startDepth: 0.85, delayMs: 150 },
        ],
      },
    ],
  },
  {
    id: "enc13",
    name: "The Last Bastion",
    subtitle: "The keep spends its final guardians",
    ambient: "elite",
    rewardUpgrade: true,
    waves: [
      {
        delayMs: 450,
        spawns: [
          { kind: "elite", laneX: 0.0, startDepth: 1.0 },
          { kind: "guard", laneX: -0.75, startDepth: 0.9, delayMs: 350 },
          { kind: "guard", laneX: 0.75, startDepth: 0.9, delayMs: 550 },
        ],
      },
      {
        delayMs: 750,
        spawns: [
          { kind: "caster", laneX: -0.5, startDepth: 1.05 },
          { kind: "ghost", laneX: 0.5, startDepth: 0.95, delayMs: 300 },
          { kind: "ghoul", laneX: 0.0, startDepth: 0.85, delayMs: 150 },
        ],
      },
    ],
  },
  bossEncounter("The Keep's Heart", "The final guardian will not yield"),
];

/** Back-compat alias — older imports referenced ENCOUNTERS. */
export const ENCOUNTERS = CASTLE_ENCOUNTERS;
