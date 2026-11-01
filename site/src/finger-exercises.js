import { MAJOR_KEYS, scaleHarmony } from './harmony.js';

// Original generated practice variants of a arpeggio-and-step scale cell, rather than
// a transcription of the Online Sax Academy score or backing track.
export const FINGER_LEVELS = Object.freeze({
  quarter: { subdivision: 'quarter', notesPerBeat: 1 },
  eighths: { subdivision: 'eighths', notesPerBeat: 2 },
  sixteenths: { subdivision: 'sixteenths', notesPerBeat: 4 },
});
export function fingerExercise(key = 'C', direction = 'up') {
  if (!MAJOR_KEYS.includes(key) || !['up', 'down'].includes(direction)) throw new RangeError('Invalid finger exercise');
  const { notes, chords } = scaleHarmony(key);
  const rows = Array.from({ length: 7 }, (_, start) => {
    const offsets = direction === 'up' ? [0, 2, 4, 6, 5, 4, 3, 2] : [6, 4, 2, 0, 1, 2, 3, 4];
    const degrees = offsets.map(offset => start + offset);
    return {
      start: start + 1,
      chord: chords[start].symbol,
      notes: degrees.map(degree => ({ name: notes[degree % 7], degree: degree % 7 + 1, octave: Math.floor(degree / 7) })),
    };
  });
  return direction === 'down' ? rows.reverse() : rows;
}
export function fingerSettings(level, bpm) {
  if (!Object.hasOwn(FINGER_LEVELS, level) || !Number.isInteger(bpm) || bpm < 30 || bpm > 300) throw new RangeError('Invalid practice settings');
  return { bpm, beatsPerBar: 4, noteValue: 4, subdivision: FINGER_LEVELS[level].subdivision, timerMinutes: 5 };
}
