/* Calculs et pages imprimables (PDF) du compte rendu : une semaine (paysage) ou un mois (portrait). */
(function (root) {
  var MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  var JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  /* Objectifs par défaut, ceux de la feuille « Tableau de bord » du classeur. */
  var OBJECTIFS = { priereParJour: 60, chapitresParJour: 3, rdqdParSemaine: 7, groupeParSemaine: 60, jeuneParSemaine: 1 };

  /* Textes traduits dans la langue choisie (langues.js) ; en français, rien ne change. */
  /* langues.js peut être chargé après ce fichier : I18N est cherché au moment de l'appel. */
  function T(s) { return root.I18N ? root.I18N.t(s) : s; }
  function F(s, v) { if (root.I18N) return root.I18N.f(s, v); var k = 0; return s.replace(/\{x\}|#/g, function () { return v[k++]; }); }
  function pts(s) { return s.replace(/ • /g, " &nbsp;•&nbsp; "); }
  function moisMaj(m) { return T(MOIS[m - 1]).toUpperCase(); }
  function jour(d) { return T(JOURS[d.getDay()]); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function n0(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function hm(min, zero) {
    min = Math.round(n0(min));
    if (!min) return zero ? "0:00" : "";
    return Math.floor(min / 60) + ":" + pad(min % 60);
  }
  function jjmm(d) { return pad(d.getDate()) + "/" + pad(d.getMonth() + 1); }
  function argent(v) { return Math.round(n0(v)).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " F"; }
  function pct(v) { return (Math.round(n0(v) * 100) / 100).toLocaleString("fr-FR") + " %"; }

  /* Totaux d'une liste de journées (objets de saisie, éventuellement vides). */
  function totaux(jours) {
    var t = { faiseur: 0, moi: 0, autre: 0, seul: 0, ev: 0, rdqd: 0, nRdqd: 0, pg: 0, rs: 0, jc: 0, jp: 0, chapitres: 0, lecture: 0, lc: 0, remplis: 0 };
    jours.forEach(function (d) {
      if (!d) return;
      t.remplis++;
      t.faiseur += n0(d.faiseur); t.moi += n0(d.moi); t.autre += n0(d.autre);
      t.ev += n0(d.ev); t.rdqd += n0(d.rdqd); if (n0(d.rdqd) > 0) t.nRdqd++;
      t.pg += n0(d.pg); t.rs += n0(d.rs); t.jc += d.jc ? 1 : 0; t.jp += d.jp ? 1 : 0;
      t.chapitres += n0(d.chapitres); t.lecture += n0(d.lectureMin); t.lc += n0(d.lc);
    });
    t.seul = t.faiseur + t.moi + t.autre;
    return t;
  }

  /* Bilan d'une semaine par rapport aux objectifs : lignes + score (moyenne des pourcentages, plafonnés à 100 %). */
  /* Objectifs personnels (réglages du disciple), complétés par les objectifs par défaut. */
  function objectifs(perso) {
    var o = {};
    Object.keys(OBJECTIFS).forEach(function (k) { var v = perso && Number(perso[k]); o[k] = perso && isFinite(v) && v >= 0 && perso[k] !== "" && perso[k] !== null ? v : OBJECTIFS[k]; });
    return o;
  }
  function bilanSemaine(jours, perso) {
    var t = totaux(jours), o = objectifs(perso);
    var lignes = [
      ["Prière seul (h:mm)", t.seul, o.priereParJour * 7, hm],
      ["Lecture biblique (chapitres)", t.chapitres, o.chapitresParJour * 7, String],
      ["RDQD (nombre de jours)", t.nRdqd, o.rdqdParSemaine, String],
      ["Prière en groupe (h:mm)", t.pg, o.groupeParSemaine, hm],
      ["Jeûne (jours JC + JP)", t.jc + t.jp, o.jeuneParSemaine, String]
    ].map(function (l) {
      var p = l[2] > 0 ? l[1] / l[2] : 0;
      return { nom: l[0], realise: l[3](l[1], true), objectif: l[3](l[2], true), pct: p,
        statut: p >= 1 ? "ATTEINT" : (l[1] > 0 ? "en cours" : "à commencer") };
    });
    var score = lignes.reduce(function (s, l) { return s + Math.min(1, l.pct); }, 0) / lignes.length;
    var message = score >= 1 ? "Tous les objectifs sont atteints !" : score >= 0.75 ? "Très bonne semaine, continue !" :
      score >= 0.5 ? "Bon effort, persévère." : score > 0 ? "Courage, chaque jour compte." : "Semaine à remplir.";
    return { lignes: lignes, score: score, message: message, totaux: t };
  }

  var COLONNES = '<colgroup><col style="width:6%"><col style="width:6%">' + new Array(14).join("<col>") + "</colgroup>";
  function ENTETE() { return (
    '<th class="r-rouge" colspan="3">PRIÈRE SEUL</th><th class="r-vif" rowspan="2">EV</th><th rowspan="2">RDQD</th><th rowspan="2">PG</th><th rowspan="2">RS</th>' +
    '<th class="r-rouge" colspan="2">JEÛNE</th><th class="r-petit" colspan="2">LECTURE BIBLIQUE</th><th rowspan="2">LC</th><th class="r-noir" rowspan="2">SOMMEIL</th></tr>' +
    '<tr class="r-sous"><th>Faiseur</th><th>Moi</th><th>Autres</th><th>JC</th><th>JP</th><th>Chapitres</th><th>Temps</th></tr>').replace(/>([^<>]+)</g, function (m, x) { return ">" + T(x) + "<"; }); }

  function cellules(d) {
    d = d || {};
    function nb(v) { return v === undefined || v === null || v === "" ? "" : String(v); }
    return [hm(d.faiseur), hm(d.moi), hm(d.autre), nb(d.ev), hm(d.rdqd), hm(d.pg), hm(d.rs), d.jc ? "1" : "", d.jp ? "1" : "",
      nb(d.chapitres), hm(d.lectureMin), hm(d.lc), d.sommeil || ""].map(function (v) { return "<td>" + esc(v) + "</td>"; }).join("");
  }
  function ligneTotal(t, colspan) {
    return '<tr class="r-total"><td colspan="' + colspan + '">' + T("Total") + '</td>' +
      [hm(t.faiseur, 1), hm(t.moi, 1), hm(t.autre, 1), t.ev, hm(t.rdqd, 1), hm(t.pg, 1), hm(t.rs, 1), t.jc, t.jp, t.chapitres, hm(t.lecture, 1), hm(t.lc, 1), ""]
        .map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>";
  }
  function identite(p) {
    p = p || {};
    function l(nom, val, cls) { return '<tr><th>' + T(nom) + '</th><td class="' + (cls || "") + '">' + esc(val) + "</td></tr>"; }
    return '<table class="r-identite">' +
      l("NOM ET PRÉNOMS :", ((p.nom || "") + " " + (p.prenoms || "")).trim(), "r-nom") +
      l("CONTACT :", p.contact) +
      l("FAISEUR DE DISCIPLE :", p.faiseur, "r-bleu") +
      l("ASSEMBLÉE CHEZ :", p.assemblee, "r-rougetxt") +
      l("ZONE / VILLE :", p.zone) + "</table>";
  }
  function logo(src) { return src ? '<img class="r-logo" alt="" src="' + esc(src) + '">' : ""; }
  function LEGENDE() { return T(LEGENDE_FR); }
  var LEGENDE_FR = "EV : évangélisation • RDQD : rencontre dynamique quotidienne avec Dieu • PG : prière en groupe • RS • JC : jeûne complet • JP : jeûne partiel • LC : lecture chrétienne";

  /* d = { annee, mois, numero, jours:[{date, dansMois, donnees}], profil, notes:{parole, sujets[]}, logo } */
  function semaine(d) {
    var b = bilanSemaine(d.jours.map(function (j) { return j.donnees; }), d.objectifs);
    var debut = d.jours[0].date, fin = d.jours[6].date, notes = d.notes || {};
    var h = '<div class="rapport r-paysage" dir="ltr">';
    h += '<div class="r-titre">' + pts(F("COMPTE RENDU SPIRITUEL • SEMAINE # • {x} #", [d.numero, moisMaj(d.mois), d.annee])) + "</div>";
    h += '<div class="r-dates">' + F("Du lundi {x} au dimanche {x}", [jjmm(debut) + "/" + debut.getFullYear(), jjmm(fin) + "/" + fin.getFullYear()]) + "</div>";
    h += '<div class="r-haut">' + identite(d.profil) + logo(d.logo) +
      '<table class="r-score"><tr><th colspan="2">' + T("SCORE DE LA SEMAINE") + '</th></tr><tr><td class="r-pct">' + Math.round(b.score * 100) + " %</td><td>" + esc(T(b.message)) + "</td></tr></table></div>";
    h += '<table class="r-grille r-semaine">' + COLONNES + '<tr><th rowspan="2">' + T("Date") + '</th><th rowspan="2">' + T("Jour") + '</th>' + ENTETE();
    d.jours.forEach(function (j) {
      var cls = !j.dansMois ? "r-hors" : (j.date.getDay() === 0 || j.date.getDay() === 6 ? "r-we" : "");
      h += '<tr class="' + cls + '"><td class="r-gras">' + jjmm(j.date) + '</td><td class="r-jour">' + jour(j.date) + "</td>" + cellules(j.donnees) + "</tr>";
    });
    h += ligneTotal(b.totaux, 2) + "</table>";
    h += '<table class="r-grille r-bilan"><tr><th class="r-vert">' + T("BILAN DE LA SEMAINE") + '</th><th>' + T("Réalisé") + '</th><th>' + T("Objectif") + '</th><th>%</th><th>' + T("Progression") + '</th><th>' + T("Statut") + '</th></tr>';
    b.lignes.forEach(function (l) {
      h += '<tr><td class="r-lib">' + T(l.nom) + '</td><td class="r-gras">' + l.realise + '</td><td class="r-verttxt">' + l.objectif + '</td><td class="r-gras">' + Math.round(l.pct * 100) +
        ' %</td><td><div class="r-barre"><i style="width:' + Math.round(Math.min(1, l.pct) * 100) + '%"></i></div></td><td class="' + (l.statut === "ATTEINT" ? "r-atteint" : "") + '">' + T(l.statut) + "</td></tr>";
    });
    h += "</table>";
    h += '<div class="r-bas"><div class="r-bloc"><div class="r-bandeau">' + T("QU'EST-CE QUE DIEU T'A DIT CETTE SEMAINE ?") + '</div><div class="r-texte">' + esc(notes.parole).replace(/\n/g, "<br>") + "</div></div>";
    h += '<div class="r-bloc"><div class="r-bandeau">' + T("SUJETS DE PRIÈRE / ENGAGEMENTS DE LA SEMAINE") + '</div><table class="r-liste">';
    for (var i = 0; i < 3; i++) h += "<tr><th>" + (i + 1) + "</th><td>" + esc((notes.sujets || [])[i]) + "</td></tr>";
    h += "</table></div></div>";
    h += '<div class="r-legende">' + T("Les jours grisés sont hors du mois : ils comptent dans le total de la semaine, pas dans celui du mois.") + " " + LEGENDE() + "</div></div>";
    return h;
  }

  /* d = { annee, mois, jours:[31 journées ou null, index 0 = le 1er], profil, infos:{revenu, dons[{nom,pct,montant}], ames, livres[], besoins[]}, logo } */
  function mois(d) {
    var nb = new Date(d.annee, d.mois, 0).getDate(), inf = d.infos || {}, t = totaux(d.jours.slice(0, nb));
    var dons = (inf.dons || []).filter(function (x) { return x && x.nom; });
    var totalPct = 0, totalMontant = 0;
    var h = '<div class="rapport r-portrait" dir="ltr">';
    h += '<div class="r-titre">' + F("COMPTE RENDU SPIRITUEL DU MOIS DE {x} #", [moisMaj(d.mois), d.annee]) + "</div>";
    h += '<div class="r-haut">' + identite(d.profil) + logo(d.logo) + '<table class="r-dons"><tr><th colspan="3" class="r-vert">' + T("DONS AU SEIGNEUR") + '</th></tr>';
    h += '<tr><td class="r-lib" colspan="2">' + T("Revenu du mois (FCFA)") + '</td><td class="r-montant r-bleu">' + (inf.revenu === undefined || inf.revenu === null || inf.revenu === "" ? "" : argent(inf.revenu)) + "</td></tr>";
    dons.forEach(function (x) {
      totalPct += n0(x.pct); totalMontant += n0(x.montant);
      h += '<tr><td class="r-lib">' + esc(x.nom) + '</td><td class="r-bleu">' + (x.pct === null || x.pct === undefined ? "" : pct(x.pct)) + '</td><td class="r-montant">' +
        (x.montant === null || x.montant === undefined ? "" : argent(x.montant)) + "</td></tr>";
    });
    h += '<tr class="r-total"><td>' + T("TOTAL") + '</td><td>' + pct(totalPct) + '</td><td class="r-montant">' + argent(totalMontant) + "</td></tr></table></div>";
    h += '<table class="r-grille r-mois">' + COLONNES + '<tr><th rowspan="2">' + T("N°") + '</th><th rowspan="2">' + T("Jour") + '</th>' + ENTETE();
    for (var j = 1; j <= nb; j++) {
      var dt = new Date(d.annee, d.mois - 1, j, 12), we = dt.getDay() === 0 || dt.getDay() === 6;
      h += '<tr class="' + (we ? "r-we" : "") + '"><td class="r-gras">' + j + '</td><td class="r-jour">' + jour(dt) + "</td>" + cellules(d.jours[j - 1]) + "</tr>";
    }
    h += ligneTotal(t, 2) + "</table>";
    var livres = (inf.livres || []).filter(function (x) { return x && String(x).trim(); });
    h += '<table class="r-grille r-synthese"><tr><th class="r-vert" colspan="6">' + T("SYNTHÈSE DU MOIS") + '</th></tr>' +
      '<tr><td class="r-lib">' + T("Total prière seul") + '</td><td class="r-gras">' + hm(t.seul, 1) + "</td><td>" + F("{x} par jour", [hm(t.seul / nb, 1)]) + '</td><td class="r-lib">' + T("Nombre de RDQD") + '</td><td class="r-gras">' + t.nRdqd + "</td><td></td></tr>" +
      '<tr><td class="r-lib">' + T("Prière en groupe") + '</td><td class="r-gras">' + hm(t.pg, 1) + "</td><td>" + F("{x} par jour", [hm(t.pg / nb, 1)]) + '</td><td class="r-lib">' + T("Temps de RDQD") + '</td><td class="r-gras">' + hm(t.rdqd, 1) + "</td><td>" + F("{x} par RDQD", [hm(t.nRdqd ? t.rdqd / t.nRdqd : 0, 1)]) + "</td></tr>" +
      '<tr><td class="r-lib">' + T("Lecture biblique (chapitres)") + '</td><td class="r-gras">' + t.chapitres + "</td><td>" + F("{x} chap. par jour", [(Math.round(t.chapitres / nb * 10) / 10).toLocaleString("fr-FR")]) + '</td><td class="r-lib">' + T("Âmes gagnées et intégrées") + '</td><td class="r-gras">' + n0(inf.ames) + "</td><td></td></tr>" +
      '<tr><td class="r-lib">' + T("Jours de jeûne (JC + JP)") + '</td><td class="r-gras">' + (t.jc + t.jp) + "</td><td>" + F("# JC • # JP", [t.jc, t.jp]) + '</td><td class="r-lib">' + T("Livres lus") + '</td><td class="r-gras">' + livres.length + "</td><td></td></tr></table>";
    h += '<div class="r-bas"><div class="r-bloc"><div class="r-bandeau">' + T("LIVRES LUS") + '</div><table class="r-liste">';
    for (var a = 0; a < 4; a++) h += "<tr><th>" + (a + 1) + "</th><td>" + esc(livres[a]) + "</td></tr>";
    h += '</table></div><div class="r-bloc"><div class="r-bandeau">' + T("BESOINS DE PRIÈRE") + '</div><table class="r-liste">';
    var besoins = (inf.besoins || []).filter(function (x) { return x && String(x).trim(); });
    for (var b = 0; b < 5; b++) h += "<tr><th>" + (b + 1) + "</th><td>" + esc(besoins[b]) + "</td></tr>";
    h += "</table></div></div>";
    h += '<div class="r-legende">' + T("Jaune pâle : week-end.") + " " + LEGENDE() + "</div></div>";
    return h;
  }

  var api = { semaine: semaine, mois: mois, totaux: totaux, bilanSemaine: bilanSemaine, objectifs: objectifs, hm: hm, OBJECTIFS: OBJECTIFS, MOIS: MOIS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CompteRenduRapport = api;
})(typeof self !== "undefined" ? self : this);
