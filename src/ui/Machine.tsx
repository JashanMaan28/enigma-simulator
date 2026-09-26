import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  KEYBOARD_ROWS,
  indexToLetter,
  letterToIndex,
  mod26,
  partnerOf,
  plugIn,
  ringNumber,
  unplug,
  type PlugPair,
  type ReflectorName,
  type RotorName,
  type Triple,
} from '../enigma';
import { useRovingGrid } from './useRovingGrid';

const SLOT_NAMES = ['Left', 'Middle', 'Right'] as const;

/* ------------------------------------------------------------------ */
/* Rotor windows                                                       */
/* ------------------------------------------------------------------ */

interface RotorBayProps {
  reflector: ReflectorName;
  rotors: Triple<RotorName>;
  rings: Triple<number>;
  positions: Triple<number>;
  onTurn: (slot: 0 | 1 | 2, delta: number) => void;
}

export function RotorBay({ reflector, rotors, rings, positions, onTurn }: RotorBayProps) {
  return (
    <div className="rotor-bay">
      <div className="ukw-plate" title="Umkehrwalze (reflector) — change it in the key sheet">
        <span className="engraved">UKW</span>
        <span className="ukw-letter">{reflector}</span>
      </div>
      <div className="rotor-row" role="group" aria-label="Rotors. Use the up and down arrows, or type a letter, to set each one.">
        {([0, 1, 2] as const).map((i) => (
          <RotorUnit
            key={i}
            slot={i}
            rotor={rotors[i]}
            ring={rings[i]}
            position={positions[i]}
            onTurn={(delta) => onTurn(i, delta)}
          />
        ))}
      </div>
      <div className="etw-plate" aria-hidden="true">
        <span className="engraved">ETW</span>
      </div>
    </div>
  );
}

interface RotorUnitProps {
  slot: 0 | 1 | 2;
  rotor: RotorName;
  ring: number;
  position: number;
  onTurn: (delta: number) => void;
}

function RotorUnit({ slot, rotor, ring, position, onTurn }: RotorUnitProps) {
  // Track the previous position to roll the letter drum in the right direction.
  const [roll, setRoll] = useState({ pos: position, dir: 0, n: 0 });
  if (roll.pos !== position) {
    const d = mod26(position - roll.pos);
    setRoll({ pos: position, dir: d === 1 ? 1 : d === 25 ? -1 : 0, n: roll.n + 1 });
  }

  const name = `${SLOT_NAMES[slot]} rotor`;
  const letter = indexToLetter(position);
  const strip = [-2, -1, 0, 1, 2].map((o) => indexToLetter(mod26(position + o)));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let delta: number | null = null;
    if (e.key === 'ArrowUp') delta = 1;
    else if (e.key === 'ArrowDown') delta = -1;
    else if (e.key === 'PageUp') delta = 5;
    else if (e.key === 'PageDown') delta = -5;
    else if (e.key === 'Home') delta = -position;
    else if (e.key === 'End') delta = 25 - position;
    else if (e.key.length === 1 && /[a-z]/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      delta = letterToIndex(e.key) - position;
    }
    if (delta === null) return;
    e.preventDefault();
    if (delta !== 0) onTurn(delta);
  };

  return (
    <div className="rotor-unit" data-slot={SLOT_NAMES[slot].toLowerCase()}>
      <div className="rotor-assembly">
        <div
          className="rotor-window"
          role="spinbutton"
          tabIndex={0}
          aria-label={`${name}, wheel ${rotor}, ring ${ringNumber(ring)}`}
          aria-valuemin={1}
          aria-valuemax={26}
          aria-valuenow={position + 1}
          aria-valuetext={letter}
          onKeyDown={onKeyDown}
          data-testid={`rotor-${slot}`}
          data-letter={letter}
        >
          <div
            key={roll.n}
            className={`rotor-strip${roll.dir === 1 ? ' roll-fwd' : roll.dir === -1 ? ' roll-back' : ''}`}
            aria-hidden="true"
          >
            {strip.map((l, i) => (
              <span key={i} className={i === 2 ? 'is-current' : undefined}>
                {l}
              </span>
            ))}
          </div>
        </div>
        <div className="thumbwheel">
          <span
            key={roll.n}
            className={`ribs${roll.dir === 1 ? ' roll-fwd' : roll.dir === -1 ? ' roll-back' : ''}`}
            aria-hidden="true"
          />
          <button type="button" tabIndex={-1} className="thumb thumb-up" aria-label={`Turn ${name} forward`} onClick={() => onTurn(1)}>
            <span aria-hidden="true">▴</span>
          </button>
          <button type="button" tabIndex={-1} className="thumb thumb-down" aria-label={`Turn ${name} back`} onClick={() => onTurn(-1)}>
            <span aria-hidden="true">▾</span>
          </button>
        </div>
      </div>
      <div className="rotor-caption" aria-hidden="true">
        <span className="rotor-numeral">{rotor}</span>
        <span className="rotor-ring">Ring {ringNumber(ring)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lampboard                                                           */
/* ------------------------------------------------------------------ */

export function Lampboard({ lit }: { lit: number | null }) {
  const litLetter = lit === null ? null : indexToLetter(lit);
  return (
    <div
      className="lampboard"
      role="img"
      aria-label={litLetter ? `Lampboard: lamp ${litLetter} is lit` : 'Lampboard: no lamp lit'}
    >
      {KEYBOARD_ROWS.map((row) => (
        <div className="lamp-row" key={row}>
          {Array.from(row, (l) => (
            <span key={l} className={`lamp${l === litLetter ? ' is-lit' : ''}`} data-testid={`lamp-${l}`}>
              <span className="lamp-letter">{l}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Keyboard                                                            */
/* ------------------------------------------------------------------ */

interface KeyboardProps {
  held: number | null;
  onDown: (key: number) => void;
  onUp: (key: number) => void;
  /** Press-and-release for keyboard / assistive-technology activation. */
  onTap: (key: number) => void;
}

export function Keyboard({ held, onDown, onUp, onTap }: KeyboardProps) {
  const roving = useRovingGrid();

  const pointerDown = (e: PointerEvent<HTMLButtonElement>, key: number) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onDown(key);
  };
  // onUp ignores keys that are not currently held, so it is safe to call from every end-of-press event.
  const pointerEnd = (key: number) => onUp(key);

  return (
    <div className="keyboard" role="group" aria-label="Keyboard. Type with your own keyboard, or use the arrow keys here and press Enter.">
      {KEYBOARD_ROWS.map((row) => (
        <div className="key-row" key={row}>
          {Array.from(row, (l) => {
            const key = letterToIndex(l);
            return (
              <button
                key={l}
                type="button"
                ref={roving.register(l)}
                tabIndex={roving.tabIndex(l)}
                className={`key${held === key ? ' is-down' : ''}`}
                data-testid={`key-${l}`}
                onPointerDown={(e) => pointerDown(e, key)}
                onPointerUp={() => pointerEnd(key)}
                onPointerCancel={() => pointerEnd(key)}
                onLostPointerCapture={() => pointerEnd(key)}
                onClick={(e) => {
                  // detail === 0: activated by Enter/Space or a screen reader, not a pointer.
                  if (e.detail === 0) onTap(key);
                }}
                onKeyDown={(e) => roving.onKeyDown(e, l)}
                onFocus={() => roving.setActive(l)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <span className="key-cap">{l}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plugboard                                                           */
/* ------------------------------------------------------------------ */

interface PlugboardProps {
  pairs: readonly PlugPair[];
  onChange: (pairs: PlugPair[], message: string) => void;
  onAnnounce: (message: string) => void;
}

export function Plugboard({ pairs, onChange, onAnnounce }: PlugboardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const roving = useRovingGrid();
  const hoveredPartner = hovered === null ? undefined : partnerOf(pairs, hovered);

  const choose = (socket: number) => {
    const L = indexToLetter(socket);
    const partner = partnerOf(pairs, socket);
    if (selected === null) {
      if (partner !== undefined) {
        onChange(unplug(pairs, socket), `Cable ${L}–${indexToLetter(partner)} removed.`);
      } else {
        setSelected(socket);
        onAnnounce(`${L} selected. Choose the socket to connect it to, or press Escape to cancel.`);
      }
      return;
    }
    if (selected === socket) {
      setSelected(null);
      onAnnounce('Selection cancelled.');
      return;
    }
    const S = indexToLetter(selected);
    const moved = [partnerOf(pairs, selected), partner].filter((p): p is number => p !== undefined);
    const note = moved.length ? ` (${moved.map(indexToLetter).join(' and ')} now unplugged)` : '';
    onChange(plugIn(pairs, selected, socket), `Cable ${S}–${L} connected${note}.`);
    setSelected(null);
  };

  return (
    <div className="plugboard" onKeyDown={(e) => {
      if (e.key === 'Escape' && selected !== null) {
        setSelected(null);
        onAnnounce('Selection cancelled.');
      }
    }}>
      <div className="plugboard-title" aria-hidden="true">
        <span className="engraved">Steckerbrett</span>
        <span className="plugboard-count">{pairs.length} {pairs.length === 1 ? 'cable' : 'cables'}</span>
      </div>
      <div
        className="socket-grid"
        role="group"
        aria-label={`Plugboard, ${pairs.length} cables. Choose two sockets to connect them; choose a plugged socket to remove its cable.`}
      >
        {KEYBOARD_ROWS.map((row) => (
          <div className="socket-row" key={row}>
            {Array.from(row, (l) => {
              const socket = letterToIndex(l);
              const partner = partnerOf(pairs, socket);
              const P = partner === undefined ? null : indexToLetter(partner);
              const classes = [
                'socket',
                P ? 'is-plugged' : '',
                selected === socket ? 'is-selected' : '',
                hoveredPartner === socket ? 'is-partner' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={l}
                  type="button"
                  ref={roving.register(l)}
                  tabIndex={roving.tabIndex(l)}
                  className={classes}
                  data-testid={`socket-${l}`}
                  aria-label={P ? `Socket ${l}, cabled to ${P}` : `Socket ${l}, empty`}
                  aria-pressed={selected === socket}
                  onClick={() => choose(socket)}
                  onKeyDown={(e) => roving.onKeyDown(e, l)}
                  onFocus={() => {
                    roving.setActive(l);
                    setHovered(socket);
                  }}
                  onBlur={() => setHovered(null)}
                  onPointerEnter={() => setHovered(socket)}
                  onPointerLeave={() => setHovered(null)}
                >
                  <span className="socket-label" aria-hidden="true">{l}</span>
                  <span className="socket-plate" aria-hidden="true">
                    <span className="socket-hole" />
                    <span className="socket-hole" />
                    {P && <span className="plug">{P}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
