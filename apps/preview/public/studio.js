import {t} from './i18n.js';
// UI preferences never alter anatomical geometry or versioned review state.
const root = document.documentElement;
document.querySelector('#language-select')?.addEventListener('change',event=>{
  const url=new URL(location.href);url.searchParams.set('lang',event.target.value);
  location.assign(url.href);
});
const themeButton = document.querySelector('#theme-toggle');
function setTheme(theme) {
  root.dataset.theme = theme;
  themeButton?.setAttribute('aria-label', theme === 'dark' ? t('Aydınlık temaya geç') : t('Koyu temaya geç'));
  themeButton?.setAttribute('aria-pressed', String(theme === 'dark'));
}
let stored;
try { stored = localStorage.getItem('dental-ui-theme'); } catch { /* Private browsing may deny storage. */ }
setTheme(stored === 'dark' ? 'dark' : 'light');
themeButton?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  try { localStorage.setItem('dental-ui-theme', next); } catch { /* This session still works. */ }
});
const stage = document.querySelector('.stage');
const expandButton = document.querySelector('#viewer-fullscreen');
let fullscreenTransition = false;
function syncFullscreen() {
  const expanded = document.fullscreenElement === stage || stage?.classList.contains('is-expanded');
  expandButton?.setAttribute('aria-pressed', String(Boolean(expanded)));
  expandButton?.setAttribute('aria-label', expanded ? t('Tam ekrandan çık') : t('Tam ekran incele'));
  if (expandButton) expandButton.title = expanded ? t('Tam ekrandan çık') : t('Tam ekran incele');
}
expandButton?.addEventListener('click', async () => {
  if (fullscreenTransition) return;
  fullscreenTransition = true;
  try {
    if (document.fullscreenElement === stage) await document.exitFullscreen();
    else if (stage.classList.contains('is-expanded')) stage.classList.remove('is-expanded');
    else {
      try {
        if (!stage.requestFullscreen || !document.fullscreenEnabled) throw new Error('Use viewport expansion');
        await stage.requestFullscreen();
      } catch { stage.classList.add('is-expanded'); }
    }
  } finally { fullscreenTransition = false; syncFullscreen(); }
});
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && stage?.classList.contains('is-expanded')) {
    stage.classList.remove('is-expanded'); syncFullscreen(); expandButton?.focus();
  }
});
const help = document.querySelector('#help-dialog');
document.querySelector('#viewer-help')?.addEventListener('click', () => {
  // A modal in the fullscreen subtree remains visible in the fullscreen top layer.
  if (document.fullscreenElement === stage) stage.append(help);
  help.showModal();
});
document.querySelector('#close-help')?.addEventListener('click', () => help.close());
document.querySelector('[data-open-sources]')?.addEventListener('click', () => {
  help.close();
  const source = document.querySelector('#source-dialog');
  if (document.fullscreenElement === stage) stage.append(source);
  source.showModal();
});

export function showModelError(message, {code,details,graphics=false} = {}) {
  const loading = document.querySelector('#loading');
  if (!loading) return;
  loading.hidden = false;
  loading.dataset.state = 'error';
  if(code)loading.dataset.errorCode=code;
  loading.setAttribute('role', 'alert');
  loading.replaceChildren();
  const text = document.createElement('p');text.textContent = t(message);
  const retry = document.createElement('button');retry.id = 'retry-model';retry.type = 'button';retry.textContent = t('Yeniden yükle');
  retry.addEventListener('click', () => location.reload());
  loading.append(text, retry);
  if(graphics){
    const compatible=document.createElement('a');compatible.className='error-compatible';compatible.textContent=t('Uyumlu grafik modunda dene');
    const url=new URL(location.href);url.searchParams.set('graphics','compat');compatible.href=url.href;loading.append(compatible);
  }
  if(code||details){
    const disclosure=document.createElement('details');const summary=document.createElement('summary');summary.textContent=t('Hata ayrıntısını göster');
    const report=document.createElement('pre');report.textContent=[code,details].filter(Boolean).join('\n');
    disclosure.append(summary,report);loading.append(disclosure);
  }
}
