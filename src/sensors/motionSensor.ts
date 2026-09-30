import { clamp } from '../engine/virtualEngine';

export type MotionAxis = 'x' | 'y' | 'z';
type PermissionConstructor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };

export class MotionSensor {
  axis: MotionAxis = 'y';
  sign: 1 | -1 = 1;
  private generation = 0;
  private listening = false;
  private calibrated = false;
  private calibrating = false;
  private deadline = 0;
  private samples: number[] = [];
  private firstSample = 0;
  private bias = 0;
  private value = 0;
  private lastAt = 0;
  private message = 'Accéléromètre facultatif : calibration nécessaire';
  private stationary: () => boolean = () => false;

  configure(axis: MotionAxis, sign: 1 | -1) {
    this.stop();
    this.axis = axis;
    this.sign = sign;
  }

  async calibrate(stationary: () => boolean) {
    this.stop();
    const token = this.generation;
    if (!window.isSecureContext || typeof DeviceMotionEvent === 'undefined') {
      this.message = 'Accéléromètre indisponible : utilisation du GPS';
      return;
    }
    this.message = 'Autorisation du mouvement…';
    try {
      const ctor = DeviceMotionEvent as PermissionConstructor;
      if (ctor.requestPermission && await ctor.requestPermission() !== 'granted') {
        if (token === this.generation) this.message = 'Mouvement refusé : utilisation du GPS';
        return;
      }
      if (token !== this.generation) return;
      if (!stationary()) { this.message = 'Calibration impossible : GPS valide et véhicule arrêté requis'; return; }
      this.stationary = stationary;
      this.calibrating = true;
      this.deadline = performance.now() + 5000;
      this.message = 'Calibration : téléphone fixé, reste immobile pendant 2 secondes';
      window.addEventListener('devicemotion', this.onMotion);
      window.addEventListener('orientationchange', this.onOrientation);
      this.listening = true;
    } catch {
      if (token === this.generation) this.message = 'Autorisation indisponible : utilisation du GPS';
    }
  }

  private onOrientation = () => {
    this.stop();
    this.message = 'Orientation modifiée : recalibre le téléphone à l’arrêt';
  };

  private onMotion = (event: DeviceMotionEvent) => {
    // Never substitute accelerationIncludingGravity: tilting would simulate a pedal input.
    const a = event.acceleration;
    if (!a || a.x === null || a.y === null || a.z === null || ![a.x, a.y, a.z].every(Number.isFinite)) return;
    const now = performance.now();
    const raw = a[this.axis]! * this.sign;
    if (this.calibrating) {
      if (!this.stationary() || Math.hypot(a.x, a.y, a.z) > 1.5) {
        this.stop(); this.message = 'Mouvement détecté : recommence la calibration à l’arrêt'; return;
      }
      if (!this.firstSample) this.firstSample = now;
      this.samples.push(raw);
      if (now - this.firstSample < 2000 || this.samples.length < 30) return;
      const mean = this.samples.reduce((sum, v) => sum + v, 0) / this.samples.length;
      const variance = this.samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / this.samples.length;
      if (variance > 0.04) {
        this.stop(); this.message = 'Téléphone instable : recommence la calibration'; return;
      }
      this.bias = mean;
      this.calibrating = false;
      this.calibrated = true;
      this.samples = [];
      this.message = 'Accéléromètre calibré';
    }
    this.value = clamp(Math.abs(raw - this.bias) < 0.12 ? 0 : raw - this.bias, -8, 5);
    this.lastAt = now;
  };

  snapshot() {
    const now = performance.now();
    if (this.calibrating && now > this.deadline) {
      this.stop(); this.message = 'Pas assez de mesures : utilisation du GPS, calibration à réessayer';
    }
    const ready = this.calibrated && now - this.lastAt < 300;
    return { ready, calibrating: this.calibrating, acceleration: ready ? this.value : 0,
      status: this.calibrated && !ready ? 'Accéléromètre interrompu : utilisation du GPS' : this.message };
  }

  stop() {
    ++this.generation;
    if (this.listening) {
      window.removeEventListener('devicemotion', this.onMotion);
      window.removeEventListener('orientationchange', this.onOrientation);
    }
    this.listening = false; this.calibrated = false; this.calibrating = false;
    this.samples = []; this.firstSample = 0; this.lastAt = 0; this.value = 0;
    this.message = 'Accéléromètre facultatif : calibration nécessaire';
  }
}
