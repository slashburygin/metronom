import { fraction as f, ZERO, compare } from './musical-time.js';
import { compileSong } from './song.js';

import { pitchClass } from './pitch.js';
export { pitchClass, midiFrequency } from './pitch.js';
export const BACKING_STYLES = ['straight', 'swing'];
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

export function buildAccompaniment(harmony, { form = 'cadence', style = 'straight' } = {}) {
  if (!BACKING_STYLES.includes(style)) throw new RangeError('Unknown backing style');
  const chords = practiceChords(harmony, form);
  const measures = chords.map(chord => ({ meter: { numerator: 4, denominator: 4 },
    chords: [{ symbol: chord.symbol, offset: ZERO, duration: f(1) }] }));
  const compiled = compileSong({ key: harmony.notes[0], sections: [{ measures }] });
  const steps = compiled.steps.map(step => {
    const chord = chords[step.barIndex];
    const pcs = chord.notes.map(note => typeof note === 'number' ? note : pitchClass(note));
    // Ascending voicing, starting with the third in the C3 octave.
    const voicing = [];
    for (const pc of [pcs[1], pcs[3], pcs[0], pcs[2]]) {
      let midi = 48 + pc;
      while (voicing.length && midi <= voicing.at(-1)) midi += 12;
      voicing.push(midi);
    }
    const beat = step.beatIndex;
    const offbeat = style === 'swing' ? f(1, 6) : f(1, 8);
    const events = [...step.events];
    events.push({ kind: 'note', part: 'bass', midi: 36 + pcs[beat % 2 ? 2 : 0], offset: ZERO, duration: f(7, 32), velocity: 0.7 });
    if (beat === 0 || beat === 2 || (style === 'swing' && beat === 1)) {
      const offset = style === 'swing' && beat === 1 ? offbeat : ZERO;
      const duration = offset === ZERO ? f(3, 16) : f(1, 16);
      for (const midi of voicing) events.push({ kind: 'note', part: 'piano', midi, offset, duration, velocity: 0.45 });
    }
    events.push({ kind: 'drum', part: 'drums', sound: 'hat', offset: ZERO, duration: f(1, 32), velocity: 0.45 });
    events.push({ kind: 'drum', part: 'drums', sound: 'hat', offset: offbeat, duration: f(1, 32), velocity: 0.25 });
    events.push({ kind: 'drum', part: 'drums', sound: beat % 2 ? 'snare' : 'kick', offset: ZERO, duration: f(1, 16), velocity: 0.45 });
    events.sort((a, b) => compare(a.offset, b.offset));
    return { ...step, symbol: chord.symbol, events };
  });
  return { ...compiled, steps, symbols: chords.map(chord => chord.symbol) };
}
