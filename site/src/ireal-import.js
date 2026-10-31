import { newDraft,compileDraft } from './song-draft.js';
import { parseChord } from './chords.js';
import { fraction } from './musical-time.js';
const PREFIX='1r34LbKcu7';
export function decodeIrealBody(encoded) {
 let result='';
 for(let at=0;at<encoded.length;at+=50){const block=encoded.slice(at,at+50);result+=encoded.length-at>51?[...block].map((_c,i)=>block[i<5||i>=10&&i<24||i>=26&&i<40||i>=45?49-i:i]).join(''):block;}
 return result.replaceAll('XyQ','   ').replaceAll('Kcl','|x ').replaceAll('LZ',' |');
}
function tokenize(text){
 const tokens=[];let at=0;
 while(at<text.length){const rest=text.slice(at);let match;
  if((match=/^<([^>]*)>/.exec(rest)))tokens.push({type:'text',value:match[1]});
  else if((match=/^T(12|[2-9][248])/.exec(rest)))tokens.push({type:'meter',value:match[1]==='12'?'12/8':`${match[1][0]}/${match[1][1]}`});
  else if((match=/^\*([A-Za-z])/.exec(rest)))tokens.push({type:'section',value:match[1]});
  else if((match=/^N([1-8])/.exec(rest)))tokens.push({type:'ending',value:match[1]});
  else if((match=/^\(([^()]*)\)/.exec(rest)))tokens.push({type:'alternate',value:match[1]});
  else if((match=/^[A-G](?:[#b]{1,2})?(?:min\([^)]*\)|maj\([^)]*\)|7\(add13\)|[0-9^+\-oh#busadltminj]*)(?:\/[A-G][#b]?)?/.exec(rest)))tokens.push({type:'chord',value:match[0]});
  else if((match=/^[Ww]\/[A-G][#b]?/.exec(rest)))tokens.push({type:'bass',value:match[0].slice(2)});
  else if((match=/^\s/.exec(rest)))tokens.push({type:'space'});
  else if((match=/^[|[\]{}Z]/.exec(rest)))tokens.push({type:'bar',value:match[0]});
  else if((match=/^[npxrSQYsl,Uf]/.exec(rest)))tokens.push({type:match[0]});
  else throw new RangeError(`Unsupported chart token near ${rest.slice(0,24)}`);
  at+=match[0].length;
 }
 return tokens;
}
function parseBody(body,key,bpm){
 const draft=newDraft();draft.key=key;draft.bpm=bpm;draft.sections=[];
 let section={name:'A',measures:[]},meter='4/4',cells=[],form=[],comments=[],cursor=0,lastChord,previous=[],repeat=null,pendingRepeat=null,ending=false,hasOpenRepeat=false,afterClose=false;
 let warnings=[];
 const pushSection=()=>{if(section.measures.length){draft.sections.push(section);section={name:section.name,measures:[]};}};
 function flush(force=false){
  if(!cursor&&!cells.length&&!repeat&&!force)return;
  if(cursor<4&&!cells.length&&!repeat&&!pendingRepeat&&!form.length&&!comments.length){cursor=0;return;}
  let measure={meter,chords:'',alternate:'',text:comments.join(' · '),form:form.join(' ')};
  if (!cells.length && cursor && !repeat && !pendingRepeat) cells.push({at:0,symbol:lastChord||'N.C.'});
  const copied=repeat||pendingRepeat;
  if(copied){if(cells.length)throw new RangeError('A repeat symbol cannot share a measure with chords');if(copied.meter!==meter)throw new RangeError('Measure repeat crosses a meter change');measure={...copied,text:measure.text,form:measure.form};if(!repeat&&pendingRepeat)pendingRepeat=null;}
  else if(cells.length){
   const numerator=Number(meter.split('/')[0]),count=Math.max(1,cursor);const entries=cells.map((cell,i)=>{const end=i+1<cells.length?cells[i+1].at:count;const duration=fraction((end-cell.at)*numerator,count);if(duration.n<=0)throw new RangeError('Ambiguous chord spacing');return `${cell.symbol}:${duration.n}${duration.d===1?'':'/'+duration.d}`;});
   measure.chords=entries.join(' ');if(cells.some(cell=>cell.alternate))measure.alternate=cells.map(cell=>cell.alternate||cell.symbol).join(' ');
  }
  section.measures.push(measure);previous.push(measure);if(previous.length>256)throw new RangeError('Chart exceeds 256 measures');cells=[];form=[];comments=[];cursor=0;repeat=null;
 }
 for(const token of tokenize(body.trimEnd())){
  switch(token.type){
   case 'meter':if(cells.length)flush();meter=token.value;break;
   case 'section':flush();pushSection();section.name=token.value;break;
   case 'space':if(!afterClose)cursor++;break;
   case ',':case 'Y':case 's':case 'l':break;
   case 'chord':{afterClose=false;const parsed=parseChord(token.value);if(!cells.length&&cursor)cells.push({at:0,symbol:lastChord||'N.C.'});cells.push({at:cursor++,symbol:parsed.symbol});lastChord=parsed.symbol;break;}
   case 'bass':if(!lastChord)throw new RangeError('Invisible root needs a preceding chord');{const chord=parseChord(lastChord);const parsed=parseChord(chord.root+chord.quality+'/'+token.value);cells.push({at:cursor++,symbol:parsed.symbol});lastChord=parsed.symbol;}break;
   case 'n':afterClose=false;cells.push({at:cursor++,symbol:'N.C.'});lastChord='N.C.';break;
   case 'p':afterClose=false;if(!lastChord)throw new RangeError('Slash repeat needs a preceding chord');if(!cells.length)cells.push({at:0,symbol:lastChord});cursor++;break;
   case 'alternate':if(!cells.length)throw new RangeError('Alternate chord has no main chord');cells.at(-1).alternate=parseChord(token.value).symbol;break;
   case 'x':afterClose=false;if(!previous.length)throw new RangeError('Measure repeat has no preceding measure');repeat={...previous.at(-1)};cursor++;break;
   case 'r':afterClose=false;if(previous.length<2)throw new RangeError('Two-measure repeat needs two preceding measures');repeat={...previous.at(-2)};pendingRepeat={...previous.at(-1)};cursor++;break;
   case 'U':comments.push('iReal: ending');warnings.push('Player ending marker U is retained as text; review the final chorus.');break;
   case 'f':comments.push('Fermata');warnings.push('Fermata is displayed as text; tempo is unchanged.');break;
   case 'S':form.push('Segno');break;
   case 'Q':form.push('__Coda');break;
   case 'ending':if(!cells.length)cursor=0;if(ending)throw new RangeError('Overlapping endings are unsupported');form.push('['+token.value);ending=true;break;
   case 'text':{const text=token.value.replace(/^\*\d{2}/,'').trim(),compact=text.replace(/\s/g,'');const jump=/^D\.([CS])\.(?:al(Coda|Fine))?$/i.exec(compact);
     if(jump)form.push(`D.${jump[1].toUpperCase()}.${jump[2]?'al'+jump[2][0].toUpperCase()+jump[2].slice(1).toLowerCase():''}`);
     else if(/^Fine$/i.test(text))form.push('Fine');
     else if(/^\d+x$/i.test(text)){const times=parseInt(text);if(times<2||times>8)throw new RangeError('Repeat count must be 2–8');comments.push(text);}
     else if(/Break|D\.[CS]\.|To\s*Coda/i.test(text))throw new RangeError(`Staff playback instruction needs manual editing: ${text}`);
     else if(text)comments.push(text);break;}
   case 'bar':{
    if(token.value==='{'){flush();form.push('|:');hasOpenRepeat=true;afterClose=false;break;}
    if(token.value==='}'){const count=comments.find(text=>/^\d+x$/i.test(text));form.push(':|'+(count?parseInt(count):''));ending=false;flush(true);hasOpenRepeat=false;afterClose=true;break;}
    if([']','Z'].includes(token.value)&&ending){form.push(']');ending=false;}
    flush(token.value==='|'&&cursor>0);if([']','Z'].includes(token.value))afterClose=true;break;
   }
  }
 }
 if(ending)form.push(']');flush();if(pendingRepeat){repeat=pendingRepeat;pendingRepeat=null;cursor=1;flush();}pushSection();
 if(hasOpenRepeat)throw new RangeError('Unclosed repeat');
 if(!draft.sections.length)throw new RangeError('Chart has no measures');
 const measures=draft.sections.flatMap(section=>section.measures),codas=measures.filter(measure=>measure.form.includes('__Coda'));
 if(codas.length===1)codas[0].form=codas[0].form.replace('__Coda','Coda');
 else if(codas.length===2){codas[0].form=codas[0].form.replace('__Coda','ToCoda');codas[1].form=codas[1].form.replace('__Coda','Coda');warnings.push('Coda markers mapped to ToCoda/Coda; check the expanded order.');}
 else if(codas.length)throw new RangeError('More than two Coda markers are unsupported');
 const compiled=compileDraft(draft);if(!compiled.compiled)throw new RangeError(compiled.errors.map(error=>error.message).join('; '));return{draft,warnings};
}
export function parseIreal(input){
 if(typeof input!=='string'||new TextEncoder().encode(input).length>50*1024*1024)throw new RangeError('iReal import exceeds 50 MB');
 const links=/^ireal(?:book|b):\/\//i.test(input.trim())?[input.trim()]:[...input.matchAll(/href\s*=\s*(["'])(ireal(?:book|b):\/\/[\s\S]*?)\1/gi)].map(match=>match[2].replaceAll('&amp;','&'));
 if(!links.length)throw new RangeError('No irealbook:// or irealb:// link found');
 const songs=[];let name='';
 for(const link of new Set(links)){const scheme=link.slice(0,link.indexOf(':')).toLowerCase(),decoded=decodeURIComponent(link.slice(link.indexOf('//')+2));let entries;
  if(scheme==='irealb'){entries=decoded.split('===');if(entries.length>1&&!entries.at(-1).includes(PREFIX))name=entries.pop();}
  else if(decoded.includes('===')){entries=decoded.split('===');if(entries.length>1&&entries.at(-1).split('=').length<6)name=entries.pop();}
  else{const fields=decoded.split('=');entries=[];while(fields.length>=6)entries.push(fields.splice(0,6).join('='));if(fields.length===1)name=fields[0];else if(fields.length)throw new RangeError('Invalid open protocol playlist');}
  for(const entry of entries){if(!entry.trim())continue;let title=entry.split('=')[0]||'Untitled';
   try{
    const fields=entry.split('='),titleText=fields[0],composer=fields[1]||'';let key,body,style='',bpm=120,repeats=1;
    if(scheme==='irealb'){
     const music=fields.findIndex(field=>field.startsWith(PREFIX));if(music<3)throw new RangeError('Invalid scrambled iReal header');
     let keyIndex=-1;for(let i=music-1;i>=2;i--)if(/^[A-G][#b]?(-|m)?$/.test(fields[i])){keyIndex=i;break;}
     if(keyIndex<0)throw new RangeError('Missing key signature');key=fields[keyIndex];style=fields.slice(2,keyIndex).filter(Boolean).join(' ');body=decodeIrealBody(fields[music].slice(PREFIX.length));
     const numeric=fields.slice(music+1).filter(field=>/^\d+$/.test(field));if(numeric[0]&&Number(numeric[0])>=30&&Number(numeric[0])<=300)bpm=Number(numeric[0]);if(numeric[1]&&Number(numeric[1])>=0&&Number(numeric[1])<=32)repeats=Number(numeric[1]);
     if(fields.slice(keyIndex+1,music).some(field=>field&&field!=='0'))throw new RangeError('Header transposition needs manual conversion');
    }else{if(fields.length!==6)throw new RangeError('Invalid open protocol song');style=fields[2];key=fields[3];body=fields[5];if(fields[4]&&fields[4]!=='n'){const packed=fields[4];body=`T${packed}`+body;}}
    const parsed=parseBody(body,key.replace(/-$/,'m'),bpm);parsed.draft.title=titleText;parsed.draft.composer=composer;
    const mapped=/bossa/i.test(style)?'bossa':/ballad/i.test(style)?'ballad':/rock|pop/i.test(style)?'rock':/swing|jazz/i.test(style)?'swing':'straight';
    const warnings=[...parsed.warnings];if(style)warnings.push(`Style “${style}” mapped to ${mapped} .`);
    songs.push({draft:parsed.draft,settings:{style:mapped,repeats,countIn:true},warnings,source:entry});
   }catch(error){songs.push({title,error:error.message,source:entry});}
   if(songs.length>5000)throw new RangeError('iReal import exceeds 5000 songs');
  }
 }
 return{name,songs};
}
