// Spell diatonically: every scale uses each letter once, including double accidentals.
export const MAJOR_KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const MINOR_KEYS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
export const SCALE_TYPES = ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor'];
export const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
};
const QUALITIES = {
  major: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7♭5'],
  naturalMinor: ['m7', 'm7♭5', 'maj7', 'm7', 'm7', 'maj7', '7'],
  harmonicMinor: ['m(maj7)', 'm7♭5', '+maj7', 'm7', '7', 'maj7', 'dim7'],
  melodicMinor: ['m(maj7)', 'm7', '+maj7', '7', '7', 'm7♭5', 'm7♭5'],
};
const ROMANS = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viiø'],
  naturalMinor: ['i', 'iiø', 'III', 'iv', 'v', 'VI', 'VII'],
  harmonicMinor: ['i', 'iiø', 'III+', 'iv', 'V', 'VI', 'vii°'],
  melodicMinor: ['i', 'ii', 'III+', 'IV', 'V', 'viø', 'viiø'],
};
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
export function keysFor(type) {
  return type === 'major' ? MAJOR_KEYS : MINOR_KEYS;
}
function spell(key, intervals) {
  const first = LETTERS.indexOf(key[0]);
  const root = NATURAL[first] + (key.includes('♭') ? -1 : key.includes('♯') ? 1 : 0);
  return intervals.map((interval, degree) => {
    const letter = (first + degree) % 7;
    const difference = ((root + interval - NATURAL[letter] + 18) % 12) - 6;
    return LETTERS[letter] + (difference > 0 ? '♯'.repeat(difference) : '♭'.repeat(-difference));
  });
}
export function scaleHarmony(key, type = 'major') {
  if (!SCALE_TYPES.includes(type) || !keysFor(type).includes(key)) throw new RangeError('Unknown key or scale');
  const notes = spell(key, SCALE_INTERVALS[type]);
  const chords = notes.map((note, degree) => ({
    symbol: note + QUALITIES[type][degree],
    roman: ROMANS[type][degree],
    notes: [0, 2, 4, 6].map((offset) => notes[(degree + offset) % 7]),
  }));
  // A functional minor ii–V–i needs a major-third dominant, even in natural minor.
  const dominantNotes = type === 'naturalMinor' ? spell(key, SCALE_INTERVALS.harmonicMinor) : notes;
  const dominant = type === 'naturalMinor'
    ? { symbol: notes[4] + '7', roman: 'V', notes: [4, 6, 1, 3].map((degree) => dominantNotes[degree]) }
    : chords[4];
  const progression = [chords[1], dominant, chords[0]];
  return { type, notes, chords, progression,
    progressionLabel: type === 'major' ? 'ii–V–I' : type === 'melodicMinor' ? 'ii–V–i' : 'iiø–V–i',
    guideTones: [[progression[0].notes[1], dominant.notes[3], chords[0].notes[1]],
      [progression[0].notes[3], dominant.notes[1], chords[0].notes[3]]] };
}
export function majorHarmony(key) {
  return scaleHarmony(key);
}
