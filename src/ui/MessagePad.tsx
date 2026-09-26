import { useEffect, useId, useRef, useState } from 'react';
import { countSkipped, groupLetters, positionsText, toMachineLetters, type MachineSettings, type Triple } from '../enigma';
import { CopyButton } from './CopyButton';
import { keyLine } from './format';

interface MessagePadProps {
  settings: MachineSettings;
  positions: Triple<number>;
  input: string;
  output: string;
  notice: string | null;
  skipNote: string | null;
  onRestore: () => void;
  onClear: () => void;
  onUndo: () => void;
  onFeed: (text: string) => void;
  onAnnounce: (message: string) => void;
  shareLink: string;
}

export function MessagePad(props: MessagePadProps) {
  const { settings, positions, input, output, notice, skipNote } = props;
  const [draft, setDraft] = useState('');
  const tapeRef = useRef<HTMLDivElement>(null);
  const feedId = useId();
  const hintId = useId();

  // Keep the newest letters in view as the tape grows.
  useEffect(() => {
    const tape = tapeRef.current;
    if (tape) tape.scrollTop = tape.scrollHeight;
  }, [input.length]);

  const groups: { i: string; o: string }[] = [];
  for (let k = 0; k < input.length; k += 5) groups.push({ i: input.slice(k, k + 5), o: output.slice(k, k + 5) });

  const draftLetters = toMachineLetters(draft);
  const skipped = countSkipped(draft);
  const atStart = positionsText(positions) === positionsText(settings.positions);

  return (
    <section className="paper pad" aria-labelledby="pad-title">
      <header className="paper-head">
        <p className="kicker">Funkspruch</p>
        <h2 id="pad-title">Message</h2>
        <p className="pad-status" data-testid="pad-status">
          <span>
            Rotors <b className="mono">{positionsText(positions)}</b>
          </span>
          <span>
            Start <b className="mono">{positionsText(settings.positions)}</b>
          </span>
          <span>
            <b className="mono" data-testid="letter-count">{input.length}</b> {input.length === 1 ? 'letter' : 'letters'}
          </span>
        </p>
      </header>

      <div className="tape-legend" aria-hidden="true">
        <span><i className="swatch swatch-in" /> Keys pressed</span>
        <span><i className="swatch swatch-out" /> Lamps lit</span>
      </div>

      <div className="tape" ref={tapeRef} data-testid="tape" data-input={input} data-output={output}>
        {input.length === 0 ? (
          <p className="tape-empty">
            Type with your keyboard or press the machine’s keys. Each letter you press appears here above the letter that
            lit up.
          </p>
        ) : (
          <div className="tape-groups" aria-hidden="true">
            {groups.map((g, k) => (
              <span className="tape-group" key={k}>
                <span className="tape-in">{g.i}</span>
                <span className="tape-out">{g.o}</span>
              </span>
            ))}
            <span className="tape-caret" />
          </div>
        )}
        {input.length > 0 && (
          <div className="sr-only">
            <p>Input: {groupLetters(input)}</p>
            <p>Output: {groupLetters(output)}</p>
          </div>
        )}
      </div>
      <div className="pad-notes" aria-live="polite">
        {skipNote ? <p className="note">{skipNote}</p> : notice ? <p className="note">{notice}</p> : null}
      </div>

      <div className="pad-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={props.onRestore}
          disabled={atStart && input.length === 0}
          data-testid="restore"
        >
          Restore start positions
        </button>
        <button type="button" className="btn" onClick={props.onClear} disabled={input.length === 0} data-testid="clear">
          Clear message
        </button>
        <CopyButton
          text={groupLetters(output)}
          label="Copy output"
          disabled={output.length === 0}
          testId="copy-output"
          onCopied={(ok) => props.onAnnounce(ok ? 'Output copied to the clipboard.' : 'Could not copy the output.')}
        />
        <button
          type="button"
          className="btn btn-quiet"
          onClick={props.onUndo}
          disabled={input.length === 0}
          aria-keyshortcuts="Backspace"
          data-testid="undo"
        >
          Undo letter <kbd>⌫</kbd>
        </button>
      </div>
      <p className="pad-help">
        <b>Restore start positions</b> turns the rotors back to <span className="mono">{positionsText(settings.positions)}</span>{' '}
        and files this message in the log, so you can type the ciphertext back in to decrypt it. <b>Clear</b> discards
        the message.
      </p>

      <form
        className="feed"
        onSubmit={(e) => {
          e.preventDefault();
          if (draftLetters.length === 0) return;
          props.onFeed(draft);
          setDraft('');
        }}
      >
        <label htmlFor={feedId}>Type or paste a longer text</label>
        <textarea
          id={feedId}
          value={draft}
          rows={2}
          spellCheck={false}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="e.g. Attack at dawn — or a ciphertext to decrypt"
          aria-describedby={hintId}
          onChange={(e) => setDraft(e.target.value)}
          data-testid="feed-input"
        />
        <div className="feed-row">
          <p id={hintId} className="feed-hint">
            {draft.length === 0
              ? 'Only the letters A–Z go through the machine; spaces, digits and punctuation are skipped.'
              : `${draftLetters.length} ${draftLetters.length === 1 ? 'letter' : 'letters'} will be typed${
                  skipped ? `, ${skipped} ${skipped === 1 ? 'character' : 'characters'} skipped` : ''
                }.`}
          </p>
          <button type="submit" className="btn" disabled={draftLetters.length === 0} data-testid="feed-submit">
            Type into machine
          </button>
        </div>
      </form>

      <div className="key-line">
        <p className="kicker">Current key — everything needed to reproduce this output</p>
        <p className="mono key-line-text" data-testid="key-line">
          {keyLine(settings)}
        </p>
        <div className="key-line-actions">
          <CopyButton text={keyLine(settings)} label="Copy settings" className="btn btn-small" />
          <CopyButton text={props.shareLink} label="Copy link to these settings" className="btn btn-small" />
        </div>
      </div>
    </section>
  );
}
