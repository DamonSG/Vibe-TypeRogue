import type { UpgradeDef } from "../types";
import { UPGRADES } from "../data/upgrades";
import type { GameState } from "./GameState";
import { TUNING } from "../data/tuning";

/**
 * UpgradeSystem manages the upgrade pool, deals 3 random choices after each
 * encounter, and applies persistent stat changes (e.g., Glass Quill).
 */
export class UpgradeSystem {
  private remainingPool: UpgradeDef[] = [...UPGRADES];
  /** Most recent set of offered upgrades. */
  lastOffered: UpgradeDef[] = [];

  reset(): void {
    this.remainingPool = [...UPGRADES];
    this.lastOffered = [];
  }

  /** Draw N random distinct upgrades that the player doesn't already own. */
  drawChoices(state: GameState, count = TUNING.upgrade.choices): UpgradeDef[] {
    const owned = new Set(state.ownedUpgrades.map((u) => u.id));
    const available = this.remainingPool.filter((u) => !owned.has(u.id));
    const pool = available.length >= count ? available : [...UPGRADES].filter((u) => !owned.has(u.id));
    const result: UpgradeDef[] = [];
    const copy = [...pool];
    for (let i = 0; i < count && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    this.lastOffered = result;
    return result;
  }

  /** Acquire an upgrade — add to owned list and apply persistent effects. */
  acquire(state: GameState, upgrade: UpgradeDef): void {
    if (state.hasUpgrade(upgrade.id)) return;
    state.ownedUpgrades.push(upgrade);
    this.applyPersistent(state, upgrade);
  }

  /**
   * Compute a "build identity" label from owned upgrades. The most prominent
   * tag wins; ties broken alphabetically.
   */
  buildIdentity(state: GameState): string {
    const tagCounts = new Map<string, number>();
    for (const u of state.ownedUpgrades) {
      for (const t of u.tags ?? []) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
    if (tagCounts.size === 0) return "No Build";
    let topTag = "";
    let topCount = 0;
    for (const [tag, count] of tagCounts) {
      if (count > topCount || (count === topCount && tag < topTag)) {
        topTag = tag;
        topCount = count;
      }
    }
    return TAG_LABELS[topTag] ?? capitalize(topTag);
  }

  private applyPersistent(state: GameState, upgrade: UpgradeDef): void {
    switch (upgrade.id) {
      case "glass_quill":
        state.maxHp = Math.max(20, state.maxHp - 25);
        state.hp = Math.min(state.hp, state.maxHp);
        break;
      // Other upgrades are purely hook-driven.
    }
  }
}

const TAG_LABELS: Record<string, string> = {
  short: "Quick-Strike Scribe",
  long: "Longshot Caster",
  perfect: "Flawless Hand",
  chain: "Chain Conduit",
  combo: "Combo Channeler",
  "combo-slow": "Heavy Inkwright",
  "combo-high": "Overtypist",
  "mistake-soften": "Steady Soul",
  "low-hp": "Panic Cleric",
  "max-hp-down": "Glass Magus",
  "global-dmg": "Damage Dealer",
  heal: "Soul Reaper",
  echo: "Echoist",
  boss: "Boss Breaker",
  shield: "Warded Scribe",
  speed: "Rapid Scribe",
  punctuation: "Curse Splitter",
  flat: "Heavy Hand",
  encounter: "Cautious Opener",
  execute: "Executioner",
};

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
