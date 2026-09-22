import {isIP} from 'node:net';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createIntake,loadCatalog} from './contributions.mjs';
import {scenarios,evaluateScenario} from './scenarios.mjs';
const files=new Map([['/',['anatomy.html','text/html; charset=utf-8']],['/style.css',['style.css','text/css; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']]]);
files.set('/overview',['index.html','text/html; charset=utf-8']);
for(const name of ['atlas.js','atlas-geometry.js','atlas.css','vendor/three.module.js','vendor/three.core.js','vendor/OrbitControls.js','vendor/THREE-LICENSE.txt']) {
  files.set('/'+name,[name,name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.txt')?'text/plain; charset=utf-8':'text/javascript; charset=utf-8']);
}
files.set('/anatomy',['anatomy.html','text/html; charset=utf-8']);
for (const name of ['anatomy.js','anatomy.css','vendor/RoomEnvironment.js']) files.set('/'+name,[name,name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8']);
for (const name of ['dentition.json','dentition.bin','neurovascular.json','neurovascular.bin','ATTRIBUTION.txt','UPSTREAM-NOTICE.txt','CC-BY-SA-4.0.txt']) files.set('/models/z-anatomy/'+name,['models/z-anatomy/'+name,name.endsWith('.json')?'application/json':name.endsWith('.bin')?'application/octet-stream':'text/plain; charset=utf-8']);
for(const name of ['contributions.js','contributions.css','view-contract.js']) files.set('/'+name,[name,name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8']);
files.set('/contributions',['contributions.html','text/html; charset=utf-8']);
export function previewServer({intake}={}) {
  return createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('Cache-Control','no-store');
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    let requestURL;try{requestURL=new URL(req.url,'http://localhost');}catch{return json(400,{error:'Invalid request URL'});}
    if(intake && await intake.handle(req,requestURL,json))return;
    if(req.method!=='GET') {res.setHeader('Allow','GET');return json(405,{error:'Read-only preview'});}
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/health') return json(200,{ok:true,mode:'anatomy-preview',databaseConnected:false,contributionsEnabled:Boolean(intake)});
      if(url.pathname==='/api/scenarios') return json(200,{demo:true,scenarios});
      if(url.pathname==='/api/check') {
        const result=await evaluateScenario(url.searchParams.get('scenario'));
        return json(result?200:404,result??{error:'Unknown scenario'});
      }
      const file=files.get(url.pathname);
      if(!file) return json(404,{error:'Not found'});
      const body=await readFile(new URL('./public/'+file[0],import.meta.url));
      res.writeHead(200,{'Content-Type':file[1]});res.end(body);
    } catch {json(500,{error:'Preview temporarily unavailable'});}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PREVIEW_PORT ?? 3057);
  if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('Invalid preview port');
  const host=process.env.PREVIEW_HOST ?? '127.0.0.1';
  if(isIP(host)!==4 || host==='0.0.0.0') throw new Error('A specific IPv4 preview address is required');
  const intake=process.env.CONTRIBUTIONS_DIR?await createIntake({directory:process.env.CONTRIBUTIONS_DIR,origin:process.env.PREVIEW_ORIGIN,adminKey:(await readFile(process.env.CREDENTIALS_DIRECTORY+'/moderator.key','utf8')).trim(),catalog:await loadCatalog()}):undefined;
  previewServer({intake}).listen(port,host,()=>console.log(`Dental preview http://${host}:${port}`));
}
