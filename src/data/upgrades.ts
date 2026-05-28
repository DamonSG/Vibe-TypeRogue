import type { UpgradeDef, CombatContext } from "../types";

/**
 * Helpers used inside upgrade hooks.
 */
function charCount(word: string): number {
  return word.replace(/\s+/g, "").length;
}

function hasPunctuation(word: string): boolean {
  return /[,!?'"\-:;]/.test(word);
}

function firstLetter(word: string): string {
  const trimmed = word.trim().toLowerCase();
  return trimmed.charAt(0);
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: "quick_draw",
    name: "Quick Draw",
    description: "Words of 5 or fewer letters deal +35% damage.",
    flavor: "First letter, first blood.",
    category: "offense",
    tags: ["short"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.event.type !== "wordComplete") return;
        if (charCount(ctx.event.word) <= 5) {
          ctx.damageMultiplier *= 1.35;
        }
      },
    },
  },
  {
    id: "longshot",
    name: "Longshot",
    description:
      "Words with 7+ letters deal +50% damage and chain to one nearby enemy.",
    flavor: "Patience is its own weapon.",
    category: "offense",
    tags: ["long"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.event.type !== "wordComplete") return;
        if (charCount(ctx.event.word) >= 7) {
          ctx.damageMultiplier *= 1.5;
          ctx.chainEnemies = Math.max(ctx.chainEnemies, 1);
          ctx.chainDamage = Math.max(ctx.chainDamage, 12);
        }
      },
    },
  },
  {
    id: "perfect_rhythm",
    name: "Perfect Rhythm",
    description: "Each word typed with no mistakes grants 4 shield.",
    flavor: "Clean strikes leave no opening.",
    category: "defense",
    tags: ["perfect"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.event.type !== "wordComplete") return;
        if (ctx.event.perfect) ctx.shieldGain += 4;
      },
    },
  },
  {
    id: "arc_letter",
    name: "Arc Letter",
    description: "Killing an enemy zaps a nearby enemy for 15 damage.",
    flavor: "Sparks find their way.",
    category: "offense",
    tags: ["chain"],
    hooks: {
      kill: (ctx: CombatContext) => {
        ctx.chainEnemies = Math.max(ctx.chainEnemies, 1);
        ctx.chainDamage = Math.max(ctx.chainDamage, 15);
      },
    },
  },
  {
    id: "chain_focus",
    name: "Chain Focus",
    description:
      "Every 5 combo, your next word deals +40% damage to the nearest enemy.",
    flavor: "Five beats, then thunder.",
    category: "combo",
    tags: ["combo"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.event.type !== "wordComplete") return;
        const combo = ctx.state.combo;
        if (combo > 0 && combo % 5 === 0) {
          ctx.damageMultiplier *= 1.4;
        }
      },
    },
  },
  {
    id: "steady_hands",
    name: "Steady Hands",
    description:
      "Mistakes only reduce your combo by half instead of breaking it.",
    flavor: "Tremor, not collapse.",
    category: "utility",
    tags: ["mistake-soften"],
    hooks: {
      // Marker only — CombatSystem checks `hasUpgrade('steady_hands')` directly
      // when applying mistake penalty, so no hook body needed.
      mistake: () => {
        /* no-op marker */
      },
    },
  },
  {
    id: "panic_cast",
    name: "Panic Cast",
    description: "Deal +45% damage while below 30% HP.",
    flavor: "Cornered minds cut deepest.",
    category: "risk",
    tags: ["low-hp"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.state.hp / Math.max(1, ctx.state.maxHp) < 0.3) {
          ctx.damageMultiplier *= 1.45;
        }
      },
    },
  },
  {
    id: "clean_cut",
    name: "Clean Cut",
    description: "Perfect-word kills grant +2 combo.",
    flavor: "Decisive and untouched.",
    category: "combo",
    tags: ["perfect", "combo"],
    hooks: {
      kill: (ctx: CombatContext) => {
        if (ctx.event.type !== "kill") return;
        if (ctx.event.perfect) ctx.comboBonus += 2;
      },
    },
  },
  {
    id: "heavy_ink",
    name: "Heavy Ink",
    description:
      "Completed words deal +25% damage, but combo only builds every other word.",
    flavor: "Each stroke costs you breath.",
    category: "offense",
    tags: ["combo-slow"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        ctx.damageMultiplier *= 1.25;
        // Every other word skips combo gain. wordsTyped is incremented BEFORE
        // hooks run, so even values = block combo on this word.
        if (ctx.state.wordsTyped % 2 === 0) {
          ctx.comboBonus -= 1;
        }
      },
    },
  },
  {
    id: "glass_quill",
    name: "Glass Quill",
    description: "+25% damage on every word, but max HP is reduced by 25.",
    flavor: "A brittle gift.",
    category: "risk",
    tags: ["max-hp-down", "global-dmg"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        ctx.damageMultiplier *= 1.25;
      },
    },
    // Glass Quill is applied as a persistent state change by UpgradeSystem
    // when it sees this id (lowers maxHp). See UpgradeSystem.applyPersistent.
  },
  {
    id: "soul_refund",
    name: "Soul Refund",
    description: "Killing an enemy has a 25% chance to restore 3 HP.",
    flavor: "Their breath, yours now.",
    category: "defense",
    tags: ["heal"],
    hooks: {
      kill: (ctx: CombatContext) => {
        if (Math.random() < 0.25) ctx.heal += 3;
      },
    },
  },
  {
    id: "echo_type",
    name: "Echo Type",
    description:
      "Words sharing a first letter with the previous word deal +25% damage (stacks up to +75%).",
    flavor: "Repeat the rune. The rune repeats you.",
    category: "combo",
    tags: ["echo"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.event.type !== "wordComplete") return;
        const chain = ctx.state.echoChainCount;
        if (chain >= 1) {
          ctx.damageMultiplier *= 1 + 0.25 * Math.min(3, chain);
        }
      },
    },
  },
  {
    id: "boss_breaker",
    name: "Boss Breaker",
    description: "Deal +40% damage to elites and bosses.",
    flavor: "Larger prey, larger hole.",
    category: "offense",
    tags: ["boss"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.event.type !== "wordComplete") return;
        const k = ctx.event.enemy.def.kind;
        if (k === "elite" || k === "boss") ctx.damageMultiplier *= 1.4;
      },
    },
  },
  {
    id: "shield_script",
    name: "Shield Script",
    description: "Every 3 perfect words, gain 8 shield.",
    flavor: "Words can stand between you and the blade.",
    category: "defense",
    tags: ["perfect", "shield"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.event.type !== "wordComplete") return;
        if (ctx.event.perfect && ctx.state.perfectWordsSinceBarrier >= 3) {
          ctx.shieldGain += 8;
        }
      },
    },
  },
  {
    id: "rapid_scribe",
    name: "Rapid Scribe",
    description: "Words completed in under 1.5 seconds deal +30% damage.",
    flavor: "Speed is its own spell.",
    category: "offense",
    tags: ["speed"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.event.type !== "wordComplete") return;
        if (ctx.event.durationMs < 1500) ctx.damageMultiplier *= 1.3;
      },
    },
  },
  {
    id: "curse_splitter",
    name: "Curse Splitter",
    description: "Prompts containing punctuation deal +60% damage.",
    flavor: "Comma, blood, comma.",
    category: "offense",
    tags: ["punctuation"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.event.type !== "wordComplete") return;
        if (hasPunctuation(ctx.event.word)) ctx.damageMultiplier *= 1.6;
      },
    },
  },
  {
    id: "last_letter",
    name: "Last Letter",
    description: "Completing a word deals a bonus +10 flat impact damage.",
    flavor: "Finish what you started.",
    category: "offense",
    tags: ["flat"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        ctx.flatBonusDamage += 10;
      },
    },
  },
  {
    id: "overtype",
    name: "Overtype",
    description: "While combo is above 10, all damage is increased by 20%.",
    flavor: "The pen finds rhythm and refuses to stop.",
    category: "combo",
    tags: ["combo-high"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.state.combo > 10) ctx.damageMultiplier *= 1.2;
      },
    },
  },
  {
    id: "safe_start",
    name: "Safe Start",
    description: "Begin each encounter with 8 shield.",
    flavor: "A breath before the storm.",
    category: "defense",
    tags: ["encounter"],
    hooks: {
      encounterStart: (ctx: CombatContext) => {
        ctx.shieldGain += 8;
      },
    },
  },
  {
    id: "execution_mark",
    name: "Execution Mark",
    description: "Enemies below 30% HP take +60% damage from your words.",
    flavor: "Finish them.",
    category: "offense",
    tags: ["execute"],
    hooks: {
      wordComplete: (ctx: CombatContext) => {
        if (ctx.event.type !== "wordComplete") return;
        const e = ctx.event.enemy;
        if (e.hp / Math.max(1, e.maxHp) < 0.3) ctx.damageMultiplier *= 1.6;
      },
    },
  },
];

export const UPGRADES_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));
