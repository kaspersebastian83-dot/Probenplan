// @ts-nocheck – wörtliche Kopie des JavaScript-Moduls aus der Projektzentrale; geprüft durch deren Tests und tests/anlage.mjs.
// Kleiner Word-Schreiber (Office Open XML) für die Anlagen zum Gutachten – ohne Bibliotheken, ohne Netz.
// KOPIE des Moduls „DOCX“ aus der Projektzentrale (index.html, zwischen DOCX-START und DOCX-ENDE). Bei Änderungen
// beide Stellen gleich halten, damit alle Anlagen gleich aussehen.
// Gedacht zum Einfügen in den Bericht mit Word „Einfügen › Objekt › Text aus Datei“: nur direkte Formatierung
// (Arial), keine Formatvorlagen, keine Kopf-/Fußzeilen, A4 mit den Rändern des Berichts, echte Tabellen.
/* eslint-disable */
export interface Run {text?:string;b?:boolean;i?:boolean;u?:boolean;size?:number;font?:string;color?:string;mono?:boolean}
export interface Para extends Run {t?:'p';runs?:Run[];align?:'left'|'center'|'right'|'both';before?:number;after?:number;line?:number;keepNext?:boolean;keepLines?:boolean;pageBreakBefore?:boolean;indent?:number}
export interface Cell {image?:Omit<Image,'t'>;text?:string;runs?:Run[];paras?:Para[];span?:number;shade?:string;align?:Para['align'];vAlign?:'top'|'center'|'bottom';b?:boolean;i?:boolean;size?:number}
export interface Row {header?:boolean;minHeight?:number;cells:Cell[]}
export interface Table {t:'table';widths:number[];rows:Row[];size?:number;borders?:boolean;align?:'center'}
export interface Image {t:'image';data:Uint8Array;ext:'png'|'jpeg';widthMm:number;heightMm:number;alt?:string;align?:Para['align'];after?:number;keepNext?:boolean}
export type Block=(Para&{t:'p'})|Table|Image|{t:'pagebreak'};
export interface DocInput {title?:string;author?:string;application?:string;created?:string;blocks:Block[]}
type Any=any;


  const PAGE = { w: 11906, h: 16838, top: 1418, bottom: 1134, left: 1418, right: 1418 };   // A4, Ränder wie Bericht (25 mm seitlich)
  const TEXT_W = PAGE.w - PAGE.left - PAGE.right;                                             // 9070 twips nutzbare Breite
  const FONT = 'Arial';
  const enc = new TextEncoder();
  // XML: Sonderzeichen maskieren und in XML 1.0 unzulässige Steuerzeichen entfernen (würden Word „beschädigt“ melden lassen)
  const ohneEinzelSurrogate = (s:string) => { let o = ''; for (let i = 0; i < s.length; i++){ const c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF){ const d = s.charCodeAt(i + 1); if (d >= 0xDC00 && d <= 0xDFFF){ o += s[i] + s[i + 1]; i++; } continue; }
    if (c >= 0xDC00 && c <= 0xDFFF) continue; o += s[i]; } return o; };
  export const esc = (s:unknown) => ohneEinzelSurrogate(String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, ''))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function rPr(o:Any){
    const f = o.mono ? 'Courier New' : (o.font || FONT), sz = Math.round((o.size || 11) * 2);
    return `<w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}" w:eastAsia="${f}"/>${o.b ? '<w:b/><w:bCs/>' : ''}${o.i ? '<w:i/><w:iCs/>' : ''}${o.u ? '<w:u w:val="single"/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="de-DE"/></w:rPr>`;
  }
  // Ein Lauf; Zeilenumbrüche → <w:br/>, Tabs → <w:tab/>
  function run(r:Any, base:Any){
    const o = Object.assign({}, base, r);
    const parts = String(o.text == null ? '' : o.text).split(/(\n|\t)/);
    let inner = '';
    for (const p of parts){
      if (p === '\n') inner += '<w:br/>';
      else if (p === '\t') inner += '<w:tab/>';
      else if (p) inner += `<w:t xml:space="preserve">${esc(p)}</w:t>`;
    }
    return `<w:r>${rPr(o)}${inner}</w:r>`;
  }
  function runsOf(o:Any){ return o.runs || [{ text: o.text == null ? '' : o.text }]; }
  function pPr(o:Any, inCell?:boolean){
    const jc = { left: 'left', center: 'center', right: 'right', both: 'both' }[o.align || 'left'];
    const line = o.line || (inCell ? 240 : 240);
    return `<w:pPr>${o.keepNext ? '<w:keepNext/>' : ''}${o.keepLines ? '<w:keepLines/>' : ''}${o.pageBreakBefore ? '<w:pageBreakBefore/>' : ''}`
      + `<w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? (inCell ? 0 : 120) : o.after}" w:line="${line}" w:lineRule="auto"/>`
      + (o.indent ? `<w:ind w:left="${o.indent}"/>` : '') + `<w:jc w:val="${jc}"/>${rPr(o)}</w:pPr>`;
  }
  function para(o:Any, inCell:boolean){
    const base = { size: o.size, b: o.b, i: o.i, u: o.u, mono: o.mono, font: o.font, color: o.color };
    return `<w:p>${pPr(o, inCell)}${runsOf(o).map(r => run(r, base)).join('')}</w:p>`;
  }
  function table(o:Any, ctx:Any){
    const widths = o.widths, total = widths.reduce((a, b) => a + b, 0), size = o.size || 10;
    const bd = v => `<w:top w:val="${v}" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="${v}" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="${v}" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="${v}" w:sz="4" w:space="0" w:color="000000"/>`;
    const border = o.borders === false ? 'nil' : 'single';
    let xml = `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${o.align === 'center' ? '<w:jc w:val="center"/>' : ''}<w:tblLayout w:type="fixed"/>`
      + `<w:tblBorders>${bd(border)}<w:insideH w:val="${border}" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="${border}" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders>`
      + `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>`
      + `<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>`
      + `<w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    for (const row of o.rows){
      xml += `<w:tr><w:trPr><w:cantSplit/>${row.header ? '<w:tblHeader/>' : ''}${row.minHeight ? `<w:trHeight w:val="${row.minHeight}" w:hRule="atLeast"/>` : ''}</w:trPr>`;
      let col = 0;
      for (const c of row.cells){
        const span = c.span || 1, w = widths.slice(col, col + span).reduce((a, b) => a + b, 0); col += span;
        // Zelle mit Bild (z. B. Foto mit Bildunterschrift): Bild-Absatz zuerst, danach die Absätze
        const paras = c.paras || (c.image && c.text == null && !c.runs ? [] : [{ text: c.text, runs: c.runs }]);
        xml += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}`
          + (c.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${c.shade}"/>` : '')
          + `<w:vAlign w:val="${c.vAlign || 'top'}"/></w:tcPr>`
          + (c.image ? image(Object.assign({ align: c.align || 'center', after: 40 }, c.image), ctx) : '')
          + paras.map(p => para(Object.assign({ size, align: c.align, b: c.b, i: c.i, after: 0 }, p), true)).join('') + '</w:tc>';
      }
      if (col !== widths.length) throw new Error(`Tabellenzeile hat ${col} statt ${widths.length} Spalten`);
      xml += '</w:tr>';
    }
    // Word verlangt nach einer Tabelle einen Absatz, bevor die nächste Tabelle oder das Dokumentende kommt
    return xml + '</w:tbl>' + para({ text: '', size: 4, after: 0 }, false);
  }
  function image(o:Any, ctx:Any){
    // Dasselbe Bild (gleiches Datenobjekt) nur einmal in die Datei; jede Verwendung bekommt eine eigene Zeichnungs-ID
    let m = ctx.media.find(x => x.data === o.data);
    if (!m){ const n = ctx.media.length + 1; m = { name: `bild${n}.${o.ext === 'png' ? 'png' : 'jpeg'}`, rid: 'rIdImg' + n, data: o.data }; ctx.media.push(m); }
    const id = ctx.drawings = (ctx.drawings || 0) + 1, name = m.name, rid = m.rid;
    const emu = mm => Math.round(mm * 36000), cx = emu(o.widthMm), cy = emu(o.heightMm);
    return `<w:p>${pPr({ align: o.align || 'center', after: o.after == null ? 60 : o.after, keepNext: o.keepNext })}<w:r><w:drawing>`
      + `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Bild ${id}" descr="${esc(o.alt || '')}"/>`
      + `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>`
      + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
      + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>`
      + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
      + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`
      + `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }
  function body(blocks:Any[], ctx:Any){
    let xml = '';
    for (const b of blocks){
      if (b.t === 'p') xml += para(b, false);
      else if (b.t === 'table') xml += table(b, ctx);
      else if (b.t === 'image') xml += image(b, ctx);
      else if (b.t === 'pagebreak') xml += '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
      else throw new Error('Unbekannter Baustein: ' + b.t);
    }
    return xml;
  }
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    + 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

  export function parts(o:DocInput){
    const ctx:Any = { media: [] };
    const created = (o.created || new Date().toISOString()).replace(/\.\d{3}Z$/, 'Z');
    const sect = `<w:sectPr><w:pgSz w:w="${PAGE.w}" w:h="${PAGE.h}"/><w:pgMar w:top="${PAGE.top}" w:right="${PAGE.right}" w:bottom="${PAGE.bottom}" w:left="${PAGE.left}" w:header="709" w:footer="709" w:gutter="0"/><w:cols w:space="708"/></w:sectPr>`;
    const doc = HEAD + `<w:document ${NS}><w:body>${body(o.blocks || [], ctx)}${sect}</w:body></w:document>`;
    const files:{name:string;data:Uint8Array}[] = [];
    const add = (name:string, s:string|Uint8Array) => files.push({ name, data: typeof s === 'string' ? enc.encode(s) : s });
    add('[Content_Types].xml', HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      + '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
      + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
    add('_rels/.rels', HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
    add('docProps/core.xml', HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + `<dc:title>${esc(o.title || '')}</dc:title><dc:creator>${esc(o.author || '')}</dc:creator><cp:lastModifiedBy>${esc(o.author || '')}</cp:lastModifiedBy>`
      + `<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`);
    add('docProps/app.xml', HEAD + `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>${esc(o.application || 'Projektzentrale')}</Application></Properties>`);
    add('word/styles.xml', HEAD + `<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="de-DE" w:eastAsia="de-DE" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
      + '<w:style w:type="paragraph" w:default="1" w:styleId="Standard"><w:name w:val="Normal"/><w:qFormat/></w:style>'
      + '<w:style w:type="table" w:default="1" w:styleId="NormaleTabelle"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>');
    add('word/settings.xml', HEAD + `<w:settings ${NS}><w:defaultTabStop w:val="708"/><w:hyphenationZone w:val="425"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
    add('word/_rels/document.xml.rels', HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
      + ctx.media.map(m => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('')
      + '</Relationships>');
    add('word/document.xml', doc);
    for (const m of ctx.media) add('word/media/' + m.name, m.data);
    return { files, created };
  }

  /* --- ZIP (Methode „stored“, UTF-8-Namen) --- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  export function crc32(u8:Uint8Array){ let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  export function zip(files:{name:string;data:Uint8Array}[], when?:string){
    const d = new Date(when || Date.now());
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const locals:Uint8Array[] = [], centrals:Uint8Array[] = []; let offset = 0;
    for (const f of files){
      const name = enc.encode(f.name), data = f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      locals.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      centrals.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = centrals.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = [...locals, ...centrals, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0;
    for (const a of all){ out.set(a, p); p += a.length; }
    return out;
  }
  export function build(o:DocInput){ const { files, created } = parts(o); return zip(files, created); }
  /** Bildgröße für eine Breite in mm (Seitenverhältnis bleibt). */
  export const fit = (pxW:number, pxH:number, maxWmm:number, maxHmm:number) => { const s = Math.min(maxWmm / pxW, maxHmm / pxH); return { widthMm: pxW * s, heightMm: pxH * s }; };
