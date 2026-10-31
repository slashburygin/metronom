import { BackingPlayer } from './backing-player.js';
import { encodeWav } from './performance-export.js';
export async function renderWav(performance, { signal } = {}) {
  if(performance.duration>300)throw new RangeError('WAV limit: 5 minutes');
  if(typeof OfflineAudioContext==='undefined')throw new Error('Offline audio rendering is unavailable');
  signal?.throwIfAborted();
  const sampleRate=44100, context=new OfflineAudioContext(2,Math.max(1,Math.ceil(performance.duration*sampleRate)),sampleRate);
  const player=new BackingPlayer({context});player.sound=performance.sound;player.transport.endTime=performance.duration;
  for(const [part,mix] of Object.entries(performance.mix))player.channels[part].gain.setValueAtTime(mix.muted?0:mix.volume,0);
  try {
    for(const item of performance.events)player.schedule(item.event,{time:item.at,duration:item.duration,countIn:item.countIn});
    player.transport.clipAudio(performance.duration);
    const buffer=await context.startRendering();signal?.throwIfAborted();
    return encodeWav([buffer.getChannelData(0),buffer.getChannelData(1)],sampleRate);
  } finally { player.transport.dispose();player.reverb.dispose(); }
}
