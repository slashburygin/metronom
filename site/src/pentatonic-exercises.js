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
  return root;
}
