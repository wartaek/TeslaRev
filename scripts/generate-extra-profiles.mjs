import { mkdir, writeFile } from 'node:fs/promises';

const sampleRate=48000,duration=2,frames=sampleRate*duration,targetRms=.15;
const anchors=[['idle',850],['low',1800],['mid',3800],['high',6500]];
const profiles=[
  {folder:'f1-v10',label:'REV F1 V10 synthetic',firing:5,drive:1.75,harmonics:[[1,.62,0],[2,.42,.2],[3,.27,.7],[5,.2,1.1]],whine:.08},
  {folder:'mclaren-v8',label:'REV McLaren-style V8 synthetic',firing:4,drive:1.55,harmonics:[[1,.72,0],[2,.3,.45],[3,.2,1.2],[4,.14,.1]],whine:.04},
  {folder:'voltic',label:'REV Voltic-style electric synthetic',firing:.72,drive:1.05,harmonics:[[1,.65,0],[2,.28,.3],[4,.16,.8],[8,.08,1.3]],whine:.42},
];

function wav(samples){const size=samples.length*2,out=Buffer.alloc(44+size);out.write('RIFF',0);out.writeUInt32LE(36+size,4);out.write('WAVE',8);out.write('fmt ',12);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(size,40);samples.forEach((v,i)=>out.writeInt16LE(Math.round(Math.max(-.85,Math.min(.85,v))*32767),44+i*2));return out;}
function loop(rpm,p){
  const requested=rpm/60*p.firing,cycles=Math.max(1,Math.round(requested*duration)),frequency=cycles/duration;
  const values=new Float64Array(frames);
  for(let i=0;i<frames;i++){
    const phase=2*Math.PI*frequency*i/sampleRate;
    let value=0;for(const [multiple,gain,offset] of p.harmonics)value+=gain*Math.sin(phase*multiple+offset);
    value+=p.whine*Math.sin(phase*7+.35)+p.whine*.55*Math.sin(phase*11+.8);
    values[i]=Math.tanh(value*(p.drive+rpm/12000));
  }
  const rms=Math.sqrt(values.reduce((sum,v)=>sum+v*v,0)/values.length),gain=targetRms/rms;
  return Float32Array.from(values,v=>v*gain);
}
for(const profile of profiles){
  const destination=`public/audio/${profile.folder}`;await mkdir(destination,{recursive:true});const report=[];
  for(const [name,rpm] of anchors){await writeFile(`${destination}/${name}.wav`,wav(loop(rpm,profile)));report.push({output:`${name}.wav`,referenceRpm:rpm,sampleRate,duration,rms:targetRms,source:'Generated deterministically by scripts/generate-extra-profiles.mjs'});}
  await writeFile(`${destination}/provenance.json`,JSON.stringify({license:'Project-generated audio',character:profile.label,processing:'Procedural periodic synthesis; no sampled trademark or game audio; mono PCM16 WAV.',samples:report},null,2));
}
console.log(`Generated ${profiles.length} extra sound profiles`);
