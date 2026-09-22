import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompatibleRenderer,viewerFailure} from '../apps/preview/public/viewer-runtime.js';
const canvas=()=>({addEventListener(){},removeEventListener(){}});
test('context requests let the browser choose the GPU',()=>{
 const calls=[];class Renderer{constructor(options){calls.push(options);}}
 const result=createCompatibleRenderer(Renderer,{createCanvas:canvas});
 assert.equal(calls.length,1);assert.equal(calls[0].powerPreference,'default');assert.equal(result.compatible,false);
});
test('failed antialias profile retries with a fresh canvas and preserves stencil for sections',()=>{
 const calls=[];class Renderer{constructor(options){calls.push(options);if(options.antialias)throw Error('Unsupported antialias');}}
 const result=createCompatibleRenderer(Renderer,{stencil:true,createCanvas:canvas});
 assert.equal(calls.length,2);assert.notEqual(calls[0].canvas,calls[1].canvas);assert.equal(calls[1].antialias,false);assert.equal(calls[1].stencil,true);assert.equal(result.compatible,true);
});
test('explicit compatible mode does not attempt antialias',()=>{
 class Renderer{constructor(options){assert.equal(options.antialias,false);}}
 assert.equal(createCompatibleRenderer(Renderer,{compatible:true,createCanvas:canvas}).compatible,true);
});
test('unavailable contexts retain a bounded diagnostic and a specific error code',()=>{
 class Renderer{constructor(){throw Error('Context creation blocked');}}
 assert.throws(()=>createCompatibleRenderer(Renderer,{createCanvas:canvas}),error=>{
   assert.equal(error.code,'GRAPHICS_CONTEXT_FAILED');assert.match(error.message,/Context creation blocked/);
   const result=viewerFailure(error,'graphics');assert.equal(result.graphics,true);assert.match(result.message,/WebGL 2/);return true;
 });
});
test('file and application failures are never misreported as unavailable WebGL',()=>{
 for(const phase of ['files','geometry','interface']){
  const result=viewerFailure(Error('test failure'),phase);
  assert.equal(result.graphics,false);assert.doesNotMatch(result.message,/WebGL/);assert.equal(result.details,'test failure');
 }
});
