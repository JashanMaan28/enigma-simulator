import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { KEYBOARD_ROWS } from '../enigma';

/**
 * Roving tab-index over the three QWERTZ rows: the whole group is one Tab stop and
 * the arrow keys (plus Home/End) move between letters, as in an ARIA grid/toolbar.
 */
export function useRovingGrid(rows: readonly string[] = KEYBOARD_ROWS) {
  const [active, setActive] = useState<string>(rows[0]?.[0] ?? 'A');
  const refs = useRef(new Map<string, HTMLElement>());

  const register = useCallback(
    (letter: string) => (el: HTMLElement | null) => {
      if (el) refs.current.set(letter, el);
      else refs.current.delete(letter);
    },
    [],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent, letter: string) => {
      const r = rows.findIndex((row) => row.includes(letter));
      const row = rows[r] ?? '';
      const c = row.indexOf(letter);
      const flat = rows.join('');
      const i = flat.indexOf(letter);
      let target: string | undefined;
      switch (event.key) {
        case 'ArrowRight':
          target = flat[(i + 1) % flat.length];
          break;
        case 'ArrowLeft':
          target = flat[(i - 1 + flat.length) % flat.length];
          break;
        case 'ArrowDown': {
          const next = rows[Math.min(r + 1, rows.length - 1)] ?? row;
          target = next[Math.min(c, next.length - 1)];
          break;
        }
        case 'ArrowUp': {
          const prev = rows[Math.max(r - 1, 0)] ?? row;
          target = prev[Math.min(c, prev.length - 1)];
          break;
        }
        case 'Home':
          target = row[0];
          break;
        case 'End':
          target = row[row.length - 1];
          break;
        default:
          return;
      }
      if (!target) return;
      event.preventDefault();
      setActive(target);
      refs.current.get(target)?.focus();
    },
    [rows],
  );

  const tabIndex = (letter: string) => (letter === active ? 0 : -1);

  return { register, onKeyDown, tabIndex, setActive };
}
