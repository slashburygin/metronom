import { KEY_NAMES } from './transposition.js';
import { clone, libraryId, revisionMetadata, reviseRecord, validId, validateRevision } from './library-revisions.js';

export const PLAYLIST_LIMIT = 50;
export const PLAYLIST_ENTRY_LIMIT = 5000;
export function newPlaylist(name = '', entries = []) {
  return { id: libraryId(), name, entries: clone(entries), ...revisionMetadata() };
}
export function revisePlaylist(playlist, changes) {
  return reviseRecord(playlist, changes, ['name','entries','deletedAt']);
}
export function validatePlaylists(playlists, documents) {
  if (!Array.isArray(playlists) || playlists.length > PLAYLIST_LIMIT || new Set(playlists.map(item => item?.id)).size !== playlists.length) throw new RangeError('Invalid playlists or playlist limit exceeded');
  const songs = new Set(documents.map(doc => doc.id));
  for (const playlist of playlists) {
    if (!playlist || typeof playlist.name !== 'string' || playlist.name.length > 1000 || !Array.isArray(playlist.entries) || playlist.entries.length > PLAYLIST_ENTRY_LIMIT) throw new RangeError('Invalid playlist');
    validateRevision(playlist);
    const ids = new Set();
    for (const entry of playlist.entries) {
      if (entry?.settings !== undefined && (!entry.settings || typeof entry.settings !== 'object' || Array.isArray(entry.settings) || JSON.stringify(entry.settings).length > 20000 || (entry.settings.bpm !== undefined && (!Number.isFinite(entry.settings.bpm) || entry.settings.bpm < 30 || entry.settings.bpm > 300)))) throw new RangeError('Invalid playlist settings');
      if (!entry || !validId(entry.id) || !validId(entry.songId) || !songs.has(entry.songId) || ids.has(entry.id) || (entry.key !== undefined && entry.key !== '' && !KEY_NAMES.includes(entry.key))) throw new RangeError('Invalid playlist entry or missing song');
      ids.add(entry.id);
    }
  }
}
export function addPlaylistSong(playlist, songId, settings) {
  if (!validId(songId) || playlist.entries.length >= PLAYLIST_ENTRY_LIMIT) throw new RangeError('Playlist entry limit exceeded');
  return revisePlaylist(playlist, { entries: [...playlist.entries, { id: libraryId(), songId, ...(settings?{settings:clone(settings)}:{}) }] });
}
export function movePlaylistEntry(playlist, entryId, offset) {
  const from = playlist.entries.findIndex(entry => entry.id === entryId), to = from + offset;
  if (from < 0 || !Number.isInteger(offset) || to < 0 || to >= playlist.entries.length) return playlist;
  const entries = clone(playlist.entries), [entry] = entries.splice(from, 1); entries.splice(to, 0, entry);
  return revisePlaylist(playlist, { entries });
}
export function removePlaylistEntry(playlist, entryId) {
  return revisePlaylist(playlist, { entries: playlist.entries.filter(entry => entry.id !== entryId) });
}
export function playlistQueue(library, playlistId) {
  const playlist = library.playlists?.find(item => item.id === playlistId && !item.deletedAt);
  if (!playlist?.entries.length) throw new RangeError('Playlist is empty');
  return playlist.entries.map(entry => {
    const document = library.documents.find(doc => doc.id === entry.songId && !doc.deletedAt);
    if (!document) throw new RangeError('Playlist contains a song in trash');
    return { entryId: entry.id, document, settings: entry.settings, key: entry.key };
  });
}

export function setPlaylistEntryKey(playlist,entryId,key) {
  if(key!==''&&!KEY_NAMES.includes(key))throw new RangeError('Invalid playlist key');
  return revisePlaylist(playlist,{entries:playlist.entries.map(entry=>entry.id===entryId?{...entry,key}:entry)});
}
