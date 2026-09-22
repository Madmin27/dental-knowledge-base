import {mkdir,readFile,readdir,open,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {validateView} from './public/view-contract.js';
const hash=v=>createHash('sha256').update(v).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
const ID=/^[a-f0-9]{32}$/;const KEY=/^[a-f0-9]{64}$/;
export const categories=['anatomy','missing','label','source','technical','suggestion'];
const transitions={received:['triage','needs_evidence','closed'],triage:['needs_evidence','change_planned','closed'],needs_evidence:['triage','closed'],change_planned:['triage','addressed','closed'],addressed:['triage','closed'],closed:['triage']};
function problem(code,message){const e=Error(message);e.status=code;throw e;}
function text(v,max,min=0){if(typeof v!=='string'||v.trim().length<min||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))problem(422,'Metin uzunluğu veya içeriği geçersiz.');return v.trim();}
function evidence(v){if(!Array.isArray(v)||v.length>8)problem(422,'En fazla 8 kaynak bağlantısı ekleyin.');return v.map(x=>{x=text(x,1000,1);let u;try{u=new URL(x);}catch{problem(422,'Kaynak bağlantısı geçersiz.');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)problem(422,'Kaynak http/https bağlantısı olmalı.');return x;});}
async function body(req){if(!req.headers['content-type']?.startsWith('application/json')||req.headers['x-dkb-request']!=='1')problem(415,'JSON isteği gerekli.');let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>24000)problem(413,'Bildirim çok büyük.');chunks.push(chunk);}try{const value=JSON.parse(Buffer.concat(chunks));if(!value||typeof value!=='object'||Array.isArray(value))problem(400,'JSON nesnesi gerekli.');return value;}catch{problem(400,'JSON okunamadı.');}}
export async function createIntake({directory,origin,adminKey,catalog,maxRecords=2000,rateLimit=40}) {
  if(!directory||!origin||!KEY.test(adminKey))throw Error('Invalid intake configuration');
  const expected=new URL(origin);await mkdir(directory,{recursive:true,mode:0o700});
  // One process owns the spool. Uncommitted temporary files are never receipts.
  for(const f of await readdir(directory))if(/^\.[a-f0-9-]+\.tmp$/.test(f))await unlink(join(directory,f));
  let queue=Promise.resolve();const rates=new Map();
  const serial=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job;};
  function limit(key){const now=Date.now();let entry=rates.get(key);if(!entry||entry.until<now){entry={until:now+600000,count:0};if(rates.size>=4096)rates.delete(rates.keys().next().value);rates.set(key,entry);}if(++entry.count>rateLimit)problem(429,'Çok fazla istek. 10 dakika sonra yeniden deneyin.');}
  const path=id=>join(directory,id+'.json');
  async function read(id){if(!ID.test(id))return null;try{return JSON.parse(await readFile(path(id),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  async function save(record){const encoded=JSON.stringify(record);if(Buffer.byteLength(encoded)>262144)problem(413,'Bildirim geçmişi boyut sınırına ulaştı.');const tmp=join(directory,'.'+randomUUID()+'.tmp');let file;try{file=await open(tmp,'wx',0o600);await file.writeFile(encoded);await file.sync();await file.close();file=null;await rename(tmp,path(record.id));const dir=await open(directory,'r');try{await dir.sync();}finally{await dir.close();}}finally{if(file)await file.close();await unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
  const publicRecord=r=>({schemaVersion:r.schemaVersion,id:r.id,createdAt:r.createdAt,submission:r.submission,events:r.events,revision:r.events.length,redactedAt:r.redactedAt??null,status:r.events.at(-1)?.status??'received'});
  return {enabled:true, async handle(req,url,json){
    if(!url.pathname.startsWith('/api/contributions'))return false;
    try{
      if(req.headers.host!==expected.host||(req.headers.origin&&req.headers.origin!==expected.origin))problem(403,'İstek kaynağı uygun değil.');
      if(!['GET','POST'].includes(req.method))problem(405,'Yöntem desteklenmiyor.');
      const token=req.headers.authorization?.replace(/^Bearer /,'')??'';
      const admin=equal(token,adminKey);
      limit((admin?'admin:':'ip:')+req.socket.remoteAddress);
      if(req.method==='POST'&&!admin&&req.headers.origin!==expected.origin)problem(403,'İstek kaynağı gerekli.');
      if(url.pathname==='/api/contributions'&&req.method==='GET'){
        if(!admin)problem(404,'Bildirim bulunamadı veya erişim anahtarı yanlış.');
        const rows=[];for(const f of await readdir(directory))if(/^[a-f0-9]{32}\.json$/.test(f)){const r=publicRecord(await read(f.slice(0,-5)));rows.push({id:r.id,createdAt:r.createdAt,status:r.status,revision:r.revision,category:r.submission.category,structure:r.submission.view.structure});}
        json(200,{records:rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});return true;
      }
      if(url.pathname==='/api/contributions'&&req.method==='POST'){
        const b=await body(req);if(!ID.test(b.id)||!KEY.test(token))problem(422,'Bildirim anahtarı geçersiz.');
        if(b.consent!==true||!categories.includes(b.category)||!['student','educator','dentist','researcher','other'].includes(b.role))problem(422,'Kategori, rol ve onay gerekli.');
        let view;try{view=validateView(b.view,catalog);}catch(e){problem(422,e.message);}
        const submission={category:b.category,role:b.role,alias:text(b.alias,80),description:text(b.description,4000,15),expected:text(b.expected,2000),evidence:evidence(b.evidence??[]),consent:true,view};
        const digest=hash(JSON.stringify(submission));
        await serial(async()=>{
          const previous=await read(b.id);
          if(previous){if(previous.redactedAt)problem(409,'İçeriği kaldırılmış bildirim yeniden gönderilemez.');if(!equal(previous.keyHash,hash(token))||previous.payloadHash!==digest)problem(409,'Aynı bildirim numarası farklı içerikle kullanılamaz.');const dir=await open(directory,'r');try{await dir.sync();}finally{await dir.close();}json(200,publicRecord(previous));return;}
          const count=(await readdir(directory)).filter(x=>/^[a-f0-9]{32}\.json$/.test(x)).length;if(count>=maxRecords)problem(503,'Katkı kuyruğu dolu; bakımcıya bildirin.');
          const r={schemaVersion:1,id:b.id,keyHash:hash(token),payloadHash:digest,createdAt:new Date().toISOString(),submission,events:[]};await save(r);json(201,publicRecord(r));
        });return true;
      }
      const match=url.pathname.match(/^\/api\/contributions\/([a-f0-9]{32})(?:\/(events|redact))?$/);
      if(!match)problem(404,'Bildirim bulunamadı veya erişim anahtarı yanlış.');
      const id=match[1];
      const authorize=r=>{if(!r||(!admin&&!equal(r.keyHash,hash(token))))problem(404,'Bildirim bulunamadı veya erişim anahtarı yanlış.');};
      if(req.method==='GET'&&!match[2]){const r=await read(id);authorize(r);json(200,publicRecord(r));return true;}
      if(req.method!=='POST'||!match[2])problem(405,'Yöntem desteklenmiyor.');
      const b=await body(req);
      await serial(async()=>{
        const r=await read(id);authorize(r);limit('record:'+id);
        if(match[2]==='redact'){
          if(!admin)problem(404,'Bildirim bulunamadı veya erişim anahtarı yanlış.');
          if(r.redactedAt){json(200,publicRecord(r));return;}
          if(b.revision!==r.events.length)problem(409,'Bildirim güncellendi.');
          r.submission={...r.submission,alias:'',description:'İçerik gizlilik nedeniyle kaldırıldı.',expected:'',evidence:[]};
          r.events=r.events.map(e=>({...e,note:'İçerik gizlilik nedeniyle kaldırıldı.',evidence:[]}));
          r.redactedAt=new Date().toISOString();r.events.push({at:r.redactedAt,actor:'maintainer',status:'closed',note:'Metin ve kaynak bağlantıları gizlilik/saklama süresi nedeniyle kaldırıldı.',evidence:[]});
          await save(r);json(200,publicRecord(r));return;
        }
        if(r.redactedAt)problem(409,'İçeriği kaldırılmış bildirim değiştirilemez.');
        if(b.revision!==r.events.length)problem(409,'Bildirim güncellendi. Yenileyip yeniden deneyin.');
        if(r.events.length>=100)problem(409,'Bu bildirim için olay sınırına ulaşıldı.');
        const status=r.events.at(-1)?.status??'received';
        const next=admin?(b.status??status):status;
        if(admin&&next!==status&&!transitions[status]?.includes(next))problem(422,'İzin verilmeyen durum geçişi.');
        if(!admin&&b.status!==undefined)problem(403,'Durum değiştirme yetkiniz yok.');
        const links=evidence(b.evidence??[]);
        if(next==='addressed'&&next!==status&&admin&&links.length===0)problem(422,'Uygulama sonucu için değişiklik veya doğrulama bağlantısı gerekli.');
        r.events.push({at:new Date().toISOString(),actor:admin?'maintainer':'contributor',status:next,note:text(b.note,4000,5),evidence:links});await save(r);json(200,publicRecord(r));
      });return true;
    }catch(e){json(e.status??503,{error:e.status?e.message:'Katkı kaydedilemedi. Takip anahtarınızı koruyup yeniden deneyin.'});return true;}
  }};
}
export async function loadCatalog(){const read=async name=>JSON.parse(await readFile(new URL('./public/models/z-anatomy/'+name+'.json',import.meta.url),'utf8'));const [d,n]=await Promise.all([read('dentition'),read('neurovascular')]);return {assets:{dentition:d.binarySha256,neurovascular:n.binarySha256},teeth:d.structures.filter(s=>s.fdi).map(s=>s.fdi),structures:[...d.structures,...n.structures].map(s=>({name:s.name,label:s.label??s.name,fdi:s.fdi??null}))};}
