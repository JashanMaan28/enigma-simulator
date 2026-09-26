/**
 * How text outside the machine's 26 letters is handled — one rule everywhere
 * (physical keyboard, on-screen keys, pasted text):
 *
 * - Letters are upper-cased; accents are removed (É → E, Ä → A). German ß becomes SS.
 * - Everything else — spaces, digits, punctuation, line breaks — is skipped. It never
 *   reaches the machine and never steps the rotors.
 * - Output is written in five-letter groups, the way operators wrote messages down.
 *   The groups are for reading only; they carry no meaning and are ignored on input.
 *
 * Historical operators spelled punctuation out instead, e.g. X for a full stop or a
 * word break, and wrote numbers as words.
 */
export function toMachineLetters(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

/** Count the characters in `text` that the machine would skip. */
export function countSkipped(text: string): number {
  let skipped = 0;
  for (const ch of text.normalize('NFC')) {
    if (toMachineLetters(ch).length === 0) skipped += 1;
  }
  return skipped;
}

/** "ABCDEFGHIJKL" → "ABCDE FGHIJ KL". */
export function groupLetters(letters: string, size = 5): string {
  if (size <= 0) return letters;
  const groups: string[] = [];
  for (let i = 0; i < letters.length; i += size) groups.push(letters.slice(i, i + size));
  return groups.join(' ');
}
