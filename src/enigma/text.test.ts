import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  countSkipped,
  encipher,
  groupLetters,
  settingsFromQuery,
  settingsToQuery,
  toMachineLetters,
  type MachineSettings,
} from './index';

describe('text handling', () => {
  it('keeps only the letters A–Z, upper-cased', () => {
    expect(toMachineLetters('Hello, World! 123')).toBe('HELLOWORLD');
    expect(toMachineLetters('  \n\t.,;:!?-()"\'')).toBe('');
  });

  it('removes accents and expands ß', () => {
    expect(toMachineLetters('Ärger über Straße, café')).toBe('ARGERUBERSTRASSECAFE');
  });

  it('counts the characters that are skipped', () => {
    expect(countSkipped('AB, C!')).toBe(3);
    expect(countSkipped('Straße')).toBe(0);
    expect(countSkipped('')).toBe(0);
  });

  it('groups output in fives for reading', () => {
    expect(groupLetters('ABCDEFGHIJKL')).toBe('ABCDE FGHIJ KL');
    expect(groupLetters('ABCDE')).toBe('ABCDE');
    expect(groupLetters('')).toBe('');
  });

  it('spacing and punctuation do not affect the cipher: grouped ciphertext deciphers the same', () => {
    const cipher = encipher(DEFAULT_SETTINGS, toMachineLetters('Attack at dawn!'));
    expect(encipher(DEFAULT_SETTINGS, groupLetters(cipher))).toBe('ATTACKATDAWN');
  });
});

describe('settings links', () => {
  const sample: MachineSettings = {
    reflector: 'C',
    rotors: ['II', 'IV', 'V'],
    rings: [1, 20, 11],
    positions: [1, 11, 0],
    plugboard: [
      [0, 21],
      [1, 18],
    ],
  };

  it('round-trips through the query format', () => {
    const q = settingsToQuery(sample);
    expect(q).toBe('ukw=C&walzen=II-IV-V&ringe=02-21-12&grund=BLA&stecker=AV-BS');
    expect(settingsFromQuery(`#${q}`, DEFAULT_SETTINGS)).toEqual({ ok: true, settings: sample });
  });

  it('falls back to defaults for missing fields and accepts ring letters', () => {
    const r = settingsFromQuery('walzen=v-iv-iii&ringe=A-B-Z', DEFAULT_SETTINGS);
    expect(r).toEqual({
      ok: true,
      settings: { ...DEFAULT_SETTINGS, rotors: ['V', 'IV', 'III'], rings: [0, 1, 25] },
    });
  });

  it('reports problems instead of guessing', () => {
    const r = settingsFromQuery('ukw=A&walzen=I-I-II&ringe=00-01-01&grund=AB&stecker=AA', DEFAULT_SETTINGS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems).toHaveLength(4);
    const dup = settingsFromQuery('walzen=I-I-II', DEFAULT_SETTINGS);
    expect(dup.ok).toBe(false);
  });
});
