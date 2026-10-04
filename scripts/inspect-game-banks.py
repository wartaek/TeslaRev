import sys
from pathlib import Path
sys.path.insert(0,str(Path('../../work/audio-python').resolve()))
import numpy as np
import soundfile as sf
for path in sorted(Path('scripts/audio-sources/rocketleague').glob('*.ogg')):
    x,sr=sf.read(path,always_2d=True);x=x.mean(axis=1)
    n=min(len(x),sr);segment=x[len(x)//2-n//2:len(x)//2+n//2]
    spectrum=abs(np.fft.rfft(segment*np.hanning(len(segment))))
    freq=np.fft.rfftfreq(len(segment),1/sr)
    mask=(freq>50)&(freq<3000)
    peak=freq[mask][np.argmax(spectrum[mask])]
    envelope=[np.sqrt(np.mean(x[i:i+sr//10]**2)) for i in range(0,len(x)-sr//10,sr//10)]
    variation=np.std(envelope)/max(.00001,np.mean(envelope))
    print(path.stem,round(len(x)/sr,2),'peak',round(peak),'variation',round(variation,2))
