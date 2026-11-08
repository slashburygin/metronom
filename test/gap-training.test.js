import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGap, gapPhase } from '../site/src/gap-training.js';
import { Metronome } from '../site/src/metronome.js';

test('gap settings reject invalid values; phases follow full bars in different meters', () => {
  assert.deepEqual(normalizeGap({enabled:'yes',playBars:0,silentBars:NaN}), normalizeGap());
  for (const beats of [3,4,6,7]) {
    const gap=normalizeGap({enabled:true,playBars:2,silentBars:1});
    assert.deepEqual(Array.from({length:7},(_,bar)=>gapPhase(bar*beats,beats,gap)),[false,false,true,false,false,true,false]);
    assert.equal(gapPhase(3*beats-1,beats,gap),true);
  }
});
test('silent bars mute subdivisions on the audio clock without changing phase or pulse timing', async () => {
  const audible=[], visual=[], context={currentTime:0,resume:async()=>{}};
  const metronome=new Metronome({onTick:(beat,sub,silent)=>visual.push({beat,sub,silent})});
  metronome.playClick=(time,level)=>audible.push({time,level});
  metronome.gap=normalizeGap({enabled:true,playBars:1,silentBars:1});
  metronome.subdivision='eighths'; metronome.setBpm(120);
  const transport=metronome.transport;
  transport.context=context; transport.tickerFactory=()=>({start(){},stop(){}}); transport.requestFrame=()=>1; transport.cancelFrame=()=>{};
  await transport.start();
  for(let n=0;n<430;n++){context.currentTime=n/100;transport.schedule();transport.frame();}
  assert.ok(audible.some(event=>Math.abs(event.time-4.05)<1e-8));
  assert.equal(audible.filter(event=>event.time>=2.05-1e-8&&event.time<4.05-1e-8).length,0);
  assert.deepEqual(visual.filter(event=>event.silent).map(event=>event.sub),[0,1,0,1,0,1,0,1]);
  transport.stop();
  assert.equal(transport.nextStep(0).events[0].silent,false);
});
