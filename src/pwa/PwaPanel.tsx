import { useEffect, useState } from 'react';
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{outcome: 'accepted' | 'dismissed'}> }
export function PwaPanel({busy}: {busy: boolean}) {
  const [prompt,setPrompt]=useState<InstallPrompt|null>(null);
  const [installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches);
  const [status,setStatus]=useState(import.meta.env.DEV?'Mode développement : cache hors ligne désactivé.':'Préparation du mode hors ligne…');
  const [offline,setOffline]=useState(!navigator.onLine);
  useEffect(()=>{
    let disposed=false;
    const update=(text:string)=>{if(!disposed)setStatus(text);};
    const install=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt);};
    const installed=()=>{setInstalled(true);setPrompt(null);};
    const network=()=>setOffline(!navigator.onLine);
    window.addEventListener('beforeinstallprompt',install);window.addEventListener('appinstalled',installed);
    window.addEventListener('online',network);window.addEventListener('offline',network);
    if(import.meta.env.PROD){
      if(!window.isSecureContext)update('Un accès HTTPS est nécessaire pour préparer le mode hors ligne.');
      else if(!('serviceWorker' in navigator))update('Mode hors ligne indisponible dans ce navigateur.');
      else void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>{
        const refresh=()=>{
          if(registration.waiting)update('Mise à jour téléchargée. Ferme tous les onglets REV et l’application, puis rouvre REV.');
          else if(registration.active)update('Application et sons prêts hors ligne.');
        };
        const track=()=>{const worker=registration.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='redundant')update('Préparation hors ligne échouée. Recharge avec une connexion.');else refresh();});};
        registration.addEventListener('updatefound',track);track();refresh();
        void navigator.serviceWorker.ready.then(refresh);
      }).catch(()=>update('Impossible de préparer le mode hors ligne. Recharge avec une connexion.'));
    }
    return()=>{disposed=true;window.removeEventListener('beforeinstallprompt',install);window.removeEventListener('appinstalled',installed);window.removeEventListener('online',network);window.removeEventListener('offline',network);};
  },[]);
  const install=async()=>{if(!prompt)return;try{await prompt.prompt();await prompt.userChoice;}catch{setStatus('Installation non déclenchée : utilise le menu du navigateur.');}finally{setPrompt(null);}};
  return <section className="panel pwa-panel"><h2>REV sur ton téléphone</h2><p className="hint" role="status">{offline?'Connexion indisponible · ':''}{status}</p>{installed?<p className="hint">REV est ouvert en mode application.</p>:prompt?<button className="reset" disabled={busy} onClick={()=>void install()}>Installer REV</button>:<p className="hint">Sur Android, ouvre REV dans Chrome puis utilise le menu ⋮ → Installer l’application ou Ajouter à l’écran d’accueil, si proposé.</p>}<p className="hint">Le premier chargement nécessite une connexion. Le cache peut être effacé par le navigateur. L’audio s’arrête lorsque REV passe en arrière-plan.</p></section>;
}
