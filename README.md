# Enigma I: an interactive exhibit

A playable, historically accurate simulator of the Wehrmacht **Enigma I**, which is cryptographically identical to the Kriegsmarine **M3** with rotors I–V. It runs in the browser. You can type on your own keyboard or press the machine's keys, and watch each lamp light as the rotors step. You can set the key sheet, cable the plugboard, and follow every keypress through the wiring.

## Run it

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev          # open http://localhost:5173
```

Production build:

```sh
npm run build        # type-checks, then writes dist/
npm run preview      # serves dist/ at http://localhost:4173
```

`dist/` uses relative paths, so it can be served from any static host or sub-folder.

## Tests

```sh
npm test             # cipher + state unit tests (Vitest)
npm run test:e2e     # browser tests, desktop + mobile (Playwright)
```

Before the first `test:e2e` on a new machine, run `npx playwright install chromium`. The e2e run starts its own dev server.

## Using the machine

**Encrypt**
1. Set the key in the **key sheet**: reflector, rotor order, ring settings, start positions and plugboard. The defaults work for a first try.
2. Type. The tape shows each key pressed above the lamp that lit. The lamp letters are the ciphertext.
3. Press **Copy output**. The **Current key** line under the tape (also copyable, or as a link) is everything needed to reproduce the result.

**Decrypt**
1. Press **Restore start positions**. The rotors return to the start, and the finished message is filed in the **Log** so the ciphertext stays visible.
2. Type or paste the ciphertext. The lamps spell out the original letters. The reflector makes the machine reciprocal, so there is no separate decrypt mode.

Quick check: with the default key (UKW B, rotors I II III, rings 01 01 01, start AAA, no cables), `AAAAA` gives `BDZGO`.

**Controls**
- **Restore start positions** turns the rotors back to the key's start positions and files the current message in the log.
- **Clear message** discards the current message and turns the rotors back.
- **Copy output** copies the lamp letters in five-letter groups.
- **Undo letter** (or <kbd>Backspace</kbd>) removes the last letter and turns the rotors back. This is a convenience the real machine did not have.
- Rotor thumbwheels: click above or below a wheel, or focus a rotor window and use <kbd>↑</kbd>/<kbd>↓</kbd> or type a letter.
- Plugboard: click two sockets to connect them, and click a plugged socket to remove its cable. You can also type pairs into the key sheet, e.g. `AV BS CG`.
- **Sound** is off by default. It is synthesised, with no audio files.

**Reproducibility rule:** the message on the tape always starts at the key sheet's start positions. Anything that would break that, such as changing the key sheet or turning a rotor by hand mid-message, files the message in the log with the exact key that produced it and starts a new one. So the **Current key** line always reproduces the output on the tape.

The guide at the bottom of the page includes a real message from 7 July 1941 (Operation Barbarossa). You can decrypt it step by step, including the historical message-key procedure.

## Spaces and punctuation

The machine has only the letters A–Z. The same rule applies everywhere: physical keyboard, on-screen keys, and pasted text.

- Letters are upper-cased and accents removed (é → E, ä → A, ß → SS).
- Spaces, digits, punctuation and line breaks are **skipped**. They never reach the machine and never step the rotors. A short note says so when you press one.
- Output is shown in five-letter groups, as operators wrote it. The gaps carry no meaning and are ignored when the text is typed or pasted back in.

So a decrypted message comes back without spaces: `ATTACKATDAWN`.

## Accuracy

- Rotor wirings I–V, reflectors B and C, and the straight-through entry wheel of the military machine.
- Ring settings (Ringstellung) offset the wiring but not the notch. Turnover always happens at the same window letter: I Q→R, II E→F, III V→W, IV J→K, V Z→A.
- Stepping happens **before** the current flows on each keypress. The right rotor always steps. The middle rotor steps when the right rotor is at its notch, **or** when the middle rotor is at its own notch (the double step), carrying the left rotor with it.
- The plugboard accepts 0–13 cables and rejects a letter plugged to itself or used twice. From 1939, 10 cables were standard.
- Each rotor can be fitted only once, as on the real machine.

### How it is verified

`src/enigma/*.test.ts` checks the cipher against:

- **Published historical messages:** both parts of the Operation Barbarossa message of 7 July 1941 (Sullivan & Weierud, *Cryptologia* 29(3), 2005). This includes deciphering each three-letter indicator to its message key (`KCH` at `WXC` → `BLA`, `YPJ` at `CRS` → `LSD`), then the full texts in both directions.
- **Standard reference values:** `AAAAA` → `BDZGO`, and the double-step sequence `ADU → ADV → AEW → BFX → BFY`.
- **An independent implementation:** vectors generated with [py-enigma](https://pypi.org/project/py-enigma/). These cover reflector C, rotors IV and V, extreme ring settings, texts of 700–1000 letters (many left-rotor turnovers) and turnover sequences for every rotor in the middle and right slots. They live in `src/enigma/fixtures/reference-vectors.json` and can be regenerated with `scripts/generate-reference-vectors.py`.
- **Properties:** reciprocity, never encrypting a letter to itself, a full 13-cable board, the 16,900-keypress rotor period that the double step produces, and ring-independent turnover.

I checked that the tests catch real bugs: removing the double step or ignoring ring settings each makes 10 tests fail.

## Scope: what is not included

- Kriegsmarine rotors VI, VII and VIII (two notches each).
- The four-rotor M4, with its Beta/Gamma wheels and thin reflectors.
- Reflector A (used until 1937) and the field-rewirable UKW-D (1944).
- The Enigma-Uhr plugboard attachment.
- Commercial, Abwehr (G), railway and Swiss models, which differ in wiring, entry wheel or stepping.
- Operating procedures such as doubled indicators and Kenngruppen are not enforced, but you can carry them out by hand.

## Accessibility

- Everything works from the keyboard. The machine's keys and the plugboard are single <kbd>Tab</kbd> stops, navigated with the arrow keys (roving tabindex). Rotor windows are ARIA spinbuttons.
- Each keypress is announced through a polite live region, e.g. "A, lamp B". The tape has a plain-text version for screen readers, and the signal-path diagram has a step-by-step text list.
- The layout respects `prefers-reduced-motion`, has visible focus rings, and adds outlines in Windows high-contrast (forced colours) mode.
- The e2e suite runs an axe-core WCAG 2.1 AA scan on desktop and mobile.

## Project layout

```
src/enigma/        Cipher logic: pure TypeScript, no DOM or framework
  components.ts    Rotor/reflector wirings and notches
  machine.ts       Settings, stepping, key press + signal trace
  plugboard.ts     Parsing and validation of cable pairs
  text.ts          The letters-only text rule, five-letter grouping
  keysheet.ts      Settings <-> shareable link format
src/ui/            React interface (state reducer, machine, key sheet, pad, guide)
tests/e2e/         Playwright browser tests
scripts/           Generator for the cross-check vectors (Python, py-enigma)
```

Settings are saved in the browser's localStorage, and nothing is sent anywhere. Fonts (Source Serif 4, Barlow Condensed, IBM Plex Mono) are bundled locally via Fontsource.
