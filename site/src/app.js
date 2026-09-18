import { Metronome } from './metronome.js';
import { STRINGS, detectLang } from './i18n.js';
import {
  DEFAULTS, DENOMINATORS, MAX_BEATS, MAX_BPM, MIN_BPM, PITCHES, SOUNDS, SUBDIVISIONS,
  TapTempo, nextAccent, resizeAccents, tempoMarking,
} from './tempo.js';

const STORAGE_KEY = 'metronome-settings';
const THEME_KEY = 'metronome-theme';
const PENDULUM_MAX_DEG = 28;
const $ = (id) => document.getElementById(id);

const els = {
  bpm: $('bpm'),
  marking: $('marking'),
  signature: $('signature'),
  slider: $('bpm-slider'),
  up: $('bpm-up'),
  down: $('bpm-down'),
  beats: $('beats'),
  play: $('play'),
  tap: $('tap'),
  reset: $('reset'),
  beatsPerBar: $('beats-per-bar'),
  noteValue: $('note-value'),
  subdivision: $('subdivision'),
  sound: $('sound'),
  pitch: $('pitch'),
  volume: $('volume'),
  lang: $('lang'),
  theme: $('theme'),
  display: $('display'),
  pendulumArm: $('pendulum-arm'),
  pendulumWeight: $('pendulum-weight'),
};

// UI-only state; audio state lives on the metronome instance.
const ui = { lang: detectLang(), view: 'digital', noteValue: DEFAULTS.noteValue };

let activeDot = null;
const metronome = new Metronome({
  onTick(beat, sub) {
    if (sub !== 0) return;
    activeDot?.classList.remove('active');
    activeDot = els.beats.children[beat];
    activeDot?.classList.add('active');
  },
});
const tapper = new TapTempo();
const t = () => STRINGS[ui.lang];

// --- persistence ---

function save() {
  const { bpm, beatsPerBar, subdivision, accents, sound, pitch, volume } = metronome;
  const data = { bpm, beatsPerBar, subdivision, accents, sound, pitch, volume, ...ui };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* not persisted */ }
}

function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return; }
  if (!s) return;
  apply(s);
}

// Applies a settings object, ignoring anything invalid.
function apply(s) {
  if (s.bpm) metronome.setBpm(s.bpm);
  if (Number.isInteger(s.beatsPerBar) && s.beatsPerBar >= 1 && s.beatsPerBar <= MAX_BEATS) {
    metronome.setBeatsPerBar(s.beatsPerBar);
  }
  if (Array.isArray(s.accents)) {
    s.accents.slice(0, metronome.beatsPerBar).forEach((a, i) => {
      if (['accent', 'normal', 'mute'].includes(a)) metronome.accents[i] = a;
    });
  }
  if (s.subdivision in SUBDIVISIONS) metronome.subdivision = s.subdivision;
  if (SOUNDS.includes(s.sound)) metronome.sound = s.sound;
  if (s.pitch in PITCHES) metronome.pitch = s.pitch;
  if (typeof s.volume === 'number') metronome.setVolume(s.volume);
  if (DENOMINATORS.includes(s.noteValue)) ui.noteValue = s.noteValue;
  if (s.lang in STRINGS) ui.lang = s.lang;
  if (s.view === 'digital' || s.view === 'pendulum') ui.view = s.view;
}

function reset() {
  metronome.accents = resizeAccents([], DEFAULTS.beatsPerBar);
  apply({ ...DEFAULTS, lang: ui.lang, view: ui.view });
  tapper.taps = [];
  save();
  renderAll();
}

// --- rendering ---

function fillSelect(select, entries) {
  const value = select.value;
  select.replaceChildren(...entries.map(([v, label]) => new Option(label, v)));
  if (value) select.value = value;
}

function renderText() {
  const s = t();
  document.documentElement.lang = ui.lang;
  document.title = s.title;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = s[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', s[el.dataset.i18nAria]);
  });
  fillSelect(els.subdivision, Object.keys(SUBDIVISIONS).map((k) => [k, s.subdivisions[k]]));
  fillSelect(els.sound, SOUNDS.map((k) => [k, s.sounds[k]]));
  fillSelect(els.pitch, Object.keys(PITCHES).map((k) => [k, s.pitches[k]]));
  for (const b of els.lang.children) b.setAttribute('aria-pressed', b.dataset.lang === ui.lang);
  renderPlay();
  renderBeats();
}

function renderTempo() {
  els.bpm.value = metronome.bpm;
  els.slider.value = metronome.bpm;
  els.marking.textContent = tempoMarking(metronome.bpm);
  // Like a real metronome: the weight slides up the rod for slower tempos.
  const f = (metronome.bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
  els.pendulumWeight.setAttribute('y', 30 + f * 130);
}

function renderSignature() {
  els.signature.textContent = `${metronome.beatsPerBar}/${ui.noteValue}`;
}

function beatTitle(i, level) {
  return `${t().beat} ${i + 1}: ${t().accents[level]}`;
}

function renderBeats() {
  els.beats.replaceChildren(...metronome.accents.map((level, i) => {
    const dot = document.createElement('button');
    dot.className = `beat ${level}`;
    dot.textContent = i + 1;
    dot.title = beatTitle(i, level);
    dot.addEventListener('click', () => {
      const next = nextAccent(metronome.accents[i]);
      metronome.accents[i] = next;
      dot.className = `beat ${next}${dot === activeDot ? ' active' : ''}`;
      dot.title = beatTitle(i, next);
      save();
    });
    return dot;
  }));
  activeDot = null;
}

function renderPlay() {
  els.play.textContent = metronome.playing ? t().stop : t().start;
  els.play.classList.toggle('playing', metronome.playing);
  if (!metronome.playing) {
    activeDot?.classList.remove('active');
    activeDot = null;
    els.pendulumArm.removeAttribute('transform');
  }
}

function renderView() {
  document.body.classList.toggle('view-pendulum', ui.view === 'pendulum');
  for (const b of els.display.children) b.setAttribute('aria-pressed', b.dataset.view === ui.view);
}

function renderTheme() {
  const dark = document.documentElement.classList.contains('dark');
  els.theme.setAttribute('aria-pressed', dark);
}

function renderAll() {
  els.beatsPerBar.value = metronome.beatsPerBar;
  els.noteValue.value = ui.noteValue;
  els.volume.value = metronome.volume;
  renderText();
  els.subdivision.value = metronome.subdivision;
  els.sound.value = metronome.sound;
  els.pitch.value = metronome.pitch;
  renderTempo();
  renderSignature();
  renderView();
  renderTheme();
}

// Pendulum is at an extreme on every click and swings through the centre
// between clicks, alternating sides each beat.
function animatePendulum() {
  requestAnimationFrame(animatePendulum);
  if (ui.view !== 'pendulum' || !metronome.playing) return;
  const pos = metronome.position();
  if (pos === null) return;
  const angle = -PENDULUM_MAX_DEG * Math.cos(Math.PI * pos);
  els.pendulumArm.setAttribute('transform', `rotate(${angle.toFixed(2)} 100 196)`);
}

// --- actions ---

function setBpm(value) {
  metronome.setBpm(value);
  renderTempo();
  save();
}

async function togglePlay() {
  await metronome.toggle();
  renderPlay();
}

function tap() {
  const bpm = tapper.tap(performance.now());
  if (bpm) setBpm(bpm);
}

// --- wiring ---

for (let n = 1; n <= MAX_BEATS; n++) els.beatsPerBar.add(new Option(n, n));
for (const d of DENOMINATORS) els.noteValue.add(new Option(d, d));

load();
renderAll();
requestAnimationFrame(animatePendulum);

els.slider.addEventListener('input', () => setBpm(els.slider.value));
els.bpm.addEventListener('change', () => setBpm(els.bpm.value));
els.up.addEventListener('click', (e) => setBpm(metronome.bpm + (e.shiftKey ? 5 : 1)));
els.down.addEventListener('click', (e) => setBpm(metronome.bpm - (e.shiftKey ? 5 : 1)));
els.play.addEventListener('click', togglePlay);
els.tap.addEventListener('click', tap);
els.reset.addEventListener('click', reset);

els.beatsPerBar.addEventListener('change', () => {
  metronome.setBeatsPerBar(Number(els.beatsPerBar.value));
  renderBeats();
  renderSignature();
  save();
});
els.noteValue.addEventListener('change', () => {
  ui.noteValue = Number(els.noteValue.value);
  renderSignature();
  save();
});
els.subdivision.addEventListener('change', () => { metronome.subdivision = els.subdivision.value; save(); });
els.sound.addEventListener('change', () => { metronome.sound = els.sound.value; save(); });
els.pitch.addEventListener('change', () => { metronome.pitch = els.pitch.value; save(); });
els.volume.addEventListener('input', () => { metronome.setVolume(Number(els.volume.value)); save(); });

els.lang.addEventListener('click', (e) => {
  const lang = e.target.closest('[data-lang]')?.dataset.lang;
  if (!lang) return;
  ui.lang = lang;
  renderText();
  save();
});

els.display.addEventListener('click', (e) => {
  const view = e.target.closest('[data-view]')?.dataset.view;
  if (!view) return;
  ui.view = view;
  if (view === 'digital') els.pendulumArm.removeAttribute('transform');
  renderView();
  save();
});

els.theme.addEventListener('click', () => {
  const dark = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* not persisted */ }
  renderTheme();
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  const step = e.shiftKey ? 5 : 1;
  switch (e.key) {
    case ' ':
      e.preventDefault(); // also stops Space from "clicking" a focused button
      togglePlay();
      break;
    case 'ArrowUp':
      e.preventDefault();
      setBpm(metronome.bpm + step);
      break;
    case 'ArrowDown':
      e.preventDefault();
      setBpm(metronome.bpm - step);
      break;
    case 't':
    case 'T':
    case 'е': // T key on a Russian layout
    case 'Е':
      tap();
      break;
  }
});
