import { loadDrafts, validateDraftCollection } from './song-draft.js';

export const LIBRARY_LIMIT = 5000;
export const BACKUP_LIMIT = 50 * 1024 * 1024;
export { libraryId } from './library-revisions.js';
import { clone, libraryId, validId as id, revisionMetadata, reviseRecord, validateRevision, mergeRecords } from './library-revisions.js';
import { newPlaylist, validatePlaylists } from './playlists.js';
const object = value => value && typeof value === 'object' && !Array.isArray(value);

export function newDocument(draft, settings = {}, documentId = libraryId()) {
  return { id: documentId, draft: clone(draft), settings: clone(settings), ...revisionMetadata() };
}

export function reviseDocument(doc, changes) {
  return reviseRecord(doc, changes, ['draft','settings','deletedAt']);
}

export function validateLibrary(data) {
  if (![1,2].includes(data?.version)) throw new RangeError('Unsupported library version');
  validateDraftCollection({ ...data, version: 1 }, data.version === 2 ? LIBRARY_LIMIT : 100);
  if (data.version === 2) {
    validatePlaylists(data.playlists, data.documents);
    if (data.currentPlaylistId !== null && (!id(data.currentPlaylistId) || !data.playlists.some(item => item.id === data.currentPlaylistId))) throw new RangeError('Invalid current playlist');
  } else if (data.playlists !== undefined || data.currentPlaylistId !== undefined) throw new RangeError('Playlists require library version 2');
  if (data.currentId !== null && !id(data.currentId)) throw new RangeError('Invalid current song');
  for (const doc of data.documents) {
    validateRevision(doc);
    if (!object(doc.settings) || JSON.stringify(doc.settings).length > 20000) throw new RangeError('Invalid song settings');
    const draft = doc.draft;
    if ([draft.title,draft.composer,draft.key].some(text => text.length > 1000)) throw new RangeError('Song metadata too long');
    for (const section of draft.sections) {
      if (section.name.length > 1000) throw new RangeError('Section name too long');
      for (const measure of section.measures) if (Object.values(measure).some(value => typeof value === 'string' && value.length > 10000)) throw new RangeError('Measure text too long');
    }
  }
  return data;
}

export function migrateLegacy(storage) {
  const legacy = loadDrafts(storage);
  return validateLibrary({ ...legacy, currentId: legacy.currentId ?? null, documents: legacy.documents.map(doc => {
    let settings = {};
    try { const value = JSON.parse(storage.getItem(`metronome-song-training:${doc.id}`)); if (object(value)) settings = value; } catch { /* Raw legacy settings remain in storage. */ }
    return newDocument(doc.draft, settings, doc.id);
  }) });
}

export function exportLibrary(library) {
  validateLibrary(library);
  const text = JSON.stringify({ format: 'metronom-library', version: library.version, exportedAt: new Date().toISOString(), library }, null, 2);
  if (new TextEncoder().encode(text).length > BACKUP_LIMIT) throw new RangeError('Backup exceeds 50 MB');
  return text;
}

export function parseBackup(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > BACKUP_LIMIT) throw new RangeError('Backup exceeds 50 MB');
  const data = JSON.parse(text);
  if (data?.format !== 'metronom-library' || ![1,2].includes(data.version) || data.library?.version !== data.version) throw new RangeError('Unsupported backup format');
  return validateLibrary(data.library);
}

// Revision ancestry, rather than device wall clocks, decides fast-forward.
// Divergent edits/deletions produce a separate recoverable record.
export function mergeLibrary(local, incoming) {
  validateLibrary(local); validateLibrary(incoming);
  const upgraded = local.version === 2 || incoming.version === 2;
  const library = upgraded ? upgradeLibrary(local) : clone(local);
  const songs = mergeRecords(local.documents, incoming.documents, remote => newDocument(remote.draft, remote.settings));
  library.documents = songs.records;
  const report = { added: songs.added, updated: songs.updated, conflicts: songs.conflicts };
  if (upgraded) {
    const playlists = mergeRecords(local.playlists ?? [], incoming.playlists ?? [], remote => newPlaylist(remote.name, remote.entries));
    library.playlists = playlists.records;
    for (const key of ['added','updated','conflicts']) report[key] += playlists[key];
    if (!library.playlists.some(item => item.id === library.currentPlaylistId && !item.deletedAt)) library.currentPlaylistId = library.playlists.find(item => !item.deletedAt)?.id ?? null;
  }
  if (library.documents.length > LIBRARY_LIMIT) throw new RangeError('Library limit exceeded');
  const active = library.documents.filter(doc => !doc.deletedAt);
  library.currentId = active.find(doc => doc.id === library.currentId)?.id ?? active[0]?.id ?? null;
  return { library: validateLibrary(library), ...report };
}

export function findSongs(library, query = '', deleted = false) {
  const needle = query.trim().toLocaleLowerCase();
  return library.documents.filter(doc => Boolean(doc.deletedAt) === deleted &&
    [doc.draft.title,doc.draft.composer,doc.draft.key].join(' ').toLocaleLowerCase().includes(needle));
}

// Version 1 remains importable. Version 2 is rejected by older clients rather than silently losing playlists.
export function upgradeLibrary(library) {
  validateLibrary(library);
  return library.version === 2 ? clone(library) : { ...clone(library), version: 2, playlists: [], currentPlaylistId: null };
}
