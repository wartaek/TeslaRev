import { clamp, smooth, type DrivingInput } from '../engine/virtualEngine';
import { MotionSensor, type MotionAxis } from './motionSensor';
export type SpeedSource = 'native'|'calculated'|null;
export interface SensorSnapshot { input: DrivingInput; ready: boolean; status: string; accuracy: number | null; age: number | null; speedSource: SpeedSource; motionReady: boolean; motionCalibrating: boolean; motionStatus: string }
export type PositionFix = { latitude:number; longitude:number; accuracy:number; timestamp:number };
const distanceMeters=(a:PositionFix,b:PositionFix)=>{const r=6371000,toRad=Math.PI/180;const dLat=(b.latitude-a.latitude)*toRad,dLon=(b.longitude-a.longitude)*toRad;const lat1=a.latitude*toRad,lat2=b.latitude*toRad;const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 2*r*Math.asin(Math.min(1,Math.sqrt(h)));};
export function resolveGpsSpeed(previous:PositionFix|null,current:PositionFix,nativeSpeed:number|null):{speed:number;source:Exclude<SpeedSource,null>}|null{
  if(nativeSpeed!==null&&Number.isFinite(nativeSpeed)&&nativeSpeed>=0)return{speed:nativeSpeed,source:'native'};
  if(!previous)return null;
  const elapsed=(current.timestamp-previous.timestamp)/1000;
  if(elapsed<.3||elapsed>5)return null;
  const distance=distanceMeters(previous,current);
  const noiseFloor=Math.max(2,Math.min(12,(previous.accuracy+current.accuracy)*.2));
  const speed=distance<=noiseFloor?0:(distance-noiseFloor)/elapsed;
  return speed<=70?{speed,source:'calculated'}:null;
}
// Coordinates and motion samples are processed in memory, never retained or sent.
export class RealSensors {
  private motion = new MotionSensor();
  private watch?: number;
  private generation = 0;
  private lastAt = 0;
  private previousSpeed = 0;
  private speed = 0;
  private acceleration = 0;
  private accuracy: number | null = null;
  private previousFix: PositionFix | null = null;
  private speedSource: SpeedSource = null;
  private message = 'Capteurs arrêtés';
  start() {
    this.stopGps();
    if (!window.isSecureContext) { this.message='HTTPS requis sur le téléphone'; return; }
    if (!navigator.geolocation) { this.message='Géolocalisation indisponible'; return; }
    const generation=++this.generation;
    this.message='Autorise la localisation, puis attends une vitesse GPS valide';
    this.watch=navigator.geolocation.watchPosition(position=>{
      if(generation!==this.generation)return;
      const {speed,accuracy,latitude,longitude}=position.coords;
      this.accuracy=accuracy;
      if(Date.now()-position.timestamp>5000||!Number.isFinite(accuracy)||accuracy>50||!Number.isFinite(latitude)||!Number.isFinite(longitude)){this.message='Mesure GPS imprécise';return;}
      const fix={latitude,longitude,accuracy,timestamp:position.timestamp};
      const elapsed=this.previousFix?(fix.timestamp-this.previousFix.timestamp)/1000:0;
      const resolved=resolveGpsSpeed(this.previousFix,fix,speed);
      this.previousFix=fix;
      if(!resolved){this.message='Deux positions GPS sont nécessaires pour calculer la vitesse';return;}
      const measuredSpeed=resolved.speed,source=resolved.source;
      const fresh=this.lastAt>0&&elapsed>.1&&elapsed<3;
      this.acceleration=fresh?clamp((measuredSpeed-this.previousSpeed)/elapsed,-8,5):0;
      this.speed=measuredSpeed*3.6;this.previousSpeed=measuredSpeed;this.lastAt=performance.now();this.speedSource=source;this.message=source==='native'?'GPS actif':'GPS actif · vitesse calculée';
    },error=>{
      if(generation!==this.generation)return;
      this.message=error.code===1?'Localisation refusée : vérifier les permissions du navigateur':error.code===3?'Délai GPS dépassé':'Signal GPS indisponible';
      if(error.code===1)this.lastAt=0;
    },{enableHighAccuracy:true,maximumAge:0,timeout:10000});
  }
  private filteredSpeed=0;
  private filteredAcceleration=0;
  snapshot(dt=0.02):SensorSnapshot {
    const age=this.lastAt?(performance.now()-this.lastAt)/1000:null;
    const ready=age!==null&&age<5;
    const motion=this.motion.snapshot();
    if(ready){
      this.filteredSpeed=smooth(this.filteredSpeed,this.speed,dt,.25);
      const gpsAcceleration=age<2?this.acceleration:0;
      const fusedAcceleration=motion.ready?motion.acceleration*.8+gpsAcceleration*.2:gpsAcceleration;
      this.filteredAcceleration=smooth(this.filteredAcceleration,fusedAcceleration,dt,motion.ready?.08:.15);
    }
    return {input:{speedKmh:this.filteredSpeed,acceleration:this.filteredAcceleration},ready,status:age!==null&&age>=5?'Signal GPS perdu : moteur arrêté':age!==null&&age>=2?'GPS retardé : réponse dégradée':this.message,accuracy:this.accuracy,age,speedSource:this.speedSource,motionReady:motion.ready,motionCalibrating:motion.calibrating,motionStatus:motion.status};
  }

  configureMotion(axis:MotionAxis,sign:1|-1){this.motion.configure(axis,sign);}
  calibrateMotion(){return this.motion.calibrate(()=>this.snapshot(0).ready&&this.filteredSpeed<2);}

  private stopGps(){
    ++this.generation;
    if(this.watch!==undefined)navigator.geolocation.clearWatch(this.watch);
    this.watch=undefined;this.lastAt=0;this.speed=0;this.acceleration=0;this.previousSpeed=0;
    this.filteredSpeed=0;this.filteredAcceleration=0;this.accuracy=null;this.previousFix=null;this.speedSource=null;this.message='Capteurs arrêtés';
  }
  stop(){
    this.stopGps();
    this.motion.stop();
  }
}
