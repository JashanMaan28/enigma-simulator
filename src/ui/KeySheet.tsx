import { useId, useState } from 'react';
import {
  ALPHABET,
  DEFAULT_SETTINGS,
  MAX_CABLES,
  REFLECTORS,
  REFLECTOR_NAMES,
  ROTORS,
  ROTOR_NAMES,
  STANDARD_CABLE_COUNT,
  formatPlugboard,
  parsePlugboard,
  ringNumber,
  type MachineSettings,
  type PlugPair,
  type RotorName,
  type Triple,
} from '../enigma';

interface KeySheetProps {
  settings: MachineSettings;
  messageInProgress: boolean;
  onChange: (settings: MachineSettings, notice?: string) => void;
}

const SLOTS = ['Left', 'Middle', 'Right'] as const;

function setAt<T>(triple: Triple<T>, i: number, value: T): Triple<T> {
  const copy = [...triple] as [T, T, T];
  copy[i] = value;
  return copy;
}

function randomInt(n: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] as number) % n;
}

/** A random daily key in the style of a 1940s key sheet: three different rotors and ten cables. */
export function randomKey(): MachineSettings {
  const pool = [...ROTOR_NAMES];
  const rotors = [0, 1, 2].map(() => pool.splice(randomInt(pool.length), 1)[0]) as unknown as Triple<RotorName>;
  const letters = Array.from({ length: 26 }, (_, i) => i);
  for (let i = 25; i > 0; i--) {
    const j = randomInt(i + 1);
    [letters[i], letters[j]] = [letters[j] as number, letters[i] as number];
  }
  const plugboard: PlugPair[] = Array.from({ length: STANDARD_CABLE_COUNT }, (_, i) => [
    letters[2 * i] as number,
    letters[2 * i + 1] as number,
  ]);
  return {
    reflector: randomInt(2) === 0 ? 'B' : 'C',
    rotors,
    rings: [randomInt(26), randomInt(26), randomInt(26)],
    positions: [randomInt(26), randomInt(26), randomInt(26)],
    plugboard,
  };
}

export function KeySheet({ settings, messageInProgress, onChange }: KeySheetProps) {
  const id = useId();
  const canonical = formatPlugboard(settings.plugboard);
  const [draft, setDraft] = useState(canonical);
  const [focused, setFocused] = useState(false);
  const [seen, setSeen] = useState(canonical);

  // When the board changes elsewhere (clicking sockets, loading a key), refresh the text.
  if (seen !== canonical) {
    setSeen(canonical);
    const parsed = parsePlugboard(draft);
    if (parsed.errors.length > 0 || formatPlugboard(parsed.pairs) !== canonical) setDraft(canonical);
  }

  const parsed = parsePlugboard(draft);
  const trailing = draft.trimEnd() === draft ? draft.split(/[\s,;]+/).at(-1) ?? '' : '';
  const onlyUnfinished =
    focused && parsed.errors.length === 1 && parsed.errors[0]?.code === 'not-a-pair' && /^[a-z]$/i.test(trailing);
  const showErrors = parsed.errors.length > 0 && !onlyUnfinished;

  const update = (next: MachineSettings, notice?: string) => onChange(next, notice);

  const chooseRotor = (slot: number, rotor: RotorName) => {
    const other = settings.rotors.indexOf(rotor);
    let rotors = setAt(settings.rotors, slot, rotor);
    // A machine has one of each rotor: picking one that is already fitted swaps the two.
    if (other !== -1 && other !== slot) rotors = setAt(rotors, other, settings.rotors[slot] as RotorName);
    update({ ...settings, rotors });
  };

  const cables = parsed.errors.length === 0 ? parsed.pairs.length : settings.plugboard.length;

  return (
    <section className="paper keysheet" aria-labelledby={`${id}-title`}>
      <header className="paper-head">
        <p className="kicker">Schlüsseltafel</p>
        <h2 id={`${id}-title`}>Key sheet</h2>
        <p className="paper-sub">
          The daily settings both operators must share.
          {messageInProgress && ' Changing any of them starts a new message; the current one is kept in the log.'}
        </p>
      </header>

      <fieldset className="ks-row">
        <legend>
          Reflector <span className="ks-de">Umkehrwalze</span>
        </legend>
        <div className="segmented">
          {REFLECTOR_NAMES.map((r) => (
            <label key={r} className={settings.reflector === r ? 'is-on' : undefined}>
              <input
                type="radio"
                name={`${id}-ukw`}
                value={r}
                checked={settings.reflector === r}
                onChange={() => update({ ...settings, reflector: r })}
                data-testid={`ukw-${r}`}
              />
              <span>UKW {r}</span>
              <small>from {REFLECTORS[r].introduced}</small>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="ks-row">
        <legend>
          Rotor order <span className="ks-de">Walzenlage</span>
        </legend>
        <div className="ks-triple">
          {SLOTS.map((slot, i) => (
            <label key={slot} className="ks-field">
              <span className="ks-label">{slot}</span>
              <select
                value={settings.rotors[i]}
                onChange={(e) => chooseRotor(i, e.target.value as RotorName)}
                data-testid={`rotor-select-${i}`}
              >
                {ROTOR_NAMES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="ks-help">
          Each rotor turns the one to its left as it leaves its notch letter:{' '}
          {ROTOR_NAMES.map((r) => `${r} ${ROTORS[r].turnover}`).join(' · ')}. Choosing a rotor that is already fitted swaps
          the two.
        </p>
      </fieldset>

      <fieldset className="ks-row">
        <legend>
          Ring settings <span className="ks-de">Ringstellung</span>
        </legend>
        <div className="ks-triple">
          {SLOTS.map((slot, i) => (
            <label key={slot} className="ks-field">
              <span className="ks-label">{slot}</span>
              <select
                value={settings.rings[i]}
                onChange={(e) => update({ ...settings, rings: setAt(settings.rings, i, Number(e.target.value)) })}
                data-testid={`ring-select-${i}`}
              >
                {Array.from(ALPHABET, (l, n) => (
                  <option key={l} value={n}>
                    {ringNumber(n)} ({l})
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="ks-row">
        <legend>
          Start positions <span className="ks-de">Grundstellung</span>
        </legend>
        <div className="ks-triple">
          {SLOTS.map((slot, i) => (
            <label key={slot} className="ks-field">
              <span className="ks-label">{slot}</span>
              <select
                value={settings.positions[i]}
                onChange={(e) =>
                  update({ ...settings, positions: setAt(settings.positions, i, Number(e.target.value)) })
                }
                data-testid={`position-select-${i}`}
              >
                {Array.from(ALPHABET, (l, n) => (
                  <option key={l} value={n}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="ks-help">You can also turn the rotors on the machine before typing.</p>
      </fieldset>

      <div className="ks-row">
        <label className="ks-legend" htmlFor={`${id}-plugs`}>
          Plugboard pairs <span className="ks-de">Steckerverbindungen</span>
        </label>
        <input
          id={`${id}-plugs`}
          className={`ks-plugs mono${showErrors ? ' is-invalid' : ''}`}
          type="text"
          value={draft}
          spellCheck={false}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="e.g. AV BS CG DL FU HZ IN KM OW RX"
          aria-invalid={showErrors}
          aria-describedby={`${id}-plugs-help`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const text = e.target.value;
            setDraft(text);
            const result = parsePlugboard(text);
            if (result.errors.length === 0 && formatPlugboard(result.pairs) !== canonical) {
              update({ ...settings, plugboard: result.pairs });
            }
          }}
          data-testid="plugboard-input"
        />
        <div id={`${id}-plugs-help`} className="ks-plug-help" aria-live="polite">
          {showErrors ? (
            <ul className="ks-errors" data-testid="plugboard-errors">
              {parsed.errors.map((e, k) => (
                <li key={k}>{e.message}</li>
              ))}
              <li className="ks-still">
                The machine keeps the last valid board: <span className="mono">{canonical || 'no cables'}</span>.
              </li>
            </ul>
          ) : onlyUnfinished ? (
            <p className="ks-help">Type the second letter of the pair.</p>
          ) : (
            <p className="ks-help">
              {cables} of {MAX_CABLES} possible cables. Two letters per cable, separated by spaces; each letter once.
              From 1939 the army issued {STANDARD_CABLE_COUNT}. You can also click the sockets on the machine.
            </p>
          )}
        </div>
      </div>

      <div className="ks-actions">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => update(DEFAULT_SETTINGS, 'Key sheet reset: UKW B, rotors I II III, rings 01 01 01, start AAA, no cables.')}
          data-testid="defaults"
        >
          Reset to defaults
        </button>
        <button type="button" className="btn btn-small" onClick={() => update(randomKey(), 'A random daily key has been set.')}>
          Random daily key
        </button>
      </div>
    </section>
  );
}
