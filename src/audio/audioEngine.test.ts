import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EngineAudio, cabinResponse } from './audioEngine';
import { VirtualEngine } from '../engine/virtualEngine';
test('cabin sound is present at gentle load and remains softer than exterior tuning',()=>{
  const gentle=cabinResponse(.15,1800),hard=cabinResponse(1,1800);
  assert.ok(gentle.level>=.5);assert.ok(hard.level>gentle.level);assert.ok(hard.level<=.9);
  assert.ok(gentle.cutoff<1500);assert.ok(hard.cutoff>gentle.cutoff&&hard.cutoff<3800);
});
class Param { value=0; setTargetAtTime(v:number){this.value=v;} cancelAndHoldAtTime(){} linearRampToValueAtTime(v:number){this.value=v;} }
class Node { gain=new Param(); frequency=new Param(); Q=new Param(); playbackRate=new Param(); threshold=new Param(); knee=new Param(); ratio=new Param(); attack=new Param(); release=new Param(); onended?:()=>void; connect(_node:unknown){return _node;} disconnect(){} start(){} stop(){this.onended?.();} getFloatTimeDomainData(data:Float32Array){data.fill(0);} }
class Context { state='running'; currentTime=0; baseLatency=.01; destination=new Node(); resume(){return Promise.resolve();} close(){this.state='closed';return Promise.resolve();} decodeAudioData(){return Promise.resolve({});} createGain(){return new Node();} createBiquadFilter(){return new Node();} createDynamicsCompressor(){return new Node();} createAnalyser(){return new Node();} createBufferSource(){return new Node();} createOscillator(){return new Node();} }
test('audio lifecycle: cancellation, retry, caching, start/stop and dispose',async()=>{
  const originalContext=globalThis.AudioContext; const originalFetch=globalThis.fetch;
  let requests=0; let fail=false; let unblock:(()=>void)|undefined;
  let gate=Promise.resolve();
  Object.defineProperty(globalThis,'AudioContext',{configurable:true,writable:true,value:Context});
  globalThis.fetch=async()=>{requests++; await gate; return new Response(new ArrayBuffer(1),{status:fail?404:200});};
  try {
    const audio=new EngineAudio();
    gate=new Promise<void>(resolve=>{unblock=resolve;});
    const pending=audio.start(); audio.stop(); unblock!();
    assert.equal(await pending,false); assert.equal(audio.diagnostics().voices,0);
    await audio.start(); assert.equal(requests,4); assert.equal(audio.diagnostics().voices,4);
    const e=new VirtualEngine();e.start();audio.update(e.state);audio.setVolume(0);
    audio.stop();assert.equal(audio.diagnostics().voices,0);
    await audio.start();assert.equal(requests,4);audio.dispose();assert.equal(audio.diagnostics().state,'closed');
    const retry=new EngineAudio();fail=true;await assert.rejects(retry.start(),/introuvable/);assert.equal(retry.diagnostics().voices,0);
    fail=false;await retry.start();assert.equal(retry.diagnostics().loaded,4);retry.dispose();
  } finally { globalThis.AudioContext=originalContext;globalThis.fetch=originalFetch; }
});
