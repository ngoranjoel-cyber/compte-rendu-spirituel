/* La Bible dans l'application : lecture livre par livre, recherche, surlignage, partage.
   Textes libres de droits, un fichier par langue (bible-xx.json), téléchargé une fois puis gardé hors connexion.
   Format : {n:nom de la version, c:mention, l:langue, b:[[nom du livre, [[versets du chapitre 1], …]], … 66 livres]} */
(function(){
"use strict";
var LANGUES=["fr","en","es","pt","zh","ar"];
var NOM_LANGUE={fr:"Français",en:"English",es:"Español",pt:"Português",zh:"中文",ar:"العربية"};
var COULEURS={jaune:"#FFE58A",vert:"#BDEFC9",bleu:"#C4E1FF",rose:"#FFCFE0"};
var api={},cache={},enCours={},bible=null,langueBible=null,pos=null,choisis=[],texteEtat="";
function $(id){return document.getElementById(id);}
function T(s){return self.I18N?I18N.t(s):s;}
function F(s,v){return self.I18N&&I18N.f?I18N.f(s,v):s.replace("#",v[0]);}
function lireLS(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}}
function ecrireLS(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
/* Comparaison sans accents, sans signes diacritiques (arabe compris), sans ponctuation d'apostrophe. */
var FC=String.fromCharCode,DIACR=new RegExp("["+FC(0x300)+"-"+FC(0x36f)+FC(0x64b)+"-"+FC(0x65f)+FC(0x670)+FC(0x6d6)+"-"+FC(0x6ed)+"]","g"),APOS=new RegExp("["+FC(0x2019,0x27,0x60,0xb4)+"]","g"),ALIF=new RegExp(FC(0x671),"g");
function plat(s){return String(s).normalize("NFD").replace(DIACR,"").replace(APOS,"'").replace(ALIF,FC(0x627)).toLowerCase();}

function langueVoulue(){
  var l=lireLS("crs:bibleLangue",null);
  if(LANGUES.indexOf(l)<0){l=(document.documentElement.lang||"fr").slice(0,2);if(LANGUES.indexOf(l)<0)l="fr";}
  return l;
}
function charger(l){
  if(cache[l])return Promise.resolve(cache[l]);
  if(enCours[l])return enCours[l];
  enCours[l]=fetch("bible-"+l+".json").then(function(r){if(!r.ok)throw new Error("http "+r.status);return r.json();})
    .then(function(j){cache[l]=j;delete enCours[l];return j;},function(e){delete enCours[l];throw e;});
  return enCours[l];
}

/* ---------- Affichage d'un chapitre ---------- */
function etat(html){var e=$("bibleEtat");e.innerHTML=html;e.hidden=!html;$("bibleTexte").hidden=!!html;$("bibleNavChap").hidden=!!html;}
function afficher(){
  if(api.titres)api.titres(T("La Bible"),"");
  var l=langueVoulue();
  if(bible&&langueBible===l){rendre();return;}
  etat('<div class="bible-charge"><span class="bible-roue"></span><p>'+esc(T("Téléchargement de la Bible…"))+'</p></div>');
  charger(l).then(function(j){bible=j;langueBible=l;etat("");rendre();},function(){
    etat('<div class="bible-charge"><svg class="ic"><use href="#i-book-open"/></svg><p>'+esc(T("La Bible n'a pas encore été téléchargée. Connectez-vous à internet une première fois pour l'ouvrir ; elle restera ensuite disponible hors connexion."))+'</p><button class="btn vert" type="button" id="bibleReessayer">'+esc(T("Réessayer"))+'</button></div>');
    $("bibleReessayer").onclick=afficher;
  });
}
function position(){
  var p=pos||lireLS("crs:biblePos",{b:42,c:0});
  if(!bible.b[p.b])p={b:0,c:0};if(!bible.b[p.b][1][p.c])p.c=0;
  return p;
}
function rendre(flash){
  var p=position();pos=p;ecrireLS("crs:biblePos",{b:p.b,c:p.c});
  var livre=bible.b[p.b],vs=livre[1][p.c],sur=lireLS("crs:bibleSurligne",{});
  $("bibleRef").textContent=livre[0]+" "+(p.c+1);
  $("bibleVersion").textContent=bible.n;
  var t=$("bibleTexte");t.dir=langueBible==="ar"?"rtl":"ltr";t.lang=langueBible;
  var h='<h2 class="bible-titre">'+esc(livre[0])+' <span>'+(p.c+1)+'</span></h2><p class="bible-para">';
  for(var i=0;i<vs.length;i++){if(!vs[i])continue;var k=(p.b+1)+"."+(p.c+1)+"."+(i+1),c=sur[k];
    h+='<span class="bible-v'+(c?' surl':'')+'" data-v="'+(i+1)+'"'+(c?' style="background:'+COULEURS[c]+'"':'')+'><sup>'+(i+1)+'</sup>'+esc(vs[i])+' </span>';}
  h+='</p>';
  var cle=lusCle(),lu=(lireLS(cle,[])).indexOf(p.b+"."+p.c)>=0;
  h+='<div class="bible-fin"><button type="button" class="btn '+(lu?'':'vert ')+'bible-lu" id="bibleLu"'+(lu?' disabled':'')+'><svg class="ic"><use href="#i-check"/></svg>'+esc(lu?T("Compté dans « Chapitres lus » aujourd'hui"):T("J'ai lu ce chapitre"))+'</button>'+
     '<p class="bible-mention">'+esc(bible.n)+' · '+esc(bible.c)+'</p></div>';
  t.innerHTML=h;
  $("biblePrec").disabled=p.b===0&&p.c===0;$("bibleSuiv").disabled=p.b===bible.b.length-1&&p.c===livre[1].length-1;
  choisis=[];barre();
  $("bibleLu").onclick=compterLu;
  if(flash){var el=t.querySelector('[data-v="'+flash+'"]');if(el){el.classList.add("eclair");setTimeout(function(){el.scrollIntoView({block:"center",behavior:"smooth"});},60);setTimeout(function(){el.classList.remove("eclair");},2600);}}
  else window.scrollTo(0,0);
}
function aller(b,c,v){pos={b:b,c:c};rendre(v);}
function decaler(d){
  var p=position(),b=p.b,c=p.c+d;
  if(c<0){if(b===0)return;b--;c=bible.b[b][1].length-1;}
  else if(c>=bible.b[b][1].length){if(b===bible.b.length-1)return;b++;c=0;}
  aller(b,c);
}

/* ---------- « J'ai lu ce chapitre » : +1 dans « Chapitres lus » du jour ---------- */
function lusCle(){var d=new Date();return "crs:bibleLus:"+d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);}
function compterLu(){
  var p=position(),cle=lusCle(),l=lireLS(cle,[]),k=p.b+"."+p.c;
  if(l.indexOf(k)>=0)return;
  if(api.ajouterChapitre&&api.ajouterChapitre()===false)return;
  l.push(k);ecrireLS(cle,l);rendre();
  var b=$("bibleLu");if(b)b.classList.add("eclair");
}

/* ---------- Sélection de versets : surligner, copier, partager ---------- */
function barre(){
  var b=$("bibleSelection");b.hidden=!choisis.length;
  if(choisis.length)$("bibleSelRef").textContent=refSel();
}
function refSel(){
  var p=position(),v=choisis.slice().sort(function(a,b){return a-b;}),parts=[],i=0;
  while(i<v.length){var d=v[i],f=d;while(v[i+1]===f+1){f++;i++;}parts.push(d===f?d:d+"-"+f);i++;}
  return bible.b[p.b][0]+" "+(p.c+1)+":"+parts.join(",");
}
function texteSel(){
  var p=position(),vs=bible.b[p.b][1][p.c];
  return choisis.slice().sort(function(a,b){return a-b;}).map(function(n){return vs[n-1];}).join(" ")+FC(10)+"— "+refSel()+" ("+bible.n+")";
}
function surligner(c){
  var p=position(),s=lireLS("crs:bibleSurligne",{});
  choisis.forEach(function(n){var k=(p.b+1)+"."+(p.c+1)+"."+n;if(c)s[k]=c;else delete s[k];});
  ecrireLS("crs:bibleSurligne",s);rendre();
}
function copier(){
  var t=texteSel();
  var fini=function(){var b=$("bibleCopier");b.classList.add("ok");setTimeout(function(){b.classList.remove("ok");choisis=[];rendreSelection();},900);};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(fini,function(){secours(t);fini();});else{secours(t);fini();}
}
function secours(t){var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");}catch(e){}a.remove();}
function partager(){
  var t=texteSel();
  if(navigator.share)navigator.share({text:t}).catch(function(){});else copier();
}
function rendreSelection(){
  Array.prototype.forEach.call($("bibleTexte").querySelectorAll(".bible-v"),function(e){e.classList.toggle("choisi",choisis.indexOf(+e.dataset.v)>=0);});
  barre();
}

/* ---------- Choix du livre et du chapitre ---------- */
function ouvrirLivres(){
  if(!bible)return;
  var d=$("bibleLivres"),p=position();
  $("bibleLivresTitre").textContent=T("Choisir un livre");
  var h="";
  [[0,39,"Ancien Testament"],[39,66,"Nouveau Testament"]].forEach(function(g){
    h+='<h3>'+esc(T(g[2]))+'</h3><div class="bible-grille-livres">';
    for(var i=g[0];i<g[1];i++)h+='<button type="button" data-b="'+i+'"'+(i===p.b?' class="actuel"':'')+'>'+esc(bible.b[i][0])+'</button>';
    h+='</div>';
  });
  var z=$("bibleLivresCorps");z.innerHTML=h;z.dir=langueBible==="ar"?"rtl":"ltr";z.scrollTop=0;
  ouvrir(d);
  var a=z.querySelector(".actuel");if(a)setTimeout(function(){a.scrollIntoView({block:"center"});},30);
}
function ouvrirChapitres(b){
  var z=$("bibleLivresCorps"),n=bible.b[b][1].length,p=position();
  $("bibleLivresTitre").textContent=bible.b[b][0];
  if(n===1){fermer($("bibleLivres"));aller(b,0);return;}
  var h='<button type="button" class="bible-retour" data-retour><svg class="ic"><use href="#i-left"/></svg>'+esc(T("Choisir un livre"))+'</button><h3>'+esc(T("Chapitres"))+'</h3><div class="bible-grille-chap">';
  for(var c=0;c<n;c++)h+='<button type="button" data-b="'+b+'" data-c="'+c+'"'+(b===p.b&&c===p.c?' class="actuel"':'')+'>'+(c+1)+'</button>';
  z.innerHTML=h+'</div>';z.scrollTop=0;
}

/* ---------- Recherche : référence (Jean 3:16) ou mots ---------- */
function reference(q){
  var m=/^ *([1-3]? *[^0-9:.,]+?) *([0-9]+)(?: *[:., ] *([0-9]+))? *$/.exec(q.split(FC(9)).join(" "));if(!m)return null;
  var nom=plat(m[1]).split(" ").join("");if(!nom)return null;
  var trouve=-1;
  for(var i=0;i<bible.b.length;i++){var n=plat(bible.b[i][0]).split(" ").join("");if(n===nom){trouve=i;break;}if(trouve<0&&n.indexOf(nom)===0)trouve=i;}
  if(trouve<0)return null;
  var c=+m[2]-1,v=m[3]?+m[3]:0;if(!bible.b[trouve][1][c])return null;
  return {b:trouve,c:c,v:v};
}
function chercher(){
  var q=$("bibleQ").value.trim(),z=$("bibleResultats");
  if(q.length<2){z.innerHTML="";return;}
  var r=reference(q),h="";
  if(r)h+='<button type="button" class="bible-res ref" data-b="'+r.b+'" data-c="'+r.c+'" data-v="'+r.v+'"><b>'+esc(bible.b[r.b][0]+" "+(r.c+1)+(r.v?":"+r.v:""))+'</b><span>'+esc(r.v?(bible.b[r.b][1][r.c][r.v-1]||""):(bible.b[r.b][1][r.c][0]||""))+'</span></button>';
  var mot=plat(q),n=0,liste=[],MAX=300;
  if(mot.length>=2)for(var b=0;b<bible.b.length;b++){var chs=bible.b[b][1];for(var c=0;c<chs.length;c++){var vs=chs[c];for(var v=0;v<vs.length;v++){if(vs[v]&&plat(vs[v]).indexOf(mot)>=0){n++;if(liste.length<MAX)liste.push([b,c,v]);}}}}
  if(n||!r)h+='<p class="aide bible-compte">'+esc(n?F("Résultats : #",[n]):T("Aucun résultat"))+(n>MAX?" "+esc(T("Seuls les 300 premiers résultats sont affichés.")):"")+'</p>';
  liste.forEach(function(x){
    h+='<button type="button" class="bible-res" data-b="'+x[0]+'" data-c="'+x[1]+'" data-v="'+(x[2]+1)+'"><b>'+esc(bible.b[x[0]][0]+" "+(x[1]+1)+":"+(x[2]+1))+'</b><span>'+marquer(bible.b[x[0]][1][x[1]][x[2]],mot)+'</span></button>';
  });
  z.innerHTML=h;z.dir=langueBible==="ar"?"rtl":"ltr";
}
/* Met le mot cherché en valeur, en retrouvant sa place dans le texte d'origine (accents compris). */
function marquer(texte,mot){
  var p=plat(texte);if(p.length!==texte.length)return esc(texte);
  var i=p.indexOf(mot);if(i<0)return esc(texte);
  return esc(texte.slice(0,i))+"<mark>"+esc(texte.slice(i,i+mot.length))+"</mark>"+esc(texte.slice(i+mot.length));
}

/* ---------- Affichage : taille du texte, version ---------- */
function taille(d){
  var t=lireLS("crs:bibleTaille",19);if(d)t=Math.max(15,Math.min(30,t+d));ecrireLS("crs:bibleTaille",t);
  document.documentElement.style.setProperty("--bible-taille",t+"px");$("bibleTailleVal").textContent=t;
}
function ouvrirAffichage(){
  var s=$("bibleLangue");
  if(!s.options.length)LANGUES.forEach(function(l){var o=document.createElement("option");o.value=l;o.textContent=NOM_LANGUE[l];s.appendChild(o);});
  s.value=langueVoulue();taille(0);ouvrir($("bibleAffichage"));
}

function ouvrir(d){if(typeof d.showModal==="function"){if(!d.open)d.showModal();}else d.setAttribute("open","");}
function fermer(d){if(d.close)d.close();else d.removeAttribute("open");}

/* ---------- Branchements ---------- */
function brancher(o){
  api=o||{};
  taille(0);
  $("bibleRef").onclick=ouvrirLivres;
  $("biblePrec").onclick=function(){decaler(-1);};
  $("bibleSuiv").onclick=function(){decaler(1);};
  $("bibleChercher").onclick=function(){if(!bible)return;ouvrir($("bibleRecherche"));setTimeout(function(){$("bibleQ").focus();},50);};
  $("bibleAa").onclick=ouvrirAffichage;
  $("bibleTexte").addEventListener("click",function(e){
    var v=e.target.closest(".bible-v");if(!v)return;var n=+v.dataset.v,i=choisis.indexOf(n);
    if(i>=0)choisis.splice(i,1);else choisis.push(n);rendreSelection();
  });
  $("bibleSelection").addEventListener("click",function(e){
    var b=e.target.closest("button");if(!b)return;
    if(b.dataset.couleur!=null)surligner(b.dataset.couleur);
    else if(b.id==="bibleCopier")copier();
    else if(b.id==="biblePartager")partager();
    else if(b.id==="bibleAnnuler"){choisis=[];rendreSelection();}
  });
  $("bibleLivresCorps").addEventListener("click",function(e){
    var b=e.target.closest("button");if(!b)return;
    if(b.hasAttribute("data-retour")){ouvrirLivres();return;}
    if(b.dataset.c!=null){fermer($("bibleLivres"));aller(+b.dataset.b,+b.dataset.c);}
    else if(b.dataset.b!=null)ouvrirChapitres(+b.dataset.b);
  });
  var minut=null;
  $("bibleQ").addEventListener("input",function(){clearTimeout(minut);minut=setTimeout(chercher,250);});
  $("bibleQ").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();clearTimeout(minut);chercher();var r=$("bibleResultats").querySelector(".bible-res.ref");if(r)r.click();}});
  $("bibleResultats").addEventListener("click",function(e){
    var b=e.target.closest(".bible-res");if(!b)return;fermer($("bibleRecherche"));aller(+b.dataset.b,+b.dataset.c,+b.dataset.v||0);
  });
  $("bibleMoins").onclick=function(){taille(-1);};
  $("biblePlus").onclick=function(){taille(1);};
  $("bibleLangue").onchange=function(){ecrireLS("crs:bibleLangue",this.value);fermer($("bibleAffichage"));bible=null;afficher();};
  Array.prototype.forEach.call(document.querySelectorAll(".bible-fen"),function(d){
    d.addEventListener("click",function(e){
      if(e.target.closest("[data-fermer]")){fermer(d);return;}
      if(e.target===d){var r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)fermer(d);}
    });
  });
  /* Glisser à gauche / à droite pour changer de chapitre. */
  var x0=null,y0=0;
  $("bibleTexte").addEventListener("touchstart",function(e){var t=e.touches[0];x0=t.clientX;y0=t.clientY;},{passive:true});
  $("bibleTexte").addEventListener("touchend",function(e){
    if(x0==null)return;var t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;
    if(Math.abs(dx)>80&&Math.abs(dy)<50){var sens=dx<0?1:-1;if(langueBible==="ar")sens=-sens;decaler(sens);}
  });
}
/* Ouvre la Bible à une référence donnée en indices (livre 0-65, chapitre 0-…, verset 1-…). */
function ouvrirA(b,c,v){pos={b:b,c:c};ecrireLS("crs:biblePos",{b:b,c:c});BIBLE.flash=v||0;}

self.BIBLE={brancher:brancher,afficher:function(){var f=BIBLE.flash;BIBLE.flash=0;afficher();if(f&&bible&&langueBible===langueVoulue())rendre(f);else if(f)BIBLE.flashApres=f;},ouvrirA:ouvrirA,flash:0,
  /* utilisé par les tests */ _charger:charger};
/* Le verset à mettre en valeur est appliqué une fois la Bible chargée. */
var rendreOrig=rendre;rendre=function(flash){if(!flash&&BIBLE.flashApres){flash=BIBLE.flashApres;BIBLE.flashApres=0;}rendreOrig(flash);};
})();
