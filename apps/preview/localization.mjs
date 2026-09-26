import {translate} from './public/i18n.js';
export function requestLanguage(url,cookie='') {
  const explicit=url.searchParams.get('lang');
  if(['en','tr'].includes(explicit))return explicit;
  const saved=cookie.split(';').map(x=>x.trim()).find(x=>/^dental-language=(en|tr)$/.test(x));
  return saved?.split('=')[1]??'en';
}
const escape=text=>text.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function localizedHTML(html,lang){
  let result=html.replace('lang="tr"',`lang="${lang}"`);
  // Translate only static text and human-readable attributes, never IDs, URLs or scripts.
  result=result.replace(/(>)([^<]+)(?=<)|\b(title|aria-label|placeholder)="([^"]*)"/g,(whole,gt,text,attribute,value)=>{
    const original=text??value;
    const translated=translate(original,lang);
    if(translated===original)return whole;
    return gt?gt+escape(translated):`${attribute}="${escape(translated)}"`;
  });
  const selector=`<label class="language-control"><span class="language-label">${lang==='tr'?'Dil':'Language'}</span><select id="language-select" aria-label="${lang==='tr'?'Dil seçimi':'Language selection'}"><option value="en"${lang==='en'?' selected':''}>English</option><option value="tr"${lang==='tr'?' selected':''}>Türkçe</option></select></label>`;
  const footer=`<footer class="site-footer"><span>Dental Open Source</span><a href="/review/">${lang==='tr'?'Üyelik ve katkı paneli':'Join & contribute'}</a><a href="/media-guide">${lang==='tr'?'Görsel katkı rehberi':'Visual contribution guide'}</a><a href="/report">${lang==='tr'?'Teknik sorun bildir':'Report a technical issue'}</a><a href="https://github.com/Madmin27/dental-knowledge-base" target="_blank" rel="noopener noreferrer">${lang==='tr'?'GitHub · Kaynak kodu':'GitHub · Source code'} ↗</a></footer>`;
  return result.replace('<div class="header-actions">','<div class="header-actions">'+selector).replace('</body>',footer+'</body>');
}
