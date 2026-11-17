export const THEME_KEY='between-moves-theme';
export const themePreference=value=>['light','dark'].includes(value)?value:'system';
export const resolveTheme=(choice,darkSystem)=>themePreference(choice)==='system'?(darkSystem?'dark':'light'):choice;
export function installTheme(){
  const system=matchMedia('(prefers-color-scheme: dark)');let choice='system';
  try{choice=themePreference(localStorage.getItem(THEME_KEY));}catch{}
  const select=document.querySelector('#appearance');
  const apply=()=>{
    const theme=resolveTheme(choice,system.matches);
    document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;
    document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#141c18':'#f6f5f0';
    select.value=choice;
  };
  select.addEventListener('change',()=>{choice=themePreference(select.value);try{localStorage.setItem(THEME_KEY,choice);}catch{}apply();});
  system.addEventListener('change',()=>{if(choice==='system')apply();});
  window.addEventListener('storage',event=>{if(event.key===THEME_KEY){choice=themePreference(event.newValue);apply();}});
  apply();
}
