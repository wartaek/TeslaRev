import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioProfiles, layerMix, muscleCar } from './profile';
import { readFileSync } from 'node:fs';
test('RPM sweep keeps crossfade power continuous with two adjacent voices maximum', () => {
  let previous = layerMix(850);
  for (let rpm = 850; rpm <= 6500; rpm++) {
    const mix = layerMix(rpm);
    assert.ok(Math.abs(mix.reduce((sum,l) => sum + l.gain ** 2,0) - 1) < 1e-10);
    assert.ok(mix.filter(l => l.gain > 0).length <= 2);
    mix.forEach((layer,i) => { assert.ok(Math.abs(layer.gain - previous[i].gain) < 0.01); assert.ok(layer.rate >= .5 && layer.rate <= 2); });
    previous = mix;
  }
});
test('anchors select their own sample at native pitch', () => {
  muscleCar.layers.forEach((layer,i) => { const mix = layerMix(layer.referenceRpm); assert.equal(mix[i].gain,1); assert.equal(mix[i].rate,1); });
});
test('isolated game profiles keep exactly one engine voice throughout the RPM range',()=>{
  for(const profile of audioProfiles.filter(p=>p.layers.length===1)){
    for(let rpm=850;rpm<=7500;rpm+=25){
      const mix=layerMix(rpm,profile);
      assert.equal(mix.length,1);assert.equal(mix[0].gain,1);
      assert.ok(mix[0].rate>=.25&&mix[0].rate<=2);
    }
    assert.ok(layerMix(6500,profile)[0].rate>layerMix(850,profile)[0].rate);
  }
});
test('prepared PCM loops are non-silent, bounded and have no abnormal wrap discontinuity', () => {
  for(const profile of audioProfiles) for(const layer of profile.layers) {
    const bytes = readFileSync(new URL('../../public' + layer.url,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    let offset = 12, data: Buffer | undefined;
    while (offset + 8 <= bytes.length) { const size = bytes.readUInt32LE(offset+4); if(bytes.toString('ascii',offset,offset+4)==='data') data=bytes.subarray(offset+8,offset+8+size); offset += 8+size+(size%2); }
    assert.ok(data && data.length > 96000);
    const samples = Array.from({length:data.length/2},(_,i)=>data!.readInt16LE(i*2)/32768);
    const rms = Math.sqrt(samples.reduce((s,v)=>s+v*v,0)/samples.length);
    assert.ok(rms > .1 && rms < .2);
    assert.ok(samples.every(v=>Math.abs(v)<.86));
    const deltaRms = Math.sqrt(samples.slice(1).reduce((s,v,i)=>s+(v-samples[i])**2,0)/(samples.length-1));
    assert.ok(Math.abs(samples[0]-samples.at(-1)!) < 4*deltaRms);
  }
});
