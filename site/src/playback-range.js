import { ZERO,add,subtract } from './musical-time.js';
export function normalizeRange(input={}){return{enabled:input?.enabled===true,start:Number.isInteger(input?.start)&&input.start>=1?input.start:1,end:Number.isInteger(input?.end)&&input.end>=0?input.end:0};}
export function selectPlaybackRange(compiled,input={}){
 const range=normalizeRange(input);if(!range.enabled)return compiled;
 const total=compiled.playOrder.length,end=range.end||total;
 if(range.start>end||end>total)throw new RangeError('Playback range is outside the expanded form');
 const steps=compiled.steps.filter(step=>step.playbackBarIndex>=range.start-1&&step.playbackBarIndex<end);
 if(!steps.length)throw new RangeError('Empty playback range');
 const offset=steps[0].position,duration=steps.reduce((time,step)=>add(time,step.duration),ZERO);
 return{...compiled,steps:steps.map(step=>({...step,position:subtract(step.position,offset)})),duration,range:{start:range.start,end,total}};
}
export function createRangeControls({lang,range,total,selectedBar,onChange,onSelected}){
 const ru=lang==='ru',fieldset=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=ru?'Участок исполнения':'Playback range';fieldset.append(legend);
 const label=document.createElement('label'),enabled=document.createElement('input');label.className='check';enabled.type='checkbox';enabled.id='song-range-enabled';enabled.checked=range.enabled;enabled.addEventListener('change',()=>onChange({...range,enabled:enabled.checked}));label.append(enabled,document.createTextNode(ru?' Играть выбранный участок':' Play selected range'));fieldset.append(label);
 const fields=document.createElement('div');fields.className='song-fields';
 for(const[key,text]of[['start',ru?'С такта исполнения':'From playback bar'],['end',ru?'По такт исполнения':'To playback bar']]){
  const wrapper=document.createElement('label'),input=document.createElement('input');wrapper.textContent=text;input.type='number';input.min=1;input.max=total||1;input.id=`song-range-${key}`;input.value=range[key]||total||1;input.addEventListener('change',()=>onChange({...range,[key]:Number(input.value),enabled:true}));wrapper.append(input);fields.append(wrapper);
 }
 const selected=document.createElement('button');selected.type='button';selected.id='song-play-from-bar';selected.className='btn btn--secondary';selected.textContent=(ru?'С выбранного исходного такта ':'From selected source bar ')+(selectedBar+1);selected.addEventListener('click',onSelected);fieldset.append(fields,selected);const help=document.createElement('p');help.className='textbook-help';help.textContent=ru?'Номера относятся к развёрнутому порядку тактов. Круг повторяет выбранный участок; отсчёт берётся из его первого такта. Плейлист и экспорт используют полную композицию.':'Numbers refer to the expanded playback order. Each chorus repeats this range, with a count-in from its first bar. Playlists and export use the full song.';fieldset.append(help);return fieldset;
}
