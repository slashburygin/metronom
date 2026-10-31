import { parseChord } from './chords.js';
import { compileSong } from './song.js';
import { expandSong } from './song-form.js';
import { fraction, valueOf } from './musical-time.js';
const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const nativeKinds = { '':'major',m:'minor',dim:'diminished',aug:'augmented',sus2:'suspended-second',sus4:'suspended-fourth','6':'major-sixth',m6:'minor-sixth','7':'dominant',maj7:'major-seventh',m7:'minor-seventh','m(maj7)':'major-minor',dim7:'diminished-seventh',m7b5:'half-diminished','9':'dominant-ninth',maj9:'major-ninth',m9:'minor-ninth','11':'dominant-11th',m11:'minor-11th','13':'dominant-13th',maj13:'major-13th',m13:'minor-13th' };
const degrees = {0:[1,0],2:[2,0],3:[3,-1],4:[3,0],5:[4,0],6:[5,-1],7:[5,0],8:[5,1],9:[6,0],10:[7,-1],11:[7,0],13:[9,-1],14:[9,0],15:[9,1],16:[11,-1],17:[11,0],18:[11,1],20:[13,-1],21:[13,0],22:[13,1]};
function noteXml(note, prefix) {
  const alter=[...note.slice(1)].reduce((sum,c)=>sum+(c==='♯'?1:-1),0);
  return `<${prefix}><${prefix}-step>${note[0]}</${prefix}-step>${alter?`<${prefix}-alter>${alter}</${prefix}-alter>`:''}</${prefix}>`;
}
function harmony(symbol, offset, alternate = false) {
  const chord=parseChord(symbol);
  if (chord.silent) return `<direction><direction-type><words>${escape(symbol)}</words></direction-type><offset>${offset}</offset></direction>`;
  const kind=nativeKinds[chord.quality] ?? 'other';
  const additions=kind==='other'?chord.intervals.filter(i=>i!==0).map(interval=>{
    const [degree,alter]=degrees[interval]??[1,interval];
    return `<degree><degree-value>${degree}</degree-value><degree-alter>${alter}</degree-alter><degree-type>add</degree-type></degree>`;
  }).join(''):'';
  return `<harmony${alternate?' type="alternate"':''}>${noteXml(chord.root,'root')}<kind text="${escape(chord.quality)}">${kind}</kind>${/\/[A-G][♯♭]*$/.test(chord.symbol)?noteXml(chord.bass,'bass'):''}${additions}<offset>${offset}</offset></harmony>`;
}
const gcd=(a,b)=>b?gcd(b,a%b):a;
export function encodeMusicXml(song) {
  const compiled=expandSong(compileSong(song)); let divisions=1;
  for(const measure of compiled.measures)for(const duration of [fraction(measure.meter.numerator,measure.meter.denominator),...measure.chords.map(c=>c.offset)]){
    const denominator=duration.d/gcd(duration.n*4,duration.d);divisions=divisions/gcd(divisions,denominator)*denominator;
    if(divisions>1000000)throw new RangeError('MusicXML divisions exceed 1000000');
  }
  const measures=compiled.measures.map((measure,index)=>{
    const length=Math.round(valueOf(fraction(measure.meter.numerator,measure.meter.denominator))*4*divisions);
    const chords=measure.chords.map(chord=>harmony(chord.symbol,Math.round(valueOf(chord.offset)*4*divisions))+(chord.alternate?harmony(chord.alternate,Math.round(valueOf(chord.offset)*4*divisions),true):'')).join('');
    return `<measure number="${index+1}"><attributes><divisions>${divisions}</divisions><time><beats>${measure.meter.numerator}</beats><beat-type>${measure.meter.denominator}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>${index===0?`<direction><direction-type><words>${escape(song.key)} · ${song.bpm} BPM</words></direction-type><sound tempo="${song.bpm}"/></direction>`:''}${measure.text?`<direction><direction-type><words>${escape(measure.text)}</words></direction-type></direction>`:''}${chords}<note><rest measure="yes"/><duration>${length}</duration></note></measure>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0"><work><work-title>${escape(song.title)}</work-title></work><identification><creator type="composer">${escape(song.composer)}</creator><encoding><software>Metronom</software></encoding></identification><part-list><score-part id="P1"><part-name>Chord chart</part-name></score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
}

export function printChart(song, rawDraft, label = '') {
  const popup=window.open('','_blank');if(!popup)throw new Error('Allow popups to print');popup.opener=null;
  const doc=popup.document;doc.title=song.title||'Metronom';
  const style=doc.createElement('style');style.textContent='@page{size:auto;margin:16mm}body{font:16px system-ui;color:#111;background:white;max-width:1000px;margin:20px auto}h1{margin:0 0 8px}h2{break-after:avoid}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:20px}td{border:1px solid #555;padding:10px;vertical-align:top;height:60px;overflow-wrap:anywhere}tr{break-inside:avoid}.meta{color:#444}.chords{font-size:20px;font-weight:600}.small{font-size:12px}button{padding:8px 15px}@media print{button{display:none}body{margin:0}}';doc.head.append(style);
  const el=(tag,text='')=>{const node=doc.createElement(tag);node.textContent=text;return node;};
  doc.body.append(el('h1',song.title||'Metronom'),el('p',[song.composer,song.key,`${song.bpm} BPM`,label].filter(Boolean).join(' · ')));
  const print=el('button','Print / Save PDF');print.addEventListener('click',()=>popup.print());doc.body.append(print);
  let number=0;
  song.sections.forEach((section,si)=>{doc.body.append(el('h2',section.name));const table=el('table');let row;
    section.measures.forEach((measure,mi)=>{if(mi%4===0){row=el('tr');table.append(row);}const cell=el('td'),info=el('div',`${++number} · ${measure.meter.numerator}/${measure.meter.denominator} · ${rawDraft.sections[si].measures[mi].form||''}`);info.className='small';const chords=el('div',measure.chords.map(c=>c.symbol).join(' · ')||'—');chords.className='chords';cell.append(info,chords);const alternates=measure.chords.map(c=>c.alternate||'').filter(Boolean).join(' · ');if(alternates)cell.append(el('div',`(${alternates})`));if(measure.text)cell.append(el('div',measure.text));row.append(cell);});doc.body.append(table);
  });
  doc.body.append(el('p','Metronom · github.com/slashburygin/metronom'));
  popup.focus();popup.print();return popup;
}
