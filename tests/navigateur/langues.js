/* Visite toutes les pages dans une langue (LANGUE=en …) et fait une capture de chacune.
   Les textes non traduits sont signalés au serveur web (/__manque?…) quand config.js définit I18N_MANQUES. */
const {chromium}=require(process.env.PLAYWRIGHT||'playwright');
const SITE='http://localhost:8766/index.html',L=process.env.LANGUE||'en',IMG=process.env.IMAGES||'captures-langues';
require('fs').mkdirSync(IMG,{recursive:true});
(async()=>{
  const b=await chromium.launch();const erreurs=[];
  const ctx=await b.newContext({viewport:{width:412,height:915}});
  await ctx.addInitScript(l=>{try{localStorage.setItem('crs:langue',l);}catch(e){}},L);
  const p=await ctx.newPage();
  p.on('pageerror',e=>erreurs.push(e.message));
  await p.goto(SITE);await p.waitForTimeout(600);
  const cap=async n=>{await p.waitForTimeout(500);await p.screenshot({path:`${IMG}/${L}-${n}.png`,fullPage:true});};
  console.log(L,'lang=',await p.evaluate(()=>document.documentElement.lang+' dir='+document.documentElement.dir),'|',await p.textContent('.bv-hero h1'));
  await cap('00-accueil');
  await p.evaluate(()=>location.hash='#guide');await cap('01-guide-public');
  await p.evaluate(()=>location.hash='#bienvenue');await p.waitForTimeout(300);
  await p.click('#bvCommencer');await p.click('#ongletInscription');await cap('02-inscription');
  const d={nom:'KOUASSI',prenoms:'Samuel',contact:'07 33 33 33 33',zone:'Abidjan',email:'samuel-'+L+'@exemple.ci',mdp:'motdepasse1'};
  for(const [k,v] of Object.entries(d))await p.fill('#i-'+k,v);
  await p.click('#btnInscription');await p.waitForTimeout(1500);await cap('03-assemblee');
  await p.evaluate(()=>document.querySelectorAll('#vueAccueil details').forEach(x=>x.open=true));
  await p.fill('#a-nom','Assemblée de Marcory');await p.fill('#a-zone','Marcory');
  await p.click('#formCreerAssemblee button[type=submit]');await p.waitForTimeout(1500);
  for(const v of ['choix','jour','semaine','mois','synthese','suivi','profil','finreglages','finance','depenses','budgets','bilan','guide']){
    await p.evaluate(h=>location.hash='#'+h,v);await p.waitForTimeout(700);
    if(v==='jour'){await p.evaluate(()=>{const c=document.querySelector('button.chrono');if(c)c.click();});await p.waitForTimeout(1200);}
    if(v==='depenses'){await p.evaluate(()=>{const n=document.querySelector('#fabDepense');if(n)n.click();});await p.waitForTimeout(400);}
    await cap(String(['choix','jour','semaine','mois','synthese','suivi','profil','finreglages','finance','depenses','budgets','bilan','guide'].indexOf(v)+4).padStart(2,'0')+'-'+v);
    await p.keyboard.press('Escape');
  }
  await p.setViewportSize({width:1366,height:860});
  for(const v of ['choix','jour','finance','guide']){await p.evaluate(h=>location.hash='#'+h,v);await p.waitForTimeout(600);await p.screenshot({path:`${IMG}/${L}-pc-${v}.png`});}
  console.log('erreurs de page :',JSON.stringify(erreurs));
  await b.close();
})();
