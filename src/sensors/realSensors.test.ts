import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RealSensors, gpsHealth, resolveGpsSpeed, responsiveSpeed, type PositionFix } from './realSensors';

const fix=(longitude:number,timestamp:number,accuracy=5):PositionFix=>({latitude:0,longitude,accuracy,timestamp});
test('first GPS fix starts at actual road speed, including above 130',()=>{
  const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  let success:PositionCallback|undefined;
  try {
    Object.defineProperty(globalThis,'window',{configurable:true,value:{isSecureContext:true}});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{watchPosition:(callback:PositionCallback)=>{success=callback;return 1;},clearWatch:()=>{}}}});
    const sensors=new RealSensors();sensors.start();
    success!({coords:{speed:150/3.6,accuracy:5,latitude:0,longitude:0},timestamp:Date.now()} as GeolocationPosition);
    const reading=sensors.snapshot(0);
    assert.equal(reading.ready,true);assert.ok(Math.abs(reading.input.speedKmh-150)<.001);
    assert.equal(reading.input.acceleration,0);
    sensors.stop();assert.equal(sensors.snapshot(0).ready,false);
  } finally {
    if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else Reflect.deleteProperty(globalThis,'navigator');
    if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');
  }
});

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

test('motion predicts speed between GPS fixes while remaining bounded around GPS',()=>{
  const gpsOnly=responsiveSpeed(20,40,3,false,.02);
  const predicted=responsiveSpeed(20,40,3,true,.02);
  assert.ok(predicted>gpsOnly);
  let speed=40;
  for(let i=0;i<100;i++)speed=responsiveSpeed(speed,40,5,true,.02);
  assert.ok(speed<=48);
});
