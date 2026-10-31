import { pitchClass } from './pitch.js';
import { parseKey } from './transposition.js';
import { fraction as f } from './musical-time.js';

export function normalizeArrangement(input) {
  return { colors: input?.colors === true, fills: input?.fills === true };
}

// Opt-in natural colors only. Explicit extensions, altered/diminished/sus
// qualities are left intact. The original chord and bass are never rewritten.
export function colorChord(chord, key, variation = 0) {
  if (chord.silent || !['', 'm', '6', 'm6', '7', 'maj7', 'm7'].includes(chord.quality)) return chord;
  const parsedKey = parseKey(key);
  const scale = (parsedKey.minor ? [0,2,3,5,7,8,10] : [0,2,4,5,7,9,11]).map(n => (n + parsedKey.pitch) % 12);
  const root = pitchClass(chord.root);
  const choices = (chord.quality === '7' ? [[2], [2,9]] : [[2]])
    .map(intervals => intervals.map(n => (root + n) % 12))
    .filter(pcs => pcs.every(pc => scale.includes(pc) && !chord.pitchClasses.includes(pc)));
  if (!choices.length) return chord;
  const addedPitchClasses = choices[variation % choices.length];
  return { ...chord, pitchClasses: [...chord.pitchClasses, ...addedPitchClasses], addedPitchClasses };
}

export function transitionKind(bars, index) {
  const current = bars[index], next = bars[index + 1];
  if (!next) return 'ending';
  if (current.sectionIndex !== next.sectionIndex || next.barIndex !== current.barIndex + 1) return 'transition';
  return (index + 1) % 4 === 0 ? 'phrase' : null;
}

// Original short figures, expressed as fractions of the final audible pulse.
// They replace that pulse's ordinary drum pattern rather than layering a roll.
export function fillPattern(style, reason, variation) {
  style = ({ jazzTwoFeel: 'swing', shuffle: 'swing', samba: 'bossa', mambo: 'bossa', bolero: 'ballad', funk: 'rock', reggae: 'bossa', disco: 'rock', pop: 'straight', country: 'straight' })[style] ?? style;
  const hit = (sound, n, d, velocity) => ({ sound, at: f(n,d), velocity });
  if (reason === 'ending') return style === 'rock'
    ? [hit('kick',0,1,0.6),hit('snare',0,1,0.45),hit('hat',0,1,0.4)]
    : [hit('kick',0,1,style === 'ballad' ? 0.25 : 0.4),hit('hat',0,1,style === 'ballad' ? 0.15 : 0.28)];
  const alternate = variation % 2 === 1;
  if (style === 'swing') return alternate
    ? [hit('kick',0,1,0.35),hit('snare',1,3,0.25),hit('snare',2,3,0.4)]
    : [hit('snare',0,1,0.25),hit('snare',1,3,0.32),hit('snare',2,3,0.42)];
  if (style === 'bossa') return alternate
    ? [hit('snare',1,4,0.25),hit('hat',1,2,0.2),hit('snare',3,4,0.35)]
    : [hit('hat',0,1,0.24),hit('snare',1,2,0.28),hit('kick',3,4,0.3)];
  if (style === 'ballad') return alternate
    ? [hit('snare',1,2,0.18),hit('hat',3,4,0.15)]
    : [hit('hat',0,1,0.18),hit('snare',3,4,0.16)];
  if (style === 'rock') return alternate
    ? [hit('snare',0,1,0.4),hit('kick',1,4,0.4),hit('snare',1,2,0.5),hit('snare',3,4,0.6)]
    : [hit('kick',0,1,0.5),hit('snare',0,1,0.45),hit('snare',1,4,0.4),hit('snare',1,2,0.55),hit('snare',3,4,0.65)];
  return alternate
    ? [hit('snare',0,1,0.3),hit('snare',1,4,0.25),hit('snare',1,2,0.4),hit('snare',3,4,0.45)]
    : [hit('snare',0,1,0.3),hit('snare',1,2,0.4),hit('kick',3,4,0.35)];
}
