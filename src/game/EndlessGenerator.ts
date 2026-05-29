import type { EncounterDef, WaveDef } from "../types";

/**
 * Procedural-but-authored encounter source for Endless Crypt. A curated pool of
 * wave-shape templates is cycled across the 100 test levels; per-level depth
 * scaling (HP / damage / approach speed) is applied at spawn time so the base
 * enemy defs stay intact. Every 5th level is a scaled Cursed Knight boss.
 */

interface EndlessTemplate {
  subtitle: string;
  ambient?: "intro" | "deep" | "elite";
  waves: WaveDef[];
}

const ENDLESS_TEMPLATES: EndlessTemplate[] = [
  {
    subtitle: "Bones rattle in the dark",
    waves: [
      {
        delayMs: 600,
        spawns: [
          { kind: "skeleton", laneX: -0.6, startDepth: 0.9 },
          { kind: "skeleton", laneX: 0.6, startDepth: 0.9, delayMs: 400 },
          { kind: "ghoul", laneX: 0.0, startDepth: 1.0, delayMs: 800 },
        ],
      },
    ],
  },
  {
    subtitle: "Hungry things crawl close",
    waves: [
      {
        delayMs: 600,
        spawns: [
          { kind: "ghoul", laneX: -0.7, startDepth: 0.85 },
          { kind: "ghoul", laneX: 0.7, startDepth: 0.85, delayMs: 300 },
          { kind: "ghoul", laneX: 0.0, startDepth: 0.95, delayMs: 700 },
        ],
      },
    ],
  },
  {
    subtitle: "Iron sentinels bar the way",
    ambient: "elite",
    waves: [
      {
        delayMs: 700,
        spawns: [
          { kind: "guard", laneX: -0.55, startDepth: 0.95 },
          { kind: "guard", laneX: 0.55, startDepth: 0.95, delayMs: 500 },
        ],
      },
    ],
  },
  {
    subtitle: "Cold voices from the walls",
    waves: [
      {
        delayMs: 700,
        spawns: [
          { kind: "ghost", laneX: -0.7, startDepth: 0.9 },
          { kind: "ghost", laneX: 0.7, startDepth: 0.9, delayMs: 400 },
          { kind: "caster", laneX: 0.0, startDepth: 1.1, delayMs: 900 },
        ],
      },
    ],
  },
  {
    subtitle: "A mixed horde stirs",
    waves: [
      {
        delayMs: 600,
        spawns: [
          { kind: "skeleton", laneX: -0.75, startDepth: 0.9 },
          { kind: "ghoul", laneX: 0.0, startDepth: 0.95, delayMs: 300 },
          { kind: "ghost", laneX: 0.75, startDepth: 0.9, delayMs: 600 },
        ],
      },
      {
        delayMs: 1200,
        spawns: [
          { kind: "guard", laneX: 0.0, startDepth: 1.0 },
          { kind: "skeleton", laneX: -0.6, startDepth: 0.85, delayMs: 400 },
        ],
      },
    ],
  },
  {
    subtitle: "Casters chant in the gloom",
    waves: [
      {
        delayMs: 800,
        spawns: [
          { kind: "caster", laneX: -0.5, startDepth: 1.05 },
          { kind: "caster", laneX: 0.5, startDepth: 1.05, delayMs: 600 },
          { kind: "ghoul", laneX: 0.0, startDepth: 0.85, delayMs: 200 },
        ],
      },
    ],
  },
  {
    subtitle: "An elite leads the dead",
    ambient: "elite",
    waves: [
      {
        delayMs: 900,
        spawns: [
          { kind: "elite", laneX: 0.0, startDepth: 1.0 },
          { kind: "skeleton", laneX: -0.7, startDepth: 0.9, delayMs: 700 },
          { kind: "skeleton", laneX: 0.7, startDepth: 0.9, delayMs: 1000 },
        ],
      },
    ],
  },
  {
    subtitle: "Skeletons without number",
    waves: [
      {
        delayMs: 500,
        spawns: [
          { kind: "skeleton", laneX: -0.8, startDepth: 0.9 },
          { kind: "skeleton", laneX: -0.27, startDepth: 0.95, delayMs: 250 },
          { kind: "skeleton", laneX: 0.27, startDepth: 0.95, delayMs: 500 },
          { kind: "skeleton", laneX: 0.8, startDepth: 0.9, delayMs: 750 },
        ],
      },
    ],
  },
  {
    subtitle: "Wraiths drift through stone",
    waves: [
      {
        delayMs: 700,
        spawns: [
          { kind: "ghost", laneX: -0.8, startDepth: 0.9 },
          { kind: "ghost", laneX: 0.0, startDepth: 0.95, delayMs: 350 },
          { kind: "ghost", laneX: 0.8, startDepth: 0.9, delayMs: 700 },
        ],
      },
    ],
  },
  {
    subtitle: "Guard and ghoul in lockstep",
    waves: [
      {
        delayMs: 700,
        spawns: [
          { kind: "guard", laneX: -0.6, startDepth: 0.95 },
          { kind: "ghoul", laneX: 0.6, startDepth: 0.85, delayMs: 400 },
        ],
      },
      {
        delayMs: 1200,
        spawns: [
          { kind: "ghost", laneX: 0.0, startDepth: 1.0 },
          { kind: "ghoul", laneX: -0.7, startDepth: 0.85, delayMs: 500 },
        ],
      },
    ],
  },
  {
    subtitle: "The deep grows teeth",
    waves: [
      {
        delayMs: 600,
        spawns: [
          { kind: "ghoul", laneX: -0.75, startDepth: 0.85 },
          { kind: "skeleton", laneX: 0.0, startDepth: 0.95, delayMs: 300 },
          { kind: "caster", laneX: 0.75, startDepth: 1.1, delayMs: 700 },
        ],
      },
      {
        delayMs: 1200,
        spawns: [
          { kind: "guard", laneX: 0.0, startDepth: 1.0 },
          { kind: "ghost", laneX: -0.6, startDepth: 0.9, delayMs: 400 },
        ],
      },
    ],
  },
  {
    subtitle: "Two elites, one path",
    ambient: "elite",
    waves: [
      {
        delayMs: 1000,
        spawns: [
          { kind: "elite", laneX: -0.4, startDepth: 1.0 },
          { kind: "elite", laneX: 0.4, startDepth: 1.0, delayMs: 900 },
        ],
      },
    ],
  },
  {
    subtitle: "Whispers and rust",
    waves: [
      {
        delayMs: 700,
        spawns: [
          { kind: "caster", laneX: 0.0, startDepth: 1.1 },
          { kind: "guard", laneX: -0.6, startDepth: 0.95, delayMs: 400 },
          { kind: "guard", laneX: 0.6, startDepth: 0.95, delayMs: 800 },
        ],
      },
    ],
  },
  {
    subtitle: "Restless and many",
    waves: [
      {
        delayMs: 600,
        spawns: [
          { kind: "skeleton", laneX: -0.7, startDepth: 0.9 },
          { kind: "ghoul", laneX: 0.7, startDepth: 0.85, delayMs: 300 },
        ],
      },
      {
        delayMs: 1100,
        spawns: [
          { kind: "ghost", laneX: -0.5, startDepth: 0.95 },
          { kind: "caster", laneX: 0.5, startDepth: 1.1, delayMs: 500 },
          { kind: "skeleton", laneX: 0.0, startDepth: 0.9, delayMs: 200 },
        ],
      },
    ],
  },
  {
    subtitle: "The crypt closes in",
    waves: [
      {
        delayMs: 600,
        spawns: [
          { kind: "ghoul", laneX: -0.8, startDepth: 0.85 },
          { kind: "ghoul", laneX: -0.27, startDepth: 0.9, delayMs: 250 },
          { kind: "ghoul", laneX: 0.27, startDepth: 0.9, delayMs: 500 },
          { kind: "guard", laneX: 0.8, startDepth: 1.0, delayMs: 800 },
        ],
      },
    ],
  },
  {
    subtitle: "Old magic wakes",
    waves: [
      {
        delayMs: 800,
        spawns: [
          { kind: "caster", laneX: -0.6, startDepth: 1.1 },
          { kind: "ghost", laneX: 0.0, startDepth: 0.95, delayMs: 400 },
          { kind: "caster", laneX: 0.6, startDepth: 1.1, delayMs: 800 },
        ],
      },
    ],
  },
  {
    subtitle: "A warband of the fallen",
    ambient: "elite",
    waves: [
      {
        delayMs: 800,
        spawns: [
          { kind: "elite", laneX: 0.0, startDepth: 1.0 },
          { kind: "guard", laneX: -0.7, startDepth: 0.95, delayMs: 600 },
          { kind: "ghoul", laneX: 0.7, startDepth: 0.85, delayMs: 1000 },
        ],
      },
    ],
  },
  {
    subtitle: "Everything at once",
    waves: [
      {
        delayMs: 600,
        spawns: [
          { kind: "skeleton", laneX: -0.8, startDepth: 0.9 },
          { kind: "ghost", laneX: 0.8, startDepth: 0.9, delayMs: 300 },
        ],
      },
      {
        delayMs: 1100,
        spawns: [
          { kind: "ghoul", laneX: -0.5, startDepth: 0.85 },
          { kind: "guard", laneX: 0.0, startDepth: 1.0, delayMs: 300 },
          { kind: "caster", laneX: 0.5, startDepth: 1.1, delayMs: 700 },
        ],
      },
    ],
  },
];

/** True when this 1-based level is a boss checkpoint (every 5th level). */
export function isEndlessBossLevel(level: number): boolean {
  return level % 5 === 0;
}

/** Build the EncounterDef for a given 1-based Endless level. */
export function generateEndlessLevel(level: number): EncounterDef {
  if (isEndlessBossLevel(level)) {
    const tier = level / 5;
    return {
      id: "boss",
      name: "Crypt Warden",
      subtitle: `Tier ${tier} guardian of the deep`,
      ambient: "boss",
      rewardUpgrade: false,
      waves: [
        {
          delayMs: 1200,
          spawns: [{ kind: "boss", laneX: 0.0, startDepth: 1.0 }],
        },
      ],
    };
  }
  const t =
    ENDLESS_TEMPLATES[(level * 5 + 2) % ENDLESS_TEMPLATES.length];
  return {
    id: `endless-${level}`,
    name: `Crypt Depth ${level}`,
    subtitle: t.subtitle,
    ambient: t.ambient ?? "deep",
    rewardUpgrade: true,
    waves: t.waves,
  };
}

/** Per-level stat multipliers applied to non-boss enemies at spawn time. */
export function endlessEnemyScale(level: number): {
  hp: number;
  damage: number;
  speed: number;
} {
  const n = Math.max(0, level - 1);
  return {
    hp: 1 + n * 0.05,
    damage: 1 + n * 0.03,
    speed: 1 + n * 0.012,
  };
}

/** Boss HP/damage multiplier for the boss at a given Endless level. */
export function endlessBossScale(level: number): number {
  const tier = Math.max(1, Math.floor(level / 5));
  return 1 + (tier - 1) * 0.5;
}
