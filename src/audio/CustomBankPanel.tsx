import {useEffect,useRef,useState} from 'react';
import {prepareLoop,saveCustomBank,validateRpms,type CustomBank} from './customBank';
type Take={file:File;buffer:AudioBuffer;rpm:number;start:number;end:number};
export function CustomBankPanel({busy,onStored,onBusy}:{busy:boolean;onStored:(bank:CustomBank)=>void;onBusy:(busy:boolean)=>void}){
  const [name,setName]=useState('Mon moteur');const [takes,setTakes]=useState<Take[]>([]);
  const [working,setWorking]=useState(false),[status,setStatus]=useState('Importe 1 à 4 prises à régime stable.');
  const [preview,setPreview]=useState<string|null>(null);const previewRef=useRef<HTMLAudioElement>(null);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  useEffect(()=>{if(busy){previewRef.current?.pause();setPreview(null);}},[busy]);
  const read=async(files:FileList|null)=>{
    if(!files?.length)return;
    setWorking(true);onBusy(true);setPreview(null);let context:AudioContext|undefined;
    try{
      if(files.length>4)throw new Error('Choisis au maximum quatre fichiers.');
      context=new AudioContext();const next:Take[]=[];
      for(const [i,file] of Array.from(files).entries()){
        if(file.size>30*1024*1024)throw new Error('Chaque fichier doit faire moins de 30 Mo.');
        const buffer=await context.decodeAudioData(await file.arrayBuffer());
        if(buffer.duration<.5||buffer.duration>180)throw new Error('Utilise des fichiers de 0,5 à 180 secondes.');
        next.push({file,buffer,rpm:[850,1800,3800,6500][i],start:0,end:Math.min(4,buffer.duration)});
      }
      setTakes(next);setStatus('Choisis les extraits stables et leurs RPM. Préécoute chaque boucle avant de sauvegarder.');
    }catch(error){setStatus(error instanceof Error?error.message:String(error));}
    finally{await context?.close();setWorking(false);onBusy(false);}
  };
  const prepare=(take:Take)=>new Blob([prepareLoop(Array.from({length:take.buffer.numberOfChannels},(_,i)=>take.buffer.getChannelData(i)),take.buffer.sampleRate,take.start,take.end)],{type:'audio/wav'});
  const previewTake=(take:Take)=>{try{setPreview(URL.createObjectURL(prepare(take)));setStatus('Préécoute de la boucle préparée, à son régime de référence.');}catch(error){setStatus(error instanceof Error?error.message:String(error));}};
  const save=async()=>{
    setWorking(true);onBusy(true);setPreview(null);
    try{
      validateRpms(takes.map(t=>t.rpm));if(!name.trim())throw new Error('Donne un nom au moteur.');
      const bank:CustomBank={name:name.trim().slice(0,60),layers:[...takes].sort((a,b)=>a.rpm-b.rpm).map(t=>({rpm:t.rpm,wav:prepare(t),sourceName:t.file.name,start:t.start,end:t.end}))};
      await saveCustomBank(bank);onStored(bank);setStatus('Banque sauvegardée sur cet appareil et sélectionnée. Elle remplace ta précédente banque personnelle.');
    }catch(error){setStatus(`Non sauvegardé : ${error instanceof Error?error.message:String(error)}`);}
    finally{setWorking(false);onBusy(false);}
  };
  return <section className="panel custom-bank-panel"><h2>Mon moteur · import local</h2><p>Privilégie des prises depuis l’habitacle : ralenti, bas, moyen et haut régime. Sans musique, voix ni passages de rapports. Les sons générés par IA s’importent aussi ici. Un seul extrait reste expérimental loin de ses RPM d’origine.</p>
    <fieldset disabled={busy||working}><label>Nom du moteur<input maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Fichiers MP3 / WAV / audio<input type="file" accept="audio/*,.mp3,.wav" multiple onChange={e=>{void read(e.target.files);e.target.value='';}}/></label>
    {takes.map((take,index)=><div className="custom-take" key={index}><strong>{take.file.name}</strong><span>{take.buffer.duration.toFixed(1)} s</span>
      {(['rpm','start','end'] as const).map(key=><label key={key}>{key==='rpm'?'RPM mesurés':key==='start'?'Début (s)':'Fin (s)'}<input type="number" step={key==='rpm'?50:.1} min={key==='rpm'?600:0} max={key==='rpm'?15000:take.buffer.duration} value={take[key]} onChange={e=>{setPreview(null);setTakes(old=>old.map((t,i)=>i===index?{...t,[key]:Number(e.target.value)}:t));}}/></label>)}
      <button className="reset" onClick={()=>previewTake(take)}>Préécouter la boucle</button>
      <button className="reset" disabled={takes.length>=4} onClick={()=>{setPreview(null);setTakes(old=>[...old,{...take,rpm:[850,1800,3800,6500].find(rpm=>!old.some(t=>t.rpm===rpm))??6500}]);}}>Ajouter un palier de ce fichier</button>
      <button className="reset" onClick={()=>{setPreview(null);setTakes(old=>old.filter((_,i)=>i!==index));}}>Retirer ce palier</button></div>)}
    <button className="primary" disabled={!takes.length} onClick={()=>void save()}>Préparer et utiliser ce moteur</button></fieldset>
    {preview&&<audio ref={previewRef} controls loop src={preview}/>}
    <p role="status">{working?'Préparation locale…':status}</p><p className="hint">Aucun envoi de fichiers. Stockage local utilisable hors ligne ; effacer les données du site efface la banque. Les RPM saisis servent à calibrer la hauteur : ils ne sont pas détectés automatiquement.</p>
  </section>;
}
