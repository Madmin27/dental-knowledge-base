import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
const dest=new URL('../apps/preview/public/vendor/',import.meta.url);
const src=new URL('../node_modules/three/',import.meta.url);
await mkdir(dest,{recursive:true});
for(const name of ['three.module.js','three.core.js']) await copyFile(new URL('build/'+name,src),new URL(name,dest));
await copyFile(new URL('LICENSE',src),new URL('THREE-LICENSE.txt',dest));
const orbit=await readFile(new URL('examples/jsm/controls/OrbitControls.js',src),'utf8');
await writeFile(new URL('OrbitControls.js',dest),orbit.replace("from 'three'","from './three.module.js'"));
