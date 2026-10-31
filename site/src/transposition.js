import { pitchClass } from './pitch.js';
import { parseChord } from './chords.js';
import { MAJOR_KEYS, MINOR_KEYS } from './harmony.js';

export const KEY_NAMES = ['C','C♯','D♭','D','E♭','E','F','F♯','G♭','G','G♯','A♭','A','B♭','B'];
export const INSTRUMENTS = { C: 0, Bb: 2, Eb: 9, F: 7, G: 5 };
const LETTERS = 'CDEFGAB';
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
export const mod12 = n => ((n % 12) + 12) % 12;
export function parseKey(key) {
  if (typeof key !== 'string') throw new RangeError('Invalid key');
  const match = /^([A-G](?:[#b♯♭]{1,2})?)(m|\s+minor|\s+major)?$/.exec(key.trim());
  if (!match) throw new RangeError('Invalid key');
  const tonic = match[1].replaceAll('#','♯').replaceAll('b','♭');
  return { tonic, minor: match[2] === 'm' || match[2]?.trim() === 'minor', pitch: pitchClass(tonic) };
}
export function keyAt(pitch, minor = false) { return (minor ? MINOR_KEYS : MAJOR_KEYS)[mod12(pitch)]; }
export function keyDistance(from, to) { return mod12(parseKey(to).pitch - parseKey(from).pitch); }

// Preserve diatonic letter movement between keys, including chromatic chords.
// If it needs more than two accidentals, fall back to a readable enharmonic.
export function transposeNote(note, semitones, fromKey, toKey) {
  if (!Number.isSafeInteger(semitones)) throw new RangeError('Invalid transposition');
  const from = parseKey(fromKey), to = parseKey(toKey);
  const desired = mod12(pitchClass(note) + semitones);
  const shift = (LETTERS.indexOf(to.tonic[0]) - LETTERS.indexOf(from.tonic[0]) + 7) % 7;
  const letter = (LETTERS.indexOf(note[0]) + shift) % 7;
  const accidental = mod12(desired - NATURAL[letter] + 6) - 6;
  if (Math.abs(accidental) <= 2) return LETTERS[letter] + (accidental < 0 ? '♭'.repeat(-accidental) : '♯'.repeat(accidental));
  const preferFlats = to.tonic.includes('♭') || to.tonic === 'F';
  const names = preferFlats ? ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'] : ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  return names[desired];
}
export function transposeChord(symbol, semitones, fromKey, toKey) {
  const chord = parseChord(symbol);
  if (chord.silent) return symbol;
  if (mod12(semitones) === 0 && parseKey(fromKey).tonic === parseKey(toKey).tonic) return symbol;
  const root = transposeNote(chord.root, semitones, fromKey, toKey);
  // Preserve whether an explicit slash was written, even if it names the root.
  const slash = /\/[A-G][#b♯♭]*$/.test(symbol.trim());
  return root + chord.quality + (slash ? '/' + transposeNote(chord.bass, semitones, fromKey, toKey) : '');
}
export function transposeSong(song, semitones, targetKey = keyAt(parseKey(song.key).pitch + semitones, parseKey(song.key).minor)) {
  const source = parseKey(song.key);
  const target = parseKey(targetKey).tonic;
  return { ...song, key: target + (source.minor ? 'm' : ''), sections: song.sections.map(section => ({ ...section,
    measures: section.measures.map(measure => ({ ...measure, chords: measure.chords.map(chord => ({ ...chord,
      symbol: transposeChord(chord.symbol, semitones, song.key, target),
      ...(chord.alternate ? { alternate: transposeChord(chord.alternate, semitones, song.key, target) } : {}),
    })) })),
  })) };
}
export function transposeDraft(draft, targetKey) {
  const semitones = keyDistance(draft.key, targetKey);
  const transposeText = text => text.trim() ? text.trim().split(/\s+/).map(token => {
    const colon = token.indexOf(':');
    const symbol = colon < 0 ? token : token.slice(0, colon);
    return transposeChord(symbol, semitones, draft.key, targetKey) + (colon < 0 ? '' : token.slice(colon));
  }).join(' ') : text;
  return { ...draft, key: parseKey(targetKey).tonic + (parseKey(draft.key).minor ? 'm' : ''), sections: draft.sections.map(section => ({ ...section,
    measures: section.measures.map(measure => ({ ...measure, chords: transposeText(measure.chords), alternate: transposeText(measure.alternate) })),
  })) };
}

// Transform a compiled arrangement without changing drum pitches or its source.
export function transposeArrangement(compiled, semitones, targetKey) {
  const song = transposeSong(compiled.song, semitones, targetKey);
  const shift = mod12(semitones + 6) - 6; // bounded register over repeated key cycles
  return { ...compiled, song, symbols: song.sections.flatMap(s => s.measures.map(m => m.chords.map(c => c.symbol).join(' · ') || '—')),
    steps: compiled.steps.map(step => ({ ...step, events: step.events.map(event => {
      if (event.kind === 'note') return { ...event, midi: event.midi + shift };
      if (event.kind === 'chord') return { ...event, symbol: transposeChord(event.symbol, semitones, compiled.song.key, targetKey) };
      return event;
    }) })),
  };
}
