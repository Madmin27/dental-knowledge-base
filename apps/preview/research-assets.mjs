import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const names=['tooth','pulp','pdl'];
const hash=b=>createHash('sha256').update(b).digest('hex');
// Explicit opt-in LAN review assets, outside Git and outside the academic release registry.
// Read/verify once; HTTP never accepts a disk path and never serves STEP or source archives.
export async function loadResearchAssets(directory){
  const files=new Map();const data=await readFile(join(directory,'manifest.json'));const manifest=JSON.parse(data);
  if(manifest.format!=='dkb-research-mesh-v1'||manifest.id!=='kang-2024-pulp-v1'||manifest.license!=='CC-BY-4.0'||manifest.reviewStatus!=='pending-human-academic-and-release-review'||manifest.registrationToWholeMouth!==false||manifest.clinicalMeasurement!==false||manifest.models?.length!==3)throw Error('Invalid research manifest');
  const seen=new Set();
  for(const m of manifest.models){
    if(!names.includes(m.id)||seen.has(m.id)||m.file!==m.id+'.bin'||!Number.isSafeInteger(m.vertices)||m.vertices<3||m.vertices>1000000||!Number.isSafeInteger(m.triangles)||m.triangles<1||m.triangles>2000000)throw Error('Invalid research model');seen.add(m.id);
    const bytes=await readFile(join(directory,m.file));if(bytes.length!==m.vertices*24+m.triangles*12||hash(bytes)!==m.sha256)throw Error('Research asset digest/length mismatch');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i<m.vertices*24;i+=4)if(!Number.isFinite(view.getFloat32(i,true)))throw Error('Nonfinite research vertex');for(let i=m.vertices*24;i<bytes.length;i+=4)if(view.getUint32(i,true)>=m.vertices)throw Error('Research index out of bounds');
    files.set('/research/pulp/'+m.file,{type:'application/octet-stream',body:bytes});
  }
  files.set('/research/pulp/manifest.json',{type:'application/json; charset=utf-8',body:data});files.set('/research/pulp/ATTRIBUTION.txt',{type:'text/plain; charset=utf-8',body:await readFile(join(directory,'ATTRIBUTION.txt'))});return files;
}
