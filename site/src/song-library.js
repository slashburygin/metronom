import { loadDrafts } from './song-draft.js';

export const LIBRARY_LIMIT = 100;
export const BACKUP_LIMIT = 10 * 1024 * 1024;
export function libraryId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
const clone = value => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 512;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const canonical = value => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);

export function newDocument(draft, settings = {}, documentId = libraryId()) {
  return { id: documentId, draft: clone(draft), settings: clone(settings), revision: libraryId(), ancestors: [], updatedAt: now(), deletedAt: null };
}

export function reviseDocument(doc, changes) {
  const next = { ...doc, ...changes };
  if (['draft','settings','deletedAt'].every(key => JSON.stringify(next[key]) === JSON.stringify(doc[key]))) return doc;
  return { ...next, id: doc.id, revision: libraryId(), ancestors: [doc.revision, ...doc.ancestors].slice(0,100), updatedAt: now() };
}

export function validateLibrary(data) {
  loadDrafts({ getItem: () => JSON.stringify(data) });
  if (data.currentId !== null && !id(data.currentId)) throw new RangeError('Invalid current song');
  for (const doc of data.documents) {
    if (!id(doc.id) || !id(doc.revision) || !Array.isArray(doc.ancestors) || doc.ancestors.length > 100 || !doc.ancestors.every(id)
      || new Set([doc.revision,...doc.ancestors]).size !== doc.ancestors.length + 1 || !timestamp(doc.updatedAt)
      || (doc.deletedAt !== null && !timestamp(doc.deletedAt)) || !object(doc.settings) || JSON.stringify(doc.settings).length > 20000
      || (doc.conflictOf !== undefined && !id(doc.conflictOf)) || (doc.forkRevision !== undefined && !id(doc.forkRevision))) throw new RangeError('Invalid song revision');
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
  const text = JSON.stringify({ format: 'metronom-library', version: 1, exportedAt: now(), library }, null, 2);
  if (new TextEncoder().encode(text).length > BACKUP_LIMIT) throw new RangeError('Backup exceeds 10 MB');
  return text;
}

export function parseBackup(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > BACKUP_LIMIT) throw new RangeError('Backup exceeds 10 MB');
  const data = JSON.parse(text);
  if (data?.format !== 'metronom-library' || data.version !== 1) throw new RangeError('Unsupported backup format');
  return validateLibrary(data.library);
}

// Revision ancestry, rather than device wall clocks, decides fast-forward.
// Divergent edits/deletions produce a separate recoverable record.
export function mergeLibrary(local, incoming) {
  validateLibrary(local); validateLibrary(incoming);
  const library = clone(local), report = { added: 0, updated: 0, conflicts: 0 };
  for (const remote of incoming.documents) {
    const index = library.documents.findIndex(doc => doc.id === remote.id);
    if (index < 0) { library.documents.push(clone(remote)); report.added++; continue; }
    const current = library.documents[index];
    if (current.revision === remote.revision) {
      if (canonical(current) !== canonical(remote)) throw new RangeError('Revision payload mismatch');
      continue;
    }
    if (current.ancestors.includes(remote.revision)) continue;
    if (remote.ancestors.includes(current.revision)) { library.documents[index] = clone(remote); report.updated++; continue; }
    if (library.documents.some(doc => doc.conflictOf === remote.id && doc.forkRevision === remote.revision)) continue;
    const fork = newDocument(remote.draft, remote.settings);
    library.documents.push({ ...fork, deletedAt: remote.deletedAt, conflictOf: remote.id, forkRevision: remote.revision });
    report.conflicts++;
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
