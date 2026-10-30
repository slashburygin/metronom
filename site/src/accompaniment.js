import { fraction as f, ZERO } from './musical-time.js';
import { arrangeSong } from './song-arrangement.js';
export { BACKING_STYLES } from './arrangement.js';

import { pitchClass } from './pitch.js';
export { pitchClass, midiFrequency } from './pitch.js';
export const BACKING_FORMS = ['cadence', 'majorBlues', 'minorBlues'];
export const PARTS = ['bass', 'piano', 'drums'];

// These educational blues forms are explicit, not inferred from chord symbols.
export function practiceChords(harmony, form) {
  if (!BACKING_FORMS.includes(form)) throw new RangeError('Unknown practice form');
  if (form === 'cadence') return [...harmony.progression, harmony.progression[2]];
  const chordAt = (degree, quality, intervals) => ({
    symbol: harmony.notes[degree] + quality,
    notes: intervals.map(interval => (pitchClass(harmony.notes[degree]) + interval) % 12),
  });
  const seventh = [0, 4, 7, 10];
  const minorSeventh = [0, 3, 7, 10];
  const chords = form === 'majorBlues'
    ? [chordAt(0, '7', seventh), chordAt(3, '7', seventh), chordAt(4, '7', seventh)]
    : [chordAt(0, 'm7', minorSeventh), chordAt(3, 'm7', minorSeventh), chordAt(4, '7', seventh)];
  const pattern = form === 'majorBlues'
    ? [0, 0, 0, 0, 1, 1, 0, 0, 2, 1, 0, 2]
    : [0, 0, 0, 0, 1, 1, 0, 0, 2, 2, 0, 2];
  return pattern.map(index => chords[index]);
}

export function buildAccompaniment(harmony, { form = 'cadence', ...options } = {}) {
  const chords = practiceChords(harmony, form);
  const measures = chords.map(chord => ({ meter: { numerator: 4, denominator: 4 },
    chords: [{ symbol: chord.symbol, offset: ZERO, duration: f(1) }] }));
  return arrangeSong({ key: harmony.notes[0] + (harmony.type === 'major' ? '' : 'm'), sections: [{ measures }] },
    { style: 'straight', ...options });
}
