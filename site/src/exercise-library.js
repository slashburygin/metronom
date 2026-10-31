import { scaleHarmony, MAJOR_KEYS, MINOR_KEYS } from './harmony.js';
import { practiceChords } from './accompaniment.js';
import { newDocument, reviseDocument, validateLibrary, LIBRARY_LIMIT } from './song-library.js';
import { newPlaylist,revisePlaylist,addPlaylistSong,PLAYLIST_LIMIT } from './playlists.js';
export function exerciseLibrary(lang='ru') {
 const ru=lang==='ru',items=[];
 for(const [form,type,label]of[['cadence','major','ii–V–I'],['cadence','naturalMinor','iiø–V–i'],['majorBlues','major',ru?'Мажорный блюз':'Major blues'],['minorBlues','naturalMinor',ru?'Минорный блюз':'Minor blues']]){
  for(const key of type==='major'?MAJOR_KEYS:MINOR_KEYS){const harmony=scaleHarmony(key,type),id=`exercise-${form}-${type}-${key}`,draft={title:`${label} · ${key}${type==='major'?'':'m'}`,composer:'Metronom',key:key+(type==='major'?'':'m'),bpm:100,sections:[{name:'A',measures:practiceChords(harmony,form).map(chord=>({meter:'4/4',chords:chord.symbol,alternate:'',text:'',form:''}))}]};items.push({id,draft});}
 }
 for(const [minor,label]of[[false,ru?'Круг доминант':'Dominant cycle'],[true,ru?'Минорный круг':'Minor cycle']]){const keys=Array.from({length:12},(_,i)=>(minor?MINOR_KEYS:MAJOR_KEYS)[i*5%12]),draft={title:label,composer:'Metronom',key:'C'+(minor?'m':''),bpm:100,sections:[{name:'A',measures:keys.map(key=>({meter:'4/4',chords:key+(minor?'m7':'7'),alternate:'',text:'',form:''}))}]};items.push({id:`exercise-circle-${minor?'minor':'dominant'}`,draft});}
 return items;
}
export function restoreExercises(library,lang='ru') {
 const next=structuredClone(library),ids=[];
 for(const item of exerciseLibrary(lang)){let doc=next.documents.find(doc=>doc.settings.exerciseId===item.id);if(!doc){doc=newDocument(item.draft,{style:'swing',repeats:1,countIn:true,exerciseId:item.id});next.documents.push(doc);}if(doc.deletedAt){doc=reviseDocument(doc,{deletedAt:null});next.documents[next.documents.findIndex(item=>item.id===doc.id)]=doc;}ids.push(doc.id);}
 if(next.documents.length>LIBRARY_LIMIT)throw new RangeError('Library exceeds 5000 songs');
 let playlist=next.playlists.find(item=>item.exerciseSet==='metronom-50');if(!playlist){if(next.playlists.length>=PLAYLIST_LIMIT)throw new RangeError('Playlist limit exceeded');playlist=newPlaylist(lang==='ru'?'50 упражнений Metronom':'50 Metronom exercises');for(const id of ids)playlist=addPlaylistSong(playlist,id,(()=>{const doc=next.documents.find(item=>item.id===id);return{...doc.settings,bpm:doc.draft.bpm};})());playlist.exerciseSet='metronom-50';next.playlists.push(playlist);}else{playlist=revisePlaylist(playlist,{deletedAt:null});for(const id of ids)if(!playlist.entries.some(entry=>entry.songId===id))playlist=addPlaylistSong(playlist,id,(()=>{const doc=next.documents.find(item=>item.id===id);return{...doc.settings,bpm:doc.draft.bpm};})());next.playlists[next.playlists.findIndex(item=>item.id===playlist.id)]=playlist;}next.currentPlaylistId=playlist.id;next.currentId=ids[0]??next.currentId;return validateLibrary(next);
}
