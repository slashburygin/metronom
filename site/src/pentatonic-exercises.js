import { createPentatonicStaff } from './pentatonic-score.js';
import { SCALE_TYPES, scaleHarmony } from './harmony.js';

// Select spelled degrees from the parent scale; minor pentatonic keeps b7
// even when the surrounding lesson is harmonic or melodic minor.
export function pentatonicExercises(key = 'C', type = 'major') {
  if (!SCALE_TYPES.includes(type)) throw new RangeError('Unknown scale');
  const major = type === 'major';
  const parent = scaleHarmony(key, major ? 'major' : 'naturalMinor');
  const degrees = major ? [0,1,2,4,5] : [0,2,3,4,6];
  const notes = degrees.map(degree => parent.notes[degree]);
  const noteAt = index => ({ note: notes[index % 5], octave: Math.floor(index / 5) });
  const groups = size => Array.from({ length: 5 }, (_, start) =>
    Array.from({ length: size }, (_, offset) => start + offset));
  const patterns = [
    { id: 'upDown', groups: [[0,1,2,3,4,5], [5,4,3,2,1,0]] },
    { id: 'threes', groups: groups(3) },
    { id: 'fours', groups: groups(4) },
    { id: 'skips', groups: [[0,2], [1,3], [2,4], [3,5], [4,6], [5]] },
  ].map(pattern => ({ ...pattern, groups: pattern.groups.map(group => group.map(noteAt)) }));
  return { major, notes, formula: major ? '1–2–3–5–6' : '1–♭3–4–5–♭7', patterns };
}

// Scale-index cells and phrase ranges checked against the lesson's four public
// notation pages (alto part in D minor). Index 0 is the tonic, 5 its octave;
// negative indices retain the lower register instead of shifting a phrase up.
const LESSON_CELLS = [
  [46, [0,1,2,3,4,3,2,0]],
  [100, [0,1,2,3]],
  [131, [2,0,1,2]],
  [174, [0,2,1,3,2,4,3,2]],
  [251, [0,2,3,1]],
  [294, [0,1,2,0]],
  [332, [0,2,1,3,2,1,0,2]],
  [380, [0,1,2]],
  [408, [0,-1,-2,0,-1,1,0,-2]],
  [468, [0,1,2]],
];
// [first cell base, number of cells, base increment, cell direction, tail].
// The last tail note is a quarter; preceding tail notes keep the pattern rhythm.
const LESSON_PHRASES = [
  [[0,5,1,1,[5]], [8,4,-1,-1,[4,3,2,1,0]]],
  [[0,6,1,1,[6]], [8,7,-1,-1,[0]]],
  [[-1,7,1,1,[8]], [9,8,-1,-1,[-1]]],
  [[0,5,1,1,[5]], [8,6,-1,-1,[0]]],
  [[0,4,2,1,[8]], [9,4,-2,-1,[1]]],
  [[0,8,1,1,[8]], [9,9,-1,-1,[0]]],
  [[0,5,1,1,[5]], [8,6,-1,-1,[2,0,1,-1,0]]],
  [[0,8,1,1,[8]], [9,8,-1,-1,[]]],
  [[8,8,-1,1,[0]], [0,7,1,-1,[7]]],
  [[0,8,1,1,[8]], [9,8,-1,-1,[0]]],
];

export function betterSaxPentatonicExercises(key = 'C', type = 'major') {
  const { notes } = pentatonicExercises(key, type);
  const noteAt = index => ({ note: notes[((index % 5) + 5) % 5], octave: Math.floor(index / 5) });
  return LESSON_CELLS.map(([seconds, cell], index) => {
    const rows = LESSON_PHRASES[index].map(([base, count, stride, sign, tail]) => {
      const groups = Array.from({ length: count }, (_, start) =>
        cell.map(offset => noteAt(base + start * stride + offset * sign)));
      if (tail.length) groups.push(tail.map((degree, i) => ({
        ...noteAt(degree), ...(i === tail.length - 1 ? { quarter: true } : {}),
      })));
      return { direction: stride > 0 ? 'up' : 'down', groups };
    });
    return { id: `betterSax${index + 1}`, number: index + 1, seconds,
      url: `https://www.youtube.com/watch?v=27njCPeYtEg&t=${seconds}s`,
      notesPerBeat: index === 9 ? 3 : 2, rows };
  });
}

export function createPentatonicMaterial(key, type, lang) {
  const ru = lang === 'ru', data = pentatonicExercises(key, type);
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const root = node('div', '', 'pentatonic-material');
  root.append(node('h4', ru ? (data.major ? 'Мажорная пентатоника' : 'Минорная пентатоника')
    : (data.major ? 'Major pentatonic' : 'Minor pentatonic')),
  node('p', `${data.formula} · ${data.notes.join(' — ')}`, 'scale-notes'),
  node('p', ru ? '60 BPM, одна нота на щелчок. В группах и скачках сыграйте рисунок также в обратном порядке. Затем попробуйте по две ноты на щелчок.'
    : '60 BPM, one note per click. Reverse the groups and skips as well. Then try two notes per click.', 'textbook-help'));
  const labels = ru ? ['Вверх и вниз', 'Группы по три', 'Группы по четыре', 'Через одну ноту']
    : ['Up and down', 'Groups of three', 'Groups of four', 'Skip a note'];
  data.patterns.forEach((pattern, index) => {
    const section = node('section'); section.dataset.pattern = pattern.id;
    section.append(node('h4', `${index + 1}. ${labels[index]}`));
    section.append(createPentatonicStaff(pattern.groups, key, type)); root.append(section);
  });
  root.append(node('h4', ru ? 'Better Sax · 10 рисунков' : 'Better Sax · 10 patterns'));
  const source = node('p', '', 'textbook-help');
  const link = (text, href) => {
    const a = node('a', text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
  };
  source.append(node('span', 'Jay Metcalf / Better Sax'),
    node('span', ' · '), link(ru ? 'Оригинальные ноты' : 'Original sheet music', 'https://bettersax.com/shed/?video=27njCPeYtEg'));
  root.append(source, node('p', ru
    ? 'Рисунки из урока в выбранной концертной тональности: полный диапазон последовательностей и завершающие ноты, в обе стороны. В видео — фа минор (концерт). Выберите 2–3 рисунка на занятие, играйте медленно и чисто; чередуйте рисунки по дням.'
    : 'Lesson patterns in the selected concert key: full sequence ranges and ending notes, in both directions. The video uses concert F minor. Pick 2–3 patterns per session, play slowly and cleanly, and rotate your selection each day.', 'textbook-help'));
  const names = ru
    ? ['Вверх и вниз со скачком', 'Четыре соседние ноты', 'Смещённое начало', 'Скачки и возвраты', 'Ячейка Бергонци', 'Три ноты и возврат', 'Вариант скачков', 'Тройки восьмыми', 'Сначала вниз', 'Тройки триолями']
    : ['Up and down with a skip', 'Four adjacent notes', 'Displaced start', 'Skips and returns', 'Bergonzi cell', 'Three notes and return', 'Skip variation', 'Threes as eighth notes', 'Descending first', 'Threes as triplets'];
  betterSaxPentatonicExercises(key, type).forEach(pattern => {
    const section = node('section'); section.dataset.pattern = pattern.id;
    section.append(node('h4', `${pattern.number}. ${names[pattern.number - 1]}`),
      node('p', pattern.notesPerBeat === 3
        ? (ru ? 'Три ноты на щелчок — триоли.' : 'Three notes per click — triplets.')
        : (ru ? 'Две ноты на щелчок — ровные восьмые.' : 'Two notes per click — straight eighth notes.'), 'textbook-help'));
    pattern.rows.forEach(row => {
      section.append(node('p', row.direction === 'up' ? (ru ? 'Вверх' : 'Ascending') : (ru ? 'Вниз' : 'Descending'), 'field-label'));
      section.append(createPentatonicStaff(row.groups, key, type, pattern.notesPerBeat));
    });
    root.append(section);
  });
  return root;
}
