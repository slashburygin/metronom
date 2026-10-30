import { compileSong } from './song.js';
import { parseChord } from './chords.js';
import { fraction as f, ZERO, add, subtract, multiply, compare } from './musical-time.js';
const min = (a, b) => compare(a, b) < 0 ? a : b;
const max = (a, b) => compare(a, b) > 0 ? a : b;

export function arrangeSong(song, { style = 'swing' } = {}) {
  if (!['straight', 'swing'].includes(style)) throw new RangeError('Invalid style');
  const compiled = compileSong(song);
  const measures = compiled.song.sections.flatMap(section => section.measures);
  let bar = -1, local = ZERO;
  const steps = compiled.steps.map(step => {
    if (step.barIndex !== bar) { bar = step.barIndex; local = ZERO; }
    const start = local, end = add(local, step.duration);
    local = end;
    const measure = measures[bar];
    const events = [...step.events];
    const segments = measure.chords.flatMap(chord => {
      const from = max(start, chord.offset), to = min(end, add(chord.offset, chord.duration));
      if (compare(from, to) >= 0) return [];
      return [{ from: subtract(from, start), to: subtract(to, start), chord: parseChord(chord.symbol) }];
    });
    const offbeat = multiply(step.duration, style === 'swing' ? f(2, 3) : f(1, 2));
    for (const { from, to, chord } of segments) {
      if (chord.silent) continue;
      const duration = multiply(subtract(to, from), f(7, 8));
      const pcs = chord.pitchClasses;
      events.push({ kind: 'note', part: 'bass', midi: 36 + (chord.bass !== chord.root ? chord.bassPitch : pcs[step.beatIndex % 2 ? Math.min(2, pcs.length - 1) : 0]), offset: from, duration, velocity: 0.7 });
      if (from.n > 0 || step.beatIndex % 2 === 0 || style === 'swing') {
        const offset = from.n === 0 && step.beatIndex % 2 && style === 'swing' && compare(offbeat, to) < 0 ? offbeat : from;
        // Keep extensions audible without increasing polyphony without bound.
        const chosen = pcs.length > 4 ? [pcs[1], pcs[3], pcs[4], pcs.at(-1)] : pcs;
        let previous = 47;
        for (const pc of [...new Set(chosen)]) {
          let midi = 48 + pc;
          while (midi <= previous) midi += 12;
          previous = midi;
          events.push({ kind: 'note', part: 'piano', midi, offset, duration: multiply(subtract(to, offset), f(3, 4)), velocity: 0.45 });
        }
      }
    }
    const addDrum = (sound, offset, velocity) => {
      if (segments.some(segment => segment.chord.silent === 'all' && compare(offset, segment.from) >= 0 && compare(offset, segment.to) < 0)) return;
      let duration = multiply(subtract(step.duration, offset), f(1, 4));
      for (const segment of segments) {
        if (segment.chord.silent === 'all' && compare(segment.from, offset) > 0) duration = min(duration, subtract(segment.from, offset));
      }
      events.push({ kind: 'drum', part: 'drums', sound, offset, duration, velocity });
    };
    addDrum('hat', ZERO, 0.45); addDrum('hat', offbeat, 0.25);
    addDrum(step.beatIndex % 2 ? 'snare' : 'kick', ZERO, 0.45);
    events.sort((a, b) => compare(a.offset, b.offset));
    return { ...step, events };
  });
  return { ...compiled, steps, symbols: measures.map(measure => measure.chords.map(chord => chord.symbol).join(' · ') || '—') };
}
