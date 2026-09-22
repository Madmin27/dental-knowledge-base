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
