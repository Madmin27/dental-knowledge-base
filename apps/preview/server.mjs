import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadResearchAssets} from './research-assets.mjs';
import {createIntake,loadCatalog} from './contributions.mjs';
import {scenarios,evaluateScenario} from './scenarios.mjs';
import {requestLanguage,localizedHTML} from './localization.mjs';
const files=new Map([['/',['anatomy.html','text/html; charset=utf-8']],['/style.css',['style.css','text/css; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']]]);
files.set('/favicon.svg',['favicon.svg','image/svg+xml']);
files.set('/i18n.js',['i18n.js','text/javascript; charset=utf-8']);
files.set('/viewer-boot.js',['viewer-boot.js','text/javascript; charset=utf-8']);
files.set('/drafts.js',['drafts.js','text/javascript; charset=utf-8']);
files.set('/report',['report.html','text/html; charset=utf-8']);
files.set('/overview',['index.html','text/html; charset=utf-8']);
for(const name of ['atlas.js','atlas-geometry.js','atlas.css','vendor/three.module.js','vendor/three.core.js','vendor/OrbitControls.js','vendor/THREE-LICENSE.txt']) {
  files.set('/'+name,[name,name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.txt')?'text/plain; charset=utf-8':'text/javascript; charset=utf-8']);
}
files.set('/anatomy',['anatomy.html','text/html; charset=utf-8']);
for (const name of ['anatomy.js','anatomy.css','studio.css','studio.js','viewer-runtime.js','vendor/RoomEnvironment.js']) files.set('/'+name,[name,name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8']);
for (const name of ['dentition.json','dentition.bin','neurovascular.json','neurovascular.bin','ATTRIBUTION.txt','UPSTREAM-NOTICE.txt','CC-BY-SA-4.0.txt']) files.set('/models/z-anatomy/'+name,['models/z-anatomy/'+name,name.endsWith('.json')?'application/json':name.endsWith('.bin')?'application/octet-stream':'text/plain; charset=utf-8']);
for(const name of ['contributions.js','contributions.css','view-contract.js']) files.set('/'+name,[name,name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8']);
files.set('/contributions',['contributions.html','text/html; charset=utf-8']);
files.set('/tooth-interior',['interior.html','text/html; charset=utf-8']);
for(const name of ['interior.js','interior.css'])files.set('/'+name,[name,name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8']);
export function previewServer({intake,researchAssets}={}) {
  return createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('Cache-Control','no-store');
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    // Public source assets only. Private API responses keep no-store.
    const model=(body,type)=>{
      const etag='"'+createHash('sha256').update(body).digest('hex')+'"';
      res.setHeader('ETag',etag);res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
      if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
      res.writeHead(200,{'Content-Type':type,'Content-Length':body.length});res.end(body);
    };
    let requestURL;try{requestURL=new URL(req.url,'http://localhost');}catch{return json(400,{error:'Invalid request URL'});}
    if(intake && await intake.handle(req,requestURL,json))return;
    if(req.method!=='GET') {res.setHeader('Allow','GET');return json(405,{error:'Read-only preview'});}
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/health') return json(200,{ok:true,mode:'anatomy-preview',databaseConnected:false,contributionsEnabled:Boolean(intake),interiorResearchEnabled:Boolean(researchAssets)});
      if(url.pathname==='/api/scenarios') return json(200,{demo:true,scenarios});
      if(url.pathname==='/api/check') {
        const result=await evaluateScenario(url.searchParams.get('scenario'));
        return json(result?200:404,result??{error:'Unknown scenario'});
      }
      const research=researchAssets?.get(url.pathname);
      if(research){model(research.body,research.type);return;}
      const file=files.get(url.pathname);
      if(!file) return json(404,{error:'Not found'});
      const body=await readFile(new URL('./public/'+file[0],import.meta.url));
      if(url.pathname.startsWith('/models/')){model(body,file[1]);return;}
      if(file[1].startsWith('text/html')){
        const lang=requestLanguage(url,req.headers.cookie);
        res.setHeader('Content-Language',lang);
        res.setHeader('Vary','Cookie');
        if(['en','tr'].includes(url.searchParams.get('lang')))res.setHeader('Set-Cookie',`dental-language=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`);
        res.writeHead(200,{'Content-Type':file[1]});res.end(localizedHTML(body.toString('utf8'),lang));
      }else{res.writeHead(200,{'Content-Type':file[1]});res.end(body);}
    } catch {json(500,{error:'Preview temporarily unavailable'});}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PREVIEW_PORT ?? 3057);
  if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('Invalid preview port');
  const host=process.env.PREVIEW_HOST ?? '127.0.0.1';
  if(isIP(host)!==4 || host==='0.0.0.0') throw new Error('A specific IPv4 preview address is required');
  const researchAssets=process.env.RESEARCH_ASSET_DIR?await loadResearchAssets(process.env.RESEARCH_ASSET_DIR):undefined;
  const researchManifest=researchAssets?JSON.parse(researchAssets.get('/research/pulp/manifest.json').body):undefined;
  const intake=process.env.CONTRIBUTIONS_DIR?await createIntake({directory:process.env.CONTRIBUTIONS_DIR,origin:process.env.PREVIEW_ORIGIN,adminKey:(await readFile(process.env.CREDENTIALS_DIRECTORY+'/moderator.key','utf8')).trim(),catalog:await loadCatalog({researchManifest}),trustedProxy:process.env.PREVIEW_TRUSTED_PROXY}):undefined;
  previewServer({intake,researchAssets}).listen(port,host,()=>console.log(`Dental preview http://${host}:${port}`));
}
