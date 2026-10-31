import { exportIreal } from './ireal-export.js';
import { exportPerformance, encodeMidi } from './performance-export.js';
import { encodeMusicXml, printChart } from './chart-export.js';
import { renderWav } from './audio-export.js';
export function downloadFile(data, filename, type) {
  const url=URL.createObjectURL(new Blob([data],{type})), link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function createExportControls({getLang,getSong,getWritten,getConcert,getDraft,getOptions,stop}) {
  let busy=false,controller,output,status,cancel;
  const words=()=>getLang()==='ru'?{title:'Экспорт композиции',print:'Печать / PDF',busy:'Создание WAV…',cancel:'Отменить экспорт',done:'Файл готов',cancelled:'Экспорт отменён',failed:'Не удалось экспортировать: ',help:'MIDI и WAV: концертное звучание, полная форма, круги, тренировочные настройки и микшер. Нужны конечные круги. WAV — до 5 минут, MIDI — до 30 минут. Печать и MusicXML: текущая партия инструмента; MusicXML содержит аккордовую сетку с развёрнутой формой.'}:{title:'Export song',print:'Print / PDF',busy:'Rendering WAV…',cancel:'Cancel export',done:'File ready',cancelled:'Export cancelled',failed:'Could not export: ',help:'MIDI and WAV: concert pitch, full form, choruses, training settings and mixer. Finite choruses required. WAV: up to 5 minutes; MIDI: up to 30 minutes. Print and MusicXML use the current instrument part; MusicXML contains a chord chart with expanded form.'};
  let message='';
  function update(){if(!output)return;for(const button of output.querySelectorAll('[data-export]'))button.disabled=busy;cancel.hidden=!busy;status.textContent=busy?words().busy:message;}
  async function run(action){if(busy)return;message='';try{stop();await action();if(!message)message=words().done;}catch(error){message=error.name==='AbortError'?words().cancelled:words().failed+error.message;}finally{busy=false;update();}}
  return {render(){
    const w=words();output=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=w.title;output.append(legend);const row=document.createElement('div');row.className='song-toolbar';
    const filename=extension=>(getDraft().title.trim()||'metronom').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,120)+'.'+extension;
    for(const [name,label,action] of [
      ['print',w.print,()=>{printChart(getWritten(),getDraft(),getOptions().training.instrument);}],
      ['midi','MIDI',()=>downloadFile(encodeMidi(exportPerformance(getSong(),getOptions())),filename('mid'),'audio/midi')],
      ['wav','WAV',async()=>{const performance=exportPerformance(getSong(),getOptions(),300), target=filename('wav');busy=true;controller=new AbortController();update();await new Promise(resolve=>setTimeout(resolve,0));const bytes=await renderWav(performance,{signal:controller.signal});controller.signal.throwIfAborted();downloadFile(bytes,target,'audio/wav');}],
      ['ireal','iReal Pro',()=>downloadFile(exportIreal(getConcert(),getOptions().style),filename('html'),'text/html')],
      ['musicxml','MusicXML',()=>downloadFile(encodeMusicXml(getWritten()),filename('musicxml'),'application/vnd.recordare.musicxml+xml')],
    ]){const button=document.createElement('button');button.type='button';button.className='btn btn--secondary';button.textContent=label;button.id=`song-export-${name}`;button.dataset.export=name;button.addEventListener('click',()=>{void run(action);});row.append(button);}
    cancel=document.createElement('button');cancel.type='button';cancel.className='btn btn--secondary';cancel.id='song-export-cancel';cancel.textContent=w.cancel;cancel.addEventListener('click',()=>{controller?.abort();message=w.cancelled;update();});row.append(cancel);output.append(row);
    const help=document.createElement('p');help.className='textbook-help';help.textContent=w.help;status=document.createElement('p');status.id='song-export-status';status.setAttribute('role','status');output.append(help,status);update();return output;
  }};
}
