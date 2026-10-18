// Diatonic spelling keeps every letter once, including E♯ in F♯ major.
export const MAJOR_KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const QUALITIES = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7♭5'];
export function majorHarmony(key) {
  if (!MAJOR_KEYS.includes(key)) throw new RangeError('Unknown major key');
  const first = LETTERS.indexOf(key[0]);
  const root = NATURAL[first] + (key.includes('♭') ? -1 : key.includes('♯') ? 1 : 0);
  const notes = MAJOR.map((interval, degree) => {
    const letter = (first + degree) % 7;
    const difference = ((root + interval - NATURAL[letter] + 18) % 12) - 6;
    return LETTERS[letter] + (difference > 0 ? '♯'.repeat(difference) : '♭'.repeat(-difference));
  });
  const chords = notes.map((note, degree) => ({
    symbol: note + QUALITIES[degree],
    notes: [0, 2, 4, 6].map((offset) => notes[(degree + offset) % 7]),
  }));
  return { notes, chords, progression: [chords[1], chords[4], chords[0]],
    guideTones: [[notes[3], notes[3], notes[2]], [notes[0], notes[6], notes[6]]] };
}
