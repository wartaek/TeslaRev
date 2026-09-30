export interface AudioLayer { url: string; referenceRpm: number }
export interface AudioProfile { id: string; name: string; layers: readonly AudioLayer[]; turboGain?: number }

export const muscleCar: AudioProfile = {
  id: 'rl-musclecar02', name: 'MuscleCar02', turboGain: .42,
  layers: [
    { url: '/audio/musclecar/idle.wav', referenceRpm: 850 },
    { url: '/audio/musclecar/low.wav', referenceRpm: 1700 },
    { url: '/audio/musclecar/mid.wav', referenceRpm: 3600 },
    { url: '/audio/musclecar/high.wav', referenceRpm: 6500 },
  ],
};

export const turboV8: AudioProfile = {
  id: 'rev-turbo-v8', name: 'REV V8 Turbo', turboGain: .8,
  layers: [
    { url: '/audio/turbo-v8/idle.wav', referenceRpm: 850 },
    { url: '/audio/turbo-v8/low.wav', referenceRpm: 1800 },
    { url: '/audio/turbo-v8/mid.wav', referenceRpm: 3800 },
    { url: '/audio/turbo-v8/high.wav', referenceRpm: 6500 },
  ],
};

export const audioProfiles: readonly AudioProfile[] = [muscleCar, turboV8];

// Adjacent layers only, constant-power crossfade in logarithmic RPM space.
export function layerMix(rpm: number, profile: AudioProfile = muscleCar) {
  const layers = profile.layers;
  const weights = layers.map(() => 0);
  if (rpm <= layers[0].referenceRpm) weights[0] = 1;
  else if (rpm >= layers.at(-1)!.referenceRpm) weights[weights.length - 1] = 1;
  else {
    const right = layers.findIndex(l => l.referenceRpm > rpm);
    const t = Math.log(rpm / layers[right - 1].referenceRpm) / Math.log(layers[right].referenceRpm / layers[right - 1].referenceRpm);
    weights[right - 1] = Math.cos(t * Math.PI / 2);
    weights[right] = Math.sin(t * Math.PI / 2);
  }
  return layers.map((l, i) => ({ gain: weights[i], rate: Math.min(2, Math.max(0.5, rpm / l.referenceRpm)) }));
}
