/* Construit web/langue-<langue>.js à partir de i18n/fr.txt (référence) et i18n/<langue>.txt (lignes « N|traduction »).
   Ajoute les noms des mois et des jours (Intl). Vérifie les « # » et « {x} ».
   Usage : node outils/construire-langues.js [langue…] */
const fs=require('fs'),path=require('path');
const R=path.join(__dirname,'..'),I=path.join(R,'i18n');
const fr=fs.readFileSync(path.join(I,'fr.txt'),'utf8').split('\n').filter(l=>l!=='');
const MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const JOURS=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"],JC=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
const maj=s=>s.charAt(0).toLocaleUpperCase()+s.slice(1);
const marques=s=>(s.match(/#|\{x\}/g)||[]).length;
let langues=process.argv.slice(2);
if(!langues.length)langues=fs.readdirSync(I).filter(f=>f.endsWith('.txt')&&f!=='fr.txt').map(f=>f.slice(0,-4));
let ok=true;
for(const l of langues){
  const lignes=fs.readFileSync(path.join(I,l+'.txt'),'utf8').split('\n').filter(x=>x.trim());
  const tr=new Array(fr.length).fill(null);const err=[];
  for(const x of lignes){
    const m=/^(\d+)\|(.*)$/.exec(x);if(!m){err.push('ligne illisible : '+x.slice(0,60));continue;}
    const n=+m[1];if(n<1||n>fr.length){err.push('numéro hors liste : '+n);continue;}
    if(tr[n-1]!=null)err.push('numéro en double : '+n);
    tr[n-1]=m[2].trim();
  }
  tr.forEach((t,i)=>{
    if(t==null){err.push('manque '+(i+1)+' : '+fr[i]);return;}
    const explicite=/\{\d\}/.test(t);
    if(!explicite&&marques(t)!==marques(fr[i]))err.push('marques différentes '+(i+1)+' : '+fr[i]+' → '+t);
  });
  /* Les modèles génériques « {x} · {x} » passent en dernier : les modèles précis d'abord. */
  const GEN=new Set(['{x} · {x} · # {x}','{x} · # FCFA · # {x}','{x} · {x} · {x}','{x} · {x}']);
  const paires=fr.map((f,i)=>[f,tr[i]]).filter(p=>p[1]!=null).sort((a,b)=>(GEN.has(a[0])?1:0)-(GEN.has(b[0])?1:0));
  const f=o=>new Intl.DateTimeFormat(l,o);
  for(let m=0;m<12;m++){const d=new Date(2024,m,15),lg=f({month:'long'}).format(d);paires.unshift([MOIS[m],lg],[maj(MOIS[m]),maj(lg)]);}
  for(let j=0;j<7;j++){const d=new Date(2024,8,1+j);paires.unshift([JOURS[j],maj(f({weekday:'long'}).format(d))],[JC[j],f({weekday:'short'}).format(d)]);}
  if(err.length){ok=false;console.log(l+' : '+err.length+' problème(s)');err.slice(0,15).forEach(e=>console.log('  '+e));}
  fs.writeFileSync(path.join(R,'web','langue-'+l+'.js'),'/* Généré par outils/construire-langues.js — ne pas modifier à la main : éditer i18n/'+l+'.txt */\nself.TRADUCTIONS='+JSON.stringify(paires)+';\nif(self.I18N)I18N.pret();\n');
  console.log(l+' : '+paires.length+' entrées'+(err.length?'':' ✓'));
}
process.exit(ok?0:1);
