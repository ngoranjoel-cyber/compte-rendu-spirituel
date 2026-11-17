/* Compte rendu spirituel : écrans, navigation, saisie, synchronisation, impression. */
(function(){
"use strict";
var XL=self.CompteRenduXL,RP=self.CompteRenduRapport;
var MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
var MOIS_C=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
var JOURS=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
var JOURS_L=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
/* Les rangées de « Ma journée » : champ, libellé, icône, couleur, type (min, n, b, h), unité, sigle */
var SECTIONS_JOUR=[
  {id:"sec-prier",titre:"Prier",icone:"heart",couleur:"rose",aide:"en minutes",lignes:[
    ["faiseur","Pour mon faiseur","user-check","violet","min","min","de disciple"],
    ["moi","Pour moi","user","bleu","min","min",""],
    ["autre","Pour les autres","users","vert","min","min",""],
    ["pg","Prière de groupe","group","orange","min","min","PG"]]},
  {id:"sec-mediter",titre:"Méditer",icone:"book-open",couleur:"bleu",aide:"",lignes:[
    ["rdqd","Rendez-vous avec Dieu","sun","bleu","min","min","RDQD"],
    ["chapitres","Chapitres lus","book","violet","n","chap.","Bible"],
    ["lectureMin","Lecture biblique","book-open","vert","min","min","temps"],
    ["lc","Lecture chrétienne","bookmark","orange","min","min","LC"]]},
  {id:"sec-precher",titre:"Prêcher",icone:"megaphone",couleur:"vert",aide:"",lignes:[
    ["ev","Évangélisés","megaphone","rose","n","pers.","EV · personnes"]]},
  {id:"sec-autres",titre:"Jeûne et repos",icone:"moon",couleur:"violet",aide:"",lignes:[
    ["jc","Jeûne complet","flame","rose","b","","JC"],
    ["jp","Jeûne partiel","drop","orange","b","","JP"],
    ["rs","RS","clock","ardoise","min","min",""],
    ["sommeil","Sommeil","moon","violet","h","","heures : minutes"]]}
];
var CHAMPS=[];SECTIONS_JOUR.forEach(function(s){s.lignes.forEach(function(l){CHAMPS.push([l[0],l[4]]);});});
var PROFIL_LOCAL=["nom","prenoms","contact","zone","assemblee","faiseur"];
var DONS_DEFAUT=[{nom:"Dîme",pct:10},{nom:"FMI",pct:0.5},{nom:"FMN",pct:0.5},{nom:"FE"},{nom:"FG"},{nom:"RTVC"}];
var PASTELS=["bleu","violet","vert","orange","rose"];
var natif=window.Android||null;
var $=function(id){return document.getElementById(id);};
function pad(n){return (n<10?"0":"")+n;}
var cleJour=XL.cle;
function cleMois(a,m){return a+"-"+pad(m);}
var hm=RP.hm;
function n0(v){var n=Number(v);return isFinite(n)?n:0;}
function el(tag,attrs,txt){var e=document.createElement(tag);for(var k in attrs||{})e.setAttribute(k,attrs[k]);if(txt!==undefined)e.textContent=txt;return e;}
var SVG="http://www.w3.org/2000/svg";
function icone(nom){var s=document.createElementNS(SVG,"svg");s.setAttribute("class","ic");s.setAttribute("aria-hidden","true");var u=document.createElementNS(SVG,"use");u.setAttribute("href","#i-"+nom);s.appendChild(u);return s;}
function pastille(nom,couleur,petit){var s=el("span",{"class":"pic "+couleur+(petit?" petit":"")});s.appendChild(icone(nom));return s;}
function dire(id,txt,genre){$(id).textContent=txt||"";$(id).className="msg"+(genre==="err"||genre===true?" err":genre==="ok"?" ok":"");}
function maj(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function nomComplet(p){return ((p&&p.nom||"")+" "+(p&&p.prenoms||"")).trim();}
function initiales(p){var a=(p&&p.prenoms||"").trim().charAt(0),b=(p&&p.nom||"").trim().charAt(0);return ((a||"")+(b||"")).toUpperCase()||"?";}
function couleurDe(t){var h=0;t=String(t||"");for(var i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))>>>0;return PASTELS[h%PASTELS.length];}
function occuper(bouton,promesse){
  bouton.disabled=true;
  return promesse.then(function(r){bouton.disabled=false;return r;},function(e){bouton.disabled=false;throw e;});
}

/* ---------- Compte en ligne (si config.js est rempli) ---------- */
var C=self.CompteEnLigne.creer({config:window.CONFIG_COMPTE||{},stockage:window.localStorage,fetch:function(u,o){return window.fetch(u,o);}});
var enLigne=C.actif;

/* ---------- Stockage sur l'appareil (une zone par compte) ---------- */
function racine(){var s=enLigne&&C.session();return s?"crs:"+s.id+":":"crs:";}
function lire(k){try{var v=localStorage.getItem(racine()+k);return v?JSON.parse(v):null;}catch(e){return null;}}
function ecrireLocal(k,v){localStorage.setItem(racine()+k,JSON.stringify(v));}
/* Enregistre sur l'appareil, puis programme l'envoi au serveur. */
function ecrire(k,v){ecrireLocal(k,v);if(enLigne&&C.session()){C.noter(k);planifierSynchro(2500);}}
var magasin={lire:lire,ecrire:function(k,v){try{ecrireLocal(k,v);}catch(e){}}};
function essayer(msgId,f,ok){
  try{f();if(ok)dire(msgId,ok,"ok");return true;}
  catch(e){dire(msgId,"L'enregistrement a échoué : la mémoire de l'appareil est pleine.","err");return false;}
}
function donneesJour(d){return lire("jours/"+cleJour(d));}

/* ---------- État ---------- */
var auj=new Date();auj.setHours(12,0,0,0);
var jour=new Date(auj);
var vueM={a:auj.getFullYear(),m:auj.getMonth()+1};
var profil=lire("reglages/profil");
var serveur={profil:null,assemblee:null,membres:[],charge:false};
var formSale=false,minuterieJour=null;
var lienRecuperation=false;

function inscrit(){return !!(profil&&profil.nom);}
function etat(d){
  d=d||{};
  var priere=n0(d.faiseur)+n0(d.moi)+n0(d.autre)+n0(d.pg);
  var e={prier:priere>0,mediter:n0(d.rdqd)>0,precher:n0(d.ev)>0,priere:priere};
  e.nb=(e.prier?1:0)+(e.mediter?1:0)+(e.precher?1:0);
  return e;
}
function niveau(d){if(!d)return "";var e=etat(d);return e.nb===3?"complet":e.nb>0||Object.keys(d).length>1?"partiel":"";}
function signalerNatif(k,d){
  if(!natif)return;
  var e=etat(d);
  try{natif.marquerJour(k,e.prier,e.mediter,e.precher);}catch(err){}
}
/* La semaine (lundi à dimanche) qui contient une date, avec son numéro dans le mois de cette date. */
function semaineDe(d){
  var liste=XL.semainesDuMois(d.getFullYear(),d.getMonth()+1),k=cleJour(XL.lundiDe(d));
  for(var i=0;i<liste.length;i++)if(cleJour(liste[i].lundi)===k)return liste[i];
  return liste[0];
}
function libelleSemaine(s){
  var deb=s.jours[0],fin=s.jours[6];
  return "Du "+deb.getDate()+(deb.getMonth()!==fin.getMonth()?" "+MOIS[deb.getMonth()]:"")+" au "+fin.getDate()+" "+MOIS[fin.getMonth()]+" · semaine "+s.numero;
}

/* ---------- Fenêtre de confirmation ---------- */
function confirmer(titre,texte,libelle){
  var d=$("dialogue");
  $("dialogueTitre").textContent=titre;$("dialogueTexte").textContent=texte;$("dialogueOui").textContent=libelle||"Confirmer";
  return new Promise(function(ok){
    function fin(){d.removeEventListener("close",fin);ok(d.returnValue==="oui");}
    d.returnValue="";d.addEventListener("close",fin);
    if(typeof d.showModal==="function")d.showModal();else ok(true);
  });
}

/* ---------- Synchronisation ---------- */
var minuterie=null;
function planifierSynchro(delai){clearTimeout(minuterie);minuterie=setTimeout(synchroniser,delai);}
function synchroniser(){
  if(!enLigne||!C.session())return Promise.resolve();
  majEtatSynchro("encours");
  return C.synchroniser(magasin).then(function(b){
    majEtatSynchro();
    if(b.recus&&!formSale&&$("apercu").hidden)rafraichirVue();
  },function(e){majEtatSynchro(e);});
}
function heureCourte(iso){var d=new Date(iso);return isNaN(d)?"":pad(d.getHours())+":"+pad(d.getMinutes());}
function majEtatSynchro(info){
  var ids=["etatSynchro","etatSynchroProfil","etatSynchroLateral"];
  if(!enLigne||!C.session()){ids.forEach(function(id){$(id).hidden=true;});return;}
  var n=C.enAttente(),der=C.derniereSynchro(),t,c="";
  if(info&&info.code==="reseau"||navigator.onLine===false){t="Hors connexion"+(n?" : "+n+" saisie"+(n>1?"s":"")+" à envoyer":" : vos saisies sont gardées sur l'appareil");c="horsligne";}
  else if(info&&info.message){t="Synchronisation impossible : "+info.message;c="err";}
  else if(info==="encours"||n){t=n?n+" saisie"+(n>1?"s":"")+" en cours d'envoi":"Synchronisation…";c="attente";}
  else t=der?"Synchronisé à "+heureCourte(der):"Synchronisé";
  ids.forEach(function(id){$(id).textContent=t;$(id).className="synchro "+c;$(id).hidden=false;});
}

/* ---------- Compte : profil, assemblée, membres ---------- */
function construireProfil(){
  var p=serveur.profil||{},a=serveur.assemblee,f=null;
  serveur.membres.forEach(function(m){if(m.id===p.faiseur_id)f=m;});
  var disciples=serveur.membres.filter(function(m){return m.faiseur_id===p.id;}).length;
  profil={id:p.id,nom:p.nom||"",prenoms:p.prenoms||"",contact:p.contact||"",zone:p.zone||"",
    assemblee:(a&&a.nom)||p.assemblee_nom||"",assembleeLiee:!!p.assemblee_id,
    faiseur:f?nomComplet(f):(p.faiseur_nom||""),faiseurId:p.faiseur_id||null,
    role:p.role||"membre",disciples:disciples,code:(a&&a.code)||""};
  magasin.ecrire("reglages/profil",profil);
}
function chargerCompte(){
  return Promise.all([C.monProfil(),C.assemblee.mienne()]).then(function(r){
    serveur.profil=r[0];serveur.assemblee=r[1];
    if(!serveur.profil)throw new Error("Profil introuvable. Réessayez dans un instant.");
    return serveur.profil.assemblee_id?C.assemblee.membres():[];
  }).then(function(m){serveur.membres=m||[];serveur.charge=true;construireProfil();majIdentite();});
}
/* Étape à afficher avant l'application : null si tout est prêt. */
function etapeAccueil(){
  if(!enLigne)return inscrit()?null:"profil";
  if(!C.session())return "connexion";
  if(!profil||!profil.id)return "chargement";
  if(!profil.assemblee)return "assemblee";
  if(profil.assembleeLiee&&!profil.faiseur&&profil.role!=="responsable"&&!lire("reglages/faiseurPlusTard"))return "faiseur";
  return null;
}
function demarrerSession(){
  profil=lire("reglages/profil");
  route();
  chargerCompte().then(function(){route();},function(e){
    if(!profil||!profil.id){dire("msgChargement",e.message,"err");$("reessayerChargement").hidden=false;}
  }).then(function(){return synchroniser();});
}
function suiviPermis(){return !!(enLigne&&profil&&(profil.role==="responsable"||profil.disciples>0));}
/* Nom, initiales, assemblée et entrée « disciples » dans les menus. */
function majIdentite(){
  var p=profil||{},ini=initiales(p),coul=couleurDe(nomComplet(p));
  ["avatarEntete","avatarLateral"].forEach(function(id){$(id).textContent=ini;$(id).className="avatar"+(id==="avatarLateral"?" petit ":" ")+coul;});
  $("nomLateral").textContent=nomComplet(p)||"Mon profil";
  $("assembleeLaterale").textContent=p.assemblee||"";
  var s=suiviPermis(),titre=p.role==="responsable"?"Mon assemblée":"Mes disciples";
  Array.prototype.forEach.call(document.querySelectorAll(".nav-suivi"),function(b){b.hidden=!s;});
  Array.prototype.forEach.call(document.querySelectorAll(".nom-suivi"),function(e){e.textContent=e.closest(".onglets-bas")?(p.role==="responsable"?"Assemblée":"Disciples"):titre;});
}

/* ---------- Vue : connexion ---------- */
function montrerFormConnexion(quel){
  $("formConnexion").hidden=quel!=="connexion";$("formOubli").hidden=quel!=="oubli";$("formInscription").hidden=quel!=="inscription";
  $("ongletConnexion").setAttribute("aria-selected",String(quel!=="inscription"));
  $("ongletInscription").setAttribute("aria-selected",String(quel==="inscription"));
  $("onglets2").setAttribute("data-actif",quel==="inscription"?"inscription":"connexion");
}
var MIN_MDP=C.MIN_MOT_DE_PASSE||4;
function memoriserConnexion(){
  try{
    localStorage.setItem("crs:dejaConnecte","1");
    if($("c-rester").checked)localStorage.removeItem("crs:sessionTemporaire");
    else{localStorage.setItem("crs:sessionTemporaire","1");sessionStorage.setItem("crs:ouvert","1");}
  }catch(e){}
}
/* Jauge du mot de passe : 4 caractères suffisent, plus long et varié c'est mieux. */
function majForceMdp(v){
  var n=v.length,score=0,lettres=/[a-zA-Z]/.test(v),chiffres=/\d/.test(v),autres=/[^A-Za-z0-9]/.test(v)||(/[a-z]/.test(v)&&/[A-Z]/.test(v));
  if(n>0)score=n<MIN_MDP?1:2;
  if(n>=6&&lettres&&chiffres)score=3;
  if(n>=8&&lettres&&chiffres&&autres)score=4;
  var niveaux=[["","#8e8b82",""],["Trop court","#b45309","#d97706"],["Correct","#b45309","#f59e0b"],["Bon","#047857","#059669"],["Excellent","#14532d","#14532d"]];
  $("forceMdp").textContent=niveaux[score][0];$("forceMdp").style.color=niveaux[score][1];
  Array.prototype.forEach.call($("jaugeMdp").children,function(b,i){b.style.background=i<score?niveaux[score][2]:"";});
}

/* Colonne photo des pages de connexion : trois piliers qui défilent toutes les 7 secondes. */
var PILIERS=[
  {kicker:"Discipline quotidienne",vignette:"Notez votre journée en quelques gestes",
   texte:"Notez votre journée en quelques gestes : temps de prière, méditation biblique et évangélisation enregistrés instantanément.",
   photo:"https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=85",
   mini:"https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80"},
  {kicker:"Archivage et édition",vignette:"Imprimez la semaine et le mois en PDF",
   texte:"Imprimez la semaine et le mois en PDF : des bilans clairs, mis en page avec soin pour vos temps de retraite et de partage.",
   photo:"https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1200&q=85",
   mini:"https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=400&q=80"},
  {kicker:"Accompagnement fraternel",vignette:"Votre faiseur de disciple suit vos progrès",
   texte:"Votre faiseur de disciple suit vos progrès semaine après semaine et vous aide à grandir dans la régularité.",
   photo:"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=85",
   mini:"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80"}
];
var pilier=0,minuteriePiliers=null;
function cacherSiErreur(img){img.addEventListener("error",function(){img.style.visibility="hidden";});}
function construireHeros(){
  Array.prototype.forEach.call(document.querySelectorAll(".auth2-hero"),function(h){
    var img=el("img",{"class":"hero-img zoom",alt:"",src:PILIERS[0].photo});cacherSiErreur(img);h.appendChild(img);
    h.appendChild(el("div",{"class":"hero-voile"}));
    var haut=el("div",{"class":"hero-haut"}),badge=el("div",{"class":"hero-badge"});
    var lg=document.createElementNS(SVG,"svg");lg.setAttribute("aria-hidden","true");var u=document.createElementNS(SVG,"use");u.setAttribute("href","#logo-crs");lg.appendChild(u);
    badge.appendChild(lg);badge.appendChild(el("span",{},"Compte rendu spirituel"));haut.appendChild(badge);
    haut.appendChild(el("span",{"class":"hero-compteur"},"01 / 03"));h.appendChild(haut);
    var bas=el("div",{"class":"hero-bas"});
    bas.appendChild(el("p",{"class":"hero-kicker"},PILIERS[0].kicker));
    var t=el("h1",{"class":"hero-titre"});t.appendChild(document.createTextNode("Votre vie de prière, "));t.appendChild(el("em",{},"jour après jour,"));t.appendChild(document.createTextNode(" sur tous vos appareils."));
    bas.appendChild(t);bas.appendChild(el("p",{"class":"hero-desc"},PILIERS[0].texte));
    var v=el("div",{"class":"vignettes",role:"tablist","aria-label":"Ce que permet l'application"});
    PILIERS.forEach(function(p,i){
      var b=el("button",{type:"button","class":"vignette"+(i===0?" active":""),"data-pilier":String(i),role:"tab","aria-selected":String(i===0)});
      var cadre=el("div",{"class":"vimg"}),mi=el("img",{src:p.mini,alt:"",loading:"lazy"});cacherSiErreur(mi);cadre.appendChild(mi);b.appendChild(cadre);
      b.appendChild(el("p",{},p.vignette));var piste=el("span",{"class":"piste"});piste.appendChild(el("i"));b.appendChild(piste);
      b.addEventListener("click",function(){activerPilier(i);});
      v.appendChild(b);
    });
    bas.appendChild(v);h.appendChild(bas);
  });
  relancerPiliers();
}
function activerPilier(i){
  pilier=i;var p=PILIERS[i];
  Array.prototype.forEach.call(document.querySelectorAll(".auth2-hero"),function(h){
    var img=h.querySelector(".hero-img");img.style.opacity="0.25";img.classList.remove("zoom");
    setTimeout(function(){img.style.visibility="";img.src=p.photo;img.style.opacity="1";void img.offsetWidth;img.classList.add("zoom");},180);
    h.querySelector(".hero-kicker").textContent=p.kicker;h.querySelector(".hero-desc").textContent=p.texte;
    h.querySelector(".hero-compteur").textContent="0"+(i+1)+" / 03";
    Array.prototype.forEach.call(h.querySelectorAll(".vignette"),function(b,j){
      var actif=j===i;b.setAttribute("aria-selected",String(actif));
      var barre=b.querySelector(".piste i");b.classList.remove("active");void barre.offsetWidth;if(actif)b.classList.add("active");
    });
  });
  relancerPiliers();
}
function relancerPiliers(){
  clearInterval(minuteriePiliers);
  minuteriePiliers=setInterval(function(){if(document.body.classList.contains("auth")&&document.visibilityState==="visible")activerPilier((pilier+1)%PILIERS.length);},7000);
}
function seConnecter(){
  dire("msgConnexion","Connexion…");
  occuper($("btnConnexion"),C.connecter($("c-email").value.trim(),$("c-mdp").value)).then(function(){
    memoriserConnexion();$("c-mdp").value="";dire("msgConnexion","");location.hash="#jour";demarrerSession();
  },function(e){dire("msgConnexion",e.message,"err");});
}
function creerCompte(){
  var d={nom:$("i-nom").value.trim(),prenoms:$("i-prenoms").value.trim(),contact:$("i-contact").value.trim(),zone:$("i-zone").value.trim(),
    email:$("i-email").value.trim(),motDePasse:$("i-mdp").value};
  if(d.motDePasse.length<MIN_MDP){dire("msgInscription","Le mot de passe doit faire "+MIN_MDP+" caractères au moins.","err");$("i-mdp").focus();return;}
  dire("msgInscription","Création du compte…");
  occuper($("btnInscription"),C.inscrire(d)).then(function(r){
    $("i-mdp").value="";majForceMdp("");
    if(r.connecte){memoriserConnexion();dire("msgInscription","");location.hash="#jour";demarrerSession();return;}
    montrerFormConnexion("connexion");$("c-email").value=d.email;
    dire("msgConnexion","Compte créé. Ouvrez le lien envoyé à "+d.email+" pour confirmer votre adresse, puis connectez-vous.","ok");
  },function(e){dire("msgInscription",e.message,"err");});
}
function demanderLien(){
  dire("msgOubli","Envoi…");
  occuper($("btnOubli"),C.motDePasseOublie($("o-email").value.trim())).then(function(){
    dire("msgOubli","Si un compte existe pour cette adresse, un lien vient d'être envoyé. Pensez à regarder dans les courriers indésirables.","ok");
  },function(e){dire("msgOubli",e.message,"err");});
}
function enregistrerNouveauMdp(){
  var m=$("n-mdp").value;
  if(m.length<MIN_MDP){dire("msgMdp","Le mot de passe doit faire "+MIN_MDP+" caractères au moins.","err");return;}
  C.changerMotDePasse(m).then(function(){
    $("n-mdp").value="";lienRecuperation=false;location.hash="#jour";demarrerSession();
  },function(e){dire("msgMdp",e.message,"err");});
}

/* ---------- Vue : premiers pas ---------- */
function choixFaiseur(selectId,libreBlocId,libreId){
  var s=$(selectId);s.textContent="";
  s.appendChild(el("option",{value:""},"— Choisir —"));
  serveur.membres.forEach(function(m){if(m.id!==profil.id)s.appendChild(el("option",{value:m.id},nomComplet(m)+(m.role==="responsable"?" (responsable)":"")));});
  s.appendChild(el("option",{value:"libre"},"Mon faiseur n'est pas encore inscrit"));
  s.value=profil.faiseurId||(profil.faiseur?"libre":"");
  $(libreId).value=profil.faiseurId?"":(profil.faiseur||"");
  $(libreBlocId).hidden=s.value!=="libre";
  s.onchange=function(){$(libreBlocId).hidden=s.value!=="libre";};
}
function lireChoixFaiseur(selectId,libreId){
  var v=$(selectId).value;
  if(v==="libre"){var t=$(libreId).value.trim();return t?{faiseur_id:null,faiseur_nom:t}:null;}
  return v?{faiseur_id:v,faiseur_nom:""}:null;
}
var choixFaiseurAccueil="";
function afficherAccueil(etape){
  titres("Bienvenue","");
  var f=etape==="faiseur";
  $("kickerAccueil").textContent=f?"Étape 3 sur 3 · Accompagnement":"Étape 2 sur 3 · Assemblée";
  $("titreAccueil").textContent=f?"Votre faiseur de disciple":"Bienvenue, "+(profil.prenoms||"");
  $("texteAccueil").textContent=f
    ?"Vous êtes membre de « "+profil.assemblee+" ». Choisissez la personne qui vous accompagne : elle verra vos comptes rendus, comme le responsable de l'assemblée."
    :"Reliez votre compte à votre assemblée locale.";
  $("etapeAssemblee").hidden=f;$("etapeFaiseur").hidden=!f;
  if(f){choixFaiseurAccueil=profil.faiseurId||(profil.faiseur?"libre":"");$("f-libre").value=profil.faiseurId?"":(profil.faiseur||"");dessinerFaiseurs();}
}
/* Liste des membres de l'assemblée, à choisir d'un geste (rond coché). */
function dessinerFaiseurs(){
  var boite=$("listeFaiseurs");boite.textContent="";
  var gens=serveur.membres.filter(function(m){return m.id!==profil.id;});
  gens.concat([{id:"libre"}]).forEach(function(m){
    var libre=m.id==="libre",b=el("button",{type:"button","class":"mentor",role:"radio","aria-checked":String(choixFaiseurAccueil===m.id),"data-id":m.id});
    b.appendChild(el("span",{"class":"av "+(libre?"libre":couleurDe(nomComplet(m)))},libre?"+":initiales(m)));
    var t=el("span",{"class":"txt"});
    t.appendChild(el("span",{"class":"nom"},libre?"Mon faiseur n'est pas encore inscrit":nomComplet(m)));
    t.appendChild(el("span",{"class":"role"},libre?"Saisir son nom":(m.role==="responsable"?"Responsable de l'assemblée":"Membre de l'assemblée")));
    b.appendChild(t);b.appendChild(el("span",{"class":"radio","aria-hidden":"true"}));
    b.addEventListener("click",function(){choixFaiseurAccueil=m.id;dessinerFaiseurs();if(libre)$("f-libre").focus();});
    boite.appendChild(b);
  });
  $("f-libreBloc").hidden=choixFaiseurAccueil!=="libre";
}
function apresAssemblee(promesse,msgId){
  dire(msgId,"Un instant…");
  return promesse.then(function(){return chargerCompte();}).then(function(){dire(msgId,"");route();},function(e){dire(msgId,e.message,"err");});
}

/* ---------- Vue : profil ---------- */
function afficherProfil(){
  var deja=inscrit();
  titres(deja?"Mon profil":"Inscription",deja?nomComplet(profil):"");
  $("titreProfil").textContent=deja?"Mon profil":"Bienvenue";
  $("texteProfil").textContent=enLigne?"Votre faiseur de disciple et le responsable de l'assemblée voient ces informations."
    :(deja?"Ces informations figurent en tête de vos comptes rendus.":"Ces informations figurent en tête de vos comptes rendus. Elles restent sur cet appareil.");
  $("btnProfil").textContent=deja?"Enregistrer":"Commencer";
  PROFIL_LOCAL.forEach(function(c){$("p-"+c).value=(profil&&profil[c])||"";});
  Array.prototype.forEach.call(document.querySelectorAll("[data-local]"),function(e){e.hidden=enLigne;e.querySelector("input").required=!enLigne;});
  Array.prototype.forEach.call(document.querySelectorAll("[data-enligne]"),function(e){e.hidden=!enLigne;});
  $("carteRappel").hidden=!deja;
  dire("msgProfil","");
  if(!enLigne)return;
  var s=C.session();
  $("emailCompte").textContent="Connecté avec "+(s&&s.email||"");
  majEtatSynchro();
  $("faiseurActuel").textContent=profil.faiseur?"Actuellement : "+profil.faiseur+(profil.faiseurId?"":" (pas encore inscrit)"):"Aucun faiseur de disciple choisi.";
  var r=profil.role==="responsable";
  $("assembleeActuelle").textContent=profil.assembleeLiee?"« "+profil.assemblee+" »"+(r?" · vous en êtes responsable":""):(profil.assemblee?"« "+profil.assemblee+" » (pas encore sur l'application)":"Aucune assemblée");
  $("blocCode").hidden=!(r&&profil.code);$("codeProfil").textContent=profil.code||"";
  $("quitterAssemblee").hidden=!profil.assembleeLiee;
  dire("msgAssemblee","");dire("msgCompte","");dire("msgFaiseurProfil","");
  $("carteFaiseur").hidden=!profil.assembleeLiee;
  if(profil.assembleeLiee)choixFaiseur("pf-choix","pf-libreBloc","pf-libre");
  if(!serveur.charge)chargerCompte().then(function(){if(vueActuelle==="profil")afficherProfil();},function(){});
}
function enregistrerProfil(){
  if(!enLigne){
    var p={};PROFIL_LOCAL.forEach(function(c){p[c]=$("p-"+c).value.trim();});
    for(var i=0;i<PROFIL_LOCAL.length;i++)if(!p[PROFIL_LOCAL[i]]){dire("msgProfil","Remplissez tous les champs.","err");$("p-"+PROFIL_LOCAL[i]).focus();return;}
    var premier=!inscrit();
    if(essayer("msgProfil",function(){ecrireLocal("reglages/profil",p);},"Profil enregistré")){profil=p;majIdentite();if(premier){location.hash="#jour";route();}}
    return;
  }
  var champs={nom:$("p-nom").value.trim(),prenoms:$("p-prenoms").value.trim(),contact:$("p-contact").value.trim(),zone:$("p-zone").value.trim()};
  if(!champs.nom||!champs.prenoms){dire("msgProfil","Le nom et les prénoms sont obligatoires.","err");return;}
  dire("msgProfil","Enregistrement…");
  occuper($("btnProfil"),C.majProfil(champs)).then(function(p){serveur.profil=p;construireProfil();majIdentite();dire("msgProfil","Profil enregistré","ok");},
    function(e){dire("msgProfil",e.message,"err");});
}

/* ---------- Vue : ma journée ---------- */
function construireJour(){
  var boite=$("sectionsJour");
  SECTIONS_JOUR.forEach(function(sec){
    var p=el("div",{"class":"panneau",id:sec.id});
    var t=el("div",{"class":"panneau-titre"});t.appendChild(pastille(sec.icone,sec.couleur,true));t.appendChild(el("h2",{},sec.titre));
    if(sec.aide)t.appendChild(el("span",{"class":"aide"},sec.aide));
    p.appendChild(t);
    sec.lignes.forEach(function(l){
      var r=el("div",{"class":"rangee"});r.appendChild(pastille(l[2],l[3]));
      var lab=el("label",{"class":"libelle","for":"f-"+l[0]},l[1]);
      if(l[6])lab.appendChild(el("small",{},l[6]));
      r.appendChild(lab);
      if(l[4]==="b"){
        var i=el("label",{"class":"inter"});i.appendChild(el("input",{type:"checkbox",id:"f-"+l[0],"aria-label":l[1]}));i.appendChild(el("span"));r.appendChild(i);
      }else if(l[4]==="h"){
        r.appendChild(el("input",{type:"time","class":"heure",id:"f-"+l[0]}));
      }else{
        var pas=l[4]==="min"?5:1,b=el("div",{"class":"pas"});
        var moins=el("button",{type:"button","data-pas":String(-pas),"aria-label":"Moins "+pas+" pour "+l[1]});moins.appendChild(icone("minus"));
        var plus=el("button",{type:"button","data-pas":String(pas),"aria-label":"Plus "+pas+" pour "+l[1]});plus.appendChild(icone("plus"));
        b.appendChild(moins);b.appendChild(el("input",{type:"number",id:"f-"+l[0],min:"0",step:"1",inputmode:"numeric",placeholder:"0"}));b.appendChild(plus);
        r.appendChild(b);r.appendChild(el("span",{"class":"unite"},l[5]));
      }
      p.appendChild(r);
    });
    boite.appendChild(p);
  });
}
function lireForm(){
  var d={};
  CHAMPS.forEach(function(c){
    var i=$("f-"+c[0]);
    if(c[1]==="b"){if(i.checked)d[c[0]]=true;}
    else if(c[1]==="h"){if(i.value)d[c[0]]=i.value;}
    else if(i.value!==""&&isFinite(Number(i.value))&&Number(i.value)>=0)d[c[0]]=Number(i.value);
  });
  return d;
}
function remplirForm(d){
  d=d||{};
  CHAMPS.forEach(function(c){
    var i=$("f-"+c[0]);
    if(c[1]==="b")i.checked=!!d[c[0]];
    else i.value=(d[c[0]]===undefined||d[c[0]]===null)?"":d[c[0]];
  });
}
function majBarres(d){
  var e=etat(d);d=d||{};
  $("ePrier").textContent=e.prier?hm(e.priere):"à faire";
  $("eMediter").textContent=e.mediter?hm(d.rdqd):"à faire";
  $("ePrecher").textContent=e.precher?d.ev+" pers.":"à faire";
  $("tPrier").classList.toggle("fait",e.prier);$("tMediter").classList.toggle("fait",e.mediter);$("tPrecher").classList.toggle("fait",e.precher);
}
function dessinerBande(){
  var s=semaineDe(jour),b=$("bande");b.textContent="";
  s.jours.forEach(function(dt){
    var k=cleJour(dt),d=k===cleJour(jour)&&formSale?lireForm():donneesJour(dt);
    var btn=el("button",{type:"button","class":"jour-bande "+niveau(d)+(k===cleJour(auj)?" auj":""),"data-date":k,"aria-label":JOURS_L[dt.getDay()]+" "+dt.getDate()+" "+MOIS[dt.getMonth()]});
    if(k===cleJour(jour))btn.setAttribute("aria-current","date");
    btn.appendChild(el("small",{},JOURS[dt.getDay()]));btn.appendChild(el("b",{},String(dt.getDate())));btn.appendChild(el("i"));
    b.appendChild(btn);
  });
}
function majResume(){
  var a=jour.getFullYear(),m=jour.getMonth()+1,nb=new Date(a,m,0).getDate(),n=0;
  for(var j=1;j<=nb;j++)if(lire("jours/"+cleMois(a,m)+"-"+pad(j)))n++;
  $("eMois").textContent=n+" / "+nb+" jours remplis";
  $("eSemaine").textContent="Score "+Math.round(RP.bilanSemaine(semaineDe(jour).jours.map(donneesJour)).score*100)+" %";
  var s=suiviPermis();
  $("barreSuivi").hidden=!s;
  if(s){
    $("titreBarreSuivi").textContent=profil.role==="responsable"?"Mon assemblée":"Mes disciples";
    $("eSuivi").textContent=profil.disciples?profil.disciples+" disciple"+(profil.disciples>1?"s":""):"Voir les comptes rendus";
  }
}
function afficherJour(){
  var titre=(cleJour(jour)===cleJour(auj)?"Aujourd'hui":JOURS_L[jour.getDay()]);
  $("jLabel").textContent=titre;
  titres("Ma journée",JOURS_L[jour.getDay()]+" "+jour.getDate()+" "+MOIS[jour.getMonth()]);
  $("quiSuisJe").textContent=JOURS_L[jour.getDay()]+" "+jour.getDate()+" "+MOIS[jour.getMonth()]+" "+jour.getFullYear()+(inscrit()&&profil.assemblee?" · "+profil.assemblee:"");
  $("jAuj").hidden=cleJour(jour)===cleJour(auj);
  var d=donneesJour(jour);
  remplirForm(d);formSale=false;majBarres(d);dessinerBande();majResume();
  dire("msgJour",d?"Journée enregistrée":"Rien d'enregistré pour ce jour");
  majEtatSynchro();majImport();
}
/* Enregistre tout de suite si une saisie attend (avant de changer de jour ou de vue). */
function viderSaisie(){if(minuterieJour){clearTimeout(minuterieJour);minuterieJour=null;enregistrerJour();}}
function enregistrerJour(){
  clearTimeout(minuterieJour);minuterieJour=null;
  var k=cleJour(jour),d=lireForm();
  d.maj=new Date().toISOString();
  if(!essayer("msgJour",function(){ecrire("jours/"+k,d);}))return;
  formSale=false;
  signalerNatif(k,d);majBarres(d);majResume();dessinerBande();
  var t=new Date();dire("msgJour","Enregistré à "+pad(t.getHours())+":"+pad(t.getMinutes()),"ok");
}
function allerAuJour(d){viderSaisie();jour=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);}
function decalerJour(n){var d=new Date(jour);d.setDate(d.getDate()+n);allerAuJour(d);route();}

/* Saisies faites sans compte sur cet appareil : proposées une fois à la connexion. */
function saisiesSansCompte(){
  var l=[];
  try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^crs:(jours|semaines|mois)\//.test(k))l.push(k.slice(4));}}catch(e){}
  return l;
}
function majImport(){
  var l=enLigne&&C.session()&&!lire("reglages/importTraite")?saisiesSansCompte():[];
  $("carteImport").hidden=!l.length;
  if(l.length){var j=l.filter(function(k){return k.indexOf("jours/")===0;}).length;
    $("texteImport").textContent=j+" journée"+(j>1?"s ont été remplies":" a été remplie")+" sur cet appareil avant la connexion. Celles déjà présentes dans votre compte ne sont pas remplacées.";}
}
function importer(){
  var n=0;
  saisiesSansCompte().forEach(function(k){
    if(lire(k))return;
    try{var v=JSON.parse(localStorage.getItem("crs:"+k));if(v){ecrire(k,v);n++;}}catch(e){}
  });
  ecrireLocal("reglages/importTraite",{le:new Date().toISOString(),n:n});
  afficherJour();dire("msgJour",n+" saisie"+(n>1?"s":"")+" ajoutée"+(n>1?"s":"")+" à votre compte.","ok");
}
function ouvrirJour(e){
  var b=e.target.closest("[data-date]");if(!b)return;
  var p=b.getAttribute("data-date").split("-");
  allerAuJour(new Date(Number(p[0]),Number(p[1])-1,Number(p[2]),12));
  if(location.hash==="#jour")route();else location.hash="#jour";
}

/* ---------- Vue : ma semaine ---------- */
function anneau(id,score){var c=$(id),l=2*Math.PI*42;c.setAttribute("stroke-dasharray",l.toFixed(1));c.setAttribute("stroke-dashoffset",(l*(1-Math.min(1,score))).toFixed(1));}
var ICONES_OBJ=[["user","bleu"],["book","violet"],["sun","orange"],["group","vert"],["flame","rose"]];
function remplirBilan(boite,b){
  boite.textContent="";
  b.lignes.forEach(function(l,i){
    var r=el("div",{"class":"rangee objectif"});r.appendChild(pastille(ICONES_OBJ[i][0],ICONES_OBJ[i][1]));
    var lib=el("div",{"class":"libelle"},l.nom.replace(/ \(.*\)$/,""));
    var j=el("div",{"class":"jauge"}),barre=el("i",l.pct>=1?{"class":"ok"}:{});barre.style.width=Math.round(Math.min(1,l.pct)*100)+"%";j.appendChild(barre);lib.appendChild(j);
    r.appendChild(lib);
    var v=el("div",{"class":"valeur"},l.realise);v.appendChild(el("small",{}," / "+l.objectif));r.appendChild(v);
    boite.appendChild(r);
  });
}
function afficherSemaine(){
  var s=semaineDe(jour),moisRef=jour.getMonth();
  $("sLabel").textContent=libelleSemaine(s);
  titres("Ma semaine",libelleSemaine(s));
  var b=RP.bilanSemaine(s.jours.map(donneesJour));
  $("sScore").textContent=Math.round(b.score*100)+" %";$("sMessage").textContent=b.message;anneau("sAnneau",b.score);
  remplirBilan($("sBilan"),b);
  var liste=$("listeSemaine");liste.textContent="";
  s.jours.forEach(function(dt){
    var d=donneesJour(dt),e=etat(d),k=cleJour(dt);
    var r=el("button",{type:"button","class":"rangee cliquable"+(dt.getMonth()!==moisRef?" hors":""),"data-date":k});
    var c=el("span",{"class":"pic "+(e.nb===3?"vert":e.nb?"orange":"ardoise")},String(dt.getDate()));c.style.fontWeight="700";c.style.fontSize=".9rem";r.appendChild(c);
    var lib=el("span",{"class":"libelle"},JOURS_L[dt.getDay()]+(k===cleJour(auj)?" · aujourd'hui":""));
    lib.appendChild(el("small",{},d?(e.priere?hm(e.priere)+" de prière":"Pas de prière notée")+(d.rdqd?" · RDQD":"")+(d.ev?" · "+d.ev+" EV":""):(dt.getMonth()!==moisRef?"Hors du mois":"Rien d'enregistré")));
    r.appendChild(lib);
    var pts=el("span",{"class":"points","aria-label":e.nb+" sur 3"});[e.prier,e.mediter,e.precher].forEach(function(x){pts.appendChild(el("i",x?{"class":"on"}:{}));});r.appendChild(pts);
    r.appendChild(icone("right"));
    liste.appendChild(r);
  });
  var notes=lire("semaines/"+cleJour(s.lundi))||{};
  $("s-parole").value=notes.parole||"";
  for(var k=0;k<3;k++)$("s-sujet"+k).value=(notes.sujets||[])[k]||"";
  dire("msgSemaine","");
}
function enregistrerSemaine(){
  var s=semaineDe(jour),notes={parole:$("s-parole").value.trim(),sujets:[0,1,2].map(function(k){return $("s-sujet"+k).value.trim();})},
      ancien=lire("semaines/"+cleJour(s.lundi));
  if(!ancien&&!notes.parole&&!notes.sujets.join(""))return true;
  return essayer("msgSemaine",function(){ecrire("semaines/"+cleJour(s.lundi),notes);},"Semaine enregistrée");
}

/* ---------- Vue : mon mois ---------- */
var donsCourants=[];
function infosMoisDe(lireCle,a,m,defaut){
  var inf=lireCle("mois/"+cleMois(a,m))||{};
  inf=JSON.parse(JSON.stringify(inf));
  if(!inf.dons)inf.dons=defaut?(lire("reglages/dons")||DONS_DEFAUT).map(function(x){return {nom:x.nom,pct:x.pct===undefined?null:x.pct,montant:null};}):[];
  return inf;
}
function infosMois(a,m){return infosMoisDe(lire,a,m,true);}
function donsCalcules(inf){
  return (inf.dons||[]).filter(function(x){return x&&x.nom&&String(x.nom).trim();}).slice(0,XL.NB_DONS).map(function(x){return XL.calculerDon(x,inf.revenu);});
}
function tuile(boite,ic,coul,val,lib){var t=el("div",{"class":"tuile"});t.appendChild(pastille(ic,coul,true));var d=el("div");d.appendChild(el("b",{},val));d.appendChild(el("span",{},lib));t.appendChild(d);boite.appendChild(t);}
function afficherMois(){
  var a=vueM.a,m=vueM.m,nb=new Date(a,m,0).getDate(),donnees=[];
  $("mLabel").textContent=maj(MOIS[m-1])+" "+a;
  titres("Mon mois",maj(MOIS[m-1])+" "+a);
  var cal=$("calMois");cal.textContent="";
  ["L","M","M","J","V","S","D"].forEach(function(x){cal.appendChild(el("span",{"class":"jsem"},x));});
  var decal=(new Date(a,m-1,1).getDay()+6)%7;
  for(var v=0;v<decal;v++)cal.appendChild(el("span",{"class":"case-cal vide-cal"}));
  for(var j=1;j<=nb;j++){
    var dt=new Date(a,m-1,j,12),k=cleJour(dt),d=donneesJour(dt);donnees.push(d);
    var c=el("button",{type:"button","class":"case-cal "+niveau(d)+(k===cleJour(auj)?" auj":""),"data-date":k,"aria-label":j+" "+MOIS[m-1]});
    c.appendChild(el("span",{},String(j)));c.appendChild(el("i"));cal.appendChild(c);
  }
  var T=RP.totaux(donnees),tu=$("tuiles");tu.textContent="";
  tuile(tu,"calendar","vert",T.remplis+" / "+nb,"jours remplis");
  tuile(tu,"user","bleu",hm(T.seul,1),"prière seul · "+Math.round(T.seul/nb)+" min/jour");
  tuile(tu,"group","orange",hm(T.pg,1),"prière de groupe");
  tuile(tu,"sun","bleu",String(T.nRdqd),"RDQD · "+(T.nRdqd?Math.round(T.rdqd/T.nRdqd):0)+" min en moyenne");
  tuile(tu,"megaphone","rose",String(T.ev),"personnes évangélisées");
  tuile(tu,"book","violet",String(T.chapitres),"chapitres lus");
  tuile(tu,"flame","rose",T.jc+" JC · "+T.jp+" JP","jours de jeûne");
  var inf=infosMois(a,m);
  $("m-revenu").value=inf.revenu===undefined||inf.revenu===null?"":inf.revenu;
  $("m-ames").value=inf.ames===undefined||inf.ames===null?"":inf.ames;
  for(var i=0;i<4;i++)$("l-"+i).value=(inf.livres||[])[i]||"";
  for(var k2=0;k2<5;k2++)$("b-"+k2).value=(inf.besoins||[])[k2]||"";
  donsCourants=inf.dons.map(function(x){return {nom:x.nom||"",pct:x.pct===undefined?null:x.pct,montant:x.montant===undefined?null:x.montant};});
  dessinerDons();dire("msgInfos","");dire("msgXl","");
  $("texteSauvegarde").textContent=enLigne&&C.session()?"Vos saisies sont enregistrées dans votre compte. Vous pouvez aussi en garder une copie dans un fichier.":"Vos saisies restent sur cet appareil. Gardez une copie de temps en temps, et avant de changer de téléphone.";
}
function listeChamps(boiteId,prefixe,n,type,etiquette){
  for(var i=0;i<n;i++){
    var lab=el("label",{"class":"champ"});lab.appendChild(el("span",{"class":"aide"},etiquette+" "+(i+1)));
    var e=el(type,type==="input"?{type:"text",id:prefixe+i}:{id:prefixe+i,rows:"2"});if(type==="textarea")e.style.minHeight="64px";
    lab.appendChild(e);$(boiteId).appendChild(lab);
  }
}
function valeur(v){return v===null||v===undefined?"":String(v);}
function revenuSaisi(){return $("m-revenu").value===""?null:Number($("m-revenu").value);}
/* Liste des rubriques de dons : chaque ligne garde ce que la personne a saisi (pourcentage ou montant). */
function dessinerDons(){
  var boite=$("dons");boite.textContent="";
  donsCourants.forEach(function(don,i){
    var ligne=el("div",{"class":"don"});
    var nom=el("input",{type:"text","aria-label":"Nom de la rubrique "+(i+1),id:"d-nom"+i,maxlength:"24"});nom.value=don.nom;
    var p=el("input",{type:"number",min:"0",step:"0.01",inputmode:"decimal","aria-label":"Pourcentage "+(don.nom||i+1),id:"d-pct"+i});
    var mt=el("input",{type:"number",min:"0",step:"1",inputmode:"numeric","aria-label":"Montant "+(don.nom||i+1),id:"d-montant"+i});
    var x=el("button",{type:"button","aria-label":"Retirer la rubrique "+(don.nom||i+1)});x.appendChild(icone("trash"));
    nom.addEventListener("input",function(){don.nom=nom.value;});
    p.addEventListener("input",function(){don.pct=p.value===""?null:Number(p.value);don.montant=null;majDons(i,"pct");});
    mt.addEventListener("input",function(){don.montant=mt.value===""?null:Number(mt.value);don.pct=null;majDons(i,"montant");});
    x.addEventListener("click",function(){donsCourants.splice(i,1);dessinerDons();});
    [nom,p,mt,x].forEach(function(e){ligne.appendChild(e);});boite.appendChild(ligne);
  });
  $("ajouterDon").disabled=donsCourants.length>=XL.NB_DONS;
  dire("msgDons",donsCourants.length>=XL.NB_DONS?XL.NB_DONS+" rubriques au maximum":"");
  majDons(-1);
}
function majDons(indexSaisi,champSaisi){
  var r=revenuSaisi(),tp=0,tm=0;
  donsCourants.forEach(function(don,i){
    var c=XL.calculerDon(don,r);
    if(!(i===indexSaisi&&champSaisi==="pct"))$("d-pct"+i).value=valeur(c.pct);
    if(!(i===indexSaisi&&champSaisi==="montant"))$("d-montant"+i).value=valeur(c.montant);
    tp+=n0(c.pct);tm+=n0(c.montant);
  });
  $("donsPct").textContent=(Math.round(tp*100)/100).toLocaleString("fr-FR")+" %";
  $("donsMontant").textContent=Math.round(tm).toLocaleString("fr-FR")+" F";
}
function lireInfos(){
  var inf={livres:[],besoins:[],dons:donsCourants.filter(function(x){return x.nom&&x.nom.trim();}).map(function(x){return {nom:x.nom.trim(),pct:x.pct,montant:x.montant};})};
  if($("m-revenu").value!=="")inf.revenu=Number($("m-revenu").value);
  if($("m-ames").value!=="")inf.ames=Number($("m-ames").value);
  for(var i=0;i<4;i++)inf.livres.push($("l-"+i).value.trim());
  for(var j=0;j<5;j++)inf.besoins.push($("b-"+j).value.trim());
  return inf;
}
function enregistrerInfos(){
  var inf=lireInfos();
  return essayer("msgInfos",function(){
    ecrire("mois/"+cleMois(vueM.a,vueM.m),inf);
    /* Les rubriques et leurs pourcentages servent de point de départ pour les mois suivants. */
    ecrire("reglages/dons",inf.dons.map(function(x){return {nom:x.nom,pct:x.pct};}));
  },"Infos du mois enregistrées");
}

/* ---------- Vue : suivi des disciples et de l'assemblée ---------- */
var suivi={jour:new Date(auj),filtre:null,personnes:[],saisies:{},charge:null};
function personnesSuivies(){
  var moi=profil.id;
  return suivi.personnes.filter(function(p){
    if(p.id===moi)return false;
    return suivi.filtre==="assemblee"&&profil.role==="responsable"?p.assemblee_id&&p.assemblee_id===(serveur.profil&&serveur.profil.assemblee_id):p.faiseur_id===moi;
  });
}
function profilPdf(p){
  var f=null;suivi.personnes.concat(serveur.membres).forEach(function(m){if(m.id===p.faiseur_id)f=m;});
  return {nom:p.nom,prenoms:p.prenoms,contact:p.contact,zone:p.zone,assemblee:p.assemblee_id?profil.assemblee:(p.assemblee_nom||""),faiseur:f?nomComplet(f):(p.faiseur_nom||"")};
}
function afficherSuivi(){
  var r=profil.role==="responsable";
  if(!r||!suivi.filtre)suivi.filtre=r?"assemblee":"disciples";
  $("titreSuivi").textContent=r?"Mon assemblée":"Mes disciples";
  $("filtreSuivi").hidden=!r;
  Array.prototype.forEach.call($("filtreSuivi").querySelectorAll("button"),function(b){b.setAttribute("aria-selected",String(b.getAttribute("data-filtre")===suivi.filtre));});
  $("carteCodeSuivi").hidden=!(r&&profil.code);$("codeSuivi").textContent=profil.code||"";
  var s=semaineDe(suivi.jour),deb=s.jours[0],fin=s.jours[6];
  $("suLabel").textContent=libelleSemaine(s);
  titres(r?"Mon assemblée":"Mes disciples",libelleSemaine(s));
  dire("msgSuivi","Chargement…");
  var cle=cleJour(s.lundi)+suivi.filtre;suivi.charge=cle;
  C.profilsVisibles().then(function(l){
    suivi.personnes=l;
    var ids=personnesSuivies().map(function(p){return p.id;});
    return C.saisiesDe(ids,cleJour(deb),cleJour(fin),["semaines/"+cleJour(s.lundi)]);
  }).then(function(lignes){
    if(suivi.charge!==cle)return;
    suivi.saisies={};
    lignes.forEach(function(l){(suivi.saisies[l.user_id]=suivi.saisies[l.user_id]||{})[l.cle]=l.donnees;});
    dessinerSuivi(s);
  },function(e){dire("msgSuivi",e.message,"err");});
}
function dessinerSuivi(s){
  var liste=$("listeSuivi"),gens=personnesSuivies(),somme=0,aJour=0,r=profil.role==="responsable";
  liste.textContent="";
  dire("msgSuivi",gens.length?"":(suivi.filtre==="assemblee"?"Aucun membre pour le moment : donnez-leur le code d'invitation.":"Aucun disciple ne vous a encore choisi comme faiseur de disciple."));
  gens.forEach(function(p){
    var sa=suivi.saisies[p.id]||{},jours=s.jours.map(function(d){return sa["jours/"+cleJour(d)]||null;});
    var b=RP.bilanSemaine(jours),t=b.totaux,pct=Math.round(b.score*100),cl=b.score>=0.75?"ok":b.score>=0.5?"moyen":"bas";somme+=b.score;
    if(sa["jours/"+cleJour(auj)])aJour++;
    var carte=el("article",{"class":"personne"});
    var tete=el("div",{"class":"tete"});
    tete.appendChild(el("span",{"class":"avatar "+couleurDe(nomComplet(p))},initiales(p)));
    var id=el("div",{"class":"ident"}),nom=el("div",{"class":"nom"},nomComplet(p));
    if(p.role==="responsable")nom.appendChild(el("span",{"class":"badge"},"Responsable"));
    id.appendChild(nom);
    var sous=[];if(p.contact)sous.push(p.contact);
    if(r&&suivi.filtre==="assemblee"){var f=profilPdf(p).faiseur;sous.push(f?"Faiseur : "+f:"Pas de faiseur choisi");}
    id.appendChild(el("div",{"class":"sous"},sous.join(" · ")));
    tete.appendChild(id);
    var droite=el("div",{style:"text-align:right"});droite.appendChild(el("div",{"class":"score "+cl},pct+" %"));
    droite.appendChild(el("div",{"class":"sous"},t.remplis+" / 7 jours"));tete.appendChild(droite);
    carte.appendChild(tete);
    var j=el("div",{"class":"jauge"}),i=el("i",{"class":cl==="ok"?"ok":cl==="bas"?"bas":""});i.style.width=pct+"%";j.appendChild(i);carte.appendChild(j);
    var ch=el("div",{"class":"chiffres"});
    [["user",hm(t.seul,1)+" seul"],["group",hm(t.pg,1)+" PG"],["sun",t.nRdqd+" RDQD"],["megaphone",t.ev+" EV"],["book",t.chapitres+" chap."]].concat(t.jc+t.jp?[["flame",(t.jc+t.jp)+" jeûne"]]:[]).forEach(function(x){
      var pu=el("span",{"class":"puce"});pu.appendChild(icone(x[0]));pu.appendChild(document.createTextNode(x[1]));ch.appendChild(pu);});
    carte.appendChild(ch);
    var act=el("div",{"class":"actions"});
    var bs=el("button",{"class":"btn",type:"button"}),bm=el("button",{"class":"btn",type:"button"});
    bs.appendChild(icone("printer"));bs.appendChild(document.createTextNode("PDF semaine"));
    bm.appendChild(icone("printer"));bm.appendChild(document.createTextNode("PDF "+MOIS[suivi.jour.getMonth()]));
    bs.onclick=function(){apercuSemaineDe(p,s);};bm.onclick=function(){occuper(bm,apercuMoisDe(p)).catch(function(e){dire("msgSuivi",e.message,"err");});};
    act.appendChild(bs);act.appendChild(bm);carte.appendChild(act);
    if(r&&p.assemblee_id===(serveur.profil&&serveur.profil.assemblee_id))carte.appendChild(gestionMembre(p));
    liste.appendChild(carte);
  });
  var tu=$("suTuiles");tu.textContent="";
  if(gens.length){
    tuile(tu,"users","violet",String(gens.length),suivi.filtre==="assemblee"?"membres":"disciple"+(gens.length>1?"s":""));
    tuile(tu,"target","vert",Math.round(somme/gens.length*100)+" %","score moyen de la semaine");
    tuile(tu,"check","bleu",aJour+" / "+gens.length,"ont rempli aujourd'hui");
  }
}
function gestionMembre(p){
  var d=el("details"),sm=el("summary",{},"Gérer"),act=el("div",{"class":"actions"});d.appendChild(sm);
  var resp=p.role==="responsable";
  var b1=el("button",{"class":"btn",type:"button"},resp?"Retirer le rôle de responsable":"Nommer responsable");
  var b2=el("button",{"class":"lien danger",type:"button"},"Retirer de l'assemblée");
  b1.onclick=function(){
    confirmer(resp?"Retirer le rôle de responsable":"Nommer responsable",
      resp?nomComplet(p)+" ne verra plus que ses propres disciples.":nomComplet(p)+" verra les comptes rendus de toute l'assemblée et pourra gérer les membres.",resp?"Retirer le rôle":"Nommer")
    .then(function(ok){if(ok)occuper(b1,C.assemblee.definirResponsable(p.id,!resp)).then(afficherSuivi,function(e){dire("msgSuivi",e.message,"err");});});
  };
  b2.onclick=function(){
    confirmer("Retirer de l'assemblée",nomComplet(p)+" quittera l'assemblée : ni son faiseur de disciple ni les responsables ne verront plus ses comptes rendus. Ses saisies restent dans son compte.","Retirer")
    .then(function(ok){if(ok)occuper(b2,C.assemblee.retirer(p.id)).then(function(){return chargerCompte();}).then(afficherSuivi,function(e){dire("msgSuivi",e.message,"err");});});
  };
  act.appendChild(b1);act.appendChild(b2);d.appendChild(act);
  return d;
}
function apercuSemaineDe(p,s){
  var sa=suivi.saisies[p.id]||{},moisRef=suivi.jour.getMonth();
  montrerApercuAutre(RP.semaine({annee:suivi.jour.getFullYear(),mois:moisRef+1,numero:s.numero,profil:profilPdf(p),logo:logo(),
    notes:sa["semaines/"+cleJour(s.lundi)]||{},
    jours:s.jours.map(function(dt){return {date:dt,dansMois:dt.getMonth()===moisRef,donnees:sa["jours/"+cleJour(dt)]||null};})}),
    "Compte rendu "+nomComplet(p)+" semaine "+s.numero+" "+XL.MOIS[moisRef]+" "+suivi.jour.getFullYear(),true);
}
function apercuMoisDe(p){
  var a=suivi.jour.getFullYear(),m=suivi.jour.getMonth()+1,nb=new Date(a,m,0).getDate();
  return C.saisiesDe([p.id],cleMois(a,m)+"-01",cleMois(a,m)+"-"+pad(nb),["mois/"+cleMois(a,m)]).then(function(lignes){
    var sa={};lignes.forEach(function(l){sa[l.cle]=l.donnees;});
    var jours=[];for(var j=1;j<=31;j++)jours.push(sa["jours/"+cleMois(a,m)+"-"+pad(j)]||null);
    var inf=infosMoisDe(function(k){return sa[k]||null;},a,m,false);inf.dons=donsCalcules(inf);
    montrerApercuAutre(RP.mois({annee:a,mois:m,jours:jours,profil:profilPdf(p),infos:inf,logo:logo()}),"Compte rendu "+nomComplet(p)+" "+XL.MOIS[m-1]+" "+a,false);
  });
}

/* ---------- Impression / PDF ---------- */
function logo(){
  var b=window.MODELE_XL&&window.MODELE_XL.binaire&&window.MODELE_XL.binaire["xl/media/image1.jpeg"];
  return b?"data:image/jpeg;base64,"+b:"";
}
var apercuCourant=null,apercuAutre=null;
function ajusterApercu(){
  var f=$("feuille"),c=$("cadre");
  f.style.transform="none";
  var e=Math.min(1,c.clientWidth/f.offsetWidth);
  f.style.transform="scale("+e+")";c.style.height=Math.ceil(f.offsetHeight*e)+"px";
}
function montrerApercu(html,titre,paysage){
  apercuCourant={titre:titre,paysage:paysage};
  $("formatPage").textContent="@page{size:A4 "+(paysage?"landscape":"portrait")+";margin:10mm}";
  $("feuille").innerHTML=html;
  $("page").hidden=true;$("apercu").hidden=false;dire("msgApercu","Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF » ou votre imprimante.");
  window.scrollTo(0,0);ajusterApercu();
}
function montrerApercuAutre(html,titre,paysage){apercuAutre={html:html,titre:titre,paysage:paysage};location.hash="#apercu-autre";}
function afficherApercu(type){
  if(type==="autre"){if(apercuAutre)montrerApercu(apercuAutre.html,apercuAutre.titre,apercuAutre.paysage);else location.replace("#suivi");return;}
  if(type==="semaine"){
    var s=semaineDe(jour),moisRef=jour.getMonth();
    montrerApercu(RP.semaine({annee:jour.getFullYear(),mois:moisRef+1,numero:s.numero,profil:profil,logo:logo(),notes:lire("semaines/"+cleJour(s.lundi))||{},
      jours:s.jours.map(function(dt){return {date:dt,dansMois:dt.getMonth()===moisRef,donnees:donneesJour(dt)};})}),
      "Compte rendu semaine "+s.numero+" "+XL.MOIS[moisRef]+" "+jour.getFullYear(),true);
  }else{
    var a=vueM.a,m=vueM.m,inf=infosMois(a,m),jours=[];
    for(var j=1;j<=31;j++)jours.push(lire("jours/"+cleMois(a,m)+"-"+pad(j)));
    inf.dons=donsCalcules(inf);
    montrerApercu(RP.mois({annee:a,mois:m,jours:jours,profil:profil,infos:inf,logo:logo()}),"Compte rendu "+XL.MOIS[m-1]+" "+a,false);
  }
}
function imprimer(){
  if(!apercuCourant)return;
  if(window.IMPRESSION_INDISPONIBLE){dire("msgApercu",window.IMPRESSION_INDISPONIBLE,"err");return;}
  if(natif&&natif.imprimer){try{natif.imprimer(apercuCourant.titre,apercuCourant.paysage);}catch(e){dire("msgApercu","L'impression n'a pas pu démarrer.","err");}return;}
  var ancien=document.title;document.title=apercuCourant.titre;
  try{window.print();}catch(e){dire("msgApercu","L'impression n'est pas disponible dans cette vue.","err");}
  document.title=ancien;
}

/* ---------- Fichiers : Excel et sauvegarde ---------- */
function versBase64(octets){
  var bin="";for(var i=0;i<octets.length;i+=8192)bin+=String.fromCharCode.apply(null,octets.subarray(i,i+8192));
  return btoa(bin);
}
/* Remet un fichier à la personne. Renvoie une promesse du message à afficher. */
function remettreFichier(nom,octets,mime){
  if(natif){
    var res=natif.enregistrerFichier(nom,versBase64(octets),mime);
    if(res!=="ok")return Promise.reject(new Error(res));
    return Promise.resolve("Fichier enregistré dans Téléchargements.");
  }
  if(window.REMETTRE_FICHIER)return window.REMETTRE_FICHIER(nom,octets,mime);
  var a=el("a",{download:nom}),url=URL.createObjectURL(new Blob([octets],{type:mime}));
  a.href=url;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},4000);
  return Promise.resolve("Fichier téléchargé.");
}
function exporter(){
  var a=vueM.a,m=vueM.m,b=$("btnXl");
  if(typeof JSZip==="undefined"||!window.MODELE_XL){dire("msgXl","Le modèle Excel n'a pas pu être chargé.","err");return;}
  b.disabled=true;dire("msgXl","Préparation du fichier…");
  var jours={},semaines={};
  XL.semainesDuMois(a,m).forEach(function(s){
    var notes=lire("semaines/"+cleJour(s.lundi));if(notes)semaines[cleJour(s.lundi)]=notes;
    s.jours.forEach(function(dt){var d=donneesJour(dt);if(d)jours[cleJour(dt)]=d;});
  });
  var p=profil||{},inf=infosMois(a,m);
  XL.construire(window.MODELE_XL,{annee:a,mois:m,jours:jours,semaines:semaines,infos:inf,
    entete:{nom:nomComplet(p),faiseur:p.faiseur||"",assemblee:(p.assemblee||"")+(p.zone?" • "+p.zone:"")}},JSZip).then(function(octets){
    return remettreFichier("Compte_rendu_spirituel_"+XL.MOIS[m-1]+"_"+a+".xlsx",octets,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }).then(function(msg){dire("msgXl",msg,"ok");},function(e){dire("msgXl",e&&e.code==="declined"?"Téléchargement annulé.":"Le fichier n'a pas pu être créé. Réessayez.","err");
  }).then(function(){b.disabled=false;});
}
function sauvegarder(){
  var donnees={},r=racine();
  try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);
    if(k.indexOf(r)===0&&/^(jours|semaines|mois|reglages)\//.test(k.slice(r.length)))donnees[k.slice(r.length)]=JSON.parse(localStorage.getItem(k));}}catch(e){}
  var texte=JSON.stringify({application:"compte-rendu-spirituel",version:3,date:new Date().toISOString(),donnees:donnees});
  remettreFichier("Sauvegarde_compte_rendu_"+cleJour(new Date())+".json",new TextEncoder().encode(texte),"application/json")
    .then(function(msg){dire("msgSauve",msg,"ok");},function(){dire("msgSauve","La sauvegarde n'a pas pu être créée.","err");});
}
function restaurer(fichier){
  var lecteur=new FileReader();
  lecteur.onerror=function(){dire("msgSauve","Le fichier n'a pas pu être lu.","err");};
  lecteur.onload=function(){
    try{
      var s=JSON.parse(lecteur.result);
      if(!s||s.application!=="compte-rendu-spirituel"||typeof s.donnees!=="object")throw new Error("format");
      var n=0;
      Object.keys(s.donnees).forEach(function(k){
        var ok=/^(jours\/\d{4}-\d{2}-\d{2}|semaines\/\d{4}-\d{2}-\d{2}|mois\/\d{4}-\d{2}|reglages\/dons)$/.test(k)||(!enLigne&&k==="reglages/profil");
        if(!ok)return;
        ecrire(k,s.donnees[k]);if(k.indexOf("jours/")===0)n++;
      });
      if(!enLigne){profil=lire("reglages/profil")||profil;majIdentite();}
      signalerNatif(cleJour(auj),donneesJour(auj));
      afficherMois();dire("msgSauve","Sauvegarde restaurée : "+n+" jour"+(n>1?"s":"")+".","ok");
    }catch(e){dire("msgSauve","Ce fichier n'est pas une sauvegarde de cette application.","err");}
  };
  lecteur.readAsText(fichier);
}

/* ---------- Rappels (application Android) ---------- */
function enMinutes(v){var m=/^(\d{1,2}):(\d{2})/.exec(v||"");return m?Number(m[1])*60+Number(m[2]):null;}
function enHeure(min){return pad(Math.floor(min/60))+":"+pad(min%60);}
function horaires(){
  var d=enMinutes($("r-debut").value),f=enMinutes($("r-fin").value),p=Number($("r-pas").value)*60,l=[];
  if(d===null||f===null||!p)return l;
  for(var t=d;t<=Math.max(d,f);t+=p)l.push(enHeure(t));
  return l;
}
function majListeRappels(){var l=horaires();$("r-liste").textContent=l.length?"Rappels à "+l.join(", ")+".":"";}
function initRappels(){
  $("rappelNatif").hidden=false;$("rappelWeb").textContent="Pour ne pas oublier de prier, méditer et prêcher.";
  var r={actif:true,debut:240,pas:3,fin:1320,autorise:true};
  try{var lu=JSON.parse(natif.lireRappel());for(var k in lu)r[k]=lu[k];}catch(e){}
  $("r-actif").checked=!!r.actif;$("r-debut").value=enHeure(r.debut);$("r-pas").value=String(r.pas);$("r-fin").value=enHeure(r.fin);
  majListeRappels();
  if(r.actif&&!r.autorise)dire("msgRappel","Autorisez les notifications pour recevoir les rappels.","err");
  ["r-debut","r-pas","r-fin"].forEach(function(id){$(id).addEventListener("input",majListeRappels);});
  $("btnRappel").onclick=function(){
    var d=enMinutes($("r-debut").value),f=enMinutes($("r-fin").value);
    if(d===null||f===null){dire("msgRappel","Choisissez les deux horaires.","err");return;}
    if(f<d){dire("msgRappel","Le dernier rappel doit être après le premier.","err");return;}
    natif.definirRappel($("r-actif").checked,d,Number($("r-pas").value),f);
    dire("msgRappel",$("r-actif").checked?"Rappels programmés":"Rappels désactivés","ok");
  };
  signalerNatif(cleJour(auj),donneesJour(auj));
}

/* ---------- Navigation ---------- */
var VUES={jour:"vueJour",semaine:"vueSemaine",mois:"vueMois",profil:"vueProfil",suivi:"vueSuivi",
  connexion:"vueConnexion",mdp:"vueMdp",chargement:"vueChargement",accueil:"vueAccueil"};
var AUTH={connexion:1,mdp:1,chargement:1,accueil:1};
var vueActuelle="";
function titres(t,sous){$("titreVue").textContent=t;$("pastille").textContent=sous||"";}
function route(){
  viderSaisie();
  var h=(location.hash||"#jour").slice(1),m=/^apercu-(semaine|mois|autre)$/.exec(h),etape=etapeAccueil();
  if(lienRecuperation&&C.session())h="mdp";
  else if(etape==="connexion"||etape==="chargement"){h=etape;m=null;}
  else if(etape==="profil"){h="profil";m=null;}
  else if(etape==="assemblee"||etape==="faiseur"){if(h!=="profil")h="accueil";m=null;}
  else if(AUTH[h])h="jour";
  if(h==="suivi"&&!suiviPermis())h="jour";
  if(m){afficherApercu(m[1]);return;}
  if(!VUES[h])h="jour";
  var change=vueActuelle!==h;vueActuelle=h;
  $("apercu").hidden=true;$("page").hidden=false;
  document.body.classList.toggle("auth",!!AUTH[h]||etape==="profil");
  Object.keys(VUES).forEach(function(k){$(VUES[k]).hidden=k!==h;});
  Array.prototype.forEach.call(document.querySelectorAll("[data-aller]"),function(b){
    if(b.closest(".lateral nav,.onglets-bas")){if(b.getAttribute("data-aller")===h)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");}
  });
  if(change){var v=$(VUES[h]);v.classList.remove("entree");void v.offsetWidth;v.classList.add("entree");window.scrollTo(0,0);}
  majIdentite();
  rafraichirVue();
}
function rafraichirVue(){
  var h=vueActuelle;
  if(h==="profil")afficherProfil();
  else if(h==="semaine")afficherSemaine();
  else if(h==="mois")afficherMois();
  else if(h==="suivi")afficherSuivi();
  else if(h==="accueil")afficherAccueil(etapeAccueil());
  else if(h==="connexion")titres("Connexion","");
  else if(h==="chargement"||h==="mdp")titres("Mon compte","");
  else if(h==="jour")afficherJour();
}

/* ---------- Branchements ---------- */
construireJour();
listeChamps("livres","l-",4,"input","Livre");listeChamps("besoins","b-",5,"textarea","Besoin");
$("ongletConnexion").onclick=function(){montrerFormConnexion("connexion");};
$("ongletInscription").onclick=function(){montrerFormConnexion("inscription");};
$("versOubli").onclick=function(){$("o-email").value=$("c-email").value;montrerFormConnexion("oubli");};
$("retourConnexion").onclick=function(){montrerFormConnexion("connexion");};
$("formConnexion").addEventListener("submit",function(e){e.preventDefault();seConnecter();});
$("formInscription").addEventListener("submit",function(e){e.preventDefault();creerCompte();});
$("formOubli").addEventListener("submit",function(e){e.preventDefault();demanderLien();});
$("formMdp").addEventListener("submit",function(e){e.preventDefault();enregistrerNouveauMdp();});
Array.prototype.forEach.call(document.querySelectorAll("[data-oeil]"),function(b){
  b.addEventListener("click",function(){
    var i=$(b.getAttribute("data-oeil")),voir=i.type==="password";i.type=voir?"text":"password";
    b.querySelector("use").setAttribute("href",voir?"#i-oeil-barre":"#i-oeil");
    b.setAttribute("aria-label",voir?"Masquer le mot de passe":"Afficher le mot de passe");
  });
});
$("i-mdp").addEventListener("input",function(){majForceMdp(this.value);});
construireHeros();
try{montrerFormConnexion(localStorage.getItem("crs:dejaConnecte")?"connexion":"inscription");}catch(e){montrerFormConnexion("inscription");}
Array.prototype.forEach.call(document.querySelectorAll("[data-copier]"),function(b){
  b.addEventListener("click",function(){
    var t=$(b.getAttribute("data-copier")).textContent,fait=function(){var ancien=b.lastChild.textContent;b.lastChild.textContent="Copié ✓";setTimeout(function(){b.lastChild.textContent=ancien;},1800);};
    try{navigator.clipboard.writeText(t).then(fait,function(){});}catch(e){}
  });
});
$("reessayerChargement").onclick=function(){$("reessayerChargement").hidden=true;dire("msgChargement","Récupération de votre profil.");demarrerSession();};
$("deconnexionChargement").onclick=function(){C.deconnecter();};
$("formRejoindre").addEventListener("submit",function(e){e.preventDefault();apresAssemblee(C.assemblee.rejoindre($("a-code").value.trim().toUpperCase()),"msgRejoindre");});
$("formCreerAssemblee").addEventListener("submit",function(e){e.preventDefault();apresAssemblee(C.assemblee.creer($("a-nom").value.trim(),$("a-zone").value.trim()),"msgCreerAssemblee").then(function(){if(profil.code)location.hash="#suivi";});});
$("formSansAssemblee").addEventListener("submit",function(e){e.preventDefault();var n=$("a-nomLibre").value.trim();if(!n)return;
  apresAssemblee(C.majProfil({assemblee_nom:n}),"msgSansAssemblee");});
$("etapeFaiseur").addEventListener("submit",function(e){e.preventDefault();
  var c=choixFaiseurAccueil==="libre"?($("f-libre").value.trim()?{faiseur_id:null,faiseur_nom:$("f-libre").value.trim()}:null):(choixFaiseurAccueil?{faiseur_id:choixFaiseurAccueil,faiseur_nom:""}:null);
  if(!c){dire("msgFaiseur","Choisissez votre faiseur de disciple, ou « Plus tard ».","err");return;}
  apresAssemblee(C.majProfil(c),"msgFaiseur");});
$("faiseurPlusTard").onclick=function(){ecrireLocal("reglages/faiseurPlusTard",true);location.hash="#jour";route();};
$("formProfil").addEventListener("submit",function(e){e.preventDefault();enregistrerProfil();});
$("btnFaiseurProfil").onclick=function(){var c=lireChoixFaiseur("pf-choix","pf-libre")||{faiseur_id:null,faiseur_nom:""};
  dire("msgFaiseurProfil","Enregistrement…");
  C.majProfil(c).then(function(){return chargerCompte();}).then(function(){afficherProfil();dire("msgFaiseurProfil","Enregistré","ok");},function(e){dire("msgFaiseurProfil",e.message,"err");});};
$("formChangerAssemblee").addEventListener("submit",function(e){e.preventDefault();var code=$("pa-code").value.trim().toUpperCase();if(code.length<8){dire("msgAssemblee","Le code compte 8 caractères.","err");return;}
  confirmer("Changer d'assemblée","Votre faiseur de disciple actuel ne verra plus vos comptes rendus. Vous en choisirez un dans la nouvelle assemblée.","Rejoindre").then(function(ok){
    if(ok)apresAssemblee(C.assemblee.rejoindre(code),"msgAssemblee").then(function(){$("pa-code").value="";});});});
$("quitterAssemblee").onclick=function(){confirmer("Quitter l'assemblée","Votre faiseur de disciple et les responsables ne verront plus vos comptes rendus.","Quitter").then(function(ok){
  if(ok)apresAssemblee(C.assemblee.quitter(),"msgAssemblee");});};
$("nouveauCode").onclick=function(){confirmer("Remplacer le code","L'ancien code ne fonctionnera plus. Les membres déjà inscrits restent dans l'assemblée.","Remplacer").then(function(ok){
  if(ok)apresAssemblee(C.assemblee.changerCode(),"msgAssemblee");});};
$("formNouveauMdp").addEventListener("submit",function(e){e.preventDefault();var m=$("pm-mdp").value;
  if(m.length<MIN_MDP){dire("msgCompte","Le mot de passe doit faire "+MIN_MDP+" caractères au moins.","err");return;}
  C.changerMotDePasse(m).then(function(){$("pm-mdp").value="";dire("msgCompte","Mot de passe changé","ok");},function(e2){dire("msgCompte",e2.message,"err");});});
$("btnDeconnexion").onclick=function(){
  var n=C.enAttente();
  (n?confirmer("Se déconnecter",n+" saisie"+(n>1?"s":"")+" n'"+(n>1?"ont":"a")+" pas encore été envoyée"+(n>1?"s":"")+". Elle"+(n>1?"s resteront":" restera")+" sur cet appareil et partir"+(n>1?"ont":"a")+" à la prochaine connexion.","Se déconnecter"):Promise.resolve(true))
  .then(function(ok){if(ok){C.deconnecter();}});
};
$("btnSupprimerCompte").onclick=function(){
  confirmer("Supprimer mon compte","Votre compte et toutes vos saisies en ligne seront effacés définitivement. Créez d'abord une sauvegarde si vous voulez garder une copie.","Supprimer définitivement").then(function(ok){
    if(!ok)return;
    var r=racine();
    C.supprimerCompte().then(function(){
      try{for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);if(k.indexOf(r)===0)localStorage.removeItem(k);}}catch(e){}
      profil=null;route();
    },function(e){dire("msgCompte",e.message,"err");});
  });
};
$("btnImporter").onclick=importer;
$("btnIgnorerImport").onclick=function(){ecrireLocal("reglages/importTraite",{le:new Date().toISOString(),n:0});majImport();};
/* Saisie de la journée : boutons − / + et enregistrement automatique après une courte pause. */
$("formJour").addEventListener("click",function(e){
  var b=e.target.closest("button[data-pas]");if(!b)return;
  var i=b.parentNode.querySelector("input");i.value=String(Math.max(0,(Number(i.value)||0)+Number(b.getAttribute("data-pas"))));
  i.dispatchEvent(new Event("input",{bubbles:true}));
});
$("formJour").addEventListener("input",function(){
  formSale=true;majBarres(lireForm());dessinerBande();dire("msgJour","Enregistrement…");
  clearTimeout(minuterieJour);minuterieJour=setTimeout(enregistrerJour,1200);
});
$("formJour").addEventListener("change",function(e){if(e.target.type==="checkbox"||e.target.type==="time"){clearTimeout(minuterieJour);minuterieJour=setTimeout(enregistrerJour,300);}});
$("formJour").addEventListener("submit",function(e){e.preventDefault();enregistrerJour();});
$("formSemaine").addEventListener("submit",function(e){e.preventDefault();enregistrerSemaine();});
$("formInfos").addEventListener("submit",function(e){e.preventDefault();enregistrerInfos();});
$("jPrec").onclick=function(){decalerJour(-1);};$("jSuiv").onclick=function(){decalerJour(1);};
$("jAuj").onclick=function(){allerAuJour(auj);route();};
$("sPrec").onclick=function(){var d=new Date(jour);d.setDate(d.getDate()-7);allerAuJour(d);afficherSemaine();};
$("sSuiv").onclick=function(){var d=new Date(jour);d.setDate(d.getDate()+7);allerAuJour(d);afficherSemaine();};
$("mPrec").onclick=function(){vueM.m--;if(vueM.m<1){vueM.m=12;vueM.a--;}afficherMois();};
$("mSuiv").onclick=function(){vueM.m++;if(vueM.m>12){vueM.m=1;vueM.a++;}afficherMois();};
$("suPrec").onclick=function(){suivi.jour.setDate(suivi.jour.getDate()-7);afficherSuivi();};
$("suSuiv").onclick=function(){suivi.jour.setDate(suivi.jour.getDate()+7);afficherSuivi();};
Array.prototype.forEach.call($("filtreSuivi").querySelectorAll("button"),function(b){b.onclick=function(){suivi.filtre=b.getAttribute("data-filtre");afficherSuivi();};});
$("m-revenu").addEventListener("input",function(){majDons(-1);});
$("ajouterDon").onclick=function(){if(donsCourants.length<XL.NB_DONS){donsCourants.push({nom:"",pct:null,montant:null});dessinerDons();$("d-nom"+(donsCourants.length-1)).focus();}};
$("btnPdfSemaine").onclick=function(){enregistrerSemaine();location.hash="#apercu-semaine";};
$("btnPdfMois").onclick=function(){if(enregistrerInfos())location.hash="#apercu-mois";};
$("btnXl").onclick=function(){if(enregistrerInfos())exporter();};
$("fermerApercu").onclick=function(){history.back();};
$("btnImprimer").onclick=imprimer;
$("btnSauver").onclick=sauvegarder;
$("fichierSauvegarde").addEventListener("change",function(){if(this.files&&this.files[0])restaurer(this.files[0]);this.value="";});
$("bande").addEventListener("click",ouvrirJour);$("listeSemaine").addEventListener("click",ouvrirJour);$("calMois").addEventListener("click",ouvrirJour);
Array.prototype.forEach.call(document.querySelectorAll("[data-vers]"),function(b){
  b.addEventListener("click",function(){
    var s=$(b.getAttribute("data-vers"));s.scrollIntoView({behavior:"smooth",block:"center"});
    var i=s.querySelector("input");if(i)i.focus({preventScroll:true});
  });
});
Array.prototype.forEach.call(document.querySelectorAll("[data-aller]"),function(b){
  b.addEventListener("click",function(){
    var v=b.getAttribute("data-aller");
    if(v==="mois")vueM={a:jour.getFullYear(),m:jour.getMonth()+1};
    if(v==="suivi")suivi.jour=new Date(jour);
    if(location.hash==="#"+v)route();else location.hash="#"+v;
  });
});
window.addEventListener("hashchange",route);
window.addEventListener("resize",function(){if(!$("apercu").hidden)ajusterApercu();});
window.addEventListener("pagehide",viderSaisie);
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")viderSaisie();});

/* ---------- Démarrage ---------- */
if(natif)initRappels();
if(enLigne){
  /* « Rester connecté » décoché : la session se ferme quand l'application ou le navigateur est fermé. */
  try{if(C.session()&&localStorage.getItem("crs:sessionTemporaire")&&!sessionStorage.getItem("crs:ouvert"))C.deconnecter();}catch(e){}
  C.ecouter(function(evt){
    if(evt==="deconnecte"){profil=null;serveur={profil:null,assemblee:null,membres:[],charge:false};
      montrerFormConnexion("connexion");dire("msgConnexion","Vous êtes déconnecté.");location.hash="#connexion";route();}
    else if(evt==="attente")majEtatSynchro();
  });
  var lien=C.lireLienEmail(location.hash);
  if(lien){
    history.replaceState(null,"",location.pathname+location.search+"#jour");
    if(lien.type==="erreur"){dire("msgLien",lien.message,"err");}
    else if(lien.type==="recuperation")lienRecuperation=true;
  }
  window.addEventListener("online",function(){synchroniser();});
  window.addEventListener("offline",function(){majEtatSynchro();});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")synchroniser();});
  setInterval(function(){if(document.visibilityState==="visible")synchroniser();},5*60*1000);
  if(C.session())demarrerSession();else route();
}else{
  route();
}
if(!natif&&!window.SANS_SW&&"serviceWorker" in navigator&&location.protocol==="https:"){navigator.serviceWorker.register("sw.js").catch(function(){});}
})();
