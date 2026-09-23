// Shared, strict snapshot contract. Surface coordinates are deliberately not invented.
export function validateView(v, catalog) {
  if(v?.kind==='technical'){
    if(v.version!==1||!['anatomy','interior','report'].includes(v.page))throw Error('Invalid technical report context');
    return {kind:'technical',version:1,page:v.page,structure:'viewer'};
  }
  if(v?.kind==='tooth-interior')return validateInteriorView(v,catalog);
  const fail=()=>{throw Error('Görünüm veya model sürümü geçersiz. Güncel atlası yeniden açın.');};
  if(!v||v.version!==1||v.assets?.dentition!==catalog.assets.dentition||v.assets?.neurovascular!==catalog.assets.neurovascular) fail();
  const s=v.state;
  if(!s||!catalog.teeth.includes(s.selected)||!['both','upper','lower'].includes(s.jaw)||!['mouth','tooth'].includes(s.mode)) fail();
  for(const k of ['bones','nerves','arteries'])if(typeof s[k]!=='boolean')fail();
  for(const [k,min,max] of [['opening',0,30],['gingivaOpacity',0,1],['boneOpacity',.15,1]])if(!Number.isFinite(s[k])||s[k]<min||s[k]>max)fail();
  if((s.nerves||s.arteries)&&s.opening!==0)fail();
  if(s.mode==='mouth'&&(s.gingivaOpacity<1||s.nerves||s.arteries)&&!s.bones)fail();
  if(!catalog.structures.some(x=>x.name===v.structure))fail();
  for(const p of [v.camera,v.target])if(!Array.isArray(p)||p.length!==3||p.some(n=>!Number.isFinite(n)||Math.abs(n)>10000))fail();
  const distance=Math.hypot(...v.camera.map((n,i)=>n-v.target[i]));if(distance<.1||distance>10000)fail();
  return {version:1,assets:{...catalog.assets},structure:v.structure,state:{selected:s.selected,jaw:s.jaw,mode:s.mode,bones:s.bones,nerves:s.nerves,arteries:s.arteries,opening:s.opening,gingivaOpacity:s.gingivaOpacity,boneOpacity:s.boneOpacity},camera:[...v.camera],target:[...v.target]};
}

export function validateInteriorView(v,catalog){
  const fail=()=>{throw Error('Araştırma görünümü veya model sürümü geçersiz. Güncel örneği yeniden açın.');};
  const source=catalog.research;if(!source||v?.kind!=='tooth-interior'||v.version!==1||v.source!==source.id||!['tooth','pulp','pdl'].includes(v.structure))fail();
  for(const id of ['tooth','pulp','pdl'])if(v.assets?.[id]!==source.assets[id])fail();
  const s=v.state;if(!s||!['surface','relation','pulp','section','custom'].includes(s.step)||!['x','y','z'].includes(s.axis))fail();
  for(const id of ['cut','flipped','tooth','pulp','pdl'])if(typeof s[id]!=='boolean')fail();
  if(!Number.isFinite(s.position)||s.position<0||s.position>100||!Number.isFinite(s.opacity)||s.opacity<0||s.opacity>1)fail();
  for(const p of [v.camera,v.target,v.up])if(!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isFinite(x)||Math.abs(x)>10000))fail();
  const distance=Math.hypot(...v.camera.map((n,i)=>n-v.target[i]));if(distance<.1||distance>10000||Math.abs(Math.hypot(...v.up)-1)>.001)fail();
  return {kind:'tooth-interior',version:1,source:source.id,assets:{...source.assets},structure:v.structure,state:{step:s.step,cut:s.cut,axis:s.axis,position:s.position,flipped:s.flipped,tooth:s.tooth,pulp:s.pulp,pdl:s.pdl,opacity:s.opacity},camera:[...v.camera],target:[...v.target],up:[...v.up]};
}
