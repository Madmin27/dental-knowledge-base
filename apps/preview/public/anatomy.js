import {t,percent} from './i18n.js';
import {showModelError} from './studio.js';
import {createCompatibleRenderer,viewerFailure,fetchModel,loadingStage,modelProgress} from './viewer-runtime.js';
import {validateView} from './view-contract.js';
import {installContributions} from './contributions.js';
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const $ = selector => document.querySelector(selector);
const host = $('#canvas');
const state = {selected:16, jaw:'both', mode:'mouth', roots:false, bones:true, opening:0, gingivaOpacity:1, boneOpacity:1, nerves:false, arteries:false};
const names = ['',t('orta kesici'),t('yan kesici'),t('köpek dişi'),t('birinci küçük azı'),t('ikinci küçük azı'),t('birinci büyük azı'),t('ikinci büyük azı')];
const objects = [], teeth = new Map();
let selectedStructure;
let loadingPhase='graphics';
const compatibleRequested=new URLSearchParams(location.search).get('graphics')==='compat';
let renderer, controls, scene, camera, dirty = true, frames = 0, savedOpening = 0;
const upper = new THREE.Group(), lower = new THREE.Group(), isolated = new THREE.Group();
const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
const mark = () => {dirty = true;};

function toothName(fdi) {
  return `${t(fdi < 30 ? 'Üst' : 'Alt')} ${t([1,4].includes(Math.floor(fdi/10)) ? 'sağ' : 'sol')} ${names[fdi%10]}`;
}
function selection(fdi) {
  if (!teeth.has(fdi)) return;
  state.selected = fdi;
  selectedStructure=teeth.get(fdi).name;
  $('#fdi').textContent = fdi;
  $('#tooth-name').textContent = toothName(fdi);
  $('#selected-label').textContent = `${fdi} · ${toothName(fdi)}`;
  document.querySelectorAll('[data-fdi]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.fdi) === fdi)));
  // A subtle tint preserves surface relief instead of painting the tooth opaque blue.
  for (const [id, mesh] of teeth) for (const m of mesh.material) {
    m.emissive.set(id === fdi && state.mode === 'mouth' ? 0x28422c : 0x000000);
    m.emissiveIntensity = .13;
  }
  mark();
}
function removeIsolated() {
  for (const child of [...isolated.children]) {
    isolated.remove(child);
    child.material.forEach(m => m.dispose());
    // Geometry belongs to the shared source assembly and must not be disposed here.
  }
}
function updateVisibility() {
  // A whole-mouth root view must retain a visible bony context. No mesh is deformed.
  if (state.mode === 'mouth' && (state.gingivaOpacity < 1 || state.nerves || state.arteries)) {
    state.bones = true;
    state.boneOpacity = Math.max(.15,state.boneOpacity);
  }
  upper.visible = state.mode === 'mouth' && state.jaw !== 'lower';
  lower.visible = state.mode === 'mouth' && state.jaw !== 'upper';
  lower.position.y = -state.opening;
  isolated.visible = state.mode === 'tooth';
  for (const mesh of objects) {
    const kind = mesh.userData.kind;
    mesh.visible = kind === 'tooth' || (kind === 'gingiva' && state.gingivaOpacity > 0) || (kind === 'bone' && state.bones && state.boneOpacity > 0) || (kind === 'nerve' && state.nerves) || (kind === 'artery' && state.arteries);
    for (let i=0;i<mesh.material.length;i++) {
      const name = mesh.userData.groups[i].material;
      if (kind === 'gingiva' || kind === 'bone') {
        const opacity = kind === 'gingiva' ? state.gingivaOpacity : state.boneOpacity;
        const material = mesh.material[i];
        const transparent = opacity < 1;
        if (material.transparent !== transparent) {material.transparent = transparent;material.needsUpdate = true;}
        material.opacity = opacity;material.depthWrite = !transparent;
        mesh.castShadow = !transparent;mesh.receiveShadow = !transparent;
        mesh.renderOrder = transparent ? (kind === 'gingiva' ? 3 : 2) : 0;
      }
      mesh.material[i].visible = kind !== 'tooth' || !name.toLowerCase().includes('root') || state.gingivaOpacity < 1 || state.bones;
    }
  }
  $('#gum-transparency').value = Math.round((1-state.gingivaOpacity)*100);
  $('#gum-transparency-value').textContent = percent($('#gum-transparency').value);
  $('#bones').checked = state.bones;
  $('#bone-transparency').value = Math.round((1-state.boneOpacity)*100);
  $('#bone-transparency-value').textContent = percent(Math.round((1-state.boneOpacity)*100));
  $('#bone-opacity-controls').hidden = !state.bones;
  $('#roots').checked = state.gingivaOpacity === 0;
  state.roots = state.gingivaOpacity === 0;
  for (const id of ['gum-transparency','roots','bones','bone-transparency','opening','nerves','arteries','tissue-preset']) $('#'+id).disabled = state.mode === 'tooth';
  $('#bones').disabled = state.mode === 'tooth' || state.gingivaOpacity < 1 || state.nerves || state.arteries;
  $('#bone-transparency').max = 85;
  $('#study-context').textContent = state.mode === 'tooth' ? t('İzole diş: çevre dokular gösterilmiyor. Kökün dış yüzeyi incelenir.') : state.gingivaOpacity < 1 || state.boneOpacity < 1 ? t('Katman incelemesi: saydam dokuların arkasındaki kökler görünür. Pembe yüzey tüm çeneyi sarmaz; kök–kemik ilişkisini kemik katmanıyla izleyin.') : !state.bones ? t('Yalnız diş ve diş eti alt kümesi. Çene kemiği gizli; bu görünüm tam ağız anatomisi değildir.') : t('Kaynak birleşimi: dişler, diş eti ve çene kemiği birlikte. Modelin üst ve arka sınırları tam baş anatomisini içermez.');
  $('#opening').disabled = state.mode === 'tooth' || state.nerves || state.arteries;
  $('#opening-help').textContent = state.nerves || state.arteries ? t('Sinir/damar görünümünde kaynak çene konumu korunur.') : t('İnceleme için ayırma; çene hareketi simülasyonu değildir.');
  $('#tissue-legend').hidden = !(state.nerves || state.arteries) || state.mode === 'tooth';
  $('#layer-status').textContent = [state.nerves ? t('Sarı: kaynak sinir yüzeyleri') : '', state.arteries ? t('Kırmızı: kaynak atardamar yüzeyleri') : ''].filter(Boolean).join(' · ');
  $('#gum-help').textContent = state.mode === 'tooth' ? t('Diş eti ayarı için tüm ağza dönün.') : t('%0 opak · %100 gizli. Kökleri incelerken kemik katmanı korunur; saydamlığı ayrıca ayarlanabilir.');
  $('#mode-label').textContent = state.mode === 'tooth' ? `FDI ${state.selected} / ${t('TEK DİŞ')}` : t('TAM AĞIZ');
  $('#view-title').textContent = state.mode === 'tooth' ? toothName(state.selected) : state.jaw === 'upper' ? t('Üst diş dizilimi') : state.jaw === 'lower' ? t('Alt diş dizilimi') : t('Kalıcı diş dizilimi');
  $('#model-status').textContent = state.mode === 'tooth' ? t('Kaynak kron ve kök yüzeyleri · iç doku yok') : `${state.jaw === 'both' ? 28 : 14} ${t('diş · kaynak modeli')}`;
  document.querySelectorAll('[data-jaw]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.jaw === state.jaw)));
  document.querySelectorAll('[data-fdi]').forEach(b => b.disabled = state.jaw === 'upper' ? Number(b.dataset.fdi) > 30 : state.jaw === 'lower' ? Number(b.dataset.fdi) < 30 : false);
  mark();
}
function frame(view='perspective') {
  const focus = state.mode === 'tooth';
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const mesh of focus ? isolated.children : objects.filter(m => m.visible && m.parent.visible)) {
    box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  }
  if (box.isEmpty()) return;
  const target = box.getCenter(new THREE.Vector3());
  const direction = (view === 'front' ? new THREE.Vector3(0,.08,1) : view === 'side' ? new THREE.Vector3(1,.18,.15) : view === 'occlusal' ? new THREE.Vector3(0,state.jaw === 'upper' ? -1 : 1,.04) : new THREE.Vector3(.50,.22,1)).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction,right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  let distance = 0;
  for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
    const delta = new THREE.Vector3(x,y,z).sub(target);
    distance = Math.max(distance, Math.abs(delta.dot(right))/(tanV*camera.aspect)*1.2+delta.dot(direction), Math.abs(delta.dot(up))/tanV*1.3+delta.dot(direction));
  }
  controls.target.copy(target);
  camera.position.copy(target).addScaledVector(direction,distance);
  camera.up.set(0,1,0);
  controls.minDistance = focus ? 10 : 40;
  controls.maxDistance = Math.max(distance*3,focus ? 130 : 380);
  controls.update();mark();
}
function focusTooth() {
  removeIsolated();
  state.mode = 'tooth';
  const source = teeth.get(state.selected);
  const clone = source.clone();
  clone.material = source.material.map(m => {const a=m.clone();a.visible=true;a.emissive.set(0);return a;});
  const center = source.geometry.boundingBox.getCenter(new THREE.Vector3());
  clone.position.copy(center).negate();
  isolated.rotation.set(0,0,0);
  isolated.add(clone);
  // Preserve anatomical orientation: upper roots point up, lower roots point down.
  updateVisibility();selection(state.selected);frame();
}
function home() {removeIsolated();state.mode='mouth';updateVisibility();selection(state.selected);frame();}

function materialFor(name,kind) {
  if (kind === 'gingiva') return new THREE.MeshPhysicalMaterial({color:0xad5460,roughness:.5,metalness:0,clearcoat:.1,clearcoatRoughness:.45,side:THREE.DoubleSide});
  if (kind === 'nerve' || kind === 'artery') return new THREE.MeshStandardMaterial({color:kind==='nerve'?0xe5ae30:0xb51c32,roughness:.48,side:THREE.DoubleSide});
  if (kind === 'bone') return new THREE.MeshStandardMaterial({color:0xcbbd9b,roughness:.72,side:THREE.DoubleSide});
  const root = name.toLowerCase().includes('root');
  return new THREE.MeshPhysicalMaterial({color:root?0xc9b68a:0xf1e8d0,roughness:root?.53:.28,metalness:0,ior:1.5,clearcoat:root?0:.22,clearcoatRoughness:.25,side:THREE.DoubleSide});
}

async function start() {
  await loadingStage(t('Grafik motoru hazırlanıyor…'));
  const graphics=createCompatibleRenderer(THREE.WebGLRenderer,{compatible:compatibleRequested});
  renderer=graphics.renderer;
  if(graphics.compatible){const note=document.createElement('p');note.className='graphics-notice';note.textContent=t('Uyumlu grafik modu · model ayrıntısı korunur');$('.stage-heading').append(note);}
  renderer.setPixelRatio(Math.min(devicePixelRatio,graphics.compatible?1:1.6));
  renderer.setClearColor(0x000000,0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !graphics.compatible;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.append(renderer.domElement);
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label',t('3B ağız modeli. Ok tuşlarıyla döndürün, artı ve eksiyle yakınlaştırın, Home ile sığdırın.'));
  renderer.domElement.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const actions={ArrowLeft:()=>controls.rotateLeft(Math.PI/24),ArrowRight:()=>controls.rotateLeft(-Math.PI/24),ArrowUp:()=>controls.rotateUp(Math.PI/24),ArrowDown:()=>controls.rotateUp(-Math.PI/24),'+':()=>controls.dollyIn(.8),'-':()=>controls.dollyOut(.8),Home:()=>frame()};
    if(actions[e.key]){e.preventDefault();actions[e.key]();controls.update();mark();}
  });
  scene = new THREE.Scene();scene.add(upper,lower,isolated);
  camera = new THREE.PerspectiveCamera(36,1,.2,900);
  controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping = true;controls.dampingFactor=.09;controls.addEventListener('change',mark);
  if(!graphics.compatible){
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(environment,.04);
  scene.environment = env.texture;scene.environmentIntensity=.45;
  environment.dispose();pmrem.dispose();
  }
  const ambient = new THREE.HemisphereLight(0xffffff,0x657b6a,.7);scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff5e7,1.8);key.position.set(-65,80,95);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-75,right:75,top:80,bottom:-80,near:1,far:300});key.shadow.bias=-.0004;key.shadow.normalBias=.08;scene.add(key);
  const fill = new THREE.DirectionalLight(0xe9f4ff,.7);fill.position.set(65,20,15);scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff,1.3);rim.position.set(-10,40,-70);scene.add(rim);
  loadingPhase='files';
  await loadingStage(t('Model dosyaları indiriliyor…'));
  const onProgress=modelProgress(t('İndirilen model verisi:'));
  const [manifest,binary,extra,extraBinary] = await Promise.all([
    fetchModel('/models/z-anatomy/dentition.json','json',{onProgress}),
    fetchModel('/models/z-anatomy/dentition.bin','arrayBuffer',{onProgress}),
    fetchModel('/models/z-anatomy/neurovascular.json','json',{onProgress}),
    fetchModel('/models/z-anatomy/neurovascular.bin','arrayBuffer',{onProgress}),
  ]);
  loadingPhase='geometry';
  await loadingStage(t('Anatomik yüzeyler hazırlanıyor…'));
  for (const s of [...manifest.structures,...extra.structures]) {
    const data = s.kind === 'nerve' || s.kind === 'artery' ? extraBinary : binary;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(data,s.positions.offset,s.positions.count),3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(data,s.normals.offset,s.normals.count),3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(data,s.indices.offset,s.indices.count),1));
    s.groups.forEach((g,i) => geometry.addGroup(g.start,g.count,i));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry,s.groups.map(g=>materialFor(g.material,s.kind)));
    mesh.name=s.name;mesh.userData=s;mesh.castShadow=true;mesh.receiveShadow=true;
    if (s.kind==='nerve'||s.kind==='artery') {const li=document.createElement('li');li.textContent=t(s.label);$('#structure-list').append(li);}
    (s.jaw === 'upper' ? upper : lower).add(mesh);objects.push(mesh);
    if (s.fdi) teeth.set(s.fdi,mesh);
  }
  loadingPhase='interface';
  await loadingStage(t('İlk görüntü hazırlanıyor…'));
  const order = [17,16,15,14,13,12,11,21,22,23,24,25,26,27,47,46,45,44,43,42,41,31,32,33,34,35,36,37];
  for (const id of order) {
    const b = document.createElement('button');b.dataset.fdi=id;b.textContent=id;b.title=toothName(id);b.setAttribute('aria-label',`${id} ${toothName(id)}`);
    b.addEventListener('click',()=>{selection(id);if(state.mode==='tooth')focusTooth();});$('#tooth-chart').append(b);
  }
  const search=$('#tooth-search'), results=$('#search-results');
  const normalize=s=>s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
  search.addEventListener('input',()=>{
    const query=normalize(search.value.trim());results.replaceChildren();results.hidden=!query;
    if(!query)return;
    const matches=order.filter(id=>normalize(`${id} ${toothName(id)}`).includes(query));
    for(const id of matches){
      const button=document.createElement('button');button.type='button';button.textContent=`${id} · ${toothName(id)}`;
      button.addEventListener('click',()=>{
        if((state.jaw==='upper'&&id>30)||(state.jaw==='lower'&&id<30)){state.jaw='both';home();}
        selection(id);if(state.mode==='tooth')focusTooth();
        search.value='';results.replaceChildren();results.hidden=true;
        document.querySelector(`[data-fdi="${id}"]`).focus({preventScroll:true});
      });results.append(button);
    }
    if(!matches.length){const note=document.createElement('p');note.textContent=t('Bu koleksiyonda eşleşen diş yok. 18, 28, 38 ve 48 kaynakta bulunmuyor.');results.append(note);}
  });
  const resize = () => {const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);const changed=Math.abs(camera.aspect-width/height)>.15;camera.aspect=width/height;camera.updateProjectionMatrix();if(changed&&teeth.size)frame();mark();};
  new ResizeObserver(resize).observe(host);resize();
  updateVisibility();selection(16);frame();$('#loading').hidden=true;
  let down;
  renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointerup',e=>{
    if (!down || Math.hypot(e.clientX-down.x,e.clientY-down.y)>5 || state.mode!=='mouth') return;
    const rect=host.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const candidates=objects.filter(o=>o.visible&&o.parent.visible && !(o.userData.kind==='gingiva'&&state.gingivaOpacity<1) && !(o.userData.kind==='bone'&&state.boneOpacity<1));
    const hit=raycaster.intersectObjects(candidates,false).find(h=>h.object.material[h.face.materialIndex]?.visible);
    if(hit?.object.userData.fdi)selection(hit.object.userData.fdi);
    else if(hit?.object.name){selectedStructure=hit.object.name;$('#selected-label').textContent=t(hit.object.userData.label??hit.object.name)+t(' · kaynak yüzeyi');}
  });
  renderer.domElement.addEventListener('dblclick',focusTooth);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showModelError(t('3B görüntü bağlantısı kesildi. Yeniden yükleyin veya uyumlu grafik modunu deneyin.'),{code:'GRAPHICS_CONTEXT_LOST',graphics:true});});
  document.querySelectorAll('[data-jaw]').forEach(b=>b.onclick=()=>{
    state.jaw=b.dataset.jaw;
    if(state.jaw==='upper'&&state.selected>30)state.selected=state.selected<40?state.selected-10:state.selected-30;
    if(state.jaw==='lower'&&state.selected<30)state.selected=state.selected<20?state.selected+30:state.selected+10;
    home();
  });
  $('#roots').onchange=e=>{state.gingivaOpacity=e.target.checked?0:1;if(state.gingivaOpacity<1){state.bones=true;state.boneOpacity=.45;}updateVisibility();frame();};
  $('#gum-transparency').oninput=e=>{state.gingivaOpacity=1-Number(e.target.value)/100;const needsFrame=!state.bones;state.bones=true;state.boneOpacity=1-Math.round(Number(e.target.value)*.7/5)*.05;updateVisibility();if(needsFrame)frame();};
  $('#bone-transparency').oninput=e=>{state.boneOpacity=Math.max(.15,1-Number(e.target.value)/100);updateVisibility();};
  function tissueLayers() {
    const hadLayer = state.nerves || state.arteries;
    state.nerves = $('#nerves').checked;state.arteries = $('#arteries').checked;
    if ((state.nerves || state.arteries) && !hadLayer) {savedOpening=state.opening;state.opening=0;}
    if (!state.nerves && !state.arteries && hadLayer) state.opening=savedOpening;
    $('#opening').value=state.opening;$('#opening-value').textContent=state.opening;
    updateVisibility();frame();
  }
  $('#nerves').onchange=tissueLayers;$('#arteries').onchange=tissueLayers;
  $('#tissue-preset').onclick=()=>{
    state.gingivaOpacity=.2;state.boneOpacity=.15;state.bones=true;$('#bones').checked=true;$('#bone-transparency').value=85;
    $('#nerves').checked=true;$('#arteries').checked=true;tissueLayers();
  };
  function preset(kind) {
    state.mode='mouth';removeIsolated();state.jaw='both';state.opening=0;savedOpening=0;state.nerves=false;state.arteries=false;state.bones=true;
    state.gingivaOpacity=kind==='roots'?.25:1;state.boneOpacity=kind==='roots'?.45:1;
    $('#nerves').checked=false;$('#arteries').checked=false;$('#opening').value=0;$('#opening-value').textContent=0;
    updateVisibility();selection(state.selected);frame();
  }
  $('#source-preset').onclick=()=>preset('source');$('#root-preset').onclick=()=>preset('roots');
  $('#bones').onchange=e=>{state.bones=e.target.checked;updateVisibility();if(state.mode==='mouth')frame();};
  $('#opening').oninput=e=>{state.opening=Number(e.target.value);$('#opening-value').textContent=state.opening;updateVisibility();};
  $('#focus').onclick=focusTooth;$('#detail').onclick=focusTooth;$('#home').onclick=home;$('#reset').onclick=()=>frame();
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>frame(b.dataset.view));
  $('#zoom-in').onclick=()=>{controls.dollyIn(1/1.25);controls.update();};
  $('#zoom-out').onclick=()=>{controls.dollyOut(1/1.25);controls.update();};
  document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||['INPUT','BUTTON','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key==='Escape')home();if(e.key.toLowerCase()==='f')focusTooth();if(e.key.toLowerCase()==='r')frame();});
  const loop = () => {requestAnimationFrame(loop);if(document.hidden)return;controls.update();if(dirty){renderer.render(scene,camera);frames++;dirty=false;}};loop();
  const catalog={assets:{dentition:manifest.binarySha256,neurovascular:extra.binarySha256},teeth:[...teeth.keys()],structures:[...manifest.structures,...extra.structures].map(s=>({name:s.name,label:s.fdi?toothName(s.fdi):t(s.label??s.name),fdi:s.fdi??null}))};
  const captureView=()=>validateView({version:1,assets:catalog.assets,structure:selectedStructure,state,camera:camera.position.toArray(),target:controls.target.toArray()},catalog);
  function restoreView(value) {
    const view=validateView(value,catalog);
    Object.assign(state,view.state);removeIsolated();
    if(state.mode==='tooth')focusTooth();else {updateVisibility();selection(state.selected);frame();}
    selectedStructure=view.structure;
    $('#selected-label').textContent=catalog.structures.find(x=>x.name===view.structure).label;
    $('#nerves').checked=state.nerves;$('#arteries').checked=state.arteries;
    $('#opening').value=state.opening;$('#opening-value').textContent=state.opening;savedOpening=0;
    controls.enableDamping=false;controls.update();
    camera.position.fromArray(view.camera);controls.target.fromArray(view.target);controls.update();controls.enableDamping=true;mark();
  }
  installContributions({captureView,restoreView,catalog});
  window.__anatomy = Object.freeze({captureView,restoreView,snapshot:()=>({...state,frames,teeth:teeth.size,visibleTeeth:objects.filter(o=>o.userData.fdi&&o.visible&&o.parent.visible).length,triangles:renderer.info.render.triangles,geometryMemory:renderer.info.memory.geometries,camera:camera.position.toArray(),source:'Z-Anatomy',pulpAvailable:false,visibleNerves:objects.filter(o=>o.userData.kind==='nerve'&&o.visible&&o.parent.visible).length,visibleArteries:objects.filter(o=>o.userData.kind==='artery'&&o.visible&&o.parent.visible).length,gingiva:objects.filter(o=>o.userData.kind==='gingiva').map(o=>({visible:o.visible,opacity:o.material[0].opacity,depthWrite:o.material[0].depthWrite,castShadow:o.castShadow}))}),project:fdi=>{const m=teeth.get(fdi);const p=new THREE.Vector3();const g=m.userData.groups.find(g=>g.material.startsWith('Teeth.')&&!g.material.includes('roots'));const indices=m.geometry.index.array,positions=m.geometry.attributes.position;const ids=new Set(indices.slice(g.start,g.start+g.count));for(const i of ids)p.add(new THREE.Vector3().fromBufferAttribute(positions,i));p.divideScalar(ids.size);m.localToWorld(p);p.project(camera);const r=host.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};}});
}
$('#sources').onclick=()=>$('#source-dialog').showModal();$('#close-sources').onclick=()=>$('#source-dialog').close();
start().catch(error=>{console.error(error);const failure=viewerFailure(error,loadingPhase);showModelError(failure.message,failure);installContributions();});
