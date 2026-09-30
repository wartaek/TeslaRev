import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gpsHealth, resolveGpsSpeed, type PositionFix } from './realSensors';

const fix=(longitude:number,timestamp:number,accuracy=5):PositionFix=>({latitude:0,longitude,accuracy,timestamp});

test('GPS uses a valid native speed without waiting for two positions',()=>{
  assert.deepEqual(resolveGpsSpeed(null,fix(0,1000),12.5),{speed:12.5,source:'native'});
});

test('GPS fallback suppresses stationary drift and calculates plausible movement',()=>{
  const previous=fix(0,1000);
  assert.deepEqual(resolveGpsSpeed(previous,fix(.00001,2000),null),{speed:0,source:'calculated'});
  const movement=resolveGpsSpeed(previous,fix(.0001,2000),null);
  assert.equal(movement?.source,'calculated');
  assert.ok(movement!==null&&movement.speed>8&&movement.speed<10);
});

test('GPS fallback rejects missing, badly timed and implausible fixes',()=>{
  assert.equal(resolveGpsSpeed(null,fix(0,1000),null),null);
  assert.equal(resolveGpsSpeed(fix(0,1000),fix(.0001,1100),null),null);
  assert.equal(resolveGpsSpeed(fix(0,1000),fix(.0001,7000),null),null);
  assert.equal(resolveGpsSpeed(fix(0,1000),fix(.01,2000),null),null);
});

test('GPS health switches to degraded at 2 seconds and lost at 5 seconds',()=>{
  assert.equal(gpsHealth(null),'waiting');
  assert.equal(gpsHealth(1.999),'fresh');
  assert.equal(gpsHealth(2),'degraded');
  assert.equal(gpsHealth(4.999),'degraded');
  assert.equal(gpsHealth(5),'lost');
});
