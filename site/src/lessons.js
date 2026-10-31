import { initScalePractice } from './scale-practice.js';
import { initSongEditor } from './song-editor.js';

const BASE = 'lessons/haimovich/';
const DAYS = {
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export function initLessons(getLang, onTempo, playback) {
  const $ = (id) => document.getElementById(id);
  const scales = initScalePractice(getLang, onTempo, { ...playback, getContext() { songs.stop(); return playback.getContext(); } });
  const songs = initSongEditor({ getLang, getContext() { scales.stop(); return playback.getContext(); } });
  let mode = 'daily';
  for (const name of ['daily', 'scales']) {
    $(`${name}-mode`).addEventListener('click', () => {
      mode = name;
      renderMode();
    });
  }
  function renderMode() {
    if (mode !== 'scales') scales.stop();
    $('daily-practice').hidden = mode !== 'daily';
    $('scale-practice').hidden = mode !== 'scales';
    $('daily-mode').setAttribute('aria-pressed', mode === 'daily');
    $('scales-mode').setAttribute('aria-pressed', mode === 'scales');
  }
  let day = new Date().getDay();
  let schedule;
  let failed = false;
  let active = 'lessons';
  const tabs = ['lessons', 'songs', 'textbook'];
  function showTab(id) {
    if (id !== 'lessons') scales.stop();
    if (id !== 'songs') songs.stop();
    if(id==='songs')playback.stopMetronome?.();
    active = id;
    document.querySelector('.app').classList.toggle('songs-workspace',id==='songs');
    for (const name of tabs) {
      $(`${name}-tab`).setAttribute('aria-selected', name === id);
      $(`${name}-tab`).tabIndex = name === id ? 0 : -1;
      $(name).hidden = name !== id;
    }
  }
  tabs.forEach((id, index) => {
    $(`${id}-tab`).addEventListener('click', () => showTab(id));
    $(`${id}-tab`).addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      showTab(next);
      $(`${next}-tab`).focus();
    });
  });
  function render() {
    scales.render();
    songs.render();
    renderMode();
    const lang = getLang();
    const ru = lang === 'ru';
    const focusedDay = document.activeElement?.dataset.day;
    $('lesson-days').replaceChildren(...[1, 2, 3, 4, 5, 6, 0].map((value) => {
      const button = document.createElement('button');
      button.className = 'btn btn--secondary';
      button.textContent = DAYS[lang][value];
      button.dataset.day = value;
      button.setAttribute('aria-pressed', value === day);
      const date = new Date(2024, 0, 7 + value);
      button.setAttribute('aria-label', new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(date));
      button.addEventListener('click', () => { day = value; render(); });
      return button;
    }));
    if (focusedDay !== undefined) $('lesson-days').querySelector(`[data-day="${focusedDay}"]`)?.focus();
    $('lesson-status').hidden = Boolean(schedule);
    $('lesson-status').textContent = failed
      ? (ru ? 'Не удалось загрузить занятия. Обновите страницу, чтобы повторить.' : 'Could not load practice materials. Reload to retry.')
      : (ru ? 'Загрузка занятий…' : 'Loading practice materials…');
    if (!schedule) return;
    const content = $('lesson-content');
    content.replaceChildren();
    const session = schedule.sessions.find((item) => item.days.includes(day));
    for (const item of [session, schedule.daily].filter(Boolean)) {
      const section = document.createElement('section');
      section.setAttribute('aria-label', item.title[lang]);
      for (const page of item.pages) {
        const figure = document.createElement('figure');
        const link = document.createElement('a');
        link.href = `${BASE}page-${page}.webp`;
        link.target = '_blank';
        link.rel = 'noopener';
        const image = document.createElement('img');
        image.src = link.href;
        image.alt = `${item.title[lang]} · ${ru ? 'страница' : 'page'} ${page}`;
        image.loading = 'lazy';
        image.width = 1414;
        image.height = 2000;
        link.append(image);
        const caption = document.createElement('figcaption');
        const daily = item === schedule.daily ? `${ru ? 'Ежедневно' : 'Daily'} · ` : '';
        caption.textContent = `${daily}${ru ? 'Стр.' : 'Page'} ${page} · ${ru ? 'Нажмите на ноты, чтобы увеличить' : 'Click the score to enlarge'}`;
        figure.append(link, caption);
        section.append(figure);
      }
      content.append(section);
    }
    showTab(active);
  }
  fetch(`${BASE}schedule.json`).then((response) => {
    if (!response.ok) throw new Error(response.status);
    return response.json();
  }).then((data) => { schedule = data; render(); }).catch(() => { failed = true; render(); });
  return { handleShortcut: event => active==='songs' && songs.handleShortcut(event), render, stopPlayback() { scales.stop(); songs.stop(); }, setBpm: scales.setBpm };
}
