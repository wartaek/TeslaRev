import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareLoop,validateRpms} from './customBank';
test('personal loop crops audio, removes DC, bounds peaks and joins the seam',()=>{
  const sr=48000,channel=Float32Array.from({length:sr*3},(_,i)=>.2+.25*Math.sin(i*2*Math.PI*97/sr));
  const wav=prepareLoop([channel,channel],sr,.3,1.9),view=new DataView(wav);
  assert.equal(new TextDecoder().decode(wav.slice(0,4)),'RIFF');assert.equal(view.getUint32(24,true),sr);assert.equal(view.getUint16(22,true),1);
  assert.equal(view.getUint32(40,true),(Math.floor(1.9*sr)-Math.floor(.3*sr)-Math.floor(.06*sr))*2);
  const values=Array.from({length:(wav.byteLength-44)/2},(_,i)=>view.getInt16(44+i*2,true)/32767);
  const mean=values.reduce((a,b)=>a+b,0)/values.length,rms=Math.sqrt(values.reduce((a,b)=>a+b*b,0)/values.length);
  assert.ok(Math.abs(mean)<.002);assert.ok(rms>.15&&rms<.17);assert.ok(Math.max(...values.map(Math.abs))<.85);
  assert.ok(Math.abs(values[0]-values.at(-1)!)<.02);
});
test('personal import rejects silent audio, invalid crops and ambiguous RPM anchors',()=>{
  const silence=new Float32Array(48000);
  assert.throws(()=>prepareLoop([silence],48000,0,1),/silencieux/);
  for(const [start,end] of [[-.1,1],[0,2],[0,.1],[NaN,1]])assert.throws(()=>prepareLoop([silence],48000,start,end));
  for(const rpms of [[],[850,850],[NaN],[0],[16000]])assert.throws(()=>validateRpms(rpms));
  validateRpms([6500,850,1800,3800]);
});
