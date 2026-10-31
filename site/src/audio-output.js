// One audible bus per context. A recorder may tap it without routing the microphone to speakers.
const outputs=new WeakMap();
export function playbackOutput(context) {
 if(!outputs.has(context)){const gain=context.createGain();gain.gain.value=1;gain.connect(context.destination);outputs.set(context,gain);}
 return outputs.get(context);
}
