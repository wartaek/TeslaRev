import type { DrivingInput } from '../engine/virtualEngine';
export interface Scenario { id: string; name: string; description: string; points: readonly (readonly [number, number])[] }
export const scenarios: readonly Scenario[] = [
  { id: 'city', name: 'Ville', description: 'Deux départs, allure modérée et arrêts.', points: [[0,0],[2,0],[10,40],[16,40],[22,0],[25,0],[35,50],[41,50],[48,0],[50,0]] },
  { id: 'acceleration', name: 'Accélération franche', description: '0 à 100 km/h, puis freinage jusqu’à l’arrêt.', points: [[0,0],[2,0],[12,100],[17,100],[25,0],[27,0]] },
  { id: 'cruise', name: 'Croisière', description: 'Montée progressive à 70 km/h et vitesse stabilisée.', points: [[0,0],[2,0],[18,70],[38,70],[48,0],[50,0]] },
  { id: 'braking', name: 'Freinage', description: 'Départ à 100 km/h, freinage soutenu et retour au ralenti.', points: [[0,100],[5,100],[11,0],[14,0]] },
];
export class ScenarioPlayer {
  elapsed = 0;
  finished = false;
  constructor(readonly scenario: Scenario) {}
  get duration() { return this.scenario.points.at(-1)![0]; }
  get initialSpeed() { return this.scenario.points[0][1]; }
  private speedAt(time: number) {
    const points = this.scenario.points;
    const right = points.findIndex(p => p[0] > time);
    if (right < 0) return points.at(-1)![1];
    if (right === 0) return points[0][1];
    const [t0,v0] = points[right-1]; const [t1,v1] = points[right];
    return v0 + (v1-v0) * (time-t0)/(t1-t0);
  }
  step(dt: number): DrivingInput {
    if (!Number.isFinite(dt) || dt <= 0) throw new Error('Invalid scenario time step');
    const before = this.speedAt(this.elapsed);
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    this.finished = this.elapsed >= this.duration;
    const speedKmh = this.speedAt(this.elapsed);
    return { speedKmh, acceleration: (speedKmh-before)/3.6/dt };
  }
}
