/**
 * Themed word pools per enemy type. Prompts are stored in display form
 * (with punctuation and natural casing). The TypingSystem normalizes them
 * for matching (lowercase, preserving spaces/punctuation).
 */

export const WORD_POOLS = {
  skeleton: [
    "Bone",
    "Rust",
    "Skull",
    "Grave",
    "Tomb",
    "Dust",
    "Rib",
    "Claw",
    "Dread",
    "Marrow",
    "Hollow",
    "Rattle",
    "Femur",
    "Spine",
    "Crypt",
    "Ashen",
    "Withered",
    "Knell",
    "Barrow",
    "Ossuary",
  ],

  ghoul: [
    "Bite",
    "Crawl",
    "Fang",
    "Rot",
    "Gnash",
    "Drool",
    "Snarl",
    "Feast",
    "Shred",
    "Lurk",
    "Creep",
    "Stalk",
    "Maw",
    "Wretch",
    "Viscera",
    "Famine",
    "Scuttle",
    "Gnarled",
    "Putrid",
    "Talon",
  ],

  guard: [
    "Guard",
    "Shield",
    "Iron",
    "Broken shield",
    "Halberd",
    "Buckler",
    "Gauntlet",
    "Watchman",
    "Iron grip",
    "Spear wall",
    "Stone visage",
    "The watch",
    "Rusted helm",
    "Old armor",
    "The bulwark",
    "Ironclad",
  ],

  ghost: [
    "Vanish",
    "Whisper",
    "Shadow",
    "Silent",
    "Drift",
    "Linger",
    "Fade",
    "Haunt",
    "Wraith",
    "Spectre",
    "Ethereal",
    "Wisp",
    "Phantom",
    "Mourning",
    "Veil",
    "Echo",
    "Memory",
    "Forgotten",
    "Absent",
    "Weightless",
  ],

  caster: [
    "Don't blink",
    "Rise, again",
    "Curse you",
    "Dark spell",
    "The void answers",
    "Speak no name",
    "Blood, ink, salt",
    "I remember",
    "Lights out!",
    "From below",
    "Hush, child",
    "You are seen",
    "The seal breaks",
    "Old words wake",
    "Not yet, not yet",
    "Between the stones",
  ],

  elite: [
    "Black armor",
    "Rusted blade",
    "Kneel, mortal",
    "Castle guard",
    "The king's hand",
    "The iron oath",
    "Long dead crown",
    "Obsidian gauntlet",
    "Old battlefield",
    "The silver blade",
    "Burnt banners",
    "Wolf of the keep",
    "Headsman's hood",
    "Fallen marshal",
    "Iron, iron, iron",
  ],

  /**
   * Boss prompts are organized per phase in boss.ts; this pool is fallback.
   */
  boss: [
    "Iron",
    "Shield",
    "Rusted blade",
    "Kneel, mortal",
    "The blade remembers",
    "Don't look away",
    "The curse takes hold",
    "I was a king",
    "The throne is mine",
    "All bow!",
  ],
} as const;

export type WordPoolKey = keyof typeof WORD_POOLS;

/**
 * Normalize a prompt for typing comparison.
 * Case-preserving: only normalizes smart quotes and whitespace so the matcher
 * compares exactly what the player typed (case included).
 */
export function normalizePrompt(s: string): string {
  return s
    .replace(/\u2019/g, "'") // smart quote → straight
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pick a random prompt from a pool, optionally avoiding a recent one.
 */
export function pickPrompt(pool: readonly string[], avoid?: string): string {
  if (pool.length === 0) return "...";
  if (pool.length === 1) return pool[0];
  let attempts = 0;
  let pick = pool[Math.floor(Math.random() * pool.length)];
  while (avoid && pick === avoid && attempts < 4) {
    pick = pool[Math.floor(Math.random() * pool.length)];
    attempts++;
  }
  return pick;
}

/**
 * Pick a prompt that is unique among the given existing prompts (case-insensitive),
 * with a few retries before giving up.
 */
export function pickUniquePrompt(
  pool: readonly string[],
  existing: readonly string[],
): string {
  const taken = new Set(existing.map((p) => normalizePrompt(p)));
  for (let i = 0; i < 12; i++) {
    const candidate = pickPrompt(pool);
    if (!taken.has(normalizePrompt(candidate))) return candidate;
  }
  return pickPrompt(pool);
}

/**
 * Pick a prompt whose first letter does not collide with any of the existing
 * prompts' first letters. Falls back to pickUniquePrompt if no such option exists.
 */
export function pickPromptDistinctFirstLetter(
  pool: readonly string[],
  existing: readonly string[],
): string {
  const takenFirst = new Set(
    existing.map((p) => normalizePrompt(p).charAt(0)),
  );
  const takenFull = new Set(existing.map((p) => normalizePrompt(p)));
  const filtered = pool.filter(
    (p) =>
      !takenFirst.has(normalizePrompt(p).charAt(0)) &&
      !takenFull.has(normalizePrompt(p)),
  );
  if (filtered.length > 0) return pickPrompt(filtered);
  return pickUniquePrompt(pool, existing);
}
