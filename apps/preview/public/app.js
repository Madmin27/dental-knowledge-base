import {t} from './i18n.js';
const select=document.querySelector('#scenario'),button=document.querySelector('#check');
const description=document.querySelector('#description'),result=document.querySelector('#result');
const title=document.querySelector('#result-title'),message=document.querySelector('#result-message'),license=document.querySelector('#result-license');
let scenarios=[];
function reset(){result.className='result';title.textContent=t('Kontrol edilmeye hazır');message.textContent=t('Seçtiğiniz örnek, çalışan hak motoruyla değerlendirilecek.');license.textContent=t('Sentetik örnek');}
select.addEventListener('change',()=>{description.textContent=t(scenarios.find(s=>s.id===select.value)?.description??'');reset();});
button.addEventListener('click',async()=>{
  button.disabled=true;select.disabled=true;title.textContent=t('Kontrol ediliyor…');
  try {
    const response=await fetch(`./api/check?scenario=${encodeURIComponent(select.value)}`);
    if(!response.ok) throw new Error('HTTP error');
    const data=await response.json();result.className=`result ${data.allowed?'passed':'blocked'}`;
    title.textContent=data.allowed?t('Örnek hak kontrolü geçti'):t('Yayın engellendi');message.textContent=t(data.message);license.textContent=data.license;
  } catch {result.className='result blocked';title.textContent=t('Bağlantı kurulamadı');message.textContent=t('Sunucuya ulaşılamadı. Tekrar deneyin.');license.textContent=t('Sonuç üretilemedi');}
  finally {button.disabled=false;select.disabled=false;}
});
(async()=>{
  try {
    const response=await fetch('./api/scenarios');if(!response.ok) throw new Error('HTTP error');
    scenarios=(await response.json()).scenarios;select.replaceChildren(...scenarios.map(s=>new Option(t(s.title),s.id)));
    description.textContent=t(scenarios[0].description);select.disabled=false;button.disabled=false;
  } catch {description.textContent=t('Önizleme servisine ulaşılamadı. Sayfayı yenileyin.');}
})();
