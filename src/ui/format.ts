import { formatPlugboard, positionsText, ringsText, type MachineSettings } from '../enigma';

/** Compact, copyable key line: "UKW B · Walzen I II III · Ringe 01 01 01 · Grund AAA · Stecker AV BS". */
export function keyLine(settings: MachineSettings): string {
  const plugs = formatPlugboard(settings.plugboard);
  return [
    'Enigma I',
    `UKW ${settings.reflector}`,
    `Walzen ${settings.rotors.join(' ')}`,
    `Ringe ${ringsText(settings.rings)}`,
    `Grund ${positionsText(settings.positions)}`,
    `Stecker ${plugs || '—'}`,
  ].join(' · ');
}
