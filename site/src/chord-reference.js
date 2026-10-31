import { parseChord } from './chords.js';
import { pitchClass } from './pitch.js';
import { SCALE_INTERVALS } from './harmony.js';
const LETTERS='CDEFGAB', NATURAL=[0,2,4,5,7,9,11], mod=n=>((n%12)+12)%12;
const DEGREE={0:1,2:2,3:3,4:3,5:4,6:5,7:5,8:5,9:6,10:7,11:7,13:9,14:9,15:9,16:11,17:11,18:11,20:13,21:13,22:13};
function spell(root,interval,degree) {
 const letter=(LETTERS.indexOf(root[0])+degree-1)%7, difference=mod(pitchClass(root)+interval-NATURAL[letter]+6)-6;
 return LETTERS[letter]+(difference<0?'♭'.repeat(-difference):'♯'.repeat(difference));
}
const SCALES=[
 ['major','Мажор / ионийский','Major / Ionian',SCALE_INTERVALS.major],
 ['dorian','Дорийский','Dorian',[0,2,3,5,7,9,10]],['phrygian','Фригийский','Phrygian',[0,1,3,5,7,8,10]],
 ['lydian','Лидийский','Lydian',[0,2,4,6,7,9,11]],['mixolydian','Миксолидийский','Mixolydian',[0,2,4,5,7,9,10]],
 ['naturalMinor','Натуральный минор','Natural minor',SCALE_INTERVALS.naturalMinor],['locrian','Локрийский','Locrian',[0,1,3,5,6,8,10]],
 ['harmonicMinor','Гармонический минор','Harmonic minor',SCALE_INTERVALS.harmonicMinor],['melodicMinor','Мелодический минор','Melodic minor',SCALE_INTERVALS.melodicMinor],
 ['lydianDominant','Лидийский доминантовый','Lydian dominant',[0,2,4,6,7,9,10]],['phrygianDominant','Фригийский доминантовый','Phrygian dominant',[0,1,4,5,7,8,10]],
 ['altered','Альтерированный','Altered',[0,1,3,4,6,8,10]],['wholeTone','Целотоновый','Whole tone',[0,2,4,6,8,10]],
 ['halfWhole','Уменьшённый полутон-тон','Half-whole diminished',[0,1,3,4,6,7,9,10]],['wholeHalf','Уменьшённый тон-полутон','Whole-half diminished',[0,2,3,5,6,8,9,11]],
];
export function chordReference(symbol) {
 const chord=parseChord(symbol);if(chord.silent)return{chord,tones:[],scales:[]};
 const root=pitchClass(chord.root), tones=chord.intervals.map(interval=>{
   const degree=chord.quality==='dim7'&&interval===9?7:chord.quality.includes('b6')&&interval===8?6:DEGREE[interval]??1;
   const note=spell(chord.root,interval,degree), natural=[0,2,4,5,7,9,11][(degree-1)%7]+12*Math.floor((degree-1)/7);
   const alteration=interval-natural;return{interval,degree,note,label:(alteration<0?'♭'.repeat(-alteration):'♯'.repeat(alteration))+degree,pitch:mod(root+interval)};
 });
 const scales=SCALES.filter(([, , , intervals])=>chord.pitchClasses.every(pc=>intervals.some(n=>mod(root+n)===pc))&&intervals.some(n=>mod(root+n)===chord.bassPitch)).map(([id,ru,en,intervals])=>({id,ru,en,root:chord.root,pitchClasses:intervals.map(n=>mod(root+n)),notes:intervals.map((n,i)=>intervals.length===7?spell(chord.root,n,i+1):spell(chord.root,n,DEGREE[n]??i+1))}));
 return{chord,tones,scales};
}
export const TUNINGS={guitar:[40,45,50,55,59,64],ukulele:[67,60,64,69]};
export function chordFingerings(symbol,instrument='guitar') {
 const reference=chordReference(symbol),chord=reference.chord,tuning=TUNINGS[instrument];if(!tuning)throw new RangeError('Unknown instrument');if(chord.silent)return[];
 const allowed=new Set([...chord.pitchClasses,chord.bassPitch]),required=new Set([pitchClass(chord.root),...reference.tones.filter(t=>chord.pitchClasses.length<=4||[3,7].includes(t.degree)||t.interval===chord.intervals.at(-1)&&t.interval>=12||[...chord.quality.matchAll(/([b#])(5|6|9|11|13)/g)].some(match=>t.degree===Number(match[2])&&t.label.startsWith(match[1]==='b'?'♭':'♯'))).map(t=>t.pitch)]),found=new Map();
 for(let start=0;start<=9;start++){
  const choices=tuning.map(open=>[-1,...Array.from({length:13},(_,n)=>n).filter(fret=>(fret===0||fret>=start&&fret<=start+3)&&allowed.has((open+fret)%12))]);
  const visit=(frets,index)=>{
   if(index<tuning.length){for(const fret of choices[index])visit([...frets,fret],index+1);return;}
   const notes=frets.flatMap((fret,i)=>fret<0?[]:[tuning[i]+fret]);if(notes.length<3||Math.min(...notes)%12!==chord.bassPitch||![...required].every(pc=>notes.some(note=>note%12===pc)))return;
   const positive=frets.filter(f=>f>0),min=Math.min(...positive),max=Math.max(0,...positive);if(positive.length&&max-min>3)return;
   const barre=frets.map((f,i)=>f===min?i:-1).filter(i=>i>=0);let fingers=positive.length;
   if(barre.length>1&&frets.slice(barre[0],barre.at(-1)+1).every(f=>f>=min))fingers-=barre.length-1;
   if(fingers>4)return;
   const key=frets.join(','),score=max+frets.filter(f=>f<0).length*3+(positive.length?max-min:0);
   if(!found.has(key))found.set(key,{frets,notes,score});
  };visit([],0);
 }
 return [...found.values()].sort((a,b)=>a.score-b.score||a.frets.join(',').localeCompare(b.frets.join(','))).slice(0,8);
}
