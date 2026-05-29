/**
 * StatsStore — persists player records and lifetime stats to localStorage.
 * Local-only (no online leaderboards). Mirrors the safe load/save pattern used
 * by SettingsStore.
 */

export interface GlobalStats {
  totalRuns: number;
  totalWordsTyped: number;
  totalEnemiesDefeated: number;
  totalBossesDefeated: number;
  bestWpm: number;
  /** Sum + count let us derive an average WPM across runs. */
  wpmSum: number;
  wpmCount: number;
  totalPlayTimeMs: number;
}

export interface CastleStats {
  bestStage: number;
  runs: number;
  deaths: number;
  bestWpm: number;
  /** Fastest full clear (victory) in ms, 0 = none. */
  fastestMs: number;
}

export interface EndlessStats {
  highestLevel: number;
  bossesDefeated: number;
  furthestBoss: number;
  bestWpm: number;
  runs: number;
}

export interface FortyWordsStats {
  /** Best (lowest) completion time in ms, 0 = none. */
  bestTimeMs: number;
  bestWpm: number;
  attempts: number;
  timeSum: number;
  lastTimeMs: number;
}

export interface StatsData {
  version: number;
  global: GlobalStats;
  castle: CastleStats;
  endless: EndlessStats;
  fortyWords: FortyWordsStats;
}

const STORAGE_KEY = "typerogue.stats";
const VERSION = 1;

function defaults(): StatsData {
  return {
    version: VERSION,
    global: {
      totalRuns: 0,
      totalWordsTyped: 0,
      totalEnemiesDefeated: 0,
      totalBossesDefeated: 0,
      bestWpm: 0,
      wpmSum: 0,
      wpmCount: 0,
      totalPlayTimeMs: 0,
    },
    castle: { bestStage: 0, runs: 0, deaths: 0, bestWpm: 0, fastestMs: 0 },
    endless: {
      highestLevel: 0,
      bossesDefeated: 0,
      furthestBoss: 0,
      bestWpm: 0,
      runs: 0,
    },
    fortyWords: {
      bestTimeMs: 0,
      bestWpm: 0,
      attempts: 0,
      timeSum: 0,
      lastTimeMs: 0,
    },
  };
}

export class StatsStore {
  private data: StatsData;

  constructor() {
    this.data = this.load();
  }

  get(): Readonly<StatsData> {
    return this.data;
  }

  /** Average WPM across all recorded runs (0 if none). */
  averageWpm(): number {
    const g = this.data.global;
    if (g.wpmCount <= 0) return 0;
    return Math.round(g.wpmSum / g.wpmCount);
  }

  /** Average 40 Words completion time in ms (0 if none). */
  fortyWordsAverageMs(): number {
    const f = this.data.fortyWords;
    if (f.attempts <= 0) return 0;
    return Math.round(f.timeSum / f.attempts);
  }

  /** Record per-run global stats (called for every finished run). */
  recordGlobalRun(p: {
    wordsTyped: number;
    enemiesDefeated: number;
    bossesDefeated: number;
    wpm: number;
    playTimeMs: number;
  }): void {
    const g = this.data.global;
    g.totalRuns++;
    g.totalWordsTyped += Math.max(0, Math.round(p.wordsTyped));
    g.totalEnemiesDefeated += Math.max(0, Math.round(p.enemiesDefeated));
    g.totalBossesDefeated += Math.max(0, Math.round(p.bossesDefeated));
    g.totalPlayTimeMs += Math.max(0, Math.round(p.playTimeMs));
    if (p.wpm > 0) {
      g.wpmSum += p.wpm;
      g.wpmCount++;
      if (p.wpm > g.bestWpm) g.bestWpm = p.wpm;
    }
    this.save();
  }

  recordCastle(p: {
    stageReached: number;
    wpm: number;
    completed: boolean;
    timeMs: number;
  }): void {
    const c = this.data.castle;
    c.runs++;
    if (!p.completed) c.deaths++;
    if (p.stageReached > c.bestStage) c.bestStage = p.stageReached;
    if (p.wpm > c.bestWpm) c.bestWpm = p.wpm;
    if (p.completed && p.timeMs > 0) {
      if (c.fastestMs === 0 || p.timeMs < c.fastestMs) c.fastestMs = p.timeMs;
    }
    this.save();
  }

  recordEndless(p: {
    levelReached: number;
    bossesDefeated: number;
    furthestBoss: number;
    wpm: number;
  }): void {
    const e = this.data.endless;
    e.runs++;
    if (p.levelReached > e.highestLevel) e.highestLevel = p.levelReached;
    e.bossesDefeated += Math.max(0, Math.round(p.bossesDefeated));
    if (p.furthestBoss > e.furthestBoss) e.furthestBoss = p.furthestBoss;
    if (p.wpm > e.bestWpm) e.bestWpm = p.wpm;
    this.save();
  }

  /** Record a completed 40 Words run. Returns whether it set a new best time. */
  recordFortyWords(p: { timeMs: number; wpm: number }): {
    newRecord: boolean;
    bestTimeMs: number;
  } {
    const f = this.data.fortyWords;
    f.attempts++;
    f.lastTimeMs = p.timeMs;
    f.timeSum += Math.max(0, p.timeMs);
    if (p.wpm > f.bestWpm) f.bestWpm = p.wpm;
    let newRecord = false;
    if (f.bestTimeMs === 0 || p.timeMs < f.bestTimeMs) {
      f.bestTimeMs = p.timeMs;
      newRecord = true;
    }
    this.save();
    return { newRecord, bestTimeMs: f.bestTimeMs };
  }

  /** Wipe all stored records. */
  reset(): void {
    this.data = defaults();
    this.save();
  }

  private load(): StatsData {
    const base = defaults();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<StatsData>;
      return {
        version: VERSION,
        global: { ...base.global, ...(parsed.global ?? {}) },
        castle: { ...base.castle, ...(parsed.castle ?? {}) },
        endless: { ...base.endless, ...(parsed.endless ?? {}) },
        fortyWords: { ...base.fortyWords, ...(parsed.fortyWords ?? {}) },
      };
    } catch {
      return base;
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* localStorage unavailable (private mode) — ignore. */
    }
  }
}
