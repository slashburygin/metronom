import { MAJOR_KEYS } from './harmony.js';
import { FINGER_LEVELS, fingerExercise, fingerSettings } from './finger-exercises.js';
import { rhythmSvg } from './notation.js';
import { SUBDIVISIONS } from './tempo.js';

const STORAGE = 'metronome-finger-practice';
const COPY = {
  ru: {
    title: 'Беглость пальцев · 5 минут', key: 'Написанная тональность', level: 'Длительности', direction: 'Направление',
    levels: ['Четверти · 1 нота на долю', 'Восьмые · 2 ноты на долю', 'Шестнадцатые · 4 ноты на долю'], directions: ['Вверх', 'Вниз'],
    tempo: 'Темп, BPM', apply: 'Настроить метроном · 5 мин', applied: 'Метроном настроен. Нажмите «Старт».',
    intro: 'Сыграйте арпеджио септаккорда вверх, затем спуститесь по соседним ступеням. Переносите рисунок по мажорной гамме. В обратном направлении играйте арпеджио вниз и ступени вверх.',
    note: 'Ноты указаны для вашей партии: на саксофоне играйте написанные ноты без концертной транспозиции. ↑ означает следующую октаву относительно тоники. Выберите удобный регистр.',
    row: 'Ступень', source: 'Идея занятия: Online Sax Academy — Faster Fingers Workout',
    adaptation: 'Здесь — самостоятельно построенные варианты Metronom; оригинальные ноты и минусовки доступны у автора.',
    plan: ['1 мин: сыграйте каждую строку отдельно, делая паузу между строками.', '2 мин: соедините строки в выбранном направлении, затем смените направление. Попробуйте сыграть наизусть и назвать аккорды.', '2 мин: повторите ровно и без напряжения. После трёх чистых повторов добавьте 5 BPM; при ошибках снизьте темп.'],
    tips: 'Держите пальцы близко к клавишам, избегайте лишних движений. Сначала играйте связно, затем повторите с лёгкой атакой. Скорость повышайте только при ровном ритме и свободном звуке.',
  },
  en: {
    title: 'Faster fingers · 5 minutes', key: 'Written key', level: 'Note values', direction: 'Direction',
    levels: ['Quarter notes · 1 note per beat', 'Eighth notes · 2 notes per beat', 'Sixteenth notes · 4 notes per beat'], directions: ['Up', 'Down'],
    tempo: 'Tempo, BPM', apply: 'Set metronome · 5 min', applied: 'Metronome configured. Press Start.',
    intro: 'Play a seventh-chord arpeggio up, then descend by scale steps. Move the pattern through the major scale. In the opposite direction play the arpeggio down, then scale steps up.',
    note: 'Notes are written for your part: on saxophone, play them as written without concert transposition. ↑ means the next octave relative to the tonic. Choose a comfortable register.',
    row: 'Degree', source: 'Practice inspiration: Online Sax Academy — Faster Fingers Workout',
    adaptation: 'These are independently generated Metronom variants; the original score and backing tracks are available from the author.',
    plan: ['1 min: practise each row separately, pausing between rows.', '2 min: connect rows in the selected direction, then change direction. Try playing from memory and naming the chords.', '2 min: repeat evenly without tension. After three clean repetitions add 5 BPM; slow down if you make mistakes.'],
    tips: 'Keep fingers close to the keys and avoid unnecessary movement. Play legato first, then repeat with light articulation. Increase speed only with an even rhythm and a free tone.',
  },
};
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
};
export function initFingerPractice(getLang, configure) {
  const root = document.getElementById('technique-practice');
  let key = 'C', level = 'quarter', direction = 'up', bpm = 60, configured = false;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (MAJOR_KEYS.includes(saved?.key)) key = saved.key;
    if (Object.hasOwn(FINGER_LEVELS, saved?.level)) level = saved.level;
    if (['up', 'down'].includes(saved?.direction)) direction = saved.direction;
    if (Number.isInteger(saved?.bpm) && saved.bpm >= 30 && saved.bpm <= 300) bpm = saved.bpm;
  } catch { /* Use defaults if storage is unavailable. */ }
  function save() {
    configured = false;
    try { localStorage.setItem(STORAGE, JSON.stringify({ key, level, direction, bpm })); } catch {}
  }
  function render() {
    const s = COPY[getLang()];
    root.replaceChildren(node('h3', s.title), node('p', s.intro));
    const toolbar = node('div', '', 'scale-toolbar');
    function select(id, title, values, labels, current, change) {
      const label = node('label', title), input = node('select'); input.id = id;
      values.forEach((value, i) => { const option = node('option', labels[i]); option.value = value; input.append(option); });
      input.value = current;
      input.addEventListener('change', () => { change(input.value); save(); render(); root.querySelector(`#${id}`).focus(); });
      label.append(input); toolbar.append(label);
    }
    select('finger-key', s.key, MAJOR_KEYS, MAJOR_KEYS, key, value => { key = value; });
    select('finger-level', s.level, Object.keys(FINGER_LEVELS), s.levels, level, value => { level = value; });
    select('finger-direction', s.direction, ['up', 'down'], s.directions, direction, value => { direction = value; });
    const label = node('label', s.tempo), tempo = node('input'); tempo.id = 'finger-tempo'; tempo.type = 'number'; tempo.min = 30; tempo.max = 300; tempo.value = bpm;
    tempo.addEventListener('change', () => { const value = Number(tempo.value); if (Number.isInteger(value) && value >= 30 && value <= 300) { bpm = value; save(); } tempo.value = bpm; root.querySelector('[role="status"]').textContent = ''; });
    label.append(tempo); toolbar.append(label);
    const apply = node('button', s.apply, 'btn btn--secondary'); apply.type = 'button'; apply.id = 'finger-apply';
    apply.addEventListener('click', () => { configure(fingerSettings(level, bpm)); configured = true; render(); root.querySelector('#finger-apply').focus(); });
    const status = node('p', configured ? s.applied : ''); status.setAttribute('role', 'status');
    const rhythm = node('div', '', 'finger-rhythm'); rhythm.innerHTML = rhythmSvg(SUBDIVISIONS[level]); rhythm.setAttribute('aria-hidden', 'true');
    const rows = node('ol', '', 'finger-rows');
    for (const row of fingerExercise(key, direction)) {
      const item = node('li'); item.append(node('span', `${s.row} ${row.start} · ${row.chord}`, 'field-label'));
      const notes = node('div', '', 'finger-notes');
      for (const note of row.notes) notes.append(node('span', `${note.name}${note.octave ? '↑' : ''}`));
      item.append(notes); rows.append(item);
    }
    const plan = node('ol', '', 'scale-tasks'); s.plan.forEach(text => plan.append(node('li', text)));
    const source = node('a', s.source); source.href = 'https://www.youtube.com/watch?v=WkRS9bX5ui8'; source.target = '_blank'; source.rel = 'noopener noreferrer';
    root.append(toolbar, rhythm, node('p', direction === 'up' ? '1–3–5–7 → 6–5–4–3' : '7–5–3–1 → 2–3–4–5', 'scale-notes'), apply, status, node('p', s.note, 'field-label'), rows, plan, node('p', s.tips), source, node('p', s.adaptation, 'field-label'));
  }
  return { render };
}
