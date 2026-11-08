import { scaleHarmony, MAJOR_KEYS } from './harmony.js';
import { INSTRUMENTS, transposeNote, transposeChord, keyAt, parseKey } from './transposition.js';
import { pitchClass, midiFrequency } from './pitch.js';
import { playbackOutput } from './audio-output.js';

export const JAZZ_STAGES = ['tone', 'ear', 'guides', 'phrase', 'review'];
export function jazzMaterial(key, instrument = 'C') {
  if (!Object.hasOwn(INSTRUMENTS, instrument)) throw new RangeError('Unknown instrument');
  const harmony = scaleHarmony(key), shift = INSTRUMENTS[instrument];
  const writtenKey = keyAt(parseKey(key).pitch + shift);
  const written = note => transposeNote(note, shift, key, writtenKey);
  return { key, writtenKey, harmony, symbols: harmony.progression.map(chord => transposeChord(chord.symbol, shift, key, writtenKey)), lines: harmony.guideTones.map(line => line.map(written)), notes: harmony.notes.map(written) };
}

export function createPracticeDrone(getContext) {
  let generation = 0, voice = null, pending = false;
  function stop() {
    generation++; pending = false;
    if (!voice) return;
    const { oscillator, gain, context } = voice; voice = null;
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(0, context.currentTime, 0.015);
    oscillator.stop(context.currentTime + 0.08);
  }
  return {
    get active() { return voice !== null || pending; },
    async start(note) {
      const frequency = midiFrequency(48 + pitchClass(note));
      stop(); const token = generation; pending = true;
      try {
        const context = getContext(); await context.resume();
        if (token !== generation) return;
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, context.currentTime); gain.gain.linearRampToValueAtTime(0.08, context.currentTime + 0.05);
        oscillator.connect(gain); gain.connect(playbackOutput(context));
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        voice = { oscillator, gain, context }; pending = false; oscillator.start();
      } catch (error) { if (token === generation) pending = false; throw error; }
    },
    stop,
  };
}
const COPY = {
  ru: {
    title: 'Джаз и саксофон · занятие на 20 минут', key: 'Тональность звучания', instrument: 'Инструмент',
    instruments: ['Концертный C', 'Тенор / сопрано B♭', 'Альт / баритон E♭'],
    steps: ['Звук · 3 мин', 'Слух · 4 мин', 'Опорные ноты · 4 мин', 'Фраза · 5 мин', 'Запись и разбор · 4 мин'],
    tasks: [
      'Включите опорный тон. Спойте его, затем сыграйте протяжную ноту в удобном регистре. Сначала слушайте совпадение высоты, затем проверьте тюнером. Чередуйте ноту и отдых; сохраняйте свободный звук.',
      'Выберите короткую фразу из знакомой записи. Прослушайте, спойте без инструмента, затем подберите на слух. Начните с 2–4 нот; после освоения перенесите фразу в другую тональность.',
      'Спойте, затем сыграйте линию терций и септим на ii–V–I. На ii и V — по такту, на I — два. Сначала длинные ноты, затем соедините их короткой фразой. Клик на 2 и 4 помогает услышать свинг.',
      'Постройте фразу на ii–V–I только из аккордовых звуков. Повторите её с другим ритмом и паузами. Затем добавьте одну проходящую ноту. На смене аккорда приходите в терцию или септиму.',
      'Откройте запись и сыграйте один короткий дубль. Прослушайте отдельно пульс, строй и связность фраз. Выберите одну конкретную ошибку и повторите только этот фрагмент. Завтра начните с проверки по памяти.',
    ],
    criteria: ['Ровный свободный звук и устойчивое совпадение с опорным тоном.', 'Можете спеть и сыграть фразу без подсказки записи.', 'Можете услышать смену аккордов и сыграть обе линии без остановок.', 'Фраза разрешается в аккордовый звук, ритм устойчив, есть паузы.', 'Назвали одну конкретную задачу на следующее занятие.'],
    criterion: 'Проверка', drone: 'Опорный тон', stop: 'Остановить опорный тон', apply: 'Клик на 2 и 4 · 60 BPM',
    configured: 'Метроном настроен. Нажмите «Старт» в метрономе.', scales: 'Открыть гаммы и аккомпанемент',
    done: 'Шаг выполнен', previous: 'Назад', next: 'Следующий шаг', finish: 'Повторить занятие',
    concert: 'Звучит', written: 'Ваша партия', hint: 'Тональность выбирается по звучанию. Для B♭/E♭ показаны ноты партии; октаву выбирайте в удобном диапазоне инструмента. Выполнение отмечается самостоятельно.',
    links: 'Материалы для продолжения', error: 'Не удалось включить звук. Попробуйте ещё раз.', warning: 'Прогресс не сохранился; после перезагрузки отметки могут потеряться.',
    recording: 'Запись находится в основном окне приложения. Для аккомпанемента откройте «Гаммы и аккорды» → ii–V–I.',
  },
  en: {
    title: 'Jazz and saxophone · 20-minute session', key: 'Concert key', instrument: 'Instrument',
    instruments: ['Concert C', 'Tenor / soprano B♭', 'Alto / baritone E♭'],
    steps: ['Tone · 3 min', 'Ear · 4 min', 'Guide tones · 4 min', 'Phrase · 5 min', 'Record and review · 4 min'],
    tasks: [
      'Start the reference drone. Sing it, then sustain a note in a comfortable register. Match pitch by ear first, then check the tuner. Alternate playing and rest; keep your sound free.',
      'Choose a short phrase from a familiar recording. Listen, sing without the instrument, then find the notes by ear. Start with 2–4 notes; once learned, move the phrase to another key.',
      'Sing, then play the third-and-seventh lines over ii–V–I. One bar each on ii and V, two on I. Start with long notes, then connect them in a phrase. A click on 2 and 4 supports swing practice.',
      'Build a phrase over ii–V–I using only chord tones. Repeat it with different rhythms and rests. Then add one passing note. Target a third or seventh at each chord change.',
      'Record one short take. Listen separately for pulse, intonation and phrasing. Identify one specific problem and repeat only that fragment. Tomorrow, start by testing it from memory.',
    ],
    criteria: ['A steady, free tone matching the reference pitch.', 'You can sing and play the phrase without the recording.', 'You hear the chord changes and play both lines without stopping.', 'Your phrase resolves to a chord tone, stays in time and uses rests.', 'You have identified one specific goal for your next session.'],
    criterion: 'Check', drone: 'Reference drone', stop: 'Stop drone', apply: 'Click on 2 and 4 · 60 BPM',
    configured: 'Metronome configured. Press Start on the metronome.', scales: 'Open scales and accompaniment',
    done: 'Step complete', previous: 'Back', next: 'Next step', finish: 'Repeat session',
    concert: 'Concert', written: 'Written part', hint: 'Choose the concert key. B♭/E♭ instruments see written notes; choose a comfortable octave for your instrument. Completion is self-assessed.',
    links: 'Further learning', error: 'Audio could not start. Try again.', warning: 'Progress could not be saved; checkmarks may be lost after reloading.',
    recording: 'Recording is in the main application window. For accompaniment, open Scales & chords → ii–V–I.',
  },
};
const node = (tag, text = '', className = '') => { const result = document.createElement(tag); result.textContent = text; result.className = className; return result; };
export function initJazzPractice(getLang, playback, openScales) {
  const root = document.getElementById('jazz-practice'), drone = createPracticeDrone(playback.getContext);
  let key = 'C', instrument = 'C', step = 0, completed = {}, warning = false;
  try {
    const saved = JSON.parse(localStorage.getItem('metronom-jazz-v1'));
    if (MAJOR_KEYS.includes(saved?.key)) key = saved.key;
    if (['C', 'Bb', 'Eb'].includes(saved?.instrument)) instrument = saved.instrument;
    if (saved?.completed && typeof saved.completed === 'object') completed = saved.completed;
  } catch {}
  const stop = () => { const active = drone.active; drone.stop(); if (active) render(); };
  const save = () => { try { localStorage.setItem('metronom-jazz-v1', JSON.stringify({ key, instrument, completed })); warning = false; } catch { warning = true; } };
  function render(focus = false) {
    const lang = getLang(), s = COPY[lang], material = jazzMaterial(key, instrument);
    root.replaceChildren(node('h3', s.title));
    const toolbar = node('div', '', 'song-fields');
    function select(label, values, labels, value, change) {
      const field = node('label', label), input = node('select');
      values.forEach((value, i) => { const option = node('option', labels[i]); option.value = value; input.append(option); }); input.value = value;
      input.addEventListener('change', () => { stop(); change(input.value); save(); render(true); }); field.append(input); toolbar.append(field);
    }
    select(s.key, MAJOR_KEYS, MAJOR_KEYS, key, value => { key = value; });
    select(s.instrument, ['C', 'Bb', 'Eb'], s.instruments, instrument, value => { instrument = value; });
    root.append(toolbar, node('p', `${s.concert}: ${key} · ${s.written}: ${material.writtenKey}`, 'scale-notes'), node('p', s.hint, 'textbook-help'));
    const controls = node('div', '', 'song-toolbar');
    function button(text, action) { const result = node('button', text, 'btn btn--secondary'); result.type = 'button'; result.addEventListener('click', action); return result; }
    s.steps.forEach((text, index) => { const buttonNode = button(text, () => { stop(); step = index; render(true); }); buttonNode.setAttribute('aria-pressed', step === index); controls.append(buttonNode); }); root.append(controls);
    const heading = node('h4', s.steps[step]); heading.tabIndex = -1; root.append(heading, node('p', s.tasks[step]));
    const status = node('p'); status.setAttribute('role', 'status');
    if (step === 0) {
      const toggle = button(drone.active ? s.stop : `${s.drone} · ${key}`, async () => {
        if (drone.active) { stop(); render(true); return; }
        try { const start = drone.start(key); render(); await start; render(); } catch { status.textContent = s.error; root.append(status); }
      }); root.append(toggle);
    }
    if (step === 2 || step === 3) {
      root.append(node('p', [...material.symbols, material.symbols.at(-1)].join(' → '), 'scale-notes'));
      material.lines.forEach(line => root.append(node('p', line.join(' → ') + ' → ' + line.at(-1), 'scale-notes')));
      root.append(button(s.apply, () => { playback.configureMetronome({ bpm: 60, beatsPerBar: 4, noteValue: 4, subdivision: 'quarter', accents: ['mute', 'normal', 'mute', 'normal'], gap: { enabled: false } }); status.textContent = s.configured; root.append(status); }));
      root.append(button(s.scales, () => { stop(); openScales(); }));
    }
    if (step === 4) root.append(node('p', s.recording, 'textbook-help'));
    root.append(node('p', `${s.criterion}: ${s.criteria[step]}`, 'textbook-help'));
    const progressKey = `${key}:${instrument}:${step}`, checkLabel = node('label', '', 'check'), check = node('input'); check.type = 'checkbox'; check.checked = completed[progressKey] === true;
    check.addEventListener('change', () => { completed[progressKey] = check.checked; save(); render(); }); checkLabel.append(check, node('span', s.done)); root.append(checkLabel);
    const navigation = node('div', '', 'song-toolbar');
    const back = button(s.previous, () => { stop(); step--; render(true); }); back.disabled = step === 0;
    const next = button(step === 4 ? s.finish : s.next, () => { stop(); step = (step + 1) % JAZZ_STAGES.length; render(true); }); navigation.append(back, next); root.append(navigation);
    const links = node('details'); links.append(node('summary', s.links));
    for (const [title, url] of [['BetterSax · tone', 'https://bettersax.com/its-hard-but-gets-you-a-beautiful-sax-sound-in-30-days/'], ['Jazzadvice · ear and guide tones', 'https://www.jazzadvice.com/lessons/the-path-to-playing-what-youre-hearing/'], ['Learn Jazz Standards · routine', 'https://www.learnjazzstandards.com/blog/learning-jazz/jazz-advice/7-day-jazz-practice-routine/']]) { const paragraph = node('p'), link = node('a', title); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; paragraph.append(link); links.append(paragraph); }
    root.append(links);
    if (warning) { const notice = node('p', s.warning); notice.setAttribute('role', 'status'); root.append(notice); }
    if (focus) heading.focus();
  }
  return { render, stop };
}
