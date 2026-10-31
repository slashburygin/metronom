import { chordReference, chordFingerings } from './chord-reference.js';
const ns='http://www.w3.org/2000/svg';
function svgNode(tag,attrs,text){const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text)node.textContent=text;return node;}
export function openChordReference(symbol,lang='ru') {
 const ru=lang==='ru',data=chordReference(symbol),dialog=document.createElement('dialog');dialog.className='chord-reference';dialog.setAttribute('aria-label',`${ru?'Аккорд':'Chord'} ${symbol}`);
 const el=(tag,text='')=>{const node=document.createElement(tag);node.textContent=text;return node;};
 const title=el('h2',symbol),close=el('button',ru?'Закрыть':'Close');close.type='button';close.className='btn btn--secondary';close.addEventListener('click',()=>dialog.close());dialog.append(title,close);
 dialog.addEventListener('close',()=>dialog.remove());
 if(data.chord.silent)dialog.append(el('p',data.chord.silent==='all'?(ru?'Полная пауза всех партий на указанную длительность.':'All parts rest for the specified duration.'):(ru?'Бас и клавиши молчат; ударные продолжают играть.':'Bass and keys rest; drums continue.')));
 else{
  dialog.append(el('h3',ru?'Звуки аккорда':'Chord tones'),el('p',data.tones.map(t=>`${t.label}: ${t.note}`).join(' · ')));
  const third=data.tones.filter(t=>t.degree===3).map(t=>t.note).join(' / ')||'—',seventh=data.tones.filter(t=>t.degree===7).map(t=>t.note).join(' / ')||'—';
  dialog.append(el('p',`${ru?'Терция':'Third'}: ${third} · ${ru?'Септима':'Seventh'}: ${seventh} · ${ru?'Бас':'Bass'}: ${data.chord.bass}`));
  const keyboard=svgNode('svg',{viewBox:'0 0 600 150',role:'img','aria-label':data.tones.map(t=>t.note).join(', ')}),whites=[],blacks=[];let white=0;
  for(let midi=48;midi<=72;midi++){
   const black=[1,3,6,8,10].includes(midi%12),selected=data.chord.pitchClasses.includes(midi%12),root=midi%12===data.chord.pitchClasses[0];
   const attrs={x:black?(white-.3)*40:white*40,y:0,width:black?24:40,height:black?95:145,fill:selected?(root?'#5b8bed':'#9dbcf5'):black?'#222a34':'#fff',stroke:'#425163','stroke-width':1};
   (black?blacks:whites).push(svgNode('rect',attrs));if(!black)white++;
  }
  keyboard.append(...whites,...blacks);dialog.append(keyboard);
  dialog.append(el('h3',ru?'Подходящие гаммы':'Compatible scales'),el('p',ru?'Эти гаммы содержат все звуки аккорда и указанный бас. Выбор зависит от тональности и соседних аккордов; это варианты, а не единственный ответ. Сначала сыграйте терцию и септиму, затем соедините их со следующим аккордом.':'These scales contain all chord tones and the specified bass. Choose using the key and surrounding chords; these are options. Start with the third and seventh, then connect them to the next chord.'));
  const scales=el('ul');for(const scale of data.scales)scales.append(el('li',`${scale.root} ${ru?scale.ru:scale.en}: ${scale.notes.join(' · ')}`));if(!data.scales.length)scales.append(el('li',ru?'В учебном наборе нет гаммы, содержащей все указанные звуки.':'No scale in the practice vocabulary contains every specified tone.'));dialog.append(scales);
  const controls=el('div');controls.className='song-toolbar';const instrument=el('select');instrument.setAttribute('aria-label',ru?'Инструмент':'Instrument');for(const [value,text]of[['guitar',ru?'Гитара':'Guitar'],['ukulele',ru?'Укулеле':'Ukulele']]){const opt=el('option',text);opt.value=value;instrument.append(opt);}
  const leftLabel=el('label'),left=el('input');left.type='checkbox';leftLabel.append(left,document.createTextNode(ru?' Для левши':' Left-handed'));const next=el('button',ru?'Следующий вариант':'Next voicing');next.type='button';next.className='btn btn--secondary';controls.append(instrument,leftLabel,next);dialog.append(el('h3',ru?'Аппликатуры':'Fingerings'),controls);
  const diagram=el('div'),caption=el('p');dialog.append(diagram,caption);let index=0;
  function draw(){const options=chordFingerings(symbol,instrument.value);diagram.replaceChildren();if(!options.length){caption.textContent=ru?'В удобном диапазоне не найдена аппликатура с басом, терцией, септимой и верхним расширением.':'No fingering found in the playable range with the required bass, third, seventh and top extension.';next.disabled=true;return;}next.disabled=options.length<2;index%=options.length;const frets=left.checked?[...options[index].frets].reverse():options[index].frets;const positives=frets.filter(n=>n>0),start=positives.length?Math.max(1,Math.min(...positives)):1,svg=svgNode('svg',{viewBox:'0 0 300 240',role:'img','aria-label':frets.map(f=>f<0?'x':f).join(' ')}),spacing=220/(frets.length-1);
   for(let fret=0;fret<=4;fret++)svg.append(svgNode('line',{x1:40,y1:50+fret*35,x2:260,y2:50+fret*35,stroke:'#748396','stroke-width':fret===0&&start===1?5:1}));
   frets.forEach((fret,i)=>{const x=40+i*spacing;svg.append(svgNode('line',{x1:x,y1:50,x2:x,y2:190,stroke:'#748396'}));if(fret<=0)svg.append(svgNode('text',{x,y:32,'text-anchor':'middle',fill:'currentColor'},fret<0?'×':'○'));else svg.append(svgNode('circle',{cx:x,cy:50+(fret-start+.5)*35,r:10,fill:'#5b8bed'}));});svg.append(svgNode('text',{x:10,y:70,fill:'currentColor'},String(start)));diagram.append(svg);caption.textContent=`${index+1} / ${options.length} · ${ru?'Лады':'Frets'}: ${frets.map(n=>n<0?'×':n).join(' · ')} · ${ru?'Бас':'Bass'} ${data.chord.bass}`;
  }
  instrument.addEventListener('change',()=>{index=0;draw();});left.addEventListener('change',draw);next.addEventListener('click',()=>{index++;draw();});draw();
 }
 document.body.append(dialog);dialog.showModal();close.focus();return dialog;
}
