import sys,json,hashlib
from pathlib import Path
sys.path.insert(0,str(Path('../../work/audio-python').resolve()))
import numpy as np
import soundfile as sf
for bank,number,folder in [('Number6',2,'rl-number6'),('Car03',7,'rl-car03'),('TakumiMK2',2,'rl-takumi'),('Enspire',4,'rl-enspire')]:
    source=Path(f'scripts/audio-sources/rocketleague/SFX_Motor_{bank}_{number:04}.ogg')
    raw,sr=sf.read(source,always_2d=True);raw=raw.mean(axis=1);raw-=raw.mean()
    raw=np.interp(np.arange(0,len(raw)-1,sr/48000),np.arange(len(raw)),raw)
    n=int(.08*48000);blend=np.linspace(0,1,n)
    audio=np.concatenate([raw[n:-n],raw[-n:]*(1-blend)+raw[:n]*blend]);audio-=audio.mean()
    audio*=min(.16/np.sqrt(np.mean(audio**2)),.84/np.max(abs(audio)))
    destination=Path(f'public/audio/{folder}');destination.mkdir(parents=True,exist_ok=True)
    sf.write(destination/'engine.wav',audio,48000,subtype='PCM_16')
    metadata={'source':f'https://github.com/ItsBrank/RocketLeague-Audio/tree/main/Motors/SFX_Motor_{bank}','sourceFile':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'rights':'Third-party Rocket League asset from a community archive; no independent license or manufacturer endorsement claimed','processing':'Mono, resampled to 48 kHz, DC removal, 80 ms overlap loop seam, RMS normalization and peak bound','samples':[{'output':'engine.wav','sampleRate':48000,'duration':len(audio)/48000,'rms':float(np.sqrt(np.mean(audio**2))),'peak':float(np.max(abs(audio))),'referenceRpm':3600,'calibration':'Provisional REV mapping, not original game telemetry'}]}
    (destination/'provenance.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    print(bank,'single engine loop',round(len(audio)/48000,2),'seconds')
