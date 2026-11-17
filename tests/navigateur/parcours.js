const {chromium}=require(process.env.PLAYWRIGHT || 'playwright');
const SITE=(process.env.SITE||'http://localhost:8766/')+'index.html';
const fs=require('fs');const IMAGES=process.env.IMAGES||'captures';fs.mkdirSync(IMAGES,{recursive:true});
const erreurs=[];
async function nouvelle(b,nom){
  const ctx=await b.newContext({viewport:{width:412,height:915}});
  const p=await ctx.newPage();
  p.on('pageerror',e=>erreurs.push(nom+': '+e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))erreurs.push(nom+' console: '+m.text());});
  await p.goto(SITE);await p.waitForTimeout(300);
  return {ctx,p};
}
async function inscrire(p,d){
  await p.click('#ongletInscription');
  for(const [k,v] of Object.entries(d)) await p.fill('#i-'+k,v);
  await p.click('#btnInscription');await p.waitForTimeout(1200);
}
async function texte(p,sel){return (await p.textContent(sel)).trim();}
(async()=>{
  const b=await chromium.launch();
  // 1. Le responsable crée son compte et son assemblée
  const R=await nouvelle(b,'R');
  console.log('écran de départ :', await R.p.isVisible('#vueConnexion'));
  await R.p.screenshot({path:IMAGES+'/01-connexion.png'});
  await inscrire(R.p,{nom:'KOFFI',prenoms:'Rita',contact:'07 11 11 11 11',zone:'Abidjan',email:'rita@test.ci',mdp:'motdepasse1'});
  console.log('après inscription R :', await R.p.isVisible('#vueAccueil'), await texte(R.p,'#texteAccueil'));
  await R.p.screenshot({path:IMAGES+'/02-assemblee.png',fullPage:true});
  await R.p.fill('#a-nom','Chez les Kouadio');await R.p.fill('#a-zone','Marcory');
  await R.p.click('#formCreerAssemblee button[type=submit]');await R.p.waitForTimeout(1500);
  const code=await texte(R.p,'#codeSuivi');
  console.log('R arrive sur :', R.p.url().split('#')[1], '| code :', code, '| titre :', await texte(R.p,'#titreSuivi'), '|', await texte(R.p,'#msgSuivi'));
  await R.p.screenshot({path:IMAGES+'/03-suivi-vide.png',fullPage:true});

  // 2. Le faiseur rejoint l'assemblée et choisit R comme faiseur
  const F=await nouvelle(b,'F');
  await inscrire(F.p,{nom:'YAO',prenoms:'Fred',contact:'07 22 22 22 22',zone:'Marcory',email:'fred@test.ci',mdp:'motdepasse2'});
  await F.p.fill('#a-code',code.toLowerCase());await F.p.click('#formRejoindre button[type=submit]');await F.p.waitForTimeout(1500);
  console.log('F étape faiseur :', await F.p.isVisible('#etapeFaiseur'), await texte(F.p,'#texteAccueil'));
  console.log('choix proposés à F :', await F.p.$$eval('#f-choix option',o=>o.map(x=>x.textContent).join(' | ')));
  await F.p.selectOption('#f-choix',{label:'KOFFI Rita (responsable)'});
  await F.p.click('#etapeFaiseur button[type=submit]');await F.p.waitForTimeout(1500);
  console.log('F sur Ma journée :', await F.p.isVisible('#vueJour'), '|', await texte(F.p,'#quiSuisJe'));

  // 3. Le disciple rejoint, choisit F, remplit sa journée
  const D=await nouvelle(b,'D');
  await inscrire(D.p,{nom:'KONAN',prenoms:'Aya',contact:'07 33 33 33 33',zone:'Marcory',email:'aya@test.ci',mdp:'motdepasse3'});
  await D.p.fill('#a-code',code);await D.p.click('#formRejoindre button[type=submit]');await D.p.waitForTimeout(1500);
  await D.p.screenshot({path:IMAGES+'/04-faiseur.png',fullPage:true});
  await D.p.selectOption('#f-choix',{label:'YAO Fred'});await D.p.click('#etapeFaiseur button[type=submit]');await D.p.waitForTimeout(1500);
  await D.p.fill('#f-faiseur','15');await D.p.fill('#f-moi','45');await D.p.fill('#f-autre','20');await D.p.fill('#f-rdqd','30');await D.p.fill('#f-ev','2');await D.p.fill('#f-chapitres','4');
  await D.p.click('#btnJour');await D.p.waitForTimeout(4500);
  console.log('D après enregistrement :', await texte(D.p,'#msgJour'), '|', await texte(D.p,'#etatSynchro'), '| barre suivi visible :', await D.p.isVisible('#barreSuivi'));
  await D.p.screenshot({path:IMAGES+'/05-journee.png'});

  // 4. F voit son disciple
  await F.p.reload();await F.p.waitForTimeout(2000);
  console.log('barre suivi chez F :', await F.p.isVisible('#barreSuivi'), await texte(F.p,'#barreSuivi'));
  await F.p.click('#barreSuivi');await F.p.waitForTimeout(1800);
  console.log('suivi F :', await texte(F.p,'#titreSuivi'), '|', await F.p.$$eval('.personne .nom',n=>n.map(x=>x.textContent).join(', ')), '|', await F.p.$$eval('.personne .score',n=>n.map(x=>x.textContent).join(', ')), '| filtre visible :', await F.p.isVisible('#filtreSuivi'));
  await F.p.screenshot({path:IMAGES+'/06-suivi-faiseur.png',fullPage:true});
  await F.p.click('.personne button:has-text("PDF semaine")');await F.p.waitForTimeout(600);
  console.log('aperçu PDF de D chez F :', await F.p.isVisible('#apercu'), (await texte(F.p,'#feuille .r-identite')).replace(/\s+/g,' '));
  await F.p.screenshot({path:IMAGES+'/07-pdf-disciple.png'});
  await F.p.click('#fermerApercu');await F.p.waitForTimeout(500);
  await F.p.click('.personne button:has-text("PDF ")>>nth=1');await F.p.waitForTimeout(1200);
  console.log('aperçu mois de D :', await F.p.isVisible('#apercu'), (await texte(F.p,'#feuille .r-titre')));
  await F.p.click('#fermerApercu');await F.p.waitForTimeout(500);

  // 5. R voit toute l'assemblée et nomme F responsable
  await R.p.goto(SITE+'#jour');await R.p.reload();await R.p.waitForTimeout(1800);
  await R.p.click('#barreSuivi');await R.p.waitForTimeout(1500);
  console.log('filtre par défaut du responsable :', await R.p.getAttribute('[data-filtre="assemblee"]','aria-selected'));
  await R.p.click('[data-filtre="disciples"]');await R.p.waitForTimeout(1500);
  console.log('R, mes disciples :', await R.p.$$eval('.personne .nom',n=>n.map(x=>x.textContent).join(', ')));
  await R.p.click('[data-filtre="assemblee"]');await R.p.waitForTimeout(1500);
  console.log('R, assemblée :', await R.p.$$eval('.personne .nom',n=>n.map(x=>x.textContent).join(', ')), '|', await R.p.$$eval('.personne .sous',n=>n.map(x=>x.textContent).join(' / ')));
  console.log('tuiles R :', (await texte(R.p,'#suTuiles')).replace(/\s+/g,' '));
  await R.p.screenshot({path:IMAGES+'/08-suivi-assemblee.png',fullPage:true});
  const carteF=R.p.locator('.personne:has(.nom:text-is("YAO Fred"))');
  await carteF.locator('summary').click();await carteF.locator('button:has-text("Nommer responsable")').click();await R.p.waitForTimeout(300);
  console.log('dialogue :', await texte(R.p,'#dialogueTexte'));
  await R.p.click('#dialogueOui');await R.p.waitForTimeout(1800);
  console.log('après nomination :', await R.p.$$eval('.personne .nom',n=>n.map(x=>x.textContent).join(', ')));

  // 6. D sur un deuxième appareil, puis hors connexion
  const D2=await nouvelle(b,'D2');
  await D2.p.fill('#c-email','aya@test.ci');await D2.p.fill('#c-mdp','faux-mot');await D2.p.click('#btnConnexion');await D2.p.waitForTimeout(800);
  console.log('mauvais mot de passe :', await texte(D2.p,'#msgConnexion'));
  await D2.p.fill('#c-mdp','motdepasse3');await D2.p.click('#btnConnexion');await D2.p.waitForTimeout(2500);
  console.log('2e appareil, journée retrouvée :', await D2.p.inputValue('#f-moi'), await D2.p.inputValue('#f-ev'), '|', await texte(D2.p,'#etatSynchro'));
  await D2.ctx.setOffline(true);
  await D2.p.fill('#f-pg','30');await D2.p.click('#btnJour');await D2.p.waitForTimeout(3500);
  console.log('hors connexion :', await texte(D2.p,'#etatSynchro'));
  await D2.ctx.setOffline(false);await D2.p.evaluate(()=>window.dispatchEvent(new Event('online')));await D2.p.waitForTimeout(2500);
  console.log('connexion revenue :', await texte(D2.p,'#etatSynchro'));
  await D.p.reload();await D.p.waitForTimeout(2500);
  console.log('1er appareil reçoit la PG :', await D.p.inputValue('#f-pg'));

  // 7. Profil : faiseur, assemblée, compte
  await D.p.click('.onglets-bas [data-aller="profil"]');await D.p.waitForTimeout(1500);
  console.log('profil D :', await texte(D.p,'#faiseurActuel'), '|', await texte(D.p,'#assembleeActuelle'), '|', await texte(D.p,'#emailCompte'), '| code visible :', await D.p.isVisible('#blocCode'));
  await D.p.screenshot({path:IMAGES+'/09-profil.png',fullPage:true});
  await D.p.click('#btnDeconnexion');await D.p.waitForTimeout(800);
  console.log('déconnexion :', await D.p.isVisible('#vueConnexion'), '|', await texte(D.p,'#msgConnexion'));

  console.log('erreurs de page :', JSON.stringify(erreurs));
  await b.close();
})().catch(e=>{console.error('ÉCHEC', e.message);process.exit(1);});
