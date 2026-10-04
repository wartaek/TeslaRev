import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VirtualEngine, V8, type GearboxMode } from './engine/virtualEngine';
import { DrivingSimulator } from './simulation/drivingSimulator';
import { EngineAudio } from './audio/audioEngine';
import { audioProfiles } from './audio/profile';
import { loadSettings, saveSettings } from './config/settings';
import { scenarios, ScenarioPlayer, type Scenario } from './simulation/scenarios';
import './style.css';
import './controls.css';
import { PwaPanel } from './pwa/PwaPanel';
import { RealSensors } from './sensors/realSensors';
import type { MotionAxis } from './sensors/motionSensor';
const phases = { off: 'Arrêté', idle: 'Ralenti', drive: 'En charge', overrun: 'Décélération', shift: 'Changement de rapport', limiter: 'Rupteur' };
const createEngine = (gearboxMode:GearboxMode,maxRpm:number) => new VirtualEngine({...V8,maxRpm},gearboxMode);
type WakeLockSentinelLike = EventTarget & {release():Promise<void>};
function App() {
  const [initialSettings] = useState(loadSettings);
  const engine = useRef(createEngine(initialSettings.gearboxMode,initialSettings.maxRpm));
  const simulator = useRef(new DrivingSimulator());
  const audio = useRef(new EngineAudio(audioProfiles.find(p=>p.id===initialSettings.profileId)!));
  const player = useRef<ScenarioPlayer | null>(null);
  const sensors = useRef(new RealSensors());
  const sourceRef = useRef<'simulation'|'real'>('simulation');
  const [source,setSource] = useState<'simulation'|'real'>('simulation');
  const [sensorState,setSensorState] = useState(sensors.current.snapshot());
  const [motionAxis,setMotionAxis] = useState<MotionAxis>('y');
  const [motionSign,setMotionSign] = useState<1|-1>(1);
  const operation = useRef(0);
  const [audioStatus, setAudioStatus] = useState('Prêt');
  const [loading, setLoading] = useState(false);
  const [volume, setVolume] = useState(initialSettings.volume);
  const [profileId, setProfileId] = useState(initialSettings.profileId);
  const [gearboxMode, setGearboxMode] = useState<GearboxMode>(initialSettings.gearboxMode);
  const [maxRpm,setMaxRpm] = useState(initialSettings.maxRpm);
  const [saved, setSaved] = useState(true);
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [scenarioActive, setScenarioActive] = useState(false);
  const [scenarioTime, setScenarioTime] = useState(0);
  const [scenarioStatus, setScenarioStatus] = useState('Prêt');
  const selectedScenario = scenarios.find(s=>s.id===scenarioId)!;
  const selectedProfile = audioProfiles.find(profile => profile.id === profileId)!;
  const [diagnostics, setDiagnostics] = useState(audio.current.diagnostics());
  const [state, setState] = useState(engine.current.state);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'pedals' | 'speed' | 'acceleration'>('pedals');
  const [throttle, setThrottle] = useState(0);
  const [brake, setBrake] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [acceleration, setAcceleration] = useState(0);
  const [history, setHistory] = useState<{rpm: number; gear: number; time: number}[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [driveMode,setDriveMode] = useState(false);
  const [wakeStatus,setWakeStatus] = useState('Écran actif normalement');
  useEffect(() => {
    audio.current.setVolume(volume / 100);
    engine.current.gearboxMode = gearboxMode;
    setSaved(saveSettings({volume, profileId, gearboxMode, maxRpm}));
  }, [volume, profileId, gearboxMode, maxRpm]);
  useEffect(() => {
    let frame = 0, last = performance.now(), accumulated = 0, lastUi = 0;
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000; last = now;
      if (elapsed < 0.25 && !document.hidden) accumulated += elapsed;
      else accumulated = 0;
      while (accumulated >= 0.02) {
        const previous = engine.current.state.gear;
        const currentPlayer = player.current;
        const real = sourceRef.current === 'real' ? sensors.current.snapshot(0.02) : null;
        if(real) {
          if(!real.ready && engine.current.state.phase!=='off'){
            audio.current.stop();engine.current.stop();setRunning(false);setAudioStatus('GPS indisponible : attendre le signal puis redémarrer');
          }
        }
        const input = real ? real.input : currentPlayer ? currentPlayer.step(0.02) : simulator.current.step(0.02);
        if (currentPlayer) simulator.current.speedKmh = input.speedKmh;
        const s = engine.current.step(input, 0.02);
        audio.current.update(s);
        if (s.phase === 'shift' && s.gear !== previous) setEvents(e => [`${s.timestamp.toFixed(1)} s · ${previous} → ${s.gear} · ${s.speedKmh.toFixed(0)} km/h`, ...e].slice(0, 6));
        if (currentPlayer) {
          if (currentPlayer.finished) {
            setScenarioTime(currentPlayer.duration); setScenarioStatus('Terminé'); setScenarioActive(false);
            player.current = null; audio.current.stop(); engine.current.stop(); setRunning(false); setAudioStatus('Scénario terminé · prêt à rejouer');
          }
        }
        accumulated -= 0.02;
      }
      if (now - lastUi >= 50) {
        const s = { ...engine.current.state }; setState(s);
        setDiagnostics(audio.current.diagnostics());
        if(sourceRef.current==='real')setSensorState(sensors.current.snapshot(0));
        if (player.current) setScenarioTime(player.current.elapsed);
        setHistory(h => [...h, { rpm: s.rpm, gear: s.gear, time: s.timestamp }].slice(-240)); lastUi = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      last = performance.now(); accumulated = 0; setPaused(document.hidden);
      if (document.hidden) {
        operation.current++; audio.current.stop(); engine.current.stop();
        sensors.current.stop();
        if (player.current) { player.current = null; setScenarioActive(false); setScenarioStatus('Interrompu · rejouer depuis le début'); }
        setRunning(false); setLoading(false); setAudioStatus('Audio arrêté après masquage · appuyer sur Démarrer pour reprendre');
      } else if(sourceRef.current==='real') { sensors.current.start();setSensorState(sensors.current.snapshot(0));setAudioStatus('GPS relancé · attendre une mesure fraîche puis appuyer sur Démarrer'); }
    };
    document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(tick);
    return () => { operation.current++; sensors.current.stop(); audio.current.dispose(); cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(()=>{
    let lock:WakeLockSentinelLike|undefined,disposed=false;
    const acquire=async()=>{
      const wakeLock=(navigator as Navigator&{wakeLock?:{request(type:'screen'):Promise<WakeLockSentinelLike>}}).wakeLock;
      if(!driveMode){setWakeStatus('Écran actif normalement');return;}
      if(!wakeLock){setWakeStatus('Maintien de l’écran indisponible');return;}
      try{lock=await wakeLock.request('screen');if(disposed){void lock.release();return;}setWakeStatus('Écran maintenu allumé');lock.addEventListener('release',()=>{lock=undefined;if(!disposed)setWakeStatus('Maintien de l’écran interrompu');},{once:true});}
      catch{if(!disposed)setWakeStatus('Maintien de l’écran refusé');}
    };
    const visible=()=>{if(driveMode&&!document.hidden&&!lock)void acquire();};
    void acquire();document.addEventListener('visibilitychange',visible);
    return()=>{disposed=true;document.removeEventListener('visibilitychange',visible);if(lock)void lock.release();};
  },[driveMode]);
  const changeMode = (m: typeof mode) => { setMode(m); simulator.current.mode = m; };
  const changeSource = (value: 'simulation'|'real') => {
    if(running||loading)return;
    sensors.current.stop(); sourceRef.current=value;setSource(value);
    engine.current = createEngine(gearboxMode,maxRpm);
    setState(engine.current.state);setHistory([]);setEvents([]);setSensorState(sensors.current.snapshot());
  };
  const selectProfile = (id: string) => {
    const profile = audioProfiles.find(item => item.id === id);
    if (!profile || id === profileId || running || loading) return;
    operation.current++;
    audio.current.dispose();
    audio.current = new EngineAudio(profile);
    audio.current.setVolume(volume / 100);
    setProfileId(id);
    setDiagnostics(audio.current.diagnostics());
    setAudioStatus('Prêt');
  };
  const configureMotion = (axis:MotionAxis,sign:1|-1) => { setMotionAxis(axis);setMotionSign(sign);sensors.current.configureMotion(axis,sign);setSensorState(sensors.current.snapshot(0)); };
  const calibrateMotion = async () => { await sensors.current.calibrateMotion();setSensorState(sensors.current.snapshot(0)); };
  const changeMaxRpm = (value:number) => { setMaxRpm(value);engine.current=createEngine(gearboxMode,value);setState(engine.current.state);setHistory([]);setEvents([]); };
  const reset = () => { operation.current++; sensors.current.stop(); player.current = null; setScenarioActive(false); setScenarioTime(0); setScenarioStatus('Prêt'); audio.current.stop(); setLoading(false); setAudioStatus('Prêt'); engine.current = createEngine(gearboxMode,maxRpm); simulator.current = new DrivingSimulator(); setRunning(false); setMode('pedals'); setThrottle(0); setBrake(0); setSpeed(0); setAcceleration(0); setHistory([]); setEvents([]); setState(engine.current.state); };
  const toggleEngine = async (scenario?: Scenario) => {
    if (!scenario && (running || loading)) { operation.current++; sensors.current.stop(); player.current = null; setScenarioActive(false); setScenarioStatus('Arrêté · rejouer depuis le début'); audio.current.stop(); engine.current.stop(); setRunning(false); setLoading(false); setAudioStatus('Arrêté'); return; }
    if(sourceRef.current==='real' && !sensors.current.snapshot().ready){setAudioStatus('Active le GPS et attends une mesure valide avant de démarrer.');return;}
    if (scenario) {
      audio.current.stop(); player.current = null;
      engine.current = createEngine(gearboxMode,maxRpm);
      simulator.current = new DrivingSimulator(); simulator.current.speedKmh = scenario.points[0][1];
      simulator.current.mode = 'speed'; simulator.current.targetSpeed = scenario.points[0][1];
      setMode('speed'); setSpeed(scenario.points[0][1]); setThrottle(0); setBrake(0); setAcceleration(0);
      setHistory([]); setEvents([]); setScenarioTime(0); setScenarioStatus('Chargement'); setRunning(false);
    }
    const token = ++operation.current;
    setLoading(true); setAudioStatus(`Chargement des ${selectedProfile.layers.length} boucles…`);
    try {
      if (!await audio.current.start() || token !== operation.current) return;
      const measurement=sourceRef.current==='real'?sensors.current.snapshot():null;
      if(measurement&&!measurement.ready){audio.current.stop();setAudioStatus('Signal GPS perdu pendant le chargement : réessayer');return;}
      engine.current.start(measurement?measurement.input.speedKmh:simulator.current.speedKmh); audio.current.update(engine.current.state);
      if (scenario) { player.current = new ScenarioPlayer(scenario); simulator.current.targetSpeed = 0; setSpeed(0); setScenarioActive(true); setScenarioStatus('En cours'); }
      setRunning(true); setAudioStatus(`${selectedProfile.name} · ${selectedProfile.layers.length} boucles actives`);
    } catch (error) {
      if (token === operation.current) { audio.current.stop(); engine.current.stop(); setRunning(false); setScenarioStatus('Échec du démarrage'); setAudioStatus(`Audio indisponible : ${error instanceof Error ? error.message : String(error)}`); }
    } finally { if (token === operation.current) setLoading(false); }
  };
  return <main className={driveMode?'drive-mode':''}>
    <header><a className="logo" href="#">REV<span> / LAB</span></a><button className="drive-toggle" aria-pressed={driveMode} onClick={()=>setDriveMode(value=>!value)}>{driveMode?'Réglages':'Mode conduite'}</button><span className="badge">{source==='real'?'GPS RÉEL':'SIMULATION'} · AUDIO</span></header>
    <div className="intro"><p className="eyebrow">VIRTUAL ENGINE / PROTOTYPE 02</p><h1>Le mouvement.<br/><span>Un autre caractère.</span></h1><p>Un V8 virtuel, six rapports et une première voix : MuscleCar02.</p></div>
    <section className="dashboard" aria-label="Moteur virtuel"><div className="dashhead"><span>V8 <small>6 RAPPORTS / AUTO</small></span><span className={running ? 'live' : ''}>{paused ? 'Simulation en pause' : phases[state.phase]}</span></div>
      <div className="gearbox-control"><div className="tabs"><button disabled={running||loading} aria-pressed={source==='simulation'} onClick={()=>changeSource('simulation')}>Simulation</button><button disabled={running||loading} aria-pressed={source==='real'} onClick={()=>changeSource('real')}>GPS réel</button></div></div>
      {source==='real'&&<div className="sound-picker"><p>Fixe le téléphone avant de configurer les capteurs.</p><button className="reset" disabled={running||loading} onClick={()=>{sensors.current.start();setSensorState(sensors.current.snapshot(0));}}>1. Activer / relancer le GPS</button><p role="status">{sensorState.status}</p><p>Précision : {sensorState.accuracy===null?'—':`${sensorState.accuracy.toFixed(0)} m`} · Vitesse : {sensorState.speedSource==='native'?'capteur GPS':sensorState.speedSource==='calculated'?'calculée entre deux positions':'—'} · Dernière mesure : {sensorState.age===null?'—':`${sensorState.age.toFixed(1)} s`}</p><label htmlFor="motion-axis">AXE DU TÉLÉPHONE <span>sens de la marche</span></label><select id="motion-axis" value={`${motionAxis}:${motionSign}`} disabled={running||loading||sensorState.motionCalibrating} onChange={e=>{const [axis,sign]=e.target.value.split(':');configureMotion(axis as MotionAxis,Number(sign) as 1|-1);}}><option value="y:1">Haut du téléphone vers l’avant</option><option value="y:-1">Bas du téléphone vers l’avant</option><option value="x:1">Côté droit vers l’avant</option><option value="x:-1">Côté gauche vers l’avant</option><option value="z:1">Écran vers l’avant</option><option value="z:-1">Dos du téléphone vers l’avant</option></select><button className="reset" disabled={running||loading||!sensorState.ready||sensorState.motionCalibrating} onClick={()=>void calibrateMotion()}>2. {sensorState.motionCalibrating?'Calibration en cours…':'Calibrer à l’arrêt'}</button><p role="status">{sensorState.motionStatus}</p><p>{sensorState.motionReady?'Réponse rapide par accéléromètre + correction GPS.':'Accélération estimée par GPS tant que le capteur mouvement n’est pas prêt.'} Données traitées localement, sans enregistrement ni envoi.</p></div>}
      <div className="sound-picker">
        <label htmlFor="engine-sound">SON MOTEUR <span>{audioProfiles.length} profil{audioProfiles.length > 1 ? 's' : ''} disponible{audioProfiles.length > 1 ? 's' : ''}</span></label>
        <select id="engine-sound" value={profileId} onChange={e => selectProfile(e.target.value)} disabled={running || loading} aria-describedby="sound-help">
          {audioProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select>
        <p id="sound-help">{running || loading ? 'Arrête le moteur pour changer de son.' : selectedProfile.layers.length===1?'Une seule boucle moteur · hauteur variable selon les RPM':`${selectedProfile.layers.length} boucles · ralenti, bas, moyen et haut régime`}</p>
        {selectedProfile.description&&<p>{selectedProfile.description}</p>}
        {selectedProfile.credit&&<p><a href={selectedProfile.credit.url} target="_blank" rel="noreferrer">{selectedProfile.credit.label}</a></p>}
      </div>
      <div className="rpm"><strong>{Math.round(state.rpm).toLocaleString('fr-FR')}</strong><span>RPM</span></div>
      <div className="meter" role="meter" aria-label="Régime moteur" aria-valuemin={0} aria-valuemax={maxRpm} aria-valuenow={Math.round(state.rpm)}><div style={{width: `${state.rpm/maxRpm*100}%`}}/></div><div className="scale"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>{(maxRpm/1000).toFixed(2).replace(/0$/,'')} × 1000</span></div>
      <div className="stats"><div><label>RAPPORT</label><strong>{state.gear}<small> / 6</small></strong></div><div><label>VITESSE</label><strong>{state.speedKmh.toFixed(0)}<small> km/h</small></strong></div><div><label>CHARGE</label><strong>{(state.engineLoad * 100).toFixed(0)}<small> %</small></strong></div></div>
      <div className="gearbox-control"><span>BOÎTE AUTOMATIQUE</span><div className="tabs">{(['calm','sport'] as const).map(value => <button key={value} aria-pressed={gearboxMode===value} disabled={running || loading} onClick={()=>setGearboxMode(value)}>{value==='calm'?'Calme':'Sport'}</button>)}</div><p className="hint">{gearboxMode==='calm'?'Passages plus tôt pour une conduite souple.':'Rapports prolongés pour monter davantage dans les tours.'} Réglage à l’arrêt.</p></div>
      <fieldset disabled={running||loading}><Slider label="Régime maximal" value={maxRpm} min={5500} max={7500} step={250} unit="RPM" onChange={changeMaxRpm}/></fieldset>
      <button className="primary" onClick={() => void toggleEngine()}>{loading ? 'Annuler le chargement' : running ? '■ Arrêter le moteur' : '▶ Démarrer le moteur'}</button>
      <p className="drive-status">{wakeStatus}</p>
      <Slider label="Volume moteur" value={volume} max={100} unit="%" onChange={v => { setVolume(v); audio.current.setVolume(v / 100); }}/>
      <p className="hint" role="status">{audioStatus}</p>
      <p className="hint">{saved ? 'Volume, son et boîte mémorisés sur cet appareil.' : 'Stockage indisponible : réglages conservés pour cette session uniquement.'}</p>
      <details className="audio-details"><summary>Diagnostic audio</summary><p>Contexte : {diagnostics.state} · Samples : {diagnostics.loaded}/{selectedProfile.layers.length} · Boucles : {diagnostics.voices} · Effets : {diagnostics.effects}</p><p>Signal : {diagnostics.rms > 0.00001 ? `${(20 * Math.log10(diagnostics.rms)).toFixed(1)} dBFS` : 'silence'} · Latence de base : {diagnostics.baseLatencyMs ?? '—'} ms</p><p>Cette valeur ne mesure pas le délai acoustique ni le Bluetooth. Calibration sonore provisoire.</p></details>
    </section>
    {source==='simulation'&&<section className="panel scenario-panel"><h2>Trajets automatiques</h2><label htmlFor="scenario">Scénario</label><select id="scenario" value={scenarioId} disabled={running || loading} onChange={e=>{setScenarioId(e.target.value);setScenarioTime(0);setScenarioStatus('Prêt');}}>{scenarios.map(s=><option key={s.id} value={s.id}>{s.name} · {s.points.at(-1)![0]} s</option>)}</select><p className="hint">{selectedScenario.description} Même trajet à chaque lecture, quel que soit le mode de boîte.</p><progress aria-label="Progression du scénario" value={scenarioTime} max={selectedScenario.points.at(-1)![0]}/><p className="hint" role="status">{scenarioStatus} · {scenarioTime.toFixed(1)} / {selectedScenario.points.at(-1)![0]} s</p><button className="primary" disabled={running || loading} onClick={()=>void toggleEngine(selectedScenario)}>{scenarioTime>0?'Rejouer depuis le début':'Lancer le scénario'}</button></section>}
    <div className="lower"><section className="panel"><h2>Commandes de simulation</h2><fieldset disabled={source==='real' || scenarioActive || loading}><legend className="hint">{source==='real'?'Désactivées en mode GPS':scenarioActive?'Scénario en cours · commandes manuelles suspendues':'Pilotage manuel'}</legend><div className="tabs">{(['pedals', 'speed', 'acceleration'] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => changeMode(m)}>{m === 'pedals' ? 'Pédales' : m === 'speed' ? 'Vitesse cible' : 'Accélération'}</button>)}</div>
    {mode === 'pedals' ? <><Slider label="Accélérateur simulé" value={throttle} max={100} unit="%" onChange={v => {setThrottle(v); simulator.current.throttle = v / 100;}}/><Slider label="Frein" value={brake} max={100} unit="%" onChange={v => {setBrake(v); simulator.current.brake = v / 100;}}/></> : mode === 'speed' ? <Slider label="Vitesse cible" value={speed} max={130} unit="km/h" onChange={v => {setSpeed(v); simulator.current.targetSpeed = v;}}/> : <Slider label="Accélération imposée" value={acceleration} min={-6} max={3.5} step={0.1} unit="m/s²" onChange={v => {setAcceleration(v); simulator.current.accelerationCommand = v;}}/>}
    </fieldset><p className="hint">Les commandes produisent un mouvement simulé. Le moteur déduit sa charge de ce mouvement, comme avec les futurs capteurs.</p><div className="telemetry"><span>Accélération <b>{state.acceleration.toFixed(2)} m/s²</b></span><span>Throttle estimé <b>{(state.virtualThrottle * 100).toFixed(0)} %</b></span></div><button className="reset" onClick={reset}>Réinitialiser l’essai</button></section>
    <section className="panel"><h2>Les 12 dernières secondes</h2><svg viewBox="0 0 480 150" role="img" aria-label="Historique du régime en vert et des rapports en orange"><path d="M0 25H480 M0 75H480 M0 125H480" stroke="#29343a"/><polyline fill="none" stroke="#c0f879" strokeWidth="2" points={history.map((p,i)=>`${i*2},${145-p.rpm/maxRpm*135}`).join(' ')}/><polyline fill="none" stroke="#eaa65b" strokeWidth="1.5" points={history.map((p,i)=>`${i*2},${145-p.gear/6*135}`).join(' ')}/></svg><p className="legend">● RPM <span>● Rapport</span></p><ul className="events">{events.length ? events.map((e,i)=><li key={i}>{e}</li>) : <li>Les passages de rapports apparaîtront ici.</li>}</ul></section></div>
    <PwaPanel busy={running || loading}/>
    <footer>Moteur 50 Hz · Interface 20 Hz · Ralenti 850 RPM · Limite {maxRpm.toLocaleString('fr-FR')} RPM<br/>Samples MuscleCar02 · GPS + accéléromètre expérimentaux.</footer>
  </main>;
}
function Slider({label,value,min=0,max,step=1,unit,onChange}:{label:string;value:number;min?:number;max:number;step?:number;unit:string;onChange:(v:number)=>void}) { return <label className="slider"><span>{label}<b>{value} {unit}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>; }
createRoot(document.getElementById('root')!).render(<App/>);
