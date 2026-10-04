import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSettings, loadSettings, saveSettings } from './settings';
test('settings preserve valid preferences and reject corrupt or obsolete values',()=>{
 const defaults=parseSettings(null);
 assert.deepEqual(parseSettings('invalid'),defaults);
 assert.deepEqual(parseSettings('null'),defaults);
 assert.deepEqual(parseSettings(JSON.stringify({volume:47,profileId:defaults.profileId,gearboxMode:'sport'})),{...defaults,volume:47,gearboxMode:'sport'});
 assert.deepEqual(parseSettings(JSON.stringify({volume:'50',profileId:'missing',gearboxMode:'unknown'})),defaults);
 assert.equal(parseSettings('{"volume":200}').volume,100);
 assert.equal(parseSettings('{"volume":-2}').volume,0);
 assert.equal(defaults.source,'real');
 assert.equal(parseSettings('{"source":"simulation"}').source,'simulation');
 assert.equal(parseSettings('{"source":"invalid"}').source,'real');
});
test('storage round trip and unavailable storage fallback',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let value:string|null=null;
 try {
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>value,setItem:(_key:string,data:string)=>{value=data;}}});
  const settings={...parseSettings(null),volume:33,gearboxMode:'sport' as const};assert.equal(saveSettings(settings),true);assert.deepEqual(loadSettings(),settings);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('denied');}});
  assert.deepEqual(loadSettings(),parseSettings(null));assert.equal(saveSettings(settings),false);
 } finally {if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');}
});
