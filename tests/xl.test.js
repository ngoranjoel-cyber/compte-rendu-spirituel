/* Vérifie le remplissage du classeur Excel et les pages imprimables. Lancer : node --test tests/xl.test.js */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const web = path.join(__dirname, "..", "web");
const JSZip = require(path.join(web, "jszip.min.js"));
const xl = require(path.join(web, "xl.js"));
const rapport = require(path.join(web, "rapport.js"));
const bac = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(web, "modele.js"), "utf8"), bac);
const modele = bac.window.MODELE_XL;

/* Novembre 2026 commence un dimanche : le mois s'étale sur 6 semaines (du 26/10 au 06/12). */
const donnees = {
  annee: 2026, mois: 11,
  entete: { nom: "Nom & <Test>", faiseur: "Faiseur", assemblee: "Assemblée • Zone" },
  infos: {
    revenu: 200000, ames: 2, livres: ["Livre A", "", "Livre C"], besoins: ["Besoin 1"],
    dons: [{ nom: "Dîme", pct: 10 }, { nom: "FMI", pct: 0.5 }, { nom: "FMN", pct: 0.5 }, { nom: "FE" }, { nom: "FG", montant: 3000 }]
  },
  jours: {
    "2026-10-27": { moi: 20 },
    "2026-11-01": { faiseur: 10, moi: 45, autre: 15, rdqd: 30, ev: 3, jc: true, chapitres: 4, sommeil: "06:30" },
    "2026-11-30": { faiseur: 90, jp: true }
  },
  semaines: { "2026-10-26": { parole: "Persévère.", sujets: ["Sujet 1", "", "Sujet 3"] } }
};

async function classeur() {
  const zip = await JSZip.loadAsync(await xl.construire(modele, donnees, JSZip));
  const lire = (p) => zip.file(p).async("string");
  return { zip, mois: await lire("xl/worksheets/sheet1.xml"), s1: await lire(xl.feuilleSemaine(1)), s6: await lire(xl.feuilleSemaine(6)), wb: await lire("xl/workbook.xml") };
}
function cellule(xml, ref) {
  const m = new RegExp('<c r="' + ref + '"[^>]*?(?:/>|>[\\s\\S]*?</c>)').exec(xml);
  return m ? m[0] : null;
}

test("les semaines vont du lundi au dimanche et couvrent tout le mois", () => {
  const nov = xl.semainesDuMois(2026, 11);
  assert.deepStrictEqual(nov.map((s) => xl.cle(s.lundi)), ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  assert.strictEqual(xl.semainesDuMois(2026, 12).length, 5);
  assert.strictEqual(xl.semainesDuMois(2027, 2).length, 4); // février 2027 commence un lundi
  assert.strictEqual(xl.cle(xl.lundiDe(new Date(2026, 10, 22, 12))), "2026-11-16");
});

test("le classeur contient les 8 feuilles, dont Semaine 6", async () => {
  const { zip, wb } = await classeur();
  for (const nom of ["MOIS", "Semaine 1", "Semaine 5", "Semaine 6", "Tableau de bord"]) assert.match(wb, new RegExp('<sheet name="' + nom + '"'));
  for (const p of ["[Content_Types].xml", "xl/styles.xml", "xl/worksheets/sheet8.xml", "xl/drawings/drawing8.xml", "xl/charts/chart1.xml"]) assert.ok(zip.file(p), p + " manquant");
});

test("feuille MOIS : en-tête, mois, revenu et formules conservées", async () => {
  const { mois } = await classeur();
  assert.match(cellule(mois, "D4"), /Nom &amp; &lt;Test&gt;/);
  assert.match(cellule(mois, "D6"), /Assemblée • Zone/);
  assert.match(cellule(mois, "D7"), /<v>11<\/v>/);
  assert.match(cellule(mois, "G7"), /<v>2026<\/v>/);
  assert.match(cellule(mois, "O4"), /<v>200000<\/v>/);
  assert.match(cellule(mois, "C13"), /'Semaine 6'!C\$10:C\$16/);
  assert.doesNotMatch(mois, /#REF!/);
});

test("feuille MOIS : rubriques de dons, pourcentages et montants", async () => {
  const { mois } = await classeur();
  assert.match(cellule(mois, "K5"), /Dîme/);
  assert.match(cellule(mois, "L5"), /<v>0\.1<\/v>/);
  assert.match(cellule(mois, "M5"), /<v>20000<\/v>/);
  assert.match(cellule(mois, "N5"), /FMI/);
  assert.match(cellule(mois, "P5"), /<v>1000<\/v>/);
  assert.match(cellule(mois, "N6"), /FE/);
  assert.doesNotMatch(cellule(mois, "P6"), /<v>/);          // FE : rien de saisi
  assert.match(cellule(mois, "K7"), /FG/);
  assert.match(cellule(mois, "L7"), /<v>0\.015<\/v>/);       // 3 000 F sur 200 000 F = 1,5 %
  assert.match(cellule(mois, "M7"), /<v>3000<\/v>/);
  assert.match(cellule(mois, "N9"), /SUM\(L5:L8,O5:O8\)/);
  assert.match(cellule(mois, "O9"), /SUM\(M5:M8,P5:P8\)/);
});

test("calcul d'une rubrique : pourcentage vers montant et montant vers pourcentage", () => {
  assert.deepStrictEqual(xl.calculerDon({ nom: "Dîme", pct: 10 }, 150000), { nom: "Dîme", pct: 10, montant: 15000 });
  assert.deepStrictEqual(xl.calculerDon({ nom: "FG", montant: 500 }, 200000), { nom: "FG", pct: 0.25, montant: 500 });
  assert.deepStrictEqual(xl.calculerDon({ nom: "FE", montant: 500 }, null), { nom: "FE", pct: null, montant: 500 });
  assert.deepStrictEqual(xl.calculerDon({ nom: "FE" }, 1000), { nom: "FE", pct: null, montant: null });
});

test("feuilles Semaine : les trois prières et les autres saisies au bon jour", async () => {
  const { s1, s6 } = await classeur();
  assert.match(cellule(s1, "D11"), /<v>/);                                     // mardi 27/10, hors du mois mais dans la semaine 1
  assert.match(cellule(s1, "C16"), new RegExp("<v>" + 10 / 1440 + "</v>"));     // dimanche 01/11 : faiseur
  assert.match(cellule(s1, "D16"), /<v>0\.03125<\/v>/);                         // moi : 45 min
  assert.match(cellule(s1, "F16"), new RegExp("<v>" + 15 / 1440 + "</v>"));     // autres
  assert.match(cellule(s1, "E16"), /^<c r="E16" s="\d+"\/>$/);                  // Conquête : colonne masquée, vide
  assert.match(cellule(s1, "H16"), /<v>3<\/v>/);
  assert.match(cellule(s1, "L16"), /<v>1<\/v>/);
  assert.match(cellule(s1, "Q16"), new RegExp("<v>" + 390 / 1440 + "</v>"));
  assert.match(cellule(s1, "A27"), /Persévère\./);
  assert.match(cellule(s1, "K27"), /Sujet 1/);
  assert.match(cellule(s1, "K29"), /Sujet 3/);
  assert.match(cellule(s6, "C10"), /<v>0\.0625<\/v>/);                          // lundi 30/11 : 90 min
  assert.match(cellule(s6, "M10"), /<v>1<\/v>/);
  assert.match(cellule(s6, "A10"), /MOIS!\$S\$10\+35/);
});

test("bilan de la semaine : objectifs et score", () => {
  const b = rapport.bilanSemaine([{ faiseur: 60, moi: 300, autre: 60, rdqd: 10, chapitres: 21, pg: 30, jc: true }, null, { rdqd: 5 }]);
  assert.deepStrictEqual(b.lignes.map((l) => [l.realise, l.objectif, Math.round(l.pct * 100), l.statut]), [
    ["7:00", "7:00", 100, "ATTEINT"], ["21", "21", 100, "ATTEINT"], ["2", "7", 29, "en cours"], ["0:30", "1:00", 50, "en cours"], ["1", "1", 100, "ATTEINT"]
  ]);
  assert.strictEqual(Math.round(b.score * 100), 76);
});

test("pages imprimables : contenu attendu et texte saisi échappé", () => {
  const profil = { nom: "NOM", prenoms: "<Prénoms>", contact: "07", assemblee: "Assemblée", zone: "Ville", faiseur: "Faiseur" };
  const s = xl.semainesDuMois(2026, 11)[0];
  const hs = rapport.semaine({ annee: 2026, mois: 11, numero: 1, profil, notes: { parole: "Ligne 1\nLigne 2", sujets: ["A"] },
    jours: s.jours.map((d) => ({ date: d, dansMois: d.getMonth() === 10, donnees: donnees.jours[xl.cle(d)] || null })) });
  assert.match(hs, /SEMAINE 1 &nbsp;•&nbsp; NOVEMBRE 2026/);
  assert.match(hs, /Du lundi 26\/10\/2026 au dimanche 01\/11\/2026/);
  assert.match(hs, /NOM &lt;Prénoms&gt;/);
  assert.match(hs, /Ligne 1<br>Ligne 2/);
  assert.strictEqual((hs.match(/class="r-hors"/g) || []).length, 6);
  const hmois = rapport.mois({ annee: 2026, mois: 11, profil, jours: [donnees.jours["2026-11-01"]],
    infos: { revenu: 200000, dons: [{ nom: "Dîme", pct: 10, montant: 20000 }], ames: 2, livres: ["L"], besoins: [] } });
  assert.match(hmois, /DU MOIS DE NOVEMBRE 2026/);
  assert.match(hmois, /200 000 F/);
  assert.match(hmois, /Dîme<\/td><td class="r-bleu">10 %<\/td><td class="r-montant">20 000 F/);
  assert.strictEqual((hmois.match(/<td class="r-jour">/g) || []).length, 30);
});

test("le modèle publié ne contient aucune donnée personnelle", () => {
  const brut = fs.readFileSync(path.join(web, "modele.js"), "utf8");
  assert.doesNotMatch(brut, /sharepoint|lastModifiedBy>[A-Z][a-z]+ [A-Z]+</i);
  const partagees = modele.texte["xl/sharedStrings.xml"];
  for (const ref of ["D4", "D5", "D6"]) {
    const i = Number(new RegExp('<c r="' + ref + '"[^>]*t="s"><v>(\\d+)</v>').exec(modele.texte["xl/worksheets/sheet1.xml"])[1]);
    assert.strictEqual(partagees.match(/<si>[\s\S]*?<\/si>/g)[i], "<si><t></t></si>");
  }
});
