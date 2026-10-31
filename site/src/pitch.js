const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function pitchClass(note) {
  if (typeof note !== 'string' || !/^[A-G][♯♭]*$/.test(note)) throw new RangeError('Invalid spelled note');
  return ((NATURAL[note[0]] + [...note.slice(1)].reduce((sum, a) => sum + (a === '♯' ? 1 : -1), 0)) % 12 + 12) % 12;
}
export const midiFrequency = midi => 440 * 2 ** ((midi - 69) / 12);
