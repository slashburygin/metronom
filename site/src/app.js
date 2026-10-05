import { Tuner } from './tuner.js';
import { Metronome } from './metronome.js';
import { STRINGS, detectLang } from './i18n.js';
import { rhythmSvg } from './notation.js';
import { createSelect } from './select.js';
import {
  DEFAULTS, DENOMINATORS, MAX_BEATS, MAX_BPM, MIN_BPM, PITCHES, SOUNDS, SUBDIVISIONS,
  TIMER_MINUTES, TapTempo, formatClock, nextAccent, resizeAccents, tempoMarking,
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
  stressFirst: $('stress-first'),
  play: $('play'),
  tap: $('tap'),
  reset: $('reset'),
  subdivision: $('subdivision'),
  remaining: $('remaining'),
  volume: $('volume'),
  lang: $('lang'),
  theme: $('theme'),
  fullscreen: $('fullscreen'),
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
  // The practice timer ended the run
  onStop() {
    renderPlay();
  },
});
const tapper = new TapTempo();
const t = () => STRINGS[ui.lang];
const tuner = new Tuner(renderTuner);

function renderTuner() {
  const strings = t();
  const { state, note } = tuner;
  $('tuner-toggle').textContent = state === 'requesting' ? strings.tunerRequesting
    : state === 'listening' ? strings.tunerStop : strings.tunerStart;
  $('tuner-toggle').setAttribute('aria-pressed', state === 'listening');
  const russianName = note && strings.tunerNotes
    ? `${strings.tunerNotes[note.name[0]]}${note.name.slice(1)}` : null;
  $('tuner-note').textContent = note
    ? `${note.name}${note.octave}${russianName ? `/${russianName}${note.octave}` : ''}` : '—';
  $('tuner-note').classList.toggle('localized', Boolean(russianName));
  $('tuner-reading').textContent = note
    ? `${note.frequency.toFixed(1)} Hz · ${note.cents > 0 ? '+' : ''}${Math.round(note.cents)} ${strings.tunerCents}` : '—';
  const inTune = note && Math.abs(note.cents) <= 5;
  $('tuner-note').classList.toggle('in-tune', Boolean(inTune));
  $('tuner-needle').hidden = !note;
  if (note) $('tuner-needle').style.left = `${50 + Math.max(-50, Math.min(50, note.cents))}%`;
  const statuses = { idle: 'tunerIdle', requesting: 'tunerPermission', listening: 'tunerListening',
    denied: 'tunerDenied', unavailable: 'tunerUnavailable', unsupported: 'tunerUnsupported' };
  const message = note ? strings[inTune ? 'tunerInTune' : note.cents < 0 ? 'tunerFlat' : 'tunerSharp']
    : strings[statuses[state]];
  if ($('tuner-status').textContent !== message) $('tuner-status').textContent = message;
}


const selects = {
  beatsPerBar: createSelect($('beats-per-bar'), {
    onChange(value) {
      metronome.setBeatsPerBar(Number(value));
      renderBeats();
      renderSignature();
      save();
    },
  }),
  noteValue: createSelect($('note-value'), {
    onChange(value) {
      ui.noteValue = Number(value);
      renderSignature();
      save();
    },
  }),
  sound: createSelect($('sound'), {
    onChange(value) { metronome.sound = value; save(); },
  }),
  pitch: createSelect($('pitch'), {
    onChange(value) { metronome.pitch = value; save(); },
  }),
  timer: createSelect($('timer'), {
    onChange(value) {
      metronome.timerMinutes = Number(value);
      // A timer set mid-run counts from that run's first click, so it may
      // already be over; the engine's own frame notices and stops.
      renderRemaining();
      save();
    },
  }),
};

// --- persistence ---

function save() {
  const { bpm, beatsPerBar, subdivision, accents, sound, pitch, volume, timerMinutes } = metronome;
  const data = { bpm, beatsPerBar, subdivision, accents, sound, pitch, volume, timerMinutes, ...ui };
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
  if (TIMER_MINUTES.includes(s.timerMinutes)) metronome.timerMinutes = s.timerMinutes;
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

function renderText() {
  const s = t();
  document.documentElement.lang = ui.lang;
  document.title = s.title;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = s[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', s[el.dataset.i18nAria]);
  });
  selects.sound.setOptions(SOUNDS.map((k) => [k, s.sounds[k]]));
  selects.pitch.setOptions(Object.keys(PITCHES).map((k) => [k, s.pitches[k]]));
  selects.timer.setOptions(
    TIMER_MINUTES.map((m) => [m, m === 0 ? s.timerOff : `${m} ${s.minutesShort}`]),
  );
  for (const [name, select] of Object.entries(selects)) select.setLabel(labelFor(name));
  for (const b of els.lang.children) b.setAttribute('aria-pressed', b.dataset.lang === ui.lang);
  renderPlay();
  renderTuner();
  renderBeats();
  renderSubdivisions();
}

function labelFor(name) {
  const s = t();
  return { beatsPerBar: s.timeSignature, noteValue: s.timeSignature, sound: s.sound,
    pitch: s.pitch, timer: s.timer }[name];
}

// Each rhythm is drawn from the very onsets the scheduler plays.
function renderSubdivisions() {
  els.subdivision.replaceChildren(...Object.entries(SUBDIVISIONS).map(([name, onsets]) => {
    const button = document.createElement('button');
    button.className = 'rhythm';
    button.type = 'button';
    button.dataset.subdivision = name;
    button.setAttribute('role', 'radio');
    button.title = t().subdivisions[name];
    button.setAttribute('aria-label', t().subdivisions[name]);
    button.innerHTML = rhythmSvg(onsets);
    button.addEventListener('click', () => {
      metronome.subdivision = name;
      renderSubdivisionState();
      save();
    });
    return button;
  }));
  renderSubdivisionState();
}

function renderSubdivisionState() {
  for (const b of els.subdivision.children) {
    b.setAttribute('aria-checked', b.dataset.subdivision === metronome.subdivision);
  }
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
      renderStressFirst();
      save();
    });
    return dot;
  }));
  activeDot = null;
  renderStressFirst();
}

// The checkbox is a shortcut for beat 1's accent, so the two stay in step.
function renderStressFirst() {
  els.stressFirst.checked = metronome.accents[0] === 'accent';
}

function renderPlay() {
  els.play.textContent = metronome.playing ? t().stop : t().start;
  els.play.classList.toggle('playing', metronome.playing);
  if (!metronome.playing) {
    activeDot?.classList.remove('active');
    activeDot = null;
    els.pendulumArm.removeAttribute('transform');
  }
  renderRemaining();
}

function renderRemaining() {
  const left = metronome.remaining();
  els.remaining.hidden = left === null;
  if (left !== null) els.remaining.textContent = formatClock(left);
}

function renderView() {
  document.body.classList.toggle('view-pendulum', ui.view === 'pendulum');
  for (const b of els.display.children) b.setAttribute('aria-pressed', b.dataset.view === ui.view);
}

function renderTheme() {
  const dark = document.documentElement.classList.contains('dark');
  els.theme.setAttribute('aria-pressed', dark);
}

function renderFullscreen() {
  els.fullscreen.setAttribute('aria-pressed', document.fullscreenElement !== null);
}

function renderAll() {
  selects.beatsPerBar.setValue(metronome.beatsPerBar);
  selects.noteValue.setValue(ui.noteValue);
  selects.sound.setValue(metronome.sound);
  selects.pitch.setValue(metronome.pitch);
  selects.timer.setValue(metronome.timerMinutes);
  els.volume.value = metronome.volume;
  renderText();
  renderTempo();
  renderSignature();
  renderView();
  renderTheme();
  renderFullscreen();
}

// Pendulum is at an extreme on every click and swings through the centre
// between clicks, alternating sides each beat.
function animateFrame() {
  requestAnimationFrame(animateFrame);
  if (!metronome.playing) return;
  renderRemaining();
  if (ui.view !== 'pendulum') return;
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

selects.beatsPerBar.setOptions(
  Array.from({ length: MAX_BEATS }, (_, i) => [i + 1, String(i + 1)]),
);
selects.noteValue.setOptions(DENOMINATORS.map((d) => [d, String(d)]));

load();
renderAll();
requestAnimationFrame(animateFrame);

els.slider.addEventListener('input', () => setBpm(els.slider.value));
els.bpm.addEventListener('change', () => setBpm(els.bpm.value));
els.up.addEventListener('click', (e) => setBpm(metronome.bpm + (e.shiftKey ? 5 : 1)));
els.down.addEventListener('click', (e) => setBpm(metronome.bpm - (e.shiftKey ? 5 : 1)));
els.play.addEventListener('click', togglePlay);
els.tap.addEventListener('click', tap);
els.reset.addEventListener('click', reset);
els.volume.addEventListener('input', () => { metronome.setVolume(Number(els.volume.value)); save(); });
els.stressFirst.addEventListener('change', () => {
  metronome.accents[0] = els.stressFirst.checked ? 'accent' : 'normal';
  renderBeats();
  save();
});

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

els.fullscreen.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => { /* refused */ });
});
document.addEventListener('fullscreenchange', renderFullscreen);

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

$('tuner-toggle').addEventListener('click', () => {
  if (tuner.state === 'listening' || tuner.state === 'requesting') tuner.stop();
  else tuner.start();
});
window.addEventListener('pagehide', () => tuner.stop());
