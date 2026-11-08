import test from 'node:test';
import assert from 'node:assert/strict';
import { jazzMaterial, createPracticeDrone } from '../site/src/jazz-practice.js';
import { pitchClass } from '../site/src/pitch.js';
import { MAJOR_KEYS } from '../site/src/harmony.js';

test('jazz guide tones transpose correctly for every concert key and saxophone part', () => {
  for (const key of MAJOR_KEYS) for(const [instrument,shift] of [['C',0],['Bb',2],['Eb',9]]) {
    const result=jazzMaterial(key,instrument);
    assert.equal((pitchClass(result.writtenKey)-pitchClass(key)+12)%12,shift);
    result.lines.flat().forEach((note,index)=>assert.equal((pitchClass(note)-pitchClass(result.harmony.guideTones.flat()[index])+12)%12,shift));
  }
  assert.equal(jazzMaterial('B♭','Bb').writtenKey,'C');
  assert.equal(jazzMaterial('E♭','Eb').writtenKey,'C');
  assert.throws(()=>jazzMaterial('C','invalid'),RangeError);
});
test('stopping a pending drone prevents audio from starting after resume',async()=>{
  let resume,created=0;
  const drone=createPracticeDrone(()=>({resume:()=>new Promise(resolve=>{resume=resolve;}),createOscillator(){created++;}}));
  const starting=drone.start('C'); assert.equal(drone.active,true);
  drone.stop(); resume(); await starting;
  assert.equal(created,0); assert.equal(drone.active,false);
});
test('drone stops and disconnects voices, and can restart after failure',async()=>{
  const oscillators=[],gains=[];
  const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
  let fail=true;
  const context={currentTime:1,destination:{},async resume(){if(fail)throw Error('resume failed');},createOscillator(){const node={frequency:parameter(),connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}};oscillators.push(node);return node;},createGain(){const node={gain:parameter(),connect(){},disconnect(){this.disconnected=true;}};gains.push(node);return node;}};
  const drone=createPracticeDrone(()=>context);
  await assert.rejects(drone.start('C')); assert.equal(drone.active,false);
  fail=false;await drone.start('C');assert.equal(drone.active,true);assert.equal(oscillators[0].started,true);
  drone.stop();assert.equal(drone.active,false);assert.equal(oscillators[0].stopped,true);
  oscillators[0].onended();assert.equal(oscillators[0].disconnected,true);assert.equal(gains[0].disconnected,true);
});
