export interface DrivingInput { speedKmh: number; acceleration: number }
export interface EngineProfile { name: string; idleRpm: number; maxRpm: number; gearRatios: readonly number[]; finalDrive: number; wheelCircumferenceM: number }
export const V8: EngineProfile = { name: 'V8', idleRpm: 850, maxRpm: 6500, gearRatios: [4.1, 2.67, 1.88, 1.43, 1.16, 0.96], finalDrive: 3.7, wheelCircumferenceM: 2.1 };
export type EnginePhase = 'off' | 'idle' | 'drive' | 'overrun' | 'shift' | 'limiter';
export type GearboxMode = 'calm' | 'sport';
export interface DrivingState extends DrivingInput { rpm: number; gear: number; virtualThrottle: number; engineLoad: number; isMoving: boolean; timestamp: number; phase: EnginePhase; shiftCount: number }
export const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
export const smooth = (value: number, target: number, dt: number, tau: number) => value + (target - value) * (1 - Math.exp(-dt / tau));
export function wheelRpm(speed: number, gear: number, p: EngineProfile = V8) { return Math.max(0, speed) / 3.6 / p.wheelCircumferenceM * 60 * p.gearRatios[gear - 1] * p.finalDrive; }
export function throttleTarget(speed: number, acceleration: number) { return speed < 1.5 && acceleration <= 0 ? 0 : acceleration < -0.3 ? 0 : clamp(0.15 + acceleration / 3, 0, 1); }
// Perceptual road-car schedule, not Tesla transmission telemetry.
const roadShiftSpeeds = [15, 30, 50, 75, 105];
export function shiftSpeed(gear: number, load: number, mode: GearboxMode) {
  return (roadShiftSpeeds[gear - 1] ?? Infinity) * (mode === 'sport' ? 1.4 : 1) * (1 + .65 * clamp(load, 0, 1));
}
export function cruisingGear(speed: number, mode: GearboxMode, gears = 6) {
  let gear = 1;
  while (gear < gears && speed >= shiftSpeed(gear, .15, mode)) gear++;
  return gear;
}
export class VirtualEngine {
  state: DrivingState = { speedKmh: 0, acceleration: 0, rpm: 0, gear: 1, virtualThrottle: 0, engineLoad: 0, isMoving: false, timestamp: 0, phase: 'off', shiftCount: 0 };
  private running = false;
  private shiftRemaining = 0;
  private cooldown = 0;
  private dwell = 0;
  private candidate = 0;
  private stationaryTime = 0;
  constructor(readonly profile: EngineProfile = V8, public gearboxMode: GearboxMode = 'calm') {}
  start(speed = 0) {
    this.running = true;
    this.shiftRemaining = this.cooldown = this.dwell = this.stationaryTime = this.candidate = 0;
    let gear = cruisingGear(speed, this.gearboxMode, this.profile.gearRatios.length);
    while (gear < this.profile.gearRatios.length && wheelRpm(speed, gear, this.profile) > this.profile.maxRpm * .9) gear++;
    this.state = { ...this.state, speedKmh: Math.max(0, speed), acceleration: 0, gear, rpm: clamp(wheelRpm(speed, gear, this.profile), this.profile.idleRpm, this.profile.maxRpm), virtualThrottle: 0, engineLoad: 0, isMoving: speed > 3, phase: speed > 3 ? 'drive' : 'idle', shiftCount: 0, timestamp: 0 };
  }
  stop() { this.running = false; this.state = { ...this.state, rpm: 0, virtualThrottle: 0, engineLoad: 0, phase: 'off' }; }
  step(input: DrivingInput, dt: number): DrivingState {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1 || !Number.isFinite(input.speedKmh) || !Number.isFinite(input.acceleration)) throw new Error('Invalid engine input or time step');
    const s = { ...this.state, speedKmh: Math.max(0, input.speedKmh), acceleration: input.acceleration, timestamp: this.state.timestamp + dt };
    this.stationaryTime = s.speedKmh < 1.5 ? this.stationaryTime + dt : 0;
    s.isMoving = s.speedKmh > 3 ? true : this.stationaryTime >= 1 ? false : s.isMoving;
    if (!this.running) { this.state = s; return { ...s }; }
    const p = this.profile;
    const target = throttleTarget(s.speedKmh, s.acceleration);
    s.virtualThrottle = smooth(s.virtualThrottle, target, dt, target > s.virtualThrottle ? 0.08 : 0.18);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.shiftRemaining = Math.max(0, this.shiftRemaining - dt);
    if (this.stationaryTime >= 1) { s.gear = 1; this.shiftRemaining = 0; }
    const rawRpm = wheelRpm(s.speedKmh, s.gear, p);
    let next = s.gear;
    let hold = 0.15;
    if (!this.shiftRemaining && s.speedKmh > 3) {
      if (rawRpm >= p.maxRpm || this.cooldown === 0) {
        if ((s.speedKmh >= shiftSpeed(s.gear, s.virtualThrottle, this.gearboxMode) || rawRpm >= p.maxRpm) && s.gear < p.gearRatios.length) next++;
        else if (s.virtualThrottle > 0.8 && rawRpm < p.maxRpm * 0.55) {
          for (let g = Math.max(1, s.gear - 2); g < s.gear; g++) {
            const rpm = wheelRpm(s.speedKmh, g, p);
            if (s.speedKmh < shiftSpeed(g, s.virtualThrottle, this.gearboxMode) * .9 && rpm <= p.maxRpm * 0.85) { next = g; break; }
          }
        } else if (s.gear > 1 && s.speedKmh < shiftSpeed(s.gear - 1, .15, this.gearboxMode) * .72 && wheelRpm(s.speedKmh, s.gear - 1, p) < p.maxRpm * 0.9) { next--; hold = 0.3; }
      }
    }
    if (next !== s.gear) {
      this.dwell = this.candidate === next ? this.dwell + dt : dt;
      this.candidate = next;
      if (this.dwell >= hold || rawRpm >= p.maxRpm) { s.gear = next; s.shiftCount++; this.shiftRemaining = 0.22; this.cooldown = 1.02; this.dwell = 0; }
    } else { this.dwell = 0; this.candidate = 0; }
    const launchRpm = p.idleRpm + 1000 * s.virtualThrottle * clamp(1 - s.speedKmh / 15, 0, 1);
    const targetRpm = clamp(Math.max(launchRpm, wheelRpm(s.speedKmh, s.gear, p)), p.idleRpm, p.maxRpm);
    s.rpm = clamp(smooth(s.rpm, targetRpm, dt, this.shiftRemaining > 0 ? 0.055 : 0.1), p.idleRpm, p.maxRpm);
    s.engineLoad = s.virtualThrottle * (this.shiftRemaining > 0 ? 0.15 : 1);
    s.phase = this.shiftRemaining > 0 ? 'shift' : wheelRpm(s.speedKmh, s.gear, p) >= p.maxRpm ? 'limiter' : !s.isMoving && s.speedKmh < 1.5 ? 'idle' : s.acceleration < -0.3 ? 'overrun' : 'drive';
    this.state = s;
    return { ...s };
  }
}
