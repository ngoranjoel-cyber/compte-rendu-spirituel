/* Langues de l'application.
   Le français est la langue d'écriture du code. Pour les autres langues, chaque texte affiché
   (texte, placeholder, title, aria-label) est cherché dans self.TRADUCTIONS :
   - correspondance exacte ;
   - sinon modèle avec « # » (un nombre : 3, 12,5, 1:30) et « {x} » (n'importe quel texte).
   Dans la traduction, « # » et « {x} » reprennent les valeurs dans le même ordre ;
   « {1} », « {2} »… permettent de les réordonner. */
(function(){
"use strict";
/* Les 20 langues les plus parlées au monde (Ethnologue 2025 ; l'arabe égyptien s'écrit en arabe standard : remplacé par le swahili). */
var LISTE={fr:"Français",en:"English",zh:"中文",hi:"हिन्दी",es:"Español",ar:"العربية",bn:"বাংলা",pt:"Português",ru:"Русский",id:"Bahasa Indonesia",
  ur:"اردو",de:"Deutsch",ja:"日本語",pcm:"Naijá (Pidgin)",mr:"मराठी",vi:"Tiếng Việt",te:"తెలుగు",ha:"Hausa",tr:"Türkçe",sw:"Kiswahili"};
var RTL={ar:1,ur:1};
var CLE="crs:langue";
function lireChoix(){
  var l="";try{l=localStorage.getItem(CLE)||"";}catch(e){}
  if(LISTE[l])return l;
  var n=((navigator.languages&&navigator.languages[0])||navigator.language||"fr").toLowerCase().split("-")[0];
  return LISTE[n]?n:"fr";
}
var langue=lireChoix();
var exact={},brut={},modeles=[],AUDIT=!!self.I18N_AUDIT,vus={};
var NB="\\d+(?:[\\u00a0\\u202f ]\\d{3})*(?:[.,:]\\d+)*";
function norm(s){return s.replace(/\s+/g," ").trim();}
function preparer(){
  var T=self.TRADUCTIONS||[],c=AUDIT?0:1;
  for(var i=0;i<T.length;i++){
    var fr=norm(T[i][0]),tr=T[i][c];
    if(tr==null)continue;
    if(/#|\{x\}/.test(fr)){
      var ordre=[],motif="^"+fr.replace(/[.*+?^$()|[\]\\]/g,"\\$&").replace(/\\?\{x\}|#/g,function(m){ordre.push(m);return m==="#"?"("+NB+")":"(.+?)";})+"$";
      modeles.push({re:new RegExp(motif),tr:tr});brut[fr]=tr;
    }else exact[fr]=tr;
  }
}
function remplir(tr,v){
  var k=0;
  return tr.replace(/\{(\d)\}|\{x\}|#/g,function(m,n){if(n)return v[+n-1]!=null?v[+n-1]:"";return v[k]!=null?v[k++]:"";});
}
function traduire(s){
  if(s==null)return s;
  var n=norm(String(s));
  if(!n||!/[A-Za-zÀ-ÿ]/.test(n))return s;
  var r=exact.hasOwnProperty(n)?exact[n]:null;
  if(r==null){
    for(var i=0;i<modeles.length;i++){var m=modeles[i].re.exec(n);if(m){r=remplir(modeles[i].tr,m.slice(1).map(traduireMorceau));break;}}
  }
  if(r==null){
    if((AUDIT||self.I18N_MANQUES)&&!vus[n]){vus[n]=1;try{new Image().src="/__manque?"+encodeURIComponent(n);}catch(e){}}
    return s;
  }
  if(AUDIT||langue==="fr")return s;
  /* Garde les espaces de début et de fin du texte d'origine. */
  var a=/^\s*/.exec(s)[0],b=/\s*$/.exec(s)[0];
  return a+r+b;
}
/* Un morceau capturé par {x} peut lui-même être un libellé connu (« Prière », « novembre »…). */
function traduireMorceau(s){var n=norm(s);return exact.hasOwnProperty(n)&&langue!=="fr"&&!AUDIT?exact[n]:s;}

var ATTRS=["placeholder","title","aria-label"];
var SAUTER={SCRIPT:1,STYLE:1,TEXTAREA:1,svg:1,SVG:1};
function exclu(el){
  for(var e=el;e&&e.nodeType===1;e=e.parentNode){if(SAUTER[e.nodeName]||e.getAttribute("translate")==="no"||(e.classList&&e.classList.contains("sans-trad")))return true;}
  return false;
}
function texteNoeud(t){
  if(t.__tr!=null&&t.data===t.__tr)return;
  if(!t.parentNode||exclu(t.parentNode))return;
  var o=t.data,r=traduire(o);
  if(r!==o){t.__tr=r;t.data=r;}else t.__tr=null;
}
function attributs(el){
  if(exclu(el))return;
  for(var i=0;i<ATTRS.length;i++){
    var a=ATTRS[i];if(!el.hasAttribute(a))continue;
    var v=el.getAttribute(a),k="__tr_"+a;
    if(el[k]!=null&&v===el[k])continue;
    var r=traduire(v);el[k]=r!==v?r:null;if(r!==v)el.setAttribute(a,r);
  }
}
function parcourir(racine){
  if(!racine)return;
  if(racine.nodeType===3){texteNoeud(racine);return;}
  if(racine.nodeType!==1&&racine.nodeType!==9&&racine.nodeType!==11)return;
  if(racine.nodeType===1){if(exclu(racine))return;attributs(racine);}
  var w=document.createTreeWalker(racine,5,null),n;
  while((n=w.nextNode())){if(n.nodeType===3)texteNoeud(n);else attributs(n);}
}
var actif=langue!=="fr"||AUDIT;
function demarrer(){
  if(!actif)return;
  preparer();
  parcourir(document.body);
  if(document.title)document.title=traduire(document.title);
  new MutationObserver(function(liste){
    for(var i=0;i<liste.length;i++){
      var m=liste[i];
      if(m.type==="characterData")texteNoeud(m.target);
      else if(m.type==="attributes")attributs(m.target);
      else for(var j=0;j<m.addedNodes.length;j++)parcourir(m.addedNodes[j]);
    }
  }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  var c=window.confirm,a=window.alert,p=window.prompt;
  window.confirm=function(m){return c.call(window,traduire(m));};
  window.alert=function(m){return a.call(window,traduire(m));};
  window.prompt=function(m,d){return p.call(window,traduire(m),d);};
}

/* Noms des mois et des jours, utilisés par app.js pour composer les dates. */
var FR={mois:["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"],
  moisC:["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."],
  jours:["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"],joursL:["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"]};
var cacheNoms=null;
function nomsIntl(){
  if(langue==="fr")return FR;
  var loc=langue;
  try{
    var f=function(o){return new Intl.DateTimeFormat(loc,o);},r={mois:[],moisC:[],jours:[],joursL:[]};
    for(var m=0;m<12;m++){var d=new Date(2024,m,15);r.mois.push(f({month:"long"}).format(d));r.moisC.push(f({month:"short"}).format(d));}
    for(var j=0;j<7;j++){var e=new Date(2024,8,1+j);r.joursL.push(f({weekday:"long"}).format(e));r.jours.push(f({weekday:"short"}).format(e));}
    return r;
  }catch(err){return FR;}
}

self.I18N={
  langue:langue,liste:LISTE,rtl:!!RTL[langue],
  pret:function(){if(document.body)demarrer();else document.addEventListener("DOMContentLoaded",demarrer);},
  t:function(s){return actif&&!AUDIT?traduire(s):s;},
  /* Phrase à trous traduite puis remplie : I18N.f("Revenus de {x} : # F", ["mars", "120 000"]). */
  f:function(fr,valeurs){
    var n=norm(fr),tr=fr;
    if(actif&&!AUDIT){if(brut.hasOwnProperty(n))tr=brut[n];else if(exact.hasOwnProperty(n))tr=exact[n];}
    else if(AUDIT&&!vus[n]){vus[n]=1;try{new Image().src="/__manque?"+encodeURIComponent(n);}catch(e){}}
    return remplir(tr,(valeurs||[]).map(String));
  },
  noms:function(){return cacheNoms||(cacheNoms=nomsIntl());},
  changer:function(l){if(!LISTE[l]||l===langue)return;try{localStorage.setItem(CLE,l);}catch(e){}location.reload();},
  /* Remplit tous les <select class="sel-langue"> de la page et les branche. */
  brancher:function(){
    Array.prototype.forEach.call(document.querySelectorAll("select.sel-langue"),function(s){
      if(s.__branche)return;s.__branche=1;s.setAttribute("translate","no");s.innerHTML="";
      Object.keys(LISTE).forEach(function(k){var o=document.createElement("option");o.value=k;o.textContent=LISTE[k];s.appendChild(o);});
      s.value=langue;s.addEventListener("change",function(){self.I18N.changer(s.value);});
    });
  }
};
document.documentElement.lang=langue==="pcm"?"pcm":langue;
document.documentElement.dir=RTL[langue]?"rtl":"ltr";
if(langue!=="fr"&&!AUDIT){
  /* Dictionnaire de la langue choisie, chargé tout de suite (avant app.js) : trad/xx.js appelle I18N.pret(). */
  document.write('<script src="trad/'+langue+'.js"><\/script>');
}else if(document.body)demarrer();else document.addEventListener("DOMContentLoaded",demarrer);
})();
