import { MAJOR_KEYS, majorHarmony } from './harmony.js';

const COPY = {
  ru: {
    key: 'Тональность', major: 'мажор', steps: ['Гамма', 'Аккорды', 'ii–V–I', 'Импровизация'],
    times: ['5 мин', '7 мин', '5 мин', '13 мин'],
    help: 'Ноты указаны по партии вашего инструмента. Буквы: C — до, D — ре, E — ми, F — фа, G — соль, A — ля, B — си.',
    tasks: [
      ['Спойте гамму, затем сыграйте вверх и вниз в удобном регистре.', 'Начните с каждой ступени. Затем играйте терциями: 1–3, 2–4, 3–5…', 'Придумайте короткий ритм и сыграйте его на трёх соседних нотах.'],
      ['Сыграйте арпеджио каждой ступени: 1–3–5–7 и обратно.', 'Повторите с терции, квинты и септимы: 3–5–7–1, 5–7–1–3, 7–1–3–5. Поднимайте ноты в следующую октаву по необходимости.', 'Назовите и спойте терцию и септиму каждого аккорда, затем проверьте на инструменте.'],
      ['Играйте по одному такту на аккорд в размере 4/4. Повторите тонику ещё один такт: получится цикл из четырёх тактов.', 'Сначала сыграйте каждую опорную линию длинными нотами. Сохраняйте общие звуки и ведите остальные к ближайшей ноте.', 'Соедините опорные ноты двумя-тремя звуками гаммы. Затем сыграйте арпеджио без остановки на границах аккордов.'],
      ['3 мин: импровизируйте на ii–V–I только звуками аккордов. Один аккорд на такт, тоника — два такта.', '5 мин: добавьте проходящие ноты гаммы. Повторяйте короткий мотив, меняйте ритм и оставляйте паузы.', '5 мин: снимите короткую фразу на слух или запишите своё соло. Спойте фразу и найдите её опорные аккордовые звуки.'],
    ],
    tones: 'Опорные линии: терции и септимы', criterion: 'Готово, когда можете сыграть без остановок, услышать смену аккордов и закончить фразу на аккордовом звуке.',
    tempo: 'Установить 60 BPM', tempoDone: 'Темп установлен: 60 BPM', previous: 'Назад', next: 'Далее', done: 'Шаг освоен', finish: 'Повторить цикл', formula: 'Ступень · аккорд · звуки 1–3–5–7',
  },
  en: {
    key: 'Key', major: 'major', steps: ['Scale', 'Chords', 'ii–V–I', 'Improvisation'],
    times: ['5 min', '7 min', '5 min', '13 min'],
    help: 'Notes are written pitches for your instrument. B means B natural; ♭ = flat, ♯ = sharp.',
    tasks: [
      ['Sing the scale, then play up and down in a comfortable register.', 'Start on each degree. Then play thirds: 1–3, 2–4, 3–5…', 'Invent a short rhythm and play it using three neighbouring notes.'],
      ['Play each diatonic arpeggio: 1–3–5–7, then descend.', 'Start on the third, fifth and seventh: 3–5–7–1, 5–7–1–3, 7–1–3–5. Raise notes an octave as needed.', 'Name and sing the third and seventh of each chord, then check on your instrument.'],
      ['Play one bar per chord in 4/4. Hold the tonic for an extra bar to make a four-bar loop.', 'Play each guide-tone line in long notes. Keep common tones and move to the nearest next note.', 'Connect guide tones with two or three scale notes. Then play arpeggios without stopping at chord changes.'],
      ['3 min: improvise on ii–V–I using chord tones only. One bar per chord, two bars on the tonic.', '5 min: add passing scale notes. Repeat a short motif, vary its rhythm and leave space.', '5 min: learn a short phrase by ear or record your solo. Sing a phrase and identify its target chord tones.'],
    ],
    tones: 'Guide-tone lines: thirds and sevenths', criterion: 'Move on when you can play without stopping, hear the changes and resolve a phrase to a chord tone.',
    tempo: 'Set 60 BPM', tempoDone: 'Tempo set: 60 BPM', previous: 'Back', next: 'Next', done: 'Step mastered', finish: 'Repeat cycle', formula: 'Degree · chord · tones 1–3–5–7',
  },
};

export function initScalePractice(getLang, onTempo) {
  const root = document.getElementById('scale-practice');
  let key = 'C';
  let step = 0;
  let mastered = {};
  try {
    const saved = JSON.parse(localStorage.getItem('metronome-scale-practice'));
    if (saved && MAJOR_KEYS.includes(saved.key)) key = saved.key;
    if (saved?.mastered && typeof saved.mastered === 'object') mastered = saved.mastered;
  } catch { /* Use defaults when storage is unavailable. */ }
  function save() {
    try { localStorage.setItem('metronome-scale-practice', JSON.stringify({ key, mastered })); } catch {}
  }
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function render() {
    const s = COPY[getLang()];
    const harmony = majorHarmony(key);
    root.replaceChildren();
    const toolbar = element('div', '', 'scale-toolbar');
    const label = element('label', s.key);
    const select = element('select');
    for (const value of MAJOR_KEYS) {
      const option = element('option', `${value} ${s.major}`);
      option.value = value;
      option.selected = key === value;
      select.append(option);
    }
    label.append(select);
    select.addEventListener('change', () => { key = select.value; save(); render(); root.querySelector('select').focus(); });
    const tempo = element('button', s.tempo, 'btn btn--secondary');
    tempo.addEventListener('click', () => { onTempo(60); tempo.textContent = s.tempoDone; });
    toolbar.append(label, tempo);
    const steps = element('div', '', 'scale-steps');
    steps.setAttribute('role', 'group');
    steps.setAttribute('aria-label', getLang() === 'ru' ? 'Шаг занятия' : 'Practice step');
    s.steps.forEach((name, index) => {
      const button = element('button', `${index + 1}. ${name}${mastered[`${key}:${index}`] === true ? ' ✓' : ''}`, 'btn btn--secondary');
      button.setAttribute('aria-pressed', index === step);
      button.addEventListener('click', () => { step = index; render(); root.querySelectorAll('.scale-steps button')[index].focus(); });
      steps.append(button);
    });
    const heading = element('h3', `${s.steps[step]} · ${s.times[step]}`);
    const score = element('div', '', 'scale-material');
    if (step === 0) {
      score.append(element('p', [...harmony.notes, harmony.notes[0]].join(' — '), 'scale-notes'));
      score.append(element('p', '1 — 2 — 3 — 4 — 5 — 6 — 7 — 1', 'field-label'));
    } else if (step === 1) {
      const table = element('table');
      const caption = element('caption', s.formula);
      table.append(caption);
      const body = element('tbody');
      harmony.chords.forEach((chord, index) => {
        const row = element('tr');
        const name = element('th', `${['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viiø'][index]} · ${chord.symbol}`);
        name.scope = 'row';
        row.append(name, element('td', chord.notes.join(' – ')));
        body.append(row);
      });
      table.append(body);
      score.append(table);
    } else {
      score.append(element('p', harmony.progression.map((chord) => chord.symbol).join(' → '), 'scale-notes'));
      score.append(element('p', s.tones, 'field-label'));
      for (const line of harmony.guideTones) score.append(element('p', line.join(' → '), 'scale-notes'));
    }
    const tasks = element('ol', '', 'scale-tasks');
    for (const task of s.tasks[step]) tasks.append(element('li', task));
    const checkLabel = element('label', '', 'check');
    const check = element('input');
    check.type = 'checkbox';
    check.checked = mastered[`${key}:${step}`] === true;
    check.addEventListener('change', () => {
      mastered[`${key}:${step}`] = check.checked; save();
      root.querySelectorAll('.scale-steps button')[step].textContent = `${step + 1}. ${s.steps[step]}${check.checked ? ' ✓' : ''}`;
    });
    checkLabel.append(check, element('span', s.done));
    const navigation = element('div', '', 'scale-navigation');
    const previous = element('button', s.previous, 'btn btn--secondary');
    previous.disabled = step === 0;
    const next = element('button', step === 3 ? s.finish : s.next, 'btn btn--primary');
    previous.addEventListener('click', () => { step--; render(); root.querySelector('h3').focus(); });
    next.addEventListener('click', () => { step = (step + 1) % 4; render(); root.querySelector('h3').focus(); });
    navigation.append(previous, next);
    heading.tabIndex = -1;
    root.append(toolbar, steps, heading, score, tasks, element('p', s.criterion, 'textbook-help'), checkLabel, navigation, element('p', s.help, 'textbook-help'));
  }
  return { render };
}
