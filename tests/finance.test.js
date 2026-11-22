const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const F = require("../web/finance.js"), JSZip = require("../web/jszip.min.js");
const AUJ = new Date(2026, 2, 10);   // 10 mars 2026

async function classeur() {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(__dirname, "donnees", "exemple-depenses.xlsx")));
  const f = {};
  for (const n of Object.keys(zip.files)) if (/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(n)) f[n] = await zip.file(n).async("string");
  return F.lireClasseur(f, AUJ);
}

test("lecture du classeur : paramètres, catégories, revenus, dépenses", async () => {
  const r = await classeur();
  assert.strictEqual(r.annee, 2026);
  assert.strictEqual(r.reglages.partDons, 25);
  assert.strictEqual(r.reglages.base, "salaire");
  assert.strictEqual(r.reglages.epargne, 50000);
  assert.deepStrictEqual(r.reglages.categories.map(c => c.type), ["dons", "courante", "courante", "offrandes", "projets", "epargne"]);
  assert.deepStrictEqual(r.reglages.paiements, ["Espèces", "Wave"]);
  const m = r.mois["2026-03"];
  assert.ok(m, "le mois de mars est lu");
  assert.strictEqual(m.salaire, 200000); assert.strictEqual(m.autres, 40000);
  assert.strictEqual(m.depenses.length, 7);
  assert.strictEqual(m.depenses[6].cat, "", "une catégorie inconnue reste non classée");
});

test("résumé du mois : mêmes règles que le fichier Excel", async () => {
  const r = await classeur(), s = F.resume(r.reglages, r.mois["2026-03"], 2026, 3, AUJ);
  assert.strictEqual(s.revenus, 240000);
  assert.strictEqual(s.base, 200000, "base = salaire seul");
  assert.strictEqual(s.objectifDons, 50000);
  assert.strictEqual(s.donsDieu, 51000);
  assert.strictEqual(s.depensesMois, 12000 + 3000 + 1000 + 2000, "hors dîme, épargne et projets ; offrandes et non classé compris");
  assert.strictEqual(s.totalSorties, 124000);
  assert.strictEqual(s.reste, 116000);
  assert.strictEqual(s.ecoules, 10);
  assert.strictEqual(s.moyenne, 1800);
  assert.strictEqual(s.projection, 1800 * 31);
  assert.strictEqual(s.jourMax, 1); assert.strictEqual(s.montantJourMax, 12000);
  const st = Object.fromEntries(s.lignes.map(l => [l.nom, l.statut]));
  assert.strictEqual(st["Dons au Seigneur"], "Atteint");
  assert.strictEqual(st["Épargne"], "Atteint");
  assert.strictEqual(st["Projets"], "Dépassé");
  assert.strictEqual(st["Nourriture"], "OK");
});

test("statuts Attention, En cours, À faire ; mois futur", () => {
  const R = F.reglages({ partDons: 10, epargne: 1000, categories: [{ id: "a", nom: "Dîme", type: "dons" }, { id: "b", nom: "Pain", type: "courante", budget: 100 }, { id: "e", nom: "Épargne", type: "epargne" }] });
  assert.strictEqual(R.categories.length, 5, "offrandes et projets ajoutés");
  const s = F.resume(R, { salaire: 10000, depenses: [{ jour: 2, cat: "b", montant: 90 }, { jour: 3, cat: "a", montant: 500 }] }, 2026, 4, AUJ);
  const st = Object.fromEntries(s.lignes.map(l => [l.id, l.statut]));
  assert.deepStrictEqual([st.a, st.b, st.e], ["En cours", "Attention", "À faire"]);
  assert.strictEqual(s.ecoules, 0); assert.strictEqual(s.projection, null);
});

test("bilan de l'année", async () => {
  const r = await classeur(), b = F.bilanAnnee(r.reglages, k => r.mois[k], 2026, AUJ);
  assert.strictEqual(b.mois.length, 12);
  assert.strictEqual(b.total.revenus, 240000);
  assert.strictEqual(b.total.epargne, 50000);
  assert.strictEqual(b.total.objectifEpargne, 50000, "l'objectif ne compte que les mois remplis");
  assert.strictEqual(b.total.reste, 116000);
  assert.strictEqual(b.totalCategories, 50000 + 12000 + 3000 + 1000 + 2000);
  assert.ok(b.categories.some(c => c.nom === "Non classé" && c.total === 2000));
});

test("montants : lecture et affichage", () => {
  assert.strictEqual(F.lireMontant("12 500"), 12500);
  assert.strictEqual(F.lireMontant("3000 F"), 3000);
  assert.strictEqual(F.lireMontant(""), null);
  assert.ok(isNaN(F.lireMontant("-5")));
  assert.strictEqual(F.formater(1234567, "FCFA"), "1 234 567 FCFA");
  assert.strictEqual(F.formater(-10200, "FCFA", true), "−10 200 F");
});
