import test from 'node:test';
import assert from 'node:assert/strict';
import {previewServer} from '../apps/preview/server.mjs';
import {localizedHTML,requestLanguage} from '../apps/preview/localization.mjs';
import {translate} from '../apps/preview/public/i18n.js';

test('English defaults, explicit choice overrides cookie, unsupported input is ignored',()=>{
  const url=q=>new URL('https://example.org/'+q);
  assert.equal(requestLanguage(url('')),'en');
  assert.equal(requestLanguage(url(''),'other=x; dental-language=tr'),'tr');
  assert.equal(requestLanguage(url('?lang=en'),'dental-language=tr'),'en');
  assert.equal(requestLanguage(url('?lang=%3Cscript%3E'),'dental-language=bogus'),'en');
  assert.equal(translate('  Dişin dış yüzeyi  ','en'),'  External tooth surface  ');
  assert.equal(translate('Dişin dış yüzeyi','tr'),'Dişin dış yüzeyi');
  assert.equal(translate('unrecognized source identifier'),'unrecognized source identifier');
  assert.equal(translate('%22'),'22%');
});

test('localization preserves identifiers, source links and machine-readable values',()=>{
  const html='<html lang="tr"><a id="Katkı takibi" href="/sources?name=Katkı takibi" title="Katkı takibi">Katkı takibi</a><input value="Katkı takibi"></html>';
  const translated=localizedHTML(html,'en');
  assert.match(translated,/lang="en"/);
  assert.match(translated,/title="Contribution tracking">Contribution tracking</);
  assert.match(translated,/id="Katkı takibi"/);
  assert.match(translated,/href="\/sources\?name=Katkı takibi"/);
  assert.match(translated,/value="Katkı takibi"/);
});

test('all current pages serve English and Turkish with persistent preference headers',async t=>{
  const server=previewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const path of ['/','/anatomy','/tooth-interior','/overview','/contributions']){
    const en=await fetch(base+path);const english=await en.text();
    assert.equal(en.headers.get('content-language'),'en');
    assert.match(english,/<html lang="en"/);assert.match(english,/id="language-select"/);
    const tr=await fetch(base+path+'?lang=tr');
    assert.equal(tr.headers.get('content-language'),'tr');
    assert.match(tr.headers.get('set-cookie'),/dental-language=tr; Path=\//);
    assert.match(await tr.text(),/<html lang="tr"/);
    const retained=await fetch(base+path,{headers:{Cookie:'dental-language=tr'}});
    assert.equal(retained.headers.get('content-language'),'tr');assert.equal(retained.headers.get('vary'),'Cookie');
  }
  assert.equal((await fetch(base+'/i18n.js')).status,200);
});
