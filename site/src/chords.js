import { pitchClass } from './pitch.js';

// Explicit vocabulary: unknown qualities are errors, never guessed harmonies.
const TYPES = {
  '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
  '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '6/9': [0, 4, 7, 9, 14], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
  '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 'm(maj7)': [0, 3, 7, 11],
  dim7: [0, 3, 6, 9], 'm7b5': [0, 3, 6, 10], '7sus4': [0, 5, 7, 10],
  '9': [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14],
  '11': [0, 4, 7, 10, 14, 17], m11: [0, 3, 7, 10, 14, 17],
  '13': [0, 4, 7, 10, 14, 21], maj13: [0, 4, 7, 11, 14, 21], m13: [0, 3, 7, 10, 14, 21],
  '7alt': [0, 4, 8, 10, 13, 15],
};
const ALIASES = { M: '', maj: '', min: 'm', '-': 'm', '-7': 'm7', min7: 'm7', M7: 'maj7', '^7': 'maj7', '^': 'maj7',
  'Δ': 'maj7', 'Δ7': 'maj7', o: 'dim', '°': 'dim', o7: 'dim7', '°7': 'dim7', 'ø': 'm7b5', 'ø7': 'm7b5',
  '+': 'aug', sus: 'sus4', '7sus': '7sus4', 'mMaj7': 'm(maj7)', 'mM7': 'm(maj7)', 'm^7': 'm(maj7)' };
export const CHORD_QUALITIES = Object.keys(TYPES);
export function parseChord(raw) {
  if (typeof raw !== 'string') throw new TypeError('Expected chord symbol');
  const text = raw.trim();
  if (/^(N\.?C\.?)$/i.test(text)) return { symbol: 'N.C.', silent: 'harmony', pitchClasses: [] };
  if (/^Break$/i.test(text)) return { symbol: 'Break', silent: 'all', pitchClasses: [] };
  const match = /^([A-G](?:[#b♯♭]{1,2})?)(.*)$/.exec(text);
  if (!match) throw new RangeError(`Unknown chord: ${text}`);
  const spell = s => s.replaceAll('#', '♯').replaceAll('b', '♭');
  const root = spell(match[1]);
  let quality = match[2];
  const slash = /\/([A-G](?:[#b♯♭]{1,2})?)$/.exec(quality);
  const bass = slash ? spell(slash[1]) : root;
  if (slash) quality = quality.slice(0, slash.index);
  quality = quality.replaceAll('♭', 'b').replaceAll('♯', '#');
  quality = Object.hasOwn(ALIASES, quality) ? ALIASES[quality] : quality;
  let intervals = Object.hasOwn(TYPES, quality) ? TYPES[quality] : null;
  if (!intervals) {
    const altered = /^(maj7|m7|7|9|13)((?:[b#](?:5|9|11|13))+)$/.exec(quality);
    if (altered) {
      intervals = [...TYPES[altered[1]]];
      const seen = new Set();
      for (const token of altered[2].matchAll(/([b#])(5|9|11|13)/g)) {
        const degree = Number(token[2]);
        if (seen.has(degree)) throw new RangeError(`Conflicting alteration: ${text}`);
        seen.add(degree);
        const natural = { 5: 7, 9: 14, 11: 17, 13: 21 }[degree];
        intervals = intervals.filter(n => n !== natural);
        intervals.push(natural + (token[1] === '#' ? 1 : -1));
      }
      intervals.sort((a, b) => a - b);
    }
  }
  if (!intervals) throw new RangeError(`Unknown chord: ${text}`);
  return { symbol: root + quality + (slash ? '/' + bass : ''), root, bass, silent: false,
    bassPitch: pitchClass(bass), pitchClasses: intervals.map(n => (pitchClass(root) + n) % 12) };
}
