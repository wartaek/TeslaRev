import { clamp, type DrivingInput } from '../engine/virtualEngine';
export class DrivingSimulator {
  speedKmh = 0;
  throttle = 0;
  brake = 0;
  targetSpeed = 0;
  accelerationCommand = 0;
  mode: 'pedals' | 'speed' | 'acceleration' = 'pedals';
  step(dt: number): DrivingInput {
    const before = this.speedKmh;
    const acceleration = this.mode === 'speed' ? clamp((this.targetSpeed - before) / 3.6 / 0.5, -6, 3.5) : this.mode === 'acceleration' ? this.accelerationCommand : this.throttle * 3.5 - this.brake * 7 - (before > 0 ? 0.12 + 0.00004 * before ** 2 : 0);
    this.speedKmh = clamp(before + acceleration * dt * 3.6, 0, 130);
    return { speedKmh: this.speedKmh, acceleration: (this.speedKmh - before) / 3.6 / dt };
  }
}
