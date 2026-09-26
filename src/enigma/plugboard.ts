import { ALPHABET, LETTER_COUNT, indexToLetter } from './alphabet';

/** A plugboard cable joins two sockets; the letters are swapped on the way in and on the way out. */
export type PlugPair = readonly [number, number];

/** Standard Wehrmacht issue from 1939 onwards; the board itself has room for 13. */
export const STANDARD_CABLE_COUNT = 10;
export const MAX_CABLES = LETTER_COUNT / 2;

export type PlugboardErrorCode = 'not-a-pair' | 'not-letters' | 'self-pair' | 'letter-reused';

export interface PlugboardError {
  readonly code: PlugboardErrorCode;
  /** The piece of input the error refers to, as typed (upper-cased). */
  readonly token: string;
  readonly message: string;
}

export interface PlugboardParseResult {
  /** All pairs that are individually valid and do not clash with an earlier pair. */
  readonly pairs: readonly PlugPair[];
  readonly errors: readonly PlugboardError[];
}

/**
 * Parse plugboard pairs written the way a key sheet lists them: two letters per
 * cable, cables separated by spaces or commas — e.g. "AV BS CG DL".
 * Input is case-insensitive. Every problem is reported rather than silently fixed.
 */
export function parsePlugboard(input: string): PlugboardParseResult {
  const tokens = input
    .toUpperCase()
    .split(/[\s,;]+/)
    .filter((t) => t.length > 0);

  const pairs: PlugPair[] = [];
  const errors: PlugboardError[] = [];
  const usedBy = new Map<number, string>();

  for (const token of tokens) {
    if (!/^[A-Z]+$/.test(token)) {
      errors.push({
        code: 'not-letters',
        token,
        message: `“${token}” contains something other than the letters A–Z.`,
      });
      continue;
    }
    if (token.length !== 2) {
      errors.push({
        code: 'not-a-pair',
        token,
        message: `“${token}” is not a pair. Each cable joins exactly two letters, e.g. AV.`,
      });
      continue;
    }
    const a = ALPHABET.indexOf(token[0] as string);
    const b = ALPHABET.indexOf(token[1] as string);
    if (a === b) {
      errors.push({
        code: 'self-pair',
        token,
        message: `“${token}”: a letter cannot be plugged to itself.`,
      });
      continue;
    }
    const clash = [a, b].find((x) => usedBy.has(x));
    if (clash !== undefined) {
      errors.push({
        code: 'letter-reused',
        token,
        message: `“${token}”: ${indexToLetter(clash)} is already used by ${usedBy.get(clash)}. Each socket takes only one cable.`,
      });
      continue;
    }
    usedBy.set(a, token);
    usedBy.set(b, token);
    pairs.push([a, b]);
  }

  return { pairs, errors };
}

/** Check a list of pairs (e.g. built by clicking sockets) against the physical rules of the board. */
export function validatePlugPairs(pairs: readonly PlugPair[]): PlugboardError[] {
  return [...parsePlugboard(formatPlugboard(pairs, { canonical: false })).errors];
}

/**
 * Write pairs as key-sheet text. With `canonical` (the default) each pair is written
 * in alphabetical order and the pairs are sorted, e.g. "AV BS CG", so that two
 * equivalent plugboards always produce the same text.
 */
export function formatPlugboard(pairs: readonly PlugPair[], { canonical = true } = {}): string {
  const written = pairs.map(([a, b]) => {
    const [x, y] = canonical && b < a ? [b, a] : [a, b];
    return safeLetter(x) + safeLetter(y);
  });
  if (canonical) written.sort();
  return written.join(' ');
}

function safeLetter(index: number): string {
  return Number.isInteger(index) && index >= 0 && index < LETTER_COUNT ? indexToLetter(index) : '?';
}

/** Build the 26-entry substitution table for a set of pairs (unplugged letters map to themselves). */
export function plugboardTable(pairs: readonly PlugPair[]): number[] {
  const table = Array.from({ length: LETTER_COUNT }, (_, i) => i);
  for (const [a, b] of pairs) {
    table[a] = b;
    table[b] = a;
  }
  return table;
}

/** The letter a socket is cabled to, or undefined if it is unplugged. */
export function partnerOf(pairs: readonly PlugPair[], letter: number): number | undefined {
  for (const [a, b] of pairs) {
    if (a === letter) return b;
    if (b === letter) return a;
  }
  return undefined;
}

/** Remove the cable (if any) that uses the given letter. */
export function unplug(pairs: readonly PlugPair[], letter: number): PlugPair[] {
  return pairs.filter(([a, b]) => a !== letter && b !== letter);
}

/** Connect two letters, first removing any cables already in either socket. */
export function plugIn(pairs: readonly PlugPair[], a: number, b: number): PlugPair[] {
  if (a === b) throw new RangeError('A letter cannot be plugged to itself.');
  return [...unplug(unplug(pairs, a), b), [a, b]];
}
