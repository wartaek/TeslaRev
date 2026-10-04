import {mkdir,writeFile} from 'node:fs/promises';
const banks=['Number6','Car03','TakumiMK2','Enspire'];
await mkdir('scripts/audio-sources/rocketleague',{recursive:true});
for(const bank of banks){
  const response=await fetch(`https://api.github.com/repos/ItsBrank/RocketLeague-Audio/contents/Motors/SFX_Motor_${bank}`);
  if(!response.ok)throw new Error(`${bank}: ${response.status}`);
  const entries=await response.json();
  for(const entry of entries){
    if(!entry.name.endsWith('.ogg'))continue;
    const audio=await fetch(entry.download_url);if(!audio.ok)throw new Error(entry.name);
    await writeFile(`scripts/audio-sources/rocketleague/${entry.name}`,Buffer.from(await audio.arrayBuffer()));
  }
  await writeFile(`scripts/audio-sources/rocketleague/${bank}.json`,JSON.stringify(entries,null,2));
  console.log(bank,entries.length,'files fetched');
}
