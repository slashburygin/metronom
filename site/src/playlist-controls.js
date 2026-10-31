import { downloadFile } from './export-controls.js';
import { KEY_NAMES } from './transposition.js';
import { newPlaylist, revisePlaylist, addPlaylistSong, movePlaylistEntry, removePlaylistEntry, setPlaylistEntryKey, PLAYLIST_LIMIT } from './playlists.js';

const WORDS = {
  ru: { title: 'Плейлисты', create: 'Новый плейлист', name: 'Название плейлиста', add: 'Добавить открытую композицию', empty: 'Плейлист пуст. Откройте композицию и добавьте её.', choose: 'Выберите или создайте плейлист.', untitled: 'Без названия', trash: 'В корзину', restore: 'Восстановить', showTrash: 'Корзина плейлистов', unavailable: 'в корзине · восстановите композицию', up: 'Выше', down: 'Ниже', remove: 'Убрать из плейлиста', previous: 'Предыдущая', next: 'Следующая', run: 'Играть плейлист', stop: 'Остановить плейлист', fork: 'конфликтная копия', help: 'Песни играют по порядку со своими настройками и отсчётом. Нужны корректные аккорды и конечное число кругов у каждой песни. Переход между песнями имеет небольшую паузу.', failed: 'Операция не выполнена: ', limit: 'Не более 50 плейлистов вместе с корзиной.' },
  en: { title: 'Playlists', create: 'New playlist', name: 'Playlist name', add: 'Add open song', empty: 'Playlist is empty. Open a song and add it.', choose: 'Choose or create a playlist.', untitled: 'Untitled', trash: 'Move to trash', restore: 'Restore', showTrash: 'Playlist trash', unavailable: 'in trash · restore the song', up: 'Move up', down: 'Move down', remove: 'Remove from playlist', previous: 'Previous', next: 'Next', run: 'Play playlist', stop: 'Stop playlist', fork: 'conflict copy', help: 'Songs play in order with their own settings and count-in. Each song needs valid chords and a finite chorus count. There is a short pause between songs.', failed: 'Operation failed: ', limit: 'Up to 50 playlists including trash.' },
};

export function createPlaylistControls({ getLang, getSongSettings, onChange, onOpen, onRun, onStop, redraw }) {
  let entryId = null, page = 0, showTrash = false, expanded = false, message = '';
  let runButton, runStatus, currentRun, panelElement;
  const el = (tag, text = '') => { const node = document.createElement(tag); node.textContent = text; return node; };
  function updateRun(run) {
    currentRun = run;
    if (!runButton) return;
    const words = WORDS[getLang()];
    runButton.textContent = run ? words.stop : words.run;
    runButton.setAttribute('aria-pressed', String(Boolean(run)));
    runStatus.textContent = run ? `${run.index + 1} / ${run.queue.length}` : message;
  }
  return {
    setEntry(value) { entryId = value; },
    updateRun,
    updateSongTitle(songId, title) {
      const words = WORDS[getLang()];
      for (const node of panelElement?.querySelectorAll('[data-playlist-song]') ?? []) {
        if (node.dataset.playlistSong === songId) node.textContent = `${node.dataset.position}. ${title || words.untitled}${node.disabled ? ` · ${words.unavailable}` : ''}`;
      }
    },
    render({ library, currentSongId, blocked, run }) {
      const words = WORDS[getLang()], lists = library.playlists ?? [];
      const details = el('details'); details.className = 'playlist-panel'; details.open = expanded;
      details.addEventListener('toggle', () => { expanded = details.open; });
      details.append(el('summary', `${words.title} (${lists.filter(item => !item.deletedAt).length})`));
      const panel = el('div'); panelElement = panel; panel.className = 'playlist-content'; details.append(panel);
      function act(action) { try { message = ''; action(); } catch (error) { message = words.failed + error.message; redraw(); } }
      function button(label, id, action, disabled = false) {
        const node = el('button', label); node.type = 'button'; node.className = 'btn btn--secondary'; node.id = id; node.disabled = disabled; node.addEventListener('click', () => act(action)); return node;
      }
      function savePlaylist(playlist) {
        onStop();
        const playlists = lists.map(item => item.id === playlist.id ? playlist : item);
        onChange({ ...library, playlists, currentPlaylistId: playlist.deletedAt ? playlists.find(item => !item.deletedAt)?.id ?? null : playlist.id });
      }
      const toolbar = el('div'); toolbar.className = 'song-toolbar';
      toolbar.append(button(words.create, 'playlist-new', () => {
        if (lists.length >= PLAYLIST_LIMIT) throw new RangeError(words.limit);
        const playlist = newPlaylist(words.create); onStop(); entryId = null;
        onChange({ ...library, playlists: [...lists, playlist], currentPlaylistId: playlist.id });
      }, blocked));
      const label = el('label', words.title), chooser = el('select'); chooser.id = 'playlist-select';
      const active = lists.filter(item => !item.deletedAt);
      if (!active.length) { const option = el('option', words.choose); option.value = ''; chooser.append(option); }
      for (const playlist of active) {
        const option = el('option', (playlist.name || words.untitled) + (playlist.conflictOf ? ` · ${words.fork}` : '')); option.value = playlist.id; option.selected = playlist.id === library.currentPlaylistId; chooser.append(option);
      }
      chooser.disabled = blocked;
      chooser.addEventListener('change', () => { onStop(); entryId = null; onChange({ ...library, currentPlaylistId: chooser.value }); });
      label.append(chooser); panel.append(toolbar, label);
      const playlist = active.find(item => item.id === library.currentPlaylistId);
      runButton = runStatus = null;
      if (playlist) {
        const nameLabel = el('label', words.name), name = el('input'); name.id = 'playlist-name'; name.value = playlist.name; name.maxLength = 160; name.disabled = blocked;
        name.addEventListener('change', () => act(() => savePlaylist(revisePlaylist(playlist, { name: name.value })))); nameLabel.append(name); panel.append(nameLabel);
        toolbar.append(button(words.add, 'playlist-add-song', () => savePlaylist(addPlaylistSong(playlist, currentSongId, getSongSettings?.())), blocked || !currentSongId));
        toolbar.append(button(getLang()==='ru'?'Дубликат списка':'Duplicate playlist','playlist-duplicate',()=>{if(lists.length>=PLAYLIST_LIMIT)throw new RangeError(words.limit);const copy=newPlaylist(playlist.name+' ('+(getLang()==='ru'?'копия':'copy')+')',playlist.entries);onStop();onChange({...library,playlists:[...lists,copy],currentPlaylistId:copy.id});},blocked));
        toolbar.append(button(getLang()==='ru'?'Сет-лист TXT':'Setlist TXT','playlist-export-setlist',()=>{const text=[playlist.name,...playlist.entries.map((entry,i)=>{const doc=library.documents.find(item=>item.id===entry.songId);return `${i+1}. ${doc.draft.title||words.untitled} · ${entry.key!==undefined?(entry.key||doc.draft.key):(entry.settings?.targetKey||doc.draft.key)} · ${entry.settings?.bpm??doc.draft.bpm} BPM${doc.deletedAt?' · '+words.unavailable:''}`;})].join('\n');downloadFile(text,'metronom-setlist.txt','text/plain;charset=utf-8');}));
        toolbar.append(button(words.trash, 'playlist-trash', () => savePlaylist(revisePlaylist(playlist, { deletedAt: new Date().toISOString() })), blocked));
        const list = el('ol'); list.id = 'playlist-entries';
        const selectedIndex=playlist.entries.findIndex(entry=>entry.id===entryId);if(run&&selectedIndex>=0)page=Math.floor(selectedIndex/50);page=Math.max(0,Math.min(page,Math.floor(Math.max(0,playlist.entries.length-1)/50)));
        playlist.entries.slice(page*50,page*50+50).forEach((entry, visibleIndex) => {
          const index=page*50+visibleIndex;
          const doc = library.documents.find(item => item.id === entry.songId), row = el('li'); row.dataset.entryId = entry.id; row.className = 'playlist-entry';
          if (entry.id === entryId && doc.id === currentSongId) row.setAttribute('aria-current','true');
          const title = `${index + 1}. ${doc.draft.title || words.untitled}${doc.deletedAt ? ` · ${words.unavailable}` : ''}`;
          const open = button(title, '', () => { entryId = entry.id; onOpen(doc,entry,playlist.id); }, Boolean(doc.deletedAt)); open.dataset.action = 'open'; open.dataset.playlistSong = doc.id; open.dataset.position = index + 1; row.append(open);
          const keyLabel=el('label',getLang()==='ru'?'Тональность в плейлисте':'Playlist key'),key=el('select');key.dataset.action='key';key.setAttribute('aria-label',`${getLang()==='ru'?'Тональность':'Key'} · ${index+1}`);key.disabled=blocked;for(const value of ['',...KEY_NAMES]){const option=el('option',value||(getLang()==='ru'?'Исходная':'Original'));option.value=value;key.append(option);}key.value=entry.key??entry.settings?.targetKey??doc.settings.targetKey??'';key.addEventListener('change',()=>act(()=>savePlaylist(setPlaylistEntryKey(playlist,entry.id,key.value))));keyLabel.append(key);row.append(keyLabel);
          for (const [action, caption, handler, disabled] of [
            ['up',words.up,() => savePlaylist(movePlaylistEntry(playlist,entry.id,-1)),index === 0],
            ['down',words.down,() => savePlaylist(movePlaylistEntry(playlist,entry.id,1)),index === playlist.entries.length - 1],
            ['remove',words.remove,() => savePlaylist(removePlaylistEntry(playlist,entry.id)),false],
          ]) {
            const control = button(caption, '', handler, blocked || disabled); control.dataset.action = action; control.setAttribute('aria-label', `${caption} · ${index + 1}`); row.append(control);
          }
          list.append(row);
        });
        panel.append(list);
        if(playlist.entries.length>50){const pages=el('div');pages.className='song-toolbar';pages.append(button('‹','playlist-page-previous',()=>{page--;redraw();},page===0),el('span',`${page+1} / ${Math.ceil(playlist.entries.length/50)}`),button('›','playlist-page-next',()=>{page++;redraw();},(page+1)*50>=playlist.entries.length));panel.append(pages);}
        if (!playlist.entries.length) panel.append(el('p', words.empty));
        const navigation = el('div'); navigation.className = 'song-toolbar';
        const index = playlist.entries.findIndex(entry => entry.id === entryId && entry.songId === currentSongId);
        for (const [offset, caption, id] of [[-1,words.previous,'playlist-previous'],[1,words.next,'playlist-next']]) {
          const entry = playlist.entries[index + offset], doc = library.documents.find(item => item.id === entry?.songId && !item.deletedAt);
          navigation.append(button(caption,id,() => { entryId = entry.id; onOpen(doc,entry,playlist.id); },index < 0 || !doc));
        }
        runButton = button(words.run, 'playlist-play', () => currentRun ? onStop() : onRun(playlist), !playlist.entries.length);
        runStatus = el('p'); runStatus.id = 'playlist-status'; runStatus.setAttribute('role','status');
        navigation.append(runButton); panel.append(navigation, el('p',words.help),runStatus);
        updateRun(run);
      }
      const trashLabel = el('label'), trash = el('input'); trash.type = 'checkbox'; trash.id = 'playlist-show-trash'; trash.checked = showTrash;
      trash.addEventListener('change', () => { showTrash = trash.checked; redraw(); });
      trashLabel.append(trash,document.createTextNode(` ${words.showTrash} (${lists.filter(item => item.deletedAt).length})`)); panel.append(trashLabel);
      if (showTrash) {
        const trashList = el('div'); trashList.id = 'playlist-trash-list';
        for (const playlist of lists.filter(item => item.deletedAt)) {
          const row = el('div',playlist.name || words.untitled); row.className = 'song-toolbar'; row.dataset.playlistId = playlist.id;
          row.append(button(words.restore, '', () => savePlaylist(revisePlaylist(playlist,{deletedAt:null})),blocked)); trashList.append(row);
        }
        panel.append(trashList);
      }
      if (!playlist && message) panel.append(el('p',message));
      return details;
    },
  };
}
