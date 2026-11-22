"""Prépare le modèle Excel embarqué dans l'application à partir du classeur d'origine décompressé.
Usage : python3 prep2.py <dossier du classeur décompressé> <web/modele.js>"""
import re, json, base64, sys, os
src, out = sys.argv[1], sys.argv[2]
def rd(p, b=False):
    with open(os.path.join(src, p), 'rb') as f:
        d = f.read()
    return d if b else d.decode('utf8')
def sub1(pat, rep, s, flags=0, n=1):
    s2, k = re.subn(pat, rep, s, flags=flags)
    assert k == n, (pat, k)
    return s2
T = {}

# --- Feuilles : enlever les valeurs en cache des formules, masquer Conquête (E) et Disciple (G)
def sans_cache(sh):
    def f(m):
        c = m.group(0)
        return re.sub(r'<v>.*?</v>|<v/>', '', c, flags=re.S) if '<f' in c else c
    return re.sub(r'<c r="[A-Z]+\d+"[^>]*?>.*?</c>', f, sh, flags=re.S)
def masquer(sh, colonnes, largeurs):
    m = re.search(r'<cols>(.*?)</cols>', sh, re.S)
    cols = []
    for c in re.findall(r'<col [^>]*/>', m.group(1)):
        a = dict(re.findall(r'(\w+)="([^"]*)"', c))
        for i in range(int(a['min']), int(a['max']) + 1):
            b = dict(a); b['min'] = b['max'] = str(i)
            if i in colonnes: b['hidden'] = '1'
            if i in largeurs: b['width'] = str(float(b['width']) + largeurs[i]); b['customWidth'] = '1'
            cols.append('<col ' + ' '.join('%s="%s"' % kv for kv in b.items()) + '/>')
    return sh[:m.start()] + '<cols>' + ''.join(cols) + '</cols>' + sh[m.end():]

mois = rd('xl/worksheets/sheet1.xml')
# Semaine 6 : la référence était cassée (#REF!) dans le classeur d'origine
mois, k = re.subn(r"'Semaine 5'!([A-Q])\$10:\1\$16,#REF!", r"'Semaine 5'!\1$10:\1$16,'Semaine 6'!\1$10:\1$16", mois)
assert k == 930 and '#REF!' not in mois, k
# Bloc « Dons au Seigneur » : 8 rubriques (2 par ligne, lignes 5 à 8), total en ligne 9
s_pct = re.search(r'<c r="N6" s="(\d+)"', mois).group(1)
def ligne(r):
    return ('<c r="K%d" s="122"/><c r="L%d" s="%s"/><c r="M%d" s="134"/><c r="N%d" s="122"/><c r="O%d" s="%s"/><c r="P%d" s="134"/><c r="Q%d" s="124"/>'
            % (r, r, s_pct, r, r, r, s_pct, r, r))
for r in (5, 6, 7, 8):
    mois = sub1(r'(<row r="%d"[^>]*>.*?)<c r="K%d".*?<c r="Q%d"[^>]*?/>' % (r, r, r), lambda m, r=r: m.group(1) + ligne(r), mois, re.S)
total = ('<c r="K9" s="144" t="inlineStr"><is><t>TOTAL</t></is></c><c r="L9" s="145"/><c r="M9" s="146"/>'
         '<c r="N9" s="19"><f>SUM(L5:L8,O5:O8)</f></c><c r="O9" s="157"><f>SUM(M5:M8,P5:P8)</f></c><c r="P9" s="145"/><c r="Q9" s="146"/>')
mois = sub1(r'(<row r="9"[^>]*>.*?)<c r="K9".*?<c r="Q9"[^>]*?/>', lambda m: m.group(1) + total, mois, re.S)
for ref in ('K5:M5', 'K6:M6', 'K7:M7', 'K8:M8', 'O5:Q5', 'O6:Q6', 'O7:Q7', 'O8:Q8', 'K9:Q9'):
    mois = sub1(r'<mergeCell ref="%s"/>' % ref, '', mois)
ajout = ''.join('<mergeCell ref="%s"/>' % r for r in ('P5:Q5', 'P6:Q6', 'P7:Q7', 'P8:Q8', 'K9:M9', 'O9:Q9'))
mois = sub1(r'<mergeCells count="(\d+)">', lambda m: '<mergeCells count="%d">%s' % (int(m.group(1)) - 9 + 6, ajout), mois)
T['xl/worksheets/sheet1.xml'] = masquer(sans_cache(mois), {5, 7}, {3: 6, 4: 6, 6: 6})

for n in range(2, 8):
    sh = sans_cache(rd('xl/worksheets/sheet%d.xml' % n))
    if n <= 6: sh = masquer(sh, {5, 7}, {3: 5, 4: 5, 6: 5, 8: 2.5})
    T['xl/worksheets/sheet%d.xml' % n] = sh
    T['xl/worksheets/_rels/sheet%d.xml.rels' % n] = rd('xl/worksheets/_rels/sheet%d.xml.rels' % n)
T['xl/worksheets/_rels/sheet1.xml.rels'] = rd('xl/worksheets/_rels/sheet1.xml.rels')

# Semaine 6 = copie de Semaine 5, décalée de 7 jours
s6 = T['xl/worksheets/sheet6.xml']
for i in range(34, 27, -1):
    s6 = sub1(r'MOIS!\$S\$10\+%d<' % i, 'MOIS!$S$10+%d<' % (i + 7), s6)
s6 = sub1('SEMAINE 5', 'SEMAINE 6', s6, n=s6.count('SEMAINE 5'))
s6 = sub1(r'xr:uid="\{00000000-0001-0000-0500-000000000000\}"', 'xr:uid="{00000000-0001-0000-0800-000000000000}"', s6)
s6 = s6.replace(' tabSelected="1"', '')
T['xl/worksheets/sheet8.xml'] = s6
T['xl/worksheets/_rels/sheet8.xml.rels'] = T['xl/worksheets/_rels/sheet6.xml.rels'].replace('drawing6.xml', 'drawing8.xml')
for n in range(1, 8):
    T['xl/drawings/drawing%d.xml' % n] = rd('xl/drawings/drawing%d.xml' % n)
    T['xl/drawings/_rels/drawing%d.xml.rels' % n] = rd('xl/drawings/_rels/drawing%d.xml.rels' % n)
T['xl/drawings/drawing8.xml'] = T['xl/drawings/drawing6.xml']
T['xl/drawings/_rels/drawing8.xml.rels'] = T['xl/drawings/_rels/drawing6.xml.rels']
for p in ('xl/charts/chart1.xml', 'xl/charts/chart2.xml', 'xl/comments1.xml', 'xl/drawings/vmlDrawing1.vml', 'xl/styles.xml', 'xl/theme/theme1.xml'):
    T[p] = rd(p)

# --- Classeur
wb = rd('xl/workbook.xml')
wb = re.sub(r'<mc:AlternateContent.*?</mc:AlternateContent>', '', wb, flags=re.S)
wb = sub1(r'(<sheet name="Semaine 5"[^>]*/>)', r'\1<sheet name="Semaine 6" sheetId="9" r:id="rId12"/>', wb)
wb = sub1(r'<definedName name="_xlnm.Print_Area" localSheetId="6">', '<definedName name="_xlnm.Print_Area" localSheetId="6">\'Semaine 6\'!$A$1:$Q$32</definedName><definedName name="_xlnm.Print_Area" localSheetId="7">', wb)
wb = sub1(r'<calcPr calcId="191029"/>', '<calcPr calcId="191029" fullCalcOnLoad="1"/>', wb)
assert 'sharepoint' not in wb.lower()
T['xl/workbook.xml'] = wb
wr = rd('xl/_rels/workbook.xml.rels')
wr = sub1(r'<Relationship (?=[^>]*Target="calcChain\.xml")[^>]*/>', '', wr)
wr = sub1('</Relationships>', '<Relationship Id="rId12" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet8.xml"/></Relationships>', wr)
T['xl/_rels/workbook.xml.rels'] = wr
ct = rd('[Content_Types].xml')
for pn in ('/xl/calcChain.xml', '/docMetadata/LabelInfo.xml', '/docProps/app.xml'):
    ct = sub1(r'<Override PartName="%s"[^>]*/>' % re.escape(pn), '', ct)
ct = sub1('</Types>', '<Override PartName="/xl/worksheets/sheet8.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
          '<Override PartName="/xl/drawings/drawing8.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>', ct)
T['[Content_Types].xml'] = ct
rels = rd('_rels/.rels')
rels = re.sub(r'<Relationship (?=[^>]*Target="[^"]*(LabelInfo|app\.xml))[^>]*/>', '', rels)
T['_rels/.rels'] = rels

# --- Aucune donnée personnelle dans le modèle publié
ss = rd('xl/sharedStrings.xml')
m = rd('xl/worksheets/sheet1.xml')
for ref in ('D4', 'D5', 'D6'):
    i = int(re.search(r'<c r="%s"[^>]*t="s"><v>(\d+)</v>' % ref, m).group(1))
    items = re.findall(r'<si>.*?</si>', ss, re.S)
    ss = ss.replace(items[i], '<si><t></t></si>', 1)
T['xl/sharedStrings.xml'] = ss
c = rd('docProps/core.xml')
c = re.sub(r'<dc:creator>.*?</dc:creator>', '<dc:creator>Compte rendu spirituel</dc:creator>', c)
c = re.sub(r'<cp:lastModifiedBy>.*?</cp:lastModifiedBy>', '<cp:lastModifiedBy>Compte rendu spirituel</cp:lastModifiedBy>', c)
T['docProps/core.xml'] = c

B = {p: base64.b64encode(rd(p, True)).decode() for p in ('xl/media/image1.jpeg', 'xl/printerSettings/printerSettings1.bin')}
s = json.dumps({'texte': T, 'binaire': B}, ensure_ascii=False)
for interdit in ('sharepoint', 'lastModifiedBy>Henri'):
    assert interdit.lower() not in s.lower(), interdit
open(out, 'w', encoding='utf8').write('window.MODELE_XL=' + s + ';\n')
print('ok', len(s), 'octets ;', len(T), 'parties ; noms en clair :', re.findall(r'<si><t>([A-Z][A-Z ]{8,})</t></si>', ss)[:6])
