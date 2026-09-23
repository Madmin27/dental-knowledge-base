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

test('model deadline covers stalled headers and stalled bodies and aborts transfer',async()=>{
 const {fetchModel}=await import('../apps/preview/public/viewer-runtime.js');
 for(const body of [false,true]){
  let signal;
  const fetcher=async(_url,options)=>{signal=options.signal;return body?{ok:true,arrayBuffer:()=>new Promise(()=>{})}:await new Promise(()=>{});};
  await assert.rejects(fetchModel('/fixture.bin','arrayBuffer',{fetcher,timeoutMs:20}),e=>e.code==='MODEL_DOWNLOAD_TIMEOUT');
  assert.equal(signal.aborted,true);
 }
});
test('model loader reports HTTP failures and parses successful payloads',async()=>{
 const {fetchModel}=await import('../apps/preview/public/viewer-runtime.js');
 await assert.rejects(fetchModel('/missing','json',{fetcher:async()=>({ok:false,status:404})}),/404/);
 assert.deepEqual(await fetchModel('/fixture','json',{fetcher:async()=>({ok:true,json:async()=>({source:'synthetic'})})}),{source:'synthetic'});
});

test('progressing streams can exceed idle deadline and report received bytes',async()=>{
 const {fetchModel}=await import('../apps/preview/public/viewer-runtime.js');let chunks=0;const progress=[];
 const body=new ReadableStream({async pull(controller){await new Promise(r=>setTimeout(r,25));controller.enqueue(new Uint8Array([++chunks]));if(chunks===6)controller.close();}});
 const bytes=await fetchModel('/slow-fixture','arrayBuffer',{timeoutMs:100,fetcher:async()=>({ok:true,body}),onProgress:(_url,size)=>progress.push(size)});
 assert.deepEqual([...new Uint8Array(bytes)],[1,2,3,4,5,6]);assert.deepEqual(progress,[1,2,3,4,5,6]);
});
