// Deadline includes response bodies, not just receipt of HTTP headers.
export async function fetchModel(url, type='arrayBuffer', {timeoutMs=45000, fetcher=globalThis.fetch, onProgress}={}) {
  const controller=new AbortController();let timer,totalTimer,reset;
  const deadline=new Promise((_,reject)=>{const fail=()=>{
    const error=new Error(`Model download timed out: ${url}`);error.code='MODEL_DOWNLOAD_TIMEOUT';
    reject(error);controller.abort();
  };reset=()=>{clearTimeout(timer);if(!controller.signal.aborted)timer=setTimeout(fail,timeoutMs);};reset();totalTimer=setTimeout(fail,300000);});
  try {
    return await Promise.race([deadline,(async()=>{
      const response=await fetcher(url,{signal:controller.signal});
      if(!response.ok)throw Error(`Model download HTTP ${response.status}: ${url}`);
      reset();
      if(response.body?.getReader){
        const reader=response.body.getReader(),chunks=[];let size=0;
        while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.byteLength;reset();onProgress?.(url,size);}
        const bytes=new Uint8Array(size);let offset=0;
        for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
        return type==='json'?JSON.parse(new TextDecoder().decode(bytes)):bytes.buffer;
      }
      return await response[type]();
    })()]);
  } finally {clearTimeout(timer);clearTimeout(totalTimer);}
}

export async function loadingStage(message){
  const loading=document.querySelector('#loading');
  if(loading){loading.textContent=message;loading.dataset.lastProgress=String(Date.now());}
  // Give the browser a chance to paint before CPU/GPU initialization.
  await new Promise(resolve=>setTimeout(resolve,0));
}
export function modelProgress(label){
  const bytes=new Map();
  return (url,size)=>{
    bytes.set(url,size);const loading=document.querySelector('#loading');
    if(loading){loading.textContent=`${label} ${(Array.from(bytes.values()).reduce((a,b)=>a+b,0)/1048576).toFixed(1)} MB`;loading.dataset.lastProgress=String(Date.now());}
  };
}

// Context negotiation is independent of source geometry and academic state.
export function createCompatibleRenderer(Renderer, {stencil=false, compatible=false, createCanvas=()=>document.createElement('canvas')}={}) {
  const failures=[];
  const profiles=compatible ? [false] : [true,false];
  for(const antialias of profiles){
    const canvas=createCanvas();
    let status='';
    const onError=event=>{status=event.statusMessage||'';};
    canvas.addEventListener('webglcontextcreationerror',onError);
    try{
      // Let the browser select an available GPU; never require a discrete GPU.
      const renderer=new Renderer({canvas,alpha:true,stencil,antialias,powerPreference:'default'});
      canvas.removeEventListener('webglcontextcreationerror',onError);
      return {renderer,compatible:compatible||!antialias};
    }catch(error){
      canvas.removeEventListener('webglcontextcreationerror',onError);
      failures.push((status||error.message||String(error)).slice(0,600));
    }
  }
  const error=new Error(failures.join('\n'));
  error.code='GRAPHICS_CONTEXT_FAILED';
  throw error;
}

export function viewerFailure(error,phase){
  if(error?.code==='GRAPHICS_CONTEXT_FAILED')return {
    code:error.code,
    message:'Chromium/tarayıcı bu oturumda WebGL 2 görüntüsünü başlatamadı. Grafik hızlandırması ve uzak masaüstü oturumunun grafik desteği kontrol edilmeli.',
    details:error.message,
    graphics:true,
  };
  const messages={
    files:'Model dosyaları yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.',
    graphics:'3B görüntü ayarları başlatılamadı. Uyumlu grafik modunu deneyebilirsiniz.',
    geometry:'Model verisi işlenemedi. Hata ayrıntısını paylaşarak bildirebilirsiniz.',
    interface:'Model ekranı başlatılırken bir uygulama hatası oluştu. Hata ayrıntısını paylaşabilirsiniz.',
  };
  return {code:`MODEL_${String(phase).toUpperCase()}_FAILED`,message:messages[phase]||'Model başlatılamadı.',details:String(error?.message||error).slice(0,1200),graphics:phase==='graphics'};
}
