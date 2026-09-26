import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parsePlugboard, positionsText, type MachineSettings } from '../enigma';
import { LOG_LIMIT, initialState, reducer, type Action, type AppState } from './state';

const run = (state: AppState, ...actions: Action[]) => actions.reduce(reducer, state);
const type = (text: string): Action => ({ type: 'feed', text });

const key: MachineSettings = {
  reflector: 'C',
  rotors: ['IV', 'II', 'V'],
  rings: [4, 17, 0],
  positions: [6, 4, 24], // G E Y
  plugboard: parsePlugboard('AR GK OX').pairs,
};

describe('message flow', () => {
  it('encrypt → restore start → type the ciphertext → recovers the plaintext', () => {
    let s = run(initialState(key), type('Meet me at the old mill, 9 pm.'));
    expect(s.input).toBe('MEETMEATTHEOLDMILLPM');
    const cipher = s.output;
    expect(cipher).not.toBe(s.input);

    s = run(s, { type: 'restore' });
    expect(s.input).toBe('');
    expect(s.positions).toEqual(key.positions);
    expect(s.log[0]?.output).toBe(cipher);

    s = run(s, type(cipher));
    expect(s.output).toBe('MEETMEATTHEOLDMILLPM');
  });

  it('press steps the rotors and records the signal path', () => {
    const s = run(initialState(), { type: 'press', key: 0 });
    expect(s.output).toBe('B');
    expect(positionsText(s.positions)).toBe('AAB');
    expect(s.lastPress?.path).toHaveLength(13);
  });

  it('undo removes the last letter and turns the rotors back', () => {
    const s = run(initialState(), type('AAAAA'), { type: 'undo' }, { type: 'undo' });
    expect(s.output).toBe('BDZ');
    expect(positionsText(s.positions)).toBe('AAD');
    expect(run(initialState(), { type: 'undo' })).toEqual(initialState());
  });

  it('clear discards the message without logging it', () => {
    const s = run(initialState(), type('HELLO'), { type: 'clear' });
    expect(s.input).toBe('');
    expect(s.log).toEqual([]);
    expect(s.positions).toEqual(DEFAULT_SETTINGS.positions);
  });

  it('turning a rotor with an empty message sets the start position', () => {
    const s = run(initialState(), { type: 'turn', slot: 0, delta: 1 }, { type: 'turn', slot: 2, delta: -1 });
    expect(positionsText(s.settings.positions)).toBe('BAZ');
    expect(s.positions).toEqual(s.settings.positions);
    expect(s.log).toEqual([]);
  });

  it('turning a rotor mid-message files the message and starts a new one from there', () => {
    const s = run(initialState(), type('ABC'), { type: 'turn', slot: 1, delta: 2 });
    expect(s.log).toHaveLength(1);
    expect(s.log[0]?.input).toBe('ABC');
    expect(positionsText(s.log[0]!.settings.positions)).toBe('AAA');
    expect(positionsText(s.settings.positions)).toBe('ACD');
    expect(s.input).toBe('');
  });

  it('changing the key sheet mid-message files the message with its original settings', () => {
    const s = run(initialState(), type('ABC'), { type: 'settings', settings: key });
    expect(s.log[0]?.settings).toEqual(DEFAULT_SETTINGS);
    expect(s.settings).toEqual(key);
    expect(s.positions).toEqual(key.positions);
  });

  it('ignores invalid settings', () => {
    const bad = { ...key, rotors: ['I', 'I', 'II'] } as unknown as MachineSettings;
    const s = run(initialState(), { type: 'settings', settings: bad });
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('“decipher” on a log entry restores its key and recovers its input', () => {
    let s = run(initialState(key), type('ENIGMA'), { type: 'restore' }, type('OTHERTEXT'));
    const id = s.log[0]!.id;
    s = run(s, { type: 'decipher-entry', id });
    expect(s.output).toBe('ENIGMA');
    expect(s.settings).toEqual(key);
    expect(s.log).toHaveLength(2); // "OTHERTEXT" was filed first
  });

  it('keeps at most LOG_LIMIT entries, newest first', () => {
    let s = initialState();
    for (let i = 0; i < LOG_LIMIT + 3; i++) s = run(s, type(`MSG${String.fromCharCode(65 + i)}`), { type: 'restore' });
    expect(s.log).toHaveLength(LOG_LIMIT);
    expect(s.log[0]?.input).toBe(`MSG${String.fromCharCode(65 + LOG_LIMIT + 2)}`);
  });
});
