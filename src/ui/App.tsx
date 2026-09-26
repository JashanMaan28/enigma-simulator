import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  indexToLetter,
  settingsFromQuery,
  settingsToQuery,
  stepRotors,
  toMachineLetters,
  type MachineSettings,
} from '../enigma';
import { Guide } from './Guide';
import { KeySheet } from './KeySheet';
import { Keyboard, Lampboard, Plugboard, RotorBay } from './Machine';
import { MessageLog } from './MessageLog';
import { MessagePad } from './MessagePad';
import { SignalPath } from './SignalPath';
import { playDetent, playKeyDown, playKeyUp, playPlug } from './sound';
import { initialState, reducer, type AppState } from './state';

/** A lamp stays lit at least this long, so quick taps are still visible. */
const MIN_LIT_MS = 160;
const SETTINGS_KEY = 'enigma.settings';
const SOUND_KEY = 'enigma.sound';
const LINK_PARAMS = /(^|&)(ukw|walzen|ringe|grund|stecker)=/i;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode); the app works without it.
  }
}

type LinkResult = { settings: MachineSettings; notice: string } | { settings: null; notice: string } | null;

/** Read a key from a shared link (#ukw=…&walzen=…), then remove it from the address bar. */
function readLink(): LinkResult {
  const hash = window.location.hash.slice(1);
  if (!hash || !LINK_PARAMS.test(hash)) return null;
  const fromLink = settingsFromQuery(hash, DEFAULT_SETTINGS);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return fromLink.ok
    ? { settings: fromLink.settings, notice: 'Key loaded from the link.' }
    : { settings: null, notice: `The link’s key could not be used: ${fromLink.problems.join(' ')}` };
}

/** Settings come from a shared link first, then from the last visit, then the defaults. */
function loadInitialState(): AppState {
  const link = readLink();
  if (link?.settings) return { ...initialState(link.settings), notice: link.notice };
  return { ...initialState(loadSaved()), notice: link?.notice ?? null };
}

function loadSaved(): MachineSettings {
  const saved = readStorage(SETTINGS_KEY);
  if (saved) {
    const parsed = settingsFromQuery(saved, DEFAULT_SETTINGS);
    if (parsed.ok) return parsed.settings;
  }
  return DEFAULT_SETTINGS;
}

/** Bring the machine into view (respecting reduced motion) and move focus there for keyboard users. */
function showMachine(): void {
  const machine = document.getElementById('machine');
  if (!machine) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  machine.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  machine.focus({ preventScroll: true });
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(target.type);
  return target.getAttribute('role') === 'spinbutton';
}

/** Controls where Space has its own meaning (activating a button, ticking a box…). */
function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('button, a[href], input, select, textarea, summary, [role="button"], [role="spinbutton"]') !== null
  );
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const [sound, setSound] = useState(() => readStorage(SOUND_KEY) === 'on');
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
    writeStorage(SOUND_KEY, sound ? 'on' : 'off');
  }, [sound]);

  useEffect(() => writeStorage(SETTINGS_KEY, settingsToQuery(state.settings)), [state.settings]);

  // A settings link opened while the app is already showing only changes the hash.
  useEffect(() => {
    const onHashChange = () => {
      const link = readLink();
      if (!link) return;
      if (link.settings) dispatch({ type: 'settings', settings: link.settings, notice: link.notice });
      else dispatch({ type: 'notice', text: link.notice });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  /* ----- announcements (one polite live region) ----- */
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((text: string) => {
    // Clear first so repeating the same text is announced again.
    setAnnouncement('');
    window.requestAnimationFrame(() => setAnnouncement(text));
  }, []);

  /* ----- keys and lamps ----- */
  const [held, setHeld] = useState<number | null>(null);
  const heldRef = useRef<number | null>(null);
  const heldCode = useRef<string | null>(null);
  const [lampOn, setLampOn] = useState(false);
  const litAt = useRef(0);
  const lampTimer = useRef<number | undefined>(undefined);
  const announceNextPress = useRef(false);

  const lampOffAfter = useCallback((ms: number) => {
    window.clearTimeout(lampTimer.current);
    lampTimer.current = window.setTimeout(() => setLampOn(false), ms);
  }, []);

  const release = useCallback(
    (key?: number) => {
      if (heldRef.current === null || (key !== undefined && heldRef.current !== key)) return;
      heldRef.current = null;
      heldCode.current = null;
      setHeld(null);
      lampOffAfter(Math.max(0, MIN_LIT_MS - (performance.now() - litAt.current)));
      if (soundRef.current) playKeyUp();
    },
    [lampOffAfter],
  );

  const press = useCallback(
    (key: number, code: string | null = null) => {
      if (heldRef.current !== null) {
        // Rolling onto the next key: the previous one springs back first.
        heldRef.current = null;
        setHeld(null);
      }
      const s = stateRef.current;
      const moved = stepRotors(s.settings.rotors, s.positions).moved.filter(Boolean).length;
      announceNextPress.current = true;
      dispatch({ type: 'press', key });
      heldRef.current = key;
      heldCode.current = code;
      setHeld(key);
      window.clearTimeout(lampTimer.current);
      setLampOn(true);
      litAt.current = performance.now();
      if (soundRef.current) playKeyDown(moved);
    },
    [],
  );

  const tap = useCallback(
    (key: number) => {
      press(key);
      window.setTimeout(() => release(key), MIN_LIT_MS + 60);
    },
    [press, release],
  );

  // Announce each keypress once the reducer has produced its result.
  useEffect(() => {
    const p = state.lastPress;
    if (p && announceNextPress.current) {
      announceNextPress.current = false;
      announce(`${indexToLetter(p.input)}, lamp ${indexToLetter(p.output)}`);
    }
  }, [state.lastPress, announce]);

  /* ----- skipped characters note ----- */
  const [skipNote, setSkipNote] = useState<string | null>(null);
  const skipTimer = useRef<number | undefined>(undefined);
  const noteSkipped = useCallback((ch: string) => {
    const shown = ch === ' ' ? 'Space' : `“${ch}”`;
    setSkipNote(`${shown} skipped: the machine has only the letters A–Z.`);
    window.clearTimeout(skipTimer.current);
    skipTimer.current = window.setTimeout(() => setSkipNote(null), 2600);
  }, []);

  /* ----- physical keyboard (attached during commit so no early keystroke is missed) ----- */
  useLayoutEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextEntry(e.target)) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (!e.repeat) dispatch({ type: 'undo' });
        return;
      }
      if (e.key.length !== 1) return;
      const letters = toMachineLetters(e.key);
      if (letters.length === 1) {
        e.preventDefault();
        if (e.repeat) return; // a real key cannot auto-repeat
        press(letters.charCodeAt(0) - 65, e.code);
        return;
      }
      if (e.key === ' ' && isInteractive(e.target)) return; // Space activates the focused control
      if (e.key === ' ') e.preventDefault(); // don't scroll the page while typing a message
      if (!e.repeat) noteSkipped(e.key);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (heldCode.current !== null && e.code === heldCode.current) release();
    };
    const onBlur = () => release();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [press, release, noteSkipped]);

  /* ----- actions ----- */
  const feed = useCallback(
    (text: string) => {
      const count = toMachineLetters(text).length;
      dispatch({ type: 'feed', text });
      setLampOn(true);
      lampOffAfter(700);
      announce(`${count} ${count === 1 ? 'letter' : 'letters'} typed into the machine.`);
    },
    [announce, lampOffAfter],
  );

  const changeSettings = useCallback(
    (settings: MachineSettings, notice?: string) => {
      dispatch({ type: 'settings', settings, notice });
      setLampOn(false);
      if (notice) announce(notice);
    },
    [announce],
  );

  const turn = useCallback((slot: 0 | 1 | 2, delta: number) => {
    dispatch({ type: 'turn', slot, delta });
    setLampOn(false);
    if (soundRef.current) playDetent();
  }, []);

  const shareLink = `${window.location.origin}${window.location.pathname}#${settingsToQuery(state.settings)}`;
  const lit = lampOn && state.lastPress ? state.lastPress.output : null;

  return (
    <>
      <a className="skip-link" href="#machine">
        Skip to the machine
      </a>
      <header className="exhibit-header">
        <div className="exhibit-label">
          <p className="kicker">Interactive exhibit · Cipher machines</p>
          <h1>Enigma I</h1>
          <p className="lede">
            Wehrmacht rotor cipher machine, 1932–1945. Three rotors, a reflector and a plugboard, working letter for
            letter like the original. Type to encrypt; type the result back in to decrypt.
          </p>
        </div>
        <nav className="exhibit-nav" aria-label="Sections">
          <a href="#guide">Guide</a>
          <a href="#signal">Signal path</a>
          <a href="#log">Log</a>
          <button
            type="button"
            className="sound-toggle"
            aria-pressed={sound}
            onClick={() => setSound((s) => !s)}
            data-testid="sound-toggle"
          >
            <span className="sound-dot" aria-hidden="true" />
            Sound {sound ? 'on' : 'off'}
          </button>
        </nav>
      </header>

      <main>
        <div className="exhibit">
          <div className="col col-machine">
            <section id="machine" className="machine" aria-label="Enigma machine" tabIndex={-1}>
              <div className="machine-panel">
                <RotorBay
                  reflector={state.settings.reflector}
                  rotors={state.settings.rotors}
                  rings={state.settings.rings}
                  positions={state.positions}
                  onTurn={turn}
                />
                <div className="nameplate" aria-hidden="true">
                  <span>ENIGMA</span>
                </div>
                <Lampboard lit={lit} />
                <div className="panel-rule" aria-hidden="true" />
                <Keyboard held={held} onDown={press} onUp={release} onTap={tap} />
              </div>
            </section>
            <div className="machine-front">
              <Plugboard
                pairs={state.settings.plugboard}
                onChange={(pairs, message) => {
                  changeSettings({ ...state.settings, plugboard: pairs });
                  announce(message);
                  if (soundRef.current) playPlug();
                }}
                onAnnounce={announce}
              />
            </div>
            <p className="machine-caption">
              Rotor windows show the rotor letters. Click above or below a wheel to turn it, or set everything in the key
              sheet.
            </p>
          </div>

          <div className="col col-side">
            <MessagePad
              settings={state.settings}
              positions={state.positions}
              input={state.input}
              output={state.output}
              notice={state.notice}
              skipNote={skipNote}
              onRestore={() => {
                dispatch({ type: 'restore' });
                setLampOn(false);
                announce('Rotors back at the start positions.');
              }}
              onClear={() => {
                dispatch({ type: 'clear' });
                setLampOn(false);
                announce('Message cleared.');
              }}
              onUndo={() => dispatch({ type: 'undo' })}
              onFeed={feed}
              onAnnounce={announce}
              shareLink={shareLink}
            />
            <KeySheet settings={state.settings} messageInProgress={state.input.length > 0} onChange={changeSettings} />
          </div>
        </div>

        <div className="lower">
          <SignalPath settings={state.settings} press={state.lastPress} />
          <MessageLog log={state.log} onDecipher={(id) => {
            dispatch({ type: 'decipher-entry', id });
            announce('Key restored from the log and the output typed back in.');
          }} />
        </div>

        <Guide
          onLoadKey={(settings, notice) => {
            changeSettings(settings, notice);
            showMachine();
          }}
          onLoadAndType={(settings, text, notice) => {
            changeSettings(settings, notice);
            feed(text);
            showMachine();
          }}
        />
      </main>

      <footer className="exhibit-footer">
        <p>
          Wiring and stepping follow the published Enigma I / M3 specifications and are checked against the 1941
          Operation Barbarossa messages (Sullivan &amp; Weierud) and an independent implementation. Settings are saved in
          this browser only.
        </p>
      </footer>

      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="announcer">
        {announcement}
      </div>
    </>
  );
}
