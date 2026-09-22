import test from 'node:test';
import assert from 'node:assert/strict';
import {allFDIs,toothInfo,archPose,createTooth,createMouth,createSectionCap,disposeModel} from '../apps/preview/public/atlas-geometry.js';
test('permanent FDI set has 32 unique teeth and correct patient-side quadrants',()=>{
 assert.equal(allFDIs.length,32);assert.equal(new Set(allFDIs).size,32);
 for(const fdi of allFDIs){const t=toothInfo(fdi),p=archPose(fdi);assert.equal(p.x<0,t.right);assert.equal(p.y>0,t.upper);assert.ok(Number.isFinite(p.z));}
 assert.throws(()=>toothInfo(19),/Invalid/);assert.throws(()=>toothInfo(51),/Invalid/);
 assert.equal(toothInfo(16).roots,3);assert.equal(toothInfo(36).roots,2);assert.equal(toothInfo(11).roots,1);
});
test('all schematic teeth have finite independent enamel, dentin, pulp and roots',()=>{
 for(const fdi of allFDIs){const m=createTooth(fdi,{detail:24});assert.equal(m.userData.schematic,true);
  assert.deepEqual([...new Set(m.children.map(x=>x.userData.tissue))].sort(),['cementum','dentin','enamel','pulp']);
  assert.equal(m.children.filter(x=>x.userData.tissue==='cementum').length,toothInfo(fdi).roots);
  for(const part of m.children){for(const n of part.geometry.attributes.position.array)assert.ok(Number.isFinite(n));part.geometry.computeBoundingBox();assert.ok(!part.geometry.boundingBox.isEmpty());}
  disposeModel(m);
 }
});
test('mouth placement preserves unique selectable FDI identities and roots point away from occlusal space',()=>{
 const {group,teeth}=createMouth();assert.equal(teeth.size,32);
 for(const [fdi,m] of teeth){assert.equal(m.userData.fdi,fdi);assert.equal(m.rotation.z,toothInfo(fdi).upper?Math.PI:0);}
 disposeModel(group);
});
test('section caps change with plane position and never introduce nonfinite geometry',()=>{
 for(const fdi of [11,16,36,37]){const t=createTooth(fdi);let cuts=0;
  for(const part of t.children)for(const z of [-2,0,2]){const cap=createSectionCap(part.geometry,z);if(cap.attributes.position){cuts++;for(const n of cap.attributes.position.array)assert.ok(Number.isFinite(n));}cap.dispose();}
  assert.ok(cuts>0);const empty=createSectionCap(t.children[0].geometry,100);assert.equal(empty.attributes.position,undefined);empty.dispose();disposeModel(t);
 }
});
