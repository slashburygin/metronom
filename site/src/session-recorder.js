import { playbackOutput } from './audio-output.js';
import { libraryId } from './library-revisions.js';
export const RECORDING_TYPES=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'];
export function recordingTypes(Recorder=globalThis.MediaRecorder) { return Recorder?RECORDING_TYPES.filter(type=>Recorder.isTypeSupported?.(type)):[]; }
export class SessionRecorder {
 constructor({getContext,onUpdate=()=>{},onTake=()=>{},devices=globalThis.navigator?.mediaDevices,Recorder=globalThis.MediaRecorder,secure=globalThis.isSecureContext}={}) {
  Object.assign(this,{getContext,onUpdate,onTake,devices,Recorder,secure});this.state='idle';this.generation=0;this.inputLevel=1;
 }
 async start({title='',format='',backing=true,inputLevel=1}={}) {
  if(['requesting','recording','stopping'].includes(this.state))return;
  if(!this.secure||!this.devices?.getUserMedia||!this.Recorder){this.state='unsupported';this.onUpdate();return;}
  if(format&&!recordingTypes(this.Recorder).includes(format)){this.state='unsupported';this.onUpdate();return;}
  const generation=++this.generation;this.state='requesting';this.failure='';this.onUpdate();
  let stream;
  try{
   stream=await this.devices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
   if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
   const context=this.getContext();this.context=context;this.stream=stream;await context.resume();
   if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
   this.destination=context.createMediaStreamDestination();this.mix=context.createGain();this.mix.gain.value=.65;this.limiter=context.createDynamicsCompressor();this.limiter.threshold.value=-6;this.limiter.knee.value=6;this.limiter.ratio.value=20;this.limiter.attack.value=.003;this.limiter.release.value=.1;this.mix.connect(this.limiter).connect(this.destination);
   this.source=context.createMediaStreamSource(stream);this.input=context.createGain();this.source.connect(this.input);this.setInputLevel(inputLevel);this.input.connect(this.mix);
   this.analyser=context.createAnalyser();this.analyser.fftSize=1024;this.samples=new Float32Array(1024);this.input.connect(this.analyser);
   if(backing){this.backing=playbackOutput(context);this.backing.connect(this.mix);}
   const type=format||recordingTypes(this.Recorder)[0],options={audioBitsPerSecond:128000,...(type?{mimeType:type}:{})};
   const recorder=this.recorder=new this.Recorder(this.destination.stream,options),chunks=[];let size=0;
   recorder.ondataavailable=event=>{if(event.data?.size){chunks.push(event.data);size+=event.data.size;if(size>20*1024*1024)this.stop();}};
   recorder.onerror=()=>{this.failure='encoding';this.stop();};
   recorder.onstop=()=>{
    const duration=Math.max(.001,(performance.now()-this.startedAt)/1000),mime=recorder.mimeType||chunks[0]?.type||'audio/webm',blob=new Blob(chunks,{type:mime});
    this.release();this.recorder=null;this.state=this.failure?'error':'idle';this.onUpdate();
    if(blob.size)this.onTake({id:libraryId(),title:title.slice(0,160),createdAt:new Date().toISOString(),duration,mime,blob,backing,incomplete:Boolean(this.failure)});
   };
   for(const track of stream.getAudioTracks())track.addEventListener('ended',()=>{if(generation===this.generation&&this.state==='recording'){this.failure='input-ended';this.stop();}});
   recorder.start(1000);this.startedAt=performance.now();this.state='recording';this.timeout=setTimeout(()=>this.stop(),10*60*1000);this.onUpdate();
  }catch(error){stream?.getTracks().forEach(track=>track.stop());if(generation!==this.generation)return;this.release();this.state=error.name==='NotAllowedError'?'denied':'error';this.onUpdate();}
 }
 setInputLevel(value){this.inputLevel=Number.isFinite(value)?Math.max(0,Math.min(2,value)):1;if(this.input)this.input.gain.setValueAtTime(this.inputLevel,this.context.currentTime);}
 level(){if(!this.analyser)return 0;this.analyser.getFloatTimeDomainData(this.samples);return Math.min(1,Math.sqrt(this.samples.reduce((sum,x)=>sum+x*x,0)/this.samples.length));}
 detach(){try{this.source?.disconnect();this.input?.disconnect();this.analyser?.disconnect();this.backing?.disconnect(this.mix);}catch{}this.stream?.getTracks().forEach(track=>track.stop());this.source=this.input=this.analyser=this.backing=this.stream=null;}
 release(){clearTimeout(this.timeout);this.detach();try{this.mix?.disconnect();this.limiter?.disconnect();this.destination?.stream.getTracks().forEach(track=>track.stop());}catch{}this.mix=this.limiter=this.destination=null;}
 stop(){
  if(this.state==='requesting'){++this.generation;this.release();this.state='idle';this.onUpdate();return;}
  if(this.state!=='recording')return;
  this.state='stopping';clearTimeout(this.timeout);this.detach();this.onUpdate();
  try{this.recorder.stop();}catch{this.release();this.state='error';this.onUpdate();}
 }
}
