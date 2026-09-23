// Private prose stays in the current page's memory, never persistent browser storage.
const drafts=new Set();
export function hasUnsavedDraft(){return [...drafts].some(check=>check());}
export function guardDraft(check){drafts.add(check);return ()=>drafts.delete(check);}
export function watchDraft(form){
  let dirty=false;
  form.addEventListener('input',()=>{dirty=true;});
  form.addEventListener('change',()=>{dirty=true;});
  const release=guardDraft(()=>dirty);
  return {clear(){dirty=false;release();}};
}
if(typeof window!=='undefined')window.addEventListener('beforeunload',event=>{
  if(hasUnsavedDraft()){event.preventDefault();event.returnValue='';}
});
