const {chromium}=require(process.env.PLAYWRIGHT || 'playwright');
const SITE=(process.env.SITE||'http://localhost:8766/')+'index.html';
const fs=require('fs');const IMAGES=process.env.IMAGES||'captures';fs.mkdirSync(IMAGES,{recursive:true});
const erreurs=[];
async function nouvelle(b,nom){
  const ctx=await b.newContext({viewport:{width:412,height:915},locale:'fr-FR'});
  const p=await ctx.newPage();
  p.on('pageerror',e=>erreurs.push(nom+': '+e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))erreurs.push(nom+' console: '+m.text());});
  await p.goto(SITE);await p.waitForTimeout(300);
  return {ctx,p};
}
/* Depuis la page d'accueil publique (ou déjà sur les formulaires), ouvre l'onglet voulu. */
async function formulaire(p,quel){
  if(await p.isVisible('#vueBienvenue'))await p.click(quel==='inscription'?'#bvCommencer':'#bvConnexion');
  await p.click(quel==='inscription'?'#ongletInscription':'#ongletConnexion');
}
async function inscrire(p,d){
  await formulaire(p,'inscription');
  for(const [k,v] of Object.entries(d)) await p.fill('#i-'+k,v);
  await p.click('#btnInscription');await p.waitForTimeout(1200);
}
async function texte(p,sel){return (await p.textContent(sel)).trim();}
(async()=>{
  const b=await chromium.launch();
  // 1. Le responsable crée son compte et son assemblée
  const R=await nouvelle(b,'R');
  console.log('écran de départ (accueil public) :', await R.p.isVisible('#vueBienvenue'), '| bouton Commencer :', await R.p.isVisible('#bvCommencer'));
  await R.p.screenshot({path:IMAGES+'/00-accueil.png',fullPage:true});
  await R.p.screenshot({path:IMAGES+'/01-connexion.png'});
  await inscrire(R.p,{nom:'KOFFI',prenoms:'Rita',contact:'07 11 11 11 11',zone:'Abidjan',email:'rita@test.ci',mdp:'motdepasse1'});
  console.log('après inscription R :', await R.p.isVisible('#vueAccueil'), await texte(R.p,'#texteAccueil'));
  await R.p.screenshot({path:IMAGES+'/02-assemblee.png',fullPage:true});
  await R.p.click('summary:has-text("dirigeant")');await R.p.fill('#a-nom','Chez les Kouadio');await R.p.fill('#a-zone','Marcory');
  await R.p.click('#formCreerAssemblee button[type=submit]');await R.p.waitForTimeout(1500);
  const code=await texte(R.p,'#codeSuivi');
  console.log('R arrive sur :', R.p.url().split('#')[1], '| code :', code, '| titre :', await texte(R.p,'#titreSuivi'), '|', await texte(R.p,'#msgSuivi'));
  await R.p.screenshot({path:IMAGES+'/03-suivi-vide.png',fullPage:true});

  // 2. Le faiseur rejoint l'assemblée et choisit R comme faiseur
  const F=await nouvelle(b,'F');
  await inscrire(F.p,{nom:'YAO',prenoms:'Fred',contact:'07 22 22 22 22',zone:'Marcory',email:'fred@test.ci',mdp:'motdepasse2'});
  await F.p.fill('#a-code',code.toLowerCase());await F.p.click('#formRejoindre button[type=submit]');await F.p.waitForTimeout(1500);
  console.log('F étape faiseur :', await F.p.isVisible('#etapeFaiseur'), await texte(F.p,'#texteAccueil'));
  console.log('choix proposés à F :', await F.p.$$eval('#listeFaiseurs .mentor .nom',o=>o.map(x=>x.textContent).join(' | ')));
  await F.p.click('#listeFaiseurs .mentor:has-text("KOFFI Rita")');
  await F.p.click('#etapeFaiseur button[type=submit]');await F.p.waitForTimeout(1500);
  console.log('F arrive sur l\'accueil à deux choix :', await F.p.isVisible('#vueChoix'), '|', await texte(F.p,'#chSalut'));

  // 3. Le disciple rejoint, choisit F, remplit sa journée
  const D=await nouvelle(b,'D');
  await inscrire(D.p,{nom:'KONAN',prenoms:'Aya',contact:'07 33 33 33 33',zone:'Marcory',email:'aya@test.ci',mdp:'2580'});
  await D.p.fill('#a-code',code);await D.p.click('#formRejoindre button[type=submit]');await D.p.waitForTimeout(1500);
  await D.p.screenshot({path:IMAGES+'/04-faiseur.png',fullPage:true});
  await D.p.click('#listeFaiseurs .mentor:has-text("YAO Fred")');await D.p.click('#etapeFaiseur button[type=submit]');await D.p.waitForTimeout(1500);
  await D.p.screenshot({path:IMAGES+'/04b-choix.png'});
  console.log('accueil de D : barre du bas cachée :', !(await D.p.isVisible('.onglets-bas.nav-dieu')), '| cartes :', await D.p.$$eval('.choix-carte .choix-titre b',n=>n.map(x=>x.textContent).join(' / ')));
  await D.p.click('#choixDieu');await D.p.waitForTimeout(400);
  console.log('Relation avec Dieu → synthèse :', await D.p.isVisible('#vueSynthese'), '| barre Dieu :', await D.p.isVisible('.onglets-bas.nav-dieu'), '| barre Finances :', await D.p.isVisible('.onglets-bas.nav-fin'));
  await D.p.click('.onglets-bas [data-aller="jour"]');await D.p.waitForTimeout(400);
  await D.p.fill('#f-faiseur','15');await D.p.fill('#f-moi','45');await D.p.fill('#f-autre','20');await D.p.fill('#f-rdqd','30');await D.p.fill('#f-ev','2');await D.p.fill('#f-chapitres','4');
  await D.p.click('#btnJour');await D.p.waitForTimeout(4500);
  console.log('D après enregistrement :', await texte(D.p,'#msgJour'), '|', await texte(D.p,'#etatSynchro'), '| barre suivi visible :', await D.p.isVisible('#barreSuivi'));
  await D.p.screenshot({path:IMAGES+'/05-journee.png'});
  /* Rubriques : D ajoute « Prière de veille » (durée) et retire « Lecture chrétienne » */
  await D.p.click('[data-gerer="sec-prier"]');await D.p.waitForTimeout(300);
  await D.p.fill('#sec-prier .ajout-rubrique input','Prière de veille');await D.p.selectOption('#sec-prier .ajout-rubrique select','min');
  await D.p.click('#sec-prier [data-ajouter]');await D.p.waitForTimeout(400);
  const idVeille=await D.p.$eval('#sec-prier .rangee.ajoutee input',i=>i.id);
  await D.p.screenshot({path:IMAGES+'/05a-rubriques.png',fullPage:true});
  await D.p.click('[data-gerer="sec-prier"]');await D.p.waitForTimeout(300);
  await D.p.fill('#'+idVeille,'40');await D.p.click('#btnJour');await D.p.waitForTimeout(600);
  await D.p.click('[data-gerer="sec-mediter"]');await D.p.waitForTimeout(300);
  await D.p.click('[data-retirer="lc"]');await D.p.waitForTimeout(200);await D.p.click('#dialogueOui');await D.p.waitForTimeout(500);
  await D.p.click('[data-gerer="sec-mediter"]');await D.p.waitForTimeout(300);
  console.log('rubriques de D :', await D.p.isVisible('#'+idVeille), await D.p.inputValue('#'+idVeille), '| lecture chrétienne affichée :', await D.p.isVisible('#f-lc'), '| prière du jour :', await texte(D.p,'#jTotal'), '| saisies gardées :', await D.p.inputValue('#f-moi'));
  /* Chronomètre : lancé sur « Pour moi », 7 minutes simulées, puis arrêté */
  await D.p.click('[data-chrono="moi"]');await D.p.waitForTimeout(1300);
  console.log('chronomètre lancé :', await D.p.getAttribute('[data-chrono="moi"]','aria-pressed'), '| bandeau :', await D.p.isVisible('#chronoBandeau'), await texte(D.p,'#chronoNom'), await texte(D.p,'#chronoTemps'));
  await D.p.screenshot({path:IMAGES+'/05f-chrono.png'});
  await D.p.evaluate(()=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.endsWith(':chrono')){const c=JSON.parse(localStorage.getItem(k));c.debut-=7*60000;localStorage.setItem(k,JSON.stringify(c));}}});
  await D.p.click('.onglets-bas [data-aller="semaine"]');await D.p.waitForTimeout(500);
  console.log('bandeau sur une autre page :', await D.p.isVisible('#chronoBandeau'), await texte(D.p,'#chronoTemps'));
  await D.p.click('#chronoStop');await D.p.waitForTimeout(600);
  await D.p.click('.onglets-bas [data-aller="jour"]');await D.p.waitForTimeout(500);
  console.log('chronomètre arrêté : pour moi =', await D.p.inputValue('#f-moi'), '| bandeau caché :', !(await D.p.isVisible('#chronoBandeau')));
  await D.p.click('[data-chrono="faiseur"]');await D.p.waitForTimeout(400);await D.p.click('[data-chrono="faiseur"]');await D.p.waitForTimeout(400);
  console.log('arrêt immédiat :', await texte(D.p,'#msgJour'), '| faiseur =', await D.p.inputValue('#f-faiseur'));
  /* Objectifs : prière seul 00:30 par jour */
  await D.p.click('.onglets-bas [data-aller="semaine"]');await D.p.waitForTimeout(600);
  const scoreAvant=await texte(D.p,'#sScore');
  await D.p.click('#btnObjectifs');await D.p.fill('#o-priere','00:30');await D.p.click('#formObjectifs button[type=submit]');await D.p.waitForTimeout(600);
  console.log('objectifs de D : score', scoreAvant, '→', await texte(D.p,'#sScore'), '|', await D.p.$$eval('#sBilan .valeur',n=>n[0].textContent), '|', await texte(D.p,'#msgObjectifs'));
  await D.p.screenshot({path:IMAGES+'/05b-semaine.png'});
  await D.p.click('.onglets-bas [data-aller="mois"]');await D.p.waitForTimeout(600);await D.p.screenshot({path:IMAGES+'/05c-mois.png'});
  await D.p.click('.onglets-bas [data-aller="synthese"]');await D.p.waitForTimeout(600);
  console.log('synthèse de D :', await texte(D.p,'#syPriere'), '| RDQD', await texte(D.p,'#syRdqd'), '| EV', await texte(D.p,'#syEv'), '| légende', await D.p.$$eval('.sy-cle b',n=>n.map(x=>x.textContent).join(' ')));
  await D.p.screenshot({path:IMAGES+'/05e-synthese.png',fullPage:true});
  for(const per of ['jour','mois','annee']){await D.p.click('[data-periode="'+per+'"]');await D.p.waitForTimeout(250);}
  console.log('synthèse année :', await texte(D.p,'#syLabel'), '| barres', await D.p.$$eval('.sy-pile',n=>n.length));
  await D.p.click('.onglets-bas [data-aller="profil"]');await D.p.waitForTimeout(600);
  await D.p.setInputFiles('#fichierPhoto2',require('path').join(__dirname,'photo-test.jpg'));await D.p.waitForTimeout(2500);
  console.log('photo de D :', await texte(D.p,'#msgPhoto'), '| en-tête avec photo :', await D.p.$eval('#avatarEntete',e=>e.classList.contains('photo')), '| taille :', await D.p.evaluate(()=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.endsWith('profil/photo'))return localStorage.getItem(k).length;}return 0;}));
  await D.p.screenshot({path:IMAGES+'/05d-profil-photo.png'});
  await D.p.click('.onglets-bas [data-aller="jour"]');await D.p.waitForTimeout(400);


  // 3 bis. Finances de D
  await D.p.click('.entete .logo-accueil');await D.p.waitForTimeout(400);
  console.log('retour à l\'accueil par le logo :', await D.p.isVisible('#vueChoix'), '| prière du jour sur la carte :', await texte(D.p,'#chPriere'), '| reste :', await texte(D.p,'#chReste'));
  await D.p.click('#choixFinance');await D.p.waitForTimeout(500);
  console.log('Finances, vide :', await texte(D.p,'#fReste'), '| barre Finances :', await D.p.isVisible('.onglets-bas.nav-fin'), '| barre Dieu :', await D.p.isVisible('.onglets-bas.nav-dieu'));
  await D.p.fill('#fr-salaire','500 000');await D.p.fill('#fr-autres','20000');await D.p.click('#btnRevenus');await D.p.waitForTimeout(400);
  console.log('revenus :', await texte(D.p,'#msgRevenus'), '|', await texte(D.p,'#fRevenus'), '| objectif dons :', await D.p.$$eval('#fObjectifs small',n=>n[0].textContent));
  await D.p.click('#fabDepense');await D.p.waitForTimeout(400);
  const depenses=[['130000','Dîme et offrande','Dons au Seigneur','1'],['11500','Poisson','Nourriture','1'],['1700','Taxi','Transport','2'],['500','Quête','Offrandes & quêtes','2'],['175000','Épargne du mois','Épargne','3'],['8500','Restaurant','Nourriture','3']];
  for(const [mt,ds,cat,j] of depenses){
    await D.p.fill('#d-montant',mt);await D.p.fill('#d-desc',ds);await D.p.selectOption('#d-cat',{label:cat});await D.p.selectOption('#d-jour',j);
    await D.p.click('#btnDepense');await D.p.waitForTimeout(250);
  }
  console.log('dépenses :', await texte(D.p,'#msgDepense'), '|', await texte(D.p,'#dCompte'), await texte(D.p,'#dTotal'));
  await D.p.fill('#d-montant','-5');await D.p.click('#btnDepense');await D.p.waitForTimeout(200);
  console.log('montant refusé :', await texte(D.p,'#msgDepense'));
  await D.p.click('.fin-dep:has-text("Restaurant") [data-modifier]');await D.p.waitForTimeout(300);
  console.log('modification : titre', await texte(D.p,'#titreFormDepense'), '| montant', await D.p.inputValue('#d-montant'));
  await D.p.fill('#d-montant','9000');await D.p.click('#btnDepense');await D.p.waitForTimeout(300);
  await D.p.click('.fin-dep:has-text("Taxi") [data-supprimer]');await D.p.waitForTimeout(300);
  console.log('dialogue suppression :', await texte(D.p,'#dialogueTexte'));await D.p.click('#dialogueOui');await D.p.waitForTimeout(400);
  await D.p.click('[data-filtre-cat]:has-text("Nourriture")');await D.p.waitForTimeout(250);
  console.log('filtre Nourriture :', await texte(D.p,'#dCompte'), await texte(D.p,'#dTotal'));
  await D.p.click('[data-filtre-cat=""]');await D.p.waitForTimeout(250);
  console.log('toutes :', await texte(D.p,'#dCompte'), await texte(D.p,'#dTotal'));
  await D.p.evaluate(()=>scrollTo(0,0));await D.p.waitForTimeout(150);await D.p.screenshot({path:IMAGES+'/13-depenses.png'});await D.p.screenshot({path:IMAGES+'/13-depenses-long.png',fullPage:true});
  await D.p.click('.onglets-bas [data-aller="finance"]');await D.p.waitForTimeout(500);
  console.log('tableau de bord : reste', await texte(D.p,'#fReste'), '| dépenses du mois', await texte(D.p,'#fDepenses'), '| dons', await texte(D.p,'#fDons'), await texte(D.p,'#fDonsSous'), '| épargne', await texte(D.p,'#fEpargne'));
  await D.p.evaluate(()=>scrollTo(0,0));await D.p.waitForTimeout(150);await D.p.screenshot({path:IMAGES+'/12-finance.png'});await D.p.screenshot({path:IMAGES+'/12-finance-long.png',fullPage:true});
  await D.p.click('.onglets-bas [data-aller="budgets"]');await D.p.waitForTimeout(400);
  console.log('budgets :', await D.p.$$eval('#bDons .fin-statut',n=>n.map(x=>x.textContent).join(',')), '|', await texte(D.p,'#bDonsNote'), '|', await texte(D.p,'#bEpargneNote'));
  await D.p.evaluate(()=>scrollTo(0,0));await D.p.waitForTimeout(150);await D.p.screenshot({path:IMAGES+'/14-budgets.png'});await D.p.screenshot({path:IMAGES+'/14-budgets-long.png',fullPage:true});
  await D.p.click('.onglets-bas [data-aller="finreglages"]');await D.p.waitForTimeout(400);
  await D.p.fill('#r-epargne','200000');await D.p.fill('#r-nouvelle','Internet');await D.p.fill('#r-nouvelleBudget','10000');await D.p.click('#btnNouvelleCat');
  await D.p.fill('#r-paiement','Wave');await D.p.click('#btnPaiement');
  await D.p.fill('[aria-label="Budget de Nourriture"]','60 000');
  await D.p.click('#btnFinReglages');await D.p.waitForTimeout(400);
  console.log('réglages :', await texte(D.p,'#msgFinReglages'), '| catégories', await D.p.$$eval('#rCategories [data-cat-nom]',n=>n.length), '| paiements', await D.p.$$eval('.fin-puce',n=>n.map(x=>x.textContent).join(',')));
  await D.p.evaluate(()=>scrollTo(0,0));await D.p.waitForTimeout(150);await D.p.screenshot({path:IMAGES+'/16-reglages.png'});await D.p.screenshot({path:IMAGES+'/16-reglages-long.png',fullPage:true});
  await D.p.click('.onglets-bas [data-aller="budgets"]');await D.p.waitForTimeout(400);
  console.log('budget nourriture après réglage :', await D.p.$$eval('#bCourantes .fin-budget',n=>n.filter(x=>/Nourriture/.test(x.textContent)).map(x=>x.querySelector('.fin-budget-pied').textContent).join('')), '| épargne :', await texte(D.p,'#bEpargneNote'));
  await D.p.click('.onglets-bas [data-aller="bilan"]');await D.p.waitForTimeout(500);
  console.log('bilan :', (await texte(D.p,'#bTuiles')).replace(/\s+/g,' '), '| lignes', await D.p.$$eval('#bTable tbody tr',n=>n.length));
  await D.p.evaluate(()=>scrollTo(0,0));await D.p.waitForTimeout(150);await D.p.screenshot({path:IMAGES+'/15-bilan.png'});await D.p.screenshot({path:IMAGES+'/15-bilan-long.png',fullPage:true});
  await D.p.click('.onglets-bas [data-aller="finreglages"]');await D.p.waitForTimeout(300);
  await D.p.setInputFiles('#fichierExcel',require('path').join(__dirname,'..','donnees','exemple-depenses.xlsx'));await D.p.waitForTimeout(1200);
  console.log('import, question :', await texte(D.p,'#dialogueTexte'));
  await D.p.click('#dialogueOui');await D.p.waitForTimeout(600);
  console.log('import :', await texte(D.p,'#msgImport'), '| paiements', await D.p.$$eval('.fin-puce',n=>n.map(x=>x.textContent).join(',')));
  await D.p.click('.onglets-bas [data-aller="finance"]');await D.p.waitForTimeout(400);
  console.log('mois importé :', await D.p.$eval('#vueFinance .fin-mois-nom',e=>e.textContent), '| reste', await texte(D.p,'#fReste'));
  await D.p.waitForTimeout(3500);
  console.log('synchro finances :', await texte(D.p,'#etatSynchro'));
  await D.p.click('.entete .logo-accueil');await D.p.waitForTimeout(300);
  await D.p.click('#choixDieu');await D.p.waitForTimeout(300);
  await D.p.click('.onglets-bas [data-aller="jour"]');await D.p.waitForTimeout(400);

  // 4. F voit son disciple
  await F.p.reload();await F.p.waitForTimeout(2000);
  if(await F.p.isVisible('#vueChoix'))await F.p.click('#choixDieu');await F.p.waitForTimeout(300);
  console.log('barre suivi chez F :', await F.p.isVisible('#barreSuivi'), await texte(F.p,'#barreSuivi'));
  await F.p.click('.onglets-bas [data-aller="suivi"]');await F.p.waitForTimeout(1800);
  console.log('suivi F :', await texte(F.p,'#titreSuivi'), '|', await F.p.$$eval('.personne .nom',n=>n.map(x=>x.textContent).join(', ')), '|', await F.p.$$eval('.personne .score',n=>n.map(x=>x.textContent).join(', ')), '| filtre visible :', await F.p.isVisible('#filtreSuivi'));
  console.log('F voit la photo de D :', await F.p.$eval('.personne .avatar',e=>e.classList.contains('photo')));
  await F.p.screenshot({path:IMAGES+'/06-suivi-faiseur.png',fullPage:true});
  await F.p.click('.personne button:has-text("PDF semaine")');await F.p.waitForTimeout(600);
  console.log('aperçu PDF de D chez F :', await F.p.isVisible('#apercu'), (await texte(F.p,'#feuille .r-identite')).replace(/\s+/g,' '));
  await F.p.screenshot({path:IMAGES+'/07-pdf-disciple.png'});
  const [tele]=await Promise.all([F.p.waitForEvent('download',{timeout:20000}),F.p.click('#pdfPartager')]);
  const chemin=IMAGES+'/'+tele.suggestedFilename();await tele.saveAs(chemin);
  const octets=fs.readFileSync(chemin);
  console.log('PDF téléchargé :', tele.suggestedFilename(), '|', octets.length, 'octets | entête', octets.slice(0,5).toString(), '|', await texte(F.p,'#msgPartage'));
  await F.p.click('#fermerApercu');await F.p.waitForTimeout(500);
  await F.p.click('.personne button:has-text("PDF ")>>nth=1');await F.p.waitForTimeout(1200);
  console.log('aperçu mois de D :', await F.p.isVisible('#apercu'), (await texte(F.p,'#feuille .r-titre')));
  await F.p.click('#fermerApercu');await F.p.waitForTimeout(500);

  // 5. R voit toute l'assemblée et nomme F responsable
  await R.p.goto(SITE+'#jour');await R.p.reload();await R.p.waitForTimeout(1800);
  await R.p.click('.onglets-bas [data-aller="suivi"]');await R.p.waitForTimeout(1500);
  console.log('filtre par défaut du responsable :', await R.p.getAttribute('[data-filtre="assemblee"]','aria-selected'));
  await R.p.click('[data-filtre="disciples"]');await R.p.waitForTimeout(1500);
  console.log('R, mes disciples :', await R.p.$$eval('.personne .nom',n=>n.map(x=>x.textContent).join(', ')));
  await R.p.click('[data-filtre="assemblee"]');await R.p.waitForTimeout(1500);
  console.log('R, assemblée :', await R.p.$$eval('.personne .nom',n=>n.map(x=>x.textContent).join(', ')), '|', await R.p.$$eval('.personne .sous',n=>n.map(x=>x.textContent).join(' / ')));
  console.log('tuiles R :', (await texte(R.p,'#suTuiles')).replace(/\s+/g,' '));
  await R.p.screenshot({path:IMAGES+'/08-suivi-assemblee.png',fullPage:true});
  const carteF=R.p.locator('.personne:has(.nom:text-is("YAO Fred"))');
  await carteF.locator('summary').click();await carteF.locator('button:has-text("Nommer dirigeant")').click();await R.p.waitForTimeout(300);
  console.log('dialogue :', await texte(R.p,'#dialogueTexte'));
  await R.p.click('#dialogueOui');await R.p.waitForTimeout(1800);
  console.log('après nomination :', await R.p.$$eval('.personne .nom',n=>n.map(x=>x.textContent).join(', ')));

  // 6. D sur un deuxième appareil, puis hors connexion
  const D2=await nouvelle(b,'D2');
  console.log('onglet par défaut sur un nouvel appareil :', await D2.p.getAttribute('#onglets2','data-actif'));
  await formulaire(D2.p,'connexion');
  await D2.p.fill('#c-email','aya@test.ci');await D2.p.fill('#c-mdp','faux-mot');await D2.p.click('#btnConnexion');await D2.p.waitForTimeout(800);
  console.log('mauvais mot de passe :', await texte(D2.p,'#msgConnexion'));
  await D2.p.fill('#c-mdp','2580');await D2.p.click('#btnConnexion');await D2.p.waitForTimeout(2500);
  if(await D2.p.isVisible('#vueChoix')){console.log('2e appareil, accueil :', await texte(D2.p,'#chReste'));await D2.p.click('#choixFinance');await D2.p.waitForTimeout(400);console.log('2e appareil, finances retrouvées :', await D2.p.$eval('#vueFinance .fin-mois-nom',e=>e.textContent), await D2.p.$$eval('.onglets-bas [data-aller="depenses"]',n=>n.length));await D2.p.click('.entete .logo-accueil');await D2.p.click('#choixDieu');await D2.p.waitForTimeout(400);}
  await D2.ctx.setOffline(true);
  await D2.p.click('.onglets-bas [data-aller="jour"]');await D2.p.waitForTimeout(400);
  console.log('2e appareil, journée retrouvée :', await D2.p.inputValue('#f-moi'), await D2.p.inputValue('#f-ev'));
  console.log('2e appareil, rubriques :', await D2.p.$$eval('#sec-prier .rangee.ajoutee .libelle',n=>n.map(x=>x.firstChild.textContent).join(',')), '| lecture chrétienne :', await D2.p.$$eval('#f-lc',n=>n.length));
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

  /* ----- Inscription avec Google ----- */
  const G=await nouvelle(b,'G');
  await formulaire(G.p,'inscription');await G.p.click('#googleInscription');await G.p.waitForSelector('#etapeIdentite:not([hidden])',{timeout:8000});
  console.log('Google, étape identité :', await texte(G.p,'#kickerAccueil'), '|', await G.p.inputValue('#g-nom'), '|', await G.p.inputValue('#g-prenoms'), '| adresse propre :', !/access_token/.test(G.p.url()));
  await G.p.screenshot({path:IMAGES+'/10-google-identite.png',fullPage:true});
  await G.p.fill('#g-contact','07 44 44 44 44');await G.p.fill('#g-zone','Yamoussoukro');
  await G.p.click('#etapeIdentite button[type=submit]');await G.p.waitForTimeout(1500);
  console.log('Google, étape suivante :', await texte(G.p,'#kickerAccueil'));
  await G.p.fill('#a-code',code);await G.p.click('#formRejoindre button[type=submit]');await G.p.waitForTimeout(1500);
  console.log('Google, choix du faiseur :', await G.p.isVisible('#etapeFaiseur'));
  await G.p.click('#faiseurPlusTard');await G.p.waitForTimeout(800);
  console.log('Google, arrivée :', await G.p.isVisible('#vueChoix'));
  await G.ctx.close();
  /* Reconnexion avec Google sur un autre appareil : pas de nouvelle question. */
  const G2=await nouvelle(b,'G2');
  await formulaire(G2.p,'connexion');await G2.p.click('#googleConnexion');await G2.p.waitForTimeout(2000);
  console.log('Google, 2e appareil :', await G2.p.isVisible('#vueChoix'), await G2.p.isVisible('#vueAccueil')?await texte(G2.p,'#kickerAccueil'):'', '|', await texte(G2.p,'#nomLateral'));

  const Z=await nouvelle(b,'Z');
  await inscrire(Z.p,{nom:'ZADI',prenoms:'Marc',contact:'0909',zone:'Bouaké',email:'zadi@test.ci',mdp:'4321'});
  await Z.p.click('summary:has-text("dirigeant")');await Z.p.fill('#a-nom','Assemblée de Bouaké');await Z.p.click('#formCreerAssemblee button[type=submit]');await Z.p.waitForTimeout(1500);
  await Z.p.click('.onglets-bas [data-aller="profil"]');await Z.p.waitForTimeout(1500);
  const codeZ=await texte(Z.p,'#monCodeFaiseur');
  console.log('code de faiseur de Z :', codeZ.length, 'caractères');
  await G2.p.click('#voletCodeFaiseur summary');await G2.p.fill('#f-code',codeZ.toLowerCase());await G2.p.click('#btnCodeFaiseur');await G2.p.waitForTimeout(2500);
  console.log('G choisit Z (autre assemblée) à l\'étape 3 :', await G2.p.isVisible('#vueChoix'));
  await G2.p.click('#choixDieu');await G2.p.waitForTimeout(300);
  await G2.p.click('.onglets-bas [data-aller="profil"]');await G2.p.waitForTimeout(1500);
  console.log('profil de G :', await texte(G2.p,'#faiseurActuel'), '|', await G2.p.$eval('#pf-choix',s=>s.options[s.selectedIndex].textContent));
  await Z.p.reload();await Z.p.waitForTimeout(2000);
  await Z.p.click('.onglets-bas [data-aller="suivi"]');await Z.p.waitForTimeout(2000);
  await Z.p.click('[data-filtre="disciples"]');await Z.p.waitForTimeout(1500);
  console.log('Z voit son disciple :', await Z.p.$$eval('.personne .nom',n=>n.map(x=>x.textContent).join(', ')), '|', await Z.p.$$eval('.personne .sous',n=>n.map(x=>x.textContent).join(' / ')));
  await Z.p.screenshot({path:IMAGES+'/11-faiseur-autre-assemblee.png',fullPage:true});
  await R.p.reload();await R.p.waitForTimeout(2000);await R.p.click('.onglets-bas [data-aller="suivi"]');await R.p.waitForTimeout(2000);
  console.log('R (dirigeant) voit G et son faiseur :', await R.p.$$eval('.personne',n=>n.filter(x=>/BROU/.test(x.textContent)).map(x=>x.querySelector('.sous').textContent).join('')));

  /* Grand écran (ordinateur) */
  await D2.p.setViewportSize({width:1366,height:860});
  for(const [v,n] of [['choix','20-ordi-accueil'],['finance','21-ordi-finances'],['synthese','22-ordi-synthese'],['jour','23-ordi-journee'],['bilan','24-ordi-bilan']]){
    await D2.p.evaluate(h=>{location.hash='#'+h;},v);await D2.p.waitForTimeout(700);await D2.p.screenshot({path:IMAGES+'/'+n+'.png'});
  }
  console.log('erreurs de page :', JSON.stringify(erreurs));
  await b.close();
})().catch(e=>{console.error('ÉCHEC', e.message);process.exit(1);});
