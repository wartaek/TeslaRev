import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sources=[
  {id:'f1-williams',file:'Williams-Renault_FW18_(1996).ogg',name:'Williams-Renault FW18 (1996)',author:'Edvvc / Ed Pond'},
  {id:'f1-mclaren',file:'McLaren-Mercedes_MP4_23_(2008).ogg',name:'McLaren-Mercedes MP4/23 (2008)',author:'Edvvc / Ed Pond'},
];
await mkdir('scripts/audio-sources',{recursive:true});
for(const source of sources){
  const hash=createHash('md5').update(source.file).digest('hex');
  const url=`https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash.slice(0,2)}/${encodeURIComponent(source.file)}`;
  const response=await fetch(url,{headers:{'User-Agent':'REV-AudioPrototype/1.0'}});
  if(!response.ok)throw new Error(`${source.file}: ${response.status}`);
  const data=Buffer.from(await response.arrayBuffer());
  if(data.toString('ascii',0,4)!=='OggS')throw new Error('Invalid OGG');
  await writeFile(`scripts/audio-sources/${source.id}.ogg`,data);
  await writeFile(`scripts/audio-sources/${source.id}.json`,JSON.stringify({...source,url,page:`https://commons.wikimedia.org/wiki/File:${source.file}`,license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',sha256:createHash('sha256').update(data).digest('hex')},null,2));
  console.log(source.id,data.length);
}
