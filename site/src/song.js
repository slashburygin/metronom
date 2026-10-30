import { fraction, asFraction, add, subtract, compare, ZERO, QUARTER } from './musical-time.js';
import { DENOMINATORS, MAX_BEATS } from './tempo.js';

// The grouping defines audible pulses. 6/8 defaults to two dotted quarters;
// use groups: [1, 1, 1, 1, 1, 1] to practise all six eighth notes.
export function normalizeMeter({ numerator = 4, denominator = 4, groups } = {}) {
  if (!Number.isInteger(numerator) || numerator < 1 || numerator > MAX_BEATS || !DENOMINATORS.includes(denominator)) {
    throw new RangeError('Invalid time signature');
  }
  groups ??= denominator === 8 && numerator >= 6 && numerator % 3 === 0
    ? Array(numerator / 3).fill(3) : Array(numerator).fill(1);
  if (!Array.isArray(groups) || !groups.length || groups.some(n => !Number.isInteger(n) || n < 1)
      || groups.reduce((sum, n) => sum + n, 0) !== numerator) throw new RangeError('Invalid pulse grouping');
  return { numerator, denominator, groups: [...groups] };
}

// Song -> sections -> measures -> chords. Chord symbols are preserved verbatim;
// parsing/voicings are a separate layer. Silence is represented by a gap.
export function compileSong(input) {
  const tempoUnit = asFraction(input.tempoUnit ?? QUARTER);
  const bpm = input.bpm ?? 120;
  if (tempoUnit.n <= 0 || !Number.isFinite(bpm) || bpm < 30 || bpm > 300) throw new RangeError('Invalid song tempo');
  if (!Array.isArray(input.sections) || !input.sections.length) throw new RangeError('Song needs sections');
  let position = ZERO;
  let barIndex = 0;
  const steps = [];
  const sections = input.sections.map((section, sectionIndex) => {
    if (!Array.isArray(section.measures) || !section.measures.length) throw new RangeError('Section needs measures');
    const measures = section.measures.map((measure, measureIndex) => {
      const meter = normalizeMeter(measure.meter);
      const length = fraction(meter.numerator, meter.denominator);
      if (measure.chords !== undefined && !Array.isArray(measure.chords)) throw new TypeError('Expected chords array');
      const chords = (measure.chords ?? []).map(chord => {
        const offset = asFraction(chord.offset);
        const duration = asFraction(chord.duration);
        if (typeof chord.symbol !== 'string' || !chord.symbol.trim() || offset.n < 0 || duration.n <= 0
            || compare(add(offset, duration), length) > 0) throw new RangeError('Invalid chord event');
        if (chord.alternate !== undefined && typeof chord.alternate !== 'string') throw new TypeError('Invalid alternate chord');
        return { symbol: chord.symbol, offset, duration, ...(chord.alternate !== undefined ? { alternate: chord.alternate } : {}) };
      }).sort((a, b) => compare(a.offset, b.offset));
      for (let i = 1; i < chords.length; i++) {
        if (compare(add(chords[i - 1].offset, chords[i - 1].duration), chords[i].offset) > 0) {
          throw new RangeError('Overlapping chord events');
        }
      }
      let pulseOffset = ZERO;
      meter.groups.forEach((group, beatIndex) => {
        const duration = fraction(group, meter.denominator);
        const end = add(pulseOffset, duration);
        const events = [{ kind: 'click', offset: ZERO, beatIndex, accent: beatIndex === 0 }];
        for (const chord of chords) {
          if (compare(chord.offset, pulseOffset) >= 0 && compare(chord.offset, end) < 0) {
            events.push({ kind: 'chord', symbol: chord.symbol, offset: subtract(chord.offset, pulseOffset), duration: chord.duration });
          }
        }
        events.sort((a, b) => compare(a.offset, b.offset));
        steps.push({ position: add(position, pulseOffset), duration, sectionIndex, measureIndex, barIndex, beatIndex, events });
        pulseOffset = end;
      });
      position = add(position, length);
      barIndex++;
      if (measure.text !== undefined && typeof measure.text !== 'string') throw new TypeError('Invalid measure text');
      return { meter, chords, ...(measure.text !== undefined ? { text: measure.text } : {}) };
    });
    return { name: section.name ?? '', measures };
  });
  return { song: { version: 1, title: input.title ?? '', composer: input.composer ?? '', key: input.key ?? 'C', bpm, tempoUnit, sections }, steps, duration: position };
}
