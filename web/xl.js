/* Remplit le classeur Excel du compte rendu spirituel (feuilles MOIS et Semaine 1 à 6). */
(function (root) {
  var MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  var NB_DONS = 8;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function cle(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  /* Lundi de la semaine qui contient la date (les semaines vont du lundi au dimanche). */
  function lundiDe(d) {
    var l = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
    l.setDate(l.getDate() - ((l.getDay() + 6) % 7));
    return l;
  }
  /* Les semaines du mois : [{numero, lundi, jours:[7 dates]}], 4 à 6 semaines. */
  function semainesDuMois(annee, mois) {
    var lundi = lundiDe(new Date(annee, mois - 1, 1, 12)), fin = new Date(annee, mois, 0, 12), out = [];
    for (var k = 1; k <= 6; k++) {
      var l = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + (k - 1) * 7, 12);
      if (l > fin) break;
      var jours = [];
      for (var i = 0; i < 7; i++) jours.push(new Date(l.getFullYear(), l.getMonth(), l.getDate() + i, 12));
      out.push({ numero: k, lundi: l, jours: jours });
    }
    return out;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Écrit une valeur dans une cellule existante en gardant son style. */
  function setCell(xml, ref, val) {
    var re = new RegExp('<c r="' + ref + '"([^>]*?)(/>|>[\\s\\S]*?</c>)');
    var m = re.exec(xml);
    if (!m) return xml;
    var attrs = m[1].replace(/\s+t="[^"]*"/, "");
    var cell;
    if (val === null || val === undefined || val === "") {
      cell = '<c r="' + ref + '"' + attrs + "/>";
    } else if (typeof val === "number") {
      cell = '<c r="' + ref + '"' + attrs + "><v>" + val + "</v></c>";
    } else {
      cell = '<c r="' + ref + '"' + attrs + ' t="inlineStr"><is><t xml:space="preserve">' + esc(val) + "</t></is></c>";
    }
    return xml.slice(0, m.index) + cell + xml.slice(m.index + m[0].length);
  }

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function duree(v) { var n = num(v); return n === null ? null : n / 1440; }
  function heure(v) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(v || "");
    return m ? (Number(m[1]) * 60 + Number(m[2])) / 1440 : null;
  }
  function un(v) { return v ? 1 : null; }

  /* Colonnes des feuilles Semaine (E « Conquête » et G « Disciple » sont masquées et restent vides). */
  var COLONNES = [
    ["C", "faiseur", duree], ["D", "moi", duree], ["F", "autre", duree],
    ["H", "ev", num], ["I", "rdqd", duree], ["J", "pg", duree], ["K", "rs", duree],
    ["L", "jc", un], ["M", "jp", un],
    ["N", "chapitres", num], ["O", "lectureMin", duree], ["P", "lc", duree], ["Q", "sommeil", heure]
  ];
  /* Emplacements des 8 rubriques de dons sur la feuille MOIS : [libellé, pourcentage, montant]. */
  function caseDon(i) {
    var ligne = 5 + Math.floor(i / 2);
    return i % 2 === 0 ? ["K" + ligne, "L" + ligne, "M" + ligne] : ["N" + ligne, "O" + ligne, "P" + ligne];
  }

  /* Complète une rubrique : le montant vient du pourcentage si le revenu est connu, et inversement. */
  function calculerDon(don, revenu) {
    var pct = num(don && don.pct), montant = num(don && don.montant), r = num(revenu);
    if (pct !== null && r !== null) montant = Math.round(r * pct / 100);
    else if (pct === null && montant !== null && r) pct = Math.round(montant / r * 10000) / 100;
    return { nom: don && don.nom ? String(don.nom).trim() : "", pct: pct, montant: montant };
  }

  function remplirMois(xml, d) {
    var e = d.entete || {}, inf = d.infos || {};
    xml = setCell(xml, "D4", e.nom || "");
    xml = setCell(xml, "D5", e.faiseur || "");
    xml = setCell(xml, "D6", e.assemblee || "");
    xml = setCell(xml, "D7", d.mois);
    xml = setCell(xml, "G7", d.annee);
    xml = setCell(xml, "O4", num(inf.revenu));
    var dons = (inf.dons || []).filter(function (x) { return x && x.nom && String(x.nom).trim(); }).slice(0, NB_DONS);
    for (var i = 0; i < NB_DONS; i++) {
      var c = caseDon(i), don = dons[i] ? calculerDon(dons[i], inf.revenu) : null;
      xml = setCell(xml, c[0], don ? don.nom : "");
      xml = setCell(xml, c[1], don && don.pct !== null ? don.pct / 100 : null);
      xml = setCell(xml, c[2], don ? don.montant : null);
    }
    xml = setCell(xml, "N49", num(inf.ames) === null ? 0 : num(inf.ames));
    var livres = (inf.livres || []).filter(function (x) { return x && String(x).trim(); });
    var besoins = (inf.besoins || []).filter(function (x) { return x && String(x).trim(); });
    xml = setCell(xml, "N50", livres.length ? livres.length : null);
    for (var a = 0; a < 4; a++) xml = setCell(xml, "B" + (53 + a), livres[a] || "");
    for (var b = 0; b < 5; b++) xml = setCell(xml, "L" + (53 + b), besoins[b] || "");
    return xml;
  }

  function remplirSemaine(xml, semaine, d) {
    var jours = d.jours || {};
    for (var i = 0; i < 7; i++) {
      var e = semaine ? (jours[cle(semaine.jours[i])] || {}) : {};
      for (var c = 0; c < COLONNES.length; c++) {
        xml = setCell(xml, COLONNES[c][0] + (10 + i), COLONNES[c][2](e[COLONNES[c][1]]));
      }
    }
    var s = semaine ? ((d.semaines || {})[cle(semaine.lundi)] || {}) : {};
    xml = setCell(xml, "A27", s.parole || "");
    for (var j = 0; j < 3; j++) xml = setCell(xml, "K" + (27 + j), (s.sujets || [])[j] || "");
    return xml;
  }

  /* Traduit les textes du modèle (libellés, formules, commentaires, graphiques, noms de feuilles) avec tr(texte).
     La mise en forme et les formules restent celles du classeur d'origine ; les données saisies ne sont pas touchées. */
  function deXml(s) { return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); }
  function versXml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function traduireModele(textes, tr) {
    function t(s) { var r = tr(s); return r == null ? s : String(r); }
    function texte(s) { return versXml(t(deXml(s))); }
    /* Chaînes entre guillemets d'une formule : "Lun", "ATTEINT"… */
    function formule(f) { return versXml(deXml(f).replace(/"((?:[^"]|"")*)"/g, function (m, x) { return '"' + t(x.replace(/""/g, '"')).replace(/"/g, '""') + '"'; })); }
    /* Noms de feuilles : MOIS, Semaine 1 à 6, Tableau de bord (31 caractères au plus, sans : \ / ? * [ ] '). */
    var noms = {}, wb = textes["xl/workbook.xml"] || "";
    wb.replace(/<sheet name="([^"]+)"/g, function (m, n) {
      var v = t(deXml(n)).replace(/[:\\\/?*\[\]']/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
      if (v && v !== deXml(n)) noms[deXml(n)] = v;
      return m;
    });
    var vus = {};
    Object.keys(noms).forEach(function (k) { if (vus[noms[k]]) delete noms[k]; else vus[noms[k]] = 1; });
    function renommer(f) {
      Object.keys(noms).forEach(function (n) {
        var nv = "'" + noms[n] + "'!";
        f = f.split("'" + n + "'!").join(nv);
        if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(n)) f = f.replace(new RegExp("(^|[^A-Za-z0-9_.'])" + n + "!", "g"), "$1" + nv);
      });
      return f;
    }
    var out = {};
    Object.keys(textes).forEach(function (chemin) {
      var x = textes[chemin];
      if (!/\.(xml|vml)$/.test(chemin) || /styles|theme|rels|Content_Types|core\.xml|drawings\/drawing/.test(chemin)) { out[chemin] = x; return; }
      if (chemin === "xl/sharedStrings.xml" || chemin === "xl/comments1.xml")
        x = x.replace(/(<t(?: [^>]*)?>)([^<]*)(<\/t>)/g, function (m, a, c, b) { return a + texte(c) + b; });
      if (/^xl\/charts\//.test(chemin)) {
        x = x.replace(/(<a:t>)([^<]*)(<\/a:t>)/g, function (m, a, c, b) { return a + texte(c) + b; });
        x = x.replace(/(<c:f>)([^<]*)(<\/c:f>)/g, function (m, a, c, b) { return a + versXml(renommer(deXml(c))) + b; });
      }
      if (/^xl\/worksheets\/sheet/.test(chemin)) {
        x = x.replace(/(<f(?: [^>]*)?>)([^<]*)(<\/f>)/g, function (m, a, c, b) { return a + versXml(renommer(deXml(formule(c)))) + b; });
        x = x.replace(/(<formula>)([^<]*)(<\/formula>)/g, function (m, a, c, b) { return a + versXml(renommer(deXml(formule(c)))) + b; });
        x = x.replace(/(<xm:f>)([^<]*)(<\/xm:f>)/g, function (m, a, c, b) { return a + versXml(renommer(deXml(c))) + b; });
      }
      if (chemin === "xl/workbook.xml") {
        x = x.replace(/<sheet name="([^"]+)"/g, function (m, n) { var v = noms[deXml(n)]; return v ? '<sheet name="' + versXml(v).replace(/"/g, "&quot;") + '"' : m; });
        x = x.replace(/(<definedName [^>]*>)([^<]*)(<\/definedName>)/g, function (m, a, c, b) { return a + versXml(renommer(deXml(c))) + b; });
      }
      out[chemin] = x;
    });
    return out;
  }

  function feuilleSemaine(k) { return "xl/worksheets/sheet" + (k <= 5 ? k + 1 : 8) + ".xml"; }

  /* d = { annee, mois (1-12), entete:{nom,faiseur,assemblee}, infos:{revenu,dons[],ames,livres[],besoins[]},
           jours:{ "AAAA-MM-JJ": {...} }, semaines:{ "AAAA-MM-JJ" (lundi): {parole, sujets[]} } } */
  function construire(modele, d, JSZip) {
    var zip = new JSZip(), semaines = semainesDuMois(d.annee, d.mois), parFeuille = {};
    for (var k = 1; k <= 6; k++) parFeuille[feuilleSemaine(k)] = semaines[k - 1] || null;
    var textes = d.traduire ? traduireModele(modele.texte, d.traduire) : modele.texte;
    Object.keys(textes).forEach(function (chemin) {
      var t = textes[chemin];
      if (chemin === "xl/worksheets/sheet1.xml") t = remplirMois(t, d);
      else if (chemin in parFeuille) t = remplirSemaine(t, parFeuille[chemin], d);
      zip.file(chemin, t);
    });
    Object.keys(modele.binaire).forEach(function (chemin) {
      zip.file(chemin, modele.binaire[chemin], { base64: true });
    });
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }

  var api = {
    construire: construire, traduireModele: traduireModele, remplirMois: remplirMois, remplirSemaine: remplirSemaine, setCell: setCell,
    semainesDuMois: semainesDuMois, lundiDe: lundiDe, cle: cle, calculerDon: calculerDon, feuilleSemaine: feuilleSemaine,
    MOIS: MOIS, NB_DONS: NB_DONS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CompteRenduXL = api;
})(typeof self !== "undefined" ? self : this);
