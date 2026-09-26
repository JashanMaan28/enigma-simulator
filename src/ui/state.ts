import {
  DEFAULT_SETTINGS,
  mod26,
  pressKey,
  stepRotors,
  toMachineLetters,
  validateSettings,
  type KeyPress,
  type MachineSettings,
  type Triple,
} from '../enigma';

/** A finished message, kept with the exact settings that produced it. */
export interface LogEntry {
  readonly id: number;
  readonly settings: MachineSettings;
  readonly input: string;
  readonly output: string;
}

/**
 * Interface state. One invariant keeps results reproducible: the current message
 * always starts at `settings.positions`, so `positions` is those start positions
 * stepped once per letter typed. Anything that would break that — changing the key
 * sheet or turning a rotor by hand mid-message — files the message in the log and
 * starts a new one.
 */
export interface AppState {
  readonly settings: MachineSettings;
  readonly positions: Triple<number>;
  readonly input: string;
  readonly output: string;
  readonly lastPress: KeyPress | null;
  readonly log: readonly LogEntry[];
  readonly nextId: number;
  /** Short status for the message pad, announced to screen readers. */
  readonly notice: string | null;
}

export type Action =
  | { type: 'press'; key: number }
  | { type: 'feed'; text: string }
  | { type: 'undo' }
  | { type: 'restore' }
  | { type: 'clear' }
  | { type: 'turn'; slot: 0 | 1 | 2; delta: number }
  | { type: 'settings'; settings: MachineSettings; notice?: string }
  | { type: 'decipher-entry'; id: number }
  | { type: 'notice'; text: string };

export const LOG_LIMIT = 12;

export function initialState(settings: MachineSettings = DEFAULT_SETTINGS): AppState {
  return {
    settings,
    positions: settings.positions,
    input: '',
    output: '',
    lastPress: null,
    log: [],
    nextId: 1,
    notice: null,
  };
}

/** File the current message (if any) in the log and start an empty one at `settings`. */
function startNewMessage(state: AppState, settings: MachineSettings, notice: string | null): AppState {
  const filed = state.input.length > 0;
  const log = filed
    ? [{ id: state.nextId, settings: state.settings, input: state.input, output: state.output }, ...state.log].slice(
        0,
        LOG_LIMIT,
      )
    : state.log;
  return {
    ...state,
    settings,
    positions: settings.positions,
    input: '',
    output: '',
    lastPress: null,
    log,
    nextId: filed ? state.nextId + 1 : state.nextId,
    notice: filed ? (notice ?? 'Message filed in the log.') : notice,
  };
}

function typeLetters(state: AppState, letters: string): AppState {
  let { positions, input, output } = state;
  let lastPress = state.lastPress;
  for (const ch of letters) {
    lastPress = pressKey(state.settings, positions, ch.charCodeAt(0) - 65);
    positions = lastPress.positions;
    input += ch;
    output += String.fromCharCode(65 + lastPress.output);
  }
  return { ...state, positions, input, output, lastPress, notice: null };
}

/** Rotor positions after `count` keypresses from the start positions. */
export function positionsAfter(settings: MachineSettings, count: number): Triple<number> {
  let positions = settings.positions;
  for (let i = 0; i < count; i++) positions = stepRotors(settings.rotors, positions).positions;
  return positions;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'press':
      return typeLetters(state, String.fromCharCode(65 + action.key));

    case 'feed': {
      const letters = toMachineLetters(action.text);
      return letters.length > 0 ? typeLetters(state, letters) : state;
    }

    case 'undo': {
      if (state.input.length === 0) return state;
      const input = state.input.slice(0, -1);
      return {
        ...state,
        input,
        output: state.output.slice(0, -1),
        positions: positionsAfter(state.settings, input.length),
        lastPress: null,
        notice: null,
      };
    }

    case 'restore':
      return startNewMessage(
        state,
        state.settings,
        state.input.length > 0 ? 'Rotors back at the start positions. The previous message is in the log.' : null,
      );

    case 'clear':
      return {
        ...state,
        positions: state.settings.positions,
        input: '',
        output: '',
        lastPress: null,
        notice: state.input.length > 0 ? 'Message cleared. Rotors back at the start positions.' : null,
      };

    case 'turn': {
      const positions = [...state.positions] as [number, number, number];
      positions[action.slot] = mod26(positions[action.slot] + action.delta);
      const settings = { ...state.settings, positions };
      if (state.input.length === 0) {
        return { ...state, settings, positions, lastPress: null, notice: null };
      }
      return startNewMessage(
        state,
        settings,
        'Rotor turned by hand: the message so far is in the log, and a new one starts here.',
      );
    }

    case 'settings': {
      if (validateSettings(action.settings).length > 0) return state;
      return startNewMessage(state, action.settings, action.notice ?? null);
    }

    case 'decipher-entry': {
      const entry = state.log.find((e) => e.id === action.id);
      if (!entry) return state;
      const fresh = startNewMessage(state, entry.settings, null);
      return {
        ...typeLetters(fresh, entry.output),
        notice: 'Key sheet restored from the log and the output typed back in.',
      };
    }

    case 'notice':
      return { ...state, notice: action.text };
  }
}
