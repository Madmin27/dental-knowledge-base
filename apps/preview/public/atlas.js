import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {allFDIs,toothInfo,tissues,createTooth,createMouth,createGum,createSectionCap,disposeModel} from './atlas-geometry.js';
const $=id=>document.getElementById(id);
const state={selected:16,mode:'mouth',jaw:'both',opening:12,wisdom:true,roots:false,gums:true,opacity:1,section:false,slice:0,layers:new Set(Object.keys(tissues))};
let renderer,scene,camera,controls,mouth,isolated,upperGum,lowerGum,frame=0,dirty=true,lastTime=0;
const caps=new THREE.Group(),clip=new THREE.Plane(new THREE.Vector3(0,0,-1),0),viewport=$('viewport');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let animation=null;let visible=true;
const invalidate=()=>{dirty=true;};
function syncLabels(){
 const t=toothInfo(state.selected);$('fdi-number').textContent=t.fdi;$('tooth-name').textContent=t.name;$('tooth-position').textContent=t.quadrant;
 $('tooth-type').textContent={incisor:'Kesici',canine:'Kanin',premolar:'Küçük azı',molar:'Büyük azı'}[t.type];$('root-count').textContent=String(t.roots);
 $('scene-title').textContent=state.mode==='mouth'?'Erişkin kalıcı diş dizilimi':`FDI ${t.fdi} · ${t.name}`;
 $('mode-label').textContent=state.mode==='mouth'?'Tüm ağız':`Tek diş · ${t.fdi}`;
 $('section-hint').textContent=state.section?'Bir kesit bütün kanalları aynı anda içermeyebilir. Ölçüm değildir.':'Kesit, seçili dişi tek başına açar.';
 $('tooth-note').textContent=t.position===8?'Üçüncü büyük azıların varlığı ve biçimi değişkendir. Bu, seçilmiş bir şemadır.':'Kök ve kanal düzeni yalnız seçilmiş bir şemadır; bireysel varyasyonları temsil etmez.';
 document.querySelectorAll('[data-fdi]').forEach(b=>{b.classList.toggle('selected',Number(b.dataset.fdi)===state.selected);b.setAttribute('aria-pressed',String(Number(b.dataset.fdi)===state.selected));b.disabled=!state.wisdom&&Number(b.dataset.fdi)%10===8;});
 $('render-status').textContent=state.mode==='mouth'?`${(state.wisdom?32:28)/(state.jaw==='both'?1:2)} diş · şematik geometri`:'Tek diş · yüksek örneklemeli şema';
 $('home').hidden=state.mode==='mouth';
}
function applyVisibility(){
 if(!mouth)return;
 for(const [fdi,tooth] of mouth.teeth){const t=tooth.userData;
  tooth.visible=state.mode==='mouth'&&(state.wisdom||fdi%10!==8)&&(state.jaw==='both'||(state.jaw==='upper')===t.upper);
  tooth.position.y=(t.upper?1:-1)*(10+state.opening/2);
  for(const m of tooth.children){const tissue=m.userData.tissue;
   m.visible=state.layers.has(tissue)&&(m.userData.part==='root'?state.roots:tissue!=='pulp');
   m.material.opacity=tissue==='enamel'||tissue==='dentin'?state.opacity:1;m.material.transparent=m.material.opacity<1;m.material.depthWrite=!m.material.transparent;
   m.material.emissive.setHex(fdi===state.selected?0x3d7667:0);m.material.emissiveIntensity=fdi===state.selected?.13:0;
  }
 }
 for(const gum of [upperGum,lowerGum]){gum.position.y=(gum.userData.upper?1:-1)*(13+state.opening/2);gum.visible=state.mode==='mouth'&&state.gums&&(state.jaw==='both'||(state.jaw==='upper')===gum.userData.upper);gum.material.transparent=state.roots;gum.material.opacity=state.roots?.23:1;gum.material.depthWrite=!state.roots;}
 if(isolated){isolated.visible=state.mode==='tooth';for(const m of isolated.children){m.visible=state.layers.has(m.userData.tissue);m.material.opacity=['enamel','dentin','cementum'].includes(m.userData.tissue)?state.opacity:1;m.material.transparent=m.material.opacity<1;m.material.depthWrite=!m.material.transparent;}}
 for(const c of caps.children)c.visible=state.layers.has(c.userData.tissue);
 caps.visible=state.mode==='tooth'&&state.section;
 syncLabels();invalidate();
}
function moveCamera(position,target,duration=520){
 animation={from:camera.position.clone(),to:new THREE.Vector3(...position),start:performance.now(),duration:reduced?0:duration,targetFrom:controls.target.clone(),targetTo:new THREE.Vector3(...target)};invalidate();
}
function preset(view='front'){
 if(state.mode==='tooth'){const p=view==='side'?[45,1,0]:view==='occlusal'?[0,50,.1]:[0,2,58];moveCamera(p,[0,-3,0]);}
 else {const p=view==='side'?[150,30,15]:view==='occlusal'?[0,state.jaw==='upper'?-160:160,5]:[0,20,160];moveCamera(p,[0,0,6]);}
}
function clearCaps(){for(const c of [...caps.children]){caps.remove(c);c.geometry.dispose();c.material.dispose();}}
function updateSection(){
 clearCaps();if(!isolated)return;
 clip.constant=state.slice*4.7;
 const rank={cementum:0,enamel:1,dentin:2,pulp:3};
 for(const m of isolated.children){m.material.clippingPlanes=state.section?[clip]:[];m.material.needsUpdate=true;
  if(state.section){const g=createSectionCap(m.geometry,clip.constant);if(!g.attributes.position?.count){g.dispose();continue;}
   const material=new THREE.MeshStandardMaterial({color:tissues[m.userData.tissue].color,side:THREE.DoubleSide,roughness:.8,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2-rank[m.userData.tissue]});
   const c=new THREE.Mesh(g,material);c.userData={tissue:m.userData.tissue};c.position.z=.005+rank[m.userData.tissue]*.008;c.renderOrder=rank[m.userData.tissue]+1;caps.add(c);
  }
 }
 applyVisibility();
}
function enterTooth(){
 animation=null;if(isolated){scene.remove(isolated);disposeModel(isolated);}isolated=createTooth(state.selected,{detail:80});scene.add(isolated);state.mode='tooth';controls.minDistance=15;controls.maxDistance=140;updateSection();preset();applyVisibility();
}
function goHome(){state.mode='mouth';state.section=false;$('section').checked=false;controls.minDistance=45;controls.maxDistance=270;clearCaps();if(isolated){scene.remove(isolated);disposeModel(isolated);isolated=null;}applyVisibility();preset();}
function selectTooth(fdi){state.selected=fdi;if(state.mode==='tooth')enterTooth();else applyVisibility();}
function reset(){state.opacity=1;$('opacity').value=100;$('opacity-label').value='100%';state.slice=0;$('slice').value=0;$('slice-label').value='Orta';state.section=false;$('section').checked=false;state.layers=new Set(Object.keys(tissues));document.querySelectorAll('[data-tissue]').forEach(c=>c.checked=true);controls.autoRotate=false;$('rotate').setAttribute('aria-pressed','false');updateSection();preset();}
function bindUI(){
 for(const [key,value] of Object.entries(tissues)){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.checked=true;input.dataset.tissue=key;const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background='#'+value.color.toString(16).padStart(6,'0');label.append(input,document.createTextNode(value.label),swatch);$('layers').append(label);input.addEventListener('change',()=>{input.checked?state.layers.add(key):state.layers.delete(key);applyVisibility();});}
 for(const [row,ids] of [['upper-chart',[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28]],['lower-chart',[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]]])for(const fdi of ids){const b=document.createElement('button');b.textContent=fdi;b.dataset.fdi=fdi;b.title=`${toothInfo(fdi).quadrant} ${toothInfo(fdi).name}`;b.setAttribute('aria-label',`FDI ${fdi}, ${b.title}`);b.addEventListener('click',()=>selectTooth(fdi));b.addEventListener('dblclick',()=>{selectTooth(fdi);enterTooth();});$(row).append(b);}
 document.querySelectorAll('[data-jaw]').forEach(b=>b.addEventListener('click',()=>{if(state.mode==='tooth')goHome();state.jaw=b.dataset.jaw;if(state.jaw!=='both' && toothInfo(state.selected).upper!==(state.jaw==='upper'))state.selected=({1:4,2:3,3:2,4:1}[Math.floor(state.selected/10)])*10+state.selected%10;document.querySelectorAll('[data-jaw]').forEach(x=>x.classList.toggle('on',x===b));applyVisibility();}));
 $('opening').addEventListener('input',e=>{state.opening=Number(e.target.value);$('opening-label').value=String(state.opening);applyVisibility();});
 for(const key of ['wisdom','roots','gums'])$(key).addEventListener('change',e=>{state[key]=e.target.checked;if(key==='wisdom'&&!state.wisdom&&state.selected%10===8)selectTooth(state.selected-1);applyVisibility();});
 $('opacity').addEventListener('input',e=>{state.opacity=Number(e.target.value)/100;$('opacity-label').value=`${e.target.value}%`;applyVisibility();});
 $('focus').addEventListener('click',enterTooth);$('home').addEventListener('click',goHome);$('reset').addEventListener('click',reset);
 $('section').addEventListener('change',e=>{state.section=e.target.checked;if(state.mode==='mouth')enterTooth();else updateSection();});
 $('slice').addEventListener('input',e=>{state.slice=Number(e.target.value)/100;$('slice-label').value=state.slice===0?'Orta':`${e.target.value}%`;if(state.mode==='tooth')updateSection();});
 $('xray').addEventListener('click',()=>{state.section=false;$('section').checked=false;state.opacity=.2;$('opacity').value=20;$('opacity-label').value='20%';state.layers=new Set(Object.keys(tissues));document.querySelectorAll('[data-tissue]').forEach(c=>c.checked=true);if(state.mode==='mouth')enterTooth();else updateSection();});
 $('internal').addEventListener('click',()=>{state.section=true;$('section').checked=true;state.opacity=1;$('opacity').value=100;$('opacity-label').value='100%';if(state.mode==='mouth')enterTooth();else updateSection();});
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.view)));
 $('zoom-in').addEventListener('click',()=>{animation=null;controls.dollyIn(1/1.28);controls.update();checkScale();invalidate();});
 $('zoom-out').addEventListener('click',()=>{animation=null;controls.dollyOut(1/1.28);controls.update();checkScale();invalidate();});
 $('rotate').addEventListener('click',()=>{controls.autoRotate=!controls.autoRotate;$('rotate').setAttribute('aria-pressed',String(controls.autoRotate));invalidate();});
 $('sources').addEventListener('click',()=>$('source-dialog').showModal());$('close-sources').addEventListener('click',()=>$('source-dialog').close());
 $('mobile-layers').addEventListener('click',()=>{document.querySelector('.right-panel').classList.remove('open');document.querySelector('.left-panel').classList.toggle('open');});$('mobile-info').addEventListener('click',()=>{document.querySelector('.left-panel').classList.remove('open');document.querySelector('.right-panel').classList.toggle('open');});
 document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||$('source-dialog').open)return;if(e.key==='Escape')goHome();if(e.key.toLowerCase()==='f')enterTooth();if(e.key.toLowerCase()==='r')reset();if(e.key.toLowerCase()==='c'){$('section').checked=!$('section').checked;$('section').dispatchEvent(new Event('change'));}});
}
let scaleCooldown=0;
function checkScale(){if(animation||performance.now()<scaleCooldown)return;const d=controls.getDistance();if(state.mode==='mouth'&&d<48){enterTooth();scaleCooldown=performance.now()+1200;}else if(state.mode==='tooth'&&d>110){goHome();scaleCooldown=performance.now()+1200;}}
function init(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.localClippingEnabled=true;renderer.setClearColor(0xf3f5ed,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;viewport.append(renderer.domElement);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,1,.1,800);camera.position.set(85,48,135);
 scene.add(new THREE.HemisphereLight(0xffffff,0xa5a88e,2.5));const key=new THREE.DirectionalLight(0xfff4dc,3.2);key.position.set(-50,80,100);scene.add(key);const fill=new THREE.DirectionalLight(0xd4e4ef,1.7);fill.position.set(70,10,-60);scene.add(fill);
 controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,6);controls.enableDamping=true;controls.dampingFactor=.1;controls.minDistance=45;controls.maxDistance=270;controls.autoRotateSpeed=.55;controls.update();
 controls.addEventListener('change',invalidate);controls.addEventListener('start',()=>{animation=null;});controls.addEventListener('end',checkScale);
 mouth=createMouth();scene.add(mouth.group);upperGum=createGum(true);lowerGum=createGum(false);scene.add(upperGum,lowerGum,caps);
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
 function hit(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const meshes=[];mouth.group.traverse(o=>{if(o.isMesh&&o.visible&&o.parent.visible)meshes.push(o);});return ray.intersectObjects(meshes,false)[0]?.object.userData.fdi;}
 renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
 renderer.domElement.addEventListener('pointerup',e=>{if(state.mode==='mouth'&&down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<6){const fdi=hit(e);if(fdi)selectTooth(fdi);}down=null;});
 renderer.domElement.addEventListener('dblclick',e=>{if(state.mode==='mouth'){const fdi=hit(e);if(fdi){state.selected=fdi;enterTooth();}}});
 renderer.domElement.addEventListener('wheel',()=>{setTimeout(checkScale,180);},{passive:true});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('error').hidden=false;$('error').textContent='3B bağlantısı kesildi. Sayfayı yenileyerek tekrar deneyin.';});
 const resize=()=>{const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();invalidate();};new ResizeObserver(resize).observe(viewport);resize();
 document.addEventListener('visibilitychange',()=>{visible=!document.hidden;invalidate();});
 bindUI();applyVisibility();$('loading').hidden=true;
 function animate(time){requestAnimationFrame(animate);if(!visible)return;const delta=Math.min(.05,(time-lastTime)/1000||0);lastTime=time;
  if(animation){const t=Math.min(1,(time-animation.start)/Math.max(animation.duration,1)),u=t*t*(3-2*t);camera.position.lerpVectors(animation.from,animation.to,u);controls.target.lerpVectors(animation.targetFrom,animation.targetTo,u);if(t===1)animation=null;invalidate();}
  controls.update(delta);if(dirty||controls.autoRotate){renderer.render(scene,camera);dirty=false;frame++;}
 }
 requestAnimationFrame(animate);
 // Read-only browser-test diagnostics; never a clinical measurement API.
 window.__atlas=Object.freeze({snapshot:()=>({mode:state.mode,selected:state.selected,jaw:state.jaw,section:state.section,slice:state.slice,wisdom:state.wisdom,frames:frame,visibleTeeth:[...mouth.teeth.values()].filter(t=>t.visible).length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,camera:camera.position.toArray(),geometryMemory:renderer.info.memory.geometries,layers:[...state.layers],caps:caps.children.length}),project:fdi=>{const tooth=mouth.teeth.get(fdi),v=tooth.localToWorld(new THREE.Vector3(0,5,0)).project(camera),r=renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}});
}
try{init();}catch(error){console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='3B atlas başlatılamadı. WebGL destekli güncel bir tarayıcı ve donanım hızlandırması gerekiyor. Sayfayı yenileyip tekrar deneyin.';}
