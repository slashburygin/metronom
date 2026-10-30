import { fraction as f, ZERO, add, compare } from './musical-time.js';
import { compileSong } from './song.js';
import { parseChord } from './chords.js';
import { parseKey } from './transposition.js';

export const emptyMeasure = () => ({ chords: '', alternate: '', text: '', meter: '4/4' });
export function newDraft() {
  return { title: '', composer: '', key: 'C', bpm: 120, sections: [{ name: 'A', measures: Array.from({ length: 4 }, emptyMeasure) }] };
}
export function parseMeasure(text, meterText = '4/4') {
  const match = /^(\d+)\/(1|2|4|8|16|32)$/.exec(meterText);
  if (!match) throw new RangeError('Invalid meter');
  const numerator = Number(match[1]), denominator = Number(match[2]);
  const tokens = text.trim() ? text.trim().split(/\s+/) : [];
  if (tokens.length > 32) throw new RangeError('Too many chords');
  const explicit = tokens.some(token => token.includes(':'));
  let offset = ZERO;
  const chords = tokens.map(token => {
    const [symbol, beats, ...extra] = token.split(':');
    if (extra.length || (explicit && !/^\d+(?:\/\d+)?$/.test(beats ?? ''))) throw new RangeError('Use durations for every chord');
    const parsed = parseChord(symbol);
    const [n, d = 1] = explicit ? beats.split('/').map(Number) : [numerator, tokens.length];
    const duration = f(n, d * denominator);
    if (duration.n <= 0) throw new RangeError('Duration must be positive');
    const event = { symbol: parsed.symbol, offset, duration };
    offset = add(offset, duration);
    return event;
  });
  if (tokens.length && compare(offset, f(numerator, denominator)) !== 0) throw new RangeError('Chord durations must fill the bar');
  return { meter: { numerator, denominator }, chords };
}
export function compileDraft(draft) {
  const errors = [];
  try { parseKey(draft.key); } catch (error) { errors.push({ message: error.message }); }
  const sections = draft.sections.map((section, sectionIndex) => ({ name: section.name, measures: section.measures.map((measure, measureIndex) => {
    try {
      const parsed = parseMeasure(measure.chords, measure.meter);
      const alternates = measure.alternate.trim() ? measure.alternate.trim().split(/\s+/).map(parseChord) : [];
      if (alternates.length && alternates.length !== parsed.chords.length) throw new RangeError('One alternate per chord');
      return { ...parsed, text: measure.text, chords: parsed.chords.map((chord, i) => ({ ...chord, ...(alternates[i] ? { alternate: alternates[i].symbol } : {}) })) };
    } catch (error) {
      errors.push({ sectionIndex, measureIndex, message: error.message });
      return { meter: { numerator: 4, denominator: 4 }, chords: [] };
    }
  }) }));
  if (errors.length) return { errors, compiled: null };
  try { return { errors, compiled: compileSong({ ...draft, sections }) }; }
  catch (error) { return { errors: [{ message: error.message }], compiled: null }; }
}

const clone = data => JSON.parse(JSON.stringify(data));
export class DraftHistory {
  constructor(draft) { this.current = clone(draft); this.past = []; this.future = []; this.group = null; }
  update(draft, group = null) {
    if (JSON.stringify(draft) === JSON.stringify(this.current)) return false;
    if (!group || group !== this.group) { this.past.push(clone(this.current)); if (this.past.length > 100) this.past.shift(); }
    this.current = clone(draft); this.group = group; this.future = []; return true;
  }
  undo() { if (!this.past.length) return false; this.future.push(this.current); this.current = this.past.pop(); this.group = null; return true; }
  redo() { if (!this.future.length) return false; this.past.push(this.current); this.current = this.future.pop(); this.group = null; return true; }
}

export const DRAFT_STORAGE = 'metronome-song-drafts';
export function loadDrafts(storage) {
  const raw = storage.getItem(DRAFT_STORAGE);
  if (raw === null) return { version: 1, documents: [], currentId: null };
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.documents) || data.documents.length > 100) throw new RangeError('Invalid draft collection');
  for (const doc of data.documents) {
    const draft = doc.draft;
    if (typeof doc.id !== 'string' || !draft || !Array.isArray(draft.sections) || !draft.sections.length
      || typeof draft.title !== 'string' || typeof draft.composer !== 'string' || typeof draft.key !== 'string'
      || !Number.isFinite(draft.bpm) || draft.bpm < 30 || draft.bpm > 300) throw new RangeError('Invalid draft');
    if (draft.sections.length > 32) throw new RangeError('Too many sections');
    let count = 0;
    for (const section of draft.sections) {
      if (typeof section.name !== 'string' || !Array.isArray(section.measures) || !section.measures.length) throw new RangeError('Invalid section');
      count += section.measures.length;
      for (const measure of section.measures) if (!['chords','alternate','text','meter'].every(k => typeof measure[k] === 'string')) throw new RangeError('Invalid measure');
    }
    if (count > 256) throw new RangeError('Too many measures');
  }
  if (new Set(data.documents.map(doc => doc.id)).size !== data.documents.length) throw new RangeError('Duplicate draft IDs');
  return data;
}
