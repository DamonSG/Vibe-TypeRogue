/**
 * Word pool + generator for the 40 Words time-attack mode. Single words only
 * (no sentences, no punctuation-heavy entries), mixing short reaction words
 * with longer challenge words for a fair, readable speedrun.
 */

const SHORT_WORDS = [
  "ash",
  "bone",
  "dusk",
  "raw",
  "vow",
  "hex",
  "rot",
  "fog",
  "ash",
  "ice",
  "ember",
  "rune",
  "void",
  "moth",
  "claw",
  "fang",
  "dirge",
  "mire",
  "pyre",
  "gore",
  "grim",
  "vile",
  "wail",
  "moan",
  "dread",
  "gloom",
  "wraith",
  "skull",
  "grave",
  "tomb",
  "crypt",
  "blade",
  "torch",
  "raven",
  "flame",
  "spell",
  "storm",
  "blood",
  "knight",
  "curse",
];

const COMMON = [
  "shadow",
  "silver",
  "hollow",
  "throne",
  "candle",
  "dagger",
  "lantern",
  "whisper",
  "monster",
  "haunted",
  "phantom",
  "midnight",
  "twilight",
  "cathedral",
  "ancient",
  "forsaken",
  "withered",
  "crumble",
  "mourning",
  "lament",
  "ember",
  "ritual",
  "relic",
  "shroud",
  "marrow",
  "gallows",
  "cinder",
  "venom",
  "plague",
  "tremor",
];

const GOTHIC = [
  "sepulcher",
  "obsidian",
  "gargoyle",
  "chandelier",
  "tombstone",
  "graveyard",
  "moonlight",
  "nightfall",
  "wickedness",
  "darkness",
  "spectral",
  "ethereal",
  "necropolis",
  "mausoleum",
  "catacomb",
  "abyssal",
  "spectre",
  "banshee",
  "revenant",
  "wretched",
];

const COMBAT = [
  "strike",
  "parry",
  "shatter",
  "cleave",
  "impale",
  "rampart",
  "halberd",
  "gauntlet",
  "buckler",
  "vanguard",
  "onslaught",
  "warhammer",
  "bloodlust",
  "berserk",
  "vengeance",
  "execute",
  "slaughter",
  "fracture",
  "rend",
  "skewer",
];

const MAGIC = [
  "conjure",
  "enchant",
  "incantation",
  "sorcery",
  "warlock",
  "talisman",
  "grimoire",
  "hexcraft",
  "summon",
  "binding",
  "wither",
  "malice",
  "oblivion",
  "eclipse",
  "nightmare",
  "soulfire",
  "doombolt",
  "necromancy",
  "anathema",
  "maleficent",
];

/** Flattened, de-duplicated master pool. */
const MASTER_POOL: string[] = dedupe([
  ...SHORT_WORDS,
  ...COMMON,
  ...GOTHIC,
  ...COMBAT,
  ...MAGIC,
]);

/**
 * Generate a fresh list of `count` words. Avoids repeating any word within the
 * run, and avoids placing two same-first-letter words back to back so the
 * sequence reads cleanly.
 */
export function generateFortyWords(count = 40): string[] {
  const pool = shuffle(MASTER_POOL.slice());
  const result: string[] = [];
  for (const word of pool) {
    if (result.length >= count) break;
    const prev = result[result.length - 1];
    if (prev && prev.charAt(0) === word.charAt(0)) continue;
    result.push(word);
  }
  // If filtering left us short (rare), top up allowing first-letter repeats.
  if (result.length < count) {
    for (const word of pool) {
      if (result.length >= count) break;
      if (!result.includes(word)) result.push(word);
    }
  }
  // If the pool itself is smaller than count, allow controlled repeats.
  let guard = 0;
  while (result.length < count && guard < count * 4) {
    guard++;
    const word = pool[Math.floor(Math.random() * pool.length)];
    if (result[result.length - 1] === word) continue;
    result.push(word);
  }
  return result.slice(0, count);
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.map((w) => w.toLowerCase())));
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
