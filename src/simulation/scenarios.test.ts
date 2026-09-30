import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarios, ScenarioPlayer } from './scenarios';
import { VirtualEngine, type GearboxMode } from '../engine/virtualEngine';
function replay(id: string, mode: GearboxMode) {
  const player=new ScenarioPlayer(scenarios.find(s=>s.id===id)!);
  const engine=new VirtualEngine(undefined,mode);engine.start(player.initialSpeed);
  const trace=[];const shifts: number[]=[];
  while(!player.finished){const previous=engine.state.gear;const input=player.step(.02);const state=engine.step(input,.02);trace.push({...state});if(state.gear>previous)shifts.push(player.elapsed);}
  return {trace,shifts};
}
test('every scenario is repeatable and ends stationary without continuing time',()=>{
  for(const scenario of scenarios){
    const first=replay(scenario.id,'calm');assert.deepEqual(first,replay(scenario.id,'calm'));
    assert.equal(first.trace.at(-1)!.speedKmh,0);assert.ok(Math.abs(first.trace.at(-1)!.rpm-850)<1);
    assert.ok(first.trace.every(s=>s.speedKmh>=0&&s.speedKmh<=130&&s.rpm>=850&&s.rpm<=6500));
    const player=new ScenarioPlayer(scenario);player.step(player.duration);assert.deepEqual(player.step(.02),{speedKmh:0,acceleration:0});assert.equal(player.elapsed,player.duration);
  }
});
test('sport delays first upshift on identical city input',()=>{
  const calm=replay('city','calm');const sport=replay('city','sport');
  assert.deepEqual(calm.trace.map(s=>s.speedKmh),sport.trace.map(s=>s.speedKmh));
  assert.ok(calm.shifts.length>0&&sport.shifts.length>0);
  assert.ok(sport.shifts[0]>calm.shifts[0]);
});
test('scenario acceleration follows actual speed differences, including boundaries',()=>{
 const player=new ScenarioPlayer(scenarios[1]);let previous=player.initialSpeed;
 while(!player.finished){const input=player.step(.02);assert.ok(Math.abs(input.acceleration-(input.speedKmh-previous)/3.6/.02)<1e-10);previous=input.speedKmh;}
});
