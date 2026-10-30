import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChord } from '../site/src/chords.js';
import { pitchClass } from '../site/src/pitch.js';
import { scaleHarmony } from '../site/src/harmony.js';
import { buildAccompaniment } from '../site/src/accompaniment.js';
import { BackingPlayer } from '../site/src/backing-player.js';
import { fraction as f } from '../site/src/musical-time.js';
import { compileSong } from '../site/src/song.js';
import { parseKey, keyDistance, transposeNote, transposeChord, transposeSong, transposeDraft, transposeArrangement, INSTRUMENTS, KEY_NAMES, mod12 } from '../site/src/transposition.js';
import { trainingState, normalizeTraining, displaySong } from '../site/src/training.js';

const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('key parsing separates tonic, mode and enharmonic spelling', () => {
  assert.deepEqual(parseKey('Bb minor'),{tonic:'B♭',minor:true,pitch:10});
  assert.equal(parseKey('C# major').tonic,'C♯');
  assert.equal(parseKey('F♯m').minor,true);
  assert.equal(keyDistance('C','B♭'),10);
  assert.equal(keyDistance('F♯','G♭'),0);
  for (const invalid of ['unknown','H','Cmaj7','C/4']) assert.throws(()=>parseKey(invalid));
});

test('transposition retains functional spelling, quality, slash bass and pauses', () => {
  assert.equal(transposeNote('B',6,'C','F♯'),'E♯');
  assert.equal(transposeNote('F',6,'C','G♭'),'C♭');
  assert.equal(transposeChord('F/C',2,'C','D'),'G/D');
  assert.equal(transposeChord('C6/9/E',2,'C','D'),'D6/9/F♯');
  assert.equal(transposeChord('G7b9#11',5,'C','F'),'C7b9#11');
  assert.equal(transposeChord('C♯m7',0,'F♯','G♭'),'D♭m7');
  assert.equal(transposeChord('N.C.',5,'C','F'),'N.C.');
  assert.equal(transposeChord('Break',5,'C','F'),'Break');
});

test('every key and instrument produces the exact requested pitch shift', () => {
  for (const from of KEY_NAMES) for (const to of KEY_NAMES) for (const symbol of ['Cmaj7','D♭m7','F♯7b9','G/B','E♯dim7','B♭♭m7b5']) {
    const shift=keyDistance(from,to), result=parseChord(transposeChord(symbol,shift,from,to)), source=parseChord(symbol);
    assert.deepEqual(result.pitchClasses,source.pitchClasses.map(pc=>mod12(pc+shift)));
    assert.equal(result.bassPitch,mod12(source.bassPitch+shift));
  }
  for(const [instrument,shift] of Object.entries(INSTRUMENTS)) {
    const state=trainingState('C',1,120,{instrument});
    assert.equal(pitchClass(state.writtenKey),mod12(shift));
    assert.equal(state.semitones,0);
  }
});

test('soft and instrument transposition leave source and audio independent', () => {
  const source=compileSong({key:'C',sections:[{measures:[{chords:[{symbol:'F/C',alternate:'Am7',offset:f(0),duration:f(1)}],text:'Keep'}]}]}).song;
  const snapshot=JSON.stringify(source);
  const state=trainingState('C',1,120,{targetKey:'B♭',instrument:'Eb'});
  const written=displaySong(source,state);
  assert.equal(written.key,'G');
  assert.equal(written.sections[0].measures[0].chords[0].symbol,'C/G');
  assert.equal(written.sections[0].measures[0].chords[0].alternate,'Em7');
  assert.equal(JSON.stringify(source),snapshot);
  const sounding=transposeSong(source,state.semitones,state.key);
  assert.equal(sounding.sections[0].measures[0].chords[0].symbol,'E♭/B♭');
});

test('hard transposition preserves raw duration syntax, comments and original draft', () => {
  const source={key:'Cm',sections:[{name:'A',measures:[{meter:'4/4',chords:'Dm7b5:2 G7b9:2',alternate:'Fm7 B♭7',text:'Quiet'}]}]};
  const snapshot=JSON.stringify(source), result=transposeDraft(source,'D');
  assert.equal(result.key,'Dm');
  assert.equal(result.sections[0].measures[0].chords,'Em7b5:2 A7b9:2');
  assert.equal(result.sections[0].measures[0].alternate,'Gm7 C7');
  assert.equal(result.sections[0].measures[0].text,'Quiet');
  assert.equal(JSON.stringify(source),snapshot);
});

test('training visits twelve keys, holds each for N passes and caps tempo', () => {
  for(const keyStep of [1,5,-1,-5]) {
    const states=Array.from({length:24},(_,i)=>trainingState('Cm',i+1,80,{keyStep,repeatsPerKey:2,tempoIncrement:5,maxBpm:120}));
    assert.equal(new Set(states.map(s=>pitchClass(s.key))).size,12);
    for(let i=0;i<24;i+=2) assert.equal(states[i].key,states[i+1].key);
    assert.equal(states.at(-1).bpm,120);
    assert.equal(states[1].bpm,85);
  }
  assert.equal(trainingState('C',2,160,{tempoIncrement:5,maxBpm:100}).bpm,160);
  assert.equal(normalizeTraining({keyStep:2,instrument:'X',tempoIncrement:999}).keyStep,0);
});

test('arrangement transposition bounds register over repeated cycles and keeps drums unchanged', () => {
  const source=buildAccompaniment(scaleHarmony('C'));
  const result=transposeArrangement(source,14,'D');
  const from=source.steps[0].events,to=result.steps[0].events;
  from.forEach((e,i)=>{
    if(e.kind==='note') assert.equal(to[i].midi,e.midi+2);
    if(e.kind==='drum') assert.equal(to[i],e);
  });
});

function context() {
  const node=()=>({gain:{value:1},connect(destination){return destination;},disconnect(){}});
  return {currentTime:0,sampleRate:44100,destination:node(),resume:async()=>{},createGain:node,createDynamicsCompressor:node,
    createBuffer:(_c,length)=>({getChannelData:()=>new Float32Array(length)})};
}

test('twelve-key ii–V–I uses correct tempo on each boundary despite lookahead peeks', async () => {
  const ctx=context(),heard=[],scheduled=[];
  const player=new BackingPlayer({context:ctx,onStep:p=>heard.push(p),transportOptions:{tickerFactory:()=>({start(){},stop(){},dispose(){}}),requestFrame:()=>1,cancelFrame(){}}});
  player.schedule=(event,timing)=>{if(event.kind==='note')scheduled.push({event,timing});};
  const compiled=buildAccompaniment(scaleHarmony('C'));
  await player.start(compiled,{bpm:90,repeats:12,countIn:false,training:{keyStep:5,tempoIncrement:5,maxBpm:120,instrument:'Bb'}});
  const first=player.transport.nextStep(15),next=player.transport.nextStep(16);
  assert.equal(first.bpm,90);assert.equal(next.bpm,95);assert.equal(player.transport.bpm,90);
  for(let i=1;i<=11000;i++){ctx.currentTime=i/100;player.transport.schedule();player.transport.frame();if(!player.transport.playing)break;}
  const starts=heard.filter(p=>p.step.barIndex===0 && p.step.beatIndex===0);
  assert.equal(starts.length,12);
  assert.equal(new Set(starts.map(p=>pitchClass(p.step.training.key))).size,12);
  let time=0.05;
  starts.forEach((p,i)=>{close(p.time,time);const bpm=Math.min(120,90+i*5);assert.equal(p.bpm,bpm);time+=16*60/bpm;assert.equal(pitchClass(p.step.training.writtenKey),mod12(pitchClass(p.step.training.key)+2));});
  const firstBass=scheduled.filter(e=>e.event.part==='bass');
  for(let pass=0;pass<12;pass++)assert.equal(firstBass[pass*16].event.midi%12,mod12(2+pass*5));
  assert.equal(player.transport.playing,false);player.dispose();
});
