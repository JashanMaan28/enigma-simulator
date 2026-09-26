import { LETTER_COUNT, indexToLetter, letterToIndex, mod26, ringNumber } from './alphabet';
import {
  ENTRY_WHEEL,
  REFLECTORS,
  REFLECTOR_NAMES,
  ROTORS,
  ROTOR_NAMES,
  type ReflectorName,
  type RotorName,
} from './components';
import { formatPlugboard, plugboardTable, validatePlugPairs, type PlugPair } from './plugboard';

export type Triple<T> = readonly [T, T, T];

/** Rotor slots as the operator sees them through the lid, left to right. */
export const SLOTS = ['left', 'middle', 'right'] as const;
export type Slot = (typeof SLOTS)[number];

/**
 * Everything needed to reproduce a message: the daily key-sheet settings plus the
 * rotor start positions. All letter values are indices 0–25.
 */
export interface MachineSettings {
  /** Umkehrwalze. */
  readonly reflector: ReflectorName;
  /** Walzenlage: rotors in the left, middle and right slots. Each rotor can be used once. */
  readonly rotors: Triple<RotorName>;
  /** Ringstellung: 0 = A / 01 … 25 = Z / 26. */
  readonly rings: Triple<number>;
  /** Grundstellung: the letters showing in the windows before the first key is pressed. */
  readonly positions: Triple<number>;
  /** Steckerverbindungen. */
  readonly plugboard: readonly PlugPair[];
}

export const DEFAULT_SETTINGS: MachineSettings = {
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: [0, 0, 0],
  positions: [0, 0, 0],
  plugboard: [],
};

/** Returns a list of human-readable problems; an empty list means the settings are usable. */
export function validateSettings(settings: MachineSettings): string[] {
  const problems: string[] = [];
  if (!REFLECTOR_NAMES.includes(settings.reflector)) {
    problems.push(`Unknown reflector “${String(settings.reflector)}”. Choose B or C.`);
  }
  settings.rotors.forEach((rotor, i) => {
    if (!ROTOR_NAMES.includes(rotor)) {
      problems.push(`Unknown rotor “${String(rotor)}” in the ${SLOTS[i]} slot. Choose I–V.`);
    }
  });
  if (new Set(settings.rotors).size !== 3) {
    problems.push('Each rotor can only be used once — the machine came with one of each.');
  }
  const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < LETTER_COUNT;
  settings.rings.forEach((ring, i) => {
    if (!inRange(ring)) problems.push(`The ${SLOTS[i]} ring setting must be 01–26.`);
  });
  settings.positions.forEach((pos, i) => {
    if (!inRange(pos)) problems.push(`The ${SLOTS[i]} start position must be A–Z.`);
  });
  problems.push(...validatePlugPairs(settings.plugboard).map((e) => e.message));
  return problems;
}

function assertValid(settings: MachineSettings): void {
  const problems = validateSettings(settings);
  if (problems.length > 0) throw new Error(`Invalid Enigma settings: ${problems.join(' ')}`);
}

/* ------------------------------------------------------------------ */
/* Stepping                                                            */
/* ------------------------------------------------------------------ */

export interface StepResult {
  readonly positions: Triple<number>;
  /** Which rotors moved (left, middle, right). */
  readonly moved: Triple<boolean>;
  /** True when the middle rotor stepped because of its own notch (the "double step"). */
  readonly doubleStep: boolean;
}

function atTurnover(rotor: RotorName, position: number): boolean {
  return indexToLetter(position) === ROTORS[rotor].turnover;
}

/**
 * Advance the rotors exactly as the ratchet-and-pawl mechanism does when a key is
 * pressed — before any current flows.
 *
 * - The right rotor always steps.
 * - The middle rotor steps if the right rotor is at its turnover notch, **or** if the
 *   middle rotor is itself at its turnover notch: its pawl then pushes both the middle
 *   and the left rotor. That second case is the "double step": the middle rotor moves
 *   on two consecutive keypresses.
 * - The left rotor steps only when the middle rotor is at its notch. It has no pawl to
 *   its left, so it never drives anything further.
 */
export function stepRotors(rotors: Triple<RotorName>, positions: Triple<number>): StepResult {
  const [left, middle, right] = positions;
  const rightNotch = atTurnover(rotors[2], right);
  const middleNotch = atTurnover(rotors[1], middle);

  const moveMiddle = rightNotch || middleNotch;
  const moveLeft = middleNotch;

  return {
    positions: [moveLeft ? mod26(left + 1) : left, moveMiddle ? mod26(middle + 1) : middle, mod26(right + 1)],
    moved: [moveLeft, moveMiddle, true],
    doubleStep: middleNotch && !rightNotch,
  };
}

/* ------------------------------------------------------------------ */
/* Signal path                                                         */
/* ------------------------------------------------------------------ */

export type StageKind = 'keyboard' | 'plugboard' | 'entry' | 'rotor' | 'reflector' | 'lamp';

/**
 * One hop of the electrical signal. `input` and `output` are contact positions
 * relative to the machine (fixed), not letters printed on a rotor's ring.
 */
export interface SignalStage {
  readonly kind: StageKind;
  /** Short, human-readable label such as "Right rotor (III)". */
  readonly label: string;
  readonly slot?: Slot;
  readonly rotor?: RotorName;
  /** 'forward' = keyboard → reflector, 'return' = reflector → lamps. */
  readonly direction: 'forward' | 'return' | 'turn';
  readonly input: number;
  readonly output: number;
}

export interface KeyPress {
  readonly input: number;
  readonly output: number;
  readonly positionsBefore: Triple<number>;
  /** Rotor positions after stepping — the positions the current actually passed through. */
  readonly positions: Triple<number>;
  readonly step: StepResult;
  readonly path: readonly SignalStage[];
}

const INVERSE_CACHE = new Map<string, number[]>();

function table(wiring: string): number[] {
  return Array.from(wiring, (ch) => letterToIndex(ch));
}

function inverseTable(wiring: string): number[] {
  let inv = INVERSE_CACHE.get(wiring);
  if (!inv) {
    inv = new Array<number>(LETTER_COUNT);
    table(wiring).forEach((out, i) => {
      (inv as number[])[out] = i;
    });
    INVERSE_CACHE.set(wiring, inv);
  }
  return inv;
}

const FORWARD_CACHE = new Map<string, number[]>();
function forwardTable(wiring: string): number[] {
  let fwd = FORWARD_CACHE.get(wiring);
  if (!fwd) {
    fwd = table(wiring);
    FORWARD_CACHE.set(wiring, fwd);
  }
  return fwd;
}

/**
 * Pass a contact through a rotor. The rotor's wiring core is offset from the
 * machine by (position − ring setting); we rotate into the core's frame, look up the
 * wire, and rotate back.
 */
function throughRotor(rotor: RotorName, position: number, ring: number, contact: number, reverse: boolean): number {
  const offset = position - ring;
  const wiring = reverse ? inverseTable(ROTORS[rotor].wiring) : forwardTable(ROTORS[rotor].wiring);
  return mod26((wiring[mod26(contact + offset)] as number) - offset);
}

const SLOT_LABEL: Record<Slot, string> = { left: 'Left', middle: 'Middle', right: 'Right' };

/**
 * Where each of the 26 contacts leads, for every component, with the rotors at the
 * given positions (contacts are fixed machine positions, as in {@link SignalStage}).
 * Rotor tables are in the forward (towards the reflector) direction.
 */
export interface WiringSnapshot {
  readonly plugboard: readonly number[];
  readonly entry: readonly number[];
  /** Left, middle, right. */
  readonly rotors: Triple<readonly number[]>;
  readonly reflector: readonly number[];
}

export function wiringAt(settings: MachineSettings, positions: Triple<number>): WiringSnapshot {
  const contacts = Array.from({ length: LETTER_COUNT }, (_, i) => i);
  const rotor = (i: 0 | 1 | 2) =>
    contacts.map((c) => throughRotor(settings.rotors[i], positions[i], settings.rings[i], c, false));
  return {
    plugboard: plugboardTable(settings.plugboard),
    entry: forwardTable(ENTRY_WHEEL),
    rotors: [rotor(0), rotor(1), rotor(2)],
    reflector: forwardTable(REFLECTORS[settings.reflector].wiring),
  };
}

/**
 * Press one key: the rotors step first (the key lever drives the pawls before it
 * closes the circuit), then current flows from the key through the plugboard, entry
 * wheel, right → middle → left rotors, the reflector, back through left → middle →
 * right, the entry wheel and plugboard again, and lights a lamp.
 */
export function pressKey(settings: MachineSettings, positions: Triple<number>, key: number): KeyPress {
  if (!Number.isInteger(key) || key < 0 || key >= LETTER_COUNT) {
    throw new RangeError(`Key ${key} is not a letter index 0–25`);
  }
  const step = stepRotors(settings.rotors, positions);
  const pos = step.positions;
  const plug = plugboardTable(settings.plugboard);
  const etw = forwardTable(ENTRY_WHEEL);
  const etwInverse = inverseTable(ENTRY_WHEEL);
  const reflector = forwardTable(REFLECTORS[settings.reflector].wiring);

  const path: SignalStage[] = [];
  const hop = (stage: Omit<SignalStage, 'output'>, output: number): number => {
    path.push({ ...stage, output });
    return output;
  };

  let c = hop({ kind: 'keyboard', label: 'Key', direction: 'forward', input: key }, key);
  c = hop({ kind: 'plugboard', label: 'Plugboard', direction: 'forward', input: c }, plug[c] as number);
  c = hop({ kind: 'entry', label: 'Entry wheel', direction: 'forward', input: c }, etw[c] as number);
  for (const i of [2, 1, 0] as const) {
    const slot = SLOTS[i];
    const rotor = settings.rotors[i];
    c = hop(
      { kind: 'rotor', label: `${SLOT_LABEL[slot]} rotor (${rotor})`, slot, rotor, direction: 'forward', input: c },
      throughRotor(rotor, pos[i], settings.rings[i], c, false),
    );
  }
  c = hop(
    { kind: 'reflector', label: `Reflector ${settings.reflector}`, direction: 'turn', input: c },
    reflector[c] as number,
  );
  for (const i of [0, 1, 2] as const) {
    const slot = SLOTS[i];
    const rotor = settings.rotors[i];
    c = hop(
      { kind: 'rotor', label: `${SLOT_LABEL[slot]} rotor (${rotor})`, slot, rotor, direction: 'return', input: c },
      throughRotor(rotor, pos[i], settings.rings[i], c, true),
    );
  }
  c = hop({ kind: 'entry', label: 'Entry wheel', direction: 'return', input: c }, etwInverse[c] as number);
  c = hop({ kind: 'plugboard', label: 'Plugboard', direction: 'return', input: c }, plug[c] as number);
  hop({ kind: 'lamp', label: 'Lamp', direction: 'return', input: c }, c);

  return { input: key, output: c, positionsBefore: positions, positions: pos, step, path };
}

/* ------------------------------------------------------------------ */
/* Convenience: a stateful machine                                     */
/* ------------------------------------------------------------------ */

/**
 * A small stateful wrapper around {@link pressKey}, handy for scripts and tests.
 * The UI keeps its own immutable state and calls `pressKey` directly.
 */
export class EnigmaMachine {
  readonly settings: MachineSettings;
  #positions: Triple<number>;

  constructor(settings: MachineSettings) {
    assertValid(settings);
    this.settings = settings;
    this.#positions = settings.positions;
  }

  get positions(): Triple<number> {
    return this.#positions;
  }

  /** The three letters showing in the rotor windows, e.g. "ADU". */
  get window(): string {
    return this.#positions.map(indexToLetter).join('');
  }

  setPositions(positions: Triple<number> | string): void {
    this.#positions =
      typeof positions === 'string' ? (Array.from(positions, letterToIndex) as unknown as Triple<number>) : positions;
  }

  press(letter: string): string {
    const result = pressKey(this.settings, this.#positions, letterToIndex(letter));
    this.#positions = result.positions;
    return indexToLetter(result.output);
  }

  /** Encipher (or decipher — it is the same operation) the letters A–Z of `text`; anything else is skipped. */
  encipher(text: string): string {
    let out = '';
    for (const ch of text.toUpperCase()) {
      if (ch >= 'A' && ch <= 'Z') out += this.press(ch);
    }
    return out;
  }
}

/** Run a string of letters through a fresh machine at the settings' start positions. */
export function encipher(settings: MachineSettings, text: string): string {
  return new EnigmaMachine(settings).encipher(text);
}

/* ------------------------------------------------------------------ */
/* Describing settings                                                 */
/* ------------------------------------------------------------------ */

export function positionsText(positions: Triple<number>): string {
  return positions.map(indexToLetter).join('');
}

export function ringsText(rings: Triple<number>): string {
  return rings.map(ringNumber).join(' ');
}

/** A one-line description in key-sheet terms, suitable for copying next to a ciphertext. */
export function describeSettings(settings: MachineSettings): string {
  const plugs = formatPlugboard(settings.plugboard);
  return [
    'Enigma I / M3',
    `UKW ${settings.reflector}`,
    `Walzenlage ${settings.rotors.join(' ')}`,
    `Ringstellung ${ringsText(settings.rings)} (${positionsText(settings.rings)})`,
    `Grundstellung ${positionsText(settings.positions)}`,
    `Stecker ${plugs || '(none)'}`,
  ].join(' · ');
}
