import {installContributions} from './contributions.js';
import {validateInteriorView} from './view-contract.js';
import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
const $=s=>document.querySelector(s),host=$('#interior-canvas');
const state={step:'relation',cut:false,axis:'y',position:50,flipped:false,tooth:true,pulp:true,pdl:false,opacity:.22};
const colors={tooth:0xe7dcc0,pulp:0xb6506c,pdl:0x4a9487};
const descriptions={tooth:['Dişin dış yüzeyi','Kron ve köklerin birleşik dış yüzeyi. Mine ve dentin ayrı ayrı bölümlenmiş değildir.'],pulp:['Pulpa boşluğu','Bu yüzey pulpanın kapladığı boşluğun araştırma modelidir; doku, damar ve sinir ağını içermez.'],pdl:['Şematik destek katmanı','Kaynak araştırmada oluşturulmuş katman. Ölçülmüş periodontal lifleri veya gerçek doku kalınlığını göstermez.']};
let selectedStructure='pulp';
let renderer,scene,camera,controls,bounds,dirty=true,frames=0;const objects=new Map();const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);const mark=()=>{dirty=true;};
function sync(){
  $('#cut').checked=state.cut;$('#cut-position').value=state.position;$('#cut-value').value='%'+state.position;
  for(const id of ['tooth','pulp','pdl'])$('#'+id+'-visible').checked=state[id];
  $('#tooth-opacity').value=Math.round(state.opacity*100);$('#tooth-value').value='%'+Math.round(state.opacity*100);
  $('#tooth-opacity').disabled=!state.tooth;
  document.querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.step===state.step)));
  document.querySelectorAll('[data-axis]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.axis===state.axis)));
  $('#cut-controls').querySelectorAll('button,input').forEach(e=>e.disabled=!state.cut);
  $('#cut-legend').hidden=!state.cut;
}
function update(){
  const normal=new THREE.Vector3();normal[state.axis]=state.flipped?-1:1;
  const coordinate=THREE.MathUtils.lerp(bounds.min[state.axis],bounds.max[state.axis],state.position/100);
  plane.normal.copy(normal);plane.constant=-coordinate*normal[state.axis];
  for(const [id,o] of objects){
    const opacity=id==='tooth'?state.opacity:id==='pdl'?.28:1;
    o.mesh.visible=state[id]&&opacity>0;const material=o.mesh.material;
    if(material.transparent!==(opacity<1)){material.transparent=opacity<1;material.needsUpdate=true;}
    material.opacity=opacity;material.depthWrite=opacity===1;material.clippingPlanes=state.cut?[plane]:[];
    o.stencil.visible=state.cut&&o.mesh.visible&&o.closed;
    o.cap.visible=o.stencil.visible;o.cap.material.opacity=opacity;
    for(const m of [o.cap.material,...o.stencil.children.map(child=>child.material)])if(m.transparent!==(opacity<1)){m.transparent=opacity<1;m.needsUpdate=true;}
    o.cap.material.depthWrite=opacity===1;
    plane.coplanarPoint(o.cap.position);o.cap.lookAt(o.cap.position.clone().sub(plane.normal));
  }
  sync();mark();
}
function frame(direction=new THREE.Vector3(.75,.2,1)){
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const radius=size.length()/2;const angle=Math.min(THREE.MathUtils.degToRad(camera.fov)/2,Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*camera.aspect));
  const distance=radius/Math.sin(angle)*1.15;
  controls.target.copy(center);camera.position.copy(center).add(direction.clone().normalize().multiplyScalar(distance));camera.up.set(0,1,0);
  controls.minDistance=radius*.45;controls.maxDistance=distance*4;controls.update();controls.enableDamping=damping;mark();
}
function preset(step){state.step=step;state.tooth=step!=='pulp';state.pulp=true;state.pdl=false;state.cut=step==='section';state.opacity=['surface','section'].includes(step)?1:.22;state.axis='y';state.position=40;state.flipped=false;
  const titles={surface:['Dış biçimi tanıyın.','Kron yüzeyini ve köklerin dış biçimini döndürerek inceleyin.'],relation:['Birlikte inceleyin.','Saydam dış yüzeyin içinde boşluğun köklere uzanışını izleyin.'],pulp:['Boşluğu takip edin.','Pulpa odası ve köklere uzanan kanal biçimi. Her yan dalı veya apikal açıklığı temsil etmez.'],section:['Aynı düzlemde karşılaştırın.','Kesit konumunu değiştirin. Açık renk dolgu dış diş yüzeyinin kesitidir; ayrı mine/dentin verisi değildir.']};
  $('#step-title').textContent=titles[step][0];$('#step-description').textContent=titles[step][1];update();if(step==='section')frame(new THREE.Vector3(.25,-1,.3));
}
function createSurface(meta,buffer){
  const n=meta.vertices;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffer,0,n*3),3));geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(buffer,n*12,n*3),3));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,n*24,meta.triangles*3),1));
  // One shared rigid display transform. No anatomical registration or rescaling.
  geometry.rotateX(-Math.PI/2);geometry.computeBoundingBox();
  return geometry;
}
function addLayer(meta,geometry,index){
  const material=new THREE.MeshStandardMaterial({color:colors[meta.id],roughness:meta.id==='pulp'?.62:.32,metalness:0,envMapIntensity:.7,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=meta.id;mesh.renderOrder=index*4;scene.add(mesh);
  const stencil=new THREE.Group();scene.add(stencil);
  for(const side of [THREE.BackSide,THREE.FrontSide]){
    const op=side===THREE.BackSide?THREE.IncrementWrapStencilOp:THREE.DecrementWrapStencilOp;
    const m=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false,stencilWrite:true,stencilFunc:THREE.AlwaysStencilFunc,stencilFail:op,stencilZFail:op,stencilZPass:op,clippingPlanes:[plane],side});
    const part=new THREE.Mesh(geometry,m);part.renderOrder=index*4+1;stencil.add(part);
  }
  const capMaterial=new THREE.MeshStandardMaterial({color:colors[meta.id],roughness:.8,side:THREE.DoubleSide,stencilWrite:true,stencilRef:0,stencilFunc:THREE.NotEqualStencilFunc,stencilFail:THREE.ReplaceStencilOp,stencilZFail:THREE.ReplaceStencilOp,stencilZPass:THREE.ReplaceStencilOp,polygonOffset:true,polygonOffsetFactor:-index-1,polygonOffsetUnits:-index-1});
  const cap=new THREE.Mesh(new THREE.PlaneGeometry(100,100),capMaterial);cap.renderOrder=index*4+2;cap.onAfterRender=()=>renderer.clearStencil();scene.add(cap);
  objects.set(meta.id,{mesh,stencil,cap,closed:meta.openEdges===0&&meta.nonManifoldEdges===0});
}
async function start(){
  const response=await fetch('/research/pulp/manifest.json');if(!response.ok)throw Error('Araştırma örneği bu sunucuda etkin değil. Tam ağız atlasını kullanabilirsiniz.');const manifest=await response.json();
  const buffers=await Promise.all(manifest.models.map(async m=>{const r=await fetch('/research/pulp/'+m.file);if(!r.ok)throw Error('Kaynak yüzey okunamadı.');return r.arrayBuffer();}));
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,stencil:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.localClippingEnabled=true;renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;host.append(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,2000);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.addEventListener('change',mark);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0x879185,1.2));const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(20,30,45);scene.add(key);
  const geometries=manifest.models.map((m,i)=>createSurface(m,buffers[i]));const sourceBounds=new THREE.Box3();for(const g of geometries)sourceBounds.union(g.boundingBox);const center=sourceBounds.getCenter(new THREE.Vector3());bounds=new THREE.Box3();
  for(const [i,g] of geometries.entries()){g.translate(-center.x,-center.y,-center.z);g.computeBoundingBox();bounds.union(g.boundingBox);addLayer(manifest.models[i],g,i);}
  const resize=()=>{const r=host.getBoundingClientRect();camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height);mark();};new ResizeObserver(resize).observe(host);resize();frame();update();$('#loading').hidden=true;
  document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>preset(b.dataset.step));
  for(const id of ['tooth','pulp','pdl'])$('#'+id+'-visible').onchange=e=>{state[id]=e.target.checked;state.step='custom';update();};
  $('#tooth-opacity').oninput=e=>{state.opacity=Number(e.target.value)/100;state.step='custom';update();};
  $('#cut').onchange=e=>{state.cut=e.target.checked;state.step='custom';update();};$('#cut-position').oninput=e=>{state.position=Number(e.target.value);update();};
  document.querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>{state.axis=b.dataset.axis;update();});$('#flip').onclick=()=>{state.flipped=!state.flipped;update();};$('#center-cut').onclick=()=>{state.position=50;update();};$('#face-cut').onclick=()=>frame(plane.normal.clone().negate());
  $('#front').onclick=()=>frame(new THREE.Vector3(0,0,1));$('#side').onclick=()=>frame(new THREE.Vector3(1,0,0));$('#top').onclick=()=>frame(new THREE.Vector3(0,1,0));$('#fit').onclick=()=>frame();
  $('#zoom-in').onclick=()=>{controls.dollyIn(1/1.25);controls.update();};$('#zoom-out').onclick=()=>{controls.dollyOut(1/1.25);controls.update();};
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3B araştırma modeli. Ok tuşlarıyla döndürün, artı ve eksiyle yakınlaştırın, Home ile sığdırın.');
  renderer.domElement.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const actions={ArrowLeft:()=>controls.rotateLeft(Math.PI/24),ArrowRight:()=>controls.rotateLeft(-Math.PI/24),ArrowUp:()=>controls.rotateUp(Math.PI/24),ArrowDown:()=>controls.rotateUp(-Math.PI/24),'+':()=>controls.dollyIn(.8),'-':()=>controls.dollyOut(.8),Home:()=>frame()};if(actions[e.key]){e.preventDefault();actions[e.key]();controls.update();}});
  let down;renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=host.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hits=ray.intersectObjects([...objects.values()].map(o=>o.mesh).filter(m=>m.visible));const hit=hits.find(h=>(!state.cut||plane.distanceToPoint(h.point)>=0)&&!(h.object.name==='tooth'&&state.opacity<.5));if(hit){selectedStructure=hit.object.name;const d=descriptions[hit.object.name];$('#selection-title').textContent=d[0];$('#selection-description').textContent=d[1];}});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#loading').hidden=false;$('#loading').textContent='3B bağlantısı kesildi. Sayfayı yenileyin.';});
  const render=()=>{requestAnimationFrame(render);if(document.hidden)return;controls.update();if(dirty){renderer.render(scene,camera);dirty=false;frames++;}};render();
  const catalog={research:{id:manifest.id,assets:Object.fromEntries(manifest.models.map(m=>[m.id,m.sha256]))},structures:manifest.models.map(m=>({name:m.id,label:m.label}))};
  const captureView=()=>validateInteriorView({kind:'tooth-interior',version:1,source:manifest.id,assets:catalog.research.assets,structure:selectedStructure,state,camera:camera.position.toArray(),target:controls.target.toArray(),up:camera.up.toArray()},catalog);
  const restoreView=value=>{const v=validateInteriorView(value,catalog);if(v.state.step!=='custom')preset(v.state.step);Object.assign(state,v.state);selectedStructure=v.structure;update();controls.enableDamping=false;controls.update();camera.up.fromArray(v.up);camera.position.fromArray(v.camera);controls.target.fromArray(v.target);controls.update();controls.enableDamping=true;const d=descriptions[v.structure];$('#selection-title').textContent=d[0];$('#selection-description').textContent=d[1];mark();};
  installContributions({captureView,restoreView,catalog});
  window.__interior=Object.freeze({captureView,restoreView,snapshot:()=>({...state,frames,source:manifest.id,reviewStatus:manifest.reviewStatus,camera:camera.position.toArray(),target:controls.target.toArray(),geometries:renderer.info.memory.geometries,layers:[...objects].map(([id,o])=>({id,visible:o.mesh.visible,cap:o.cap.visible,closed:o.closed,opacity:o.mesh.material.opacity,triangles:o.mesh.geometry.index.count/3}))})});
}
$('#sources').onclick=()=>$('#source-dialog').showModal();$('#close-sources').onclick=()=>$('#source-dialog').close();
start().catch(error=>{$('#loading').textContent=error.message;document.querySelectorAll('main button,main input').forEach(e=>e.disabled=true);});
