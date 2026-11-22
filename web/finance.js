/* Finances personnelles : réglages, résumé du mois, bilan de l'année et lecture d'un classeur Excel.
   Les règles reprennent le fichier « Dépenses journalières » :
   - dons au Seigneur : objectif = un pourcentage du salaire (ou du salaire + autres revenus) ;
   - « dépenses du mois » = tout, sauf les dons au Seigneur, l'épargne et les projets (les offrandes y restent) ;
   - reste du mois = revenus − toutes les sorties. */
(function (racine) {
  "use strict";

  var MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  var TYPES = { dons: "Dons à Dieu", offrandes: "Dons à Dieu", epargne: "Épargne et projets", projets: "Épargne et projets", courante: "Dépenses courantes" };
  var COULEURS = ["#5A4FCF", "#12A89A", "#FFC21A", "#F2546A", "#2FB866", "#F29A2E", "#9B93E8", "#6FD3C9", "#E86FA4", "#3E8EDE", "#B7A000", "#7A6FF0", "#20B8A0", "#E5704B"];

  function n0(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function cleMois(a, m) { return a + "-" + pad(m); }
  function joursDuMois(a, m) { return new Date(a, m, 0).getDate(); }

  function reglagesParDefaut() {
    var noms = [
      ["Dons au Seigneur", "dons", 0], ["Dons aux frères", "courante", 0], ["Dons aux parents", "courante", 0], ["Dons aux autres", "courante", 0],
      ["Nourriture", "courante", 0], ["Transferts", "courante", 0], ["Transport", "courante", 0], ["Voyages", "courante", 0],
      ["Autres", "courante", 0], ["Soins médicaux", "courante", 0], ["Vêtements", "courante", 0], ["Loyer", "courante", 0],
      ["Offrandes & quêtes", "offrandes", 0], ["Projets", "projets", 0], ["Épargne", "epargne", 0]
    ];
    return {
      devise: "FCFA", partDons: 25, base: "total", epargne: 0,
      categories: noms.map(function (x, i) { return { id: "c" + (i + 1), nom: x[0], type: x[1], budget: x[2] }; }),
      paiements: ["Espèces", "Mobile money", "Carte", "Virement", "Autre"]
    };
  }
  /* Complète des réglages enregistrés (ou absents) avec les valeurs par défaut. */
  function reglages(r) {
    var d = reglagesParDefaut();
    if (!r || typeof r !== "object") return d;
    var o = {
      devise: r.devise || d.devise,
      partDons: r.partDons === undefined || r.partDons === null || r.partDons === "" ? d.partDons : n0(r.partDons),
      base: r.base === "salaire" ? "salaire" : "total",
      epargne: n0(r.epargne),
      categories: Array.isArray(r.categories) && r.categories.length ? r.categories.map(function (c) {
        return { id: String(c.id), nom: String(c.nom || "Sans nom"), type: TYPES[c.type] ? c.type : "courante", budget: n0(c.budget) };
      }) : d.categories,
      paiements: Array.isArray(r.paiements) && r.paiements.length ? r.paiements.slice() : d.paiements
    };
    ["dons", "offrandes", "epargne", "projets"].forEach(function (t) {     // les quatre catégories spéciales existent toujours
      if (!o.categories.some(function (c) { return c.type === t; })) {
        var c = d.categories.filter(function (x) { return x.type === t; })[0];
        o.categories.push({ id: nouvelId(o.categories, t), nom: c.nom, type: t, budget: 0 });
      }
    });
    return o;
  }
  function nouvelId(liste, pref) {
    var i = liste.length + 1, ids = {};
    liste.forEach(function (c) { ids[c.id] = 1; });
    while (ids[(pref || "c") + i]) i++;
    return (pref || "c") + i;
  }
  /* Couleurs fixes pour les catégories spéciales, puis une couleur par dépense courante. */
  var COULEUR_TYPE = { dons: "#FFC21A", offrandes: "#F29A2E", epargne: "#5A4FCF", projets: "#12A89A" };
  var COULEURS_COURANTES = ["#F2546A", "#2FB866", "#3E8EDE", "#9B93E8", "#E86FA4", "#20B8A0", "#E5704B", "#7A6FF0", "#B7A000", "#6FD3C9", "#C9324A", "#16734E"];
  function couleurCategorie(R, id) {
    var k = -1, c = null;
    R.categories.forEach(function (x) { if (x.type === "courante") k++; if (x.id === id && !c) c = { x: x, k: k }; });
    if (!c) return "#B9C0D8";
    return COULEUR_TYPE[c.x.type] || COULEURS_COURANTES[c.k % COULEURS_COURANTES.length];
  }
  function moisVide() { return { salaire: 0, autres: 0, depenses: [] }; }
  function mois(v) {
    if (!v || typeof v !== "object") return moisVide();
    return { salaire: n0(v.salaire), autres: n0(v.autres), depenses: Array.isArray(v.depenses) ? v.depenses : [] };
  }

  /* Résumé d'un mois. aujourdhui : Date (pour les jours écoulés et la projection). */
  function resume(Rbrut, Mbrut, a, m, aujourdhui) {
    var R = reglages(Rbrut), M = mois(Mbrut), J = joursDuMois(a, m);
    var debut = new Date(a, m - 1, 1), auj = aujourdhui || new Date();
    var aujMidi = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate());
    var ecoules = debut > aujMidi ? 0 : Math.min(J, Math.round((aujMidi - debut) / 864e5) + 1);
    var revenus = M.salaire + M.autres, base = R.base === "salaire" ? M.salaire : revenus;
    var parCat = {}, parType = { dons: 0, offrandes: 0, epargne: 0, projets: 0, courante: 0 }, nonClasse = 0, total = 0, parJour = [];
    for (var j = 0; j <= J; j++) parJour.push(0);
    var types = {}; R.categories.forEach(function (c) { types[c.id] = c.type; parCat[c.id] = 0; });
    M.depenses.forEach(function (d) {
      var v = n0(d.montant); total += v;
      var ty = types[d.cat] || "courante", jr = Math.round(n0(d.jour));
      if (jr >= 1 && jr <= J && (ty === "courante" || ty === "offrandes")) parJour[jr] += v;   // comme les « dépenses du mois »
      if (types[d.cat]) { parCat[d.cat] += v; parType[types[d.cat]] += v; } else nonClasse += v;
    });
    var objDons = R.partDons / 100 * base;
    var depensesMois = parType.offrandes + parType.courante + nonClasse;
    var lignes = R.categories.map(function (c) {
      var obj = c.type === "dons" ? objDons : c.type === "epargne" ? R.epargne : c.budget, v = parCat[c.id];
      var cible = c.type === "dons" || c.type === "epargne";
      var statut = !obj ? "–" : cible ? (v >= obj ? "Atteint" : v > 0 ? "En cours" : "À faire") : (v > obj ? "Dépassé" : v > 0.8 * obj ? "Attention" : "OK");
      return { id: c.id, nom: c.nom, type: c.type, realise: v, objectif: obj, reste: obj ? obj - v : null, pctBase: base ? v / base : 0, statut: statut };
    });
    var max = 0, jourMax = null;
    for (j = 1; j <= J; j++) if (parJour[j] > max) { max = parJour[j]; jourMax = j; }
    var moyenne = ecoules ? depensesMois / ecoules : 0;
    return {
      annee: a, mois: m, nomMois: MOIS[m - 1], jours: J, ecoules: ecoules, devise: R.devise,
      salaire: M.salaire, autres: M.autres, revenus: revenus, base: base,
      dons: parType.dons, offrandes: parType.offrandes, donsDieu: parType.dons + parType.offrandes, objectifDons: objDons,
      pctDons: base ? (parType.dons + parType.offrandes) / base : 0, resteADonner: Math.max(0, objDons - parType.dons),
      epargne: parType.epargne, objectifEpargne: R.epargne, resteAEpargner: Math.max(0, R.epargne - parType.epargne), projets: parType.projets,
      courantes: parType.courante, nonClasse: nonClasse, depensesMois: depensesMois, totalSorties: total,
      reste: revenus - total, moyenne: moyenne, projection: ecoules >= 5 ? moyenne * J : null,
      jourMax: jourMax, montantJourMax: max, ratio: revenus ? depensesMois / revenus : null,
      nb: M.depenses.length, parJour: parJour, lignes: lignes,
      budgetCourantes: R.categories.reduce(function (x, c) { return x + (c.type === "courante" ? c.budget : 0); }, 0)
    };
  }

  /* Bilan de l'année : lireMois(cle "AAAA-MM") rend les données du mois (ou null). */
  function bilanAnnee(Rbrut, lireMois, a, aujourdhui) {
    var R = reglages(Rbrut), lignes = [], cats = {};
    R.categories.forEach(function (c) { if (c.type !== "epargne" && c.type !== "projets") cats[c.id] = { id: c.id, nom: c.nom, type: c.type, parMois: [], total: 0 }; });
    var nonClasse = { id: "", nom: "Non classé", type: "courante", parMois: [], total: 0 };
    for (var m = 1; m <= 12; m++) {
      var brut = lireMois(cleMois(a, m)), r = resume(R, brut, a, m, aujourdhui), rempli = !!(r.nb || r.revenus);
      lignes.push({ mois: m, nom: MOIS[m - 1], rempli: rempli, revenus: r.revenus, depenses: r.depensesMois, donsDieu: r.donsDieu, pctDons: r.pctDons,
        epargne: r.epargne, objectifEpargne: rempli ? r.objectifEpargne : 0, projets: r.projets, reste: rempli ? r.reste : 0, nb: r.nb, totalSorties: r.totalSorties });
      r.lignes.forEach(function (l) { if (cats[l.id]) { cats[l.id].parMois.push(l.realise); cats[l.id].total += l.realise; } });
      nonClasse.parMois.push(r.nonClasse); nonClasse.total += r.nonClasse;
    }
    var total = { revenus: 0, depenses: 0, donsDieu: 0, epargne: 0, objectifEpargne: 0, projets: 0, reste: 0, nb: 0, base: 0 };
    lignes.forEach(function (l) { ["revenus", "depenses", "donsDieu", "epargne", "objectifEpargne", "projets", "reste", "nb"].forEach(function (k) { total[k] += l[k]; }); });
    for (m = 1; m <= 12; m++) total.base += resume(R, lireMois(cleMois(a, m)), a, m, aujourdhui).base;
    total.pctDons = total.base ? total.donsDieu / total.base : 0;
    var liste = Object.keys(cats).map(function (k) { return cats[k]; });
    if (nonClasse.total) liste.push(nonClasse);
    var somme = liste.reduce(function (x, c) { return x + c.total; }, 0);
    liste.forEach(function (c) { c.part = somme ? c.total / somme : 0; });
    return { annee: a, mois: lignes, total: total, categories: liste, totalCategories: somme, devise: R.devise };
  }

  /* ---------- Montants ---------- */
  function formater(v, devise, court) {
    var n = Math.round(n0(v)), s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return (n < 0 ? "−" : "") + s + (devise === "" ? "" : " " + (court ? "F" : (devise || "FCFA")));
  }
  function lireMontant(t) {
    if (typeof t === "number") return t;
    var s = String(t || "").replace(/[\s  ]/g, "").replace(/f(cfa)?$/i, "").replace(",", ".");
    if (!s) return null;
    var n = Number(s);
    return isFinite(n) && n >= 0 ? Math.round(n) : NaN;
  }

  /* ---------- Lecture d'un classeur Excel (format du fichier « Dépenses journalières ») ----------
     fichiers : { "xl/workbook.xml": texte, "xl/_rels/workbook.xml.rels": texte, "xl/sharedStrings.xml": texte, "xl/worksheets/sheetN.xml": texte } */
  function texteXml(s) {
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (x, c) { return String.fromCharCode(+c); }).replace(/&amp;/g, "&");
  }
  function chainesPartagees(xml) {
    var l = [], re = /<si>([\s\S]*?)<\/si>/g, m;
    while ((m = re.exec(xml || ""))) {
      var t = "", r = /<t[^>]*>([\s\S]*?)<\/t>/g, x;
      while ((x = r.exec(m[1]))) t += texteXml(x[1]);
      l.push(t);
    }
    return l;
  }
  function colNum(c) { var n = 0; for (var i = 0; i < c.length; i++) n = n * 26 + c.charCodeAt(i) - 64; return n; }
  function cellules(xml, chaines) {
    var g = {}, re = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, m;
    while ((m = re.exec(xml))) {
      var att = m[3], corps = m[4] || "", v = /<v>([\s\S]*?)<\/v>/.exec(corps), t = /\bt="(\w+)"/.exec(att), val = null;
      if (t && t[1] === "s" && v) val = chaines[+v[1]];
      else if (t && t[1] === "inlineStr") { var it = /<t[^>]*>([\s\S]*?)<\/t>/.exec(corps); val = it ? texteXml(it[1]) : ""; }
      else if (t && (t[1] === "str" || t[1] === "e") && v) val = texteXml(v[1]);
      else if (t && t[1] === "b" && v) val = v[1] === "1";
      else if (v) val = Number(v[1]);
      if (val === null || val === "") continue;
      var l = +m[2]; (g[l] = g[l] || {})[colNum(m[1])] = val;
    }
    return g;
  }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
  function nombreADroite(ligne, col) {
    for (var c = col + 1; c <= col + 4; c++) { if (typeof ligne[c] === "number") return ligne[c]; if (typeof ligne[c] === "string" && c > col + 1) break; }
    return null;
  }
  function chercher(g, test) {
    for (var l in g) for (var c in g[l]) if (typeof g[l][c] === "string" && test(norm(g[l][c]))) return { l: +l, c: +c };
    return null;
  }
  function typeParNom(n) {
    n = norm(n);
    if (/^dons? au seigneur|dime/.test(n)) return "dons";
    if (/offrande|quete/.test(n)) return "offrandes";
    if (/^epargne/.test(n)) return "epargne";
    if (/^projets?$/.test(n)) return "projets";
    return "courante";
  }
  function lireClasseur(fichiers, aujourdhui) {
    var chaines = chainesPartagees(fichiers["xl/sharedStrings.xml"]), rels = {}, re, m;
    re = /<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g;
    while ((m = re.exec(fichiers["xl/_rels/workbook.xml.rels"] || ""))) rels[m[1]] = m[2];
    re = /<Relationship [^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"/g;
    while ((m = re.exec(fichiers["xl/_rels/workbook.xml.rels"] || ""))) rels[m[2]] = m[1];
    var feuilles = [];
    re = /<sheet [^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g;
    while ((m = re.exec(fichiers["xl/workbook.xml"] || ""))) {
      var cible = (rels[m[2]] || "").replace(/^\/?xl\//, "").replace(/^\//, "");
      feuilles.push({ nom: texteXml(m[1]), xml: fichiers["xl/" + cible] || "" });
    }
    if (!feuilles.length) throw new Error("Ce fichier ne ressemble pas à un classeur Excel.");
    var R = reglagesParDefaut(), annee = (aujourdhui || new Date()).getFullYear(), trouveReglages = false;

    /* Paramètres */
    var fp = feuilles.filter(function (f) { return /^param/.test(norm(f.nom)); })[0];
    if (fp) {
      var g = cellules(fp.xml, chaines);
      var ann = chercher(g, function (t) { return t === "annee"; }); if (ann) { var va = nombreADroite(g[ann.l], ann.c); if (va > 1900) annee = va; }
      var dv = chercher(g, function (t) { return t === "devise"; }); if (dv && typeof g[dv.l][dv.c + 1] === "string") R.devise = g[dv.l][dv.c + 1];
      var pd = chercher(g, function (t) { return /^part des dons/.test(t); }); if (pd) { var vp = nombreADroite(g[pd.l], pd.c); if (vp !== null) R.partDons = Math.round((vp <= 1 ? vp * 100 : vp) * 100) / 100; }
      var bs = chercher(g, function (t) { return /^base de calcul/.test(t); }); if (bs && typeof g[bs.l][bs.c + 1] === "string") R.base = /seul/.test(norm(g[bs.l][bs.c + 1])) ? "salaire" : "total";
      var ep = chercher(g, function (t) { return /^epargne a mettre/.test(t); }); if (ep) R.epargne = n0(nombreADroite(g[ep.l], ep.c));
      var tc = chercher(g, function (t) { return /^categories/.test(t) && !/moyens/.test(t); });
      if (tc) {
        var cats = [], l = tc.l + 1;
        while (g[l] && typeof g[l][tc.c] === "string") {
          var nom = g[l][tc.c].trim(), b = g[l][tc.c + 1];
          cats.push({ id: "c" + (cats.length + 1), nom: nom, type: typeParNom(nom), budget: typeof b === "number" ? b : 0 });
          l++;
        }
        if (cats.length) { R.categories = cats; trouveReglages = true; }
      }
      var mp = chercher(g, function (t) { return /^moyens de paiement/.test(t); });
      if (mp) { var p = [], k = mp.l + 1; while (g[k] && typeof g[k][mp.c] === "string") { p.push(g[k][mp.c].trim()); k++; } if (p.length) R.paiements = p; }
    }
    R = reglages(R);
    var idParNom = {}; R.categories.forEach(function (c) { idParNom[norm(c.nom)] = c.id; });

    /* Feuilles des mois */
    var lesMois = {}, nbDepenses = 0;
    feuilles.forEach(function (f) {
      var nm = norm(f.nom), num = -1;
      MOIS.forEach(function (x, i) { if (nm === norm(x) || nm.indexOf(norm(x)) === 0) num = i + 1; });
      if (num < 0) return;
      var g = cellules(f.xml, chaines), h = chercher(g, function (t) { return t === "description"; });
      if (!h) return;
      var cols = {};
      for (var c in g[h.l]) { var t = norm(g[h.l][c]); if (t === "jour") cols.jour = +c; else if (t === "description") cols.desc = +c; else if (t === "categorie") cols.cat = +c; else if (t === "montant") cols.montant = +c; else if (t === "paiement") cols.paie = +c; }
      if (!cols.montant) return;
      var M = moisVide(), J = joursDuMois(annee, num), sal = chercher(g, function (t) { return t === "salaire du mois"; }), aut = chercher(g, function (t) { return t === "autres revenus"; });
      if (sal) M.salaire = n0(nombreADroite(g[sal.l], sal.c));
      if (aut) M.autres = n0(nombreADroite(g[aut.l], aut.c));
      Object.keys(g).map(Number).sort(function (x, y) { return x - y; }).forEach(function (l) {
        if (l <= h.l) return;
        var r = g[l], v = r[cols.montant];
        if (typeof v !== "number" || !v) return;
        var cat = cols.cat && typeof r[cols.cat] === "string" ? idParNom[norm(r[cols.cat])] || "" : "";
        M.depenses.push({ id: "x" + num + "-" + l, jour: Math.min(J, Math.max(1, Math.round(n0(r[cols.jour])) || 1)), desc: cols.desc && r[cols.desc] !== undefined ? String(r[cols.desc]) : "",
          cat: cat, montant: Math.round(v), paiement: cols.paie && typeof r[cols.paie] === "string" ? r[cols.paie] : "" });
      });
      if (M.depenses.length || M.salaire || M.autres) { lesMois[cleMois(annee, num)] = M; nbDepenses += M.depenses.length; }
    });
    if (!trouveReglages && !Object.keys(lesMois).length) throw new Error("Aucune page de paramètres ni de mois n'a été trouvée dans ce fichier.");
    return { annee: annee, reglages: R, mois: lesMois, nbDepenses: nbDepenses };
  }

  var api = {
    MOIS: MOIS, TYPES: TYPES, COULEURS: COULEURS, reglagesParDefaut: reglagesParDefaut, reglages: reglages, nouvelId: nouvelId,
    couleurCategorie: couleurCategorie, mois: mois, resume: resume, bilanAnnee: bilanAnnee, cleMois: cleMois, joursDuMois: joursDuMois,
    formater: formater, lireMontant: lireMontant, lireClasseur: lireClasseur
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.Finances = api;
})(typeof self !== "undefined" ? self : this);
