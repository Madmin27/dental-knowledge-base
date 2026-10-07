// Product feedback only. Never capture DOM contents, account data, query strings or fragments.
const tr=(new URL(location.href).searchParams.get('lang')??document.cookie.match(/(?:^|;\s*)dental-language=(en|tr)/)?.[1]??document.documentElement.lang)==='tr';
const t=(en,turkish)=>tr?turkish:en;
const page=({'/':'anatomy','/anatomy':'anatomy','/tooth-interior':'interior','/overview':'overview','/contributions':'contributions','/report':'report','/review/':'review','/review/admin':'admin','/review/contributions':'desk'})[location.pathname]??'other';
const pageNames={anatomy:t('3D atlas','3B atlas'),interior:t('Tooth interior','Dişin içi'),overview:t('Project overview','Proje tanıtımı'),contributions:t('Contribution tracking','Katkı takibi'),report:t('Report','Bildirim'),review:t('Member workspace','Üye çalışma alanı'),admin:t('Administration','Yönetim'),desk:t('Editorial desk','İnceleme masası'),other:t('Information page','Bilgi sayfası')};
function node(tag,text,parent){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent?.append(e);return e;}
const hex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),v=>v.toString(16).padStart(2,'0')).join('');
const dialog=node('dialog',undefined,document.body);dialog.id='platform-feedback-dialog';dialog.setAttribute('aria-labelledby','platform-feedback-title');
const close=node('button',t('Close ×','Kapat ×'),dialog);close.type='button';close.className='pf-close';close.onclick=()=>dialog.close();
node('h2',t('Help improve the platform','Platformu birlikte iyileştirelim'),dialog).id='platform-feedback-title';
node('p',t('Report a software problem or suggest a better experience. No dental expertise is needed. For anatomy, models or scientific sources, use Contribute.','Bir yazılım sorunu bildirin veya kullanımı iyileştirecek bir fikir paylaşın. Diş hekimliği uzmanlığı gerekmez. Anatomi, model ve bilimsel kaynaklar için Katkıda bulun bölümünü kullanın.'),dialog);
node('p',t('Private: reviewed by authorized platform editors. Not a live AI chat; nothing is automatically sent to GitHub or external AI services. Do not include passwords, patient details or private records.','Özel: yetkili platform editörleri inceler. Canlı AI sohbeti değildir; GitHub’a veya harici AI servislerine otomatik gönderilmez. Parola, hasta bilgisi veya özel kayıt eklemeyin.'),dialog);
const context=node('p','',dialog);
const form=node('form',undefined,dialog);
function field(label,tag){const l=node('label',label,form);return node(tag,undefined,l);}
const topic=field(t('Feedback type','Geri bildirim türü'),'select');
for(const [value,label] of [['bug',t('Something is broken','Bir şey çalışmıyor')],['usability',t('Difficult or confusing','Kullanımı zor veya anlaşılmıyor')],['idea',t('Improvement idea','İyileştirme önerisi')]])node('option',label,topic).value=value;
const description=field(t('What happened, or what would help?','Ne oldu veya neyi iyileştirebiliriz?'),'textarea');description.required=true;description.minLength=15;description.maxLength=4000;description.rows=4;
const expected=field(t('Expected behavior (optional)','Beklediğiniz davranış (isteğe bağlı)'),'textarea');expected.maxLength=2000;expected.rows=2;
node('p',t('You may write platform feedback in English or Turkish. Only the area shown above and your text are saved.','Platform geri bildirimini Türkçe veya İngilizce yazabilirsiniz. Yalnızca yukarıda görünen alan ve yazdığınız metin kaydedilir.'),form);
const label=node('label',undefined,form);const consent=node('input',undefined,label);consent.type='checkbox';consent.required=true;label.append(document.createTextNode(t(' I agree to private storage and review of this feedback.',' Bu geri bildirimin özel olarak saklanmasına ve incelenmesine izin veriyorum.')));
const submit=node('button',t('Send feedback','Geri bildirim gönder'),form);submit.type='submit';
const status=node('p','',dialog);status.setAttribute('role','status');
const receipt=node('div',undefined,dialog);
let section='page',pending,sending=false,done=false;
const sectionNames={page:t('Page','Sayfa'),navigation:t('Navigation','Gezinme'),section:t('Page section','Sayfa bölümü')};
function show(area){if(!pending&&!description.value&&!done)section=area;context.textContent=t('Area: ','Alan: ')+pageNames[page]+' / '+sectionNames[section];dialog.showModal();}
function trigger(parent,area,floating=false){const b=node('button','✎',parent);b.type='button';b.className=floating?'pf-launcher':'pf-inline';b.setAttribute('aria-label',t('Give platform feedback','Platform hakkında geri bildirim ver'));b.title=t('Feedback — help improve this area','Geri bildirim — bu alanı iyileştirelim');if(floating)node('span',t('Feedback','Geri bildirim'),b);b.onclick=()=>show(area);}
trigger(document.body,'page',true);
const nav=document.querySelector('header nav');if(nav)trigger(nav,'navigation');
for(const h of Array.from(document.querySelectorAll('main h2, main h3')).filter(e=>!e.closest('dialog')).slice(0,2))trigger(h,'section');
form.onsubmit=async e=>{
 e.preventDefault();if(sending||done)return;
 if(!pending)pending={key:hex(32),body:{id:hex(16),category:'feedback',role:'other',alias:'',description:description.value,expected:expected.value,evidence:[],consent:consent.checked,view:{kind:'platform-feedback',version:1,page,section,topic:topic.value}}};
 sending=true;for(const el of form.elements)el.disabled=true;status.textContent=t('Sending…','Gönderiliyor…');
 try{
  const response=await fetch('/api/contributions',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+pending.key,'Content-Type':'application/json','X-DKB-Request':'1'},body:JSON.stringify(pending.body),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Object.assign(Error('send_failed'),{status:response.status});
  const result=await response.json();if(result.id!==pending.body.id)throw Error('receipt_mismatch');
  done=true;form.hidden=true;status.textContent=t('Saved. Keep your private link to read replies and add details.','Kaydedildi. Yanıtları okumak ve açıklama eklemek için özel bağlantınızı saklayın.');
  const url=location.origin+'/contributions#id='+pending.body.id+'&key='+pending.key;
  const link=node('a',t('Track feedback and replies','Geri bildirimi ve yanıtları takip et'),receipt);link.href=url;
  const input=node('input',undefined,receipt);input.value=url;input.readOnly=true;input.setAttribute('aria-label',t('Private tracking link','Özel takip bağlantısı'));input.onclick=()=>input.select();
  node('p',t('Anyone with this link can read and reply. Do not share it publicly. It is not linked to your member account.','Bağlantıya sahip kişi okuyabilir ve yanıt yazabilir. Herkese açık paylaşmayın. Bu kayıt üye hesabınıza bağlı değildir.'),receipt);
  const download=node('button',t('Save tracking link','Takip bağlantısını kaydet'),receipt);download.type='button';download.onclick=()=>{const blob=URL.createObjectURL(new Blob([url+'\n'],{type:'text/plain'}));const a=node('a');a.href=blob;a.download='dental-feedback.txt';a.click();setTimeout(()=>URL.revokeObjectURL(blob),1000);};
  const another=node('button',t('Saved your link? Send another','Bağlantıyı kaydettiniz mi? Yeni bildirim'),receipt);another.type='button';another.onclick=()=>{form.reset();for(const el of form.elements)el.disabled=false;submit.textContent=t('Send feedback','Geri bildirim gönder');form.hidden=false;receipt.replaceChildren();status.textContent='';done=false;description.focus();};
  pending=undefined;
 }catch(error){
  if([400,413,415,422].includes(error.status)){pending=undefined;for(const el of form.elements)el.disabled=false;status.textContent=t('Please check the text (at least 15 nonblank characters) and consent, then submit again.','Metni (en az 15 boşluk olmayan karakter) ve onayı kontrol edip yeniden gönderin.');return;}

  status.textContent=t('Delivery could not be confirmed. Your text is retained in this tab. Retry sends the same record, without creating a duplicate.','Gönderim doğrulanamadı. Metniniz bu sekmede korundu. Yeniden denemek aynı kaydı gönderir, kopya oluşturmaz.');submit.disabled=false;submit.textContent=t('Retry same feedback','Aynı bildirimi yeniden dene');
 }finally{sending=false;}
};
window.addEventListener('beforeunload',e=>{if(!done&&(pending||description.value||expected.value)){e.preventDefault();e.returnValue='';}});
