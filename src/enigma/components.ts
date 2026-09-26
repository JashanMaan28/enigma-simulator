/**
 * Wiring tables for the Wehrmacht Enigma I and the Kriegsmarine M3 (three-rotor) machines.
 *
 * Each wiring string lists, for inputs A…Z (at rotor position A, ring setting 01),
 * the letter the current leaves on. Source: the standard published tables
 * (e.g. Crypto Museum, Wikipedia "Enigma rotor details"), cross-checked against
 * historical messages in the test suite.
 */

export const ROTOR_NAMES = ['I', 'II', 'III', 'IV', 'V'] as const;
export type RotorName = (typeof ROTOR_NAMES)[number];

export const REFLECTOR_NAMES = ['B', 'C'] as const;
export type ReflectorName = (typeof REFLECTOR_NAMES)[number];

export interface RotorSpec {
  readonly name: RotorName;
  readonly wiring: string;
  /**
   * The letter showing in the window when this rotor's notch is engaged, i.e. the
   * position from which the next keypress also advances the rotor to its left.
   * Rotor I turns over as it moves Q → R, II E → F, III V → W, IV J → K, V Z → A.
   * The notch is cut in the alphabet ring, so it moves with the ring setting and
   * always lines up with the same window letter.
   */
  readonly turnover: string;
  /** Year introduced, for the guide. */
  readonly introduced: string;
}

export const ROTORS: Readonly<Record<RotorName, RotorSpec>> = {
  I: { name: 'I', wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', turnover: 'Q', introduced: '1930' },
  II: { name: 'II', wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', turnover: 'E', introduced: '1930' },
  III: { name: 'III', wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', turnover: 'V', introduced: '1930' },
  IV: { name: 'IV', wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', turnover: 'J', introduced: 'Dec 1938' },
  V: { name: 'V', wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', turnover: 'Z', introduced: 'Dec 1938' },
};

export interface ReflectorSpec {
  readonly name: ReflectorName;
  readonly wiring: string;
  readonly introduced: string;
}

/** Umkehrwalze (UKW): the fixed reflector that sends the current back through the rotors. */
export const REFLECTORS: Readonly<Record<ReflectorName, ReflectorSpec>> = {
  B: { name: 'B', wiring: 'YRUHQSLDPXNGOKMIEBFZCWVJAT', introduced: '1937' },
  C: { name: 'C', wiring: 'FVPJIAOYEDRZXWGCTKUQSBNMHL', introduced: '1940' },
};

/**
 * Eintrittswalze (ETW), the fixed entry wheel. On the military Enigma I / M3 it is
 * wired straight through (A→A, B→B…), unlike the commercial machines' QWERTZ order.
 */
export const ENTRY_WHEEL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Keyboard, lampboard and plugboard rows on the German machine (QWERTZ order). */
export const KEYBOARD_ROWS: readonly string[] = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'];
