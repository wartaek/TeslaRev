import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
const mode = process.argv[2];
if (mode === 'icons') {
  const crc = data => { let c = 0xffffffff; for (const b of data) { c ^= b; for(let i=0;i<8;i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const body=Buffer.concat([Buffer.from(type),data]); const n=Buffer.alloc(4),check=Buffer.alloc(4); n.writeUInt32BE(data.length);check.writeUInt32BE(crc(body));return Buffer.concat([n,body,check]); };
  const letters=['11110100011000111110101001001010001','11111100001000011110100001000011111','10001100011000110001100010101000100'];
  await mkdir('public/icons',{recursive:true});
  for(const [name,size] of [['icon-192',192],['icon-512',512],['maskable-512',512],['apple-touch-icon',180]]) {
    const pixels=Buffer.alloc((size*3+1)*size); const scale=Math.floor(size/30), width=17*scale, left=Math.floor((size-width)/2),top=Math.floor((size-7*scale)/2);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const gx=Math.floor((x-left)/scale),gy=Math.floor((y-top)/scale),letter=Math.floor(gx/6),col=gx%6;
      const ink=gx>=0&&gy>=0&&gy<7&&letter<3&&col<5&&letters[letter]?.[gy*5+col]==='1';
      const bar=y>top+9*scale&&y<top+10*scale&&x>=left&&x<left+width;
      const color=ink||bar?[192,248,121]:[16,21,25];const offset=y*(size*3+1)+1+x*3;
      pixels.set(color,offset);
    }
    const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
    await writeFile(`public/icons/${name}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
  }
  console.log('REV icons generated');
} else if (mode === 'worker') {
  async function files(dir) { const result=[]; for(const item of await readdir(dir,{withFileTypes:true})){const path=`${dir}/${item.name}`;result.push(...(item.isDirectory()?await files(path):[path]));} return result; }
  const assets=(await files('dist')).filter(p=>!p.endsWith('/sw.js')).sort();
  const hash=createHash('sha256');for(const file of assets){hash.update(file);hash.update(await readFile(file));}
  const cache='rev-static-'+hash.digest('hex').slice(0,16);
  const urls=assets.map(p=>'/'+p.slice(5));
  await writeFile('dist/sw.js',`const CACHE=${JSON.stringify(cache)};
const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try { await cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'}))); }
  catch(error) { await caches.delete(CACHE); throw error; }
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys()) if(key.startsWith('rev-static-')&&key!==CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(request);if(response.ok)await cache.put('/index.html',response.clone());return response;}catch{return await cache.match('/index.html')||Response.error();}})());return;
  }
  if(!ASSETS.includes(url.pathname))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(url.pathname)||fetch(request);})());
});
`);
  console.log(`PWA: ${urls.length} resources precached (${cache})`);
} else throw new Error('Usage: node scripts/pwa.mjs icons|worker');
