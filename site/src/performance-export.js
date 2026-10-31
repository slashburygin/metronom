import { arrangeSong } from './song-arrangement.js';
import { trainingState, trainingArrangement } from './training.js';
import { normalizeSound } from './backing-sound.js';
import { normalizeMix } from './mixer.js';
import { secondsFor, valueOf, ZERO } from './musical-time.js';

export const MIDI_PPQ = 960;
export function exportPerformance(song, options = {}, maxSeconds = 1800) {
  const repeats = options.repeats ?? 1;
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 32) throw new RangeError('Choose 1–32 finite choruses for export');
  const compiled = arrangeSong(song, options), events = [], tempos = [], meters = [];
  let seconds = 0, ticks = 0, countInEndTick = 0;
  const ticksFor = duration => valueOf(duration) * 4 * MIDI_PPQ;
  function append(step, bpm, countIn = false) {
    const quarterBpm = bpm * valueOf(compiled.song.tempoUnit) * 4;
    if (!tempos.length || tempos.at(-1).bpm !== quarterBpm) tempos.push({ tick: Math.round(ticks), bpm: quarterBpm });
    const meter = compiled.song.sections[step.sectionIndex].measures[step.measureIndex].meter;
    if (!meters.length || meters.at(-1).numerator !== meter.numerator || meters.at(-1).denominator !== meter.denominator) meters.push({ tick: Math.round(ticks), ...meter });
    const duration = secondsFor(step.duration,bpm,compiled.song.tempoUnit);
    for (const event of step.events) {
      if (countIn ? event.kind !== 'click' : !['note','drum','silence'].includes(event.kind)) continue;
      const at = seconds + secondsFor(event.offset ?? ZERO,bpm,compiled.song.tempoUnit);
      events.push({ event, countIn, at, duration: event.duration ? secondsFor(event.duration,bpm,compiled.song.tempoUnit) : duration,
        tick: Math.round(ticks + ticksFor(event.offset ?? ZERO)), ticks: Math.max(1,Math.round(ticksFor(event.duration ?? step.duration))) });
    }
    seconds += duration; ticks += ticksFor(step.duration);
    if (seconds > maxSeconds || events.length > 200000) throw new RangeError(`Export limit: ${maxSeconds / 60} minutes or 200000 events`);
  }
  const cache = new Map();
  for (let pass = 1; pass <= repeats; pass++) {
    const state = trainingState(song.key,pass,song.bpm,options.training ?? options);
    if (!cache.has(state.key)) cache.set(state.key,trainingArrangement(compiled,state));
    const steps = cache.get(state.key).steps;
    if (pass === 1 && options.countIn !== false) {
      for (const step of steps) { if (step.playbackBarIndex > 0) break; append(step,state.bpm,true); }
    }
    if (pass === 1) countInEndTick = Math.round(ticks);
    for (const step of steps) append(step,state.bpm);
  }
  return { title: song.title, events: events.sort((a,b)=>a.at-b.at), tempos, meters, duration: seconds, countInEndTick, endTick: Math.round(ticks), sound: normalizeSound(options.sound), mix: normalizeMix(options.mix) };
}

const ascii = text => [...text].map(c=>c.charCodeAt(0));
const u32 = value => [(value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255];
function variable(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0x0fffffff) throw new RangeError('Invalid MIDI delta');
  const bytes = [value & 127]; while ((value = Math.floor(value / 128))) bytes.unshift((value & 127) | 128); return bytes;
}
function meta(type, text) { const bytes = [...new TextEncoder().encode(text)]; return [255,type,...variable(bytes.length),...bytes]; }
function track(events,endTick) {
  events.sort((a,b)=>a.tick-b.tick || (a.priority ?? 0)-(b.priority ?? 0));
  const bytes = []; let previous = 0;
  for (const event of events) { bytes.push(...variable(event.tick-previous),...event.bytes); previous=event.tick; }
  bytes.push(...variable(Math.max(0,endTick-previous)),255,47,0);
  return [...ascii('MTrk'),...u32(bytes.length),...bytes];
}
export function encodeMidi(performance) {
  const conductor = [{tick:0,bytes:meta(3,performance.title || 'Metronom')}];
  for (const {tick,bpm} of performance.tempos) { const micros=Math.round(60000000/bpm); conductor.push({tick,bytes:[255,81,3,(micros>>>16)&255,(micros>>>8)&255,micros&255]}); }
  for (const meter of performance.meters) conductor.push({tick:meter.tick,bytes:[255,88,4,meter.numerator,Math.log2(meter.denominator),24,8]});
  const tracks=[track(conductor,performance.endTick)];
  const instruments=[['bass',1,performance.sound.bassTone==='electric'?33:32],['piano',0,{piano:0,electric:4,organ:16}[performance.sound.pianoTone]],['drums',9,0],['countIn',9,0]];
  for (const [part,channel,program] of instruments) {
    const mix=performance.mix[part] ?? {volume:1,muted:false};
    const events=[{tick:0,bytes:meta(3,part)}];
    if(channel!==9)events.push({tick:0,bytes:[192|channel,program]});
    if(part!=='countIn')events.push({tick:part==='drums'?performance.countInEndTick:0,bytes:[176|channel,7,Math.round(mix.volume*127)]});
    if(part==='countIn' && performance.countInEndTick)events.push({tick:0,bytes:[185,7,127]});
    const boundaries = performance.events.filter(item => item.event.kind === 'silence' && item.event.parts.includes(part)).map(item => item.tick);
    for(const item of performance.events) {
      const e=item.event, actual=item.countIn?'countIn':e.part;
      if(actual!==part || e.kind==='silence' || mix.muted)continue;
      const pitch=item.countIn?(e.accent?76:77):e.kind==='drum'?{kick:36,snare:38,hat:42}[e.sound]:e.midi;
      if(!Number.isInteger(pitch)||pitch<0||pitch>127)throw new RangeError('Invalid MIDI note');
      let end=Math.min(item.tick+item.ticks,performance.endTick);
      let low = 0, high = boundaries.length;
      while (low < high) { const mid = (low + high) >>> 1; if (boundaries[mid] <= item.tick) low = mid + 1; else high = mid; }
      if (low < boundaries.length) end = Math.min(end,boundaries[low]);
      if(end<=item.tick)continue;
      events.push({tick:item.tick,priority:1,bytes:[144|channel,pitch,Math.max(1,Math.min(127,Math.round((e.velocity??.3)*127)))]},{tick:end,priority:-1,bytes:[128|channel,pitch,0]});
    }
    tracks.push(track(events,performance.endTick));
  }
  const output=[...ascii('MThd'),0,0,0,6,0,1,0,tracks.length,(MIDI_PPQ>>>8)&255,MIDI_PPQ&255];
  for(const bytes of tracks)for(const byte of bytes)output.push(byte);
  return new Uint8Array(output);
}

export function encodeWav(channels, sampleRate) {
  if (!Array.isArray(channels) || ![1,2].includes(channels.length) || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 || channels.some(channel=>channel.length!==channels[0].length)) throw new RangeError('Invalid PCM audio');
  const frames=channels[0].length, size=frames*channels.length*2;
  if(size>0xffffffff-36)throw new RangeError('WAV too large');
  const output=new Uint8Array(44+size), view=new DataView(output.buffer);
  for(const [offset,text] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])output.set(ascii(text),offset);
  view.setUint32(4,36+size,true);view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels.length,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels.length*2,true);view.setUint16(32,channels.length*2,true);view.setUint16(34,16,true);view.setUint32(40,size,true);
  let at=44;
  for(let i=0;i<frames;i++)for(const channel of channels){const sample=Math.max(-1,Math.min(1,Number.isFinite(channel[i])?channel[i]:0));view.setInt16(at,Math.round(sample*(sample<0?32768:32767)),true);at+=2;}
  return output;
}
