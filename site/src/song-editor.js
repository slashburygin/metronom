import { openLibrary, LibraryConflictError } from './library-storage.js';
import { newDocument, reviseDocument, migrateLegacy, exportLibrary, parseBackup, mergeLibrary, findSongs, LIBRARY_LIMIT, BACKUP_LIMIT } from './song-library.js';
import { normalizeArrangement } from './arrangement-ornaments.js';
import { normalizeSound } from './backing-sound.js';
import { createSoundControls } from './sound-controls.js';
import { BACKING_STYLES, STYLE_NAMES, normalizeSeed } from './arrangement.js';
import { seedControl, createArrangementControls } from './arrangement-controls.js';
import { newDraft, emptyMeasure, DraftHistory, compileDraft } from './song-draft.js';
import { CHORD_QUALITIES } from './chords.js';
import { arrangeSong } from './song-arrangement.js';
import { BackingPlayer } from './backing-player.js';
import { clampBpm } from './tempo.js';
import { normalizeTraining, trainingState, displaySong } from './training.js';
import { createTrainingControls, trainingLabel } from './training-controls.js';
import { transposeDraft } from './transposition.js';

const WORDS = {
  ru: { title: 'Композиции', untitled: 'Без названия', create: 'Новая', duplicate: 'Дубликат', save: 'Сохранить', saved: 'Сохранено на этом устройстве', saving: 'Сохранение…', storage: 'Не удалось сохранить библиотеку. Экспортируйте изменения в JSON.', load: 'Не удалось прочитать сохранённые композиции. Они не будут перезаписаны.',
    name: 'Название', composer: 'Автор', key: 'Исходная тональность', undo: 'Отменить', redo: 'Повторить', section: 'Секция', addSection: '+ Секция', removeSection: 'Удалить секцию', addBar: '+ Такт', removeBar: 'Удалить такт', copy: 'Копировать такт', paste: 'Вставить такт',
    bar: 'Такт', meter: 'Размер', chords: 'Аккорды', alternate: 'Альтернативные аккорды', text: 'Комментарий', insert: 'Добавить аккорд', root: 'Основной тон', quality: 'Тип аккорда', bass: 'Бас', none: 'Как основной тон',
    help: 'Аккорды через пробел делят такт поровну. Длительности в долях: Dm7:2 G7:2. Пустой такт — без гармонии; N.C. оставляет ударные, Break — полная пауза. Альтернативы вводятся по одной на аккорд и не звучат.',
    invalid: 'Проверьте аккорды, длительности и форму. Неизвестный ввод оставлен в черновике.', play: 'Играть', stop: 'Стоп', cancel: 'Отменить запуск', sound: 'Не удалось включить звук. Попробуйте ещё раз.', count: 'Отсчёт', countLabel: 'Отсчёт · первый звучащий такт', form: 'Знаки формы', order: 'Порядок тактов', formPosition: 'Форма', chorus: 'Круг', style: 'Ритм', repeats: 'Круги', ready: 'Готово к воспроизведению', limit: 'Достигнут предел: 100 композиций, 32 секции или 256 тактов.',
  },
  en: { title: 'Songs', untitled: 'Untitled', create: 'New', duplicate: 'Duplicate', save: 'Save', saved: 'Saved on this device', saving: 'Saving…', storage: 'Could not save the library. Export your changes to JSON.', load: 'Could not read saved songs. They will not be overwritten.',
    name: 'Title', composer: 'Composer', key: 'Source key', undo: 'Undo', redo: 'Redo', section: 'Section', addSection: '+ Section', removeSection: 'Remove section', addBar: '+ Bar', removeBar: 'Remove bar', copy: 'Copy bar', paste: 'Paste bar',
    bar: 'Bar', meter: 'Meter', chords: 'Chords', alternate: 'Alternate chords', text: 'Comment', insert: 'Insert chord', root: 'Root', quality: 'Quality', bass: 'Bass', none: 'Same as root',
    help: 'Space-separated chords divide the bar equally. Beat durations: Dm7:2 G7:2. Empty bars have no harmony; N.C. keeps drums, Break silences all parts. Enter one alternate per chord; alternates are not played.',
    invalid: 'Check chords, durations and form. Unrecognized input remains in the draft.', play: 'Play', stop: 'Stop', cancel: 'Cancel start', sound: 'Could not start audio. Try again.', count: 'Count-in', countLabel: 'Count-in · first played bar', form: 'Form signs', order: 'Bar order', formPosition: 'Form', chorus: 'Chorus', style: 'Feel', repeats: 'Choruses', ready: 'Ready to play', limit: 'Limit reached: 100 songs, 32 sections or 256 bars.',
  },
};
const clone = v => JSON.parse(JSON.stringify(v));
const NOTES = ['C','C♯','D♭','D','D♯','E♭','E','F','F♯','G♭','G','G♯','A♭','A','A♯','B♭','B'];
const LIBRARY_WORDS = {
  ru: { loading: 'Загрузка библиотеки…', search: 'Поиск по названию, автору и тональности', trash: 'Корзина', remove: 'В корзину', restore: 'Восстановить', export: 'Экспорт JSON', import: 'Импорт JSON', empty: 'Выберите или создайте композицию.', noMatches: 'Нет совпадений', failed: 'Операция не выполнена: ', conflict: 'Библиотека изменилась в другой вкладке. Экспортируйте текущие изменения в JSON и перезагрузите страницу.', imported: 'Импорт: добавлено / обновлено / конфликтных копий', recovered: 'Восстановлены незавершённые сохранения. Проверьте библиотеку и конфликтные копии.', recoveryWarning: 'Некоторые данные восстановления не удалось прочитать; они сохранены без изменений.', limit: 'Не более 100 композиций вместе с корзиной.', fork: 'конфликтная копия' },
  en: { loading: 'Loading library…', search: 'Search title, composer and key', trash: 'Trash', remove: 'Move to trash', restore: 'Restore', export: 'Export JSON', import: 'Import JSON', empty: 'Choose or create a song.', noMatches: 'No matches', failed: 'Operation failed: ', conflict: 'The library changed in another tab. Export your current changes to JSON and reload the page.', imported: 'Import: added / updated / conflict copies', recovered: 'Recovered unfinished saves. Check the library and conflict copies.', recoveryWarning: 'Some recovery data could not be read; it has been left unchanged.', limit: 'Up to 100 songs including trash.', fork: 'conflict copy' },
};

export function initSongEditor({ getLang, getContext }) {
  const root = document.getElementById('songs');
  let collection = { version: 1, documents: [], currentId: null }, blocked = false, storageError = false;
  let libraryStore, loading = true, currentDocument, conflict = false, editVersion = 0;
  let search = '', showTrash = false, libraryNotice = '', importing = false;
  let training = normalizeTraining();
  let style = 'swing', seed = 1, repeats = 1, countIn = true, sound = normalizeSound(), arrangement = normalizeArrangement();
  const loadTraining = () => {
    style = 'swing'; seed = 1; repeats = 1; countIn = true; sound = normalizeSound(); arrangement = normalizeArrangement(); training = normalizeTraining();
    try {
      const saved = currentDocument?.settings;
      training = normalizeTraining(saved);
      if (BACKING_STYLES.includes(saved?.style)) style = saved.style;
      seed = normalizeSeed(saved?.seed);
      sound = normalizeSound(saved?.sound);
      arrangement = normalizeArrangement(saved?.arrangement);
      if ([0,1,2,4,8,12,24].includes(saved?.repeats)) repeats = saved.repeats;
      if (typeof saved?.countIn === 'boolean') countIn = saved.countIn;
    } catch {}
  };
  const saveTraining = () => {
    if (!currentDocument) return;
    replaceDocument(reviseDocument(currentDocument, { settings: { ...training, style, seed, repeats, countIn, sound, arrangement } }));
    markDirty(); save();
  };
  let history, sectionIndex = 0, measureIndex = 0, clipboard = null;
  let timer, dirty = false, focusGroup = 0, engine, position, generation = 0, soundError = false, notice = '';
  let validation;
  const s = () => WORDS[getLang()];
  const el = (tag, text, className) => { const node = window.document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; };
  const active = () => Boolean(engine?.transport.playing || engine?.transport.pending);
  const measure = () => history.current.sections[sectionIndex].measures[measureIndex];
  const barCount = () => history.current.sections.reduce((n, section) => n + section.measures.length, 0);
  const ref = id => root.querySelector(`#${id}`);

  const libraryWords = () => LIBRARY_WORDS[getLang()];
  function replaceDocument(doc) {
    collection.documents[collection.documents.findIndex(item => item.id === doc.id)] = doc;
    if (currentDocument?.id === doc.id) currentDocument = doc;
  }
  function captureCurrent() { if (currentDocument && history) replaceDocument(reviseDocument(currentDocument, { draft: clone(history.current) })); }
  function markDirty() { dirty = true; ++editVersion; }
  function selectCurrent(doc) {
    currentDocument = doc; collection.currentId = doc?.id ?? null;
    history = doc ? new DraftHistory(doc.draft) : null;
    sectionIndex = measureIndex = 0; loadTraining();
  }
  async function save() {
    clearTimeout(timer); captureCurrent();
    if (blocked || !libraryStore) { updateStatus(); return false; }
    const version = editVersion;
    try {
      await libraryStore.save(collection);
      if (version === editVersion) { dirty = false; storageError = false; conflict = false; }
      updateStatus(); return true;
    } catch (error) { storageError = true; conflict = error instanceof LibraryConflictError; updateStatus(); return false; }
  }
  function updateStatus() {
    if (!ref('song-save-status')) return;
    ref('song-save-status').textContent = blocked ? s().load : conflict ? libraryWords().conflict : storageError ? s().storage : dirty ? s().saving : s().saved;
    ref('song-save-status').setAttribute('role', blocked || storageError ? 'alert' : 'status');
  }
  function updateWrittenChart() {
    let written;
    if (validation.compiled) {
      const state = position?.step.training ?? trainingState(validation.compiled.song.key,1,history.current.bpm,training);
      const label = trainingLabel(state,getLang());
      if (ref('song-key-status') && ref('song-key-status').textContent !== label) ref('song-key-status').textContent = label;
      written = displaySong(validation.compiled.song,state).sections.flatMap(section => section.measures);
    } else if (ref('song-key-status')) ref('song-key-status').textContent = '';
    for (const bar of root.querySelectorAll('[data-global-bar]')) {
      const m = written?.[Number(bar.dataset.globalBar)];
      if (m) {
        bar.querySelector('.song-bar-chords').textContent = m.chords.map(c => c.symbol).join(' · ') || '—';
        bar.querySelector('.song-bar-alternate').textContent = m.chords.map(c => c.alternate || '').filter(Boolean).join(' · ');
      } else {
        const source = history.current.sections[Number(bar.dataset.section)].measures[Number(bar.dataset.measure)];
        bar.querySelector('.song-bar-chords').textContent = source.chords || '—';
        bar.querySelector('.song-bar-alternate').textContent = source.alternate;
      }
    }
  }
  function updatePlayback() {
    if (!ref('song-play')) return;
    ref('song-play').textContent = engine?.transport.pending ? s().cancel : active() ? s().stop : s().play;
    ref('song-play').setAttribute('aria-pressed', String(active()));
    ref('song-play').disabled = Boolean(validation.errors.length) && !active();
    updateWrittenChart();
    ref('song-play-status').textContent = soundError ? s().sound : position
      ? position.countIn ? `${s().count} · ${position.step.beatIndex + 1}` : `${s().bar} ${position.step.barIndex + 1} · ${s().formPosition} ${position.step.playbackBarIndex + 1} / ${validation.compiled.playOrder.length} · ${s().chorus} ${position.step.pass}${repeats ? ` / ${repeats}` : ''}`
      : notice || (validation.errors.length ? s().invalid : s().ready);
    root.querySelectorAll('[data-global-bar]').forEach(node => {
      const current = Boolean(position && !position.countIn && Number(node.dataset.globalBar) === position.step.barIndex);
      node.classList.toggle('playing', current);
      if (current) node.setAttribute('aria-current', 'true'); else node.removeAttribute('aria-current');
    });
  }
  function stop() { ++generation; engine?.stop(); position = null; updatePlayback(); }
  function validate() {
    validation = compileDraft(history.current);
    ref('song-errors').textContent = validation.errors.length ? s().invalid + ' ' + validation.errors.map(error => error.sectionIndex === undefined ? error.message : `${history.current.sections[error.sectionIndex].name || s().section}, ${s().bar} ${error.measureIndex + 1}: ${error.message}`).join('; ') : '';
    for (const button of root.querySelectorAll('[data-section]')) {
      const section = Number(button.dataset.section), index = Number(button.dataset.measure);
      const m = history.current.sections[section].measures[index];
      const invalid = validation.errors.some(error => error.sectionIndex === section && error.measureIndex === index);
      button.classList.toggle('invalid', invalid); button.setAttribute('aria-invalid', String(invalid));
      button.querySelector('.song-bar-chords').textContent = m.chords || '—';
      button.querySelector('.song-bar-alternate').textContent = m.alternate;
      button.querySelector('.song-bar-text').textContent = m.text;
      button.querySelector('.song-bar-form').textContent = m.form || '';
      button.querySelector('.backing-bar-number').textContent = `${Number(button.dataset.globalBar) + 1} · ${m.meter}`;
    }
    root.querySelectorAll('[data-section-heading]').forEach(heading => {
      heading.textContent = history.current.sections[Number(heading.dataset.sectionHeading)].name || s().section;
    });
    ref('song-undo').disabled = !history.past.length;
    ref('song-redo').disabled = !history.future.length;
    if (ref('song-transpose-source')) ref('song-transpose-source').disabled = Boolean(validation.errors.length || !training.targetKey);
    const order = validation.compiled?.playOrder;
    ref('song-form-order').textContent = order ? `${s().order} (${order.length}): ${order.slice(0,64).map(i => i + 1).join(' → ')}${order.length > 64 ? ' …' : ''}` : '';
    const option = ref('song-select').selectedOptions[0];
    if (option?.value === currentDocument.id) option.textContent = (history.current.title || s().untitled) + (currentDocument.conflictOf ? ` · ${libraryWords().fork}` : '');
    updatePlayback(); updateStatus();
  }
  function change(edit, group = null, redraw = false) {
    stop(); notice = ''; soundError = false;
    const draft = clone(history.current); edit(draft);
    if (history.update(draft, group)) { markDirty(); clearTimeout(timer); timer = setTimeout(save, 300); }
    if (redraw) render(); else validate();
  }
  function normalizeSelection() {
    sectionIndex = Math.min(sectionIndex, history.current.sections.length - 1);
    measureIndex = Math.min(measureIndex, history.current.sections[sectionIndex].measures.length - 1);
  }
  function restore(which) { stop(); if (history[which]()) { normalizeSelection(); markDirty(); save(); render(); } }
  function chooseDocument(doc) {
    if (!doc || doc.deletedAt) return;
    save(); stop(); selectCurrent(collection.documents.find(item => item.id === doc.id)); notice = ''; markDirty(); save(); render();
  }
  function createDocument(duplicate) {
    if (blocked) return;
    if (collection.documents.length >= LIBRARY_LIMIT) { libraryNotice = libraryWords().limit; render(); return; }
    captureCurrent();
    const draft = duplicate ? clone(history.current) : newDraft();
    if (duplicate) draft.title = `${draft.title || s().untitled} (${s().duplicate})`;
    const doc = newDocument(draft, duplicate ? currentDocument.settings : {});
    collection.documents.push(doc); chooseDocument(doc);
  }
  function trashCurrent() {
    if (!currentDocument || blocked) return;
    stop(); captureCurrent();
    replaceDocument(reviseDocument(currentDocument, { deletedAt: new Date().toISOString() }));
    selectCurrent(collection.documents.find(doc => !doc.deletedAt)); markDirty(); save(); render();
  }
  function renderLibrary(button) {
    const words = libraryWords(), tools = el('div', '', 'song-toolbar');
    tools.append(button(s().create, 'song-new', () => createDocument(false), blocked));
    tools.append(button(words.remove, 'song-trash', trashCurrent, blocked || !currentDocument));
    tools.append(button(words.export, 'song-export', () => {
      try {
        captureCurrent();
        const url = URL.createObjectURL(new Blob([exportLibrary(collection)], { type: 'application/json' }));
        const link = el('a'); link.href = url; link.download = 'metronom-library.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { libraryNotice = words.failed + error.message; render(); }
    }));
    const file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true; file.id = 'song-import-file'; file.setAttribute('aria-label', words.import);
    const importButton = button(words.import, 'song-import', () => file.click(), blocked || importing);
    file.addEventListener('change', async () => {
      const selected = file.files[0]; if (!selected || importing || blocked) return;
      importing = true; importButton.disabled = true;
      try {
        if (selected.size > BACKUP_LIMIT) throw new RangeError('Backup exceeds 10 MB');
        const incoming = parseBackup(await selected.text());
        stop(); captureCurrent();
        const merged = mergeLibrary(collection, incoming); collection = merged.library;
        selectCurrent(collection.documents.find(doc => doc.id === collection.currentId && !doc.deletedAt));
        markDirty(); const saved = await save();
        libraryNotice = `${words.imported}: ${merged.added} / ${merged.updated} / ${merged.conflicts}${saved ? '' : ' · ' + s().storage}`;
      } catch (error) { libraryNotice = words.failed + error.message; }
      finally { importing = false; render(); }
    });
    tools.append(importButton, file); root.append(tools);
    const searchLabel = el('label', words.search), input = el('input'); input.type = 'search'; input.id = 'song-search'; input.value = search;
    searchLabel.append(input); root.append(searchLabel);
    const chooserLabel = el('label', s().title), chooser = el('select'); chooser.id = 'song-select';
    function updateChooser() {
      chooser.replaceChildren();
      const docs = findSongs(collection, search);
      if (!docs.some(doc => doc.id === currentDocument?.id)) { const placeholder = el('option', words.noMatches + (docs.length ? ` · ${docs.length}` : '')); placeholder.value = ''; placeholder.selected = true; chooser.append(placeholder); }
      for (const doc of docs) {
        const title = doc.id === currentDocument?.id ? history.current.title : doc.draft.title;
        const option = el('option', (title || s().untitled) + (doc.conflictOf ? ` · ${words.fork}` : ''));
        option.value = doc.id; option.selected = doc.id === currentDocument?.id; chooser.append(option);
      }
    }
    input.addEventListener('input', () => { search = input.value; captureCurrent(); updateChooser(); });
    chooser.addEventListener('change', () => chooseDocument(collection.documents.find(doc => doc.id === chooser.value)));
    updateChooser(); chooserLabel.append(chooser); root.append(chooserLabel);
    const trashLabel = el('label', '', 'check'), trash = el('input'); trash.type = 'checkbox'; trash.id = 'song-show-trash'; trash.checked = showTrash;
    trash.addEventListener('change', () => { showTrash = trash.checked; render(); ref('song-show-trash').focus(); });
    trashLabel.append(trash, el('span', `${words.trash} (${collection.documents.filter(doc => doc.deletedAt).length})`)); root.append(trashLabel);
    if (showTrash) {
      const list = el('div', '', 'song-trash-list');
      for (const doc of findSongs(collection, '', true)) {
        const row = el('div', '', 'song-toolbar'); row.append(el('span', doc.draft.title || s().untitled));
        row.append(button(words.restore, '', () => { replaceDocument(reviseDocument(doc, { deletedAt: null })); chooseDocument(collection.documents.find(item => item.id === doc.id)); }, blocked)); list.append(row);
      }
      root.append(list);
    }
    const message = el('p', libraryNotice, 'textbook-help'); message.id = 'song-library-status'; message.setAttribute('role','status'); root.append(message);
    const status = el('p', '', 'textbook-help'); status.id = 'song-save-status'; root.append(status); updateStatus();
  }
  function render() {
    if (history) normalizeSelection();
    root.replaceChildren();
    const words = s();
    root.append(el('h2', words.title));
    if (loading) { root.append(el('p', libraryWords().loading)); return; }
    const toolbar = el('div', '', 'song-toolbar');
    function button(label, id, action, disabled = false) {
      const node = el('button', label, 'btn btn--secondary'); node.id = id; node.type = 'button'; node.disabled = disabled; node.addEventListener('click', action); return node;
    }
    renderLibrary(button);
    if (!currentDocument) { root.append(el('p', libraryWords().empty)); return; }
    toolbar.append(button(words.duplicate, 'song-duplicate', () => createDocument(true), blocked), button(words.save, 'song-save', save), button(words.undo, 'song-undo', () => restore('undo')), button(words.redo, 'song-redo', () => restore('redo')));
    root.append(toolbar);
    const metadata = el('div', '', 'song-fields');
    function inputField(parent, label, id, value, apply, options = {}) {
      const wrapper = el('label', label), input = el(options.multiline ? 'textarea' : 'input');
      input.id = id; input.value = value; input.maxLength = options.maxLength ?? 2000;
      if (options.number) { input.type = 'number'; input.min = 30; input.max = 300; }
      input.addEventListener('focus', () => { ++focusGroup; });
      input.addEventListener('input', () => {
        if (options.number) return;
        change(draft => apply(draft, input.value), `${id}:${focusGroup}`);
      });
      if (options.number) input.addEventListener('change', () => { input.value = clampBpm(input.value); change(draft => apply(draft, Number(input.value))); });
      input.addEventListener('blur', () => { history.group = null; });
      wrapper.append(input); parent.append(wrapper); return input;
    }
    inputField(metadata, words.name, 'song-title', history.current.title, (d, v) => { d.title = v; }, { maxLength: 160 });
    inputField(metadata, words.composer, 'song-composer', history.current.composer, (d, v) => { d.composer = v; }, { maxLength: 160 });
    inputField(metadata, words.key, 'song-key', history.current.key, (d, v) => { d.key = v; }, { maxLength: 20 });
    inputField(metadata, 'BPM', 'song-bpm', history.current.bpm, (d, v) => { d.bpm = v; }, { number: true });
    root.append(metadata);
    const chart = el('div', '', 'song-chart'); let globalBar = 0;
    history.current.sections.forEach((section, si) => {
      const heading = el('h3', section.name || words.section); heading.dataset.sectionHeading = si; chart.append(heading);
      const bars = el('div', '', 'song-bars');
      section.measures.forEach((m, mi) => {
        const cell = button('', '', () => { sectionIndex = si; measureIndex = mi; render(); ref('song-chords').focus(); });
        cell.removeAttribute('id'); cell.dataset.section = si; cell.dataset.measure = mi; cell.dataset.globalBar = globalBar;
        cell.setAttribute('aria-label', `${words.section} ${section.name}, ${words.bar} ${globalBar + 1}`);
        cell.setAttribute('aria-pressed', String(si === sectionIndex && mi === measureIndex));
        cell.append(el('span', `${++globalBar} · ${m.meter}`, 'backing-bar-number'), el('span', m.form || '', 'song-bar-form'), el('span', m.alternate, 'song-bar-alternate'), el('span', m.chords || '—', 'song-bar-chords'), el('span', m.text, 'song-bar-text'));
        bars.append(cell);
      });
      chart.append(bars);
    });
    root.append(chart);
    const actions = el('div', '', 'song-toolbar');
    actions.append(button(words.addSection, 'song-add-section', () => {
      if (barCount() >= 256 || history.current.sections.length >= 32) { notice = words.limit; updatePlayback(); return; }
      change(d => { d.sections.push({ name: String.fromCharCode(65 + d.sections.length % 26), measures: [emptyMeasure()] }); sectionIndex = d.sections.length - 1; measureIndex = 0; }, null, true);
    }), button(words.removeSection, 'song-remove-section', () => change(d => { d.sections.splice(sectionIndex, 1); sectionIndex = measureIndex = 0; }, null, true), history.current.sections.length === 1),
    button(words.addBar, 'song-add-bar', () => {
      if (barCount() >= 256) { notice = words.limit; updatePlayback(); return; }
      change(d => { const meter = measure().meter; d.sections[sectionIndex].measures.splice(++measureIndex, 0, { ...emptyMeasure(), meter }); }, null, true);
    }), button(words.removeBar, 'song-remove-bar', () => change(d => { d.sections[sectionIndex].measures.splice(measureIndex, 1); measureIndex = Math.max(0, measureIndex - 1); }, null, true), history.current.sections[sectionIndex].measures.length === 1),
    button(words.copy, 'song-copy-bar', () => { clipboard = clone(measure()); ref('song-paste-bar').disabled = false; }), button(words.paste, 'song-paste-bar', () => change(d => { d.sections[sectionIndex].measures[measureIndex] = clone(clipboard); }, null, true), !clipboard));
    root.append(actions);
    const form = el('div', '', 'song-fields song-measure-editor');
    inputField(form, words.section, 'song-section-name', history.current.sections[sectionIndex].name, (d, v) => { d.sections[sectionIndex].name = v; }, { maxLength: 80 });
    inputField(form, words.meter, 'song-meter', measure().meter, (d, v) => { d.sections[sectionIndex].measures[measureIndex].meter = v; }, { maxLength: 8 });
    inputField(form, words.chords, 'song-chords', measure().chords, (d, v) => { d.sections[sectionIndex].measures[measureIndex].chords = v; }, { multiline: true });
    inputField(form, words.alternate, 'song-alternate', measure().alternate, (d, v) => { d.sections[sectionIndex].measures[measureIndex].alternate = v; }, { multiline: true });
    inputField(form, words.text, 'song-comment', measure().text, (d, v) => { d.sections[sectionIndex].measures[measureIndex].text = v; }, { multiline: true });
    inputField(form, words.form, 'song-form', measure().form || '', (d, v) => { d.sections[sectionIndex].measures[measureIndex].form = v; }, { maxLength: 200 });
    root.append(form);
    const picker = el('div', '', 'song-fields');
    function selectField(parent, label, id, values, labels = values, value = values[0], action) {
      const wrapper = el('label', label), select = el('select'); select.id = id;
      values.forEach((v, i) => { const opt = el('option', labels[i]); opt.value = v; opt.selected = value === v; select.append(opt); });
      if (action) select.addEventListener('change', () => { stop(); action(select.value); });
      wrapper.append(select); parent.append(wrapper); return select;
    }
    const formPicker = el('div', '', 'song-fields');
    const signs = ['', '|:', ':|', ':|3', '[1', '[2', '[1,2', ']', 'Segno', 'Coda', 'Fine', 'ToCoda', 'D.C.', 'D.S.', 'D.C.alFine', 'D.S.alFine', 'D.C.alCoda', 'D.S.alCoda'];
    const formLabels = getLang() === 'ru'
      ? ['Выберите знак', 'Начало репризы |:', 'Конец репризы · 2 раза :|', 'Конец репризы · 3 раза :|3', 'Начало вольты 1 [1', 'Начало вольты 2 [2', 'Вольта для проходов 1 и 2 [1,2', 'Конец вольты ]', 'Segno · цель D.S.', 'Coda · начало коды', 'Fine · окончание', 'To Coda · переход к коде', 'D.C. · к началу', 'D.S. · к Segno', 'D.C. al Fine', 'D.S. al Fine', 'D.C. al Coda', 'D.S. al Coda']
      : ['Choose a sign', 'Repeat start |:', 'Repeat end · 2 times :|', 'Repeat end · 3 times :|3', 'Ending 1 start [1', 'Ending 2 start [2', 'Ending for passes 1 and 2 [1,2', 'Ending end ]', 'Segno · D.S. target', 'Coda · start of coda', 'Fine · finish', 'To Coda · jump to coda', 'D.C. · to start', 'D.S. · to Segno', 'D.C. al Fine', 'D.S. al Fine', 'D.C. al Coda', 'D.S. al Coda'];
    const sign = selectField(formPicker, words.form, 'song-form-sign', signs, formLabels);
    formPicker.append(button(getLang() === 'ru' ? 'Добавить знак' : 'Add sign', 'song-form-insert', () => {
      if (!sign.value) return;
      change(d => { const m = d.sections[sectionIndex].measures[measureIndex]; m.form = [m.form, sign.value].filter(Boolean).join(' '); }, null, true);
      ref('song-form').focus();
    }));
    const formHelp = el('p', getLang() === 'ru'
      ? 'Знаки относятся к выбранному такту: |: и Segno/Coda — перед ним; :|, Fine, ToCoda и D.C./D.S. — после него. Вольта начинается с [1 или [2 и заканчивается ] либо :|. Например: такт 1 — |:, такт 2 — [1 :|, такт 3 — [2 ]. После D.C./D.S. репризы идут один раз по последним вольтам. Поддерживается один D.C./D.S. на композицию.'
      : 'Signs belong to the selected bar: |: and Segno/Coda are before it; :|, Fine, ToCoda and D.C./D.S. are after it. An ending starts with [1 or [2 and closes with ] or :|. Example: bar 1 — |:, bar 2 — [1 :|, bar 3 — [2 ]. After D.C./D.S., repeats play once using their final endings. One D.C./D.S. per song is supported.', 'textbook-help');
    const order = el('p', '', 'textbook-help'); order.id = 'song-form-order';
    root.append(formPicker, formHelp, order);
    const pickRoot = selectField(picker, words.root, 'song-chord-root', NOTES);
    const quality = selectField(picker, words.quality, 'song-chord-quality', CHORD_QUALITIES, CHORD_QUALITIES.map(q => q || (getLang() === 'ru' ? 'Мажор' : 'Major')), 'maj7');
    const bass = selectField(picker, words.bass, 'song-chord-bass', ['', ...NOTES], [words.none, ...NOTES]);
    picker.append(button(words.insert, 'song-insert-chord', () => {
      const symbol = pickRoot.value + quality.value + (bass.value ? '/' + bass.value : '');
      change(d => { const m = d.sections[sectionIndex].measures[measureIndex]; m.chords = [m.chords.trim(), symbol].filter(Boolean).join(' '); }, null, true); ref('song-chords').focus();
    }));
    root.append(picker, el('p', words.help, 'textbook-help'));
    const errors = el('p', '', 'song-errors'); errors.id = 'song-errors'; errors.setAttribute('role', 'alert'); root.append(errors);
    const playback = el('div', '', 'song-fields');
    selectField(playback, words.style, 'song-style', BACKING_STYLES, STYLE_NAMES[getLang()], style, v => { style = v; saveTraining(); });
    playback.append(seedControl({ prefix: 'song', lang: getLang(), seed, onChange(value) { stop(); seed = value; saveTraining(); } }));
    selectField(playback, words.repeats, 'song-repeats', ['1','2','4','8','12','24','0'], ['1','2','4','8','12','24',getLang() === 'ru' ? 'До остановки' : 'Until stopped'], String(repeats), v => { repeats = Number(v); saveTraining(); });
    const countLabel = el('label', '', 'check'), count = el('input'); count.type = 'checkbox'; count.checked = countIn; count.id = 'song-count-in'; count.addEventListener('change', () => { stop(); countIn = count.checked; saveTraining(); }); countLabel.append(count, el('span', words.countLabel));
    const play = button(words.play, 'song-play', async () => {
      if (active()) { stop(); return; }
      const request = ++generation; soundError = false; notice = '';
      try {
        validation = compileDraft(history.current); if (!validation.compiled) { validate(); return; }
        const compiled = arrangeSong(validation.compiled.song, { style, seed, arrangement });
        const context = getContext();
        engine ??= new BackingPlayer({ context, onStep: p => { position = p; updatePlayback(); }, onStop: () => { position = null; updatePlayback(); } });
        const pending = engine.start(compiled, { bpm: history.current.bpm, repeats, countIn, training, sound }); updatePlayback(); await pending;
      } catch { if (request === generation) { engine?.stop(); soundError = true; } }
      if (request === generation) updatePlayback();
    });
    const playStatus = el('p', '', 'textbook-help'); playStatus.id = 'song-play-status'; playStatus.setAttribute('role', 'status');
    const trainingControls = createTrainingControls({ prefix: 'song-training', getLang, settings: training, sourceKey: history.current.key, bpm: history.current.bpm,
      onChange(name, value) { stop(); training = normalizeTraining({ ...training, [name]: value }); saveTraining(); render(); ref(`song-training-${name}`)?.focus(); },
    });
    const keyStatus = el('p', '', 'song-key-status'); keyStatus.id = 'song-key-status'; keyStatus.setAttribute('role','status');
    const transpose = button(getLang() === 'ru' ? 'Транспонировать исходные аккорды' : 'Transpose source chords', 'song-transpose-source', () => {
      if (!training.targetKey || validation.errors.length) return;
      const target = training.targetKey;
      training = normalizeTraining({ ...training, targetKey: '' }); saveTraining();
      change(d => Object.assign(d,transposeDraft(d,target)),null,true);
    });
    const sourceHelp = el('p', getLang() === 'ru' ? 'Поля редактора содержат исходные аккорды. Сетка показывает партию инструмента. Кнопка транспонирования изменяет оригинал; это действие можно отменить.' : 'Editor fields contain source chords. The chart shows the instrument part. Transpose source chords changes the original and can be undone.', 'textbook-help');
    const soundControls = createSoundControls({ prefix: 'song', lang: getLang(), sound,
      onChange(value) { stop(); sound = value; saveTraining(); },
    });
    const arrangementControls = createArrangementControls({ prefix: 'song', lang: getLang(), arrangement,
      onChange(value) { stop(); arrangement = value; saveTraining(); },
    });
    root.append(playback, countLabel, trainingControls, keyStatus, transpose, sourceHelp, play, playStatus, soundControls, arrangementControls);
    validate();
  }
  root.addEventListener('keydown', event => {
    if (history && (event.ctrlKey || event.metaKey) && ['z','y','s'].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.stopPropagation();
      if (event.key.toLowerCase() === 's') save();
      else restore(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo');
    }
  });
  window.addEventListener('pagehide', () => { if (dirty) save(); });
  window.document.addEventListener('visibilitychange', () => { if (window.document.hidden && dirty) save(); });
  const ready = (async () => {
    try {
      libraryStore = await openLibrary(); collection = libraryStore.library;
      if (libraryStore.recovered) libraryNotice = libraryWords().recovered;
      if (libraryStore.recoveryWarning) libraryNotice += ' ' + libraryWords().recoveryWarning;
    } catch {
      blocked = true;
      try { collection = migrateLegacy(localStorage); } catch {}
    }
    if (!collection.documents.length) {
      const doc = newDocument(newDraft()); collection.documents.push(doc); collection.currentId = doc.id; markDirty();
    }
    selectCurrent(collection.documents.find(doc => doc.id === collection.currentId && !doc.deletedAt) ?? collection.documents.find(doc => !doc.deletedAt));
    loading = false; render();
    if (dirty && !blocked) await save();
  })();
  return { render, stop, ready };
}
