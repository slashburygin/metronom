// Shared musical choices for custom songs and practice exercises.
export const BACKING_STYLES = ['straight', 'swing', 'bossa', 'ballad', 'rock'];
export const STYLE_NAMES = {
  ru: ['Ровный', 'Swing', 'Bossa nova', 'Баллада', 'Rock'],
  en: ['Straight', 'Swing', 'Bossa nova', 'Ballad', 'Rock'],
};

export function normalizeSeed(value = 1) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff ? value : 1;
}

export function randomSequence(seed) {
  let state = normalizeSeed(seed);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// Enumerate close-position inversions in C3–E5. Select by movement of all
// ordered voices, with a small register penalty to avoid drifting to an edge.
// No chord notes are added: alterations/extensions remain those of the source.
export function voiceChord(chord, previous = []) {
  const pcs = chord.pitchClasses;
  if (!pcs.length) return [];
  const chosen = [...new Set(pcs.length > 4 ? [pcs[1], pcs[3], pcs[4], pcs.at(-1)] : pcs)].sort((a, b) => a - b);
  const candidates = [];
  for (let bottom = 48; bottom <= 76; bottom++) {
    const index = chosen.indexOf(bottom % 12);
    if (index < 0) continue;
    const notes = [bottom];
    for (let i = 1; i < chosen.length; i++) {
      let note = 48 + chosen[(index + i) % chosen.length];
      while (note <= notes.at(-1)) note += 12;
      notes.push(note);
    }
    if (notes.at(-1) <= 76) candidates.push(notes);
  }
  const score = notes => {
    const center = notes.reduce((sum, note) => sum + note, 0) / notes.length;
    const movement = previous.length ? notes.reduce((sum, note, i) =>
      sum + Math.abs(note - previous[Math.round(i * (previous.length - 1) / Math.max(1, notes.length - 1))]), 0) : 0;
    return movement + Math.abs(center - 62) * 0.15;
  };
  return candidates.reduce((best, notes) => score(notes) < score(best) ? notes : best);
}

export function bassNote(chord, beat, previous, { walking = false, target } = {}) {
  const pcs = chord.pitchClasses;
  const slash = chord.bass !== chord.root;
  let pc = slash ? chord.bassPitch : pcs[walking ? beat % pcs.length : beat % 2 ? Math.min(2, pcs.length - 1) : 0];
  let approach = false;
  if (walking && !slash && target && !target.silent) {
    pc = (target.bassPitch + 11) % 12;
    approach = !pcs.includes(pc);
  }
  const candidates = [36 + pc, 48 + pc].filter(note => note <= 55);
  const anchor = beat === 0 || previous === undefined ? 40 : previous;
  const midi = candidates.reduce((best, note) => Math.abs(note - anchor) < Math.abs(best - anchor) ? note : best);
  return { midi, ...(approach ? { approach: true } : {}) };
}
