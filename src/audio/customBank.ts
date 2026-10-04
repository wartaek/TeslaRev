export interface RecordedLayer { rpm:number; wav:Blob; sourceName:string; start:number; end:number }
export interface CustomBank { name:string; layers:RecordedLayer[] }
export function prepareLoop(channels:readonly Float32Array[],sampleRate:number,start:number,end:number):ArrayBuffer {
  const length=channels[0]?.length??0;
  if(!Number.isFinite(sampleRate)||sampleRate<8000||!channels.length||channels.some(c=>c.length!==length))throw new Error('Audio invalide.');
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>length/sampleRate||end-start<.5||end-start>12)throw new Error('Choisis un extrait de 0,5 à 12 secondes dans le fichier.');
  const first=Math.floor(start*sampleRate),last=Math.floor(end*sampleRate);
  const mono=new Float32Array(last-first);
  for(const channel of channels)for(let i=0;i<mono.length;i++)mono[i]+=channel[first+i]/channels.length;
  const mean=mono.reduce((s,v)=>s+v,0)/mono.length;
  for(let i=0;i<mono.length;i++)mono[i]-=mean;
  const overlap=Math.floor(sampleRate*.06);
  const loop=new Float32Array(mono.length-overlap);
  loop.set(mono.subarray(overlap,mono.length-overlap));
  for(let i=0;i<overlap;i++){const t=i/(overlap-1);loop[loop.length-overlap+i]=mono[mono.length-overlap+i]*(1-t)+mono[i]*t;}
  let sum=0,peak=0;for(const value of loop){sum+=value*value;peak=Math.max(peak,Math.abs(value));}
  const rms=Math.sqrt(sum/loop.length);
  if(!Number.isFinite(rms)||rms<.0001)throw new Error('Extrait silencieux ou invalide : choisis un autre passage.');
  const gain=Math.min(.16/rms,.84/peak);
  const bytes=new ArrayBuffer(44+loop.length*2),view=new DataView(bytes);
  const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,loop.length*2,true);
  for(let i=0;i<loop.length;i++)view.setInt16(44+i*2,Math.round(loop[i]*gain*32767),true);
  return bytes;
}
export function validateRpms(rpms:readonly number[]) {
  if(!rpms.length||rpms.length>4||rpms.some(r=>!Number.isFinite(r)||r<600||r>15000)||new Set(rpms).size!==rpms.length)throw new Error('Indique 1 à 4 régimes distincts entre 600 et 15 000 RPM.');
}
async function database():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{const request=indexedDB.open('rev-custom-audio',1);request.onupgradeneeded=()=>request.result.createObjectStore('banks');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Ferme les autres fenêtres REV puis réessaie.'));});
}
async function accessBank(write?:CustomBank):Promise<CustomBank|null>{
  const db=await database();
  try{return await new Promise((resolve,reject)=>{
    const transaction=db.transaction('banks',write?'readwrite':'readonly'),store=transaction.objectStore('banks');
    const request=write?store.put(write,'personal'):store.get('personal');
    transaction.oncomplete=()=>resolve(write??request.result??null);
    transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error??new Error('Stockage interrompu.'));
  });}finally{db.close();}
}
export const loadCustomBank=()=>accessBank();
export const saveCustomBank=(bank:CustomBank)=>accessBank(bank);
