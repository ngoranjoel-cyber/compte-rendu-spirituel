/* Petit fabricant de classeurs Excel (.xlsx) mis en forme, avec JSZip.
   Tableur.creer([{nom, largeurs:[…], lignes:[[cellule…]…], fusions:["A1:F1"], figer:2}], JSZip) → Promise<Uint8Array>
   Une cellule : texte, nombre, null, ou {v: valeur, s: style}.
   Styles : titre, sous, entete, texte, nombre, argent, pct, total, totalArgent, ok, alerte, note, hm (durée h:mm en minutes). */
(function (root) {
  "use strict";
  var STYLES = { "": 0, titre: 1, sous: 2, entete: 3, texte: 4, nombre: 5, argent: 6, pct: 7, total: 8, totalArgent: 9, ok: 10, alerte: 11, note: 12, hm: 13, totalHm: 14 };
  function esc(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function col(n) { var s = ""; n++; while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
  function nomFeuille(n, pris) {
    var b = String(n || "Feuille").replace(/[\\\/\?\*\[\]:]/g, " ").slice(0, 31).trim() || "Feuille", x = b, i = 2;
    while (pris[x.toLowerCase()]) { x = b.slice(0, 28) + " " + i++; }
    pris[x.toLowerCase()] = 1; return x;
  }
  function feuilleXml(f) {
    var lignes = f.lignes || [], h = [];
    h.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
    h.push('<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    h.push('<sheetViews><sheetView workbookViewId="0" showGridLines="0"' + (f.droite ? ' rightToLeft="1"' : '') + '>' +
      (f.figer ? '<pane ySplit="' + f.figer + '" topLeftCell="A' + (f.figer + 1) + '" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews>');
    h.push('<sheetFormatPr defaultRowHeight="16"/>');
    if (f.largeurs && f.largeurs.length) {
      h.push("<cols>");
      f.largeurs.forEach(function (w, i) { h.push('<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'); });
      h.push("</cols>");
    }
    h.push("<sheetData>");
    lignes.forEach(function (l, i) {
      var r = i + 1, cel = [], haut = 0;
      (l || []).forEach(function (c, j) {
        if (c === null || c === undefined || c === "") return;
        var v = c, s = "";
        if (typeof c === "object") { v = c.v; s = c.s || ""; }
        if (s === "titre") haut = 26; else if (s === "entete" && !haut) haut = 20;
        var ref = col(j) + r, st = STYLES[s] || 0;
        if (v === null || v === undefined || v === "") { if (st) cel.push('<c r="' + ref + '" s="' + st + '"/>'); return; }
        if (typeof v === "number" && isFinite(v)) {
          if (s === "hm" || s === "totalHm") v = v / 1440;      // minutes → fraction de jour
          cel.push('<c r="' + ref + '" s="' + st + '"><v>' + v + "</v></c>");
        } else cel.push('<c r="' + ref + '" s="' + st + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + "</t></is></c>");
      });
      h.push('<row r="' + r + '"' + (haut ? ' ht="' + haut + '" customHeight="1"' : "") + ">" + cel.join("") + "</row>");
    });
    h.push("</sheetData>");
    if (f.fusions && f.fusions.length) h.push('<mergeCells count="' + f.fusions.length + '">' + f.fusions.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join("") + "</mergeCells>");
    h.push('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>');
    h.push('<pageSetup paperSize="9" orientation="' + (f.paysage ? "landscape" : "portrait") + '" fitToWidth="1" fitToHeight="0"/>');
    h.push("</worksheet>");
    return h.join("");
  }
  var STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="[h]:mm"/></numFmts>' +
    '<fonts count="7">' +
    '<font><sz val="11"/><color rgb="FF26215C"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="16"/><color rgb="FF3C3489"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><i/><sz val="10"/><color rgb="FF5F5E5A"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FF26215C"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FF16734E"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFC9324A"/><name val="Calibri"/><family val="2"/></font>' +
    "</fonts>" +
    '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF5A4FCF"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEEEDFE"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF7F6FD"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FFD9D6F5"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="15">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +                                                     // 0
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                       // 1 titre
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                       // 2 sous
    '<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' + // 3 entete
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 4 texte
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +             // 5 nombre
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +           // 6 argent
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +           // 7 pct
    '<xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +                       // 8 total
    '<xf numFmtId="164" fontId="4" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>' + // 9 totalArgent
    '<xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>' +                    // 10 ok
    '<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>' +                    // 11 alerte
    '<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 12 note
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +          // 13 hm
    '<xf numFmtId="166" fontId="4" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>' + // 14 totalHm
    "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function creer(feuilles, JSZip) {
    var zip = new JSZip(), pris = {}, noms = feuilles.map(function (f) { return nomFeuille(f.nom, pris); });
    zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      feuilles.map(function (f, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") + "</Types>");
    zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    var maintenant = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    zip.file("docProps/core.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:creator>Compte rendu spirituel</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + maintenant + '</dcterms:created></cp:coreProperties>');
    zip.file("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      noms.map(function (n, i) { return '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + "</sheets></workbook>");
    zip.file("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      feuilles.map(function (f, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
      '<Relationship Id="rId' + (feuilles.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file("xl/styles.xml", STYLES_XML);
    feuilles.forEach(function (f, i) { zip.file("xl/worksheets/sheet" + (i + 1) + ".xml", feuilleXml(f)); });
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }
  var api = { creer: creer, colonne: col };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Tableur = api;
})(typeof self !== "undefined" ? self : this);
