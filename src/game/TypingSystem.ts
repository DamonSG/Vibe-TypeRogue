import type { Enemy } from "../types";

export type TypingResult =
  | {
      type: "letter";
      char: string;
      currentInput: string;
      candidates: Enemy[];
      bestTarget: Enemy;
    }
  | {
      type: "wordComplete";
      enemy: Enemy;
      word: string;
      perfect: boolean;
      durationMs: number;
    }
  | {
      type: "mistake";
      expected: string;
      got: string;
      nearestEnemy: Enemy | null;
    };

/**
 * TypingSystem owns the player's current input buffer and resolves it
 * against active enemies on each keypress.
 *
 * Behavior:
 * - Input is only extended when at least one enemy's prompt starts with the new buffer.
 * - On mismatch, the input is NOT extended (so the player never gets stuck) and a mistake event fires.
 * - Backspace shortens the buffer; pressing Escape clears it.
 * - The "best target" among candidates is the one whose prompt is closest to completion.
 */
export class TypingSystem {
  private currentInput = "";
  private inputStartedAt = 0;
  private hadMistakeOnCurrent = false;

  /** External components can read live input for the input bar. */
  getCurrentInput(): string {
    return this.currentInput;
  }

  /** Used by UI to highlight letters on each card. */
  getCandidates(enemies: Enemy[]): Enemy[] {
    if (this.currentInput.length === 0) return [];
    const input = this.currentInput;
    return enemies.filter(
      (e) => e.alive && !e.dying && e.promptMatch.startsWith(input),
    );
  }

  /** Best target among current candidates: shortest remaining (most progressed). */
  getBestTarget(enemies: Enemy[]): Enemy | null {
    const cands = this.getCandidates(enemies);
    if (cands.length === 0) return null;
    let best = cands[0];
    for (let i = 1; i < cands.length; i++) {
      const c = cands[i];
      if (c.promptMatch.length < best.promptMatch.length) best = c;
    }
    return best;
  }

  /**
   * Process a single character. Mutates input buffer when the char extends
   * a valid match. Returns one of: letter, wordComplete, mistake.
   */
  processChar(char: string, enemies: Enemy[]): TypingResult {
    const c = char;
    const next = this.currentInput + c;
    const candidates = enemies.filter(
      (e) => e.alive && !e.dying && e.promptMatch.startsWith(next),
    );

    if (candidates.length === 0) {
      // mismatch — input is not extended. mark mistake on best candidate (if any)
      const partialCandidates = enemies.filter(
        (e) =>
          e.alive && !e.dying && e.promptMatch.startsWith(this.currentInput),
      );
      let nearest: Enemy | null = null;
      let expected = "";
      if (partialCandidates.length > 0) {
        // Find the nearest (smallest depth = closest to player)
        nearest = partialCandidates[0];
        for (const pc of partialCandidates) {
          if (pc.depth < nearest.depth) nearest = pc;
        }
        expected = nearest.promptMatch.charAt(this.currentInput.length);
        nearest.mistakeOnCurrent = true;
      } else if (this.currentInput.length === 0) {
        // No active input — try to find ANY enemy whose first letter matches
        const candWithThisFirst = enemies.find(
          (e) => e.alive && !e.dying && e.promptMatch.charAt(0) !== c,
        );
        nearest = candWithThisFirst ?? null;
      }
      this.hadMistakeOnCurrent = true;
      return { type: "mistake", expected, got: c, nearestEnemy: nearest };
    }

    if (this.currentInput.length === 0) {
      this.inputStartedAt = performance.now();
    }
    this.currentInput = next;

    // Check completion — prefer the candidate with the smallest remaining,
    // i.e. the one for whom promptMatch === currentInput.
    const completed = candidates.find((e) => e.promptMatch === next);
    if (completed) {
      const durationMs = performance.now() - this.inputStartedAt;
      const perfect = !this.hadMistakeOnCurrent && !completed.mistakeOnCurrent;
      this.currentInput = "";
      this.hadMistakeOnCurrent = false;
      return {
        type: "wordComplete",
        enemy: completed,
        word: completed.promptDisplay,
        perfect,
        durationMs,
      };
    }

    // letter accepted — pick best target visually
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      const cand = candidates[i];
      if (cand.promptMatch.length < best.promptMatch.length) best = cand;
    }
    return {
      type: "letter",
      char: c,
      currentInput: this.currentInput,
      candidates,
      bestTarget: best,
    };
  }

  /** Remove one char from the input buffer (silent — no event). */
  backspace(): void {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
    }
  }

  /** Clear the input buffer entirely. */
  reset(): void {
    this.currentInput = "";
    this.hadMistakeOnCurrent = false;
  }

  /**
   * Called every frame: if currentInput no longer matches any alive enemy
   * (e.g. enemy died from chain damage mid-word), silently clear the input.
   * This prevents soft-locks.
   */
  validateAgainstEnemies(enemies: Enemy[]): void {
    if (this.currentInput.length === 0) return;
    const stillValid = enemies.some(
      (e) => e.alive && !e.dying && e.promptMatch.startsWith(this.currentInput),
    );
    if (!stillValid) {
      this.currentInput = "";
      this.hadMistakeOnCurrent = false;
    }
  }
}
