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

// Short scale-index cells checked against the lesson's public notation. Generate
// five starts in the selected key; these are not the author's complete score.
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

export function betterSaxPentatonicExercises(key = 'C', type = 'major') {
  const { notes } = pentatonicExercises(key, type);
  const noteAt = index => ({ note: notes[((index % 5) + 5) % 5], octave: Math.floor(index / 5) });
  return LESSON_CELLS.map(([seconds, cell], index) => {
    const descendingFirst = index === 8;
    const rows = [1, -1].map(direction => {
      const descending = descendingFirst ? direction === 1 : direction === -1;
      // Keep each generated row in a nonnegative relative register.
      const min = Math.min(...cell.map(offset => offset * direction));
      const base = -min + (descending ? 4 : 0);
      return {
        direction: descending ? 'down' : 'up',
        groups: Array.from({ length: 5 }, (_, start) => {
          const shift = (descending ? -start : start) * (index === 4 ? 2 : 1);
          return cell.map(offset => base + shift + offset * direction);
        }),
      };
    });
    // The every-other-start Bergonzi cell spans farther than the other cells.
    for (const row of rows) {
      const min = Math.min(...row.groups.flat());
      row.groups = row.groups.map(group => group.map(i => noteAt(i - Math.min(0, min))));
    }
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
  node('p', ru ? '60 BPM, одна нота на щелчок. ↑ — нота на октаву выше исходной. В группах и скачках сыграйте рисунок также в обратном порядке. Затем попробуйте по две ноты на щелчок.'
    : '60 BPM, one note per click. ↑ means one octave above the starting register. Reverse the groups and skips as well. Then try two notes per click.', 'textbook-help'));
  const labels = ru ? ['Вверх и вниз', 'Группы по три', 'Группы по четыре', 'Через одну ноту']
    : ['Up and down', 'Groups of three', 'Groups of four', 'Skip a note'];
  data.patterns.forEach((pattern, index) => {
    const section = node('section'); section.dataset.pattern = pattern.id;
    section.append(node('h4', `${index + 1}. ${labels[index]}`));
    const line = node('div', '', 'pentatonic-pattern');
    pattern.groups.forEach(group => line.append(node('span', group.map(n => n.note + (n.octave ? '↑' : '')).join(' – '))));
    section.append(line); root.append(section);
  });
  root.append(node('h4', ru ? 'Better Sax · 10 рисунков' : 'Better Sax · 10 patterns'));
  const source = node('p', '', 'textbook-help');
  const link = (text, href) => {
    const a = node('a', text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
  };
  source.append(link('Jay Metcalf / Better Sax', 'https://www.youtube.com/watch?v=27njCPeYtEg'),
    node('span', ' · '), link(ru ? 'Оригинальные ноты' : 'Original sheet music', 'https://bettersax.com/shed/?video=27njCPeYtEg'));
  root.append(source, node('p', ru
    ? 'Учебные варианты коротких ячеек из урока: пять начальных позиций в выбранной концертной тональности, в обе стороны. ↑ / ↑↑ — на одну / две октавы выше. В видео — фа минор (концерт). Выберите 2–3 рисунка на занятие, играйте медленно и чисто; чередуйте рисунки по дням.'
    : 'Practice versions of the lesson’s short cells: five starting positions in the selected concert key, in both directions. ↑ / ↑↑ means one / two octaves higher. The video uses concert F minor. Pick 2–3 patterns per session, play slowly and cleanly, and rotate your selection each day.', 'textbook-help'));
  const names = ru
    ? ['Вверх и вниз со скачком', 'Четыре соседние ноты', 'Смещённое начало', 'Скачки и возвраты', 'Ячейка Бергонци', 'Три ноты и возврат', 'Вариант скачков', 'Тройки восьмыми', 'Сначала вниз', 'Тройки триолями']
    : ['Up and down with a skip', 'Four adjacent notes', 'Displaced start', 'Skips and returns', 'Bergonzi cell', 'Three notes and return', 'Skip variation', 'Threes as eighth notes', 'Descending first', 'Threes as triplets'];
  betterSaxPentatonicExercises(key, type).forEach(pattern => {
    const section = node('section'); section.dataset.pattern = pattern.id;
    const time = `${Math.floor(pattern.seconds / 60)}:${String(pattern.seconds % 60).padStart(2, '0')}`;
    section.append(node('h4', `${pattern.number}. ${names[pattern.number - 1]}`),
      link(`${ru ? 'Видео' : 'Video'} · ${time}`, pattern.url),
      node('p', pattern.notesPerBeat === 3
        ? (ru ? 'Три ноты на щелчок — триоли.' : 'Three notes per click — triplets.')
        : (ru ? 'Две ноты на щелчок — ровные восьмые.' : 'Two notes per click — straight eighth notes.'), 'textbook-help'));
    pattern.rows.forEach(row => {
      section.append(node('p', row.direction === 'up' ? (ru ? 'Вверх' : 'Ascending') : (ru ? 'Вниз' : 'Descending'), 'field-label'));
      const line = node('div', '', 'pentatonic-pattern');
      row.groups.forEach(group => line.append(node('span', group.map(n => n.note + '↑'.repeat(n.octave)).join(' – '))));
      section.append(line);
    });
    root.append(section);
  });
  return root;
}
