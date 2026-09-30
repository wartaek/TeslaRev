import { mkdir, writeFile } from 'node:fs/promises';

const sampleRate = 48000;
const duration = 2;
const frames = sampleRate * duration;
const anchors = [['idle', 850], ['low', 1800], ['mid', 3800], ['high', 6500]];
const targetRms = .15;
const destination = 'public/audio/turbo-v8';

function wav(samples) {
  const dataSize = samples.length * 2;
  const output = Buffer.alloc(44 + dataSize);
  output.write('RIFF', 0); output.writeUInt32LE(36 + dataSize, 4); output.write('WAVE', 8);
  output.write('fmt ', 12); output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22); output.writeUInt32LE(sampleRate, 24); output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32); output.writeUInt16LE(16, 34); output.write('data', 36); output.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => output.writeInt16LE(Math.round(Math.max(-.85, Math.min(.85, sample)) * 32767), 44 + index * 2));
  return output;
}

function engineLoop(rpm) {
  const firing = rpm / 60 * 4;
  const cycles = Math.round(firing * duration);
  const frequency = cycles / duration;
  const samples = new Float64Array(frames);
  for (let i = 0; i < frames; i++) {
    const phase = 2 * Math.PI * frequency * i / sampleRate;
    const uneven = .72 * Math.sin(phase) + .31 * Math.sin(phase * 2 + .4) + .19 * Math.sin(phase * 3 + 1.1);
    const body = .22 * Math.sin(phase / 2) + .12 * Math.sin(phase * 4 + .2);
    samples[i] = Math.tanh((uneven + body) * (1.3 + rpm / 9000));
  }
  const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  const gain = targetRms / rms;
  return Float32Array.from(samples, value => value * gain);
}

await mkdir(destination, { recursive: true });
const report = [];
for (const [name, rpm] of anchors) {
  const samples = engineLoop(rpm);
  await writeFile(`${destination}/${name}.wav`, wav(samples));
  report.push({ output: `${name}.wav`, referenceRpm: rpm, sampleRate, duration, rms: targetRms, source: 'Generated deterministically by scripts/generate-turbo-v8.mjs' });
}
await writeFile(`${destination}/provenance.json`, JSON.stringify({ license: 'Project-generated audio', processing: 'Procedural periodic V8 pulse synthesis; mono PCM16 WAV.', samples: report }, null, 2));
console.log(`Generated ${anchors.length} REV V8 Turbo loops`);
