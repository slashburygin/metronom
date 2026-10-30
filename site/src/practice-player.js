import { normalizeArrangement } from './arrangement-ornaments.js';
import { normalizeSound } from './backing-sound.js';
import { createSoundControls } from './sound-controls.js';
import { BACKING_STYLES, STYLE_NAMES, normalizeSeed } from './arrangement.js';
import { seedControl, createArrangementControls } from './arrangement-controls.js';
import { buildAccompaniment, PARTS } from './accompaniment.js';
import { BackingPlayer } from './backing-player.js';
import { clampBpm } from './tempo.js';
import { normalizeTraining, trainingState, displaySong } from './training.js';
import { createTrainingControls, readTraining, trainingLabel } from './training-controls.js';

const COPY = {
  ru: { title: 'Аккомпанемент', form: 'Упражнение', forms: ['ii–V–I · 4 такта', 'Мажорный блюз · 12 тактов', 'Минорный блюз · 12 тактов'],
    style: 'Ритм', repeats: 'Круги', forever: 'До остановки', countIn: 'Отсчёт · 1 такт', play: 'Играть аккомпанемент', stop: 'Остановить аккомпанемент', cancel: 'Отменить запуск',
    parts: ['Бас', 'Клавиши', 'Ударные'], mute: 'Отключить', volume: 'Громкость', ready: 'Выберите темп и начните играть.', counting: 'Отсчёт', pass: 'Круг', bar: 'Такт', beat: 'Доля', error: 'Не удалось включить звук. Попробуйте запустить ещё раз.',
    help: 'Аккорды звучат в выбранной тональности, сетка показывает партию выбранного инструмента. Мажорный блюз: I7–IV7–V7; минорный: i7–iv7–V7.' },
  en: { title: 'Backing band', form: 'Exercise', forms: ['ii–V–I · 4 bars', 'Major blues · 12 bars', 'Minor blues · 12 bars'],
    style: 'Feel', repeats: 'Choruses', forever: 'Until stopped', countIn: 'Count-in · 1 bar', play: 'Play backing band', stop: 'Stop backing band', cancel: 'Cancel start',
    parts: ['Bass', 'Keys', 'Drums'], mute: 'Mute', volume: 'Volume', ready: 'Choose a tempo and start playing.', counting: 'Count-in', pass: 'Chorus', bar: 'Bar', beat: 'Beat', error: 'Could not start audio. Try starting again.',
    help: 'Chords sound in the selected key; the chart shows the selected instrument’s part. Major blues: I7–IV7–V7; minor blues: i7–iv7–V7.' },
};
const FORMS = ['cadence', 'majorBlues', 'minorBlues'];
const STYLES = BACKING_STYLES;
const REPEATS = [1, 2, 4, 8, 12, 24, 0];

export function createPracticePlayer({ getLang, getContext, getBpm, onTempo }) {
  let training = normalizeTraining();
  try { training = readTraining(localStorage, 'metronome-backing-training'); } catch {}
  const element = document.createElement('section');
  element.className = 'backing-player';
  let harmony, compiled, engine, lastPosition, failed = false, run = 0;
  const settings = { form: 'cadence', style: 'swing', seed: 1, repeats: 4, countIn: true, sound: normalizeSound(), arrangement: normalizeArrangement(),
    mix: Object.fromEntries(PARTS.map(part => [part, { volume: part === 'drums' ? 0.55 : 0.75, muted: false }])) };
  try {
    const saved = JSON.parse(localStorage.getItem('metronome-backing'));
    if (FORMS.includes(saved?.form)) settings.form = saved.form;
    if (STYLES.includes(saved?.style)) settings.style = saved.style;
    settings.seed = normalizeSeed(saved?.seed);
    settings.sound = normalizeSound(saved?.sound);
    settings.arrangement = normalizeArrangement(saved?.arrangement);
    if (REPEATS.includes(saved?.repeats)) settings.repeats = saved.repeats;
    if (typeof saved?.countIn === 'boolean') settings.countIn = saved.countIn;
    for (const part of PARTS) {
      const value = saved?.mix?.[part];
      if (Number.isFinite(value?.volume) && value.volume >= 0 && value.volume <= 1 && typeof value.muted === 'boolean') settings.mix[part] = value;
    }
  } catch { /* Defaults if local storage is unavailable. */ }
  const save = () => { try { localStorage.setItem('metronome-backing', JSON.stringify(settings)); } catch {} };
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const busy = () => Boolean(engine?.transport.playing || engine?.transport.pending);
  let play, status, grid, bpmInput, keyStatus;

  function update() {
    if (!play) return;
    const s = COPY[getLang()];
    play.textContent = engine?.transport.pending ? s.cancel : engine?.transport.playing ? s.stop : s.play;
    play.setAttribute('aria-pressed', String(busy()));
    status.textContent = failed ? s.error : !lastPosition ? s.ready : lastPosition.countIn
      ? `${s.counting} · ${lastPosition.step.beatIndex + 1} / 4`
      : `${s.pass} ${lastPosition.step.pass}${settings.repeats ? ` / ${settings.repeats}` : ''} · ${s.bar} ${lastPosition.step.barIndex + 1} / ${compiled.symbols.length} · ${s.beat} ${lastPosition.step.beatIndex + 1} / 4`;
    const state = lastPosition?.step.training ?? trainingState(compiled.song.key, 1, getBpm(), training);
    const label = trainingLabel(state, getLang());
    if (keyStatus && keyStatus.textContent !== label) keyStatus.textContent = label;
    const written = displaySong(compiled.song, state).sections.flatMap(section => section.measures);
    [...grid.children].forEach((bar, index) => {
      const symbol = written[index].chords.map(chord => chord.symbol).join(' · ') || '—';
      const span = bar.querySelector('.backing-symbol');
      if (span.textContent !== symbol) span.textContent = symbol;
      const active = Boolean(lastPosition && !lastPosition.countIn && index === lastPosition.step.barIndex);
      bar.classList.toggle('active', active);
      if (active) bar.setAttribute('aria-current', 'true'); else bar.removeAttribute('aria-current');
    });
  }

  function stop() {
    ++run;
    engine?.stop();
    lastPosition = null;
    update();
  }

  function render() {
    if (!harmony) return;
    const s = COPY[getLang()];
    compiled = buildAccompaniment(harmony, settings);
    element.replaceChildren();
    element.setAttribute('aria-label', s.title);
    element.append(node('h3', s.title));
    const controls = node('div', '', 'backing-controls');
    function selectField(label, id, values, labels, value, change) {
      const wrapper = node('label', label);
      const select = node('select'); select.id = id;
      values.forEach((option, i) => {
        const el = node('option', labels[i]); el.value = option; el.selected = value === option; select.append(el);
      });
      select.addEventListener('change', () => { stop(); change(select.value); save(); render(); element.querySelector(`#${id}`).focus(); });
      wrapper.append(select); controls.append(wrapper);
    }
    selectField(s.form, 'backing-form', FORMS, [harmony.progressionLabel + ' · ' + (getLang() === 'ru' ? '4 такта' : '4 bars'), ...s.forms.slice(1)], settings.form, value => { settings.form = value; });
    selectField(s.style, 'backing-style', STYLES, STYLE_NAMES[getLang()], settings.style, value => { settings.style = value; });
    controls.append(seedControl({ prefix: 'backing', lang: getLang(), seed: settings.seed, onChange(value) { stop(); settings.seed = value; save(); render(); element.querySelector('#backing-seed').focus(); } }));
    const bpmLabel = node('label', 'BPM');
    bpmInput = node('input'); bpmInput.type = 'number'; bpmInput.id = 'backing-bpm'; bpmInput.min = 30; bpmInput.max = 300; bpmInput.step = 1; bpmInput.value = getBpm();
    bpmInput.addEventListener('change', () => { const bpm = clampBpm(bpmInput.value); bpmInput.value = bpm; engine?.transport.setBpm(bpm); onTempo(bpm); });
    bpmLabel.append(bpmInput); controls.append(bpmLabel);
    selectField(s.repeats, 'backing-repeats', REPEATS, ['1', '2', '4', '8', '12', '24', s.forever], settings.repeats, value => { settings.repeats = Number(value); });
    const countLabel = node('label', '', 'check backing-count-in');
    const count = node('input'); count.type = 'checkbox'; count.id = 'backing-count-in'; count.checked = settings.countIn;
    count.addEventListener('change', () => { stop(); settings.countIn = count.checked; save(); });
    countLabel.append(count, node('span', s.countIn));
    grid = node('ol', '', 'backing-chart'); grid.setAttribute('aria-label', s.form);
    compiled.symbols.forEach((symbol, index) => {
      const bar = node('li'); bar.append(node('span', String(index + 1), 'backing-bar-number'), node('span', symbol, 'backing-symbol')); grid.append(bar);
    });
    play = node('button', s.play, 'btn btn--primary'); play.id = 'backing-play'; play.type = 'button';
    play.addEventListener('click', async () => {
      if (busy()) { stop(); return; }
      const generation = ++run;
      failed = false;
      try {
        const context = getContext();
        engine ??= new BackingPlayer({ context, onStep: position => { lastPosition = position; update(); }, onStop: () => { lastPosition = null; update(); } });
        for (const part of PARTS) engine.setPart(part, settings.mix[part].volume, settings.mix[part].muted);
        const pending = engine.start(compiled, { ...settings, bpm: getBpm(), training });
        update();
        await pending;
      } catch {
        if (generation === run) { engine?.stop(); failed = true; }
      }
      if (generation === run) update();
    });
    status = node('p', '', 'backing-status'); status.id = 'backing-status'; status.setAttribute('role', 'status');
    const mixer = node('fieldset', '', 'backing-mixer');
    mixer.append(node('legend', getLang() === 'ru' ? 'Микшер' : 'Mixer'));
    PARTS.forEach((part, index) => {
      const channel = node('div', '', 'backing-channel');
      const label = node('label', s.parts[index]);
      const volume = node('input'); volume.type = 'range'; volume.min = 0; volume.max = 1; volume.step = 0.05; volume.value = settings.mix[part].volume; volume.id = `backing-${part}-volume`;
      volume.setAttribute('aria-label', `${s.volume} · ${s.parts[index]}`);
      const muteLabel = node('label', '', 'check');
      const mute = node('input'); mute.type = 'checkbox'; mute.checked = settings.mix[part].muted; mute.id = `backing-${part}-mute`;
      mute.setAttribute('aria-label', `${s.mute} · ${s.parts[index]}`);
      const applyMix = () => { settings.mix[part] = { volume: Number(volume.value), muted: mute.checked }; engine?.setPart(part, Number(volume.value), mute.checked); save(); };
      volume.addEventListener('input', applyMix); mute.addEventListener('change', applyMix);
      label.append(volume); muteLabel.append(mute, node('span', s.mute)); channel.append(label, muteLabel); mixer.append(channel);
    });
    const trainingControls = createTrainingControls({ prefix: 'backing-training', getLang, settings: training, sourceKey: compiled.song.key, bpm: getBpm(),
      onChange(name, value) {
        stop(); training = normalizeTraining({ ...training, [name]: value });
        try { localStorage.setItem('metronome-backing-training', JSON.stringify(training)); } catch {}
        render(); element.querySelector(`#backing-training-${name}`)?.focus();
      },
    });
    const soundControls = createSoundControls({ prefix: 'backing', lang: getLang(), sound: settings.sound,
      onChange(value) { stop(); settings.sound = value; save(); },
    });
    const arrangementControls = createArrangementControls({ prefix: 'backing', lang: getLang(), arrangement: settings.arrangement,
      onChange(value, name) { stop(); settings.arrangement = value; save(); render(); element.querySelector(`#backing-${name}`).focus(); },
    });
    keyStatus = node('p', '', 'backing-key-status'); keyStatus.id = 'backing-key-status'; keyStatus.setAttribute('role', 'status');
    element.append(controls, countLabel, trainingControls, keyStatus, grid, play, status, mixer, soundControls, arrangementControls, node('p', s.help, 'textbook-help'));
    update();
  }

  return { element, stop, render,
    setBpm(value) { if (bpmInput) bpmInput.value = value; engine?.transport.setBpm(value); },
    setHarmony(value) {
      if (harmony && (value.notes[0] !== harmony.notes[0] || value.type !== harmony.type)) stop();
      harmony = value;
      render();
    },
  };
}
