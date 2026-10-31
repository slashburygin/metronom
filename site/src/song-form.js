import { ZERO, add } from './musical-time.js';

export const MAX_FORM_BARS = 4096;
const FLAGS = ['repeatStart', 'endingEnd', 'segno', 'coda', 'fine', 'toCoda'];
const JUMPS = ['dc', 'ds', 'dc-fine', 'ds-fine', 'dc-coda', 'ds-coda'];
const TOKENS = { '|:': 'repeatStart', ']': 'endingEnd', segno: 'segno', coda: 'coda', fine: 'fine', tocoda: 'toCoda' };
const JUMP_TEXT = { 'D.C.': 'dc', 'D.S.': 'ds', 'D.C.alFine': 'dc-fine', 'D.S.alFine': 'ds-fine', 'D.C.alCoda': 'dc-coda', 'D.S.alCoda': 'ds-coda' };

export function normalizeForm(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RangeError('Invalid form');
  if (Object.keys(input).some(key => ![...FLAGS, 'repeatEnd', 'ending', 'jump'].includes(key))) throw new RangeError('Unknown form field');
  const result = {};
  for (const key of FLAGS) if (input[key] !== undefined) {
    if (typeof input[key] !== 'boolean') throw new RangeError(`Invalid ${key}`);
    if (input[key]) result[key] = true;
  }
  if (input.repeatEnd !== undefined) {
    if (!Number.isInteger(input.repeatEnd) || input.repeatEnd < 2 || input.repeatEnd > 8) throw new RangeError('Repeat count must be 2–8');
    result.repeatEnd = input.repeatEnd;
  }
  if (input.ending !== undefined) {
    if (!Array.isArray(input.ending) || !input.ending.length || input.ending.some(n => !Number.isInteger(n) || n < 1 || n > 8)
      || new Set(input.ending).size !== input.ending.length) throw new RangeError('Invalid ending passes');
    result.ending = [...input.ending].sort((a, b) => a - b);
  }
  if (input.jump !== undefined) {
    if (!JUMPS.includes(input.jump)) throw new RangeError('Unknown form jump');
    result.jump = input.jump;
  }
  return result;
}

// Raw editor notation stays in the draft, including incomplete/unknown tokens.
export function parseForm(text = '') {
  if (typeof text !== 'string' || text.length > 200) throw new RangeError('Invalid form text');
  const result = {};
  const put = (key, value) => { if (Object.hasOwn(result, key)) throw new RangeError(`Duplicate form sign: ${key}`); result[key] = value; };
  for (const token of text.trim().split(/\s+/).filter(Boolean)) {
    if (Object.hasOwn(TOKENS, token.toLowerCase())) put(TOKENS[token.toLowerCase()], true);
    else if (/^:\|[2-8]?$/.test(token)) put('repeatEnd', Number(token.slice(2) || 2));
    else if (/^\[[1-8](?:,[1-8])*$/.test(token)) put('ending', token.slice(1).split(',').map(Number));
    else if (Object.hasOwn(JUMP_TEXT, token)) put('jump', JUMP_TEXT[token]);
    else throw new RangeError(`Unknown form sign: ${token}`);
  }
  return normalizeForm(result);
}

export function formText(form = {}) {
  const tokens = [];
  if (form.repeatStart) tokens.push('|:');
  if (form.ending) tokens.push('[' + form.ending.join(','));
  if (form.segno) tokens.push('Segno');
  if (form.coda) tokens.push('Coda');
  if (form.toCoda) tokens.push('ToCoda');
  if (form.fine) tokens.push('Fine');
  if (form.endingEnd) tokens.push(']');
  if (form.repeatEnd) tokens.push(':|' + (form.repeatEnd === 2 ? '' : form.repeatEnd));
  if (form.jump) tokens.push(Object.keys(JUMP_TEXT).find(key => JUMP_TEXT[key] === form.jump));
  return tokens.join(' ');
}

export class FormError extends RangeError {
  constructor(message, barIndex) { super(message); this.barIndex = barIndex; }
}

// Build repeat regions first, then expand them. Navigation is evaluated only
// over finite, checked routes; no jumps or counters enter the audio scheduler.
export function compileForm(measures) {
  const forms = measures.map(m => m.form ?? {}), regions = [], stack = [];
  const fail = (message, bar) => { throw new FormError(message, bar); };
  forms.forEach((form, bar) => {
    if (form.repeatStart) {
      if (stack.length >= 8) fail('Too many nested repeats', bar);
      stack.push(bar);
    }
    if (form.repeatEnd) {
      if (!stack.length && regions.length) fail('Repeat end needs an opening', bar);
      const start = stack.length ? stack.pop() : 0;
      regions.push({ start, end: bar, fullEnd: bar, count: form.repeatEnd, endings: [], children: [] });
    }
  });
  if (stack.length) fail('Repeat start needs a closing', stack.at(-1));

  const endings = [];
  let open;
  forms.forEach((form, bar) => {
    if (form.ending) {
      if (open) fail('Close the previous ending before opening another', bar);
      open = { start: bar, passes: form.ending };
    }
    if (form.endingEnd && !open) fail('Ending end needs an opening', bar);
    if (open && (form.endingEnd || form.repeatEnd)) { endings.push({ ...open, end: bar }); open = null; }
  });
  if (open) fail('Ending needs a closing ]', open.start);
  for (const ending of endings) {
    const inside = regions.filter(r => r.start <= ending.start && r.end >= ending.end).sort((a, b) => (a.end - a.start) - (b.end - b.start));
    const adjacent = regions.filter(r => r.fullEnd === ending.start - 1 && r.endings.length
      && ending.passes.every(pass => !r.endings.some(e => e.passes.includes(pass)))).sort((a, b) => b.start - a.start)[0];
    const owner = adjacent && (!inside[0] || adjacent.start > inside[0].start) ? adjacent : inside[0];
    if (!owner) fail('Ending must belong to a repeat', ending.start);
    if (ending.passes.some(n => n > owner.count)) fail('Ending pass exceeds repeat count', ending.start);
    if (ending.passes.some(pass => owner.endings.some(e => e.passes.includes(pass)))) fail('Each pass may have only one ending', ending.start);
    owner.endings.push(ending); owner.fullEnd = Math.max(owner.fullEnd, ending.end);
  }
  const root = { start: 0, fullEnd: measures.length - 1, children: [] };
  for (const region of regions) {
    for (const other of regions) {
      if (other === region) continue;
      const overlap = region.start <= other.fullEnd && other.start <= region.fullEnd;
      const contains = region.start <= other.start && region.fullEnd >= other.fullEnd;
      const contained = other.start <= region.start && other.fullEnd >= region.fullEnd;
      if (overlap && !contains && !contained) fail('Repeat regions overlap', region.start);
    }
    const parent = regions.filter(r => r !== region && r.start <= region.start && r.fullEnd >= region.fullEnd)
      .sort((a, b) => (a.fullEnd - a.start) - (b.fullEnd - b.start))[0] ?? root;
    parent.children.push(region);
    if (region.endings.length) {
      for (let pass = 1; pass <= region.count; pass++) if (!region.endings.some(e => e.passes.includes(pass))) fail('Every repeat pass needs an ending', region.end);
      for (const ending of region.endings) for (const child of regions.filter(r => r !== region && r.start >= region.start && r.fullEnd <= region.fullEnd)) {
        if (ending.start <= child.fullEnd && ending.end >= child.start && !(ending.start <= child.start && ending.end >= child.fullEnd))
          fail('Ending cannot cut across a nested repeat', ending.start);
      }
    }
  }
  const expand = finalPass => {
    const result = [];
    const emit = bar => { if (result.length >= MAX_FORM_BARS) fail('Expanded form exceeds 4096 bars', bar); result.push(bar); };
    function walk(region, pass) {
      for (let bar = region.start; bar <= region.fullEnd;) {
        const ending = region.endings?.find(e => bar >= e.start && bar <= e.end);
        if (ending && !ending.passes.includes(pass)) { bar = ending.end + 1; continue; }
        const child = region.children.find(r => r.start === bar);
        if (child) {
          for (let p = finalPass ? child.count : 1; p <= child.count; p++) walk(child, p);
          bar = child.fullEnd + 1;
        } else { emit(bar); bar++; }
      }
    }
    walk(root, 1);
    return result;
  };
  const initial = expand(false), lastPass = expand(true);
  const marks = {};
  for (const key of ['segno', 'coda', 'fine', 'toCoda', 'jump']) {
    const bars = forms.flatMap((form, bar) => form[key] ? [bar] : []);
    if (bars.length > 1) fail(`Only one ${key} is supported`, bars[1]);
    marks[key] = bars[0];
  }
  if (marks.jump === undefined) {
    if (marks.toCoda !== undefined) fail('ToCoda needs an alCoda jump', marks.toCoda);
    return initial;
  }
  const jump = forms[marks.jump].jump;
  const target = jump.startsWith('ds') ? marks.segno : 0;
  if (target === undefined || target > marks.jump) fail('D.S. needs a preceding Segno', marks.jump);
  const jumpAt = initial.lastIndexOf(marks.jump), targetAt = lastPass.indexOf(target);
  if (jumpAt < 0 || targetAt < 0 || !lastPass.includes(marks.jump)) fail('Jump or target is inside a skipped ending', marks.jump);
  const route = lastPass.slice(targetAt);
  let tail;
  if (jump.endsWith('-fine')) {
    const fineAt = route.indexOf(marks.fine);
    if (fineAt < 0 || marks.fine > marks.jump) fail('alFine needs a reachable Fine before the jump', marks.jump);
    if (marks.toCoda !== undefined) fail('ToCoda needs an alCoda jump', marks.toCoda);
    tail = route.slice(0, fineAt + 1);
  } else if (jump.endsWith('-coda')) {
    const until = route.indexOf(marks.toCoda), coda = lastPass.indexOf(marks.coda);
    if (until < 0 || marks.toCoda >= marks.jump || coda < 0 || marks.coda <= marks.jump)
      fail('alCoda needs ToCoda before the jump and Coda after it', marks.jump);
    tail = [...route.slice(0, until + 1), ...lastPass.slice(coda)];
  } else {
    if (marks.toCoda !== undefined) fail('ToCoda needs an alCoda jump', marks.toCoda);
    tail = route;
  }
  const order = [...initial.slice(0, jumpAt + 1), ...tail];
  if (order.length > MAX_FORM_BARS) fail('Expanded form exceeds 4096 bars', marks.jump);
  return order;
}

export function expandSong(compiled) {
  const originals = compiled.song.sections.flatMap(s => s.measures);
  const pulses = originals.map(() => []);
  for (const step of compiled.steps) pulses[step.barIndex].push(step);
  let position = ZERO;
  const steps = compiled.playOrder.flatMap((barIndex, playbackBarIndex) => pulses[barIndex].map(step => {
    const expanded = { ...step, position, playbackBarIndex };
    position = add(position, step.duration);
    return expanded;
  }));
  return { ...compiled, steps, duration: position, measures: compiled.playOrder.map(index => originals[index]) };
}
