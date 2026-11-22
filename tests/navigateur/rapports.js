/* Rapports : finances du mois et de l'année (aperçu PDF + Excel), Excel de la semaine et du mois.
   LANGUE=fr|en… ; IMAGES=dossier des captures et des fichiers téléchargés. */
const {chromium}=require(process.env.PLAYWRIGHT||'playwright');
const SITE='http://localhost:8766/index.html',L=process.env.LANGUE||'fr',IMG=process.env.IMAGES||'captures-rapports';
const fs=require('fs');fs.mkdirSync(IMG,{recursive:true});
(async()=>{
  const b=await chromium.launch();const erreurs=[];
  const ctx=await b.newContext({viewport:{width:412,height:915},acceptDownloads:true});
  await ctx.addInitScript(l=>{try{localStorage.setItem('crs:langue',l);}catch(e){}},L);
  const p=await ctx.newPage();
  p.on('pageerror',e=>erreurs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))erreurs.push('console: '+m.text());});
  await p.goto(SITE);await p.waitForTimeout(500);
  await p.click('#bvCommencer');await p.click('#ongletInscription');
  const d={nom:'KOUASSI',prenoms:'Samuel',contact:'07 33 33 33 33',zone:'Abidjan',email:'samuel-r-'+L+'@exemple.ci',mdp:'motdepasse1'};
  for(const [k,v] of Object.entries(d))await p.fill('#i-'+k,v);
  await p.click('#btnInscription');await p.waitForTimeout(1500);
  await p.evaluate(()=>document.querySelectorAll('#vueAccueil details').forEach(x=>x.open=true));
  await p.fill('#a-nom','Assemblée de Marcory');await p.fill('#a-zone','Marcory');
  await p.click('#formCreerAssemblee button[type=submit]');await p.waitForTimeout(1500);
  const aller=async h=>{await p.evaluate(x=>location.hash='#'+x,h);await p.waitForTimeout(600);};
  const telecharger=async(sel,nom)=>{try{const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}),p.evaluate(s=>document.querySelector(s).click(),sel)]);
    const f=IMG+'/'+L+'-'+nom+'-'+dl.suggestedFilename();await dl.saveAs(f);console.log('téléchargé :',f.split('/').pop());return f;}catch(e){console.log('ÉCHEC',nom,await p.evaluate(()=>[...document.querySelectorAll('.msg')].map(x=>x.textContent).filter(Boolean).join(' | ')));}};
  // Une journée et une semaine remplies
  await aller('jour');
  for(const [id,v] of [['f-moi','01:10'],['f-faiseur','00:20'],['f-rdqd','00:30']])if(await p.$('#'+id)){await p.fill('#'+id,v);await p.press('#'+id,'Tab');}
  await p.waitForTimeout(500);
  await aller('semaine');await telecharger('#btnXlSemaine','semaine');
  await aller('mois');await telecharger('#btnXl','mois');
  // Aperçus du compte rendu spirituel (même modèle, textes dans la langue choisie)
  for(const t of ['semaine','mois']){await aller('apercu-'+t);await p.waitForTimeout(1200);await p.setViewportSize({width:1280,height:900});
    await p.screenshot({path:IMG+'/'+L+'-cr-'+t+'.png',fullPage:true});await p.setViewportSize({width:412,height:915});
    await p.waitForTimeout(2000);await telecharger('#pdfPartager','cr-'+t+'-pdf');await telecharger('#apercuExcel','cr-'+t+'-xl');}
  // Finances
  await aller('finance');
  await p.evaluate(()=>{const s=document.querySelector('#fr-salaire');if(s&&s.closest('details'))s.closest('details').open=true;});
  await p.fill('#fr-salaire','200000');await p.fill('#fr-autres','30000');await p.evaluate(()=>document.querySelector('#btnRevenus').click());await p.waitForTimeout(400);
  await aller('depenses');
  for(const [m,desc,cat] of [['50000','Dîme',0],['12000','Taxi',6],['35000','Marché',4],['80000','Loyer',11],['15000','Quête',12],['40000','Épargne',14],['9000','Pharmacie',9]]){
    await p.evaluate(()=>document.querySelector('#fabDepense').click());await p.waitForTimeout(250);
    await p.fill('#d-montant',m);await p.fill('#d-desc',desc);await p.selectOption('#d-cat',{index:cat});
    await p.evaluate(()=>document.querySelector('#formDepense').requestSubmit());await p.waitForTimeout(300);
  }
  await aller('finance');await p.screenshot({path:IMG+'/'+L+'-finance.png',fullPage:true});
  await p.evaluate(()=>document.querySelector('#btnRapportFinMois').click());await p.waitForTimeout(1500);
  await p.screenshot({path:IMG+'/'+L+'-rapport-mois.png',fullPage:true});
  await telecharger('#apercuExcel','fin-mois');
  await p.waitForTimeout(2500);await telecharger('#pdfPartager','fin-mois-pdf');
  await p.evaluate(()=>history.back());await p.waitForTimeout(600);
  await aller('bilan');
  await p.evaluate(()=>document.querySelector('#btnRapportFinAn').click());await p.waitForTimeout(1500);
  await p.screenshot({path:IMG+'/'+L+'-rapport-annee.png',fullPage:true});
  await p.evaluate(()=>history.back());await p.waitForTimeout(600);
  await telecharger('#btnXlFinAn','fin-annee');
  await p.setViewportSize({width:1280,height:900});
  await aller('finance');await p.evaluate(()=>document.querySelector('#btnRapportFinMois').click());await p.waitForTimeout(1500);
  await p.screenshot({path:IMG+'/'+L+'-rapport-mois-pc.png',fullPage:true});
  console.log('erreurs de page :',JSON.stringify(erreurs));
  await b.close();
})();
