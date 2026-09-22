import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../apps/preview/public/models/z-anatomy/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('dentition.json',base),'utf8'));
const file=await readFile(new URL('dentition.bin',base));
const bytes=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
test('source asset binds binary to provenance and excludes unsupported structures',()=>{
 assert.equal(createHash('sha256').update(file).digest('hex'),manifest.binarySha256);
 assert.equal(manifest.sourceRevision,'6c7f9016bd5899ac8edafd31b9900c151df42ed6');
 assert.equal(manifest.sourceFiles.length,2);
 assert.equal(manifest.license,'CC-BY-SA-4.0');
 assert.match(manifest.publicationStatus,/no academic or persisted rights approval/);
 const ids=manifest.structures.filter(s=>s.fdi).map(s=>s.fdi).sort((a,b)=>a-b);
 assert.deepEqual(ids,[...Array(4)].flatMap((_,q)=>Array.from({length:7},(_,i)=>(q+1)*10+i+1)));
 assert.equal(manifest.structures.length,34);
 assert.equal(manifest.structures.filter(s=>s.kind==='gingiva').length,3);
 assert.deepEqual(manifest.structures.filter(s=>s.kind==='bone').map(s=>s.name).sort(),['Mandible','Maxilla.l','Maxilla.r']);
 assert.ok(manifest.missing.includes('pulp'));assert.ok(manifest.missing.includes('canals'));
});
test('all geometry ranges, normals, indices, material groups and patient sides are valid',()=>{
 for(const s of manifest.structures){
  for(const f of [s.positions,s.normals,s.indices]){assert.equal(f.offset%4,0);assert.ok(f.offset+f.count*4<=bytes.byteLength);}
  const p=new Float32Array(bytes,s.positions.offset,s.positions.count),n=new Float32Array(bytes,s.normals.offset,s.normals.count),indices=new Uint32Array(bytes,s.indices.offset,s.indices.count);
  assert.equal(p.length,n.length);assert.equal(p.length%3,0);assert.equal(indices.length%3,0);
  let x=0;
  for(let i=0;i<p.length;i+=3){assert.ok(Number.isFinite(p[i]+p[i+1]+p[i+2]));x+=p[i];const norm=Math.hypot(n[i],n[i+1],n[i+2]);assert.ok(norm>.99&&norm<1.01);}
  for(const i of indices)assert.ok(i<p.length/3);
  let end=0;for(const g of s.groups){assert.equal(g.start,end);assert.equal(g.count%3,0);end+=g.count;}assert.equal(end,indices.length);
  if(s.fdi){const q=Math.floor(s.fdi/10);assert.equal(s.jaw,q<3?'upper':'lower');assert.ok([1,4].includes(q)?x<0:x>0);assert.ok(s.groups.some(g=>g.material.toLowerCase().includes('root')));}
 }
});
test('distribution keeps upstream notices, derivative terms and limitations together',async()=>{
 const notice=await readFile(new URL('UPSTREAM-NOTICE.txt',base),'utf8');const attribution=await readFile(new URL('ATTRIBUTION.txt',base),'utf8');
 for(const text of [notice,attribution]){assert.match(text,/BodyParts3D/);assert.match(text,/2.1 Japan/);assert.match(text,/Z-Anatomy/);assert.match(text,/4.0/);}
 assert.match(attribution,/no third molars, pulp, canals/i);assert.match(attribution,/Catmull-Clark/);
 assert.match(await readFile(new URL('CC-BY-SA-4.0.txt',base),'utf8'),/Attribution-ShareAlike 4.0 International/);
});
