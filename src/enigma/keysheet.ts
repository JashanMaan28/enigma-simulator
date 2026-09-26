import { ALPHABET, LETTER_COUNT, ringNumber } from './alphabet';
import { REFLECTOR_NAMES, ROTOR_NAMES, type ReflectorName, type RotorName } from './components';
import { validateSettings, positionsText, type MachineSettings, type Triple } from './machine';
import { formatPlugboard, parsePlugboard } from './plugboard';

/**
 * Settings as a compact, human-readable query string, used for shareable links:
 *   ukw=B&walzen=I-II-III&ringe=01-01-01&grund=AAA&stecker=AV-BS-CG
 */
export function settingsToQuery(settings: MachineSettings): string {
  const params = new URLSearchParams();
  params.set('ukw', settings.reflector);
  params.set('walzen', settings.rotors.join('-'));
  params.set('ringe', settings.rings.map(ringNumber).join('-'));
  params.set('grund', positionsText(settings.positions));
  params.set('stecker', formatPlugboard(settings.plugboard).replace(/ /g, '-'));
  return params.toString();
}

export type QueryParseResult =
  | { readonly ok: true; readonly settings: MachineSettings }
  | { readonly ok: false; readonly problems: readonly string[] };

/** Parse the format written by {@link settingsToQuery}. Missing fields fall back to `defaults`. */
export function settingsFromQuery(query: string, defaults: MachineSettings): QueryParseResult {
  const params = new URLSearchParams(query.replace(/^[#?]/, ''));
  const problems: string[] = [];

  let reflector: ReflectorName = defaults.reflector;
  const ukw = params.get('ukw');
  if (ukw !== null) {
    const r = ukw.toUpperCase();
    if ((REFLECTOR_NAMES as readonly string[]).includes(r)) reflector = r as ReflectorName;
    else problems.push(`Unknown reflector “${ukw}”.`);
  }

  let rotors: Triple<RotorName> = defaults.rotors;
  const walzen = params.get('walzen');
  if (walzen !== null) {
    const parts = walzen.toUpperCase().split(/[-\s,]+/);
    if (parts.length === 3 && parts.every((p) => (ROTOR_NAMES as readonly string[]).includes(p))) {
      rotors = parts as unknown as Triple<RotorName>;
    } else problems.push(`Rotor order “${walzen}” should be three rotors I–V, e.g. I-II-III.`);
  }

  let rings: Triple<number> = defaults.rings;
  const ringe = params.get('ringe');
  if (ringe !== null) {
    const parts = ringe.toUpperCase().split(/[-\s,]+/);
    const values = parts.map((p) => (/^\d+$/.test(p) ? Number(p) - 1 : ALPHABET.indexOf(p)));
    if (values.length === 3 && values.every((v) => Number.isInteger(v) && v >= 0 && v < LETTER_COUNT)) {
      rings = values as unknown as Triple<number>;
    } else problems.push(`Ring settings “${ringe}” should be three values 01–26, e.g. 01-01-01.`);
  }

  let positions: Triple<number> = defaults.positions;
  const grund = params.get('grund');
  if (grund !== null) {
    const letters = grund.toUpperCase().replace(/[^A-Z]/g, '');
    if (letters.length === 3) positions = Array.from(letters, (l) => ALPHABET.indexOf(l)) as unknown as Triple<number>;
    else problems.push(`Start positions “${grund}” should be three letters, e.g. AAA.`);
  }

  let plugboard = defaults.plugboard;
  const stecker = params.get('stecker');
  if (stecker !== null) {
    const parsed = parsePlugboard(stecker.replace(/-/g, ' '));
    if (parsed.errors.length === 0) plugboard = parsed.pairs;
    else problems.push(...parsed.errors.map((e) => e.message));
  }

  if (problems.length > 0) return { ok: false, problems };
  const settings: MachineSettings = { reflector, rotors, rings, positions, plugboard };
  const invalid = validateSettings(settings);
  return invalid.length > 0 ? { ok: false, problems: invalid } : { ok: true, settings };
}
