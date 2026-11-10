'use strict';
/* MindMe – icon sets drawn for the app (24 × 24 grid, rounded ends). The style is chosen in Setări:
   emoji (the original), linie (thin line), plin (filled, details cut out), duo (outline + soft fill), insigna (white on a coloured square). */

// c = circle [cx, cy, r, closed], r = rounded rect [x, y, w, h, rx, transform], p = path [d, closed | transform]
const GLYPHS = {
  azi:        [['c', 12, 12, 4, 1], ['p', 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4']],
  liste:      [['r', 3.5, 3.5, 7, 7, 2], ['r', 13.5, 3.5, 7, 7, 2], ['r', 3.5, 13.5, 7, 7, 2], ['r', 13.5, 13.5, 7, 7, 2]],
  remindere:  [['p', 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2.1H4.4z', 1], ['p', 'M10 21a2.1 2.1 0 0 0 4 0']],
  setari:     [['p', 'M4 7h9M17.4 7H20M4 17h2.6M11 17h9'], ['c', 15.2, 7, 2.2, 1], ['c', 8.8, 17, 2.2, 1]],
  facut:      [['c', 12, 12, 8.5, 1], ['p', 'M8.4 12.3l2.5 2.5 4.8-5']],
  cumparaturi:[['p', 'M3 4.5h2.2l2.1 10.3a1.6 1.6 0 0 0 1.6 1.2h8.2a1.6 1.6 0 0 0 1.5-1.2L20 8.5H6.1'], ['c', 9.6, 19.6, 1.4, 1], ['c', 16.8, 19.6, 1.4, 1]],
  comenzi:    [['p', 'M12 3l8 4.5v9L12 21l-8-4.5v-9z', 1], ['p', 'M4 7.5l8 4.5 8-4.5M12 12v9']],
  plati:      [['r', 3, 5.5, 18, 13, 2.6], ['p', 'M3 10h18M7 14.8h4']],
  notite:     [['r', 5, 3.5, 14, 17, 2.6], ['p', 'M8.6 8.8h6.8M8.6 12.3h6.8M8.6 15.8h4']],
  medicamente:[['r', 8.5, 2.5, 7, 19, 3.5, 'rotate(45 12 12)'], ['p', 'M8.5 12h7', 'rotate(45 12 12)']],
  vacante:    [['p', 'M12 3c.8 0 1.5.7 1.5 1.5V10l7 4.5v2l-7-2.2V19l2 1.5V22L12 21l-3.5 1v-1.5l2-1.5v-4.7l-7 2.2v-2l7-4.5V4.5C10.5 3.7 11.2 3 12 3z', 1]],
  concediu:   [['p', 'M12 3.2a8.6 8.6 0 0 1 8.6 8.3H3.4A8.6 8.6 0 0 1 12 3.2z', 1], ['p', 'M12 11.5v7.2a2.1 2.1 0 0 1-4.2 0']],
  birou:      [['r', 5, 3.5, 14, 17, 1.8], ['p', 'M9 8h1.6M13.4 8H15M9 11.6h1.6M13.4 11.6H15M10.4 20.5v-4h3.2v4']],
  bilet:      [['p', 'M4 7.6A1.6 1.6 0 0 1 5.6 6h12.8A1.6 1.6 0 0 1 20 7.6V10a2 2 0 0 0 0 4v2.4a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 16.4V14a2 2 0 0 0 0-4z', 1], ['p', 'M14.6 8.2v1.4M14.6 11.3v1.4M14.6 14.4v1.4']],
  raion:      [['p', 'M3.5 12.6V5.1a1.6 1.6 0 0 1 1.6-1.6h7.5l7.9 7.9a1.6 1.6 0 0 1 0 2.2l-7.4 7.4a1.6 1.6 0 0 1-2.2 0z', 1], ['c', 8.1, 8.1, 1.5, 0]],
  bagaj:      [['r', 4, 7, 16, 13, 2.6], ['p', 'M9 7V5.1a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 5.1V7M4 12.5h16']],
  calendar:   [['r', 3.5, 5, 17, 15.5, 2.6], ['p', 'M3.5 10h17M8 3v4M16 3v4M8 14.2h2M14 14.2h2']],
};
// in "Plin", these strokes sit on top of a filled shape → drawn in the background colour (cut out)
const GLYPH_CUT = new Set(['facut', 'comenzi', 'plati', 'notite', 'medicamente', 'concediu', 'birou', 'bilet', 'bagaj', 'calendar']);
const ICON_STYLES = [['linie', 'Linie fină'], ['plin', 'Plin'], ['duo', 'Duoton'], ['insigna', 'Insignă']];   // emoji style removed (the user didn't want it)

function iconStyle() {
  let st = 'insigna';
  try { st = (db.settings && db.settings.iconStyle) || 'insigna'; } catch (e) { /* data still loading */ }
  return ICON_STYLES.some(([k]) => k === st) ? st : 'insigna';   // the old 'emoji' choice becomes Insignă
}

// one glyph as SVG in the given style; colours come from CSS: currentColor, and --cut for "Plin" cut-outs
function glyphSvg(key, style, cls = '') {
  const g = GLYPHS[key];
  if (!g) return '';
  const w = style === 'insigna' ? 2.1 : style === 'plin' ? 1.7 : 2;   // thick enough to read on a phone, light and dark
  const inner = g.map(([t, ...a]) => {
    let el = '', closed = false, tr = '';
    if (t === 'c') { el = `<circle cx="${a[0]}" cy="${a[1]}" r="${a[2]}"`; closed = !!a[3]; }
    if (t === 'r') { el = `<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" rx="${a[4]}"`; closed = true; tr = a[5] || ''; }
    if (t === 'p') { el = `<path d="${a[0]}"`; closed = a[1] === 1; tr = typeof a[1] === 'string' ? a[1] : ''; }
    const tx = tr ? ` transform="${tr}"` : '';
    const dot = t === 'c' && !a[3];
    if (style === 'plin') return closed ? `${el}${tx} fill="currentColor" stroke="currentColor" stroke-width="${w}"/>`
      : `${el}${tx} fill="${dot ? 'var(--cut)' : 'none'}" stroke="${GLYPH_CUT.has(key) ? 'var(--cut)' : 'currentColor'}" stroke-width="${w}"/>`;
    if (style === 'duo') return closed ? `${el}${tx} fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="${w}"/>`
      : `${el}${tx} fill="${dot ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${w}"/>`;
    return `${el}${tx} fill="${dot ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${w}"/>`;
  }).join('');
  return `<svg class="glyph ${cls}" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// which drawing a list gets: from its kind / name / emoji (custom lists with other emojis keep their emoji)
const EMOJI_GLYPH = { '✅': 'facut', '🛒': 'cumparaturi', '🛍️': 'cumparaturi', '📦': 'comenzi', '💳': 'plati', '💰': 'plati', '🧾': 'plati', '📝': 'notite', '🔔': 'remindere',
  '💊': 'medicamente', '✈️': 'vacante', '🏖️': 'concediu', '🏢': 'birou', '💼': 'birou', '📅': 'calendar', '🏷️': 'raion', '🎫': 'bilet', '🧳': 'bagaj' };
function catGlyph(c) {
  if (!c) return null;
  if (c.kind === 'meds') return 'medicamente';
  if (c.kind === 'shopping') return 'cumparaturi';
  if (c.kind === 'trips') return 'vacante';
  if (c.kind === 'app') return /birou/.test(c.appUrl || '') ? 'birou' : 'concediu';
  return EMOJI_GLYPH[c.icon] || null;
}
// the icon of a list (rows, titles, editor), in the chosen style
function catIconHtml(c, extraCls = '') {
  const st = iconStyle(), g = st === 'emoji' ? null : catGlyph(c);
  if (!g) return `<div class="caticon ${extraCls}" style="--c:${colorOf(c)}">${c.icon}</div>`;
  return `<div class="caticon gl-${st} ${extraCls}" style="--c:${colorOf(c)}">${glyphSvg(g, st)}</div>`;
}
function catTitleIcon(c) {
  const st = iconStyle(), g = st === 'emoji' ? null : catGlyph(c);
  if (!g) return `<span class="emo">${c.icon}</span>`;
  return `<span class="emo glt gl-${st}" style="--c:${colorOf(c)}">${glyphSvg(g, st === 'insigna' ? 'insigna' : st)}</span>`;
}
// bottom bar: the chosen style (Insignă uses the thin line there, coloured squares would be too loud in the bar)
const TAB_GLYPH = { today: 'azi', lists: 'liste', reminders: 'remindere', settings: 'setari' };
function tabIconHtml(id, fallback) {
  const st = iconStyle();
  if (st === 'emoji') return fallback;
  return glyphSvg(TAB_GLYPH[id], st === 'insigna' ? 'linie' : st, 'tabglyph');
}
