import { parsePlugboard, type MachineSettings } from '../enigma';
import { CopyButton } from './CopyButton';

/** Operation Barbarossa, 7 July 1941 (Sullivan & Weierud, Cryptologia 29(3), 2005). Verified in the test suite. */
export const BARBAROSSA = {
  settings: {
    reflector: 'B',
    rotors: ['II', 'IV', 'V'],
    rings: [1, 20, 11],
    positions: [22, 23, 2], // W X C
    plugboard: parsePlugboard('AV BS CG DL FU HZ IN KM OW RX').pairs,
  } satisfies MachineSettings as MachineSettings,
  messageKey: [1, 11, 0] as const, // B L A
  ciphertext:
    'EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE FGUEY SIOZV EQMIK UBPMM YLKLT TDEIS MDICA GYKUA CTCDO MOHWX MUUIA UBSTS LRNBZ SZWNR FXWFY SSXJZ VIJHI DISHP RKLKA YUPAD TXQSP INQMA TLPIF SVKDA SCTAC DPBOP VHJK',
};

interface GuideProps {
  onLoadKey: (settings: MachineSettings, notice: string) => void;
  onLoadAndType: (settings: MachineSettings, text: string, notice: string) => void;
}

export function Guide({ onLoadKey, onLoadAndType }: GuideProps) {
  return (
    <section className="guide" id="guide" aria-labelledby="guide-title">
      <header className="guide-head">
        <p className="kicker">Gallery notes</p>
        <h2 id="guide-title">Guide</h2>
      </header>

      <div className="placards">
        <article className="paper placard placard-wide">
          <h3>What each part does</h3>
          <p className="placard-lede">In the order the current flows when you press a key:</p>
          <dl className="parts">
            <dt>Keyboard <span>Tastatur</span></dt>
            <dd>26 keys in German QWERTZ order. Pressing one first steps the rotors, then closes the circuit.</dd>
            <dt>Plugboard <span>Steckerbrett</span></dt>
            <dd>
              Each cable swaps two letters, once on the way in and again on the way out. It multiplied the number of
              possible keys enormously; ten cables were standard from 1939.
            </dd>
            <dt>Entry wheel <span>Eintrittswalze</span></dt>
            <dd>A fixed wheel that hands the current to the rotors. On military machines it is wired straight: A to A.</dd>
            <dt>Rotors <span>Walzen</span></dt>
            <dd>
              Each rotor scrambles the alphabet through 26 internal wires. Five were issued (I–V); three are fitted, in
              any order. The right rotor steps on every key and a notch carries the next one along, like an odometer,
              with one quirk: the middle rotor <em>double-steps</em>.
            </dd>
            <dt>Ring setting <span>Ringstellung</span></dt>
            <dd>
              Turns the wiring relative to the letters on the rotor’s rim. It changes the substitution but not the
              letter at which the notch trips the next rotor.
            </dd>
            <dt>Reflector <span>Umkehrwalze</span></dt>
            <dd>
              Sends the current back through the rotors by a different route. This makes encrypting and decrypting the
              same operation, and means a letter can never encrypt to itself, a weakness the codebreakers exploited.
            </dd>
            <dt>Lampboard <span>Lampenfeld</span></dt>
            <dd>The lamp of the resulting letter lights for as long as the key is held down.</dd>
          </dl>
          <p className="placard-foot">
            Follow a keypress through all of these in the <a href="#signal">signal path</a>.
          </p>
        </article>

        <article className="paper placard">
          <h3>Encrypt a message</h3>
          <ol className="steps">
            <li>
              Choose a key in the <b>key sheet</b>: reflector, rotor order, ring settings, plugboard and start positions.
              The defaults work fine for a first try.
            </li>
            <li>
              Type your message. The top line of the tape shows the keys you press; the bottom line shows the lamps: that
              is your ciphertext.
            </li>
            <li>
              Press <b>Copy output</b>, and keep the key line under the tape. Anyone decrypting needs exactly that key.
            </li>
          </ol>
          <p className="placard-foot">
            Quick check: with the default key, typing <span className="mono">AAAAA</span> gives{' '}
            <span className="mono">BDZGO</span>, the standard test used in Enigma references.
          </p>
        </article>

        <article className="paper placard">
          <h3>Decrypt a message</h3>
          <ol className="steps">
            <li>
              Set exactly the same key and start positions. Straight after encrypting, just press{' '}
              <b>Restore start positions</b>.
            </li>
            <li>
              Type the ciphertext, or paste it into <b>Type or paste a longer text</b>. The lamps spell out the original
              letters.
            </li>
          </ol>
          <p className="placard-foot">
            There is no separate decrypt mode. Thanks to the reflector, the same settings that turn A into G also turn G
            into A.
          </p>
        </article>

        <article className="paper placard">
          <h3>Spaces, numbers and punctuation</h3>
          <p>The machine has only the 26 letters, so this simulator applies one rule everywhere:</p>
          <ul className="rules">
            <li>Letters are upper-cased and accents removed (é → E, ä → A, ß → SS).</li>
            <li>Spaces, digits, punctuation and line breaks are skipped. They never reach the machine and never step the rotors.</li>
            <li>Output is written in five-letter groups, as operators did. The gaps mean nothing and are ignored when you type or paste the text back.</li>
          </ul>
          <p className="placard-foot">
            So a decrypted message comes back without spaces: <span className="mono">ATTACKATDAWN</span>. Operators wrote{' '}
            <span className="mono">X</span> for a full stop or word break and spelled numbers out.
          </p>
        </article>

        <article className="paper placard">
          <h3>Keyboard and screen readers</h3>
          <ul className="rules">
            <li>
              <kbd>A</kbd>–<kbd>Z</kbd> press the machine’s keys whenever you are not in a text field. <kbd>Backspace</kbd>{' '}
              undoes the last letter.
            </li>
            <li>
              Rotor windows: <kbd>Tab</kbd> to one, then <kbd>↑</kbd> <kbd>↓</kbd>, or type the letter you want.
            </li>
            <li>
              The machine’s keys and the plugboard are one <kbd>Tab</kbd> stop each: move with the arrow keys and press{' '}
              <kbd>Enter</kbd>.
            </li>
            <li>
              Each keypress is announced, for example “A, lamp B”. The text box under the tape is the easiest way to enter
              longer text with a screen reader.
            </li>
          </ul>
        </article>

        <article className="paper placard placard-full">
          <h3>Decrypt a real message: 7 July 1941</h3>
          <p>
            A reconnaissance report sent during Operation Barbarossa, published by Geoff Sullivan and Frode Weierud. The
            sender chose the message key <span className="mono">BLA</span>, enciphered it at the day’s Grundstellung{' '}
            <span className="mono">WXC</span> and sent <span className="mono">KCH</span> in the header.
          </p>
          <ol className="steps">
            <li>
              <button
                type="button"
                className="btn btn-small"
                data-testid="barbarossa-key"
                onClick={() =>
                  onLoadKey(
                    BARBAROSSA.settings,
                    '7 July 1941 key loaded: UKW B, rotors II IV V, rings 02 21 12, ten cables, rotors at WXC.',
                  )
                }
              >
                Load the day’s key
              </button>{' '}
              UKW B, rotors II IV V, rings 02 21 12, cables AV BS CG DL FU HZ IN KM OW RX, rotors at{' '}
              <span className="mono">WXC</span>.
            </li>
            <li>
              Type <span className="mono">KCH</span>. The lamps show <span className="mono">B L A</span>: the message
              key.
            </li>
            <li>
              Turn the rotors to <span className="mono">BLA</span> and type the ciphertext, or let the machine do it:{' '}
              <button
                type="button"
                className="btn btn-small"
                data-testid="barbarossa-type"
                onClick={() =>
                  onLoadAndType(
                    { ...BARBAROSSA.settings, positions: BARBAROSSA.messageKey },
                    BARBAROSSA.ciphertext,
                    'Rotors set to BLA and the 1941 ciphertext typed in.',
                  )
                }
              >
                Set BLA and type the message
              </button>
            </li>
          </ol>
          <p className="mono cipher-block">{BARBAROSSA.ciphertext}</p>
          <div className="placard-actions">
            <CopyButton text={BARBAROSSA.ciphertext} label="Copy ciphertext" className="btn btn-small" />
          </div>
          <p className="placard-foot">
            It begins <span className="mono">AUFKLXABTEILUNGXVONXKURTINOWA</span>: “Aufkl. Abteilung von Kurtinowa”,
            reconnaissance battalion from Kurtinowa. Each X stands for a word break.
          </p>
        </article>


        <article className="paper placard placard-full">
          <h3>What this simulator covers</h3>
          <p>
            <b>Included:</b> the Wehrmacht Enigma I and the Kriegsmarine M3, which encrypt identically with rotors I–V.
            Reflectors B and C, ring settings, 0–13 plugboard cables, and exact stepping including the double step. As
            on the real machine, each rotor can be fitted only once. Verified against published 1941 messages and an
            independent implementation.
          </p>
          <p>
            <b>Not included:</b> the naval rotors VI–VIII (two notches each); the four-rotor M4 with its Greek wheels and
            thin reflectors; reflector A (used until 1937) and the rewirable UKW-D (1944); the Enigma-Uhr plugboard
            attachment; commercial, Abwehr, railway and Swiss models, which differ in wiring, entry wheel or stepping.
            Operating procedures such as doubled indicators and Kenngruppen are not enforced, but you can carry them out
            by hand, as in the 1941 example.
          </p>
          <p className="placard-foot">
            Conveniences the real machine did not have: undo, pasted text, the log and the signal-path trace.
          </p>
        </article>
      </div>
    </section>
  );
}
