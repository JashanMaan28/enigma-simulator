import { describe, expect, it } from 'vitest';
import {
  MAX_CABLES,
  formatPlugboard,
  letterToIndex,
  parsePlugboard,
  partnerOf,
  plugIn,
  plugboardTable,
  unplug,
  validatePlugPairs,
  type PlugPair,
} from './index';

const L = letterToIndex;

describe('parsePlugboard', () => {
  it('reads key-sheet notation', () => {
    const r = parsePlugboard('AV BS CG DL FU HZ IN KM OW RX');
    expect(r.errors).toEqual([]);
    expect(r.pairs).toHaveLength(10);
    expect(r.pairs[0]).toEqual([L('A'), L('V')]);
  });

  it('is case-insensitive and accepts commas and extra whitespace', () => {
    const r = parsePlugboard('  av,bs ;  cg\n');
    expect(r.errors).toEqual([]);
    expect(formatPlugboard(r.pairs)).toBe('AV BS CG');
  });

  it('treats an empty board as valid', () => {
    expect(parsePlugboard('')).toEqual({ pairs: [], errors: [] });
    expect(parsePlugboard('   ')).toEqual({ pairs: [], errors: [] });
  });

  it('rejects a letter plugged to itself', () => {
    const r = parsePlugboard('AA');
    expect(r.pairs).toEqual([]);
    expect(r.errors).toMatchObject([{ code: 'self-pair', token: 'AA' }]);
  });

  it('rejects a letter used by two cables and keeps the first', () => {
    const r = parsePlugboard('AB CA');
    expect(r.pairs).toEqual([[L('A'), L('B')]]);
    expect(r.errors).toMatchObject([{ code: 'letter-reused', token: 'CA' }]);
    expect(r.errors[0]?.message).toMatch(/A is already used by AB/);
  });

  it('rejects tokens that are not exactly two letters', () => {
    expect(parsePlugboard('ABC').errors).toMatchObject([{ code: 'not-a-pair' }]);
    expect(parsePlugboard('A').errors).toMatchObject([{ code: 'not-a-pair' }]);
    expect(parsePlugboard('A1').errors).toMatchObject([{ code: 'not-letters' }]);
    expect(parsePlugboard('A-B').errors).toMatchObject([{ code: 'not-letters' }]);
    expect(parsePlugboard('ÄB').errors).toMatchObject([{ code: 'not-letters' }]);
  });

  it('reports every problem, not just the first', () => {
    const r = parsePlugboard('AB XX CDE BF QR');
    expect(r.errors.map((e) => e.code)).toEqual(['self-pair', 'not-a-pair', 'letter-reused']);
    expect(formatPlugboard(r.pairs)).toBe('AB QR');
  });

  it('allows all 13 cables but no 14th', () => {
    const full = 'AB CD EF GH IJ KL MN OP QR ST UV WX YZ';
    expect(parsePlugboard(full).pairs).toHaveLength(MAX_CABLES);
    expect(parsePlugboard(full).errors).toEqual([]);
    const r = parsePlugboard(`${full} AZ`);
    expect(r.pairs).toHaveLength(13);
    expect(r.errors).toMatchObject([{ code: 'letter-reused' }]);
  });
});

describe('plugboard helpers', () => {
  it('formats canonically: each pair and the list sorted', () => {
    const pairs: PlugPair[] = [
      [L('V'), L('A')],
      [L('C'), L('B')],
    ];
    expect(formatPlugboard(pairs)).toBe('AV BC');
    expect(formatPlugboard(pairs, { canonical: false })).toBe('VA CB');
  });

  it('builds a reciprocal substitution table', () => {
    const t = plugboardTable([[L('A'), L('V')]]);
    expect(t[L('A')]).toBe(L('V'));
    expect(t[L('V')]).toBe(L('A'));
    expect(t[L('B')]).toBe(L('B'));
  });

  it('plugIn moves cables out of occupied sockets', () => {
    let pairs = plugIn([], L('A'), L('B'));
    pairs = plugIn(pairs, L('C'), L('D'));
    pairs = plugIn(pairs, L('B'), L('C')); // A and D are left unplugged
    expect(formatPlugboard(pairs)).toBe('BC');
    expect(partnerOf(pairs, L('B'))).toBe(L('C'));
    expect(partnerOf(pairs, L('A'))).toBeUndefined();
    expect(() => plugIn(pairs, L('E'), L('E'))).toThrow();
  });

  it('unplug removes the cable from either end', () => {
    const pairs = plugIn([], L('A'), L('B'));
    expect(unplug(pairs, L('B'))).toEqual([]);
    expect(unplug(pairs, L('Z'))).toEqual(pairs);
  });

  it('validatePlugPairs catches clashes and bad indices in pair lists', () => {
    expect(validatePlugPairs([[0, 1], [2, 3]])).toEqual([]);
    expect(validatePlugPairs([[0, 1], [1, 2]]).map((e) => e.code)).toEqual(['letter-reused']);
    expect(validatePlugPairs([[4, 4]]).map((e) => e.code)).toEqual(['self-pair']);
    expect(validatePlugPairs([[0, 26]]).map((e) => e.code)).toEqual(['not-letters']);
  });
});
