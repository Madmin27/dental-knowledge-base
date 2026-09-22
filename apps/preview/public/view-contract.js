// Shared, strict snapshot contract. Surface coordinates are deliberately not invented.
export function validateView(v, catalog) {
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
