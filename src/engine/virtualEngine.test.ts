import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VirtualEngine, V8, wheelRpm, throttleTarget } from './virtualEngine';
import { DrivingSimulator } from '../simulation/drivingSimulator';
function advance(e: VirtualEngine, speed: number, acceleration: number, seconds: number) { for(let i=0;i<Math.round(seconds/0.02);i++) e.step({speedKmh:speed,acceleration},0.02); return e.state; }
test('wheel RPM reflects gearing and wheel circumference',()=> { assert.ok(Math.abs(wheelRpm(50,1)-6019.84)<1); assert.ok(wheelRpm(50,2)<wheelRpm(50,1)); });
test('off engine produces no RPM or load',()=>{ const e=new VirtualEngine(); advance(e,70,2,1); assert.equal(e.state.rpm,0); assert.equal(e.state.phase,'off'); });
test('idle and stop',()=>{const e=new VirtualEngine();e.start();advance(e,0,0,2);assert.equal(e.state.rpm,850);assert.equal(e.state.gear,1);assert.equal(e.state.phase,'idle');e.stop();assert.equal(e.state.rpm,0);assert.equal(e.state.engineLoad,0);});
test('virtual throttle is bounded and reacts to acceleration and deceleration',()=>{assert.equal(throttleTarget(0,0),0);assert.equal(throttleTarget(70,0),0.15);assert.equal(throttleTarget(70,4),1);assert.equal(throttleTarget(70,-1),0);const e=new VirtualEngine();e.start(50);advance(e,50,3,0.1);assert.ok(e.state.virtualThrottle>0.5&&e.state.virtualThrottle<1);advance(e,50,-2,1);assert.ok(e.state.virtualThrottle<0.01);assert.equal(e.state.phase,'overrun');});
test('drive beyond 130 produces upshifts with RPM drops and bounded output',()=>{const e=new VirtualEngine();const sim=new DrivingSimulator();e.start();sim.throttle=0.8;let drops=0;for(let i=0;i<2000;i++){const before=e.state;const s=e.step(sim.step(0.02),0.02);assert.ok(s.rpm>=850&&s.rpm<=6500);if(s.gear>before.gear){assert.ok(s.rpm<before.rpm);drops++;}}assert.ok(drops>=4);assert.ok(sim.speedKmh>130);});
test('gentle launch shifts near 15-20 km/h and harder acceleration extends first gear',()=>{
  const launch=(acceleration:number)=>{const e=new VirtualEngine();e.start();let speed=0;for(let i=0;i<5000;i++){speed+=acceleration*.02*3.6;e.step({speedKmh:speed,acceleration},.02);if(e.state.gear===2)return speed;}throw new Error('No upshift');};
  const gentle=launch(.4),hard=launch(3);
  assert.ok(gentle>=15&&gentle<=20);assert.ok(hard>gentle+4);
});
test('starting while moving selects a road gear and does not cap real speed',()=>{
  for(const [speed,gear] of [[20,2],[40,3],[70,4],[100,5],[150,6]]){const e=new VirtualEngine();e.start(speed);assert.equal(e.state.gear,gear);advance(e,speed,0,4);assert.equal(e.state.gear,gear);assert.equal(e.state.speedKmh,speed);}
});
test('steady cruise does not hunt between gears',()=>{const e=new VirtualEngine();e.start(70);advance(e,70,0,5);const gear=e.state.gear;const count=e.state.shiftCount;const rpm=e.state.rpm;advance(e,70,0,20);assert.equal(e.state.gear,gear);assert.equal(e.state.shiftCount,count);assert.ok(Math.abs(e.state.rpm-rpm)<2);});
test('strong acceleration triggers a safe kickdown',()=>{const e=new VirtualEngine();e.start(70);advance(e,70,0,3);const before=e.state.gear;advance(e,70,3,0.5);assert.ok(e.state.gear<before);assert.ok(wheelRpm(70,e.state.gear)<V8.maxRpm*0.9);});
test('braking downshifts and returns to first gear and idle',()=>{const e=new VirtualEngine();e.start(100);const initial=e.state.gear;for(let speed=100;speed>0;speed-=0.15)e.step({speedKmh:speed,acceleration:-2.0833},0.02);advance(e,0,0,3);assert.ok(e.state.gear<initial);assert.equal(e.state.gear,1);assert.ok(Math.abs(e.state.rpm-850)<1);assert.equal(e.state.isMoving,false);});
test('large speed uses limiter without exceeding maximum',()=>{const e=new VirtualEngine();e.start(400);advance(e,400,0,2);assert.equal(e.state.phase,'limiter');assert.equal(e.state.rpm,6500);});
test('reject invalid time and sensor data',()=>{const e=new VirtualEngine();assert.throws(()=>e.step({speedKmh:NaN,acceleration:0},0.02));assert.throws(()=>e.step({speedKmh:0,acceleration:0},1));});
test('simulator supports stable target, braking and acceleration command',()=>{const s=new DrivingSimulator();s.mode='speed';s.targetSpeed=70;for(let i=0;i<1500;i++)s.step(.02);assert.ok(Math.abs(s.speedKmh-70)<.01);s.mode='pedals';s.brake=1;for(let i=0;i<500;i++)s.step(.02);assert.equal(s.speedKmh,0);s.mode='acceleration';s.accelerationCommand=2;assert.ok(Math.abs(s.step(.02).acceleration-2)<.001);});
