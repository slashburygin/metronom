import { libraryId, migrateLegacy, validateLibrary, mergeLibrary } from './song-library.js';

export const LIBRARY_DB = 'metronom-library';
export const RECOVERY_PREFIX = 'metronom-library-recovery:';
export class LibraryConflictError extends Error {}

function transaction(db, mode, update = value => value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('library', mode), store = tx.objectStore('library');
    let result, failure;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Library transaction aborted'));
    tx.onerror = () => {}; // Abort owns the rejection; request success is not a commit.
    const request = store.get('root');
    request.onsuccess = () => {
      try { result = update(request.result); if (mode === 'readwrite') store.put(result, 'root'); }
      catch (error) { failure = error; tx.abort(); }
    };
  });
}

function openDatabase(factory) {
  return new Promise((resolve, reject) => {
    const request = factory.open(LIBRARY_DB, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('Database upgrade blocked by another tab')); };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

function validateRoot(root) {
  if (root?.schema !== 1 || !Number.isSafeInteger(root.sequence) || root.sequence < 0) throw new RangeError('Unsupported library schema');
  validateLibrary(root.library);
  return root;
}

export async function openLibrary({ factory = indexedDB, storage = localStorage } = {}) {
  const db = await openDatabase(factory);
  try {
    let root = await transaction(db, 'readonly');
    if (root === undefined) {
      const migrated = migrateLegacy(storage);
      root = await transaction(db, 'readwrite', existing => existing ?? { schema: 1, sequence: 0, library: migrated });
    }
    validateRoot(root);
    const pending = [];
    let recoveryWarning = false;
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(RECOVERY_PREFIX)) continue;
        try { pending.push({ key, library: validateLibrary(JSON.parse(storage.getItem(key)).library) }); }
        catch { recoveryWarning = true; } // Preserve unreadable recovery data.
      }
    } catch { /* IndexedDB remains usable without a localStorage recovery journal. */ }
    if (pending.length) {
      root = await transaction(db, 'readwrite', existing => {
        validateRoot(existing);
        let library = existing.library;
        for (const item of pending) library = mergeLibrary(library, item.library).library;
        return { ...existing, sequence: existing.sequence + 1, library };
      });
      for (const item of pending) try { storage.removeItem(item.key); } catch {}
    }
    const journalKey = RECOVERY_PREFIX + libraryId();
    let sequence = root.sequence, queue = Promise.resolve();
    return {
      library: root.library, recoveryWarning, recovered: pending.length,
      save(library) {
        const snapshot = structuredClone(validateLibrary(library)), token = libraryId();
        try { storage.setItem(journalKey, JSON.stringify({ token, library: snapshot })); } catch {}
        const write = queue.catch(() => {}).then(async () => {
          const result = await transaction(db, 'readwrite', existing => {
            validateRoot(existing);
            if (existing.sequence !== sequence) throw new LibraryConflictError('Library changed in another tab');
            return { ...existing, sequence: sequence + 1, library: snapshot };
          });
          sequence = result.sequence;
          try { if (JSON.parse(storage.getItem(journalKey))?.token === token) storage.removeItem(journalKey); } catch {}
        });
        queue = write;
        return write;
      },
      close() { db.close(); },
    };
  } catch (error) { db.close(); throw error; }
}
