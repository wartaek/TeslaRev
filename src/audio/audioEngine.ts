import type { DrivingState } from '../engine/virtualEngine';
import { muscleCar, layerMix, type AudioProfile } from './profile';
type Voice = { source: AudioBufferSourceNode; gain: GainNode };
type Transient = { source:OscillatorNode; filter:BiquadFilterNode; gain:GainNode };
type TurboVoice = { source:OscillatorNode; filter:BiquadFilterNode; gain:GainNode };
export class EngineAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private filter?: BiquadFilterNode;
  private analyser?: AnalyserNode;
  private effects?: GainNode;
  private meter = new Float32Array(512);
  private buffers?: AudioBuffer[];
  private loading?: Promise<void>;
  private voices: Voice[] = [];
  private generation = 0;
  private volume = 0.2;
  private lastState?: DrivingState;
  private lastBurbleAt = -1;
  private lastLimiterPulse = -1;
  private transients = new Set<Transient>();
  private turbo?: TurboVoice;
  constructor(readonly profile: AudioProfile = muscleCar) {}

  private initialize() {
    if (this.context) return this.context;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.context = ctx;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass'; this.filter.Q.value = 0.6;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10; compressor.knee.value = 6;
    compressor.ratio.value = 8; compressor.attack.value = 0.003; compressor.release.value = 0.15;
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512;
    this.filter.connect(this.master).connect(compressor).connect(this.analyser).connect(ctx.destination);
    this.effects = ctx.createGain(); this.effects.gain.value = 1;
    this.effects.connect(compressor);
    return ctx;
  }

  // Called directly from the Start gesture: resume happens before any fetch.
  async start(): Promise<boolean> {
    const token = ++this.generation;
    const ctx = this.initialize();
    const resumed = ctx.resume();
    if (!this.buffers && !this.loading) {
      this.loading = Promise.all(this.profile.layers.map(async layer => {
        const response = await fetch(layer.url);
        if (!response.ok) throw new Error(`Sample introuvable : ${layer.url}`);
        return ctx.decodeAudioData(await response.arrayBuffer());
      })).then(buffers => { this.buffers = buffers; }).finally(() => { this.loading = undefined; });
    }
    await Promise.all([resumed, this.loading]);
    if (token !== this.generation) return false;
    if (ctx.state !== 'running') throw new Error('Audio suspendu : réessayer avec le bouton Démarrer.');
    this.releaseVoices();
    this.lastState = undefined; this.lastBurbleAt = this.lastLimiterPulse = -1;
    this.voices = this.buffers!.map(buffer => {
      const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
      const gain = ctx.createGain(); gain.gain.value = 0;
      source.connect(gain).connect(this.filter!); source.start();
      return { source, gain };
    });
    if (this.profile.turboGain) {
      const source=ctx.createOscillator();source.type='sine';source.frequency.value=900;
      const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.Q.value=5;filter.frequency.value=1800;
      const gain=ctx.createGain();gain.gain.value=0;
      source.connect(filter).connect(gain).connect(this.effects!);source.start();
      this.turbo={source,filter,gain};
    }
    return true;
  }

  update(state: DrivingState) {
    const previous = this.lastState;
    this.lastState = state;
    const ctx = this.context;
    if (!ctx || !this.voices.length) return;
    const now = ctx.currentTime;
    const load = Math.min(1, Math.max(0, state.engineLoad));
    const mix = layerMix(state.rpm, this.profile);
    this.voices.forEach((voice, i) => {
      voice.source.playbackRate.setTargetAtTime(mix[i].rate, now, 0.025);
      voice.gain.gain.setTargetAtTime(mix[i].gain, now, 0.025);
    });
    this.filter!.frequency.setTargetAtTime(900 + load * 6500 + state.rpm * 0.2, now, 0.035);
    if(this.turbo){
      const boost=Math.max(0,(load-.18)/.82)*Math.max(0,(state.rpm-1400)/5100);
      this.turbo.source.frequency.setTargetAtTime(900+state.rpm*.52,now,.04);
      this.turbo.filter.frequency.setTargetAtTime(1300+state.rpm*.48,now,.04);
      this.turbo.gain.gain.setTargetAtTime(this.volume*this.profile.turboGain!*boost*.22,now,.035);
    }
    if (previous && state.shiftCount > previous.shiftCount) this.playTransient('shift', state);
    if(this.profile.turboGain&&previous&&previous.rpm>2200&&previous.engineLoad>.45&&(previous.engineLoad-state.engineLoad>.28||state.shiftCount>previous.shiftCount))this.playTransient('wastegate',state);
    if (state.phase === 'overrun' && state.rpm > 1800 && state.speedKmh > 8 && state.timestamp-this.lastBurbleAt >= .18) {
      this.lastBurbleAt=state.timestamp; this.playTransient('burble',state);
    }
    if (state.phase === 'limiter' && state.timestamp-this.lastLimiterPulse >= .09) {
      this.lastLimiterPulse=state.timestamp; this.playTransient('limiter',state);
    }
    const limiter = state.phase === 'limiter' && state.timestamp%(.09) < .038 ? 0.16 : 1;
    const shift = state.phase === 'shift' ? 0.38 : 1;
    const level = state.phase === 'off' ? 0 : this.volume * (0.3 + 0.7 * load) * limiter * shift;
    this.master!.gain.setTargetAtTime(level, now, 0.025);
  }

  private playTransient(kind:'shift'|'burble'|'limiter'|'wastegate',state:DrivingState) {
    const ctx=this.context, output=this.effects;
    if(!ctx||!output||ctx.state!=='running'||this.volume===0)return;
    const now=ctx.currentTime;
    const oscillator=ctx.createOscillator();
    const filter=ctx.createBiquadFilter(); filter.type='lowpass'; filter.Q.value=1.2;
    const gain=ctx.createGain(); gain.gain.setValueAtTime(.0001,now);
    if(kind==='shift'){
      oscillator.type='triangle';oscillator.frequency.setValueAtTime(105,now);oscillator.frequency.exponentialRampToValueAtTime(48,now+.13);
      filter.frequency.value=520;gain.gain.exponentialRampToValueAtTime(Math.max(.0001,this.volume*.38),now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.14);
    }else if(kind==='burble'){
      const variation=1+(Math.floor(state.timestamp*10)%3)*.12;
      oscillator.type='sawtooth';oscillator.frequency.setValueAtTime(72*variation,now);oscillator.frequency.exponentialRampToValueAtTime(38,now+.055);
      filter.frequency.value=380;gain.gain.exponentialRampToValueAtTime(Math.max(.0001,this.volume*(.13+.09*state.engineLoad)),now+.003);gain.gain.exponentialRampToValueAtTime(.0001,now+.065);
    }else if(kind==='limiter'){
      oscillator.type='square';oscillator.frequency.setValueAtTime(58,now);
      filter.frequency.value=300;gain.gain.exponentialRampToValueAtTime(Math.max(.0001,this.volume*.16),now+.002);gain.gain.exponentialRampToValueAtTime(.0001,now+.045);
    }else{
      oscillator.type='sawtooth';oscillator.frequency.setValueAtTime(1550,now);oscillator.frequency.exponentialRampToValueAtTime(430,now+.16);
      filter.type='bandpass';filter.Q.value=.7;filter.frequency.value=1350;gain.gain.exponentialRampToValueAtTime(Math.max(.0001,this.volume*this.profile.turboGain!*.24),now+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+.18);
    }
    oscillator.connect(filter).connect(gain).connect(output);
    const duration=kind==='shift'?.15:kind==='burble'?.075:kind==='wastegate'?.19:.055;
    const transient={source:oscillator,filter,gain};this.transients.add(transient);
    oscillator.onended=()=>{this.transients.delete(transient);oscillator.disconnect();filter.disconnect();gain.disconnect();};
    oscillator.start(now);oscillator.stop(now+duration);
  }

  setVolume(value: number) { this.volume = Math.min(1, Math.max(0, value)); if (this.lastState) this.update(this.lastState); }
  private releaseVoices() {
    const ctx = this.context;
    if (!ctx) return;
    for (const { source, gain } of this.voices) {
      gain.gain.cancelAndHoldAtTime(ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.stop(ctx.currentTime + 0.16);
    }
    this.voices = [];
    if(this.turbo){this.turbo.source.stop();this.turbo.source.disconnect();this.turbo.filter.disconnect();this.turbo.gain.disconnect();this.turbo=undefined;}
  }
  private releaseEffects(){for(const effect of this.transients){effect.source.onended=null;try{effect.source.stop();}catch{}effect.source.disconnect();effect.filter.disconnect();effect.gain.disconnect();}this.transients.clear();}
  stop() { ++this.generation; this.releaseVoices();this.releaseEffects(); this.lastState=undefined;this.lastBurbleAt=this.lastLimiterPulse=-1; }
  dispose() { this.stop(); void this.context?.close(); }
  diagnostics() {
    let rms = 0;
    if (this.analyser && this.context?.state === 'running') {
      this.analyser.getFloatTimeDomainData(this.meter);
      rms = Math.sqrt(this.meter.reduce((sum, x) => sum + x * x, 0) / this.meter.length);
    }
    return { state: this.context?.state ?? 'inactive', loaded: this.buffers?.length ?? 0, voices: this.voices.length, effects:this.transients.size+(this.turbo?1:0), rms, baseLatencyMs: this.context ? Math.round(this.context.baseLatency * 1000) : null };
  }
}
