// Keep this independent of all module dependencies: even a missing module must
// leave a recovery action instead of an indefinite loading label.
(()=>{
  const tr=document.documentElement.lang==='tr';
  const entry=document.currentScript?.dataset.viewer;
  if(!['anatomy','interior'].includes(entry))return;
  const started=Date.now();
  function failure(code){
    const loading=document.querySelector('#loading');
    if(!loading||loading.hidden||loading.dataset.state==='error')return;
    loading.dataset.state='error';loading.dataset.errorCode=code;loading.setAttribute('role','alert');
    const message=document.createElement('p');message.textContent=tr?'Model yüklemesi tamamlanamadı. Bağlantıyı kontrol edip yeniden deneyin veya uyumlu grafik modunu açın.':'Model loading did not complete. Check your connection and retry, or try compatible graphics mode.';
    const retry=document.createElement('button');retry.id='retry-model';retry.textContent=tr?'Yeniden yükle':'Reload';retry.onclick=()=>location.reload();
    const compatible=document.createElement('a');const url=new URL(location.href);url.searchParams.set('graphics','compat');compatible.href=url.href;compatible.className='error-compatible';compatible.textContent=tr?'Uyumlu grafik modunda dene':'Try compatible graphics';
    const report=document.createElement('a');report.href='/report';report.textContent=tr?'Teknik sorun bildir':'Report a technical issue';
    loading.replaceChildren(message,retry,compatible,document.createTextNode(' · '),report);
  }
  const watch=setInterval(()=>{
    const loading=document.querySelector('#loading');
    if(!loading||loading.hidden||loading.dataset.state==='error'){clearInterval(watch);return;}
    if(Date.now()-Math.max(started,Number(loading.dataset.lastProgress)||0)>90000){clearInterval(watch);failure('MODEL_STARTUP_TIMEOUT');}
  },1000);
  import(`./${entry}.js`).catch(()=>{clearInterval(watch);failure('MODEL_MODULE_FAILED');});
})();
