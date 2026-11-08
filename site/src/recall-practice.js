import { SCALE_TYPES, keysFor, scaleHarmony } from './harmony.js';
import { RECALL_KEY, RECALL_SKILLS, normalizeLearning, learningQueue, recordRecall, checkRecallAnswer, rateRecall, learningDeck } from './recall.js';

const COPY = {
  ru: {
    title: 'Запоминание гамм и аккордов', key: 'Тоника', type: 'Гамма',
    types: ['Мажор', 'Минор натуральный', 'Минор гармонический', 'Минор мелодический (джаз)'],
    skills: ['Гаммы', 'Трезвучия', 'Септаккорды', 'Обращения трезвучий', 'Ступени аккордов'],
    settings: 'Что изучать', add: 'Добавить в очередь', remove: 'Убрать', limit: 'Новых заданий в день',
    hint: 'Вспомните ноты, затем проверьте ответ. Играйте и пойте в удобном темпе. Все задания — в концертном строе.',
    input: 'Ноты по порядку', placeholder: 'Например: C D E F G A B',
    keyboard: 'Клавиатура нот', clear: 'Очистить ответ', spelling: 'Сохраняйте написание нот гаммы: например, F♯ и G♭ звучат одинаково, но при проверке различаются.',
    inputHelp: 'Буквы C–B или до–си, через пробел. # или ♯, b или ♭. Без октав. В гамме перечислите 7 нот, не повторяя тонику.',
    scale: 'Назовите семь нот гаммы от тоники.', triad: 'Назовите ноты трезвучия от основного тона.', seventh: 'Назовите ноты септаккорда от основного тона.',
    inversion: 'Назовите ноты снизу вверх. Верхние ноты переносите в следующую октаву при игре.', tone: 'Назовите указанную ступень аккорда.',
    inversions: ['Основной вид', 'Первое обращение', 'Второе обращение'], degree: 'ступень',
    check: 'Проверить', show: 'Не помню — показать', correct: 'Верно. Теперь сыграйте или спойте по памяти.', wrong: 'Есть ошибки. Сравните ответ и сыграйте правильный вариант.',
    missing: 'пропущено', extra: 'лишняя нота', expected: 'нужно',
    again: 'Повторить через минуту', hard: 'Вспомнил с трудом · завтра', good: 'Вспомнил уверенно',
    done: 'На сейчас всё', empty: 'Добавьте тональность и выберите хотя бы один вид задания.',
    finished: 'Сегодняшняя очередь завершена. Новые задания появятся завтра; повторения — в назначенное время.',
    next: 'Ближайшее повторение', counts: (due, remaining, fresh) => `Повторений: ${due} · Новых на сегодня: ${Math.min(remaining, fresh)} · Не изучено: ${fresh}`,
    music: 'Примените в музыке', application: 'Сыграйте по такту на аккорд: I–IV–V–I. Затем придумайте короткую фразу из нот гаммы и завершите её на тонике.',
    musicDone: 'Сыграл', session: n => `Проверено за занятие: ${n}`, saved: 'Прогресс сохраняется на этом устройстве. Проверка игры на инструменте — самостоятельная.',
    warning: 'Прогресс не удалось сохранить. После перезагрузки результаты могут потеряться.', shortcuts: 'Enter — проверить. После ответа: 1 — повторить, 2 — с трудом, 3 — уверенно.',
  },
  en: {
    title: 'Scale and chord recall', key: 'Tonic', type: 'Scale',
    types: ['Major', 'Natural minor', 'Harmonic minor', 'Melodic minor (jazz)'],
    skills: ['Scales', 'Triads', 'Seventh chords', 'Triad inversions', 'Chord tones'],
    settings: 'Study settings', add: 'Add to queue', remove: 'Remove', limit: 'New cards per day',
    hint: 'Recall the notes, then check your answer. Play and sing at a comfortable tempo. All tasks use concert pitch.',
    input: 'Notes in order', placeholder: 'For example: C D E F G A B',
    keyboard: 'Note keyboard', clear: 'Clear answer', spelling: 'Use the scale’s note spelling: F♯ and G♭ sound the same but are different answers here.',
    inputHelp: 'Use C–B or Russian solfege, separated by spaces. # or ♯, b or ♭. No octave numbers. Enter 7 scale notes without repeating the tonic.',
    scale: 'Name the seven scale notes starting from the tonic.', triad: 'Name the triad notes starting from the root.', seventh: 'Name the seventh chord notes starting from the root.',
    inversion: 'Name notes from bottom to top. Raise upper notes to the next octave when playing.', tone: 'Name the requested chord tone.',
    inversions: ['Root position', 'First inversion', 'Second inversion'], degree: 'degree',
    check: 'Check answer', show: 'Forgot — reveal', correct: 'Correct. Now play or sing from memory.', wrong: 'Some notes need correcting. Compare and play the correct answer.',
    missing: 'missing', extra: 'extra note', expected: 'expected',
    again: 'Review in a minute', hard: 'Recalled with effort · tomorrow', good: 'Recalled confidently',
    done: 'All done for now', empty: 'Add a key and select at least one task type.',
    finished: 'Today’s queue is complete. New cards return tomorrow; reviews appear when due.',
    next: 'Next review', counts: (due, remaining, fresh) => `Reviews: ${due} · New today: ${Math.min(remaining, fresh)} · Unseen: ${fresh}`,
    music: 'Make music', application: 'Play one bar per chord: I–IV–V–I. Then invent a short phrase using the scale notes and resolve to the tonic.',
    musicDone: 'Played it', session: n => `Checked this session: ${n}`, saved: 'Progress is saved on this device. Instrument performance is self-assessed.',
    warning: 'Progress could not be saved. Results may be lost after reloading.', shortcuts: 'Enter — check. After answering: 1 — repeat, 2 — with effort, 3 — confident.',
  },
};
const element = (tag, text = '', className = '') => {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
};
const button = (label, action, primary = false) => {
  const node = element('button', label, `btn btn--${primary ? 'primary' : 'secondary'}`); node.type = 'button'; node.addEventListener('click', action); return node;
};

export function initRecallPractice(getLang) {
  const root = document.getElementById('recall-practice');
  let state, warning = false;
  try { state = normalizeLearning(JSON.parse(localStorage.getItem(RECALL_KEY))); }
  catch { state = normalizeLearning(); }
  let key = 'C', type = 'major', card = null, result = null, revealed = false, draft = '', settingsOpen = false, checked = 0, musicDone = false, lastStudied = null;
  function save() {
    try { localStorage.setItem(RECALL_KEY, JSON.stringify(state)); warning = false; } catch { warning = true; }
  }
  function reset() { card = null; result = null; revealed = false; draft = ''; }
  function rate(rating) {
    if (!card || !revealed || (rating !== 'again' && !result?.correct)) return;
    state = recordRecall(state, card, rating, Date.now()); checked++; musicDone = false;
    lastStudied = { key: card.key, type: card.type };
    save(); reset(); render(true);
  }
  function render(focus = false) {
    const lang = getLang(), s = COPY[lang], now = Date.now(), queue = learningQueue(state, now);
    if (!card) { card = queue.card; result = null; revealed = false; draft = ''; }
    root.replaceChildren();
    const heading = element('h3', s.title); root.append(heading, element('p', s.hint, 'textbook-help'));
    const settings = element('details'); settings.open = settingsOpen;
    settings.addEventListener('toggle', () => { settingsOpen = settings.open; });
    settings.append(element('summary', s.settings));
    const toolbar = element('div', '', 'song-fields');
    function select(label, values, labels, value, change) {
      const field = element('label', label), input = element('select');
      values.forEach((item, i) => { const option = element('option', labels[i]); option.value = item; option.selected = item === value; input.append(option); });
      input.addEventListener('change', () => { change(input.value); render(); });
      field.append(input); toolbar.append(field);
    }
    select(s.key, keysFor(type), keysFor(type), key, value => { key = value; });
    select(s.type, SCALE_TYPES, s.types, type, value => { const pitch = keysFor(type).indexOf(key); type = value; key = keysFor(type)[pitch]; });
    toolbar.append(button(s.add, () => {
      if (!state.collections.some(item => item.key === key && item.type === type)) state.collections.push({ key, type });
      save(); reset(); render(true);
    }));
    settings.append(toolbar);
    const collections = element('ul', '', 'recall-collections');
    for (const item of state.collections) {
      const row = element('li', `${item.key} · ${s.types[SCALE_TYPES.indexOf(item.type)]} `);
      const remove = button(s.remove, () => { state.collections = state.collections.filter(entry => entry !== item); save(); reset(); render(true); });
      remove.setAttribute('aria-label', `${s.remove}: ${item.key} ${s.types[SCALE_TYPES.indexOf(item.type)]}`);
      row.append(remove); collections.append(row);
    }
    settings.append(collections);
    const skills = element('fieldset', '', 'recall-skills'); skills.append(element('legend', s.settings));
    RECALL_SKILLS.forEach((skill, i) => {
      const label = element('label', '', 'check'), input = element('input'); input.type = 'checkbox'; input.checked = state.skills.includes(skill);
      input.addEventListener('change', () => { state.skills = RECALL_SKILLS.filter(value => value === skill ? input.checked : state.skills.includes(value)); save(); reset(); render(true); });
      label.append(input, element('span', s.skills[i])); skills.append(label);
    });
    settings.append(skills);
    const limitLabel = element('label', s.limit), limit = element('input'); limit.type = 'number'; limit.min = 0; limit.max = 50; limit.value = state.newLimit;
    limit.addEventListener('change', () => { state.newLimit = Math.max(0, Math.min(50, Math.round(Number(limit.value) || 0))); save(); reset(); render(true); });
    limitLabel.append(limit); settings.append(limitLabel); root.append(settings);
    root.append(element('p', s.counts(queue.due, queue.remaining, queue.fresh), 'textbook-help'));
    const task = element('div', '', 'recall-task'); root.append(task);
    if (card) {
      let name = `${card.key} · ${s.types[SCALE_TYPES.indexOf(card.type)]}`;
      if (card.skill !== 'scale') name += ` · ${card.symbol}`;
      if (card.skill === 'inversion') name += ` · ${s.inversions[card.inversion]}`;
      if (card.skill === 'tone') name += ` · ${card.degree} ${s.degree}`;
      task.append(element('h4', name), element('p', s[card.skill]));
      if (!revealed) {
        const form = element('form'), label = element('label', s.input), input = element('input');
        input.id = 'recall-answer'; input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false; input.autocapitalize = 'off'; input.value = draft; input.placeholder = s.placeholder;
        input.setAttribute('aria-describedby', 'recall-input-help'); input.addEventListener('input', () => { draft = input.value; });
        label.append(input); form.append(label);
        const help = element('p', s.inputHelp, 'textbook-help'); help.id = 'recall-input-help'; form.append(help);
        const keyboard = element('div', '', 'recall-keyboard'); keyboard.setAttribute('role', 'group'); keyboard.setAttribute('aria-label', s.keyboard);
        for (const note of ['C', 'D', 'E', 'F', 'G', 'A', 'B', '♯', '♭']) keyboard.append(button(note, () => {
          const before = input.value.slice(0, input.selectionStart), after = input.value.slice(input.selectionEnd);
          const accidental = note === '♯' || note === '♭';
          const insertion = accidental ? note : `${before && !/\s$/.test(before) ? ' ' : ''}${note}${after && !/^\s/.test(after) ? ' ' : ''}`;
          input.setRangeText(insertion, input.selectionStart, input.selectionEnd, 'end'); draft = input.value; input.focus();
        }));
        keyboard.append(button(s.clear, () => { input.value = ''; draft = ''; input.focus(); })); form.append(keyboard);
        const actions = element('div', '', 'song-toolbar'), check = element('button', s.check, 'btn btn--primary'); check.type = 'submit';
        actions.append(check, button(s.show, () => { revealed = true; result = null; render(true); })); form.append(actions);
        form.addEventListener('submit', event => {
          event.preventDefault(); if (!draft.trim()) { input.focus(); return; }
          result = checkRecallAnswer(card, draft); revealed = true; render(true);
        }); task.append(form);
      } else {
        const feedback = element('div', '', 'recall-feedback'); feedback.setAttribute('role', 'status');
        if (result) {
          feedback.append(element('p', result.correct ? s.correct : s.wrong));
          if (!result.correct) {
            const list = element('ul');
            for (const issue of result.issues) list.append(element('li', `${issue.position}: ${issue.actual ?? s.missing} → ${issue.expected ? `${s.expected} ${issue.expected}` : s.extra}`));
            feedback.append(list, element('p', s.spelling, 'textbook-help'));
          }
        }
        feedback.append(element('p', card.notes.join(' — '), 'scale-notes')); task.append(feedback);
        const ratings = element('div', '', 'recall-ratings song-toolbar');
        ratings.append(button('1 · ' + s.again, () => rate('again')));
        if (result?.correct) {
          ratings.append(button('2 · ' + s.hard, () => rate('hard')));
          const days = Math.round((rateRecall(state.progress[card.id], 'good', now).due - now) / 86400000);
          ratings.append(button(`3 · ${s.good} · ${days} ${lang === 'ru' ? 'дн.' : 'days'}`, () => rate('good'), true));
        }
        task.append(ratings);
      }
    } else {
      task.append(element('h4', s.done), element('p', !state.collections.length || !state.skills.length ? s.empty : s.finished));
      if (Number.isFinite(queue.next)) task.append(element('p', `${s.next}: ${new Date(queue.next).toLocaleString(lang)}`));
    }
    if (checked > 0 && state.collections.length) {
      const item = lastStudied ?? state.collections[0], harmony = scaleHarmony(item.key, item.type);
      const music = element('section', '', 'recall-music'); music.append(element('h4', `${s.music} · ${item.key}`), element('p', s.application));
      const triads = learningDeck(item.key, item.type).filter(entry => entry.skill === 'triad');
      music.append(element('p', [0, 3, 4, 0].map(degree => triads[degree].symbol).join(' → '), 'scale-notes'));
      music.append(element('p', harmony.notes.join(' — '), 'textbook-help'));
      if (item.type !== 'major') music.append(element('p', lang === 'ru' ? 'В миноре используйте аккорды выбранной гаммы, указанные выше.' : 'In minor, use the selected scale’s chords shown above.', 'textbook-help'));
      music.append(button(musicDone ? '✓ ' + s.musicDone : s.musicDone, () => { musicDone = true; render(); })); root.append(music);
    }
    root.append(element('p', s.session(checked), 'textbook-help'), element('p', s.saved, 'textbook-help'), element('p', s.shortcuts, 'textbook-help'));
    if (warning) { const notice = element('p', s.warning); notice.setAttribute('role', 'status'); root.append(notice); }
    if (focus) {
      const target = revealed ? root.querySelector('.recall-ratings button') : root.querySelector('#recall-answer') ?? root.querySelector('.recall-task h4');
      target.tabIndex = target.tagName === 'H4' ? -1 : 0; target.focus();
    }
  }
  root.addEventListener('keydown', event => {
    if (event.target.closest('input, select, textarea, summary') || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    if (revealed && ['1', '2', '3'].includes(event.key)) { event.preventDefault(); rate({ 1: 'again', 2: 'hard', 3: 'good' }[event.key]); }
  });
  setInterval(() => { if (!root.hidden && !card && !root.contains(document.activeElement)) render(); }, 15000);
  return { render };
}
