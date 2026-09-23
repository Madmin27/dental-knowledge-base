import {t,dateLocale} from './i18n.js';
const $=s=>document.querySelector(s);
const labels={received:t('Alındı'),triage:t('Ön incelemede'),needs_evidence:t('Ek kaynak bekleniyor'),change_planned:t('Düzeltme planlandı'),addressed:t('Uygulama sonucu bildirildi'),closed:t('Kapatıldı')};
const categories={anatomy:t('Anatomik ilişki / doğruluk'),missing:t('Eksik yapı veya içerik'),label:t('Adlandırma / diş numarası'),source:t('Kaynak / lisans'),technical:t('Görüntüleme / teknik sorun'),suggestion:t('Eğitim önerisi')};
const hex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),v=>v.toString(16).padStart(2,'0')).join('');
const links=value=>value.split('\n').map(x=>x.trim()).filter(Boolean);
function node(tag,text,parent){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(parent)parent.append(el);return el;}
async function request(path,key,body){const response=await fetch('/api/contributions'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json','X-DKB-Request':'1'}:{})},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok){const error=Error(t(result.error??'İstek tamamlanamadı.'));error.status=response.status;throw error;}return result;}
const tracking=(id,key)=>location.origin+'/contributions#id='+id+'&key='+key;
const notice=t('Bu kuyruk akademik onay veya yayın kararı vermez. Hasta adı, görüntüsü, dosyası veya kimliğini belirleyebilecek bilgi eklemeyin.');
const languageNotice=t('Katkı ve tartışmaların ortak dili İngilizcedir. Lütfen gözlemlerinizi, önerilerinizi ve tartışma yanıtlarınızı İngilizce yazın. Kaynakları özgün dilinde paylaşabilirsiniz. İngilizce yazılması tek başına bilimsel kabul anlamına gelmez.');
function field(form,title,name,{type='text',required=false,max=4000,options,rows=4}={}){const label=node('label',title,form);label.htmlFor='contribution-'+name;const el=node(options?'select':type==='textarea'?'textarea':'input',undefined,form);el.id=label.htmlFor;el.name=name;el.required=required;if(options)for(const [value,title]of Object.entries(options)){const o=node('option',title,el);o.value=value;}else if(type==='textarea'){el.rows=rows;el.maxLength=max;}else{el.type=type;el.maxLength=max;}return el;}
function errorBox(parent){const el=node('p','',parent);el.className='contribution-message';el.setAttribute('role','status');return el;}
function receipt(parent,id,key){node('h3',t('Özel takip bağlantınız'),parent);node('p',t('Bu bağlantıyı saklayın. Bağlantıya sahip kişi bildiriminizi okuyabilir ve ek açıklama yazabilir. Kaybolursa geri getirilemez.'),parent);const a=node('a',t('Bildirimi aç →'),parent);a.href=tracking(id,key);const input=node('input',undefined,parent);input.value=a.href;input.readOnly=true;input.setAttribute('aria-label',t('Özel takip bağlantısı'));input.addEventListener('click',()=>input.select());const button=node('button',t('Takip bilgisini indir'),parent);button.type='button';button.onclick=()=>{const blob=new Blob(['Dental Open Source — '+t('Katkı takibi')+'\n'+a.href+'\n'],{type:'text/plain'});const url=URL.createObjectURL(blob);const link=node('a');link.href=url;link.download='dental-contribution-'+id.slice(0,8)+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};}
export async function installContributions({captureView,restoreView,catalog}){
  const button=$('#contribute');
  const dialog=node('dialog');dialog.id='contribution-dialog';dialog.className='contribution-panel';dialog.setAttribute('aria-labelledby','contribution-title');document.body.append(dialog);
  const close=node('button',t('Kapat ×'),dialog);close.className='contribution-close';close.type='button';close.onclick=()=>dialog.close();
  node('h2',t('Atlası birlikte geliştirelim'),dialog).id='contribution-title';
  node('p',t('Anatomik bir sorun bildirin, kaynak önerin veya eğitim deneyimini iyileştirin. Bildirim önce bakımcı tarafından değerlendirilir; bilimsel değişiklikler ayrıca uzman incelemesi gerektirir.'),dialog);
  node('p',notice,dialog).className='contribution-notice';
  node('p',languageNotice,dialog).className='contribution-language';
  const content=node('div',undefined,dialog);const info=errorBox(content);
  try{const health=await(await fetch('/health')).json();if(!health.contributionsEnabled){button.disabled=false;button.onclick=()=>{info.textContent=t('Katkı kuyruğu bu sunucuda etkin değil.');dialog.showModal();};return;}}catch{button.disabled=false;button.onclick=()=>{info.textContent=t('Katkı hizmetine ulaşılamıyor. Sayfayı yenileyin.');dialog.showModal();};return;}
  button.disabled=false;
  let pending;
  button.onclick=()=>{
    if(pending){dialog.showModal();return;}
    content.replaceChildren();const view=captureView();
    const form=node('form',undefined,content);form.id='contribution-form';
    node('p',t('Bu anın kamera ve katman ayarları eklenecek. Aşağıdan ilgili yapıyı seçebilirsiniz; yüzey üzerinde nokta işaretleme değildir.'),form);
    const structure=field(form,t('İlgili yapı'),'structure',{options:Object.fromEntries(catalog.structures.map(s=>[s.name,s.fdi?s.fdi+' · '+s.label:s.label]))});structure.value=view.structure;
    field(form,t('Katkı türü'),'category',{options:categories});
    field(form,t('Ne gözlemlediniz?'),'description',{type:'textarea',required:true});
    field(form,t('Nasıl olmasını bekliyorsunuz?'),'expected',{type:'textarea',max:2000,rows:2});
    field(form,t('Kaynak bağlantıları (her satıra bir http/https bağlantısı, en fazla 8)'),'evidence',{type:'textarea',max:8000,rows:2});
    field(form,t('Görünen ad (isteğe bağlı)'),'alias',{max:80});
    field(form,t('Katılımınız (beyan; doğrulanmış uzmanlık değildir)'),'role',{options:{student:t('Öğrenci'),educator:t('Eğitimci'),dentist:t('Diş hekimi'),researcher:t('Araştırmacı'),other:t('Diğer')}});
    const consent=field(form,t('Kimlik belirleyici hasta bilgisi paylaşmıyorum; bu metnin ve görünümün proje incelemesi için saklanmasını kabul ediyorum.'),'consent',{type:'checkbox',required:true});
    node('p',t('Bildirimler herkese açık değildir; bağlantı sahibi ve bakımcı erişebilir. Silme talebinizi takip ekranına yazabilirsiniz. Ham dosya yüklenmez.'),form);
    const submit=node('button',t('Bildirimi gönder'),form);submit.type='submit';submit.className='primary';const message=errorBox(form);
    form.onsubmit=async event=>{
      event.preventDefault();
      if(!pending){const data=new FormData(form);pending={id:hex(16),key:hex(32),body:{category:data.get('category'),role:data.get('role'),alias:data.get('alias'),description:data.get('description'),expected:data.get('expected'),evidence:links(data.get('evidence')),consent:consent.checked,view:{...view,structure:structure.value}}};}
      submit.disabled=true;for(const field of form.elements)field.disabled=true;message.textContent=t('Kaydediliyor…');
      try{
        const r=await request('',pending.key,{id:pending.id,...pending.body});const key=pending.key;pending=null;content.replaceChildren();node('h3',t('Bildiriminiz kaydedildi'),content);node('p',t('Takip no: ')+r.id+' · '+labels[r.status],content);receipt(content,r.id,key);
        const again=node('button',t('Yeni katkı'),content);again.onclick=()=>button.click();
      }catch(e){if(e.status&&e.status<500&&e.status!==429){pending=null;message.textContent=t(e.message)+t(' Alanları düzeltip yeniden gönderin.');return;}message.textContent=t(e.message)+t(' Gönder düğmesi aynı kaydı güvenle yeniden dener. Sayfayı kapatmadan takip bilgisini saklayın.');if(!$('#pending-receipt')){const backup=node('div',undefined,form);backup.id='pending-receipt';receipt(backup,pending.id,pending.key);} }
      finally{for(const field of form.elements)field.disabled=Boolean(pending)&&['INPUT','TEXTAREA','SELECT'].includes(field.tagName)&&!field.readOnly;submit.disabled=false;}
    };
    dialog.showModal();
  };
  // Restore only an explicitly requested, authenticated record, never arbitrary URL coordinates.
  const params=new URLSearchParams(location.hash.slice(1));
  if(params.get('view')&&params.get('key')){
    try{const r=await request('/'+params.get('view'),params.get('key'));restoreView(r.submission.view);const note=node('p',t('Bildirimde kaydedilen görünüm açıldı. Güncel model sürümü eşleşiyor.'),document.body);note.className='contribution-toast';note.setAttribute('role','status');setTimeout(()=>note.remove(),8000);}
    catch(e){content.replaceChildren();node('p',t(e.message),content);dialog.showModal();}
    history.replaceState(null,'',location.pathname+location.search);
  }
}
async function trackingPage(){
  const root=$('#contribution-tracking');if(!root)return;
  const params=new URLSearchParams(location.hash.slice(1));let id=params.get('id'),key=params.get('key');
  node('h1',t('Katkı takibi'),root);node('p',notice,root).className='contribution-notice';
  node('p',languageNotice,root).className='contribution-language';
  if(!/^[a-f0-9]{32}$/.test(id??'')||!/^[a-f0-9]{64}$/.test(key??'')){node('p',t('Gönderim sonunda verilen özel takip bağlantısını açın. Bu sayfada herkese açık bildirim listesi bulunmaz.'),root);return;}
  node('p',t('Takip no: ')+id,root);const body=node('div',undefined,root);const message=errorBox(root);
  async function load(){
    try{const r=await request('/'+id,key);body.replaceChildren();message.textContent='';node('h2',labels[r.status],body);node('p',t('Alınma: ')+new Date(r.createdAt).toLocaleString(dateLocale)+t(' · Sürüm: ')+r.revision,body);
      node('h3',categories[r.submission.category]+' · '+r.submission.view.structure,body);node('p',r.submission.description,body).className='contribution-text';if(r.submission.expected)node('p',t('Beklenti: ')+r.submission.expected,body).className='contribution-text';
      for(const url of r.submission.evidence){const a=node('a',url,body);a.href=url;a.target='_blank';a.rel='noreferrer';a.className='contribution-source';}
      const replay=node('a',t('Kaydedilen 3B görünümü aç →'),body);replay.id='replay-view';replay.href=(r.submission.view.kind==='tooth-interior'?'/tooth-interior':'/')+'#view='+id+'&key='+key;replay.className='contribution-source';
      node('h3',t('İşlem geçmişi'),body);if(!r.events.length)node('p',t('Bildirim alındı; bakımcı değerlendirmesi bekleniyor.'),body);
      const events=node('ol',undefined,body);for(const event of r.events){const li=node('li',undefined,events);node('b',(event.actor==='maintainer'?t('Bakımcı'):t('Katkı sahibi'))+' · '+labels[event.status]+' · '+new Date(event.at).toLocaleString(dateLocale),li);node('p',event.note,li).className='contribution-text';for(const url of event.evidence){const a=node('a',url,li);a.href=url;a.target='_blank';a.rel='noreferrer';}}
      if(r.redactedAt){node('p',t('İçerik kaldırıldığı için yeni açıklama eklenemez.'),body);return;}
      const form=node('form',undefined,body);const note=field(form,t('Ek açıklama / silme talebi'),'note',{type:'textarea',required:true});const refs=field(form,t('Ek kaynak bağlantıları'),'evidence',{type:'textarea',max:8000,rows:2});const send=node('button',t('Açıklamayı ekle'),form);send.type='submit';form.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{await request('/'+id+'/events',key,{revision:r.revision,note:note.value,evidence:links(refs.value)});await load();}catch(e){message.textContent=t(e.message);}finally{send.disabled=false;}};
      const refresh=node('button',t('Durumu yenile'),body);refresh.type='button';refresh.onclick=load;
    }catch(e){message.textContent=t(e.message);}
  }await load();
}
trackingPage();
