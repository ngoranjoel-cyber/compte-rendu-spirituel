/* Rapports financiers : page imprimable (PDF) et classeur Excel, pour un mois ou pour une année.
   Dépend de finance.js (CompteRenduFinance) ; utilise I18N (langues.js) et Tableur (tableur.js) s'ils sont là. */
(function (root) {
  "use strict";
  var FIN = root.Finances;
  var I = root.I18N || { t: function (s) { return s; }, f: function (s, v) { var k = 0; return s.replace(/\{x\}|#/g, function () { return v[k++]; }); } };
  function T(s) { return I.t(s); }
  function F(s, v) { return I.f(s, v); }
  function esc(s) { return String(s === undefined || s === null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function n0(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function nb(v) { return FIN.formater(v, ""); }
  function argent(v, dev) { return FIN.formater(v, dev); }
  function pct(v) { return (Math.round(n0(v) * 1000) / 10).toString().replace(".", ",") + " %"; }
  function maj(s) { return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s; }
  function nomMois(noms, m) { return maj(noms.mois[m - 1]); }
  function dateDuJour(noms) { var d = new Date(); return d.getDate() + " " + noms.mois[d.getMonth()] + " " + d.getFullYear(); }
  var STATUT = { "Atteint": "ok", "OK": "ok", "En cours": "", "À faire": "", "Attention": "attention", "Dépassé": "alerte", "–": "" };
  function nomCat(R, id) { for (var i = 0; i < R.categories.length; i++) if (R.categories[i].id === id) return T(R.categories[i].nom); return T("Non classé"); }

  /* ---------- Style commun des rapports (dans la feuille d'aperçu) ---------- */
  var CSS = "<style>" +
    ".rf{font-family:Inter,Arial,sans-serif;color:#26215C;font-size:12.5px;line-height:1.45}" +
    ".rf-tete{display:flex;align-items:center;gap:14px;border-bottom:3px solid #5A4FCF;padding-bottom:10px;margin-bottom:12px}" +
    ".rf-tete img{width:52px;height:52px;border-radius:12px}.rf-tete h1{font-size:21px;margin:0;color:#3C3489}.rf-tete p{margin:2px 0 0;color:#5F5E5A}" +
    ".rf-tete .rf-periode{margin-left:auto;text-align:right}.rf-tete .rf-periode b{display:block;font-size:17px;color:#5A4FCF}" +
    ".rf h2{font-size:14.5px;color:#3C3489;margin:16px 0 6px;padding-left:8px;border-left:4px solid #12A89A}" +
    ".rf-synthese{background:#F7F6FD;border-radius:10px;padding:10px 14px;margin:0}.rf-synthese p{margin:4px 0}" +
    ".rf-cles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}" +
    ".rf-cle{border:1px solid #D9D6F5;border-radius:10px;padding:8px 10px}.rf-cle small{display:block;color:#5F5E5A;font-size:11px}.rf-cle b{font-size:15px}" +
    ".rf-cle.v b{color:#16734E}.rf-cle.r b{color:#C9324A}" +
    ".rf table{width:100%;border-collapse:collapse;margin:4px 0 6px;font-size:11.5px}" +
    ".rf th{background:#5A4FCF;color:#fff;text-align:left;padding:5px 7px;font-weight:700}" +
    ".rf td{padding:4px 7px;border-bottom:1px solid #E6E4F7}.rf td.n,.rf th.n{text-align:right;white-space:nowrap}" +
    ".rf tr.total td{background:#EEEDFE;font-weight:700}.rf .ok{color:#16734E;font-weight:700}.rf .attention{color:#B86B00;font-weight:700}.rf .alerte{color:#C9324A;font-weight:700}" +
    ".rf-barre{height:7px;background:#EEEDFE;border-radius:4px;overflow:hidden;min-width:60px}.rf-barre i{display:block;height:100%}" +
    ".rf-pied{margin-top:14px;padding-top:8px;border-top:1px solid #D9D6F5;color:#5F5E5A;font-size:10.5px;display:flex;justify-content:space-between}" +
    ".rf-vide{color:#5F5E5A;font-style:italic}" +
    "[dir=rtl] .rf td.n,[dir=rtl] .rf th.n{text-align:left}[dir=rtl] .rf th{text-align:right}[dir=rtl] .rf-tete .rf-periode{margin-left:0;margin-right:auto;text-align:left}" +
    "</style>";
  function entete(o, titre, periode) {
    return '<div class="rf-tete">' + (o.logo ? '<img src="' + esc(o.logo) + '" alt="">' : "") +
      "<div><h1>" + esc(titre) + "</h1><p>" + esc(o.nom || "") + "</p></div>" +
      '<div class="rf-periode"><b>' + esc(periode) + "</b><span>" + esc(T("Finances")) + "</span></div></div>";
  }
  function pied(noms) {
    return '<div class="rf-pied"><span>' + esc(F("Rapport établi le {x} avec l'application Compte rendu spirituel.", [dateDuJour(noms)])) + "</span><span>" + esc(T("Document personnel et confidentiel")) + "</span></div>";
  }
  function cle(lib, val, cls) { return '<div class="rf-cle ' + (cls || "") + '"><small>' + esc(lib) + "</small><b>" + esc(val) + "</b></div>"; }

  /* ---------- Rapport du mois ---------- */
  function donneesMois(o) {
    var R = FIN.reglages(o.reglages), M = FIN.mois(o.donnees), r = FIN.resume(R, M, o.annee, o.mois, o.aujourdhui);
    var deps = M.depenses.slice().sort(function (a, b) { return n0(a.jour) - n0(b.jour); });
    return { R: R, M: M, r: r, deps: deps };
  }
  function phrasesMois(d, noms) {
    var r = d.r, dev = r.devise, P = [], periode = noms.mois[r.mois - 1] + " " + r.annee;
    if (!r.revenus && !r.nb) return [F("Aucune donnée financière n'a été saisie pour {x}.", [periode])];
    P.push(F("En {x}, vos revenus s'élèvent à {x} (salaire {x}, autres revenus {x}).", [periode, argent(r.revenus, dev), argent(r.salaire, dev), argent(r.autres, dev)]));
    P.push(r.revenus ? F("Vos dépenses du mois atteignent {x}, soit {x} de vos revenus.", [argent(r.depensesMois, dev), pct(r.ratio)])
      : F("Vos dépenses du mois atteignent {x}.", [argent(r.depensesMois, dev)]));
    P.push(r.objectifDons ? (r.dons >= r.objectifDons
      ? F("Vous avez donné {x} à Dieu ({x} de la base) : l'objectif de {x} est atteint.", [argent(r.donsDieu, dev), pct(r.pctDons), argent(r.objectifDons, dev)])
      : F("Vous avez donné {x} à Dieu ({x} de la base) ; il reste {x} pour atteindre l'objectif de {x}.", [argent(r.donsDieu, dev), pct(r.pctDons), argent(r.resteADonner, dev), argent(r.objectifDons, dev)]))
      : F("Vous avez donné {x} à Dieu.", [argent(r.donsDieu, dev)]));
    P.push(r.objectifEpargne ? (r.epargne >= r.objectifEpargne
      ? F("Épargne mise de côté : {x}, l'objectif de {x} est atteint.", [argent(r.epargne, dev), argent(r.objectifEpargne, dev)])
      : F("Épargne mise de côté : {x} sur un objectif de {x}.", [argent(r.epargne, dev), argent(r.objectifEpargne, dev)]))
      : F("Épargne mise de côté : {x}.", [argent(r.epargne, dev)]));
    if (r.projets) P.push(F("Projets : {x}.", [argent(r.projets, dev)]));
    P.push(r.reste >= 0 ? F("Après toutes les sorties ({x}), il vous reste {x}.", [argent(r.totalSorties, dev), argent(r.reste, dev)])
      : F("Attention : les sorties ({x}) dépassent les revenus de {x}.", [argent(r.totalSorties, dev), argent(-r.reste, dev)]));
    if (r.jourMax) P.push(F("Le jour le plus dépensier est le {x} ({x}) ; la dépense moyenne est de {x} par jour.", [String(r.jourMax), argent(r.montantJourMax, dev), argent(r.moyenne, dev)]));
    var depasses = r.lignes.filter(function (l) { return l.statut === "Dépassé"; }).map(function (l) { return T(l.nom); });
    if (depasses.length) P.push(F("Budgets dépassés : {x}.", [depasses.join(", ")]));
    return P;
  }
  function htmlMois(o) {
    var d = donneesMois(o), r = d.r, R = d.R, dev = r.devise, noms = o.noms, periode = nomMois(noms, r.mois) + " " + r.annee;
    var h = CSS + '<div class="rf">' + entete(o, T("Rapport financier du mois"), periode);
    h += "<h2>" + esc(T("Synthèse")) + '</h2><div class="rf-synthese">' + phrasesMois(d, noms).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>";
    h += '<div class="rf-cles">' + cle(T("Revenus du mois"), argent(r.revenus, dev)) + cle(T("Dépenses du mois"), argent(r.depensesMois, dev)) +
      cle(T("Dons à Dieu"), argent(r.donsDieu, dev)) + cle(T("Reste du mois"), argent(r.reste, dev), r.reste >= 0 ? "v" : "r") + "</div>";
    h += "<h2>" + esc(T("Chiffres clés")) + "</h2><table><tr><th>" + esc(T("Rubrique")) + '</th><th class="n">' + esc(T("Montant")) + '</th><th class="n">' + esc(T("Part des revenus")) + "</th></tr>";
    [["Salaire", r.salaire], ["Autres revenus", r.autres], ["Dépenses courantes", r.courantes + r.nonClasse], ["Offrandes & quêtes", r.offrandes], ["Dons au Seigneur", r.dons],
     ["Épargne", r.epargne], ["Projets", r.projets]].forEach(function (x) {
      h += "<tr><td>" + esc(T(x[0])) + '</td><td class="n">' + esc(argent(x[1], dev)) + '</td><td class="n">' + (r.revenus ? esc(pct(x[1] / r.revenus)) : "–") + "</td></tr>";
    });
    h += '<tr class="total"><td>' + esc(T("Total des sorties")) + '</td><td class="n">' + esc(argent(r.totalSorties, dev)) + '</td><td class="n">' + (r.revenus ? esc(pct(r.totalSorties / r.revenus)) : "–") + "</td></tr>";
    h += '<tr class="total"><td>' + esc(T("Reste du mois")) + '</td><td class="n">' + esc(argent(r.reste, dev)) + '</td><td class="n"></td></tr></table>';
    h += "<h2>" + esc(T("Dépenses par catégorie")) + "</h2><table><tr><th>" + esc(T("Catégorie")) + '</th><th class="n">' + esc(T("Réalisé")) + '</th><th class="n">' + esc(T("Budget / objectif")) +
      '</th><th class="n">' + esc(T("Écart")) + "</th><th></th><th>" + esc(T("Statut")) + "</th></tr>";
    r.lignes.forEach(function (l) {
      if (!l.realise && !l.objectif) return;
      var p = l.objectif ? Math.min(1, l.realise / l.objectif) : 0, coul = FIN.couleurCategorie(R, l.id);
      h += "<tr><td>" + esc(T(l.nom)) + '</td><td class="n">' + esc(nb(l.realise)) + '</td><td class="n">' + (l.objectif ? esc(nb(l.objectif)) : "–") + '</td><td class="n">' + (l.objectif ? esc(nb(l.reste)) : "–") +
        '</td><td><div class="rf-barre"><i style="width:' + Math.round(p * 100) + "%;background:" + coul + '"></i></div></td><td class="' + (STATUT[l.statut] || "") + '">' + esc(T(l.statut)) + "</td></tr>";
    });
    if (r.nonClasse) h += "<tr><td>" + esc(T("Non classé")) + '</td><td class="n">' + esc(nb(r.nonClasse)) + '</td><td class="n">–</td><td class="n">–</td><td></td><td></td></tr>';
    h += "</table>";
    h += "<h2>" + esc(F("Détail des dépenses ({x})", [String(d.deps.length)])) + "</h2>";
    if (!d.deps.length) h += '<p class="rf-vide">' + esc(T("Aucune dépense ce mois-ci.")) + "</p>";
    else {
      h += "<table><tr><th>" + esc(T("Jour")) + "</th><th>" + esc(T("Description")) + "</th><th>" + esc(T("Catégorie")) + "</th><th>" + esc(T("Paiement")) + '</th><th class="n">' + esc(T("Montant")) + "</th></tr>";
      d.deps.forEach(function (x) {
        h += "<tr><td>" + esc(x.jour) + "</td><td>" + esc(x.desc || "") + "</td><td>" + esc(nomCat(R, x.cat)) + "</td><td>" + esc(x.paiement ? T(x.paiement) : "") + '</td><td class="n">' + esc(nb(x.montant)) + "</td></tr>";
      });
      h += '<tr class="total"><td colspan="4">' + esc(T("Total")) + '</td><td class="n">' + esc(argent(r.totalSorties, dev)) + "</td></tr></table>";
    }
    return h + pied(noms) + "</div>";
  }
  function excelMois(o) {
    var d = donneesMois(o), r = d.r, R = d.R, noms = o.noms, periode = nomMois(noms, r.mois) + " " + r.annee, dr = !!o.droite;
    var tete = [[{ v: T("Rapport financier du mois") + " — " + periode, s: "titre" }], [{ v: (o.nom || "") + " · " + F("Rapport établi le {x} avec l'application Compte rendu spirituel.", [dateDuJour(noms)]), s: "sous" }], []];
    var s1 = tete.concat([[{ v: T("Synthèse"), s: "entete" }, { v: "", s: "entete" }, { v: "", s: "entete" }]]);
    phrasesMois(d, noms).forEach(function (p) { s1.push([{ v: p, s: "note" }]); });
    s1.push([]);
    s1.push([{ v: T("Rubrique"), s: "entete" }, { v: T("Montant") + " (" + r.devise + ")", s: "entete" }, { v: T("Part des revenus"), s: "entete" }]);
    [["Salaire", r.salaire], ["Autres revenus", r.autres], ["Revenus du mois", r.revenus], ["Dépenses courantes", r.courantes + r.nonClasse], ["Offrandes & quêtes", r.offrandes],
     ["Dons au Seigneur", r.dons], ["Dons à Dieu", r.donsDieu], ["Objectif de dons", r.objectifDons], ["Épargne", r.epargne], ["Objectif d'épargne", r.objectifEpargne], ["Projets", r.projets],
     ["Dépenses du mois", r.depensesMois]].forEach(function (x) { s1.push([{ v: T(x[0]), s: "texte" }, { v: Math.round(x[1]), s: "argent" }, r.revenus ? { v: x[1] / r.revenus, s: "pct" } : null]); });
    s1.push([{ v: T("Total des sorties"), s: "total" }, { v: Math.round(r.totalSorties), s: "totalArgent" }, { v: "", s: "total" }]);
    s1.push([{ v: T("Reste du mois"), s: "total" }, { v: Math.round(r.reste), s: "totalArgent" }, { v: "", s: "total" }]);
    var debut = 4, fus = []; for (var i = 0; i < phrasesMois(d, noms).length; i++) fus.push("A" + (debut + 1 + i) + ":C" + (debut + 1 + i));
    var s2 = tete.concat([[{ v: T("Catégorie"), s: "entete" }, { v: T("Réalisé"), s: "entete" }, { v: T("Budget / objectif"), s: "entete" }, { v: T("Écart"), s: "entete" }, { v: T("Part des revenus"), s: "entete" }, { v: T("Statut"), s: "entete" }]]);
    r.lignes.forEach(function (l) {
      s2.push([{ v: T(l.nom), s: "texte" }, { v: Math.round(l.realise), s: "argent" }, l.objectif ? { v: Math.round(l.objectif), s: "argent" } : { v: "–", s: "texte" },
        l.objectif ? { v: Math.round(l.reste), s: "argent" } : { v: "–", s: "texte" }, { v: l.pctBase, s: "pct" }, { v: T(l.statut), s: l.statut === "Dépassé" ? "alerte" : (l.statut === "Atteint" || l.statut === "OK") ? "ok" : "texte" }]);
    });
    if (r.nonClasse) s2.push([{ v: T("Non classé"), s: "texte" }, { v: Math.round(r.nonClasse), s: "argent" }]);
    s2.push([{ v: T("Total"), s: "total" }, { v: Math.round(r.totalSorties), s: "totalArgent" }]);
    var s3 = tete.concat([[{ v: T("Jour"), s: "entete" }, { v: T("Description"), s: "entete" }, { v: T("Catégorie"), s: "entete" }, { v: T("Paiement"), s: "entete" }, { v: T("Montant") + " (" + r.devise + ")", s: "entete" }]]);
    d.deps.forEach(function (x) { s3.push([{ v: n0(x.jour), s: "nombre" }, { v: x.desc || "", s: "texte" }, { v: nomCat(R, x.cat), s: "texte" }, { v: x.paiement ? T(x.paiement) : "", s: "texte" }, { v: Math.round(n0(x.montant)), s: "argent" }]); });
    s3.push([{ v: T("Total"), s: "total" }, { v: "", s: "total" }, { v: "", s: "total" }, { v: "", s: "total" }, { v: Math.round(r.totalSorties), s: "totalArgent" }]);
    return [
      { nom: T("Synthèse"), largeurs: [38, 20, 18], lignes: s1, fusions: fus, droite: dr },
      { nom: T("Catégories"), largeurs: [30, 16, 18, 16, 16, 14], lignes: s2, figer: 4, droite: dr },
      { nom: T("Dépenses"), largeurs: [8, 36, 24, 18, 16], lignes: s3, figer: 4, droite: dr }
    ];
  }

  /* ---------- Rapport de l'année ---------- */
  function phrasesAnnee(b, noms) {
    var t = b.total, dev = b.devise, P = [], remplis = b.mois.filter(function (m) { return m.rempli; });
    if (!remplis.length) return [F("Aucune donnée financière n'a été saisie pour {x}.", [String(b.annee)])];
    P.push(F("En {x} : {x} mois suivis, revenus {x}, dépenses {x}.", [String(b.annee), String(remplis.length), argent(t.revenus, dev), argent(t.depenses, dev)]));
    P.push(F("Total donné à Dieu : {x}, soit {x} de la base.", [argent(t.donsDieu, dev), pct(t.pctDons)]));
    P.push(t.objectifEpargne ? F("Épargne de l'année : {x} sur un objectif de {x}.", [argent(t.epargne, dev), argent(t.objectifEpargne, dev)]) : F("Épargne de l'année : {x}.", [argent(t.epargne, dev)]));
    if (t.projets) P.push(F("Projets : {x}.", [argent(t.projets, dev)]));
    P.push(t.reste >= 0 ? F("Reste cumulé sur l'année : {x}.", [argent(t.reste, dev)]) : F("Attention : sur l'année, les sorties dépassent les revenus de {x}.", [argent(-t.reste, dev)]));
    var plus = remplis.slice().sort(function (a, c) { return c.depenses - a.depenses; })[0];
    if (plus && plus.depenses) P.push(F("Mois le plus dépensier : {x} ({x}).", [nomMois(noms, plus.mois), argent(plus.depenses, dev)]));
    var top = b.categories.filter(function (c) { return c.type === "courante" && c.total; }).sort(function (a, c) { return c.total - a.total; }).slice(0, 3);
    if (top.length) P.push(F("Principaux postes de dépense : {x}.", [top.map(function (c) { return T(c.nom) + " (" + pct(c.part) + ")"; }).join(", ")]));
    return P;
  }
  function htmlAnnee(o) {
    var R = FIN.reglages(o.reglages), b = FIN.bilanAnnee(R, o.lireMois, o.annee, o.aujourdhui), t = b.total, dev = b.devise, noms = o.noms;
    var h = CSS + '<div class="rf">' + entete(o, T("Rapport financier de l'année"), String(b.annee));
    h += "<h2>" + esc(T("Synthèse")) + '</h2><div class="rf-synthese">' + phrasesAnnee(b, noms).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>";
    h += '<div class="rf-cles">' + cle(T("Revenus"), argent(t.revenus, dev)) + cle(T("Dépenses"), argent(t.depenses, dev)) + cle(T("Dons à Dieu"), argent(t.donsDieu, dev)) +
      cle(T("Reste cumulé"), argent(t.reste, dev), t.reste >= 0 ? "v" : "r") + "</div>";
    h += "<h2>" + esc(T("Bilan par mois")) + "</h2><table><tr><th>" + esc(T("Mois")) + '</th><th class="n">' + esc(T("Revenus")) + '</th><th class="n">' + esc(T("Dépenses")) +
      '</th><th class="n">' + esc(T("Dons à Dieu")) + '</th><th class="n">' + esc(T("% dons")) + '</th><th class="n">' + esc(T("Épargne")) + '</th><th class="n">' + esc(T("Projets")) + '</th><th class="n">' + esc(T("Reste")) + "</th></tr>";
    b.mois.forEach(function (m) {
      h += "<tr><td>" + esc(nomMois(noms, m.mois)) + "</td>" + (m.rempli ? ['revenus', 'depenses', 'donsDieu'].map(function (k) { return '<td class="n">' + esc(nb(m[k])) + "</td>"; }).join("") +
        '<td class="n">' + esc(pct(m.pctDons)) + '</td><td class="n">' + esc(nb(m.epargne)) + '</td><td class="n">' + esc(nb(m.projets)) + '</td><td class="n' + (m.reste < 0 ? " alerte" : "") + '">' + esc(nb(m.reste)) + "</td>"
        : '<td class="n" colspan="7" style="text-align:center;color:#9A98B5">—</td>') + "</tr>";
    });
    h += '<tr class="total"><td>' + esc(T("Total")) + '</td><td class="n">' + esc(nb(t.revenus)) + '</td><td class="n">' + esc(nb(t.depenses)) + '</td><td class="n">' + esc(nb(t.donsDieu)) +
      '</td><td class="n">' + esc(pct(t.pctDons)) + '</td><td class="n">' + esc(nb(t.epargne)) + '</td><td class="n">' + esc(nb(t.projets)) + '</td><td class="n">' + esc(nb(t.reste)) + "</td></tr></table>";
    h += "<h2>" + esc(T("Dépenses par catégorie")) + "</h2><table><tr><th>" + esc(T("Catégorie")) + '</th><th class="n">' + esc(T("Total")) + '</th><th class="n">' + esc(T("Part")) + "</th><th></th></tr>";
    b.categories.filter(function (c) { return c.total; }).sort(function (a, c) { return c.total - a.total; }).forEach(function (c) {
      h += "<tr><td>" + esc(T(c.nom)) + '</td><td class="n">' + esc(nb(c.total)) + '</td><td class="n">' + esc(pct(c.part)) + '</td><td><div class="rf-barre"><i style="width:' + Math.round(c.part * 100) +
        "%;background:" + (c.id ? FIN.couleurCategorie(R, c.id) : "#B9C0D8") + '"></i></div></td></tr>';
    });
    h += '<tr class="total"><td>' + esc(T("Total")) + '</td><td class="n">' + esc(argent(b.totalCategories, dev)) + '</td><td class="n">100 %</td><td></td></tr></table>';
    return h + pied(noms) + "</div>";
  }
  function excelAnnee(o) {
    var R = FIN.reglages(o.reglages), b = FIN.bilanAnnee(R, o.lireMois, o.annee, o.aujourdhui), t = b.total, noms = o.noms, dr = !!o.droite, P = phrasesAnnee(b, noms);
    var tete = [[{ v: T("Rapport financier de l'année") + " — " + b.annee, s: "titre" }], [{ v: (o.nom || "") + " · " + F("Rapport établi le {x} avec l'application Compte rendu spirituel.", [dateDuJour(noms)]), s: "sous" }], []];
    var s1 = tete.concat([[{ v: T("Synthèse"), s: "entete" }].concat(new Array(8).fill({ v: "", s: "entete" }))]), fus = [];
    P.forEach(function (p, i) { s1.push([{ v: p, s: "note" }]); fus.push("A" + (5 + i) + ":I" + (5 + i)); });
    s1.push([]);
    s1.push([T("Mois"), T("Revenus"), T("Dépenses"), T("Dons à Dieu"), T("% dons"), T("Épargne"), T("Objectif d'épargne"), T("Projets"), T("Reste")].map(function (x) { return { v: x, s: "entete" }; }));
    var ligneTete = s1.length;
    b.mois.forEach(function (m) {
      s1.push([{ v: nomMois(noms, m.mois), s: "texte" }].concat(m.rempli ? [{ v: Math.round(m.revenus), s: "argent" }, { v: Math.round(m.depenses), s: "argent" }, { v: Math.round(m.donsDieu), s: "argent" },
        { v: m.pctDons, s: "pct" }, { v: Math.round(m.epargne), s: "argent" }, { v: Math.round(m.objectifEpargne), s: "argent" }, { v: Math.round(m.projets), s: "argent" }, { v: Math.round(m.reste), s: m.reste < 0 ? "alerte" : "argent" }] : []));
    });
    s1.push([{ v: T("Total"), s: "total" }, { v: Math.round(t.revenus), s: "totalArgent" }, { v: Math.round(t.depenses), s: "totalArgent" }, { v: Math.round(t.donsDieu), s: "totalArgent" },
      { v: (Math.round(t.pctDons * 1000) / 10) + " %", s: "total" }, { v: Math.round(t.epargne), s: "totalArgent" }, { v: Math.round(t.objectifEpargne), s: "totalArgent" }, { v: Math.round(t.projets), s: "totalArgent" }, { v: Math.round(t.reste), s: "totalArgent" }]);
    var s2 = tete.concat([[{ v: T("Catégorie"), s: "entete" }].concat(noms.moisC.map(function (x) { return { v: maj(x), s: "entete" }; })).concat([{ v: T("Total"), s: "entete" }, { v: T("Part"), s: "entete" }])]);
    b.categories.forEach(function (c) {
      s2.push([{ v: T(c.nom), s: "texte" }].concat(c.parMois.map(function (v) { return { v: Math.round(v), s: "argent" }; })).concat([{ v: Math.round(c.total), s: "totalArgent" }, { v: c.part, s: "pct" }]));
    });
    var tot = [{ v: T("Total"), s: "total" }];
    for (var m = 0; m < 12; m++) tot.push({ v: Math.round(b.categories.reduce(function (x, c) { return x + n0(c.parMois[m]); }, 0)), s: "totalArgent" });
    tot.push({ v: Math.round(b.totalCategories), s: "totalArgent" });
    s2.push(tot);
    var s3 = tete.concat([[T("Mois"), T("Jour"), T("Description"), T("Catégorie"), T("Paiement"), T("Montant") + " (" + b.devise + ")"].map(function (x) { return { v: x, s: "entete" }; })]);
    for (m = 1; m <= 12; m++) {
      FIN.mois(o.lireMois(FIN.cleMois(b.annee, m))).depenses.slice().sort(function (a, c) { return n0(a.jour) - n0(c.jour); }).forEach(function (x) {
        s3.push([{ v: nomMois(noms, m), s: "texte" }, { v: n0(x.jour), s: "nombre" }, { v: x.desc || "", s: "texte" }, { v: nomCat(R, x.cat), s: "texte" }, { v: x.paiement ? T(x.paiement) : "", s: "texte" }, { v: Math.round(n0(x.montant)), s: "argent" }]);
      });
    }
    return [
      { nom: T("Bilan de l'année"), largeurs: [16, 14, 14, 14, 10, 14, 16, 14, 14], lignes: s1, fusions: fus, figer: ligneTete, paysage: true, droite: dr },
      { nom: T("Catégories"), largeurs: [26].concat(new Array(12).fill(11)).concat([14, 9]), lignes: s2, figer: 4, paysage: true, droite: dr },
      { nom: T("Dépenses"), largeurs: [14, 7, 34, 24, 18, 16], lignes: s3, figer: 4, droite: dr }
    ];
  }

  var api = { htmlMois: htmlMois, excelMois: excelMois, htmlAnnee: htmlAnnee, excelAnnee: excelAnnee, phrasesMois: function (o) { return phrasesMois(donneesMois(o), o.noms); } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RapportFinance = api;
})(typeof self !== "undefined" ? self : this);
