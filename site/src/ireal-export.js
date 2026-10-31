import { compileSong } from './song.js';
import { expandSong } from './song-form.js';
import { parseChord } from './chords.js';
import { fraction,add,ZERO,compare } from './musical-time.js';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function symbol(input){const chord=parseChord(input);if(chord.silent==='all')throw new RangeError('Break cannot be exported exactly to the open iReal protocol');if(chord.silent)return'n';const aliases={'m(maj7)':'-^7','m(maj9)':'-^9','m(maj11)':'min^11','m(maj13)':'min^13',augmaj7:'^7#5','dim(maj7)':'o^7','m(b6)':'-b6','m6/9':'-69','6/9':'69',madd9:'-add9','7sus4b9':'7susb9','7sus4b9b13':'7susb9b13','7sus4add3':'7susadd3','9sus4':'9sus','13sus4':'13sus'};const quality=aliases[chord.quality]??chord.quality;return(chord.root+quality+(/\/[A-G][♯♭]*$/.test(chord.symbol)?'/'+chord.bass:'')).replaceAll('♯','#').replaceAll('♭','b');}
export function exportIreal(song,style='Swing') {
 const compiled=expandSong(compileSong(song));let cells=0;const bars=[];
 for(const measure of compiled.measures){let count=0;
  for(let candidate=1;candidate<=16;candidate++){if(measure.chords.every(chord=>(chord.offset.n*candidate)%chord.offset.d===0&&(chord.duration.n*candidate)%chord.duration.d===0)&&Number.isInteger(measure.meter.numerator*candidate/measure.meter.denominator)){count=measure.meter.numerator*candidate/measure.meter.denominator;break;}}
  if(!count||count>16)throw new RangeError('iReal spacing needs more than 16 cells per bar');cells+=count;if(cells>192)throw new RangeError('Open iReal protocol limit: 192 cells; export a smaller chart');
  const length=fraction(measure.meter.numerator,measure.meter.denominator),parts=[];let offset=ZERO;
  for(let cell=0;cell<count;cell++){
   const chord=measure.chords.find(chord=>compare(chord.offset,offset)===0);parts.push(chord?symbol(chord.symbol)+(chord.alternate?'('+symbol(chord.alternate)+')':''):cell===0&&!measure.chords.length?'n':' ');offset=add(offset,fraction(length.n,length.d*count));
  }
  const meter=measure.meter.numerator===12&&measure.meter.denominator===8?'T12':`T${measure.meter.numerator}${measure.meter.denominator}`;
  if(!['T44','T34','T24','T54','T64','T74','T22','T32','T58','T68','T78','T98','T12'].includes(meter))throw new RangeError('Meter is outside the open iReal protocol');
  bars.push(meter+'|'+(measure.text?'<'+measure.text.replace(/[<>=]/g,' ') +'>':'')+parts.map((part,i)=>i&&part!==' '&&parts[i-1]!==' '?','+part:part).join(''));
 }
 const metadata=[song.title||'Untitled',song.composer||'',style,song.key.replaceAll('♯','#').replaceAll('♭','b').replace(/m$/,'-'),'n'];if(metadata.some(value=>value.includes('=')))throw new RangeError('iReal metadata cannot contain =');
 const link='irealbook://'+encodeURIComponent([...metadata,bars.join('')+'Z'].join('=')).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(song.title)}</title><h1>${escape(song.title)}</h1><p><a href="${escape(link)}">Open in iReal Pro</a></p><p>Linear expanded chord chart exported by Metronom. <a href="https://github.com/slashburygin/metronom">Source</a></p></html>`;
}
