import { parseIreal } from './ireal-import.js';
import { newDocument,validateLibrary,LIBRARY_LIMIT,BACKUP_LIMIT } from './song-library.js';
import { newPlaylist,addPlaylistSong,PLAYLIST_LIMIT } from './playlists.js';
const fingerprint=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
export async function mergeIrealSelection(library,parsed,selected) {
 const next=structuredClone(library),ids=[],report={added:0,existing:0};
 for(const index of selected){const item=parsed.songs[index];if(!item?.draft)throw new RangeError('Unsupported song cannot be imported');const hash=await fingerprint(item.source);let doc=next.documents.find(doc=>doc.settings.sourceFingerprint===hash);
  if(doc)report.existing++;else{doc=newDocument(item.draft,{...item.settings,sourceFingerprint:hash});next.documents.push(doc);report.added++;}if(!doc.deletedAt)ids.push(doc.id);
 }
 if(next.documents.length>LIBRARY_LIMIT)throw new RangeError('Library exceeds 5000 songs');
 if(ids.length){const hash=await fingerprint(JSON.stringify(ids));if(!next.playlists.some(item=>item.sourceFingerprint===hash)){
   if(next.playlists.length>=PLAYLIST_LIMIT)throw new RangeError('Playlist limit exceeded');let playlist=newPlaylist(parsed.name||'iReal import');for(const id of ids)playlist=addPlaylistSong(playlist,id,(()=>{const doc=next.documents.find(item=>item.id===id);return{...doc.settings,bpm:doc.draft.bpm};})());playlist.sourceFingerprint=hash;next.playlists.push(playlist);next.currentPlaylistId=playlist.id;
  }next.currentId=ids[0];}
 return{library:validateLibrary(next),...report};
}
export function openIrealImport({lang='ru',onImport}) {
 const ru=lang==='ru',dialog=document.createElement('dialog');dialog.className='chord-reference ireal-import';dialog.setAttribute('aria-label',ru?'Импорт iReal Pro':'Import iReal Pro');let parsed,checks=[];
 const el=(tag,text='')=>{const node=document.createElement(tag);node.textContent=text;return node;},title=el('h2',ru?'Импорт iReal Pro':'Import iReal Pro'),close=el('button',ru?'Закрыть':'Close');close.type='button';close.className='btn btn--secondary';close.addEventListener('click',()=>dialog.close());dialog.append(title,close);dialog.addEventListener('close',()=>dialog.remove());
 const help=el('p',ru?'Откройте HTML-файл, экспортированный из iReal Pro, или вставьте ссылку irealb:// / irealbook://. Перед импортом проверьте предупреждения и порядок тактов. Исходный файл не изменяется.':'Open an HTML file exported from iReal Pro, or paste an irealb:// / irealbook:// link. Review warnings and playback order before import. The source file is unchanged.');
 const file=el('input');file.type='file';file.accept='.html,.htm,.txt,text/html,text/plain';file.id='ireal-file';const text=el('textarea');text.id='ireal-url';text.rows=4;text.setAttribute('aria-label',ru?'Ссылка iReal':'iReal link');
 const parse=el('button',ru?'Проверить файл / ссылку':'Preview file / link');parse.id='ireal-preview';parse.type='button';parse.className='btn btn--secondary';const output=el('div');output.id='ireal-preview-list';const status=el('p');status.id='ireal-import-status';status.setAttribute('role','status');const apply=el('button',ru?'Импортировать выбранные':'Import selected');apply.id='ireal-apply';apply.type='button';apply.className='btn btn--primary';apply.disabled=true;
 let busy=false;
 parse.addEventListener('click',async()=>{if(busy)return;try{let source=text.value;if(file.files[0]){if(file.files[0].size>BACKUP_LIMIT)throw new RangeError('File exceeds 50 MB');source=await file.files[0].text();}parsed=parseIreal(source);output.replaceChildren();checks=[];let supported=0;parsed.songs.forEach((song,index)=>{const row=el('label'),check=el('input');check.type='checkbox';check.checked=Boolean(song.draft);check.disabled=!song.draft;check.dataset.index=index;row.append(check,document.createTextNode(' '+(song.draft?.title||song.title)));if(song.draft)supported++;const details=el('p',song.error||song.warnings.join(' '));row.append(details);output.append(row);checks.push(check);});status.textContent=`${supported} / ${parsed.songs.length} · ${ru?'доступно для импорта':'supported'}`;apply.disabled=!supported;}catch(error){status.textContent=error.message;apply.disabled=true;}});
 apply.addEventListener('click',async()=>{if(busy)return;busy=true;apply.disabled=parse.disabled=close.disabled=true;try{const selected=checks.filter(check=>check.checked&&!check.disabled).map(check=>Number(check.dataset.index));if(!selected.length)throw new RangeError(ru?'Выберите композиции.':'Select songs.');const report=await onImport(parsed,selected);status.textContent=`${ru?'Добавлено / уже в библиотеке':'Added / already in library'}: ${report.added} / ${report.existing}`;}catch(error){status.textContent=error.message;}finally{busy=false;apply.disabled=parse.disabled=close.disabled=false;}});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.append(help,file,text,parse,status,output,apply);document.body.append(dialog);dialog.showModal();text.focus();return dialog;
}
