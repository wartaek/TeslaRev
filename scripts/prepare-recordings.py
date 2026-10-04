import sys
from pathlib import Path
sys.path.insert(0,str(Path('../../work/audio-python').resolve()))
sys.path.insert(0,str(Path('../../work/recording-tools').resolve()))
import numpy as np
import soundfile as sf
import json
import hashlib

# These are exterior field recordings, not four independently recorded dyno RPMs.
# Lower anchors are pitch adaptations of the same audible engine segment.
for name,start,end in [('f1-williams',5.55,7.1),('f1-mclaren',4.0,6.2)]:
    source=Path(f'scripts/audio-sources/{name}.ogg')
    metadata=json.loads(source.with_suffix('.json').read_text())
    raw,sr=sf.read(source,always_2d=True)
    raw=raw.mean(axis=1)[int(start*sr):int(end*sr)]
    raw=raw-raw.mean()
    destination=Path(f'public/audio/{name}')
    destination.mkdir(parents=True,exist_ok=True)
    report=[]
    for layer,rpm,pitch in [('idle',850,.42),('low',1800,.58),('mid',3800,.8),('high',6500,1)]:
        # Resample to 48 kHz while preserving the field-recording texture.
        positions=np.arange(0,len(raw)-1,sr/48000*pitch)
        audio=np.interp(positions,np.arange(len(raw)),raw)
        n=int(.08*48000)
        blend=np.linspace(0,1,n)
        audio=np.concatenate([audio[n:-n],audio[-n:]*(1-blend)+audio[:n]*blend])
        audio=audio-audio.mean()
        audio*=min(.15/np.sqrt(np.mean(audio**2)),.84/np.max(abs(audio)))
        sf.write(destination/f'{layer}.wav',audio,48000,subtype='PCM_16')
        report.append({'output':f'{layer}.wav','referenceRpm':rpm,'pitchAdaptation':pitch,'sourceStartSeconds':start,'sourceEndSeconds':end,'sampleRate':48000,'duration':len(audio)/48000,'rms':float(np.sqrt(np.mean(audio**2))),'peak':float(np.max(abs(audio))),'calibration':'Perceptual REV anchors; not measured vehicle RPM'})
    metadata.update({'processing':'Mono conversion, cropped exterior recording, pitch adaptation, 80 ms overlap seam, DC removal and RMS/peak normalization','samples':report})
    (destination/'provenance.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    (destination/'ATTRIBUTION.txt').write_text(f"{metadata['name']}\nRecording: {metadata['author']}\nSource: {metadata['page']}\nLicense: {metadata['license']} {metadata['licenseUrl']}\nAdapted loops by REV: cropping, mono conversion, pitch changes, seam crossfade and normalization.\nThese adapted WAV files are distributed under CC BY-SA 3.0.\nNo endorsement by the author or vehicle manufacturer.\n",encoding='utf-8')
    print(name,len(report),'recorded loops prepared')
