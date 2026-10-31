import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, compileDraft } from '../site/src/song-draft.js';
import { exportPerformance, encodeMidi, encodeWav } from '../site/src/performance-export.js';
import { encodeMusicXml } from '../site/src/chart-export.js';
import { normalizeMix } from '../site/src/mixer.js';
const song = () => { const draft=newDraft();draft.title='Test & <chart>';draft.sections[0].measures=[{meter:'4/4',chords:'Cmaj7',text:'A < B',alternate:'Dm7',form:'|:'},{meter:'3/4',chords:'G7b9:1 Break:1 C/E:1',text:'',alternate:'',form:':|'}];return compileDraft(draft).compiled.song; };
// A small independent SMF reader validates chunk sizes, event deltas and channel bytes.
function readMidi(bytes) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'MThd');assert.equal(view.getUint32(4),6);assert.equal(view.getUint16(8),1);
  let at=14;const tracks=[];const variable=()=>{let value=0,byte;do{byte=bytes[at++];value=value*128+(byte&127);}while(byte&128);return value;};
  for(let n=0;n<view.getUint16(10);n++){
    assert.equal(new TextDecoder().decode(bytes.slice(at,at+4)),'MTrk');const length=view.getUint32(at+4);at+=8;const end=at+length;let tick=0;const events=[];
    while(at<end){tick+=variable();const status=bytes[at++];if(status===255){const type=bytes[at++],size=variable(),data=bytes.slice(at,at+size);at+=size;events.push({tick,type,data});}else{assert.ok(status>=128&&status<240);const data=bytes.slice(at,at+((status&240)===192?1:2));at+=data.length;assert.ok([...data].every(byte=>byte<128));events.push({tick,status,data});}}
    assert.equal(at,end);assert.equal(events.at(-1).type,47);tracks.push(events);
  }
  assert.equal(at,bytes.length);return {ppq:view.getUint16(12),tracks};
}

test('performance export expands form and training cycles with independent count-in and capped lengths',()=>{
 const source=song(),before=structuredClone(source),p=exportPerformance(source,{repeats:2,countIn:true,training:{keyStep:1,tempoIncrement:10},arrangement:{colors:true,fills:true}});
 assert.equal(p.tempos.length,2);assert.deepEqual(p.tempos.map(t=>t.bpm),[120,130]);assert.equal(p.countInEndTick,3840);assert.equal(p.meters.length,8);assert.ok(p.events.some(item=>item.countIn));assert.ok(p.events.some(item=>item.event.kind==='silence'));assert.deepEqual(source,before);
 const dry=exportPerformance(source,{repeats:1,countIn:false});assert.equal(dry.countInEndTick,0);assert.ok(!dry.events.some(item=>item.countIn));assert.equal(dry.duration,7);
 assert.throws(()=>exportPerformance(source,{repeats:0}),/finite/);assert.throws(()=>exportPerformance(source,{repeats:1},1),/limit/);
});

test('SMF separates parts, carries tempo/meter changes and never leaves a hanging note',()=>{
 const performance=exportPerformance(song(),{repeats:2,training:{keyStep:5,tempoIncrement:5},sound:{pianoTone:'organ',bassTone:'electric'}}),midi=readMidi(encodeMidi(performance));
 assert.equal(midi.ppq,960);assert.equal(midi.tracks.length,5);assert.equal(midi.tracks[0].filter(e=>e.type===81).length,2);
 assert.ok(midi.tracks[1].some(e=>e.status===193&&e.data[0]===33));assert.ok(midi.tracks[2].some(e=>e.status===192&&e.data[0]===16));
 for(const track of midi.tracks){const notes=new Map();for(const e of track){if(e.status===undefined)continue;const key=`${e.status&15}:${e.data[0]}`;if((e.status&240)===144)notes.set(key,(notes.get(key)??0)+1);if((e.status&240)===128)notes.set(key,(notes.get(key)??0)-1);}assert.ok([...notes.values()].every(n=>n===0));assert.equal(track.at(-1).tick,performance.endTick);}
});

test('muted MIDI parts omit notes without muting the count-in and mixer values normalize safely',()=>{
 const mix=normalizeMix({bass:{volume:9,muted:'true'},drums:{volume:0,muted:true},piano:{volume:.2,muted:true}});assert.equal(mix.bass.volume,.75);assert.equal(mix.bass.muted,false);
 const midi=readMidi(encodeMidi(exportPerformance(song(),{mix,countIn:true})));
 assert.ok(!midi.tracks[2].some(e=>(e.status&240)===144));assert.ok(!midi.tracks[3].some(e=>(e.status&240)===144));assert.ok(midi.tracks[4].some(e=>(e.status&240)===144));
});

test('PCM WAV header and interleaving match an independent decoder; clipping and nonfinite input are bounded',()=>{
 const bytes=encodeWav([new Float32Array([-2,-.5,0,.5,2,NaN]),new Float32Array([1,0,0,0,-1,0])],48000),view=new DataView(bytes.buffer);
 assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(view.getUint32(4,true)+8,bytes.length);assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),48000);assert.equal(view.getUint32(40,true),24);
 assert.deepEqual(Array.from({length:12},(_,i)=>view.getInt16(44+i*2,true)),[-32768,32767,-16384,0,0,0,16384,0,32767,-32768,0,0]);
 assert.throws(()=>encodeWav([new Float32Array(1),new Float32Array(2)],44100));
});

test('MusicXML uses a linear expanded chart, escaped text, alternate harmony and exact mixed meter durations',()=>{
 const text=encodeMusicXml(song());assert.match(text,/score-partwise version="4.0"/);assert.match(text,/Test &amp; &lt;chart&gt;/);assert.equal((text.match(/<measure number=/g)||[]).length,4);assert.match(text,/type="alternate"/);assert.match(text,/<kind text="7b9">other<\/kind>/);assert.match(text,/<degree-value>9<\/degree-value><degree-alter>-1/);assert.match(text,/<bass-step>E/);assert.match(text,/<words>Break/);assert.match(text,/<beats>3<\/beats><beat-type>4/);assert.match(text,/A &lt; B/);
});
