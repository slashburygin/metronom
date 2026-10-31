import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft } from '../site/src/song-draft.js';
import { newDocument, reviseDocument, validateLibrary, upgradeLibrary, mergeLibrary, exportLibrary, parseBackup } from '../site/src/song-library.js';
import { newPlaylist, revisePlaylist, addPlaylistSong, movePlaylistEntry, removePlaylistEntry, playlistQueue, PLAYLIST_ENTRY_LIMIT } from '../site/src/playlists.js';
const oldLibrary = (...documents) => ({ version: 1, documents, currentId: documents[0]?.id ?? null });
const library = (documents, playlists = []) => ({ ...upgradeLibrary(oldLibrary(...documents)), playlists, currentPlaylistId: playlists.find(item => !item.deletedAt)?.id ?? null });
const clone = structuredClone;

test('version two upgrade preserves songs and revisions and version one backups stay importable', () => {
  const doc = newDocument(newDraft(),{style:'rock'}), old = oldLibrary(doc), before = clone(old), upgraded = upgradeLibrary(old);
  assert.equal(upgraded.version,2); assert.deepEqual(upgraded.documents,[doc]); assert.deepEqual(upgraded.playlists,[]); assert.equal(upgraded.currentPlaylistId,null); assert.deepEqual(old,before);
  assert.deepEqual(upgradeLibrary(upgraded),upgraded);
  assert.deepEqual(parseBackup(exportLibrary(old)),old);
  const playlist = addPlaylistSong(newPlaylist('Set'),doc.id), source = library([doc],[playlist]);
  assert.deepEqual(parseBackup(exportLibrary(source)),source);
  assert.throws(()=>parseBackup(JSON.stringify({format:'metronom-library',version:1,library:source})),/format/);
  assert.throws(()=>validateLibrary({...old,playlists:[]}),/version 2/);
});

test('playlist entries have separate identities, preserve repeats and reorder only the chosen occurrence', () => {
  const a = newDocument(newDraft()), b = newDocument(newDraft());
  let playlist = newPlaylist('A B A');
  for(const doc of [a,b,a]) playlist = addPlaylistSong(playlist,doc.id);
  const original = clone(playlist), secondA = playlist.entries[2];
  assert.notEqual(playlist.entries[0].id,secondA.id);
  playlist = movePlaylistEntry(playlist,secondA.id,-1);
  assert.deepEqual(playlist.entries.map(e=>e.songId),[a.id,a.id,b.id]); assert.equal(playlist.entries[1].id,secondA.id); assert.deepEqual(original.entries.map(e=>e.songId),[a.id,b.id,a.id]);
  assert.equal(movePlaylistEntry(playlist,'missing',1),playlist);
  assert.equal(movePlaylistEntry(playlist,playlist.entries[0].id,-1),playlist);
  playlist = removePlaylistEntry(playlist,secondA.id);
  assert.deepEqual(playlist.entries.map(e=>e.songId),[a.id,b.id]);
  assert.deepEqual(playlistQueue(library([a,b],[playlist]),playlist.id).map(item=>item.document.id),[a.id,b.id]);
});

test('song edits remain visible through playlist references, trash retains positions and restore reuses identity', () => {
  const doc = newDocument(newDraft()); const playlist = addPlaylistSong(newPlaylist('Set'),doc.id);
  const edited = reviseDocument(doc,{draft:{...doc.draft,title:'Changed title'}});
  assert.equal(playlistQueue(library([edited],[playlist]),playlist.id)[0].document.draft.title,'Changed title');
  const trashed = reviseDocument(edited,{deletedAt:new Date().toISOString()}), source = library([trashed],[playlist]);
  assert.equal(validateLibrary(source),source); assert.throws(()=>playlistQueue(source,playlist.id),/trash/);
  const restored = reviseDocument(trashed,{deletedAt:null});
  assert.equal(playlistQueue(library([restored],[playlist]),playlist.id)[0].entryId,playlist.entries[0].id);
  assert.throws(()=>playlistQueue(library([doc],[newPlaylist('Empty')]),'missing'),/empty/);
});

test('invalid entry identities, broken references, unsupported versions and limits are rejected', () => {
  const doc = newDocument(newDraft()), playlist = addPlaylistSong(newPlaylist('Set'),doc.id), source = library([doc],[playlist]);
  for(const mutate of [
    p=>{p.entries.push(clone(p.entries[0]));}, p=>{p.entries[0].songId='missing';}, p=>{p.entries[0].id='';}, p=>{p.name=42;}, p=>{p.ancestors=[p.revision];}, p=>{p.deletedAt='bad';},
  ]) {const bad=clone(source);mutate(bad.playlists[0]);assert.throws(()=>validateLibrary(bad));}
  assert.throws(()=>validateLibrary({...source,version:3}));
  assert.throws(()=>validateLibrary({...source,currentPlaylistId:'missing'}));
  assert.throws(()=>validateLibrary({...source,playlists:[playlist,playlist]}));
  assert.throws(()=>validateLibrary(library([doc],Array.from({length:51},()=>newPlaylist('Set')))),/limit/);
  const full = newPlaylist('Full',Array.from({length:PLAYLIST_ENTRY_LIMIT},(_,i)=>({id:'entry-'+i,songId:doc.id})));
  assert.throws(()=>addPlaylistSong(full,doc.id),/limit/);
});

test('version one imports do not remove playlists and new playlists upgrade older libraries', () => {
  const doc = newDocument(newDraft()), playlist = addPlaylistSong(newPlaylist('Set'),doc.id), current = library([doc],[playlist]);
  assert.deepEqual(mergeLibrary(current,oldLibrary(doc)).library.playlists,[playlist]);
  assert.deepEqual(mergeLibrary(oldLibrary(doc),current).library.playlists,[playlist]);
});

test('playlist fast-forwards and divergent order edits retain both versions idempotently', () => {
  const a = newDocument(newDraft()), b = newDocument(newDraft());
  const original = addPlaylistSong(addPlaylistSong(newPlaylist('Set'),a.id),b.id);
  const left = revisePlaylist(original,{name:'Device A'}), right = movePlaylistEntry(original,original.entries[1].id,-1);
  const local = library([a,b],[left]), remote = library([a,b],[right]);
  assert.deepEqual(mergeLibrary(library([a,b],[original]),remote).library.playlists,[right]);
  assert.deepEqual(mergeLibrary(remote,library([a,b],[original])).library.playlists,[right]);
  const merged = mergeLibrary(local,remote);
  assert.equal(merged.conflicts,1); assert.deepEqual(local.playlists,[left]);
  const fork = merged.library.playlists.find(p=>p.conflictOf===original.id);
  assert.deepEqual(fork.entries,right.entries); assert.equal(fork.forkRevision,right.revision);
  assert.equal(mergeLibrary(merged.library,remote).library.playlists.length,2);
});

test('playlist deletion and restore are versioned and conflicting deletion does not erase an edit', () => {
  const doc = newDocument(newDraft()), original = addPlaylistSong(newPlaylist('Set'),doc.id);
  const trashed = revisePlaylist(original,{deletedAt:new Date().toISOString()}), removed=mergeLibrary(library([doc],[original]),library([doc],[trashed])).library;
  assert.equal(removed.currentPlaylistId,null);
  assert.ok(mergeLibrary(removed,library([doc],[original])).library.playlists[0].deletedAt);
  const changed = revisePlaylist(original,{name:'Offline edit'}), conflict=mergeLibrary(removed,library([doc],[changed]));
  assert.equal(conflict.conflicts,1); assert.equal(conflict.library.playlists.filter(p=>!p.deletedAt).length,1);
  const restored=revisePlaylist(trashed,{deletedAt:null});assert.equal(mergeLibrary(removed,library([doc],[restored])).library.currentPlaylistId,original.id);
});

test('playlist conflicts and invalid imports fail atomically without changing songs or local lists', () => {
  const doc = newDocument(newDraft()), playlist = newPlaylist('Set'), local = library([doc],[playlist]), before = clone(local);
  assert.throws(()=>mergeLibrary(local,library([doc],[{...playlist,name:'Forged revision'}])),/payload/); assert.deepEqual(local,before);
  const full = library([doc],Array.from({length:50},()=>newPlaylist('Set')));
  assert.throws(()=>mergeLibrary(full,local),/limit/); assert.equal(full.playlists.length,50);
  const missing = library([doc],[addPlaylistSong(newPlaylist('Missing'),'missing')]);
  assert.throws(()=>mergeLibrary(local,missing),/missing song/); assert.deepEqual(local,before);
});

test('each occurrence can keep an independent concert key without copying or modifying the song',async()=>{
 const {setPlaylistEntryKey}=await import('../site/src/playlists.js');const doc=newDocument(newDraft(),{targetKey:'F'});let playlist=addPlaylistSong(addPlaylistSong(newPlaylist('Vocal set'),doc.id),doc.id);const original=clone(doc);
 playlist=setPlaylistEntryKey(playlist,playlist.entries[0].id,'G');playlist=setPlaylistEntryKey(playlist,playlist.entries[1].id,'');assert.deepEqual(playlist.entries.map(e=>e.key),['G','']);assert.deepEqual(doc,original);validateLibrary(library([doc],[playlist]));assert.throws(()=>setPlaylistEntryKey(playlist,playlist.entries[0].id,'H'));
 const backup=parseBackup(exportLibrary(library([doc],[playlist])));assert.deepEqual(backup.playlists[0].entries,playlist.entries);
});

test('original exercise collection contains fifty valid exercises and repeated installation preserves local edits',async()=>{
 const {exerciseLibrary,restoreExercises}=await import('../site/src/exercise-library.js');const {compileDraft}=await import('../site/src/song-draft.js');const exercises=exerciseLibrary();assert.equal(exercises.length,50);for(const item of exercises)assert.ok(compileDraft(item.draft).compiled,item.id);
 const original=library([]),installed=restoreExercises(original),first=installed.documents[0];assert.equal(installed.documents.length,50);assert.equal(installed.playlists[0].entries.length,50);const edited=reviseDocument(first,{draft:{...first.draft,title:'My variation'}});installed.documents[0]=edited;const again=restoreExercises(installed);assert.equal(again.documents.length,50);assert.equal(again.documents[0].draft.title,'My variation');assert.equal(original.documents.length,0);
});

test('playlist performance settings are snapshots and edits conflict without changing the song',()=>{
 const doc=newDocument(newDraft(),{style:'swing',repeats:1}),settings={style:'ballad',bpm:75,repeats:2,sound:{pianoTone:'organ'}};let original=addPlaylistSong(newPlaylist('Vocal set'),doc.id,settings);settings.bpm=200;assert.equal(original.entries[0].settings.bpm,75);
 const left=revisePlaylist(original,{entries:original.entries.map(entry=>({...entry,settings:{...entry.settings,bpm:90}}))}),right=revisePlaylist(original,{entries:original.entries.map(entry=>({...entry,settings:{...entry.settings,style:'rock'}}))});const merged=mergeLibrary(library([doc],[left]),library([doc],[right]));assert.equal(merged.conflicts,1);assert.equal(merged.library.documents[0].draft.bpm,120);assert.equal(merged.library.documents[0].settings.style,'swing');const invalid=library([doc],[{...original,entries:original.entries.map(entry=>({...entry,settings:{bpm:999}}))}]);assert.throws(()=>validateLibrary(invalid),/settings/);
});
