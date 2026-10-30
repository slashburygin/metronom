import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, DRAFT_STORAGE } from '../site/src/song-draft.js';
import { newDocument, reviseDocument, migrateLegacy, validateLibrary, exportLibrary, parseBackup, mergeLibrary, findSongs, BACKUP_LIMIT } from '../site/src/song-library.js';

const library = (...documents) => ({ version: 1, documents, currentId: documents.find(doc => !doc.deletedAt)?.id ?? null });
const clone = value => structuredClone(value);

test('migration keeps ids, raw invalid drafts and settings without writing legacy storage', () => {
  const draft = newDraft(); draft.sections[0].measures[0].form = 'incomplete'; draft.sections[0].measures[1].chords = 'unknown';
  const old = { version: 1, currentId: 'legacy', documents: [{ id: 'legacy', draft }] };
  const settings = { instrument: 'Eb', style: 'bossa', seed: 42, sound: { pianoTone: 'organ', reverb: 0.5 }, arrangement: { colors: true } };
  const storage = { getItem: key => key === DRAFT_STORAGE ? JSON.stringify(old) : JSON.stringify(settings) };
  const migrated = migrateLegacy(storage);
  assert.equal(migrated.currentId, 'legacy');
  assert.deepEqual(migrated.documents[0].draft, draft); assert.deepEqual(migrated.documents[0].settings, settings);
  assert.ok(migrated.documents[0].revision); assert.deepEqual(migrated.documents[0].ancestors, []);
  assert.throws(() => migrateLegacy({ getItem: () => '{' }));
});

test('revisions change only with payloads and retain bounded ancestry', () => {
  let doc = newDocument(newDraft()); const first = doc.revision;
  assert.equal(reviseDocument(doc, { draft: clone(doc.draft) }), doc);
  for (let i = 0; i < 110; i++) { const draft = clone(doc.draft); draft.title = 'Edit ' + i; doc = reviseDocument(doc, { draft }); }
  assert.equal(doc.ancestors.length, 100); assert.equal(doc.ancestors.includes(first), false);
  assert.equal(new Set([doc.revision,...doc.ancestors]).size, 101);
});

test('backup round-trip includes settings, revisions, invalid text and trash', () => {
  const draft = newDraft(); draft.key = 'unfinished'; draft.sections[0].measures[0].chords = 'invalid';
  const a = newDocument(draft, { countIn: false, sound: { reverb: 1 } }), b = newDocument(newDraft());
  const trashed = reviseDocument(b, { deletedAt: new Date().toISOString() });
  const source = library(a,trashed);
  assert.deepEqual(parseBackup(exportLibrary(source)), source);
  for (const text of ['{', '{}', JSON.stringify({format:'other',version:1}), ' '.repeat(BACKUP_LIMIT+1)]) assert.throws(() => parseBackup(text));
  for (const edit of [doc => { doc.revision = ''; }, doc => { doc.ancestors = [doc.revision]; }, doc => { doc.settings = []; }, doc => { doc.deletedAt = 'bad'; }, doc => { doc.draft.sections = []; }]) {
    const invalid = clone(source); edit(invalid.documents[0]); assert.throws(() => validateLibrary(invalid));
  }
});

test('merge fast-forwards descendants and ignores old or repeated backups', () => {
  const a = newDocument(newDraft()), draft = clone(a.draft); draft.title = 'New version';
  const b = reviseDocument(a, { draft }), settings = { sound: { pianoTone: 'organ' } };
  const c = reviseDocument(b, { settings });
  assert.deepEqual(mergeLibrary(library(a), library(c)).library.documents, [c]);
  assert.deepEqual(mergeLibrary(library(c), library(a)).library.documents, [c]);
  const repeated = mergeLibrary(library(c), parseBackup(exportLibrary(library(c))));
  assert.equal(repeated.added + repeated.updated + repeated.conflicts, 0);
  // Object key order is not part of a version's identity.
  const reordered = Object.fromEntries(Object.entries(c).reverse());
  assert.equal(mergeLibrary(library(c), library(reordered)).conflicts, 0);
});

test('divergent device edits retain both versions and repeated imports do not duplicate forks', () => {
  const original = newDocument(newDraft());
  const leftDraft = clone(original.draft), rightDraft = clone(original.draft); leftDraft.title = 'Device A'; rightDraft.title = 'Device B';
  const left = reviseDocument(original, { draft: leftDraft }), right = reviseDocument(original, { draft: rightDraft });
  const merged = mergeLibrary(library(left), library(right));
  assert.equal(merged.conflicts, 1); assert.equal(merged.library.documents.length, 2);
  assert.equal(merged.library.documents[0].draft.title, 'Device A');
  const fork = merged.library.documents[1]; assert.equal(fork.draft.title, 'Device B'); assert.notEqual(fork.id, original.id);
  assert.equal(fork.conflictOf, original.id); assert.equal(fork.forkRevision, right.revision);
  assert.equal(mergeLibrary(merged.library, library(right)).library.documents.length, 2);
  assert.equal(library(left).documents.length, 1);
});

test('trash and restore synchronize as versioned changes; concurrent edits survive deletion', () => {
  const original = newDocument(newDraft()), trashed = reviseDocument(original, { deletedAt: new Date().toISOString() });
  const removed = mergeLibrary(library(original), library(trashed));
  assert.equal(removed.library.currentId, null); assert.ok(removed.library.documents[0].deletedAt);
  assert.equal(mergeLibrary(removed.library, library(original)).library.currentId, null);
  const restored = reviseDocument(trashed, { deletedAt: null });
  assert.equal(mergeLibrary(removed.library, library(restored)).library.currentId, original.id);
  const draft = clone(original.draft); draft.title = 'Offline edit';
  const divergent = reviseDocument(original, { draft });
  const conflict = mergeLibrary(removed.library, library(divergent));
  assert.equal(conflict.conflicts, 1); assert.equal(conflict.library.documents.filter(doc => !doc.deletedAt).length, 1);
  assert.equal(conflict.library.documents.find(doc => !doc.deletedAt).draft.title, 'Offline edit');
});

test('invalid revisions and oversized merges fail atomically', () => {
  const doc = newDocument(newDraft()), local = library(doc), before = clone(local);
  const forged = clone(doc); forged.draft.title = 'Same revision, different payload';
  assert.throws(() => mergeLibrary(local, library(forged)), /payload/); assert.deepEqual(local,before);
  const full = library(...Array.from({length:100}, () => newDocument(newDraft())));
  assert.throws(() => mergeLibrary(full, local), /limit/); assert.equal(full.documents.length, 100);
  const duplicate = library(doc,doc); assert.throws(() => validateLibrary(duplicate));
});

test('search covers title composer and key while trash stays separate', () => {
  const draft = newDraft(); draft.title = 'Осенний блюз'; draft.composer = 'Composer'; draft.key = 'B♭';
  const a = newDocument(draft), b = reviseDocument(newDocument(draft), { deletedAt: new Date().toISOString() });
  const source = library(a,b);
  for (const query of ['ОСЕННИЙ','composer','B♭']) assert.deepEqual(findSongs(source, query).map(doc => doc.id), [a.id]);
  assert.deepEqual(findSongs(source, '', true).map(doc => doc.id), [b.id]); assert.equal(findSongs(source,'missing').length, 0);
});
