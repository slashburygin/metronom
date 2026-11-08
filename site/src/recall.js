import { scaleHarmony, SCALE_TYPES, keysFor } from './harmony.js';

const DAY = 86400000;
const DAYS = [1, 3, 7, 14, 30];
export const RECALL_KEY = 'metronom-recall-v1';

export function recallDeck(key = 'C', type = 'major') {
  const harmony = scaleHarmony(key, type);
  const prefix = `${type}:${key}:`;
  return [
    { id: prefix + 'scale', kind: 'scale', notes: harmony.notes },
    ...harmony.chords.map((chord, degree) => ({ id: prefix + degree, kind: 'chord', ...chord })),
  ];
}

export function normalizeRecall(value) {
  const progress = {};
  for (const type of SCALE_TYPES) for (const key of keysFor(type)) for (const card of recallDeck(key, type)) {
    const entry = value?.progress?.[card.id];
    if (Number.isFinite(entry?.due) && entry.due >= 0 && Number.isInteger(entry.level) && entry.level >= 0 && entry.level <= DAYS.length) {
      progress[card.id] = { due: entry.due, level: entry.level };
    }
  }
  return { version: 1, progress };
}

export function nextRecall(deck, progress, now) {
  // Oldest scheduled review first, then unseen material. Future cards stay hidden.
  return deck.filter(card => progress[card.id]?.due <= now)
    .sort((a, b) => progress[a.id].due - progress[b.id].due)[0]
    ?? deck.find(card => !progress[card.id]) ?? null;
}

export function rateRecall(previous, rating, now) {
  if (!['again', 'hard', 'good'].includes(rating)) throw new RangeError('Unknown recall rating');
  if (rating === 'again') return { level: 0, due: now + 60000 };
  if (rating === 'hard') return { level: previous?.level ?? 0, due: now + DAY };
  const level = Math.min((previous?.level ?? 0) + 1, DAYS.length);
  return { level, due: now + DAYS[level - 1] * DAY };
}

export const RECALL_SKILLS = ['scale', 'triad', 'seventh', 'inversion', 'tone'];
export function learningDeck(key = 'C', type = 'major') {
  const base = recallDeck(key, type);
  const cards = [{ ...base[0], key, type, skill: 'scale' }];
  for (const chord of base.slice(1)) {
    const triad = chord.notes.slice(0, 3);
    const symbol = chord.symbol.replace(/maj7|m\(maj7\)|m7♭5|dim7|m7|7/g, match => ({ 'm(maj7)': 'm', 'm7♭5': 'dim', dim7: 'dim', m7: 'm' }[match] ?? '')).replace('+', 'aug');
    cards.push({ ...chord, key, type, skill: 'triad', id: chord.id + ':triad', symbol, notes: triad });
    cards.push({ ...chord, key, type, skill: 'seventh' });
    for (const inversion of [1, 2]) cards.push({ ...chord, key, type, skill: 'inversion', id: chord.id + ':inv' + inversion, symbol, inversion, notes: [...triad.slice(inversion), ...triad.slice(0, inversion)] });
    for (const [degree, index] of [[3, 1], [5, 2], [7, 3]]) cards.push({ ...chord, key, type, skill: 'tone', id: chord.id + ':tone' + degree, degree, notes: [chord.notes[index]] });
  }
  return cards;
}

export function localDay(now) {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
export function normalizeLearning(value) {
  const progress = {};
  for (const type of SCALE_TYPES) for (const key of keysFor(type)) for (const card of learningDeck(key, type)) {
    const entry = value?.progress?.[card.id];
    if (Number.isFinite(entry?.due) && entry.due >= 0 && Number.isInteger(entry.level) && entry.level >= 0 && entry.level <= DAYS.length) progress[card.id] = { due: entry.due, level: entry.level };
  }
  const collections = (Array.isArray(value?.collections) ? value.collections : [{ key: 'C', type: 'major' }]).filter(item => SCALE_TYPES.includes(item?.type) && keysFor(item.type).includes(item.key));
  return {
    version: 2, progress,
    collections: collections.filter((item, index) => collections.findIndex(other => other.key === item.key && other.type === item.type) === index).map(({ key, type }) => ({ key, type })),
    skills: Array.isArray(value?.skills) ? RECALL_SKILLS.filter(skill => value.skills.includes(skill)) : ['scale', 'triad'],
    newLimit: Number.isInteger(value?.newLimit) && value.newLimit >= 0 && value.newLimit <= 50 ? value.newLimit : 5,
    randomOrder: value?.randomOrder === true,
    daily: { day: typeof value?.daily?.day === 'string' ? value.daily.day : '', ids: [...new Set((Array.isArray(value?.daily?.ids) ? value.daily.ids : []).filter(id => Object.hasOwn(progress, id)))] },
  };
}
export function learningQueue(state, now, random = Math.random) {
  // Round-robin collections and skills so new material is mixed rather than exhausted by key.
  const groups = state.randomOrder ? keysFor('major').map(key => [learningDeck(key, 'major')[0]]) : state.collections.flatMap(({ key, type }) => {
    const deck = learningDeck(key, type);
    return state.skills.map(skill => deck.filter(card => card.skill === skill));
  });
  const deck = [];
  for (let i = 0; i < Math.max(0, ...groups.map(group => group.length)); i++) for (const group of groups) if (group[i]) deck.push(group[i]);
  const used = state.daily.day === localDay(now) ? state.daily.ids.length : 0;
  const due = deck.filter(card => state.progress[card.id]?.due <= now).sort((a, b) => state.progress[a.id].due - state.progress[b.id].due);
  const fresh = deck.filter(card => !state.progress[card.id]);
  const available = due.length ? due : used < state.newLimit ? fresh : [];
  const card = available.length ? available[state.randomOrder ? Math.floor(random() * available.length) : 0] : null;
  return { card, due: due.length, fresh: fresh.length, remaining: Math.max(0, state.newLimit - used), next: Math.min(Infinity, ...deck.filter(card => state.progress[card.id]?.due > now).map(card => state.progress[card.id].due)) };
}
export function recordRecall(state, card, rating, now) {
  const daily = state.daily.day === localDay(now) ? { ...state.daily, ids: [...state.daily.ids] } : { day: localDay(now), ids: [] };
  if (!state.progress[card.id]) daily.ids.push(card.id);
  return { ...state, daily, progress: { ...state.progress, [card.id]: rateRecall(state.progress[card.id], rating, now) } };
}

const SOLFEGE = { до: 'C', ре: 'D', ми: 'E', фа: 'F', соль: 'G', ля: 'A', си: 'B' };
export function checkRecallAnswer(card, text) {
  const tokens = text.trim().split(/[\s,;–—→]+/u).filter(Boolean);
  const actual = tokens.map(token => token.toLowerCase().replace(/^(соль|до|ре|ми|фа|ля|си)/u, name => SOLFEGE[name]).replace(/^[a-g]/, letter => letter.toUpperCase()).replaceAll('#', '♯').replaceAll('b', '♭').replaceAll('𝄪', '♯♯').replaceAll('𝄫', '♭♭'));
  const expected = card.notes;
  // Levenshtein alignment keeps one omitted note from shifting every later comparison.
  const dp = Array.from({ length: expected.length + 1 }, (_, i) => Array.from({ length: actual.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= expected.length; i++) for (let j = 1; j <= actual.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1));
  const issues = [];
  let i = expected.length, j = actual.length;
  while (i || j) {
    if (i && j && dp[i][j] === dp[i - 1][j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1)) {
      if (expected[i - 1] !== actual[j - 1]) issues.push({ position: i, expected: expected[i - 1], actual: actual[j - 1] });
      i--; j--;
    } else if (i && dp[i][j] === dp[i - 1][j] + 1) { issues.push({ position: i, expected: expected[i - 1], actual: null }); i--; }
    else { issues.push({ position: i + 1, expected: null, actual: actual[j - 1] }); j--; }
  }
  return { correct: issues.length === 0, issues: issues.reverse() };
}
