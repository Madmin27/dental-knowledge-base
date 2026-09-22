import * as THREE from './vendor/three.module.js';
// Original procedural teaching geometry. Arbitrary display units, NOT measured anatomy.
export const allFDIs=Object.freeze([1,2,3,4].flatMap(q=>Array.from({length:8},(_,i)=>q*10+i+1)));
const names=['Santral kesici','Lateral kesici','Kanin','Birinci küçük azı','İkinci küçük azı','Birinci büyük azı','İkinci büyük azı','Üçüncü büyük azı'];
export function toothInfo(fdi){
 if(!allFDIs.includes(Number(fdi)))throw new RangeError('Invalid permanent FDI');
 const q=Math.floor(fdi/10),p=fdi%10,upper=q<=2,right=q===1||q===4;
 return {fdi:Number(fdi),position:p,upper,right,name:names[p-1],quadrant:`${upper?'Üst':'Alt'} ${right?'sağ':'sol'}`,
  type:p<3?'incisor':p===3?'canine':p<6?'premolar':'molar',
  roots:p>=6?(upper?3:2):(p===4&&upper?2:1)};
}
export const tissues={enamel:{label:'Mine',color:0xf8f0d9},dentin:{label:'Dentin / kök',color:0xe7c889},pulp:{label:'Pulpa / kanal şeması',color:0xc94850},cementum:{label:'Sement örtüsü',color:0xd1b183}};
const mat=(t)=>new THREE.MeshStandardMaterial({color:tissues[t].color,roughness:t==='enamel'?.29:.53,metalness:0,side:THREE.DoubleSide});
function geometry(vertices,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;}
function rings(rows,segments=48){const v=[],ix=[];rows.forEach(row=>{for(let j=0;j<=segments;j++)v.push(...row(j/segments*Math.PI*2));});for(let i=0;i<rows.length-1;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;ix.push(a,a+1,b,b,a+1,b+1);}return geometry(v,ix);}
function crown(info,scale=1,detail=48){
 const p=info.position,upper=info.upper;
 const width=(p===1?(upper?4.3:2.8):p===2?(upper?3.35:3):p===3?3.6:p<6?3.65:p===6?5.3:p===7?4.9:4.5)*scale;
 const depth=(p<3?2.85:p===3?3.45:p<6?4.15:4.8)*scale;
 const height=(p<3?9:p===3?10:7.5)*scale;
 const oval=a=>{const c=Math.cos(a),s=Math.sin(a),exp=p>=6?.66:.9;return [Math.sign(c)*Math.abs(c)**exp,Math.sign(s)*Math.abs(s)**exp];};
 const rows=[];
 rows.push(a=>[0,0,0]);
 for(let i=0;i<=20;i++){const t=i/20,r=.70+.26*Math.sin(t*Math.PI/2);rows.push(a=>{const [x,z]=oval(a);return [width*x*r,height*.82*t,depth*z*r];});}
 // A radial occlusal surface gives posterior cusps and grooves instead of spheres.
 for(let i=0;i<=20;i++){const r=1-i/20;rows.push(a=>{
  const [ox,oz]=oval(a),x=ox*r,z=oz*r;
  let y;
  if(p<3)y=height*(.86+.12*(1-Math.abs(z))-.045*x*x);
  else if(p===3)y=height*(.77+.25*Math.exp(-(x*x*2.8+z*z*2.5)));
  else {let bump=0;const positions=p<6?[[0,-.53],[0,.53]]:[[-.5,-.48],[.48,-.5],[-.5,.5],[.48,.48]];
   for(const [cx,cz] of positions)bump+=Math.exp(-((x-cx)**2+(z-cz)**2)*10);
   y=height*(.78+.24*bump-.045*Math.exp(-(x*x+z*z)*15));}
  const blend=Math.min(1,(1-r)*9);return [width*x*.96,height*.82*(1-blend)+y*blend,depth*z*.96];
 });}
 return rings(rows,detail);
}
function rootPath(info,r){
 const count=info.roots;
 if(count===1)return [[0,0,0],[.1,-5,0],[.6,-11,-.3],[1,-(info.position===3?18:15),-.6]];
 if(count===2){const side=r?1:-1;return [[side*1.8,0,0],[side*2.0,-5,0],[side*3.1,-11,.1],[side*3.8,-15,-.6]];}
 const angle=r*Math.PI*2/3+.5;const x=Math.cos(angle),z=Math.sin(angle);
 return [[x*2.0,0,z*2.0],[x*2.6,-5,z*2.6],[x*3.8,-11,z*3.5],[x*4.4,-(r===2?16:14),z*4.1]];
}
function taperedRoot(points,radius,detail=32){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const rows=[];
 for(let i=0;i<=36;i++){const t=i/36,c=curve.getPoint(t),r=radius*(.99-.94*t**1.45);rows.push(a=>[c.x+Math.cos(a)*r,c.y,c.z+Math.sin(a)*r*.79]);}
 rows.push(()=>points.at(-1));return rings(rows,detail);
}
export function createTooth(fdi,{detail=48}={}){
 const info=toothInfo(fdi),group=new THREE.Group();group.userData={...info,schematic:true};
 const add=(t,g,part)=>{const m=new THREE.Mesh(g,mat(t));m.userData={fdi:info.fdi,tissue:t,part};m.castShadow=false;group.add(m);return m;};
 add('enamel',crown(info,1,detail),'crown');add('dentin',crown(info,.84,detail),'crown');
 const chamber=new THREE.SphereGeometry(info.type==='molar'?1.7:info.type==='premolar'?1.2:.8,24,20);chamber.scale(1,1.7,info.type==='incisor'?.65:1);chamber.translate(0,2.5,0);add('pulp',chamber,'chamber');
 for(let r=0;r<info.roots;r++){
  const path=rootPath(info,r),radius=info.roots===1?2.2:1.8;
  add('cementum',taperedRoot(path,radius*1.035,32),'root');add('dentin',taperedRoot(path,radius,32),'root');
  const canalPath=[[0,2.8,0],...path.slice(1).map((v,i)=>i===2?[v[0]*.98,v[1]+.65,v[2]*.98]:v)];
  add('pulp',taperedRoot(canalPath,.39,20),'canal');
 }
 return group;
}
export function archPose(fdi){const t=toothInfo(fdi),a=(t.position-.5)*Math.PI*.57/8,sgn=t.right?-1:1,r=t.upper?30:27;
 return {x:sgn*r*Math.sin(a),z:r*1.38*Math.cos(a)-10,y:t.upper?10:-10,angle:sgn*a};}
export function createMouth(){
 const group=new THREE.Group(),teeth=new Map();
 for(const fdi of allFDIs){const m=createTooth(fdi,{detail:32}),p=archPose(fdi);m.position.set(p.x,p.y,p.z);m.rotation.y=p.angle;if(m.userData.upper)m.rotation.z=Math.PI;group.add(m);teeth.set(fdi,m);}
 return {group,teeth};
}
export function createGum(upper){
 const r=upper?30:27,points=[];
 for(let i=0;i<=80;i++){const a=-Math.PI*.57+i/80*Math.PI*1.14;points.push(new THREE.Vector3(r*Math.sin(a),0,r*1.38*Math.cos(a)-10));}
 const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),100,5.0,20,false);g.scale(1,.72,1);
 const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xbf7077,roughness:.57,side:THREE.DoubleSide}));mesh.position.y=upper?13:-13;mesh.userData={gum:true,upper};return mesh;
}
// Compute per-shell planar caps from actual triangle/plane intersections.
// Separate root meshes keep disconnected roots from being bridged into one cap.
export function createSectionCap(g,z){
 const pos=g.attributes.position,idx=g.index,points=new Map();
 const vertex=i=>new THREE.Vector3().fromBufferAttribute(pos,i);
 for(let k=0;k<idx.count;k+=3){const tri=[vertex(idx.getX(k)),vertex(idx.getX(k+1)),vertex(idx.getX(k+2))];
  for(let e=0;e<3;e++){const a=tri[e],b=tri[(e+1)%3];if((a.z-z)*(b.z-z)>=0)continue;const p=a.clone().lerp(b,(z-a.z)/(b.z-a.z));points.set(`${p.x.toFixed(4)},${p.y.toFixed(4)}`,p);}}
 const pts=[...points.values()];if(pts.length<3)return new THREE.BufferGeometry();
 const center=pts.reduce((a,p)=>a.add(p),new THREE.Vector3()).divideScalar(pts.length);pts.sort((a,b)=>Math.atan2(a.y-center.y,a.x-center.x)-Math.atan2(b.y-center.y,b.x-center.x));
 const shape=new THREE.Shape(pts.map(p=>new THREE.Vector2(p.x,p.y)));const cap=new THREE.ShapeGeometry(shape);cap.translate(0,0,z);return cap;
}
export function disposeModel(group){group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
