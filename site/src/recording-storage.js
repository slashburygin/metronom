export const RECORDING_LIMIT=50, RECORDING_BYTES=200*1024*1024;
export async function openRecordings(factory=indexedDB) {
 const db=await new Promise((resolve,reject)=>{const request=factory.open('metronom-recordings',1);let blocked=false;request.onupgradeneeded=()=>request.result.createObjectStore('takes',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onblocked=()=>{blocked=true;reject(new Error('Recording database blocked'));};request.onsuccess=()=>{if(blocked){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};});
 function transaction(mode,action){return new Promise((resolve,reject)=>{const tx=db.transaction('takes',mode);let result,failure;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure||tx.error||new Error('Recording write aborted'));tx.onerror=()=>{};try{action(tx.objectStore('takes'),value=>{result=value;},error=>{failure=error;tx.abort();});}catch(error){failure=error;tx.abort();}});}
 return{
  list:()=>transaction('readonly',(store,done)=>{const request=store.getAll();request.onsuccess=()=>done(request.result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}),
  put(take){if(!take?.id||typeof take.title!=='string'||!(take.blob instanceof Blob)||!take.blob.size||take.blob.size>25*1024*1024||!Number.isFinite(take.duration)||take.duration<=0)throw new RangeError('Invalid recording');
   return transaction('readwrite',(store,done,fail)=>{const request=store.getAll();request.onsuccess=()=>{try{const others=request.result.filter(item=>item.id!==take.id);if(others.length>=RECORDING_LIMIT||others.reduce((sum,item)=>sum+item.blob.size,0)+take.blob.size>RECORDING_BYTES){fail(new RangeError('Recording storage limit: 50 takes or 200 MB'));return;}store.put(take);}catch(error){fail(error);}};});},
  remove:id=>transaction('readwrite',store=>{store.delete(id);}),close:()=>db.close(),
 };
}
