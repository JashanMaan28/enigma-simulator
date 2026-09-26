import { useId } from 'react';
import {
  ALPHABET,
  indexToLetter,
  positionsText,
  wiringAt,
  type KeyPress,
  type MachineSettings,
  type SignalStage,
} from '../enigma';

const L = indexToLetter;

const ROW = 13;
const TOP = 56;
const GAP = 22;
const HEIGHT = TOP + 26 * ROW + 12;

interface Column {
  id: 'ukw' | 'left' | 'middle' | 'right' | 'etw' | 'plug' | 'keys';
  title: string;
  sub: string;
  x: number;
  w: number;
}

function layout(settings: MachineSettings, press: KeyPress): { cols: Column[]; width: number } {
  const pos = press.positions;
  const spec: Omit<Column, 'x'>[] = [
    { id: 'ukw', title: 'UKW', sub: settings.reflector, w: 34 },
    { id: 'left', title: `Left ${settings.rotors[0]}`, sub: `at ${L(pos[0])}`, w: 60 },
    { id: 'middle', title: `Middle ${settings.rotors[1]}`, sub: `at ${L(pos[1])}`, w: 60 },
    { id: 'right', title: `Right ${settings.rotors[2]}`, sub: `at ${L(pos[2])}`, w: 60 },
    { id: 'etw', title: 'Entry', sub: 'ETW', w: 30 },
    { id: 'plug', title: 'Plugs', sub: `${settings.plugboard.length} cables`, w: 52 },
    { id: 'keys', title: 'Key', sub: 'Lamp', w: 18 },
  ];
  let x = 22;
  const cols = spec.map((c) => {
    const col = { ...c, x };
    x += c.w + GAP;
    return col;
  });
  return { cols, width: x - GAP + 22 };
}

const y = (row: number) => TOP + row * ROW + ROW / 2;

function describe(stage: SignalStage, press: KeyPress): string {
  const a = L(stage.input);
  const b = L(stage.output);
  switch (stage.kind) {
    case 'keyboard':
      return `Key ${a} closes the circuit.`;
    case 'plugboard':
      return stage.input === stage.output
        ? `Plugboard: no cable in ${a}, so it passes straight through.`
        : `Plugboard: the ${a}–${b} cable swaps it to ${b}.`;
    case 'entry':
      return `Entry wheel: fixed, wired straight through (${a} → ${b}).`;
    case 'rotor': {
      const i = stage.slot === 'left' ? 0 : stage.slot === 'middle' ? 1 : 2;
      return `${stage.label} at ${L(press.positions[i])}: ${a} → ${b}.`;
    }
    case 'reflector':
      return `${stage.label}: ${a} → ${b}, and the current turns back.`;
    case 'lamp':
      return `Lamp ${a} lights.`;
  }
}

function stepSummary(press: KeyPress): string {
  const [l, m] = press.step.moved;
  const which = l ? 'all three rotors' : m ? 'the right and middle rotors' : 'the right rotor';
  const before = positionsText(press.positionsBefore);
  const after = positionsText(press.positions);
  const extra = press.step.doubleStep
    ? ' Double step: the middle rotor had reached its own notch, so it moved again and took the left rotor with it.'
    : '';
  return `Before any current flowed, ${which} stepped: ${before} → ${after}.${extra}`;
}

export function SignalPath({ settings, press }: { settings: MachineSettings; press: KeyPress | null }) {
  const titleId = useId();
  return (
    <section className="paper signal" id="signal" aria-labelledby={titleId}>
      <header className="paper-head">
        <p className="kicker">Stromlauf</p>
        <h2 id={titleId}>Signal path</h2>
        <p className="paper-sub">
          Every keypress first steps the rotors, then sends current through the machine and back. The last keypress is
          traced below: <span className="path-fwd-label">solid red</span> on the way in,{' '}
          <span className="path-ret-label">dashed blue</span> on the way back. Faint lines are all the other wires at
          these rotor positions.
        </p>
      </header>
      {press ? <Trace settings={settings} press={press} /> : (
        <p className="signal-empty">Press a key to trace the current through the machine.</p>
      )}
    </section>
  );
}

function Trace({ settings, press }: { settings: MachineSettings; press: KeyPress }) {
  const { cols, width } = layout(settings, press);
  const wiring = wiringAt(settings, press.positions);
  const [ukw, left, middle, right, etw, plug, keys] = cols as [Column, Column, Column, Column, Column, Column, Column];
  const p = press.path;
  const out = (i: number) => (p[i] as SignalStage).output;

  // Forward: keys → plugboard → entry → right → middle → left → reflector.
  const fwd: [number, number][] = [
    [keys.x + keys.w / 2, y(press.input)],
    [plug.x + plug.w, y(press.input)],
    [plug.x, y(out(1))],
    [etw.x + etw.w, y(out(1))],
    [etw.x, y(out(2))],
    [right.x + right.w, y(out(2))],
    [right.x, y(out(3))],
    [middle.x + middle.w, y(out(3))],
    [middle.x, y(out(4))],
    [left.x + left.w, y(out(4))],
    [left.x, y(out(5))],
    [ukw.x + ukw.w, y(out(5))],
  ];
  // Return: reflector → left → middle → right → entry → plugboard → lamp.
  const ret: [number, number][] = [
    [ukw.x + ukw.w, y(out(6))],
    [left.x, y(out(6))],
    [left.x + left.w, y(out(7))],
    [middle.x, y(out(7))],
    [middle.x + middle.w, y(out(8))],
    [right.x, y(out(8))],
    [right.x + right.w, y(out(9))],
    [etw.x, y(out(9))],
    [etw.x + etw.w, y(out(10))],
    [plug.x, y(out(10))],
    [plug.x + plug.w, y(out(11))],
    [keys.x + keys.w / 2, y(press.output)],
  ];
  const ya = y(out(5));
  const yb = y(out(6));
  const rx = ukw.x + ukw.w;
  const bulge = Math.min(ukw.w - 6, 8 + Math.abs(ya - yb) * 0.12);
  const reflectArc = `M ${rx} ${ya} C ${rx - bulge} ${ya}, ${rx - bulge} ${yb}, ${rx} ${yb}`;

  const faint: string[] = [];
  const straight = (c: Column, table: readonly number[]) =>
    table.forEach((to, from) => faint.push(`M ${c.x + c.w} ${y(from)} L ${c.x} ${y(to)}`));
  straight(plug, wiring.plugboard);
  straight(etw, wiring.entry);
  straight(right, wiring.rotors[2]);
  straight(middle, wiring.rotors[1]);
  straight(left, wiring.rotors[0]);
  wiring.reflector.forEach((to, from) => {
    if (from < to) {
      const y1 = y(from);
      const y2 = y(to);
      const b = Math.min(ukw.w - 6, 8 + Math.abs(y1 - y2) * 0.12);
      faint.push(`M ${rx} ${y1} C ${rx - b} ${y1}, ${rx - b} ${y2}, ${rx} ${y2}`);
    }
  });

  const points = (pts: [number, number][]) => pts.map(([px, py]) => `${px},${py}`).join(' ');

  return (
    <>
      <p className="signal-step" data-testid="step-summary">{stepSummary(press)}</p>
      <div className="signal-figure">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Wiring diagram: key ${L(press.input)} to lamp ${L(press.output)}. The same route is listed step by step below.`}
        >
          {/* column bodies */}
          {cols.map((c) => (
            <g key={c.id}>
              <text x={c.x + c.w / 2} y={18} className="sp-title" textAnchor="middle">
                {c.title}
              </text>
              <text x={c.x + c.w / 2} y={32} className="sp-sub" textAnchor="middle">
                {c.sub}
              </text>
              {c.id !== 'keys' && (
                <rect x={c.x} y={TOP - 6} width={c.w} height={26 * ROW + 12} rx={2} className={`sp-body sp-${c.id}`} />
              )}
            </g>
          ))}
          {/* row letters at both ends */}
          {Array.from(ALPHABET, (l, i) => (
            <g key={l}>
              <text x={10} y={y(i) + 3} className="sp-row" textAnchor="middle">
                {l}
              </text>
              <text x={width - 10} y={y(i) + 3} className="sp-row" textAnchor="middle">
                {l}
              </text>
            </g>
          ))}
          <path d={faint.join(' ')} className="sp-faint" />
          <polyline points={points(fwd)} className="sp-path sp-fwd" />
          <path d={reflectArc} className="sp-path sp-turn" />
          <polyline points={points(ret)} className="sp-path sp-ret" />
          <rect x={keys.x + keys.w / 2 - 5} y={y(press.input) - 5} width={10} height={10} className="sp-key" />
          <circle cx={keys.x + keys.w / 2} cy={y(press.output)} r={6} className="sp-lamp" />
        </svg>
      </div>
      <ol className="signal-list" data-testid="signal-list">
        {p.map((stage, i) => (
          <li key={i} className={`dir-${stage.direction}`}>
            {describe(stage, press)}
          </li>
        ))}
      </ol>
    </>
  );
}
