import { openChordReference } from './chord-reference-ui.js';
import { createTaskHelp } from './practice-help.js';
import { SCALE_TYPES, keysFor, scaleHarmony } from './harmony.js';
import { createPracticePlayer } from './practice-player.js';

const COPY = {
  ru: {
    key: 'Исходная тоника (концерт)', scaleType: 'Гамма', types: ['Мажор', 'Минор натуральный', 'Минор гармонический', 'Минор мелодический (джаз)'], steps: ['Гамма', 'Аккорды', 'ii–V–I', 'Импровизация'],
    times: ['5 мин', '7 мин', '5 мин', '13 мин'],
    help: 'Учебные таблицы указаны в исходной концертной тональности; в сетке аккомпанемента отображается выбранная партия инструмента. Буквы: C — до, D — ре, E — ми, F — фа, G — соль, A — ля, B — си. ♯♯ — дубль-диез.',
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
    key: 'Source tonic (concert)', scaleType: 'Scale', types: ['Major', 'Natural minor', 'Harmonic minor', 'Melodic minor (jazz)'], steps: ['Scale', 'Chords', 'ii–V–I', 'Improvisation'],
    times: ['5 min', '7 min', '5 min', '13 min'],
    help: 'Study tables use the original concert key; the backing chart shows the selected instrument part. B means B natural; ♭ = flat, ♯ = sharp, ♯♯ = double sharp.',
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

export function initScalePractice(getLang, onTempo, playback) {
  const root = document.getElementById('scale-practice');
  const backing = createPracticePlayer({ ...playback, getLang, onTempo });
  let key = 'C';
  let type = 'major';
  let step = 0;
  let mastered = {};
  try {
    const saved = JSON.parse(localStorage.getItem('metronome-scale-practice'));
    if (SCALE_TYPES.includes(saved?.type)) type = saved.type;
    if (saved && keysFor(type).includes(saved.key)) key = saved.key;
    if (saved?.mastered && typeof saved.mastered === 'object') mastered = saved.mastered;
  } catch { /* Use defaults when storage is unavailable. */ }
  function save() {
    try { localStorage.setItem('metronome-scale-practice', JSON.stringify({ key, type, mastered })); } catch {}
  }
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function render() {
    const s = COPY[getLang()];
    const harmony = scaleHarmony(key, type);
    const progressKey = (index) => type === 'major' ? `${key}:${index}` : `${type}:${key}:${index}`;
    const stepNames = [...s.steps];
    stepNames[2] = harmony.progressionLabel;
    root.replaceChildren();
    const toolbar = element('div', '', 'scale-toolbar');
    const label = element('label', s.key);
    const select = element('select');
    for (const value of keysFor(type)) {
      const option = element('option', value);
      option.value = value;
      option.selected = key === value;
      select.append(option);
    }
    label.append(select);
    select.addEventListener('change', () => { key = select.value; save(); render(); root.querySelector('select').focus(); });
    const tempo = element('button', s.tempo, 'btn btn--secondary');
    tempo.addEventListener('click', () => { onTempo(60); tempo.textContent = s.tempoDone; });
    const typeLabel = element('label', s.scaleType);
    const typeSelect = element('select');
    typeSelect.id = 'scale-type';
    SCALE_TYPES.forEach((value, index) => {
      const option = element('option', s.types[index]);
      option.value = value;
      option.selected = type === value;
      typeSelect.append(option);
    });
    typeSelect.addEventListener('change', () => {
      const pitch = keysFor(type).indexOf(key);
      type = typeSelect.value;
      key = keysFor(type)[pitch];
      save(); render(); root.querySelector('#scale-type').focus();
    });
    typeLabel.append(typeSelect);
    select.id = 'scale-root';
    toolbar.append(label, typeLabel, tempo);
    const steps = element('div', '', 'scale-steps');
    steps.setAttribute('role', 'group');
    steps.setAttribute('aria-label', getLang() === 'ru' ? 'Шаг занятия' : 'Practice step');
    stepNames.forEach((name, index) => {
      const button = element('button', `${index + 1}. ${name}${mastered[progressKey(index)] === true ? ' ✓' : ''}`, 'btn btn--secondary');
      button.setAttribute('aria-pressed', index === step);
      button.addEventListener('click', () => { step = index; render(); root.querySelectorAll('.scale-steps button')[index].focus(); });
      steps.append(button);
    });
    const heading = element('h3', `${stepNames[step]} · ${s.times[step]}`);
    const score = element('div', '', 'scale-material');
    if (step === 0) {
      score.append(element('p', [...harmony.notes, harmony.notes[0]].join(' — '), 'scale-notes'));
      score.append(element('p', '1 — 2 — 3 — 4 — 5 — 6 — 7 — 1', 'field-label'));
    } else if (step === 1) {
      const table = element('table');
      const caption = element('caption', s.formula);
      table.append(caption);
      const body = element('tbody');
      harmony.chords.forEach((chord) => {
        const row = element('tr');
        const name = element('th');
        const reference=element('button',`${chord.roman} · ${chord.symbol}`,'btn btn--ghost');reference.type='button';reference.addEventListener('click',()=>openChordReference(chord.symbol,getLang()));name.append(reference);
        name.scope = 'row';
        row.append(name, element('td', chord.notes.join(' – ')));
        body.append(row);
      });
      table.append(body);
      score.append(table);
    } else {
      const reference=element('div','','song-toolbar');for(const chord of harmony.progression){const button=element('button',chord.symbol,'btn btn--secondary');button.type='button';button.addEventListener('click',()=>openChordReference(chord.symbol,getLang()));reference.append(button);}score.append(reference);
      score.append(element('p', s.tones, 'field-label'));
      for (const line of harmony.guideTones) score.append(element('p', line.join(' → '), 'scale-notes'));
    }
    const tasks = element('ol', '', 'scale-tasks');
    s.tasks[step].forEach((task, index) => {
      const item = element('li', task.replaceAll('ii–V–I', harmony.progressionLabel));
      item.append(' ', ...createTaskHelp(harmony, step, index, getLang()));
      tasks.append(item);
    });
    const checkLabel = element('label', '', 'check');
    const check = element('input');
    check.type = 'checkbox';
    check.checked = mastered[progressKey(step)] === true;
    check.addEventListener('change', () => {
      mastered[progressKey(step)] = check.checked; save();
      root.querySelectorAll('.scale-steps button')[step].textContent = `${step + 1}. ${stepNames[step]}${check.checked ? ' ✓' : ''}`;
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
    const modeHelp = element('p', type === 'melodicMinor'
      ? (getLang() === 'ru' ? 'Джазовый мелодический минор: VI и VII повышены вверх и вниз.' : 'Jazz melodic minor: raised sixth and seventh ascending and descending.')
      : type === 'harmonicMinor'
        ? (getLang() === 'ru' ? 'Гармонический минор: повышенная VII ступень. m(maj7) — минорный аккорд с большой септимой; +maj7 — увеличенный с большой септимой; dim7 — уменьшённый септаккорд.' : 'Harmonic minor: raised seventh. m(maj7) = minor major seventh; +maj7 = augmented major seventh; dim7 = diminished seventh.')
        : type === 'naturalMinor'
          ? (getLang() === 'ru' ? `Натуральный минор: VI и VII понижены относительно мажора. В iiø–V–i на ${harmony.progression[1].symbol} используйте ${harmony.progression[1].notes[1]} вместо ${harmony.notes[6]}: это повышенная VII ступень из гармонического минора.` : `Natural minor: lowered sixth and seventh relative to major. In iiø–V–i, use ${harmony.progression[1].notes[1]} instead of ${harmony.notes[6]} on ${harmony.progression[1].symbol}: the raised seventh from harmonic minor.`)
          : '', 'textbook-help scale-mode-help');
    modeHelp.hidden = type === 'major';
    root.append(toolbar, modeHelp, steps, heading, score);
    if (step >= 2) {
      backing.setHarmony(harmony);
      root.append(backing.element);
    } else backing.stop();
    root.append(tasks, element('p', s.criterion, 'textbook-help'), checkLabel, navigation, element('p', s.help, 'textbook-help'));
  }
  return { render, stop: backing.stop, setBpm: backing.setBpm };
}
