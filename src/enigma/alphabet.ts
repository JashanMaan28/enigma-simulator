/** The 26-letter alphabet the machine works in. Letters are handled internally as indices 0–25 (A = 0). */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const LETTER_COUNT = 26;

/** Always-positive modulo, so that negative offsets wrap around the alphabet. */
export function mod26(n: number): number {
  return ((n % LETTER_COUNT) + LETTER_COUNT) % LETTER_COUNT;
}

export function letterToIndex(letter: string): number {
  const index = ALPHABET.indexOf(letter.toUpperCase());
  if (letter.length !== 1 || index === -1) {
    throw new RangeError(`"${letter}" is not a letter A–Z`);
  }
  return index;
}

export function indexToLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= LETTER_COUNT) {
    throw new RangeError(`${index} is not a letter index 0–25`);
  }
  return ALPHABET[index] as string;
}

export function isLetter(value: string): boolean {
  return value.length === 1 && ALPHABET.includes(value.toUpperCase());
}

/** Ring settings are traditionally written as two-digit numbers, 01–26. */
export function ringNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}
