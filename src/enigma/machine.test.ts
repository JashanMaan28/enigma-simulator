import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  EnigmaMachine,
  ROTORS,
  ROTOR_NAMES,
  describeSettings,
  encipher,
  letterToIndex,
  parsePlugboard,
  positionsText,
  pressKey,
  stepRotors,
  validateSettings,
  type MachineSettings,
  type RotorName,
  type Triple,
} from './index';
import reference from './fixtures/reference-vectors.json';

const letters = (s: string) => Array.from(s, letterToIndex) as unknown as Triple<number>;
const nogaps = (s: string) => s.replace(/\s+/g, '');

function settings(overrides: Partial<MachineSettings> & { plugs?: string; start?: string; ringLetters?: number[] }) {
  const { plugs, start, ringLetters, ...rest } = overrides;
  const parsed = parsePlugboard(plugs ?? '');
  expect(parsed.errors).toEqual([]);
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    ...(ringLetters ? { rings: ringLetters.map((r) => r - 1) as unknown as Triple<number> } : {}),
    ...(start ? { positions: letters(start) } : {}),
    plugboard: parsed.pairs,
  } satisfies MachineSettings;
}

/* -------------------------------------------------------------------------- */
/* Published, independently verified test vectors                             */
/* -------------------------------------------------------------------------- */

describe('published test vectors', () => {
  it('I-II-III, UKW B, rings 01 01 01, start AAA, no plugs: AAAAA → BDZGO', () => {
    // The standard sanity check quoted by most Enigma references and simulators.
    expect(encipher(DEFAULT_SETTINGS, 'AAAAA')).toBe('BDZGO');
    expect(encipher(DEFAULT_SETTINGS, 'BDZGO')).toBe('AAAAA');
  });

  /*
   * Operation Barbarossa, 7 July 1941 — a real Wehrmacht message in two parts,
   * published by Geoff Sullivan and Frode Weierud ("Breaking German Army Ciphers",
   * Cryptologia 29(3), 2005; cryptocellar.org). Key: UKW B, Walzenlage II IV V,
   * Ringstellung 02 21 12, Stecker AV BS CG DL FU HZ IN KM OW RX.
   * Each part used the historical indicator procedure: set the rotors to the
   * Grundstellung given in the header, decipher the three-letter indicator to get the
   * message key, then set the rotors to the message key and decipher the text.
   */
  const barbarossa = settings({
    reflector: 'B',
    rotors: ['II', 'IV', 'V'],
    ringLetters: [2, 21, 12],
    plugs: 'AV BS CG DL FU HZ IN KM OW RX',
  });

  const part1 = {
    grundstellung: 'WXC',
    indicator: 'KCH',
    messageKey: 'BLA',
    ciphertext: `EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE FGUEY SIOZV EQMIK UBPMM YLKLT TDEIS MDICA
      GYKUA CTCDO MOHWX MUUIA UBSTS LRNBZ SZWNR FXWFY SSXJZ VIJHI DISHP RKLKA YUPAD TXQSP INQMA
      TLPIF SVKDA SCTAC DPBOP VHJK`,
    plaintext: `AUFKL XABTE ILUNG XVONX KURTI NOWAX KURTI NOWAX NORDW ESTLX SEBEZ XSEBE ZXUAF FLIEG ERSTR
      ASZER IQTUN GXDUB ROWKI XDUBR OWKIX OPOTS CHKAX OPOTS CHKAX UMXEI NSAQT DREIN ULLXU HRANG
      ETRET ENXAN GRIFF XINFX RGTX`,
  };
  const part2 = {
    grundstellung: 'CRS',
    indicator: 'YPJ',
    messageKey: 'LSD',
    ciphertext: `SFBWD NJUSE GQOBH KRTAR EEZMW KPPRB XOHDR OEQGB BGTQV PGVKB VVGBI MHUSZ YDAJQ IROAX SSSNR
      EHYGG RPISE ZBOVM QIEMM ZCYSG QDGRE RVBIL EKXYQ IRGIR QNRDN VRXCY YTNJR`,
    plaintext: `DREIG EHTLA NGSAM ABERS IQERV ORWAE RTSXE INSSI EBENN ULLSE QSXUH RXROE MXEIN SXINF RGTXD
      REIXA UFFLI EGERS TRASZ EMITA NFANG XEINS SEQSX KMXKM XOSTW XKAME NECXK`,
  };

  for (const [name, part] of [
    ['part 1', part1],
    ['part 2', part2],
  ] as const) {
    it(`Barbarossa ${name}: indicator ${part.indicator} at ${part.grundstellung} gives message key ${part.messageKey}`, () => {
      const m = new EnigmaMachine({ ...barbarossa, positions: letters(part.grundstellung) });
      expect(m.encipher(part.indicator)).toBe(part.messageKey);
    });

    it(`Barbarossa ${name}: deciphers the ${nogaps(part.ciphertext).length}-letter message`, () => {
      const m = new EnigmaMachine({ ...barbarossa, positions: letters(part.messageKey) });
      expect(m.encipher(part.ciphertext)).toBe(nogaps(part.plaintext));
    });

    it(`Barbarossa ${name}: enciphering the plaintext reproduces the ciphertext`, () => {
      const out = encipher({ ...barbarossa, positions: letters(part.messageKey) }, part.plaintext);
      expect(out).toBe(nogaps(part.ciphertext));
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Cross-checks against an independent implementation (py-enigma)             */
/* -------------------------------------------------------------------------- */

describe(`cross-check against ${reference.generator}`, () => {
  for (const c of reference.cipher) {
    it(`enciphers: ${c.name}`, () => {
      const s = settings({
        reflector: c.reflector as MachineSettings['reflector'],
        rotors: c.rotors as unknown as Triple<RotorName>,
        ringLetters: c.rings,
        plugs: c.plugboard,
        start: c.start,
      });
      expect(encipher(s, c.plaintext)).toBe(c.ciphertext);
      expect(encipher(s, c.ciphertext)).toBe(c.plaintext);
    });
  }

  for (const s of reference.stepping) {
    it(`steps: ${s.name}`, () => {
      const m = new EnigmaMachine(
        settings({ rotors: s.rotors as unknown as Triple<RotorName>, ringLetters: s.rings, start: s.start }),
      );
      const windows = [m.window];
      for (let i = 0; i < s.presses; i++) {
        m.press('A');
        windows.push(m.window);
      }
      expect(windows).toEqual(s.windows);
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Rotor stepping                                                             */
/* -------------------------------------------------------------------------- */

describe('rotor stepping', () => {
  const I_II_III: Triple<RotorName> = ['I', 'II', 'III'];
  const step = (rotors: Triple<RotorName>, window: string) => positionsText(stepRotors(rotors, letters(window)).positions);

  it('advances only the right rotor when no notch is engaged', () => {
    expect(step(I_II_III, 'AAA')).toBe('AAB');
    expect(step(I_II_III, 'AAZ')).toBe('AAA'); // Z wraps to A without carrying (III turns over at V, not Z)
  });

  it.each([
    ['I', 'Q'],
    ['II', 'E'],
    ['III', 'V'],
    ['IV', 'J'],
    ['V', 'Z'],
  ] as const)('rotor %s in the right slot carries the middle rotor as it leaves %s', (rotor, notch) => {
    const others = ROTOR_NAMES.filter((r) => r !== rotor);
    // Middle rotor at A, which is not a turnover letter for any of I–V.
    const rotors: Triple<RotorName> = [others[0] as RotorName, others[1] as RotorName, rotor];
    const before = letterToIndex(notch);
    const prior = (before + 25) % 26;
    const after = (before + 1) % 26;
    const at = (right: number) => positionsText(stepRotors(rotors, [0, 0, right]).positions);

    expect(ROTORS[rotor].turnover).toBe(notch);
    expect(at(before)).toBe(`AB${String.fromCharCode(65 + after)}`);
    expect(at(prior)).toBe(`AA${notch}`);
  });

  it('double-steps the middle rotor (the classic ADU → ADV → AEW → BFX → BFY sequence)', () => {
    const m = new EnigmaMachine(settings({ start: 'ADU' }));
    const seen = [m.window];
    for (let i = 0; i < 4; i++) {
      m.press('A');
      seen.push(m.window);
    }
    expect(seen).toEqual(['ADU', 'ADV', 'AEW', 'BFX', 'BFY']);
  });

  it('flags the double step and reports which rotors moved', () => {
    const normal = stepRotors(I_II_III, letters('ADV'));
    expect(normal.moved).toEqual([false, true, true]);
    expect(normal.doubleStep).toBe(false);

    const double = stepRotors(I_II_III, letters('AEW'));
    expect(positionsText(double.positions)).toBe('BFX');
    expect(double.moved).toEqual([true, true, true]);
    expect(double.doubleStep).toBe(true);
  });

  it('never moves the left rotor because of its own notch', () => {
    // Left rotor I sitting at its notch Q: nothing to its left can be driven.
    expect(step(I_II_III, 'QAA')).toBe('QAB');
  });

  it('keeps the turnover at the same window letter whatever the ring setting', () => {
    for (let ring = 0; ring < 26; ring++) {
      const s = settings({ rings: [0, 0, ring], start: 'AAV' });
      const m = new EnigmaMachine(s);
      m.press('A');
      expect(m.window).toBe('ABW');
    }
  });

  it('returns to its start after 26 × 25 × 26 = 16,900 keypresses (the double step skips one middle position per cycle)', () => {
    let positions: Triple<number> = [0, 0, 0];
    let count = 0;
    do {
      positions = stepRotors(I_II_III, positions).positions;
      count++;
    } while (positionsText(positions) !== 'AAA' && count < 20000);
    expect(count).toBe(16900);
  });

  it('steps before the current flows, so the first letter uses the advanced positions', () => {
    const press = pressKey(DEFAULT_SETTINGS, [0, 0, 0], letterToIndex('A'));
    expect(positionsText(press.positionsBefore)).toBe('AAA');
    expect(positionsText(press.positions)).toBe('AAB');
    expect(String.fromCharCode(65 + press.output)).toBe('B');
    // A machine that stepped *after* the circuit would light a different lamp here:
    const circuitAtAAA = pressKey(DEFAULT_SETTINGS, [0, 0, 25], letterToIndex('A')); // AAZ steps to AAA
    expect(circuitAtAAA.output).not.toBe(press.output);
  });
});

/* -------------------------------------------------------------------------- */
/* Cipher properties                                                           */
/* -------------------------------------------------------------------------- */

function randomSettings(seed: number): MachineSettings {
  let x = seed;
  const rand = (n: number) => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return Math.floor((x / 2147483648) * n);
  };
  const pool = [...ROTOR_NAMES];
  const rotors = [0, 1, 2].map(() => pool.splice(rand(pool.length), 1)[0]) as unknown as Triple<RotorName>;
  const alphabet = Array.from({ length: 26 }, (_, i) => i);
  for (let i = 25; i > 0; i--) {
    const j = rand(i + 1);
    [alphabet[i], alphabet[j]] = [alphabet[j] as number, alphabet[i] as number];
  }
  const cables = rand(14);
  const plugboard = Array.from({ length: cables }, (_, i) => [alphabet[2 * i], alphabet[2 * i + 1]] as [number, number]);
  return {
    reflector: rand(2) === 0 ? 'B' : 'C',
    rotors,
    rings: [rand(26), rand(26), rand(26)],
    positions: [rand(26), rand(26), rand(26)],
    plugboard,
  };
}

describe('cipher properties', () => {
  const text = 'WETTERVORHERSAGEBISKAYAXNEBELXSICHTWEITEZWEIHUNDERTMETER'.repeat(8);

  it('is its own inverse: the same settings decipher what they encipher', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = randomSettings(seed);
      expect(validateSettings(s)).toEqual([]);
      const cipher = encipher(s, text);
      expect(cipher).not.toBe(text);
      expect(encipher(s, cipher)).toBe(text);
    }
  });

  it('never enciphers a letter to itself', () => {
    for (let seed = 100; seed < 110; seed++) {
      const s = randomSettings(seed);
      const m = new EnigmaMachine(s);
      for (let i = 0; i < 600; i++) {
        const key = String.fromCharCode(65 + (i % 26));
        expect(m.press(key)).not.toBe(key);
      }
    }
  });

  it('works with a fully populated plugboard (13 cables)', () => {
    const full = settings({ plugs: 'AN BO CP DQ ER FS GT HU IV JW KX LY MZ' });
    const cipher = encipher(full, text);
    expect(encipher(full, cipher)).toBe(text);
    expect(cipher).not.toBe(encipher(DEFAULT_SETTINGS, text));
  });

  it('applies the plugboard on the way in and on the way out', () => {
    // With A↔B cabled, pressing B is like pressing A on an unplugged machine,
    // and the lamp that would have been A lights B instead (and vice versa).
    const swapped = settings({ plugs: 'AB' });
    const base = pressKey(DEFAULT_SETTINGS, [0, 0, 0], letterToIndex('A'));
    const viaPlug = pressKey(swapped, [0, 0, 0], letterToIndex('B'));
    const swap = (n: number) => (n === 0 ? 1 : n === 1 ? 0 : n);
    expect(viaPlug.output).toBe(swap(base.output));
  });
});

/* -------------------------------------------------------------------------- */
/* Signal path trace                                                           */
/* -------------------------------------------------------------------------- */

describe('signal path', () => {
  it('records every hop from key to lamp, in machine order', () => {
    const s = settings({ plugs: 'AV', start: 'AAA' });
    const press = pressKey(s, s.positions, letterToIndex('A'));
    expect(press.path.map((p) => `${p.kind}:${p.direction}`)).toEqual([
      'keyboard:forward',
      'plugboard:forward',
      'entry:forward',
      'rotor:forward',
      'rotor:forward',
      'rotor:forward',
      'reflector:turn',
      'rotor:return',
      'rotor:return',
      'rotor:return',
      'entry:return',
      'plugboard:return',
      'lamp:return',
    ]);
    expect(press.path.filter((p) => p.kind === 'rotor').map((p) => p.slot)).toEqual([
      'right',
      'middle',
      'left',
      'left',
      'middle',
      'right',
    ]);
    // Each hop feeds the next.
    for (let i = 1; i < press.path.length; i++) {
      expect(press.path[i]?.input).toBe(press.path[i - 1]?.output);
    }
    expect(press.path[1]?.output).toBe(letterToIndex('V')); // A is plugged to V
    expect(press.path.at(-1)?.output).toBe(press.output);
  });
});

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

describe('settings validation', () => {
  it('accepts the defaults', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
  });

  it('rejects using the same rotor twice', () => {
    const problems = validateSettings({ ...DEFAULT_SETTINGS, rotors: ['I', 'I', 'III'] });
    expect(problems.join(' ')).toMatch(/only be used once/);
    expect(() => new EnigmaMachine({ ...DEFAULT_SETTINGS, rotors: ['I', 'I', 'III'] })).toThrow(/Invalid/);
  });

  it('rejects out-of-range rings and positions and unknown parts', () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, rings: [0, 26, 0] })).toHaveLength(1);
    expect(validateSettings({ ...DEFAULT_SETTINGS, positions: [-1, 0, 0] })).toHaveLength(1);
    expect(validateSettings({ ...DEFAULT_SETTINGS, positions: [0.5, 0, 0] })).toHaveLength(1);
    expect(validateSettings({ ...DEFAULT_SETTINGS, reflector: 'A' as never })).toHaveLength(1);
    expect(validateSettings({ ...DEFAULT_SETTINGS, rotors: ['I', 'II', 'VI' as never] })).toHaveLength(1);
  });

  it('rejects a plugboard that reuses a socket', () => {
    const problems = validateSettings({ ...DEFAULT_SETTINGS, plugboard: [[0, 1], [1, 2]] });
    expect(problems.join(' ')).toMatch(/B is already used/);
  });

  it('describes settings in key-sheet terms', () => {
    const s = settings({ reflector: 'C', rotors: ['II', 'IV', 'V'], ringLetters: [2, 21, 12], start: 'BLA', plugs: 'VA SB' });
    expect(describeSettings(s)).toBe(
      'Enigma I / M3 · UKW C · Walzenlage II IV V · Ringstellung 02 21 12 (BUL) · Grundstellung BLA · Stecker AV BS',
    );
  });
});
