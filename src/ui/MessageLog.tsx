import { useId } from 'react';
import { groupLetters } from '../enigma';
import { CopyButton } from './CopyButton';
import { keyLine } from './format';
import type { LogEntry } from './state';

interface MessageLogProps {
  log: readonly LogEntry[];
  onDecipher: (id: number) => void;
}

export function MessageLog({ log, onDecipher }: MessageLogProps) {
  const titleId = useId();
  return (
    <section className="paper log" id="log" aria-labelledby={titleId}>
      <header className="paper-head">
        <p className="kicker">Betriebsbuch</p>
        <h2 id={titleId}>Log</h2>
        <p className="paper-sub">
          Finished messages are filed here, newest first, each with the key that produced it — when you restore the
          start positions, change the key sheet, or turn a rotor by hand mid-message.
        </p>
      </header>
      {log.length === 0 ? (
        <p className="log-empty">No messages yet.</p>
      ) : (
        <ol className="log-list" data-testid="log-list">
          {log.map((entry) => (
            <li key={entry.id} className="log-entry">
              <p className="log-key mono">{keyLine(entry.settings)}</p>
              <dl className="log-text">
                <dt>In</dt>
                <dd className="mono">{groupLetters(entry.input)}</dd>
                <dt>Out</dt>
                <dd className="mono" data-testid="log-output">
                  {groupLetters(entry.output)}
                </dd>
              </dl>
              <div className="log-actions">
                <CopyButton text={groupLetters(entry.output)} label="Copy output" className="btn btn-small" />
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => onDecipher(entry.id)}
                  data-testid="log-decipher"
                >
                  Set this key and type the output back in
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
