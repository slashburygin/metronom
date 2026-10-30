import { compileSong } from './song.js';
import { expandSong } from './song-form.js';
import { parseChord } from './chords.js';
import { BACKING_STYLES, normalizeSeed, randomSequence, voiceChord, bassNote } from './arrangement.js';
import { normalizeArrangement, colorChord, transitionKind, fillPattern } from './arrangement-ornaments.js';
import { fraction as f, ZERO, add, subtract, multiply, compare } from './musical-time.js';
const min = (a, b) => compare(a, b) < 0 ? a : b;
const max = (a, b) => compare(a, b) > 0 ? a : b;

export function arrangeSong(song, { style = 'swing', seed = 1, arrangement } = {}) {
  if (!BACKING_STYLES.includes(style)) throw new RangeError('Invalid style');
  const compiled = compileSong(song);
  const expanded = expandSong(compiled);
  const measures = expanded.measures;
  const ornaments = normalizeArrangement(arrangement);
  const bars = expanded.steps.filter(step => step.beatIndex === 0);
  const colorRandom = randomSequence((normalizeSeed(seed) ^ 0x6a09e667) >>> 0);
  const fillRandom = randomSequence((normalizeSeed(seed) ^ 0xbb67ae85) >>> 0);
  const random = randomSequence(seed);
  const velocity = base => base * (0.93 + random() * 0.14);
  let bar = -1, local = ZERO, voicing = [], voicingColors = [], lastChord, previousBass;
  // Look only at an immediately adjacent chord; gaps and pauses have no target.
  function following(barIndex, chordIndex) {
    const measure = measures[barIndex], chord = measure.chords[chordIndex];
    const end = add(chord.offset, chord.duration);
    const next = measure.chords[chordIndex + 1];
    if (next) return compare(end, next.offset) === 0 ? parseChord(next.symbol) : null;
    const length = f(measure.meter.numerator, measure.meter.denominator);
    const first = measures[barIndex + 1]?.chords[0];
    return compare(end, length) === 0 && first?.offset.n === 0 ? parseChord(first.symbol) : null;
  }
  const steps = expanded.steps.map(step => {
    if (step.playbackBarIndex !== bar) { bar = step.playbackBarIndex; local = ZERO; }
    const start = local, end = add(local, step.duration);
    local = end;
    const measure = measures[bar];
    const events = [...step.events];
    const segments = measure.chords.flatMap((chord, chordIndex) => {
      const from = max(start, chord.offset), to = min(end, add(chord.offset, chord.duration));
      if (compare(from, to) >= 0) return [];
      return [{ from: subtract(from, start), to: subtract(to, start), chord: parseChord(chord.symbol), source: chord, chordIndex }];
    });
    const offbeat = multiply(step.duration, style === 'swing' ? f(2, 3) : f(1, 2));
    const silence = (from, to, all = false) => events.push({ kind: 'silence', parts: all ? ['bass', 'piano', 'drums'] : ['bass', 'piano'], offset: from, duration: subtract(to, from) });
    let covered = ZERO;
    for (const segment of segments) {
      if (compare(covered, segment.from) < 0) silence(covered, segment.from);
      covered = segment.to;
    }
    if (compare(covered, step.duration) < 0) silence(covered, step.duration);
    for (const { from, to, chord, source, chordIndex } of segments) {
      if (chord.silent) { silence(from, to, chord.silent === 'all'); voicing = []; voicingColors = []; lastChord = null; previousBass = undefined; continue; }
      const onset = compare(source.offset, add(start, from)) === 0;
      if (lastChord !== chord.symbol || (ornaments.colors && onset)) {
        const colored = ornaments.colors ? colorChord(chord, compiled.song.key, Math.floor(colorRandom() * 2)) : chord;
        voicing = voiceChord(colored, voicing);
        voicingColors = colored.addedPitchClasses ?? [];
      }
      const finalPulse = step.beatIndex === measure.meter.groups.length - 1;
      const ending = bar === measures.length - 1 && finalPulse;
      const target = compare(add(source.offset, source.duration), end) === 0 ? following(bar, chordIndex) : null;
      const bass = bassNote(chord, onset || ending ? 0 : step.beatIndex, previousBass,
        { walking: style === 'swing', target: !onset && !ending ? target : null });
      // Ballads leave space on alternate pulses; changes always get a new bass.
      if (style !== 'ballad' || step.beatIndex % 2 === 0 || onset || ending) {
        events.push({ kind: 'note', part: 'bass', ...bass, offset: from,
          duration: multiply(subtract(to, from), ornaments.fills && ending ? f(1,2) : f(style === 'ballad' ? 15 : 7, style === 'ballad' ? 16 : 8)), velocity: velocity(0.7), ...(ornaments.fills && ending ? { ending: true } : {}) });
        previousBass = bass.midi;
      }
      const comp = onset || ending || style === 'swing' || style === 'rock' || step.beatIndex % 2 === 0;
      if (comp) {
        const syncopated = !(ornaments.fills && ending) && !onset && (style === 'bossa' || (style === 'swing' && step.beatIndex % 2));
        const offset = from.n === 0 && syncopated && compare(offbeat, to) < 0 ? offbeat : from;
        const strength = velocity(style === 'rock' ? 0.52 : style === 'ballad' ? 0.36 : 0.45);
        for (const midi of voicing) events.push({ kind: 'note', part: 'piano', midi, offset,
          duration: multiply(subtract(to, offset), ornaments.fills && ending ? f(1,2) : style === 'ballad' ? f(15, 16) : f(3, 4)), velocity: strength,
          ...(voicingColors.includes(midi % 12) ? { color: true } : {}), ...(ornaments.fills && ending ? { ending: true } : {}) });
      }
      lastChord = chord.symbol;
    }
    const addDrum = (sound, offset, velocity, fill) => {
      if (segments.some(segment => segment.chord.silent === 'all' && compare(offset, segment.from) >= 0 && compare(offset, segment.to) < 0)) return;
      let duration = multiply(subtract(step.duration, offset), f(1, 4));
      for (const segment of segments) {
        if (segment.chord.silent === 'all' && compare(segment.from, offset) > 0) duration = min(duration, subtract(segment.from, offset));
      }
      events.push({ kind: 'drum', part: 'drums', sound, offset, duration, velocity: velocity * (0.93 + random() * 0.14), ...(fill ? { fill } : {}) });
    };
    const beat = step.beatIndex;
    const nextChord = measures[bar + 1]?.chords[0];
    const fullPulse = !events.some(event => event.kind === 'silence');
    const canLead = !measures[bar + 1] || (nextChord?.offset.n === 0 && !parseChord(nextChord.symbol).silent);
    const fill = ornaments.fills && beat === measure.meter.groups.length - 1 && fullPulse && canLead ? transitionKind(bars, bar) : null;
    if (fill) {
      for (const hit of fillPattern(style, fill, Math.floor(fillRandom() * 2))) addDrum(hit.sound, multiply(step.duration, hit.at), hit.velocity, fill);
    } else if (style === 'ballad') {
      addDrum('hat', ZERO, 0.2);
      if (beat % 2 === 0) addDrum('kick', ZERO, 0.3);
      else addDrum('snare', ZERO, 0.18);
    } else {
      addDrum('hat', ZERO, style === 'rock' ? 0.5 : 0.38);
      addDrum('hat', offbeat, style === 'bossa' ? 0.32 : 0.25);
      if (style === 'bossa') {
        if (beat % 2 === 0) { addDrum('kick', ZERO, 0.4); addDrum('kick', multiply(step.duration, f(3, 4)), 0.25); }
        else addDrum('snare', offbeat, 0.26);
      } else {
        addDrum(beat % 2 ? 'snare' : 'kick', ZERO, style === 'rock' ? 0.65 : 0.42);
        if (style === 'rock' && beat % 2 === 0) addDrum('kick', offbeat, 0.4);
      }
    }
    events.sort((a, b) => compare(a.offset, b.offset));
    return { ...step, events };
  });
  return { ...compiled, duration: expanded.duration, steps, symbols: compiled.song.sections.flatMap(section => section.measures.map(measure => measure.chords.map(chord => chord.symbol).join(' · ') || '—')) };
}
