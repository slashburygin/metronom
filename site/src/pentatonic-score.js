import { scaleHarmony } from './harmony.js';
import { fingerStaffSvg } from './finger-score.js';

const LETTERS = 'CDEFGAB';

// Reference: CoderLine/alphaTab 3984b321854a532f3456bbcdceac7abaa02c7381,
// packages/alphatab/src/rendering/utils/AccidentalHelper.ts:258-268 (GPL).
// Reviewed through XERJ metronom-form; no upstream code copied.
// Keep diatonic spelling and tonic-relative octaves, as in finger-score.js.
export function pentatonicScore(groups, key, type, perBeat = 1) {
  if (![1, 2, 3].includes(perBeat)) throw new RangeError('Invalid note value');
  const scale = scaleHarmony(key, type === 'major' ? 'major' : 'naturalMinor').notes;
  const sharps = scale.some(note => note.includes('♯'));
  const order = sharps ? ['F5','C5','G5','D5','A4','E5','B4'] : ['B4','E5','A4','D5','G4','C5','F4'];
  const keySignature = order.filter(note => scale.some(name => name[0] === note[0] && name.length > 1))
    .map(note => ({ symbol: sharps ? '♯' : '♭', step: Number(note[1]) * 7 + LETTERS.indexOf(note[0]) }));
  const tonic = LETTERS.indexOf(key[0]);
  const source = groups.flat();
  const rows = [];
  // At most 24 notes per staff; this keeps eighth-note and triplet beats intact.
  const capacity = 24;
  for (let offset = 0; offset < source.length; offset += capacity) {
    const notes = source.slice(offset, offset + capacity).map((n, i) => {
      const step = 28 + tonic + (LETTERS.indexOf(n.note[0]) - tonic + 7) % 7 + n.octave * 7;
      return { label: `${n.note}${Math.floor(step / 7)}`, step, quarter: n.quarter === true,
        x: 72 + keySignature.length * 10 + i * 27, y: 100 - (step - 30) * 5,
        barAfter: offset + i === source.length - 1 };
    });
    rows.push({ notes, keySignature, perBeat, beams: perBeat === 1 ? 0 : 1,
      triplets: perBeat === 3, showTime: false, finalRest: false,
      last: offset + capacity >= source.length,
      width: notes.at(-1).x + 26,
      top: Math.min(25, ...notes.map(n => n.y - 52)),
      bottom: Math.max(136, ...notes.map(n => n.y + 45)) });
  }
  return rows;
}

export function createPentatonicStaff(groups, key, type, perBeat = 1) {
  const container = document.createElement('div');
  container.className = 'pentatonic-staves';
  for (const row of pentatonicScore(groups, key, type, perBeat)) {
    const staff = document.createElement('div');
    staff.className = 'finger-staff';
    staff.innerHTML = fingerStaffSvg(row);
    staff.querySelector('svg').style.width = `${row.width}px`;
    container.append(staff);
  }
  return container;
}
