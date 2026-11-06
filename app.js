'use strict';
/* MindMe – web app (PWA). Data stays on the phone (localStorage). */

const KEY = 'bifa.data.v1';
const VERSION = '1.0';

// ---------- helpers ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const clone = o => JSON.parse(JSON.stringify(o));

function parseLocal(s) {
  if (!s) return null;
  const [d, t = '00:00'] = s.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  if (!y || !m || !dd) return null;
  return new Date(y, m - 1, dd, h || 0, mi || 0);
}
const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const atTime = (d, h, m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const fDayShort = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });
const fDayYear = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
const fTime = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit' });
const fLong = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
const fNum = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function fmtDay(d) {
  const now = new Date();
  if (sameDay(d, now)) return 'Azi';
  if (sameDay(d, addDays(now, 1))) return 'Mâine';
  if (sameDay(d, addDays(now, -1))) return 'Ieri';
  return d.getFullYear() === now.getFullYear() ? fDayShort.format(d) : fDayYear.format(d);
}
const fmtDayTime = d => `${fmtDay(d)}, ${fTime.format(d)}`;
function dayHeader(d) {
  const now = new Date();
  const long = fLong.format(d);
  if (sameDay(d, now)) return 'Azi · ' + long;
  if (sameDay(d, addDays(now, 1))) return 'Mâine · ' + long;
  return cap(long);
}
const money = (a, c) => `${fNum.format(a)} ${c}`;
function totals(items) {
  const sums = {};
  for (const [a, c] of items) sums[c] = (sums[c] || 0) + a;
  const parts = Object.keys(sums).sort().filter(k => sums[k]).map(k => money(sums[k], k));
  return parts.length ? parts.join(' + ') : '0';
}
function parseAmount(t) {
  let s = String(t || '').replace(/[\s\u00A0]/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "2.500" = 2500
  s = s.replace(',', '.');
  const v = parseFloat(s);
  return isFinite(v) ? v : 0;
}

// ---------- constants ----------
const PALETTE = ['#5B6BFA', '#FF8C40', '#2EB87A', '#F2B31A', '#ED548C', '#9961F2', '#1AB3CC', '#EB4240', '#8C6B4D', '#738094'];
const EMOJIS = ['✅', '📦', '💳', '📝', '🔔', '🛒', '🛍️', '🏠', '💼', '❤️', '⭐', '🎁', '🚗', '✈️', '🍽️', '💊', '📚', '🎓', '🏋️', '🐾', '🌿', '🔧', '📄', '📅', '💰', '🏦', '👥', '📞', '💡', '🏷️', '📁', '🎵', '🎮', '👕', '🎂', '🧾'];
const CURRENCIES = ['RON', 'EUR', 'USD', 'GBP'];
const REPEATS = { none: 'Niciodată', daily: 'Zilnic', weekly: 'Săptămânal', monthly: 'Lunar', yearly: 'Anual' };
const PRIORITIES = ['Normal', 'Important', 'Urgent'];
const REM_MODES = { off: 'Fără remindere', optional: 'Opțional, la fiecare element', always: 'Fiecare element e un reminder' };
const GROUP_MODES = { date: 'După dată', group: 'După grup', none: 'Ordinea mea' };
const TEMPLATES = {
  task: { label: 'De făcut', icon: '✅', color: 0 },
  order: { label: 'Comenzi', icon: '📦', color: 1 },
  payment: { label: 'Plăți', icon: '💳', color: 2 },
  note: { label: 'Notițe', icon: '📝', color: 3 },
  reminder: { label: 'Remindere', icon: '🔔', color: 4 },
  meds: { label: 'Medicamente', icon: '💊', color: 6 },
  blank: { label: 'Listă simplă', icon: '📁', color: 5 },
};

function baseRules() {
  return {
    placeholder: 'Titlu',
    usesDeadline: true, deadlineLabel: 'Termen limită', deadlineTime: true,
    usesAmount: false, currency: 'RON', usesPaid: false, usesDir: false,
    usesSubs: false, subsLabel: 'Sub-elemente', subsAuto: true,
    usesVendor: false, vendorLabel: 'Persoană / magazin',
    usesTracking: false, trackingLabel: 'Cod / AWB',
    usesPriority: false, usesGroups: false, doneLabel: 'Bifat',
    reminderMode: 'optional', autoRem: false, autoRemDays: 1, autoRemTime: '09:00',
    groupMode: 'date', summary: true, autoDelete: 0, kind: 'list',
  };
}
function templateRules(t) {
  const r = baseRules();
  const set = o => Object.assign(r, o);
  if (t === 'task') set({ usesPriority: true, usesGroups: true, usesSubs: true, subsLabel: 'Pași', doneLabel: 'Făcut', placeholder: 'Ce ai de făcut?' });
  if (t === 'order') set({ deadlineLabel: 'Livrare estimată', deadlineTime: false, usesAmount: true, usesPaid: true, usesVendor: true, vendorLabel: 'Magazin / curier', usesTracking: true, trackingLabel: 'AWB / nr. comandă', usesSubs: true, subsLabel: 'Produse', doneLabel: 'Primită', placeholder: 'Ce ai comandat? (ex: eMAG, Zara)' });
  if (t === 'payment') set({ deadlineLabel: 'Scadență', deadlineTime: false, usesAmount: true, usesDir: true, usesVendor: true, vendorLabel: 'Către / de la cine', autoRem: true, doneLabel: 'Achitată', placeholder: 'Pentru ce e plata?' });
  if (t === 'note') set({ usesGroups: true, groupMode: 'group', placeholder: 'Titlu notiță' });
  if (t === 'reminder') set({ usesDeadline: false, reminderMode: 'always', doneLabel: 'Gata', placeholder: 'Ce să-ți amintesc?' });
  if (t === 'blank') set({ usesDeadline: false, groupMode: 'none' });
  if (t === 'meds') set({ kind: 'meds', usesDeadline: false, reminderMode: 'off', groupMode: 'none', summary: false, placeholder: 'Numele medicamentului', doneLabel: 'Oprit' });
  return r;
}
const RULE_KEYS = Object.keys(baseRules());

// ---------- data ----------
let db = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.categories) && Array.isArray(d.entries)) return addMedsListOnce(d);
    }
  } catch (e) { /* ignore */ }
  const d = { v: 1, categories: [], entries: [], medsAdded: true };
  ['task', 'order', 'payment', 'note', 'reminder', 'meds'].forEach((t, i) => {
    d.categories.push({ id: uid(), name: TEMPLATES[t].label, icon: TEMPLATES[t].icon, color: TEMPLATES[t].color, order: i, ...templateRules(t) });
  });
  return d;
}
// existing users get the new "Medicamente" list once (if they delete it, it doesn't come back)
function addMedsListOnce(d) {
  if (!d.medsAdded) {
    if (!d.categories.some(c => c.kind === 'meds')) {
      const order = Math.max(-1, ...d.categories.map(c => c.order || 0)) + 1;
      d.categories.push({ id: uid(), name: TEMPLATES.meds.label, icon: TEMPLATES.meds.icon, color: TEMPLATES.meds.color, order, ...templateRules('meds') });
    }
    d.medsAdded = true;
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  }
  return d;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Nu am putut salva! Memorie plină?'); }
}
const cats = () => [...db.categories].sort((a, b) => a.order - b.order);
const catById = id => db.categories.find(c => c.id === id);
const entryById = id => db.entries.find(e => e.id === id);
const colorOf = c => PALETTE[((c?.color ?? 0) % PALETTE.length + PALETTE.length) % PALETTE.length];

// ---------- entry logic ----------
function nextReminder(e) {
  const r = parseLocal(e.reminder);
  if (!r) return null;
  const now = new Date();
  if (e.repeat === 'none' || !e.repeat || r > now) return r;
  let d = new Date(r);
  for (let i = 0; i < 5000 && d <= now; i++) {
    if (e.repeat === 'daily') d = addDays(d, 1);
    else if (e.repeat === 'weekly') d = addDays(d, 7);
    else if (e.repeat === 'monthly') d = new Date(d.getFullYear(), d.getMonth() + 1, r.getDate(), r.getHours(), r.getMinutes());
    else if (e.repeat === 'yearly') d = new Date(d.getFullYear() + 1, r.getMonth(), r.getDate(), r.getHours(), r.getMinutes());
    else break;
  }
  return d;
}
const deadlineOf = e => (e.hasDeadline ? parseLocal(e.deadline) : null);
function isOverdue(e) {
  const d = deadlineOf(e);
  if (!d || e.done) return false;
  const now = new Date();
  return e.deadlineTime ? d < now : startOfDay(d) < startOfDay(now);
}
const isDueToday = e => { const d = deadlineOf(e); return !!d && !e.done && sameDay(d, new Date()); };
function reminderMissed(e) {
  if (!e.hasReminder || e.done || (e.repeat && e.repeat !== 'none')) return false;
  const r = parseLocal(e.reminder);
  return !!r && r < new Date();
}
const sortDate = e => deadlineOf(e) || (e.hasReminder ? nextReminder(e) : null);
const deadlineText = e => { const d = deadlineOf(e); return d ? (e.deadlineTime ? fmtDayTime(d) : fmtDay(d)) : ''; };
const alarmKey = e => (e.med
  ? JSON.stringify([e.title, e.med.dose, e.med.times, e.med.start, e.med.durType, e.med.days, e.med.until, e.med.weekdays])
  : `${e.reminder}|${e.repeat}|${e.title}`);
const alarmAdded = e => (e.med ? !!e.med.alarm : e.hasReminder) && e.alarmFor === alarmKey(e);

// Items checked a moment ago stay visible (struck through) for a few seconds, with an "Anulează" bar.
const recentlyDone = new Map();
const UNDO_MS = 6000;
const isRecent = e => recentlyDone.has(e.id);
const settledDone = e => !!e.done && !isRecent(e);

function sortEntries(list) {
  return [...list].sort((a, b) => {
    if (settledDone(a) !== settledDone(b)) return settledDone(a) ? 1 : -1;
    const x = sortDate(a), y = sortDate(b);
    if (x && y && +x !== +y) return x - y;
    if (x && !y) return -1;
    if (!x && y) return 1;
    if ((a.priority || 0) !== (b.priority || 0)) return (b.priority || 0) - (a.priority || 0);
    return b.createdAt - a.createdAt;
  });
}
function sectionsByDate(list) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1), after = addDays(today, 2), week = addDays(today, 7);
  const b = { overdue: [], today: [], tomorrow: [], week: [], later: [], nodate: [], done: [] };
  for (const e of sortEntries(list)) {
    if (settledDone(e)) { b.done.push(e); continue; }
    if (isOverdue(e) || (reminderMissed(e) && !e.hasDeadline)) { b.overdue.push(e); continue; }
    const d = sortDate(e);
    if (!d) b.nodate.push(e);
    else if (d < tomorrow) b.today.push(e);
    else if (d < after) b.tomorrow.push(e);
    else if (d < week) b.week.push(e);
    else b.later.push(e);
  }
  const titles = { overdue: 'Întârziate', today: 'Azi', tomorrow: 'Mâine', week: 'Următoarele 7 zile', later: 'Mai târziu', nodate: 'Fără dată', done: 'Bifate' };
  return Object.keys(b).filter(k => b[k].length).map(k => ({ id: k, title: titles[k], items: b[k] }));
}
function sectionsByGroup(list) {
  const g = {};
  for (const e of list) (g[e.group || ''] ||= []).push(e);
  return Object.keys(g).sort((a, b) => (!a) - (!b) || a.localeCompare(b, 'ro'))
    .map(k => ({ id: 'g' + k, title: k || 'Fără grup', items: sortManual(g[k]) }));
}
const sectionsFlat = list => (list.length ? [{ id: 'all', title: '', items: sortManual(list) }] : []);
// manual order (set by long-press + drag). Items never moved go on top, newest first.
function sortManual(list) {
  if (!list.some(e => typeof e.pos === 'number')) return sortEntries(list);
  const key = e => (typeof e.pos === 'number' ? e.pos : -e.createdAt);
  return [...list].sort((a, b) => {
    if (settledDone(a) !== settledDone(b)) return settledDone(a) ? 1 : -1;
    return key(a) - key(b);
  });
}

function toggleDone(e) {
  e.done = !e.done;
  e.doneAt = e.done ? Date.now() : null;
  save();
  if (e.done) showUndo(e, `Bifat: ${e.title}`);
  else { recentlyDone.delete(e.id); hideUndo(); }
}

// ---------- undo bar ----------
let undoTimer = null;
function showUndo(e, text) {
  recentlyDone.set(e.id, Date.now());
  let bar = document.getElementById('undo');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'undo';
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<span>✓ ${esc(text)}</span><button data-act="undo" data-id="${e.id}">Anulează</button>`;
  bar.classList.add('show');
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { recentlyDone.clear(); hideUndo(); if (!ui.sheet) render(); }, UNDO_MS);
}
function hideUndo() {
  document.getElementById('undo')?.classList.remove('show');
}
function undoDone(id) {
  const e = entryById(id);
  if (e && e.done) {
    e.done = false;
    e.doneAt = null;
    // a sub-item that auto-checked the parent: uncheck the last checked sub-item too
    if (e._autoBy) {
      const s = (e.subs || []).find(x => x.id === e._autoBy);
      if (s) s.done = false;
      delete e._autoBy;
    }
    save();
  }
  recentlyDone.delete(id);
  clearTimeout(undoTimer);
  hideUndo();
  render();
  toast('Anulat ↩︎');
}
function askThenToggle(e) {
  if (false) { // confirmation setting removed at the user's request (the "Anulează" bar is enough)
    const c = catById(e.cat);
    openActions(`Bifezi „${e.title}” ca ${(c?.doneLabel || 'bifat').toLowerCase()}?`, [
      { label: '✓ Da, bifează', run: () => { toggleDone(e); render(); } },
    ]);
    return;
  }
  toggleDone(e);
  render();
}
function toggleSub(e, sid) {
  const s = (e.subs || []).find(x => x.id === sid);
  if (!s) return;
  s.done = !s.done;
  const c = catById(e.cat);
  if (c?.subsAuto !== false && e.subs.length) {
    const all = e.subs.every(x => x.done);
    if (all && !e.done) {
      e.done = true; e.doneAt = Date.now(); e._autoBy = sid;
      save();
      showUndo(e, `Toate ${(c?.subsLabel || 'elementele').toLowerCase()} bifate: ${e.title}`);
      return;
    } else if (!all && e.done) { e.done = false; e.doneAt = null; }
  }
  delete e._autoBy;
  save();
}
function deleteEntry(id) { db.entries = db.entries.filter(e => e.id !== id); save(); }
function cleanup() {
  const now = Date.now();
  let changed = false;
  for (const c of db.categories) {
    if (!c.autoDelete) continue;
    const before = db.entries.length;
    db.entries = db.entries.filter(e => !(e.cat === c.id && e.done && now - (e.doneAt || e.createdAt) > c.autoDelete * 86400000));
    if (db.entries.length !== before) changed = true;
  }
  if (changed) save();
}

// ---------- calendar alarm (.ics) ----------
function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
const icsDate = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
function buildIcs(e) {
  const c = catById(e.cat);
  const start = parseLocal(e.reminder) || new Date();
  const end = new Date(start.getTime() + 15 * 60000);
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const lines = [];
  if (e.details) lines.push(e.details);
  if (e.hasAmount && e.amount) lines.push((c?.usesDir ? (e.dir === 'in' ? 'De primit: ' : 'De plătit: ') : '') + money(e.amount, e.currency));
  if (e.hasDeadline) lines.push(`${c?.deadlineLabel || 'Termen'}: ${deadlineText(e)}`);
  const pending = (e.subs || []).filter(s => !s.done).map(s => '• ' + s.title);
  if (pending.length) lines.push(pending.join('\n'));
  lines.push('— din MindMe (' + (c?.name || '') + ')');
  const rrule = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }[e.repeat];
  const out = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bifa//RO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@bifa`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape('🔔 ' + e.title)}`,
    `DESCRIPTION:${icsEscape(lines.join('\n'))}`,
  ];
  if (rrule) out.push(`RRULE:FREQ=${rrule}`);
  out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(e.title)}`, 'TRIGGER:-PT0M', 'END:VALARM');
  out.push('END:VEVENT', 'END:VCALENDAR');
  return out.join('\r\n');
}
async function addAlarm(e) {
  if (!e.med && (!e.hasReminder || !e.reminder)) return;
  const ics = e.med ? buildMedIcs(e) : buildIcs(e);
  e.alarmFor = alarmKey(e);
  save();
  const name = 'mindme-' + e.title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 30) + '.ics';
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) {
    // iOS: opening a text/calendar file shows the "Adaugă în Calendar" sheet
    window.location.href = url;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('Apasă „Adaugă” în fereastra Calendar 🔔');
  render();
}

// ---------- UI state ----------
const ui = {
  tab: 'today',
  catId: null,
  filter: 'active',
  search: '',
  reorder: false,
  sheet: null,      // { type: 'entry'|'category'|'actions', ... }
  stats: { view: 'general', range: '12', metric: 'spent', act: 'done', sel: '' },
};

const ICON = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2.2"/><rect x="13" y="3" width="8" height="8" rx="2.2"/><rect x="3" y="13" width="8" height="8" rx="2.2"/><rect x="13" y="13" width="8" height="8" rx="2.2"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c-3.6 0-6.2 2.8-6.2 6.3v3.7L4 15.6c-.4.7.1 1.5.9 1.5h14.2c.8 0 1.3-.8.9-1.5l-1.8-3.1V8.8c0-3.5-2.6-6.3-6.2-6.3z"/><path d="M9.3 18.6a2.8 2.8 0 0 0 5.4 0z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9.5"/><circle cx="7.6" cy="12" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="16.4" cy="12" r=".9" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 8h14M5 12h14M5 16h14"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>',
};

// ---------- rendering: shared pieces ----------
const APP_NAME = 'MindMe';
// top-left of the main screens: search button (the user didn't want the logo + name there)
const brand = () => `<button class="searchpill" data-act="search-open">${ICON.search}<span>Caută</span></button>`;
const chip = (text, color, act) => act
  ? `<button class="chip" style="--cc:${color}" ${act}>${esc(text)}</button>`
  : `<span class="chip" style="--cc:${color}">${esc(text)}</span>`;

function rowHtml(e, opts = {}) {
  if (e.med) return medRowHtml(e);
  const c = catById(e.cat);
  const col = colorOf(c);
  const chips = [];
  const subs = c?.usesSubs ? (e.subs || []) : [];
  if (subs.length) {
    const d = subs.filter(s => s.done).length;
    const lbl = (c.subsLabel || '').toLowerCase();
    const color = d === subs.length ? 'var(--green)' : d ? 'var(--orange)' : 'var(--muted)';
    chips.push(chip(d && d < subs.length ? `Parțial · ${d}/${subs.length} ${lbl}` : `${d}/${subs.length} ${lbl}`, color));
  }
  if (c?.usesDir) chips.push(chip(e.dir === 'in' ? '↙ De primit' : '↗ De plătit', e.dir === 'in' ? 'var(--green)' : 'var(--red)'));
  if (c?.usesPaid && e.hasAmount && e.amount) chips.push(e.paid ? chip('✓ Plătit', 'var(--green)') : chip('Neplătit', 'var(--red)'));
  if (c?.usesVendor && e.vendor) chips.push(chip(e.vendor, 'var(--muted)'));
  if (e.hasDeadline) {
    const t = deadlineText(e);
    if (isOverdue(e)) chips.push(chip('⚠ Întârziat · ' + t, 'var(--red)'));
    else if (isDueToday(e)) chips.push(chip('📅 ' + t, 'var(--orange)'));
    else chips.push(chip('📅 ' + t, e.done ? 'var(--muted)' : 'var(--blue)'));
  }
  if (e.hasReminder && !e.done) {
    const r = nextReminder(e);
    if (r) {
      let t = (e.repeat && e.repeat !== 'none' ? '🔁 ' : '🔔 ') + fmtDayTime(r);
      if (e.repeat && e.repeat !== 'none') t += ' · ' + REPEATS[e.repeat].toLowerCase();
      chips.push(chip(t, reminderMissed(e) ? 'var(--red)' : 'var(--pink)'));
    }
    if (!reminderMissed(e)) {
      chips.push(alarmAdded(e)
        ? chip('✓ în Calendar', 'var(--green)')
        : chip('+ Pune alarmă', 'var(--accent)', `data-act="alarm" data-id="${e.id}"`));
    }
  }
  if (c?.usesTracking && e.tracking) chips.push(chip('# ' + e.tracking, 'var(--muted)'));
  if (c?.usesGroups && e.group && opts.showGroup !== false) chips.push(chip('📁 ' + e.group, 'var(--purple)'));

  let amount = '';
  if (e.hasAmount && e.amount) {
    let color = 'var(--text)', sign = '';
    if (c?.usesDir) { sign = e.dir === 'in' ? '+' : '−'; color = e.done ? 'var(--muted)' : (e.dir === 'in' ? 'var(--green)' : 'var(--red)'); }
    else if (c?.usesPaid) color = e.paid ? 'var(--muted)' : 'var(--red)';
    amount = `<div class="ramount" style="color:${color}">${sign}${esc(money(e.amount, e.currency))}</div>`;
  }
  const prio = c?.usesPriority && e.priority && !e.done ? `<span class="prio" style="color:${e.priority === 2 ? 'var(--red)' : 'var(--orange)'}">${e.priority === 2 ? '!!' : '!'}</span>` : '';
  const catmark = opts.showCat && c ? `<span class="catdot">${c.icon}</span>` : '';
  const subsHtml = subs.length && !e.done ? `<div class="subs">${subs.slice(0, 8).map(s => `
      <div class="subrow ${s.done ? 'on' : ''}"><button class="subcheck ${s.done ? 'on' : ''}" style="--c:${col}" data-act="sub" data-id="${e.id}" data-sid="${s.id}">${ICON.check}</button><span>${esc(s.title)}</span></div>`).join('')}
      ${subs.length > 8 ? `<div class="footnote" style="margin:0">+ încă ${subs.length - 8}</div>` : ''}</div>` : '';

  return `<div class="swipe" data-swipe="entry" data-id="${e.id}" ${opts.reorder ? 'data-reorder="entry"' : ''}><button class="swipe-del" data-act="swipe-del" data-kind="entry" data-id="${e.id}">${ICON.trash}<span>Șterge</span></button>
  <div class="row swipe-content ${e.done ? 'done' : ''}" data-act="open" data-id="${e.id}">
    <button class="check ${e.done ? 'on' : ''}" style="--c:${col}" data-act="toggle" data-id="${e.id}" aria-label="Bifează">${ICON.check}</button>
    <div class="rbody">
      <div class="rtitle">${catmark}${prio}${esc(e.title)}</div>
      ${e.details ? `<div class="rdetails">${esc(e.details)}</div>` : ''}
      ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
      ${subsHtml}
    </div>
    ${amount}
  </div></div>`;
}

function sectionsHtml(sections, opts) {
  return sections.map(s => `
    ${s.title ? `<div class="sec-title ${s.id === 'overdue' ? 'red' : ''}">${esc(s.title)}</div>` : '<div style="height:14px"></div>'}
    <div class="group">${s.items.map(e => rowHtml(e, opts)).join('')}</div>`).join('');
}
const tile = (label, value, color) => `<div class="tile" style="--tc:${color}"><div class="tl">${esc(label)}</div><div class="tv">${esc(value)}</div></div>`;

// ---------- screens ----------
function screenToday() {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1), weekEnd = addDays(today, 8);
  const ov = [], td = [], wk = [];
  for (const e of sortEntries(db.entries.filter(e => !settledDone(e) && catById(e.cat)))) {
    const d = sortDate(e);
    const r = e.hasReminder ? nextReminder(e) : null;
    if (isRecent(e)) {
      // keep it where it was before being checked
      const wasOver = d && (e.deadlineTime ? d < new Date() : startOfDay(d) < today);
      if (wasOver) ov.push(e); else if ((d && d < tomorrow) || (r && sameDay(r, new Date()))) td.push(e); else wk.push(e);
    } else if (isOverdue(e) || reminderMissed(e)) ov.push(e);
    else if ((d && d < tomorrow) || (r && sameDay(r, new Date()))) td.push(e);
    else if (d && d < weekEnd) wk.push(e);
  }
  const install = !isStandalone() ? `<div class="banner"><b>📲 Pune MindMe pe ecranul telefonului</b>În Safari apasă <b style="display:inline">Partajează</b> (pătratul cu săgeată) → <b style="display:inline">Adaugă pe ecranul principal</b>.</div>` : '';
  const sec = (title, items, cls) => items.length ? `<div class="sec-title ${cls}">${title}</div><div class="group">${items.map(e => rowHtml(e, { showCat: true })).join('')}</div>` : '';
  return `
    <div class="topbar"><div class="left">${brand()}</div><div class="right"><button class="iconbtn fill" data-act="new-pick">${ICON.plus}</button></div></div>
    <h1>${esc(cap(fLong.format(new Date())))}</h1>
    ${install}
    <div class="tiles three">
      ${tile('Întârziate', ov.length, ov.length ? 'var(--red)' : 'var(--muted)')}
      ${tile('Azi', td.length, 'var(--orange)')}
      ${tile('7 zile', wk.length, 'var(--blue)')}
    </div>
    ${!ov.length && !td.length && !wk.length && !dosesOn(new Date()).length ? `<div class="empty"><div class="big">☀️</div><b>Ziua e liberă</b>Nimic întârziat sau programat în zilele următoare.</div>` : ''}
    ${medsTodayHtml()}
    ${sec('Întârziate', ov, 'red')}
    ${sec('Azi', td, 'orange')}
    ${sec('Următoarele 7 zile', wk, '')}`;
}

function medsTodayHtml() {
  const doses = dosesOn(new Date());
  if (!doses.length) return '';
  const taken = doses.filter(x => x.taken).length;
  return `<div class="sec-title" style="color:var(--text);font-size:15px;text-transform:none;margin-top:24px">💊 Medicamente azi · ${taken} din ${doses.length} luate</div>
    ${doseRowsHtml(doses, new Date())}`;
}

function screenLists() {
  const rows = cats().map((c, i, arr) => {
    const items = db.entries.filter(e => e.cat === c.id);
    const active = items.filter(e => !e.done);
    const over = active.filter(e => isOverdue(e) || reminderMissed(e)).length;
    const today = active.filter(isDueToday).length;
    let sub = active.length ? `${active.length} ${active.length === 1 ? 'activ' : 'active'}` : 'Totul e bifat ✓';
    if (today) sub += ` · ${today} azi`;
    if (over) sub += ` · ${over} întârziat${over === 1 ? '' : 'e'}`;
    if (isMedCat(c)) {
      const running = items.filter(e => e.med && medStatus(e).state === 'active').length;
      const doses = dosesOn(new Date()).filter(x => x.e.cat === c.id);
      sub = running ? `${running} ${running === 1 ? 'tratament' : 'tratamente'} în curs` : 'Niciun tratament în curs';
      if (doses.length) sub += ` · azi ${doses.filter(x => x.taken).length}/${doses.length} luate`;
    }
    const right = ui.reorder
      ? `<div class="order-btns"><button data-act="cat-up" data-id="${c.id}" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>${ICON.up}</button><button data-act="cat-down" data-id="${c.id}" ${i === arr.length - 1 ? 'disabled style="opacity:.3"' : ''}>${ICON.down}</button></div>`
      : `${active.length ? `<span class="badge" style="--c:${colorOf(c)}">${active.length}</span>` : ''}
         <button class="gear" data-act="cat-rules" data-id="${c.id}" aria-label="Reguli">${ICON.gear}</button>
         <span class="chev">${ICON.chev}</span>`;
    return `<div class="swipe" ${ui.reorder ? '' : 'data-swipe="cat" data-reorder="cat"'} data-id="${c.id}"><button class="swipe-del" data-act="swipe-del" data-kind="cat" data-id="${c.id}">${ICON.trash}<span>Șterge</span></button>
    <button class="swipe-set" data-act="swipe-set" data-id="${c.id}">${ICON.gear}<span>Setări</span></button>
    <div class="catrow swipe-content" data-act="${ui.reorder ? '' : 'open-cat'}" data-id="${c.id}">
      <div class="caticon" style="--c:${colorOf(c)}">${c.icon}</div>
      <div style="flex:1;min-width:0"><div class="catname">${esc(c.name)}</div><div class="catsub ${over ? 'red' : ''}">${sub}</div></div>
      ${right}
    </div></div>`;
  }).join('');
  return `
    <div class="topbar"><div class="left">${brand()}</div>
      <div class="right"><button class="iconbtn fill" data-act="cat-new">${ICON.plus}</button></div></div>
    <h1>Liste</h1>
    <div class="group">${rows || '<div class="empty">Nicio listă.</div>'}</div>
    <div class="group mt"><button class="linkrow" data-act="cat-new">${ICON.plus} Listă nouă</button></div>
    <div class="footnote">Ține apăsat pe o listă și trage-o ca s-o muți. Glisează spre stânga pentru setări, spre dreapta pentru ștergere.</div>
    <div class="sec-title">Backup</div>
    <div class="group">
      <button class="linkrow" data-act="export">${ICON.download} Salvează o copie (backup)</button>
      <button class="linkrow" data-act="import">${ICON.upload} Încarcă dintr-un backup</button>
    </div>
    <div class="footnote">Datele stau doar pe telefonul tău. Fă din când în când un backup (ex: în Fișiere / iCloud Drive). Versiunea ${VERSION}</div>`;
}

function moneyCard() {
  if (!db.categories.some(c => c.usesAmount)) return '';
  const items = moneyItems();
  const now = new Date();
  const month = items.filter(x => x.date.getFullYear() === now.getFullYear() && x.date.getMonth() === now.getMonth());
  const pairs = l => l.map(x => [x.e.amount, x.e.currency]);
  return `<button class="moneycard" data-act="money">
    <div class="mc-head"><span>💰 Bani</span><span class="chev">${ICON.chev}</span></div>
    <div class="mc-grid">
      <div><div class="mc-l">Cheltuit luna asta</div><div class="mc-v" style="color:var(--red)">${esc(totals(pairs(month.filter(x => x.flow === 'spent'))))}</div></div>
      <div><div class="mc-l">Primit luna asta</div><div class="mc-v" style="color:var(--green)">${esc(totals(pairs(month.filter(x => x.flow === 'received'))))}</div></div>
      <div><div class="mc-l">De plătit</div><div class="mc-v">${esc(totals(pairs(items.filter(x => x.flow === 'toPay'))))}</div></div>
      <div><div class="mc-l">De primit</div><div class="mc-v">${esc(totals(pairs(items.filter(x => x.flow === 'toReceive'))))}</div></div>
    </div>
  </button>`;
}

function categoryVisible(c) {
  const q = ui.search.trim().toLowerCase();
  return db.entries.filter(e => {
    if (e.cat !== c.id) return false;
    if (ui.filter === 'active' && settledDone(e)) return false;
    if (ui.filter === 'done' && !e.done) return false;
    if (!q) return true;
    return [e.title, e.details, e.vendor, e.group, e.tracking, ...(e.subs || []).map(s => s.title)]
      .some(t => (t || '').toLowerCase().includes(q));
  });
}
function categoryListHtml(c) {
  const vis = categoryVisible(c);
  let sections;
  if (c.groupMode === 'date') sections = sectionsByDate(vis);
  else if (c.groupMode === 'group' && c.usesGroups) sections = sectionsByGroup(vis);
  else sections = sectionsFlat(vis);
  if (!sections.length) {
    return `<div class="empty"><div class="big">${c.icon}</div><b>${ui.filter === 'done' ? 'Nimic bifat încă' : 'Nimic aici'}</b>
      ${ui.search ? `Niciun rezultat pentru „${esc(ui.search)}”.` : 'Apasă + ca să adaugi ceva.'}
      ${!ui.search && ui.filter !== 'done' ? `<div class="mt"><button class="btn" style="background:${colorOf(c)}" data-act="new" data-id="${c.id}">Adaugă</button></div>` : ''}</div>`;
  }
  return sectionsHtml(sections, { showGroup: c.groupMode !== 'group', reorder: true });
}
function screenCategory(c) {
  if (isMedCat(c)) return screenMeds(c);
  const all = db.entries.filter(e => e.cat === c.id);
  const active = all.filter(e => !e.done);
  const col = colorOf(c);
  const tiles = [tile('Active', active.length, col)];
  if (c.usesDeadline) { const o = active.filter(isOverdue).length; tiles.push(tile('Întârziate', o, o ? 'var(--red)' : 'var(--muted)')); }
  if (c.usesAmount) {
    const pairs = l => l.filter(e => e.hasAmount).map(e => [e.amount, e.currency]);
    if (c.usesDir) {
      tiles.push(tile('De plătit', totals(pairs(active.filter(e => e.dir !== 'in'))), 'var(--red)'));
      tiles.push(tile('De primit', totals(pairs(active.filter(e => e.dir === 'in'))), 'var(--green)'));
    } else if (c.usesPaid) tiles.push(tile('Neplătit', totals(pairs(all.filter(e => !e.paid))), 'var(--red)'));
    else tiles.push(tile('Total', totals(pairs(active)), 'var(--blue)'));
  }
  if (!c.usesDeadline && c.reminderMode !== 'off') tiles.push(tile('Programate', active.filter(e => e.hasReminder && !reminderMissed(e)).length, 'var(--pink)'));
  const showTiles = c.summary && all.length;
  return `
    <div class="topbar"><div class="left"><button class="back" data-act="back">${ICON.back}Liste</button></div>
      <div class="right">${c.usesAmount ? `<button class="iconbtn" data-act="stats" data-id="${c.id}" aria-label="Statistici">${ICON.chart}</button>` : ''}
      <button class="iconbtn" data-act="cat-menu" data-id="${c.id}">${ICON.more}</button>
      <button class="iconbtn fill" style="background:${col}" data-act="new" data-id="${c.id}">${ICON.plus}</button></div></div>
    <h1><span class="emo">${c.icon}</span>${esc(c.name)}</h1>
    ${showTiles ? `<div class="tiles">${tiles.join('')}</div>` : ''}
    <div class="seg">${['active', 'done', 'all'].map(f => `<button class="${ui.filter === f ? 'on' : ''}" data-act="filter" data-f="${f}">${{ active: 'Active', done: 'Bifate', all: 'Toate' }[f]}</button>`).join('')}</div>
    <input class="search" type="search" id="search" placeholder="Caută în ${esc(c.name)}" value="${esc(ui.search)}">
    <div id="catlist">${categoryListHtml(c)}</div>`;
}

function screenReminders() {
  const list = db.entries.filter(e => e.hasReminder && catById(e.cat));
  const missed = list.filter(reminderMissed).sort((a, b) => parseLocal(b.reminder) - parseLocal(a.reminder));
  const upcoming = list.filter(e => (!e.done || isRecent(e)) && !reminderMissed(e));
  const days = {};
  for (const e of upcoming) { const d = startOfDay(nextReminder(e)); (days[+d] ||= []).push(e); }
  const keys = Object.keys(days).map(Number).sort((a, b) => a - b);
  const notAdded = upcoming.filter(e => !alarmAdded(e)).length;
  return `
    <div class="topbar"><div class="left">${brand()}</div><div class="right"><button class="iconbtn fill" data-act="new-pick" data-rem="1">${ICON.plus}</button></div></div>
    <h1>Remindere</h1>
    ${notAdded ? `<div class="banner"><b>🔔 ${notAdded} ${notAdded === 1 ? 'reminder fără alarmă' : 'remindere fără alarmă'}</b>Apasă „+ Pune alarmă” ca să sune la ora aleasă, chiar dacă aplicația e închisă (se pune în Calendarul iPhone-ului).</div>` : ''}
    ${!missed.length && !keys.length ? `<div class="empty"><div class="big">🔔</div><b>Niciun reminder</b>Adaugă unul cu + sau pune „Amintește-mi” la orice element.</div>` : ''}
    ${missed.length ? `<div class="sec-title red">Trecute, nebifate</div><div class="group">${missed.map(e => rowHtml(e, { showCat: true })).join('')}</div>` : ''}
    ${keys.map(k => `<div class="sec-title">${esc(dayHeader(new Date(k)))}</div><div class="group">${sortByRem(days[k]).map(e => rowHtml(e, { showCat: true })).join('')}</div>`).join('')}`;
}
const sortByRem = l => [...l].sort((a, b) => nextReminder(a) - nextReminder(b));

function render() {
  const app = document.getElementById('app');
  const y = window.scrollY;
  let html;
  if (ui.tab === 'lists' && ui.catId && catById(ui.catId)) html = screenCategory(catById(ui.catId));
  else if (ui.tab === 'lists') { ui.catId = null; html = screenLists(); }
  else if (ui.tab === 'reminders') html = screenReminders();
  else if (ui.tab === 'stats') html = screenStats();
  else html = screenToday();
  app.innerHTML = html;
  openSwipeEl = null;
  window.scrollTo(0, y);
  renderTabbar();
}
// Bottom bar like WhatsApp: a "bubble" sits behind the selected tab and slides;
// drag your finger along the bar and the bubble follows, let go to open that tab.
const TABS = [['today', 'Azi', 'sun'], ['lists', 'Liste', 'grid'], ['reminders', 'Remindere', 'bell'], ['stats', 'Statistici', 'chart']];
function renderTabbar() {
  const bar = document.getElementById('tabbar');
  const badge = db.entries.filter(e => !e.done && !e.med && catById(e.cat) && (isOverdue(e) || isDueToday(e) || reminderMissed(e))).length
    + dosesOn(new Date()).filter(x => doseLate(x, new Date())).length;
  if (!bar.querySelector('.pill')) {
    bar.innerHTML = `<span class="pill"></span>` + TABS.map(([id, label, icon]) =>
      `<button data-tab="${id}">${ICON[icon]}<span>${label}</span><span class="tbadge hidden"></span></button>`).join('');
  }
  bar.querySelectorAll('button[data-tab]').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === ui.tab);
    const tb = b.querySelector('.tbadge');
    const n = b.dataset.tab === 'today' ? badge : 0;
    tb.textContent = n || '';
    tb.classList.toggle('hidden', !n);
  });
  if (!tabDrag) placePill(bar.querySelector(`button[data-tab="${ui.tab}"]`));
  try { if (navigator.setAppBadge) badge ? navigator.setAppBadge(badge) : navigator.clearAppBadge(); } catch (e) { /* ignore */ }
}
function placePill(btn, x) {
  const bar = document.getElementById('tabbar');
  const pill = bar.querySelector('.pill');
  if (!pill || !btn) return;
  // layout sizes (not affected by the bar's grow/shrink animation)
  const br = bar.getBoundingClientRect();
  const scale = br.width / (bar.offsetWidth || br.width) || 1;
  const w = btn.offsetWidth - 4;
  const left = x === undefined
    ? btn.offsetLeft + 2
    : Math.max(4, Math.min(bar.offsetWidth - w - 4, (x - br.left) / scale - w / 2));
  pill.style.width = w + 'px';
  pill.style.transform = `translateX(${left}px)`;
}
function switchTab(id) {
  if (ui.tab === id && !ui.catId) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  ui.tab = id; ui.catId = null; ui.reorder = false; ui.search = '';
  render();
  window.scrollTo(0, 0);
}
let tabDrag = null;
function tabAt(x) {
  const btns = [...document.querySelectorAll('#tabbar button[data-tab]')];
  return btns.find(b => { const r = b.getBoundingClientRect(); return x >= r.left && x < r.right; })
    || (x < btns[0].getBoundingClientRect().left ? btns[0] : btns[btns.length - 1]);
}
document.addEventListener('pointerdown', ev => {
  const bar = ev.target.closest('#tabbar');
  if (!bar || ui.sheet) return;
  ev.preventDefault();
  tabDrag = { id: ev.pointerId, startX: ev.clientX, moved: false, over: tabAt(ev.clientX) };
  try { bar.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  bar.classList.add('dragging', 'pressing');
  bar.classList.remove('compact');
  placePill(tabDrag.over, ev.clientX);
  markOver(tabDrag.over);
});
function markOver(btn) {
  document.querySelectorAll('#tabbar button[data-tab]').forEach(b => b.classList.toggle('over', b === btn));
}
document.addEventListener('pointermove', ev => {
  if (!tabDrag || ev.pointerId !== tabDrag.id) return;
  if (Math.abs(ev.clientX - tabDrag.startX) > 6) tabDrag.moved = true;
  const over = tabAt(ev.clientX);
  if (over !== tabDrag.over) { tabDrag.over = over; try { navigator.vibrate?.(6); } catch (e) { /* ignore */ } }
  markOver(over);
  placePill(over, ev.clientX);
});
function endTabDrag(ev) {
  if (!tabDrag || (ev && ev.pointerId !== tabDrag.id)) return;
  const target = tabDrag.over;
  tabDrag = null;
  const bar = document.getElementById('tabbar');
  bar.classList.remove('dragging', 'pressing');
  markOver(null);
  if (ev && ev.type === 'pointercancel') { renderTabbar(); return; }
  if (target) { placePill(target); switchTab(target.dataset.tab); }
}
document.addEventListener('pointerup', endTabDrag);
document.addEventListener('pointercancel', endTabDrag);
window.addEventListener('resize', () => { if (!tabDrag) placePill(document.querySelector(`#tabbar button[data-tab="${ui.tab}"]`)); });
// scrolling down: the glass bar gets a little smaller; scrolling up or at the top: back to normal
let lastScrollY = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  const bar = document.getElementById('tabbar');
  if (!bar || tabDrag) { lastScrollY = y; return; }
  if (y < 40 || y < lastScrollY - 6) bar.classList.remove('compact');
  else if (y > lastScrollY + 6) bar.classList.add('compact');
  if (Math.abs(y - lastScrollY) > 6) lastScrollY = y;
}, { passive: true });

// ---------- entry editor ----------
function newDraft(c) {
  const tomorrow = addDays(new Date(), 1);
  const nextHour = new Date(); nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return {
    id: null, cat: c.id, title: '', details: '', group: '', done: false,
    hasDeadline: false, deadline: toLocal(atTime(tomorrow, c.deadlineTime ? 18 : 12, 0)),
    hasAmount: c.usesAmount && !c.usesPaid, amountText: '', currency: c.currency || 'RON', paid: false, dir: 'out',
    vendor: '', tracking: '', priority: 0,
    hasReminder: c.reminderMode === 'always', reminder: toLocal(nextHour), repeat: 'none',
    subs: [], remTouched: false,
  };
}
function draftFrom(e) {
  return { ...clone(e), amountText: e.amount ? String(e.amount).replace('.', ',') : '', subs: clone(e.subs || []), remTouched: !!e.hasReminder };
}
function openEntry(catId, entryId) {
  const c = catById(catId);
  if (!c) return;
  if (isMedCat(c)) { openMed(catId, entryId); return; }
  const e = entryId ? entryById(entryId) : null;
  ui.sheet = { type: 'entry', d: e ? draftFrom(e) : newDraft(c), isNew: !e };
  renderSheet();
  if (!e) setTimeout(() => document.getElementById('f-title')?.focus(), 300);
}
function applyAutoReminder(d) {
  const c = catById(d.cat);
  if (!c || !c.autoRem || !c.usesDeadline || c.reminderMode === 'off' || d.remTouched) return;
  if (d.hasDeadline) {
    const dl = parseLocal(d.deadline);
    const [h, m] = (c.autoRemTime || '09:00').split(':').map(Number);
    const r = atTime(addDays(dl, -(c.autoRemDays || 0)), h || 0, m || 0);
    d.reminder = toLocal(r);
    d.hasReminder = c.reminderMode === 'always' || r > new Date();
  } else if (c.reminderMode === 'optional') d.hasReminder = false;
}
function quickOptions(d, c) {
  const now = new Date();
  const out = [['Peste o oră', new Date(now.getTime() + 3600000)]];
  const ev = atTime(now, 20, 0); if (ev > now) out.push(['Diseară 20:00', ev]);
  out.push(['Mâine 9:00', atTime(addDays(now, 1), 9, 0)]);
  if (c.usesDeadline && d.hasDeadline) {
    const dl = parseLocal(d.deadline);
    const b = atTime(addDays(dl, -1), 9, 0); if (b > now) out.push(['Cu o zi înainte', b]);
    const s = atTime(dl, 9, 0); if (s > now) out.push(['În ziua termenului', s]);
  }
  out.push(['Peste o săptămână', atTime(addDays(now, 7), 9, 0)]);
  return out;
}
const sw = (field, on) => `<label class="sw"><input type="checkbox" data-bind="${field}" ${on ? 'checked' : ''}><span></span></label>`;

function entrySheetHtml() {
  const { d, isNew } = ui.sheet;
  const c = catById(d.cat);
  const col = colorOf(c);
  const groups = [...new Set(db.entries.filter(e => e.cat === c.id && e.group).map(e => e.group))].sort((a, b) => a.localeCompare(b, 'ro'));
  const parts = [];

  parts.push(`<div class="form">
    <div class="field"><input type="text" id="f-title" class="titlein" data-bind="title" placeholder="${esc(c.placeholder)}" value="${esc(d.title)}" enterkeyhint="done"></div>
    <div class="field"><textarea data-bind="details" rows="2" placeholder="Detalii (opțional)">${esc(d.details)}</textarea></div>
  </div>`);

  if (db.categories.length > 1) {
    parts.push(`<div class="form"><div class="field"><span class="ico">🗂️</span><span class="lbl">Listă</span>
      <select data-bind="cat">${cats().map(x => `<option value="${x.id}" ${x.id === d.cat ? 'selected' : ''}>${x.icon} ${esc(x.name)}</option>`).join('')}</select></div></div>`);
  }

  const remSection = () => {
    const on = d.hasReminder || c.reminderMode === 'always';
    const past = on && d.repeat === 'none' && parseLocal(d.reminder) < new Date();
    let h = `<div class="fhead">Reminder</div><div class="form">`;
    if (c.reminderMode === 'optional') h += `<div class="field"><span class="ico">🔔</span><span class="lbl">Amintește-mi</span>${sw('hasReminder', d.hasReminder)}</div>`;
    if (on) {
      h += `<div class="field"><span class="lbl">Când</span><input type="datetime-local" data-bind="reminder" value="${esc(d.reminder)}"></div>
        <div class="field"><span class="ico">🔁</span><span class="lbl">Repetă</span><select data-bind="repeat">${Object.entries(REPEATS).map(([k, v]) => `<option value="${k}" ${d.repeat === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="quick">${quickOptions(d, c).map(([l, dt]) => `<button data-act="quick" data-v="${toLocal(dt)}">${l}</button>`).join('')}</div>`;
    }
    h += `</div>`;
    if (past) h += `<div class="ffoot orange">Ora aleasă a trecut deja — alege una din viitor.</div>`;
    else if (on) h += `<div class="ffoot">Când apeși „Salvează”, se deschide Calendarul: apasă „Adaugă” și alarma sună la ora asta, chiar dacă aplicația e închisă.</div>`;
    return h;
  };

  if (c.reminderMode === 'always') parts.push(remSection());

  if (c.usesSubs) {
    const done = d.subs.filter(s => s.done).length;
    parts.push(`<div class="fhead">${esc(c.subsLabel)}</div><div class="form">
      <div class="sublist">${d.subs.map(s => `<div class="subedit ${s.done ? 'on' : ''}" data-row="${s.id}">
        <button class="subcheck ${s.done ? 'on' : ''}" style="--c:${col}" data-act="dsub-toggle" data-sid="${s.id}">${ICON.check}</button>
        <input type="text" value="${esc(s.title)}" data-subtitle="${s.id}">
        <button class="x" data-act="dsub-del" data-sid="${s.id}" aria-label="Șterge">×</button>
        ${d.subs.length > 1 ? `<span class="handle" data-drag="${s.id}" aria-label="Mută">${ICON.grip}</span>` : ''}</div>`).join('')}</div>
      <div class="subedit"><span style="color:${col};font-size:22px;width:20px;text-align:center">+</span>
        <input type="text" id="newsub" placeholder="Adaugă (Enter pentru următorul)" enterkeyhint="next"></div>
    </div>
    ${d.subs.length ? `<div class="ffoot">${done} din ${d.subs.length} bifate${c.subsAuto ? ' · se bifează singur când sunt toate' : ''}${d.subs.length > 1 ? ' · ține apăsat pe ☰ și trage ca să le muți' : ''}</div>` : ''}`);
  }

  if (c.usesDir || c.usesVendor || c.usesTracking || c.usesAmount) {
    let h = `<div class="fhead">Detalii</div><div class="form">`;
    if (c.usesDir) h += `<div class="fieldcol"><div class="segin" style="margin:0">
        <button class="${d.dir !== 'in' ? 'on' : ''}" data-act="dir" data-v="out">↗ De plătit</button>
        <button class="${d.dir === 'in' ? 'on' : ''}" data-act="dir" data-v="in">↙ De primit</button></div></div>`;
    if (c.usesVendor) h += `<div class="field"><input type="text" data-bind="vendor" placeholder="${esc(c.vendorLabel)}" value="${esc(d.vendor)}"></div>`;
    if (c.usesTracking) h += `<div class="field"><input type="text" data-bind="tracking" placeholder="${esc(c.trackingLabel)}" value="${esc(d.tracking)}" autocapitalize="characters" autocomplete="off"></div>`;
    if (c.usesAmount) {
      if (c.usesPaid) h += `<div class="field"><span class="ico">💰</span><span class="lbl">Are cost</span>${sw('hasAmount', d.hasAmount)}</div>`;
      if (d.hasAmount || !c.usesPaid) {
        h += `<div class="field"><input type="text" inputmode="decimal" class="amountin" data-bind="amountText" placeholder="Sumă" value="${esc(d.amountText)}">
          <select data-bind="currency" style="max-width:90px">${CURRENCIES.map(x => `<option ${x === d.currency ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`;
        if (c.usesPaid) h += `<div class="field"><span class="ico">${d.paid ? '✅' : '💵'}</span><span class="lbl">${d.paid ? 'Plătit' : 'Neplătit (ex: ramburs)'}</span>${sw('paid', d.paid)}</div>`;
      }
    }
    parts.push(h + `</div>`);
  }

  if (c.usesPriority || c.usesGroups) {
    let h = `<div class="form" style="margin-top:18px">`;
    if (c.usesPriority) h += `<div class="field"><span class="ico">🚩</span><span class="lbl">Prioritate</span><select data-bind="priority">${PRIORITIES.map((p, i) => `<option value="${i}" ${+d.priority === i ? 'selected' : ''}>${p}</option>`).join('')}</select></div>`;
    if (c.usesGroups) {
      h += `<div class="field"><span class="ico">📁</span><input type="text" data-bind="group" list="grouplist" placeholder="Grup (ex: Casă, Muncă)" value="${esc(d.group)}">
        <datalist id="grouplist">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></div>`;
      if (groups.length) h += `<div class="quick" style="--pink:var(--purple)">${groups.map(g => `<button data-act="pickgroup" data-v="${esc(g)}">${esc(g)}</button>`).join('')}</div>`;
    }
    parts.push(h + `</div>`);
  }

  if (c.usesDeadline) {
    parts.push(`<div class="form" style="margin-top:18px">
      <div class="field"><span class="ico">📅</span><span class="lbl">${esc(c.deadlineLabel)}</span>${sw('hasDeadline', d.hasDeadline)}</div>
      ${d.hasDeadline ? `<div class="field"><span class="lbl">Data</span>${c.deadlineTime
        ? `<input type="datetime-local" data-bind="deadline" value="${esc(d.deadline)}">`
        : `<input type="date" data-bind="deadlineDate" value="${esc(d.deadline.slice(0, 10))}">`}</div>` : ''}
    </div>`);
  }

  if (c.reminderMode === 'optional') parts.push(remSection());

  if (!isNew) {
    parts.push(`<div class="form" style="margin-top:24px">
      <div class="field"><span class="ico">✔️</span><span class="lbl">${esc(c.doneLabel)}</span>${sw('done', d.done)}</div></div>
      <button class="btn red block mt" data-act="entry-delete">Șterge</button>`);
  }

  const remOn = d.hasReminder || c.reminderMode === 'always';
  const canAlarm = remOn && (d.repeat !== 'none' || parseLocal(d.reminder) > new Date());

  return `<div class="overlay"></div>
    <div class="panel" style="--accent:${col}">
      <div class="panel-head"><button data-act="sheet-close">Renunță</button>
        <div class="t">${isNew ? 'Nou în ' + esc(c.name) : 'Editează'}</div>
        <button class="save" data-act="entry-save" ${d.title.trim() ? '' : 'disabled'}>Salvează</button></div>
      <div class="panel-body">${parts.join('')}</div>
    </div>`;
}

function addDraftSub() {
  const inp = document.getElementById('newsub');
  if (!inp || !ui.sheet || ui.sheet.type !== 'entry') return;
  const t = inp.value.trim();
  if (!t) return;
  ui.sheet.d.subs.push({ id: uid(), title: t, done: false });
  inp.value = '';
  renderSheet();
  setTimeout(() => document.getElementById('newsub')?.focus(), 0);
}
function saveEntry(withAlarm) {
  const s = ui.sheet;
  if (!s || s.type !== 'entry') return;
  const nb = document.getElementById('newsub');
  if (nb && nb.value.trim()) s.d.subs.push({ id: uid(), title: nb.value.trim(), done: false });
  const d = s.d;
  if (!d.title.trim()) return;
  const c = catById(d.cat);
  let e = d.id ? entryById(d.id) : null;
  if (!e) { e = { id: uid(), createdAt: Date.now() }; db.entries.push(e); }
  const amount = parseAmount(d.amountText);
  if (d.done !== !!e.done) e.doneAt = d.done ? Date.now() : null;
  Object.assign(e, {
    cat: c.id,
    title: d.title.trim(),
    details: d.details.trim(),
    group: c.usesGroups ? d.group.trim() : (e.group || ''),
    done: d.done,
    hasDeadline: c.usesDeadline && d.hasDeadline,
    deadline: d.deadline,
    deadlineTime: !!c.deadlineTime,
    hasAmount: c.usesAmount && (d.hasAmount || amount > 0),
    amount, currency: d.currency,
    paid: !!d.paid, dir: d.dir || 'out',
    vendor: d.vendor.trim(), tracking: d.tracking.trim(),
    priority: c.usesPriority ? +d.priority : 0,
    hasReminder: c.reminderMode === 'always' ? true : c.reminderMode === 'off' ? false : !!d.hasReminder,
    reminder: d.reminder, repeat: d.repeat || 'none',
    subs: d.subs.filter(x => x.title.trim()).map(x => ({ id: x.id, title: x.title.trim(), done: !!x.done })),
    alarmFor: d.alarmFor || e.alarmFor || null,
  });
  if (c.usesSubs && c.subsAuto && e.subs.length && e.subs.every(x => x.done) && !e.done) { e.done = true; e.doneAt = Date.now(); }
  save();
  closeSheet();
  const needsAlarm = e.hasReminder && !e.done && !alarmAdded(e) && (e.repeat !== 'none' || parseLocal(e.reminder) > new Date());
  if (withAlarm || needsAlarm) addAlarm(e);
  else toast('Salvat ✓');
}

// ---------- category editor ----------
function openCategory(id) {
  const c = id ? catById(id) : null;
  const d = c ? clone(c) : { id: null, name: '', icon: '📁', color: 5, ...templateRules('blank'), usesDeadline: true };
  ui.sheet = { type: 'category', d, isNew: !c };
  renderSheet();
}
function categorySheetHtml() {
  const { d, isNew } = ui.sheet;
  const col = colorOf(d);
  const tg = (field, label, ico) => `<div class="field">${ico ? `<span class="ico">${ico}</span>` : ''}<span class="lbl">${label}</span>${sw('c.' + field, d[field])}</div>`;
  const tx = (field, label, ph) => `<div class="field"><span class="lbl" style="color:var(--muted);font-size:15px">${label}</span><input type="text" class="right" data-bind="c.${field}" placeholder="${esc(ph)}" value="${esc(d[field])}"></div>`;
  const count = isNew ? 0 : db.entries.filter(e => e.cat === d.id).length;
  const days = +d.autoRemDays === 0 ? 'În ziua termenului' : +d.autoRemDays === 1 ? 'Cu o zi înainte' : `Cu ${d.autoRemDays} zile înainte`;
  return `<div class="overlay"></div>
  <div class="panel" style="--accent:${col}">
    <div class="panel-head"><button data-act="sheet-close">Renunță</button><div class="t">${isNew ? 'Listă nouă' : 'Reguli listă'}</div>
      <button class="save" data-act="cat-save" ${d.name.trim() ? '' : 'disabled'}>Salvează</button></div>
    <div class="panel-body">
      <div class="form">
        <div class="preview"><div class="caticon" style="--c:${col}">${d.icon}</div><input type="text" data-bind="c.name" placeholder="Numele listei" value="${esc(d.name)}"></div>
        <div class="colors">${PALETTE.map((p, i) => `<button class="${d.color === i ? 'on' : ''}" style="--c:${p}" data-act="c-color" data-v="${i}">${d.color === i ? '✓' : ''}</button>`).join('')}</div>
        <div class="emojis" style="--c:color-mix(in srgb, ${col} 30%, transparent)">${EMOJIS.map(e => `<button class="${d.icon === e ? 'on' : ''}" data-act="c-icon" data-v="${e}">${e}</button>`).join('')}</div>
      </div>

      <div class="form" style="margin-top:14px"><div class="field"><span class="ico">🪄</span><span class="lbl">Copiază regulile de la</span>
        <select data-act-change="c-template"><option value="">alege…</option>${Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}">${t.icon} ${t.label}</option>`).join('')}</select></div></div>
      <div class="ffoot">${d.kind === 'meds' ? 'Asta e o listă de medicamente: are câmpurile ei (doză, ore, zile, durata tratamentului).' : 'Ex: alege „Comenzi” ca să ai sumă, plătit/neplătit, AWB și produse; „Medicamente” pentru tratamente.'}</div>
      ${d.kind === 'meds' ? '' : `

      <div class="fhead">Ce câmpuri au elementele</div>
      <div class="form">
        ${tx('placeholder', 'Indiciu la titlu', 'Titlu')}
        ${tg('usesDeadline', 'Termen / dată', '📅')}
        ${d.usesDeadline ? tx('deadlineLabel', 'Se numește', 'Termen limită') + tg('deadlineTime', 'Include și ora', '🕐') : ''}
        ${tg('usesAmount', 'Sumă de bani', '💰')}
        ${d.usesAmount ? `<div class="field"><span class="ico"></span><span class="lbl">Moneda implicită</span><select data-bind="c.currency">${CURRENCIES.map(x => `<option ${x === d.currency ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`
          + tg('usesPaid', 'Plătit / neplătit', '✅') + tg('usesDir', 'De plătit / de primit', '↕️') : ''}
        ${tg('usesSubs', 'Sub-elemente (produse, pași)', '📋')}
        ${d.usesSubs ? tx('subsLabel', 'Se numesc', 'Sub-elemente') + tg('subsAuto', 'Bifează automat când sunt toate', '✔️') : ''}
        ${tg('usesVendor', 'Persoană / magazin', '👤')}
        ${d.usesVendor ? tx('vendorLabel', 'Se numește', 'Persoană / magazin') : ''}
        ${tg('usesTracking', 'Cod / număr (AWB…)', '#️⃣')}
        ${d.usesTracking ? tx('trackingLabel', 'Se numește', 'Cod / AWB') : ''}
        ${tg('usesPriority', 'Prioritate', '🚩')}
        ${tg('usesGroups', 'Grupuri', '📁')}
        ${tx('doneLabel', 'Cuvânt pentru bifă', 'Bifat')}
      </div>

      <div class="fhead">Remindere</div>
      <div class="form">
        <div class="field"><span class="ico">🔔</span><select data-bind="c.reminderMode" style="max-width:100%;flex:1;text-align:left;direction:ltr;color:var(--text)">${Object.entries(REM_MODES).map(([k, v]) => `<option value="${k}" ${d.reminderMode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        ${d.reminderMode !== 'off' && d.usesDeadline ? tg('autoRem', 'Reminder automat înainte de termen', '⏰') : ''}
        ${d.reminderMode !== 'off' && d.usesDeadline && d.autoRem ? `
          <div class="field"><span class="lbl">${days}</span>
            <div class="order-btns"><button data-act="c-days" data-v="-1">−</button><button data-act="c-days" data-v="1">+</button></div></div>
          <div class="field"><span class="lbl">La ora</span><input type="time" data-bind="c.autoRemTime" value="${esc(d.autoRemTime)}"></div>` : ''}
      </div>
      ${d.reminderMode !== 'off' && d.usesDeadline && d.autoRem ? '<div class="ffoot">Când pui un termen, reminderul se completează singur. Îl poți schimba oricând.</div>' : ''}

      <div class="fhead">Afișare și curățenie</div>
      <div class="form">
        <div class="field"><span class="lbl">Grupare</span><select data-bind="c.groupMode">${Object.entries(GROUP_MODES).map(([k, v]) => `<option value="${k}" ${d.groupMode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        ${tg('summary', 'Sumar sus (totaluri, întârziate)', '')}
        <div class="field"><span class="lbl">Șterge automat bifatele</span><select data-bind="c.autoDelete">${[[0, 'Niciodată'], [1, 'După o zi'], [7, 'După 7 zile'], [30, 'După 30 de zile']].map(([v, l]) => `<option value="${v}" ${+d.autoDelete === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>`}

      ${!isNew ? `<button class="btn red block mt" data-act="cat-delete">Șterge lista${count ? ` (și cele ${count} elemente)` : ''}</button>` : ''}
    </div>
  </div>`;
}
function saveCategory() {
  const d = ui.sheet.d;
  if (!d.name.trim()) return;
  d.name = d.name.trim();
  d.autoDelete = +d.autoDelete || 0;
  if (d.id) {
    const c = catById(d.id);
    Object.assign(c, d);
    // keep existing items consistent with "include time"
    db.entries.filter(e => e.cat === c.id).forEach(e => { e.deadlineTime = !!c.deadlineTime; });
  } else {
    d.id = uid();
    d.order = Math.max(-1, ...db.categories.map(c => c.order)) + 1;
    db.categories.push(d);
  }
  save();
  closeSheet();
  toast('Lista e salvată ✓');
}

// ---------- statistics (lists with money) ----------
const fMonth = new Intl.DateTimeFormat('ro-RO', { month: 'short' });
const fMonthLong = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' });
const monthKey = d => `${d.getFullYear()}-${d.getMonth()}`;
const itemDate = (e, c) => (c.usesDir && e.hasDeadline && parseLocal(e.deadline)) || new Date(e.createdAt);
const nItems = n => `${n} ${n === 1 ? 'element' : 'elemente'}`;

function openStats(catId) {
  ui.sheet = { type: 'stats', catId, range: '6', sel: monthKey(new Date()) };
  renderSheet();
}
function statsHtml() {
  const s = ui.sheet;
  const c = catById(s.catId);
  const col = colorOf(c);
  const all = db.entries.filter(e => e.cat === c.id && e.hasAmount && e.amount > 0);
  const now = new Date();

  // the currency used most is the one we chart
  const counts = {};
  all.forEach(e => { counts[e.currency] = (counts[e.currency] || 0) + 1; });
  const cur = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || c.currency || 'RON';

  let months = +s.range;
  if (s.range === 'all') {
    const first = all.reduce((m, e) => Math.min(m, +itemDate(e, c)), +now);
    const f = new Date(first);
    months = Math.min(36, Math.max(1, (now.getFullYear() - f.getFullYear()) * 12 + now.getMonth() - f.getMonth() + 1));
  }
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const inRange = all.filter(e => itemDate(e, c) >= start && itemDate(e, c) <= addDays(now, 400));
  // for "de plătit / de primit" lists the chart shows spending; income gets its own tile
  const spend = c.usesDir ? inRange.filter(e => e.dir !== 'in') : inRange;
  const main = spend.filter(e => e.currency === cur);
  const other = spend.filter(e => e.currency !== cur);

  const buckets = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    buckets.push({ key: monthKey(d), d, sum: 0, n: 0 });
  }
  const byKey = Object.fromEntries(buckets.map(b => [b.key, b]));
  for (const e of main) {
    const b = byKey[monthKey(itemDate(e, c))];
    if (b) { b.sum += e.amount; b.n++; }
  }
  const max = Math.max(0, ...buckets.map(b => b.sum));
  const total = main.reduce((t, e) => t + e.amount, 0);
  const sel = byKey[s.sel] || buckets[buckets.length - 1];

  const tiles = [
    tile(c.usesDir ? 'Plătit / de plătit' : 'Total', money(total, cur), col),
    tile('Număr', main.length, 'var(--blue)'),
    tile('Medie', main.length ? money(total / main.length, cur) : '–', 'var(--purple)'),
  ];
  if (c.usesDir) {
    const inc = inRange.filter(e => e.dir === 'in').map(e => [e.amount, e.currency]);
    tiles.push(tile('De primit / primit', totals(inc), 'var(--green)'));
  } else if (c.usesPaid) {
    tiles.push(tile('Neplătit acum', totals(all.filter(e => !e.paid).map(e => [e.amount, e.currency])), 'var(--red)'));
  } else {
    tiles.push(tile('Luna asta', money(byKey[monthKey(now)]?.sum || 0, cur), 'var(--orange)'));
  }

  const showEvery = months <= 12 ? 1 : months <= 24 ? 2 : 3;
  const bars = buckets.map((b, i) => {
    const h = max ? Math.max(b.sum ? 3 : 0, Math.round((b.sum / max) * 100)) : 0;
    return `<button class="bar ${b === sel ? 'sel' : ''}" data-act="stats-sel" data-k="${b.key}" aria-label="${esc(fMonthLong.format(b.d))}: ${esc(money(b.sum, cur))}">
      <span class="area"><span class="col" style="height:${h}%;--c:${col}"></span></span>
      <span class="ml">${i % showEvery === 0 || b === sel ? esc(fMonth.format(b.d).replace('.', '')) : ''}</span></button>`;
  }).join('');

  // top vendors / people
  let vendorsHtml = '';
  if (c.usesVendor) {
    const v = {};
    for (const e of main) { const k = e.vendor || '(fără nume)'; (v[k] ||= { sum: 0, n: 0 }); v[k].sum += e.amount; v[k].n++; }
    const top = Object.entries(v).sort((a, b) => b[1].sum - a[1].sum).slice(0, 6);
    const vmax = top.length ? top[0][1].sum : 0;
    if (top.length) {
      vendorsHtml = `<div class="fhead">Top ${esc(c.vendorLabel.toLowerCase())}</div><div class="form">
        ${top.map(([name, x]) => `<div class="hbar"><div class="hbar-top"><span>${esc(name)}</span><b>${esc(money(x.sum, cur))}</b></div>
          <div class="hbar-track"><span style="width:${vmax ? Math.max(2, x.sum / vmax * 100) : 0}%;background:${col}"></span></div>
          <div class="hbar-sub">${nItems(x.n)}</div></div>`).join('')}</div>`;
    }
  }

  // done / pending counts (e.g. orders received vs waiting)
  const inRangeAll = db.entries.filter(e => e.cat === c.id && itemDate(e, c) >= start);
  const doneN = inRangeAll.filter(e => e.done).length;
  const subsN = c.usesSubs ? inRangeAll.reduce((t, e) => t + (e.subs || []).length, 0) : 0;

  return `<div class="overlay"></div>
  <div class="panel" style="--accent:${col}">
    <div class="panel-head"><button data-act="sheet-close">Închide</button><div class="t">📊 ${esc(c.name)}</div><span style="min-width:70px"></span></div>
    <div class="panel-body">
      <div class="segin">${[['6', '6 luni'], ['12', '12 luni'], ['all', 'Tot']].map(([k, l]) => `<button class="${s.range === k ? 'on' : ''}" data-act="stats-range" data-v="${k}">${l}</button>`).join('')}</div>
      ${!all.length ? `<div class="empty"><div class="big">📊</div><b>Încă nu sunt date</b>Adaugă elemente cu sumă și aici apar totalurile pe luni.</div>` : `
      <div class="tiles">${tiles.join('')}</div>
      <div class="fhead">${c.usesDir ? 'De plătit' : 'Total'} pe luni (${esc(cur)})</div>
      <div class="form chart">
        <div class="readout"><b>${esc(cap(fMonthLong.format(sel.d)))}</b><span>${esc(money(sel.sum, cur))} · ${nItems(sel.n)}</span></div>
        <div class="bars">${bars}</div>
      </div>
      <div class="ffoot">Apasă pe o lună ca să vezi suma.${other.length ? ` Sumele în altă monedă (${esc(totals(other.map(e => [e.amount, e.currency])))}) nu apar în grafic.` : ''}</div>
      ${vendorsHtml}
      <div class="fhead">Pe scurt</div>
      <div class="form">
        <div class="field"><span class="lbl">${esc(c.doneLabel)}</span><b>${doneN} din ${inRangeAll.length}</b></div>
        ${c.usesSubs ? `<div class="field"><span class="lbl">${esc(c.subsLabel)} în total</span><b>${subsN}</b></div>` : ''}
        ${main.length ? `<div class="field"><span class="lbl">Cea mai mare sumă</span><b>${esc(money(Math.max(...main.map(e => e.amount)), cur))}</b></div>` : ''}
      </div>`}
    </div>
  </div>`;
}

// ---------- search across all lists ----------
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function openSearch() {
  ui.sheet = { type: 'search', q: '' };
  renderSheet();
  setTimeout(() => document.getElementById('gsearch')?.focus(), 280);
}
function searchResultsHtml(raw) {
  const q = norm(raw).trim();
  if (!q) return `<div class="empty"><div class="big">🔍</div><b>Caută în toate listele</b>Titluri, detalii, produse, magazine, persoane, AWB, grupuri, sume. Merge și fără diacritice.</div>`;
  const listHits = cats().filter(c => norm(c.name).includes(q));
  const hits = db.entries.filter(e => catById(e.cat) && [
    e.title, e.details, e.vendor, e.group, e.tracking,
    e.hasAmount && e.amount ? fNum.format(e.amount) + ' ' + e.amount : '',
    ...(e.subs || []).map(s => s.title),
  ].some(t => norm(t).includes(q)));
  if (!hits.length && !listHits.length) return `<div class="empty"><div class="big">🤷</div><b>Nimic găsit</b>Nu am găsit nimic pentru „${esc(raw.trim())}”.</div>`;
  let html = '';
  if (listHits.length) {
    html += `<div class="sec-title">Liste</div><div class="group">${listHits.map(c => `
      <div class="catrow" data-act="search-cat" data-id="${c.id}"><div class="caticon" style="--c:${colorOf(c)}">${c.icon}</div>
      <div style="flex:1"><div class="catname">${esc(c.name)}</div></div><span class="chev">${ICON.chev}</span></div>`).join('')}</div>`;
  }
  for (const c of cats()) {
    const items = hits.filter(e => e.cat === c.id);
    if (!items.length) continue;
    html += `<div class="sec-title">${c.icon} ${esc(c.name)} · ${items.length}</div>
      <div class="group">${sortEntries(items).map(e => rowHtml(e, {})).join('')}</div>`;
  }
  return html;
}
function searchSheetHtml() {
  const s = ui.sheet;
  return `<div class="overlay"></div>
  <div class="panel">
    <div class="panel-head"><button data-act="sheet-close">Închide</button><div class="t">Caută</div><span style="min-width:70px"></span></div>
    <div class="panel-body">
      <input class="search" type="search" id="gsearch" placeholder="Ce cauți?" value="${esc(s.q)}" autocomplete="off" enterkeyhint="search" style="margin-top:0">
      <div id="gresults">${searchResultsHtml(s.q)}</div>
    </div>
  </div>`;
}
function refreshSearch() {
  const box = document.getElementById('gresults');
  if (box && ui.sheet?.type === 'search') box.innerHTML = searchResultsHtml(ui.sheet.q);
}

// ---------- medicines ----------
// Each medicine is one treatment: dose, times of day, which days, start date and how long
// (a number of days, until a date, or forever). Doses taken are logged per day.
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOf = s => parseLocal((s || dkey(new Date())) + 'T00:00');
const WD_SHORT = ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'];
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
const isMedCat = c => c?.kind === 'meds';

function medEnd(m) {
  const s = dayOf(m.start);
  if (m.durType === 'days') return addDays(s, Math.max(1, +m.days || 1) - 1);
  if (m.durType === 'until' && m.until) return dayOf(m.until);
  return null;
}
function medOnDay(e, day) {
  const m = e.med;
  if (!m || e.done) return false;
  const d0 = startOfDay(day);
  if (d0 < dayOf(m.start)) return false;
  const end = medEnd(m);
  if (end && d0 > end) return false;
  if (m.weekdays && m.weekdays.length && !m.weekdays.includes(d0.getDay())) return false;
  return true;
}
function medStatus(e) {
  const m = e.med;
  const today = startOfDay(new Date());
  const s = dayOf(m.start), end = medEnd(m);
  if (e.done) return { text: 'Oprit', color: 'var(--muted)', state: 'stopped' };
  if (today < s) return { text: `Începe ${fmtDay(s).toLowerCase()}`, color: 'var(--blue)', state: 'future' };
  if (end && today > end) return { text: 'Tratament terminat', color: 'var(--green)', state: 'finished' };
  if (!end) return { text: 'Permanent', color: 'var(--purple)', state: 'active' };
  const total = Math.round((end - s) / 86400000) + 1;
  const n = Math.round((today - s) / 86400000) + 1;
  const left = total - n;
  return { text: `Ziua ${n} din ${total} · ${left === 0 ? 'ultima zi' : left === 1 ? 'mai e 1 zi' : `mai sunt ${left} zile`}`, color: 'var(--orange)', state: 'active' };
}
function medDaysText(m) {
  if (!m.weekdays || !m.weekdays.length || m.weekdays.length === 7) return 'Zilnic';
  return WD_ORDER.filter(d => m.weekdays.includes(d)).map(d => WD_SHORT[d]).join(', ');
}
function dosesOn(day) {
  const out = [];
  const k = dkey(day);
  for (const e of db.entries) {
    if (!e.med || !isMedCat(catById(e.cat)) || !medOnDay(e, day)) continue;
    for (const t of e.med.times) out.push({ e, t, taken: (e.med.taken?.[k] || []).includes(t) });
  }
  return out.sort((a, b) => a.t.localeCompare(b.t) || a.e.title.localeCompare(b.e.title, 'ro'));
}
function doseLate(x, day) {
  const [h, m] = x.t.split(':').map(Number);
  return !x.taken && sameDay(day, new Date()) && atTime(day, h, m) < new Date();
}
function toggleDose(eid, t) {
  const e = entryById(eid);
  if (!e?.med) return;
  const k = dkey(new Date());
  e.med.taken ||= {};
  const arr = (e.med.taken[k] ||= []);
  const i = arr.indexOf(t);
  if (i >= 0) arr.splice(i, 1); else arr.push(t);
  save();
}
function medAdherence(e) {
  let sched = 0, taken = 0;
  const today = startOfDay(new Date()), now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i);
    if (!medOnDay(e, d)) continue;
    for (const t of e.med.times) {
      const [h, m] = t.split(':').map(Number);
      if (atTime(d, h, m) > now) continue;
      sched++;
      if ((e.med.taken?.[dkey(d)] || []).includes(t)) taken++;
    }
  }
  return { sched, taken };
}
function doseRowsHtml(doses, day) {
  // grouped by time of day: "08:00 · 2 medicamente"
  const byTime = {};
  doses.forEach(x => { (byTime[x.t] ||= []).push(x); });
  return Object.keys(byTime).sort().map(t => {
    const list = byTime[t];
    const late = list.some(x => doseLate(x, day));
    const allDone = list.every(x => x.taken);
    return `<div class="sec-title ${late ? 'red' : ''}">${t}${allDone ? ' · ✓ luate' : late ? ' · nu le-ai luat încă' : ''}</div>
      <div class="group">${list.map(x => {
        const col = colorOf(catById(x.e.cat));
        return `<div class="row ${x.taken ? 'done' : ''}" data-act="open" data-id="${x.e.id}">
          <button class="check ${x.taken ? 'on' : ''}" style="--c:${col}" data-act="dose" data-id="${x.e.id}" data-t="${x.t}" aria-label="Am luat">${ICON.check}</button>
          <div class="rbody"><div class="rtitle">${esc(x.e.title)}</div>
            <div class="chips">${x.e.med.dose ? chip(x.e.med.dose, 'var(--muted)') : ''}${x.e.details ? chip(x.e.details, 'var(--muted)') : ''}</div></div>
          <div class="dtime" style="color:${doseLate(x, day) ? 'var(--red)' : 'var(--muted)'}">${x.t}</div></div>`;
      }).join('')}</div>`;
  }).join('');
}
function medRowHtml(e) {
  const c = catById(e.cat), col = colorOf(c), m = e.med, st = medStatus(e);
  const chips = [];
  if (m.dose) chips.push(chip(m.dose, 'var(--muted)'));
  chips.push(chip('🕐 ' + m.times.join(' · '), 'var(--blue)'));
  chips.push(chip(medDaysText(m), 'var(--muted)'));
  chips.push(chip(st.text, st.color));
  if (st.state === 'active') {
    const a = medAdherence(e);
    if (a.sched) chips.push(chip(`Luate ${a.taken}/${a.sched}`, a.taken === a.sched ? 'var(--green)' : 'var(--orange)'));
  }
  if (m.alarm && (st.state === 'active' || st.state === 'future')) {
    chips.push(alarmAdded(e) ? chip('✓ în Calendar', 'var(--green)') : chip('+ Pune alarmele', 'var(--accent)', `data-act="alarm" data-id="${e.id}"`));
  }
  return `<div class="swipe" data-swipe="entry" data-id="${e.id}"><button class="swipe-del" data-act="swipe-del" data-kind="entry" data-id="${e.id}">${ICON.trash}<span>Șterge</span></button>
    <div class="row swipe-content ${st.state === 'finished' || st.state === 'stopped' ? 'done' : ''}" data-act="open" data-id="${e.id}">
      <div class="medico" style="--c:${col}">💊</div>
      <div class="rbody"><div class="rtitle">${esc(e.title)}</div>${e.details ? `<div class="rdetails">${esc(e.details)}</div>` : ''}<div class="chips">${chips.join('')}</div></div>
    </div></div>`;
}
function screenMeds(c) {
  const col = colorOf(c);
  const today = new Date();
  const doses = dosesOn(today);
  const takenN = doses.filter(x => x.taken).length;
  const meds = db.entries.filter(e => e.cat === c.id && e.med);
  const groups = { active: [], future: [], finished: [], stopped: [] };
  meds.forEach(e => groups[medStatus(e).state].push(e));
  const sec = (title, list) => list.length ? `<div class="sec-title">${title}</div><div class="group">${list.map(medRowHtml).join('')}</div>` : '';
  return `
    <div class="topbar"><div class="left"><button class="back" data-act="back">${ICON.back}Liste</button></div>
      <div class="right"><button class="iconbtn fill" style="background:${col}" data-act="new" data-id="${c.id}">${ICON.plus}</button></div></div>
    <h1><span class="emo">${c.icon}</span>${esc(c.name)}</h1>
    ${doses.length ? `
      <div class="medtoday" style="--c:${col}">
        <div><div class="mt-l">Azi</div><div class="mt-v">${takenN} din ${doses.length} luate</div></div>
        <div class="mt-bar"><span style="width:${Math.round(takenN / doses.length * 100)}%"></span></div>
      </div>
      ${doseRowsHtml(doses, today)}` : meds.length ? `<div class="banner" style="margin-top:6px"><b>Azi nu ai nimic de luat ✓</b></div>` : ''}
    ${!meds.length ? `<div class="empty"><div class="big">💊</div><b>Niciun medicament încă</b>Adaugă unul cu +: doza, orele, câte zile (sau permanent) și îți arăt în fiecare zi ce ai de luat.
      <div class="mt"><button class="btn" style="background:${col}" data-act="new" data-id="${c.id}">Adaugă medicament</button></div></div>` : ''}
    ${sec('Tratamente în curs', groups.active)}
    ${sec('Urmează', groups.future)}
    ${sec('Terminate', groups.finished)}
    ${sec('Oprite', groups.stopped)}
    ${meds.length ? `<div class="footnote">Bifează fiecare doză când o iei. Tratamentele cu număr de zile se termină singure.</div>` : ''}`;
}

// medicine editor
function openMed(catId, entryId) {
  const e = entryId ? entryById(entryId) : null;
  const today = new Date();
  const m = e?.med || {};
  ui.sheet = {
    type: 'med', isNew: !e,
    d: {
      id: e?.id || null, cat: catId, title: e?.title || '', details: e?.details || '', done: !!e?.done,
      dose: m.dose || '', times: [...(m.times || ['08:00'])],
      start: m.start || dkey(today), durType: m.durType || 'days', days: m.days || 7,
      until: m.until || dkey(addDays(today, 30)),
      weekdaysOn: !!(m.weekdays && m.weekdays.length && m.weekdays.length < 7),
      weekdays: m.weekdays && m.weekdays.length ? [...m.weekdays] : [1, 2, 3, 4, 5, 6, 0],
      alarm: e ? !!m.alarm : true,
    },
  };
  renderSheet();
  if (!e) setTimeout(() => document.getElementById('f-title')?.focus(), 300);
}
function medSummary(d) {
  const m = { start: d.start, durType: d.durType, days: d.days, until: d.until };
  const s = dayOf(d.start), end = medEnd(m);
  const perDay = d.times.filter(Boolean).length;
  if (!end) return `Începe ${fmtDay(s).toLowerCase()}, fără dată de final · ${perDay} ${perDay === 1 ? 'doză' : 'doze'} pe zi.`;
  const total = Math.round((end - s) / 86400000) + 1;
  return `De ${fmtDay(s).toLowerCase()} până ${sameDay(end, s) ? 'în aceeași zi' : 'pe ' + fLong.format(end)} (${total} ${total === 1 ? 'zi' : 'zile'}) · ${perDay} ${perDay === 1 ? 'doză' : 'doze'} pe zi.`;
}
function medSheetHtml() {
  const { d, isNew } = ui.sheet;
  const c = catById(d.cat);
  const col = colorOf(c);
  return `<div class="overlay"></div>
  <div class="panel" style="--accent:${col}">
    <div class="panel-head"><button data-act="sheet-close">Renunță</button><div class="t">${isNew ? 'Medicament nou' : 'Editează'}</div>
      <button class="save" data-act="med-save" ${d.title.trim() ? '' : 'disabled'}>Salvează</button></div>
    <div class="panel-body">
      <div class="form">
        <div class="field"><input type="text" id="f-title" class="titlein" data-bind="title" placeholder="Numele medicamentului" value="${esc(d.title)}" enterkeyhint="done"></div>
        <div class="field"><input type="text" data-bind="m.dose" placeholder="Doza (ex: 1 pastilă, 500 mg, 10 picături)" value="${esc(d.dose)}"></div>
        <div class="field"><input type="text" data-bind="details" placeholder="Notă (ex: după masă, cu apă)" value="${esc(d.details)}"></div>
      </div>

      <div class="fhead">La ce ore</div>
      <div class="form">
        ${d.times.map((t, i) => `<div class="field"><span class="ico">🕐</span><span class="lbl">Doza ${i + 1}</span>
          <input type="time" data-mtime="${i}" value="${esc(t)}">
          ${d.times.length > 1 ? `<button class="x" data-act="m-time-del" data-i="${i}" aria-label="Șterge" style="color:var(--muted);font-size:22px;width:30px">×</button>` : ''}</div>`).join('')}
        <button class="linkrow" data-act="m-time-add">${ICON.plus} Adaugă o oră</button>
      </div>
      <div class="quick" style="--pink:${col};padding:10px 2px">
        <button data-act="m-preset" data-v="1">1× pe zi</button><button data-act="m-preset" data-v="2">2× pe zi</button>
        <button data-act="m-preset" data-v="3">3× pe zi</button><button data-act="m-preset" data-v="4">4× pe zi</button>
      </div>

      <div class="fhead">În ce zile</div>
      <div class="form"><div class="fieldcol">
        <div class="segin" style="margin:0"><button class="${!d.weekdaysOn ? 'on' : ''}" data-act="m-wdmode" data-v="0">Zilnic</button><button class="${d.weekdaysOn ? 'on' : ''}" data-act="m-wdmode" data-v="1">Anumite zile</button></div>
        ${d.weekdaysOn ? `<div class="wdays">${WD_ORDER.map(w => `<button class="${d.weekdays.includes(w) ? 'on' : ''}" style="--c:${col}" data-act="m-wd" data-v="${w}">${WD_SHORT[w]}</button>`).join('')}</div>` : ''}
      </div></div>

      <div class="fhead">Cât timp</div>
      <div class="form">
        <div class="field"><span class="lbl">Începe</span><input type="date" data-bind="m.start" value="${esc(d.start)}"></div>
        <div class="fieldcol"><div class="segin" style="margin:0">
          <button class="${d.durType === 'days' ? 'on' : ''}" data-act="m-dur" data-v="days">Nr. de zile</button>
          <button class="${d.durType === 'until' ? 'on' : ''}" data-act="m-dur" data-v="until">Până la</button>
          <button class="${d.durType === 'forever' ? 'on' : ''}" data-act="m-dur" data-v="forever">Permanent</button></div></div>
        ${d.durType === 'days' ? `<div class="field"><span class="lbl">${d.days} ${+d.days === 1 ? 'zi' : 'zile'}</span>
            <div class="order-btns"><button data-act="m-days" data-v="-1">−</button><button data-act="m-days" data-v="1">+</button></div></div>
          <div class="quick" style="--pink:${col}">${[3, 5, 7, 10, 14, 21, 30].map(n => `<button data-act="m-daysset" data-v="${n}">${n} zile</button>`).join('')}</div>` : ''}
        ${d.durType === 'until' ? `<div class="field"><span class="lbl">Ultima zi</span><input type="date" data-bind="m.until" value="${esc(d.until)}"></div>` : ''}
      </div>
      <div class="ffoot" id="medsum">${esc(medSummary(d))}</div>

      <div class="form" style="margin-top:18px">
        <div class="field"><span class="ico">🔔</span><span class="lbl">Alarmă la fiecare oră</span>${sw('m.alarm', d.alarm)}</div>
      </div>
      <div class="ffoot">${d.alarm ? 'La salvare se deschide Calendarul o singură dată, pentru toate orele: apeși „Adaugă”. Alarmele se opresc singure la finalul tratamentului.' : 'Fără alarme: vezi dozele doar în aplicație.'}</div>

      ${!isNew ? `<div class="form" style="margin-top:24px"><div class="field"><span class="ico">⏹</span><span class="lbl">Oprit (nu-l mai iau)</span>${sw('m.done', d.done)}</div></div>
        <button class="btn red block mt" data-act="med-delete">Șterge medicamentul</button>` : ''}
    </div>
  </div>`;
}
function saveMed() {
  const d = ui.sheet.d;
  if (!d.title.trim()) return;
  const times = [...new Set(d.times.filter(Boolean))].sort();
  if (!times.length) { toast('Pune cel puțin o oră'); return; }
  if (d.weekdaysOn && !d.weekdays.length) { toast('Alege cel puțin o zi'); return; }
  let e = d.id ? entryById(d.id) : null;
  if (!e) { e = { id: uid(), createdAt: Date.now(), cat: d.cat, med: { taken: {} } }; db.entries.push(e); }
  Object.assign(e, {
    cat: d.cat, title: d.title.trim(), details: d.details.trim(),
    done: !!d.done, doneAt: d.done ? (e.doneAt || Date.now()) : null,
    hasDeadline: false, hasReminder: false, hasAmount: false, amount: 0, currency: 'RON',
    group: '', subs: [], vendor: '', tracking: '', priority: 0, repeat: 'none',
  });
  e.med = {
    ...(e.med || {}), dose: d.dose.trim(), times, start: d.start || dkey(new Date()),
    durType: d.durType, days: Math.max(1, Math.min(3650, +d.days || 1)), until: d.until,
    weekdays: d.weekdaysOn ? [...d.weekdays] : null, alarm: !!d.alarm, taken: e.med?.taken || {},
  };
  save();
  closeSheet();
  const st = medStatus(e).state;
  if (e.med.alarm && !e.done && st !== 'finished' && !alarmAdded(e)) addAlarm(e);
  else toast('Salvat ✓');
}
function buildMedIcs(e) {
  const m = e.med;
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  let s = dayOf(m.start);
  if (m.weekdays && m.weekdays.length) { for (let i = 0; i < 7 && !m.weekdays.includes(s.getDay()); i++) s = addDays(s, 1); }
  const end = medEnd(m);
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MindMe//RO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const t of m.times) {
    const [h, mi] = t.split(':').map(Number);
    const start = atTime(s, h, mi);
    let rule = m.weekdays && m.weekdays.length ? `FREQ=WEEKLY;BYDAY=${m.weekdays.map(w => BY[w]).join(',')}` : 'FREQ=DAILY';
    if (end) rule += `;UNTIL=${icsDate(atTime(end, 23, 59))}`;
    out.push('BEGIN:VEVENT', `UID:${e.id}-${t.replace(':', '')}@mindme`, `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(new Date(start.getTime() + 10 * 60000))}`,
      `SUMMARY:${icsEscape('💊 ' + e.title + (m.dose ? ' – ' + m.dose : ''))}`,
      `DESCRIPTION:${icsEscape([e.details, medDaysText(m) + ', ' + (end ? 'până pe ' + fLong.format(end) : 'permanent'), '— din MindMe'].filter(Boolean).join('\n'))}`,
      `RRULE:${rule}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape('💊 ' + e.title)}`, 'TRIGGER:-PT0M', 'END:VALARM',
      'END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}

// ---------- "Statistici" tab ----------
function rangeOf(s, dates) {
  const now = new Date();
  let months = +s.range;
  if (s.range === 'all') {
    const first = dates.length ? Math.min(...dates) : +now;
    const f = new Date(first);
    months = Math.min(36, Math.max(1, (now.getFullYear() - f.getFullYear()) * 12 + now.getMonth() - f.getMonth() + 1));
  }
  return { months, start: new Date(now.getFullYear(), now.getMonth() - (months - 1), 1) };
}
function monthBuckets(months, start) {
  const out = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    out.push({ key: monthKey(d), d, sum: 0, n: 0 });
  }
  return out;
}
function barsHtml(buckets, selKey, color, act, value) {
  const max = Math.max(0, ...buckets.map(value));
  const showEvery = buckets.length <= 12 ? 1 : buckets.length <= 24 ? 2 : 3;
  return buckets.map((b, i) => {
    const v = value(b);
    const h = max ? Math.max(v ? 3 : 0, Math.round((v / max) * 100)) : 0;
    const sel = b.key === selKey;
    return `<button class="bar ${sel ? 'sel' : ''}" data-act="${act}" data-k="${b.key}" aria-label="${esc(fMonthLong.format(b.d))}: ${v}">
      <span class="area"><span class="col" style="height:${h}%;--c:${color}"></span></span>
      <span class="ml">${i % showEvery === 0 || sel ? esc(fMonth.format(b.d).replace('.', '')) : ''}</span></button>`;
  }).join('');
}
const hbarRow = (label, valueText, frac, color, sub) => `<div class="hbar"><div class="hbar-top"><span>${label}</span><b>${valueText}</b></div>
  <div class="hbar-track"><span style="width:${Math.max(frac > 0 ? 2 : 0, frac * 100)}%;background:${color}"></span></div>${sub ? `<div class="hbar-sub">${sub}</div>` : ''}</div>`;
const WEEKDAYS = ['duminica', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

function generalStatsHtml() {
  const s = ui.stats;
  const entries = db.entries.filter(e => catById(e.cat));
  if (!entries.length) return `<div class="empty"><div class="big">📊</div><b>Încă nu sunt date</b>Adaugă câteva lucruri în liste și aici vezi cum stai.</div>`;
  const { months, start } = rangeOf(s, entries.map(e => e.createdAt));
  const active = entries.filter(e => !e.done);
  const overdueNow = active.filter(e => isOverdue(e) || reminderMissed(e)).length;
  const done = entries.filter(e => e.done && e.doneAt && e.doneAt >= +start);
  const added = entries.filter(e => e.createdAt >= +start);
  const withDl = done.filter(e => e.hasDeadline && parseLocal(e.deadline));
  const onTime = withDl.filter(e => {
    const d = parseLocal(e.deadline);
    return e.doneAt <= +(e.deadlineTime ? d : addDays(startOfDay(d), 1));
  }).length;
  const rate = withDl.length ? Math.round((onTime / withDl.length) * 100) + '%' : '–';

  const metric = s.act || 'done';
  const src = metric === 'done' ? done.map(e => new Date(e.doneAt)) : added.map(e => new Date(e.createdAt));
  const buckets = monthBuckets(months, start);
  const byKey = Object.fromEntries(buckets.map(b => [b.key, b]));
  src.forEach(d => { const b = byKey[monthKey(d)]; if (b) b.n++; });
  const sel = byKey[s.sel] || buckets[buckets.length - 1];

  // per list
  const per = cats().map(c => ({ c, n: done.filter(e => e.cat === c.id).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
  const pmax = per.length ? per[0].n : 0;
  // best weekday
  const wd = [0, 0, 0, 0, 0, 0, 0];
  done.forEach(e => { wd[new Date(e.doneAt).getDay()]++; });
  const best = Math.max(...wd);
  // reminders
  const rem = entries.filter(e => e.hasReminder);
  const remUpcoming = rem.filter(e => !e.done && !reminderMissed(e)).length;
  const remMissed = rem.filter(reminderMissed).length;
  const remRepeat = rem.filter(e => !e.done && e.repeat && e.repeat !== 'none').length;

  return `
    <div class="tiles">
      ${tile('Active acum', active.length, 'var(--accent)')}
      ${tile('Întârziate acum', overdueNow, overdueNow ? 'var(--red)' : 'var(--muted)')}
      ${tile('Bifate', done.length, 'var(--green)')}
      ${tile('Gata la timp', rate, 'var(--blue)')}
    </div>
    <div class="segin" style="margin-top:20px">
      <button class="${metric === 'done' ? 'on' : ''}" data-act="stat-metric" data-v="done">✓ Bifate</button>
      <button class="${metric === 'added' ? 'on' : ''}" data-act="stat-metric" data-v="added">＋ Adăugate</button>
    </div>
    <div class="form chart">
      <div class="readout"><b>${esc(cap(fMonthLong.format(sel.d)))}</b><span>${nItems(sel.n)}</span></div>
      <div class="bars">${barsHtml(buckets, sel.key, metric === 'done' ? '#2EB87A' : '#7C5CFA', 'stat-sel', b => b.n)}</div>
    </div>
    <div class="ffoot">${metric === 'done' ? 'Câte ai bifat' : 'Câte ai adăugat'} în fiecare lună. Apasă pe o lună ca să vezi numărul.</div>
    ${per.length ? `<div class="fhead">Bifate pe liste</div><div class="form">${per.map(x => hbarRow(`${x.c.icon} ${esc(x.c.name)}`, x.n, pmax ? x.n / pmax : 0, colorOf(x.c), '')).join('')}</div>` : ''}
    <div class="fhead">Remindere</div>
    <div class="tiles three">
      ${tile('Programate', remUpcoming, 'var(--pink)')}
      ${tile('Ratate', remMissed, remMissed ? 'var(--red)' : 'var(--muted)')}
      ${tile('Repetate', remRepeat, 'var(--purple)')}
    </div>
    ${best ? `<div class="fhead">Pe scurt</div><div class="form">
      <div class="field"><span class="lbl">Ziua în care bifezi cel mai mult</span><b>${cap(WEEKDAYS[wd.indexOf(best)])}</b></div>
      <div class="field"><span class="lbl">Adăugate în perioadă</span><b>${added.length}</b></div>
      ${withDl.length ? `<div class="field"><span class="lbl">Cu termen, făcute la timp</span><b>${onTime} din ${withDl.length}</b></div>` : ''}
    </div>` : ''}`;
}

function listsStatsHtml() {
  const rows = cats().map(c => {
    const items = db.entries.filter(e => e.cat === c.id);
    const doneN = items.filter(e => e.done).length;
    const act = items.length - doneN;
    const over = items.filter(e => isOverdue(e) || reminderMissed(e)).length;
    let extra = '';
    if (c.usesAmount) {
      const t = items.filter(e => e.hasAmount && e.amount > 0).map(e => [e.amount, e.currency]);
      if (t.length) extra = ` · total ${esc(totals(t))}`;
    }
    const frac = items.length ? doneN / items.length : 0;
    return hbarRow(`${c.icon} ${esc(c.name)}`, `${Math.round(frac * 100)}%`, frac, colorOf(c),
      `${act} active · ${doneN} bifate${over ? ` · <span style="color:var(--red)">${over} întârziate</span>` : ''}${extra}`);
  }).join('');
  return `<div class="form">${rows || '<div class="empty">Nicio listă.</div>'}</div>
    <div class="ffoot">Procentul arată cât din fiecare listă e bifat.${db.categories.some(c => c.usesAmount) ? ' Pentru detalii pe o listă cu sume, intră în listă și apasă pe 📊.' : ''}</div>`;
}

function screenStats() {
  const s = ui.stats;
  const views = [['general', 'General'], ['bani', 'Bani'], ['liste', 'Liste']];
  let body;
  if (s.view === 'bani') body = moneyStatsHtml();
  else if (s.view === 'liste') body = listsStatsHtml();
  else body = generalStatsHtml();
  return `
    <div class="topbar"><div class="left">${brand()}</div><div class="right"></div></div>
    <h1>Statistici</h1>
    <div class="seg" style="margin-top:0">${views.map(([k, l]) => `<button class="${s.view === k ? 'on' : ''}" data-act="stat-view" data-v="${k}">${l}</button>`).join('')}</div>
    ${s.view !== 'liste' ? `<div class="segin" style="margin:12px 0 14px">${[['6', '6 luni'], ['12', '12 luni'], ['all', 'Tot']].map(([k, l]) => `<button class="${s.range === k ? 'on' : ''}" data-act="stat-range" data-v="${k}">${l}</button>`).join('')}</div>` : '<div style="height:14px"></div>'}
    ${body}`;
}

// ---------- money overview across all lists ----------
// spent    = payments marked as paid ("de plătit" + bifat), orders marked "Plătit", other money items checked
// received = "de primit" items checked
// toPay / toReceive = the same, not done yet
function moneyFlow(e, c) {
  if (!c || !c.usesAmount || !e.hasAmount || !(e.amount > 0)) return null;
  if (c.usesDir) {
    const inc = e.dir === 'in';
    return e.done ? (inc ? 'received' : 'spent') : (inc ? 'toReceive' : 'toPay');
  }
  if (c.usesPaid) return e.paid ? 'spent' : 'toPay';
  return e.done ? 'spent' : 'toPay';
}
function moneyItems() {
  const out = [];
  for (const e of db.entries) {
    const c = catById(e.cat);
    const flow = moneyFlow(e, c);
    if (flow) out.push({ e, c, flow, date: itemDate(e, c) });
  }
  return out;
}
function openMoney() {
  ui.sheet = { type: 'money', range: '12', metric: 'spent', sel: monthKey(new Date()) };
  renderSheet();
}
function moneyStatsHtml() {
  const s = ui.stats;
  const now = new Date();
  const all = moneyItems();
  const counts = {};
  all.forEach(x => { counts[x.e.currency] = (counts[x.e.currency] || 0) + 1; });
  const cur = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'RON';

  let months = +s.range;
  if (s.range === 'all') {
    const first = all.reduce((m, x) => Math.min(m, +x.date), +now);
    const f = new Date(first);
    months = Math.min(36, Math.max(1, (now.getFullYear() - f.getFullYear()) * 12 + now.getMonth() - f.getMonth() + 1));
  }
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const inRange = all.filter(x => x.date >= start);
  const sum = (list, flow) => list.filter(x => x.flow === flow);
  const pairs = list => list.map(x => [x.e.amount, x.e.currency]);
  const mainSum = list => list.filter(x => x.e.currency === cur).reduce((t, x) => t + x.e.amount, 0);

  const spent = sum(inRange, 'spent'), received = sum(inRange, 'received');
  const toPay = sum(all, 'toPay'), toReceive = sum(all, 'toReceive');
  const diff = mainSum(received) - mainSum(spent);

  const metric = s.metric;
  const metricItems = sum(inRange, metric).filter(x => x.e.currency === cur);
  const color = metric === 'spent' ? '#EB4240' : '#2EB87A';

  const buckets = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    buckets.push({ key: monthKey(d), d, sum: 0, n: 0 });
  }
  const byKey = Object.fromEntries(buckets.map(b => [b.key, b]));
  for (const x of metricItems) { const b = byKey[monthKey(x.date)]; if (b) { b.sum += x.e.amount; b.n++; } }
  const max = Math.max(0, ...buckets.map(b => b.sum));
  const sel = byKey[s.sel] || buckets[buckets.length - 1];
  const showEvery = months <= 12 ? 1 : months <= 24 ? 2 : 3;
  const bars = buckets.map((b, i) => {
    const h = max ? Math.max(b.sum ? 3 : 0, Math.round((b.sum / max) * 100)) : 0;
    return `<button class="bar ${b === sel ? 'sel' : ''}" data-act="money-sel" data-k="${b.key}" aria-label="${esc(fMonthLong.format(b.d))}: ${esc(money(b.sum, cur))}">
      <span class="area"><span class="col" style="height:${h}%;--c:${color}"></span></span>
      <span class="ml">${i % showEvery === 0 || b === sel ? esc(fMonth.format(b.d).replace('.', '')) : ''}</span></button>`;
  }).join('');

  // per list
  const perList = {};
  for (const x of metricItems) { (perList[x.c.id] ||= { c: x.c, sum: 0, n: 0 }); perList[x.c.id].sum += x.e.amount; perList[x.c.id].n++; }
  const lists = Object.values(perList).sort((a, b) => b.sum - a.sum);
  const lmax = lists.length ? lists[0].sum : 0;
  // per person / shop
  const perV = {};
  for (const x of metricItems) { if (!x.e.vendor) continue; (perV[x.e.vendor] ||= { sum: 0, n: 0 }); perV[x.e.vendor].sum += x.e.amount; perV[x.e.vendor].n++; }
  const vendors = Object.entries(perV).sort((a, b) => b[1].sum - a[1].sum).slice(0, 6);
  const vmax = vendors.length ? vendors[0][1].sum : 0;
  const hbar = (label, v, mx, col, sub) => `<div class="hbar"><div class="hbar-top"><span>${label}</span><b>${esc(money(v, cur))}</b></div>
    <div class="hbar-track"><span style="width:${mx ? Math.max(2, v / mx * 100) : 0}%;background:${col}"></span></div><div class="hbar-sub">${sub}</div></div>`;
  const other = sum(inRange, metric).filter(x => x.e.currency !== cur);
  const word = metric === 'spent' ? 'Cheltuit' : 'Primit';

  return `
      ${!all.length ? `<div class="empty"><div class="big">💰</div><b>Încă nu sunt sume</b>Adaugă plăți sau comenzi cu sumă și aici vezi cât ai cheltuit și cât ai primit.</div>` : `
      <div class="tiles">
        ${tile('Cheltuit', totals(pairs(spent)), 'var(--red)')}
        ${tile('Primit', totals(pairs(received)), 'var(--green)')}
      </div>
      <div class="tiles" style="margin-top:10px">
        ${tile('Diferență', (diff > 0 ? '+' : diff < 0 ? '−' : '') + money(Math.abs(diff), cur), diff >= 0 ? 'var(--green)' : 'var(--red)')}
        ${tile('Tranzacții', spent.length + received.length, 'var(--blue)')}
      </div>
      <div class="fhead">Încă în așteptare (acum)</div>
      <div class="tiles">
        ${tile('De plătit', totals(pairs(toPay)), 'var(--orange)')}
        ${tile('De primit', totals(pairs(toReceive)), 'var(--purple)')}
      </div>

      <div class="segin" style="margin-top:20px">
        <button class="${metric === 'spent' ? 'on' : ''}" data-act="money-metric" data-v="spent">↗ Cheltuit</button>
        <button class="${metric === 'received' ? 'on' : ''}" data-act="money-metric" data-v="received">↙ Primit</button>
      </div>
      <div class="form chart">
        <div class="readout"><b>${esc(cap(fMonthLong.format(sel.d)))}</b><span>${esc(money(sel.sum, cur))} · ${nItems(sel.n)}</span></div>
        <div class="bars">${bars}</div>
      </div>
      <div class="ffoot">${word} pe luni, în ${esc(cur)}. Apasă pe o lună ca să vezi suma.${other.length ? ` Sumele în altă monedă (${esc(totals(pairs(other)))}) nu apar în grafic.` : ''}</div>

      ${lists.length ? `<div class="fhead">${word} pe liste</div><div class="form">${lists.map(l => hbar(`${l.c.icon} ${esc(l.c.name)}`, l.sum, lmax, colorOf(l.c), nItems(l.n))).join('')}</div>` : ''}
      ${vendors.length ? `<div class="fhead">${metric === 'spent' ? 'Cui ai plătit cel mai mult' : 'De la cine ai primit cel mai mult'}</div><div class="form">${vendors.map(([n, v]) => hbar(esc(n), v.sum, vmax, color, nItems(v.n))).join('')}</div>` : ''}
      <div class="ffoot" style="margin-top:14px">Cheltuit = plăți achitate și comenzi marcate „Plătit”. Primit = sumele „de primit” bifate. Data folosită: scadența (la plăți) sau ziua adăugării.</div>`}`;
}

// ---------- action sheet ----------
function openActions(title, actions) {
  ui.sheet = { type: 'actions', title, actions };
  renderSheet();
}
function actionsHtml() {
  const { title, actions } = ui.sheet;
  return `<div class="overlay" data-act="sheet-close"></div>
    <div class="asheet"><div class="agroup">${title ? `<div class="atitle">${esc(title)}</div>` : ''}
      ${actions.map((a, i) => `<button class="${a.danger ? 'danger' : ''} ${a.selected ? 'sel' : ''}" data-act="action" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
      <div class="agroup"><button class="cancel" data-act="sheet-close">Renunță</button></div></div>`;
}

function renderSheet() {
  const el = document.getElementById('sheet');
  if (!ui.sheet) { el.innerHTML = ''; document.body.style.overflow = ''; return; }
  ui.pendingRerender = false;
  const body = el.querySelector('.panel-body');
  const scroll = body ? body.scrollTop : 0;
  const t = ui.sheet.type;
  el.innerHTML = t === 'entry' ? entrySheetHtml() : t === 'category' ? categorySheetHtml() : t === 'stats' ? statsHtml()
    : t === 'search' ? searchSheetHtml() : t === 'med' ? medSheetHtml() : actionsHtml();
  const nb = el.querySelector('.panel-body');
  if (nb) nb.scrollTop = scroll;
  // no slide animation on re-render
  if (body) el.querySelectorAll('.panel, .overlay').forEach(x => (x.style.animation = 'none'));
  document.body.style.overflow = 'hidden';
}
function closeSheet() { ui.sheet = null; ui.pendingRerender = false; renderSheet(); render(); }

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- backup ----------
function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
  const name = `mindme-backup-${toLocal(new Date()).slice(0, 10)}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Backup MindMe' }).catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function importData() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.categories) || !Array.isArray(d.entries)) throw new Error('format');
      if (!confirm(`Înlocuiesc datele actuale cu backup-ul (${d.categories.length} liste, ${d.entries.length} elemente)?`)) return;
      db = d; save(); ui.catId = null; render(); toast('Backup încărcat ✓');
    } catch (e) { alert('Fișierul nu e un backup MindMe valid.'); }
  };
  inp.click();
}

const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

// ---------- events ----------
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || !el.dataset.act) return;
  const act = el.dataset.act, id = el.dataset.id;
  const s = ui.sheet;
  switch (act) {
    case 'tab': switchTab(el.dataset.tab); break;
    case 'search-open': openSearch(); break;
    // medicines
    case 'dose': toggleDose(id, el.dataset.t); try { navigator.vibrate?.(10); } catch (e) { /* ignore */ } render(); refreshSearch(); break;
    case 'med-save': saveMed(); break;
    case 'med-delete': {
      const name = s.d.title || 'medicamentul';
      openActions(`Ștergi „${name}” și tot istoricul dozelor? Nu se poate anula.`, [
        { label: '🗑 Șterge', danger: true, run: () => { deleteEntry(s.d.id); render(); toast('Șters'); } },
      ]);
      break;
    }
    case 'm-time-add': {
      const last = s.d.times[s.d.times.length - 1] || '08:00';
      const h = Math.min(23, (+last.split(':')[0] || 8) + 4);
      s.d.times.push(`${pad(h)}:00`); renderSheet(); break;
    }
    case 'm-time-del': s.d.times.splice(+el.dataset.i, 1); renderSheet(); break;
    case 'm-preset': s.d.times = { 1: ['08:00'], 2: ['08:00', '20:00'], 3: ['08:00', '14:00', '20:00'], 4: ['08:00', '12:00', '16:00', '20:00'] }[el.dataset.v]; renderSheet(); break;
    case 'm-wdmode': s.d.weekdaysOn = el.dataset.v === '1'; renderSheet(); break;
    case 'm-wd': {
      const w = +el.dataset.v; const i = s.d.weekdays.indexOf(w);
      if (i >= 0) s.d.weekdays.splice(i, 1); else s.d.weekdays.push(w);
      renderSheet(); break;
    }
    case 'm-dur': s.d.durType = el.dataset.v; renderSheet(); break;
    case 'm-days': s.d.days = Math.max(1, Math.min(3650, (+s.d.days || 1) + +el.dataset.v)); renderSheet(); break;
    case 'm-daysset': s.d.days = +el.dataset.v; renderSheet(); break;
    case 'search-cat': ui.sheet = null; renderSheet(); ui.tab = 'lists'; ui.catId = id; ui.filter = 'active'; ui.search = ''; render(); window.scrollTo(0, 0); break;
    case 'open': { const e = entryById(id); if (e) openEntry(e.cat, e.id); break; }
    case 'toggle': { const e = entryById(id); if (e) askThenToggle(e); break; }
    case 'undo': undoDone(id); break;
    case 'stats': openStats(id); break;
    case 'money-metric': ui.stats.metric = el.dataset.v; render(); break;
    case 'money-sel': case 'stat-sel': ui.stats.sel = el.dataset.k; render(); break;
    case 'stat-view': ui.stats.view = el.dataset.v; ui.stats.sel = monthKey(new Date()); render(); window.scrollTo(0, 0); break;
    case 'stat-range': ui.stats.range = el.dataset.v; ui.stats.sel = monthKey(new Date()); render(); break;
    case 'stat-metric': ui.stats.act = el.dataset.v; render(); break;
    case 'swipe-del': closeSwipe(); confirmSwipeDelete(el.dataset.kind, id); break;
    case 'swipe-set': closeSwipe(); openCategory(id); break;
    case 'stats-range': s.range = el.dataset.v; s.sel = monthKey(new Date()); renderSheet(); break;
    case 'stats-sel': s.sel = el.dataset.k; renderSheet(); break;
    case 'set-confirm': db.settings = { ...(db.settings || {}), confirmCheck: !db.settings?.confirmCheck }; save(); render(); break;
    case 'sub': { const e = entryById(id); if (e) { toggleSub(e, el.dataset.sid); render(); } break; }
    case 'alarm': { const e = entryById(id); if (e) addAlarm(e); break; }
    case 'open-cat': ui.catId = id; ui.filter = 'active'; ui.search = ''; render(); window.scrollTo(0, 0); break;
    case 'back': ui.catId = null; render(); window.scrollTo(0, 0); break;
    case 'new': openEntry(id); break;
    case 'new-pick': {
      const list = el.dataset.rem ? cats().filter(c => c.reminderMode !== 'off').sort((a, b) => (b.reminderMode === 'always') - (a.reminderMode === 'always')) : cats();
      if (list.length === 1) openEntry(list[0].id);
      else openActions('Adaugă în…', list.map(c => ({ label: `${c.icon}  ${c.name}`, run: () => openEntry(c.id) })));
      break;
    }
    case 'filter': ui.filter = el.dataset.f; render(); break;
    case 'reorder': ui.reorder = !ui.reorder; render(); break;
    case 'cat-up': case 'cat-down': {
      const list = cats(); const i = list.findIndex(c => c.id === id); const j = act === 'cat-up' ? i - 1 : i + 1;
      if (i >= 0 && j >= 0 && j < list.length) { [list[i], list[j]] = [list[j], list[i]]; list.forEach((c, k) => (c.order = k)); save(); render(); }
      break;
    }
    case 'cat-rules': openCategory(id); break;
    case 'cat-new': openCategory(null); break;
    case 'cat-menu': {
      const c = catById(id);
      const gm = Object.entries(GROUP_MODES).filter(([k]) => k !== 'group' || c.usesGroups)
        .map(([k, v]) => ({ label: 'Grupare: ' + v.toLowerCase(), selected: c.groupMode === k, run: () => { c.groupMode = k; save(); render(); } }));
      openActions(c.name, [
        ...gm,
        { label: '⚙️ Reguli listă', run: () => openCategory(c.id) },
        { label: 'Șterge bifatele', danger: true, run: () => {
          const n = db.entries.filter(e => e.cat === c.id && e.done).length;
          if (!n) { toast('Nu ai nimic bifat aici'); return; }
          if (confirm(`Ștergi cele ${n} elemente bifate din ${c.name}?`)) { db.entries = db.entries.filter(e => !(e.cat === c.id && e.done)); save(); render(); }
        } },
      ]);
      break;
    }
    case 'action': { const a = s?.actions?.[+el.dataset.i]; ui.sheet = null; renderSheet(); render(); a?.run(); break; }
    case 'sheet-close': closeSheet(); break;
    case 'export': exportData(); break;
    case 'import': importData(); break;

    // entry editor
    case 'entry-save': saveEntry(false); break;
    case 'entry-save-alarm': saveEntry(true); break;
    case 'entry-delete':
      if (confirm(`Ștergi „${s.d.title || 'elementul'}”?`)) { deleteEntry(s.d.id); closeSheet(); toast('Șters'); }
      break;
    case 'quick': s.d.reminder = el.dataset.v; s.d.hasReminder = true; s.d.remTouched = true; renderSheet(); break;
    case 'pickgroup': s.d.group = el.dataset.v; renderSheet(); break;
    case 'dir': s.d.dir = el.dataset.v; renderSheet(); break;
    case 'dsub-toggle': { const x = s.d.subs.find(z => z.id === el.dataset.sid); if (x) x.done = !x.done; renderSheet(); break; }
    case 'dsub-del': s.d.subs = s.d.subs.filter(z => z.id !== el.dataset.sid); renderSheet(); break;

    // category editor
    case 'c-color': s.d.color = +el.dataset.v; renderSheet(); break;
    case 'c-icon': s.d.icon = el.dataset.v; renderSheet(); break;
    case 'c-days': s.d.autoRemDays = Math.max(0, Math.min(30, (+s.d.autoRemDays || 0) + +el.dataset.v)); renderSheet(); break;
    case 'cat-save': saveCategory(); break;
    case 'cat-delete': {
      const c = catById(s.d.id);
      if (c && confirm(`Ștergi lista „${c.name}” cu tot ce e în ea?`)) {
        db.entries = db.entries.filter(e => e.cat !== c.id);
        db.categories = db.categories.filter(x => x.id !== c.id);
        save(); ui.catId = null; closeSheet(); toast('Lista a fost ștearsă');
      }
      break;
    }
  }
  if (ui.sheet?.type === 'search' && ['toggle', 'sub', 'undo', 'alarm'].includes(act)) refreshSearch();
  if (act === 'toggle' || act === 'sub' || act === 'alarm' || act === 'dsub-toggle' || act === 'dsub-del' || act === 'c-color' || act === 'c-icon') ev.stopPropagation();
});

// bound inputs (data-bind) – text fields update silently, toggles/selects re-render
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.id === 'gsearch' && ui.sheet?.type === 'search') {
    ui.sheet.q = t.value;
    refreshSearch();
    return;
  }
  if (t.id === 'search') {
    ui.search = t.value;
    const c = catById(ui.catId);
    if (c) document.getElementById('catlist').innerHTML = categoryListHtml(c);
    return;
  }
  if (t.dataset.subtitle && ui.sheet?.type === 'entry') {
    const x = ui.sheet.d.subs.find(z => z.id === t.dataset.subtitle);
    if (x) x.title = t.value;
    return;
  }
  const b = t.dataset.bind;
  if (!b || !ui.sheet || t.type === 'checkbox' || t.tagName === 'SELECT') return;
  if (t.type === 'date' || t.type === 'datetime-local' || t.type === 'time') return; // handled on change
  setBound(b, t.value, false);
  const saveBtn = document.querySelector('.panel-head .save');
  if (saveBtn && (b === 'title' || b === 'c.name')) saveBtn.disabled = !t.value.trim();
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset.actChange === 'c-template' && ui.sheet?.type === 'category' && t.value) {
    const d = ui.sheet.d;
    const look = { id: d.id, name: d.name, icon: d.icon, color: d.color, order: d.order };
    Object.assign(d, templateRules(t.value));
    if (!d.name.trim()) { look.name = TEMPLATES[t.value].label; look.icon = TEMPLATES[t.value].icon; look.color = TEMPLATES[t.value].color; }
    Object.assign(d, look);
    renderSheet();
    toast('Reguli copiate de la ' + TEMPLATES[t.value].label);
    return;
  }
  // medicine editor: a time-of-day input (no re-render while the picker is open)
  if (t.dataset.mtime !== undefined && ui.sheet?.type === 'med') {
    ui.sheet.d.times[+t.dataset.mtime] = t.value;
    const sum = document.getElementById('medsum');
    if (sum) sum.textContent = medSummary(ui.sheet.d);
    return;
  }
  const b = t.dataset.bind;
  if (!b || !ui.sheet) return;
  if (t.type === 'checkbox') setBound(b, t.checked, true);
  else if (t.tagName === 'SELECT') setBound(b, t.value, true);
  else if (t.type === 'date' || t.type === 'datetime-local' || t.type === 'time') {
    // Never re-render while the iPhone date/time picker is open: it would close the picker
    // (and the next tap would fall through), and the minutes could not be chosen.
    const before = ui.sheet.type === 'entry' ? ui.sheet.d.hasReminder : null;
    setBound(b, t.value, false);
    if (ui.sheet.type === 'med') {
      const sum = document.getElementById('medsum');
      if (sum) sum.textContent = medSummary(ui.sheet.d);
    }
    if (ui.sheet.type === 'entry') {
      const d = ui.sheet.d;
      const remInput = document.querySelector('[data-bind="reminder"]');
      if (remInput && remInput !== t) remInput.value = d.reminder;
      const remSwitch = document.querySelector('[data-bind="hasReminder"]');
      if (remSwitch) remSwitch.checked = !!d.hasReminder;
      if (before !== d.hasReminder) ui.pendingRerender = true;
    }
  }
});
// once the picker is closed, apply any layout change it caused
document.addEventListener('focusout', ev => {
  const t = ev.target;
  if (!ui.pendingRerender || !['date', 'datetime-local', 'time'].includes(t.type)) return;
  setTimeout(() => {
    if (!ui.pendingRerender || !ui.sheet) return;
    if (['date', 'datetime-local', 'time'].includes(document.activeElement?.type)) return;
    ui.pendingRerender = false;
    renderSheet();
  }, 350);
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'newsub') { ev.preventDefault(); addDraftSub(); }
  else if (ev.key === 'Enter' && ev.target.id === 'f-title') { ev.preventDefault(); ev.target.blur(); }
});

function setBound(b, value, rerender) {
  const s = ui.sheet;
  if (b.startsWith('c.') || b.startsWith('m.')) {
    const k = b.slice(2);
    s.d[k] = value;
  } else {
    const d = s.d;
    if (b === 'cat') {
      d.cat = value;
      const c = catById(value);
      if (c.reminderMode === 'always') d.hasReminder = true;
      if (c.usesAmount && !c.usesPaid) d.hasAmount = true;
    } else if (b === 'deadlineDate') {
      if (value) d.deadline = value + 'T12:00';
      applyAutoReminder(d);
    } else {
      d[b] = value;
      if (b === 'hasReminder' || b === 'reminder') d.remTouched = true;
      if (b === 'hasDeadline' || b === 'deadline') applyAutoReminder(d);
      if (b === 'priority') d.priority = +value;
    }
  }
  if (rerender) renderSheet();
}

// ---------- drag & drop to reorder sub-items (products) ----------
let drag = null;
document.addEventListener('pointerdown', ev => {
  const h = ev.target.closest('[data-drag]');
  if (!h || ui.sheet?.type !== 'entry') return;
  ev.preventDefault();
  document.activeElement?.blur?.();
  const rows = [...document.querySelectorAll('.sublist .subedit')];
  const row = h.closest('.subedit');
  const from = rows.indexOf(row);
  if (from < 0) return;
  drag = { rows, row, from, to: from, startY: ev.clientY, rects: rows.map(r => r.getBoundingClientRect()), id: ev.pointerId };
  row.classList.add('dragging');
  try { h.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
});
document.addEventListener('pointermove', ev => {
  if (!drag || ev.pointerId !== drag.id) return;
  ev.preventDefault();
  const { rows, rects, from } = drag;
  const dy = ev.clientY - drag.startY;
  drag.row.style.transform = `translateY(${dy}px)`;
  const center = rects[from].top + rects[from].height / 2 + dy;
  let to = 0;
  rects.forEach((r, i) => { if (i !== from && r.top + r.height / 2 < center) to++; });
  drag.to = to;
  const hgt = rects[from].height;
  rows.forEach((r, i) => {
    if (i === from) return;
    let shift = 0;
    if (from < to && i > from && i <= to) shift = -hgt;
    if (from > to && i >= to && i < from) shift = hgt;
    r.style.transform = shift ? `translateY(${shift}px)` : '';
  });
}, { passive: false });
function endDrag() {
  if (!drag) return;
  const { from, to } = drag;
  drag = null;
  const subs = ui.sheet?.d?.subs;
  if (subs && from !== to) {
    const [moved] = subs.splice(from, 1);
    subs.splice(to, 0, moved);
    try { navigator.vibrate?.(10); } catch (e) { /* ignore */ }
  }
  renderSheet();
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// ---------- swipe on a row ----------
// right → red "Șterge" on the left; left (lists only) → "Setări" on the right.
// A long swipe that you let go of runs the action directly (delete still asks for confirmation).
const SWIPE_W = 92;
let sw0 = null, openSwipeEl = null, suppressClick = false;
function resetSwipe(wrap) {
  const c = wrap.querySelector('.swipe-content');
  if (c) { c.style.transition = ''; c.style.transform = ''; }
  wrap.classList.remove('open', 'armed');
  delete wrap.dataset.dir;
  delete wrap.dataset.open;
}
function closeSwipe(except) {
  if (openSwipeEl && openSwipeEl !== except) { resetSwipe(openSwipeEl); openSwipeEl = null; }
}
const isSwipeBtn = t => t.closest('.swipe-del, .swipe-set');
document.addEventListener('pointerdown', ev => {
  if (drag || ui.sheet) return;
  const wrap = ev.target.closest('.swipe[data-swipe]');
  if (!wrap || isSwipeBtn(ev.target)) { if (!isSwipeBtn(ev.target)) closeSwipe(); return; }
  const base = wrap === openSwipeEl ? (wrap.dataset.open === 'l' ? -SWIPE_W : SWIPE_W) : 0;
  sw0 = { wrap, content: wrap.querySelector('.swipe-content'), x: ev.clientX, y: ev.clientY,
          base, active: false, id: ev.pointerId, now: base, canLeft: !!wrap.querySelector('.swipe-set') };
});
document.addEventListener('pointermove', ev => {
  if (!sw0 || ev.pointerId !== sw0.id) return;
  const dx = ev.clientX - sw0.x, dy = ev.clientY - sw0.y;
  if (!sw0.active) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      sw0.active = true;
      closeSwipe(sw0.wrap);
      sw0.content.style.transition = 'none';
      sw0.width = sw0.content.getBoundingClientRect().width;
      document.activeElement?.blur?.();
    } else if (Math.abs(dy) > 10) { sw0 = null; return; } else return;
  }
  const w = sw0.width;
  const x = Math.max(sw0.canLeft ? -w : 0, Math.min(w, sw0.base + dx));
  sw0.now = x;
  sw0.content.style.transform = `translateX(${x}px)`;
  sw0.wrap.dataset.dir = x > 0 ? 'r' : x < 0 ? 'l' : '';
  const armed = Math.abs(x) > w * 0.5;
  if (armed !== sw0.wrap.classList.contains('armed')) {
    sw0.wrap.classList.toggle('armed', armed);
    try { navigator.vibrate?.(8); } catch (e) { /* ignore */ }
  }
});
function endSwipe() {
  if (!sw0) return;
  const s = sw0;
  sw0 = null;
  if (!s.active) return;
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 350);
  const w = s.width || 300;
  const id = s.wrap.dataset.id, kind = s.wrap.dataset.swipe;
  if (s.now > w * 0.5) {            // long swipe right → delete (with confirmation)
    resetSwipe(s.wrap); openSwipeEl = null;
    confirmSwipeDelete(kind, id);
    return;
  }
  if (s.now < -w * 0.5) {           // long swipe left → settings
    resetSwipe(s.wrap); openSwipeEl = null;
    openCategory(id);
    return;
  }
  s.content.style.transition = '';
  s.wrap.classList.remove('armed');
  if (s.now > SWIPE_W * 0.5) {
    s.content.style.transform = `translateX(${SWIPE_W}px)`;
    s.wrap.classList.add('open'); s.wrap.dataset.open = 'r'; s.wrap.dataset.dir = 'r';
    openSwipeEl = s.wrap;
  } else if (s.now < -SWIPE_W * 0.5) {
    s.content.style.transform = `translateX(${-SWIPE_W}px)`;
    s.wrap.classList.add('open'); s.wrap.dataset.open = 'l'; s.wrap.dataset.dir = 'l';
    openSwipeEl = s.wrap;
  } else {
    resetSwipe(s.wrap);
    openSwipeEl = null;
  }
}
document.addEventListener('pointerup', endSwipe);
document.addEventListener('pointercancel', endSwipe);
// a tap on an open row just closes it
document.addEventListener('click', ev => {
  if (suppressClick) { ev.stopImmediatePropagation(); ev.preventDefault(); return; }
  if (openSwipeEl && !isSwipeBtn(ev.target)) {
    const inside = openSwipeEl.contains(ev.target);
    closeSwipe();
    if (inside) { ev.stopImmediatePropagation(); ev.preventDefault(); }
  }
}, true);
function confirmSwipeDelete(kind, id) {
  if (kind === 'cat') {
    const c = catById(id);
    if (!c) return;
    const n = db.entries.filter(e => e.cat === id).length;
    openActions(`Ștergi lista „${c.name}”${n ? ` și cele ${n} elemente din ea` : ''}? Nu se poate anula.`, [
      { label: '🗑 Șterge lista', danger: true, run: () => {
        db.entries = db.entries.filter(e => e.cat !== id);
        db.categories = db.categories.filter(x => x.id !== id);
        save(); render(); toast('Lista a fost ștearsă');
      } },
    ]);
  } else {
    const e = entryById(id);
    if (!e) return;
    openActions(`Ștergi „${e.title}”? Nu se poate anula.`, [
      { label: '🗑 Șterge', danger: true, run: () => { deleteEntry(id); render(); toast('Șters'); } },
    ]);
  }
}

// ---------- long-press + drag up/down to reorder lists and items ----------
const LONG_PRESS_MS = 450;
let lp = null, ldrag = null;
document.addEventListener('pointerdown', ev => {
  if (ui.sheet || drag || ldrag) return;
  const wrap = ev.target.closest('.swipe[data-reorder]');
  if (!wrap || wrap === openSwipeEl || ev.target.closest('button, input, select, textarea')) return;
  lp = { wrap, x: ev.clientX, y: ev.clientY, id: ev.pointerId, timer: setTimeout(startLongDrag, LONG_PRESS_MS) };
});
function cancelLongPress() { if (lp) { clearTimeout(lp.timer); lp = null; } }
function startLongDrag() {
  if (!lp) return;
  const { wrap, y, id } = lp;
  lp = null;
  sw0 = null;                       // a long press is not a swipe
  closeSwipe();
  const rows = [...wrap.parentElement.children].filter(r => r.matches('.swipe[data-reorder]'));
  const from = rows.indexOf(wrap);
  if (from < 0 || rows.length < 2) return;
  ldrag = { wrap, rows, from, to: from, startY: y, id, rects: rows.map(r => r.getBoundingClientRect()) };
  wrap.classList.add('lifted');
  try { navigator.vibrate?.(15); } catch (e) { /* ignore */ }
}
document.addEventListener('pointermove', ev => {
  if (lp && ev.pointerId === lp.id && (Math.abs(ev.clientX - lp.x) > 8 || Math.abs(ev.clientY - lp.y) > 8)) cancelLongPress();
  if (!ldrag || ev.pointerId !== ldrag.id) return;
  ev.preventDefault();
  const { rows, rects, from } = ldrag;
  const dy = ev.clientY - ldrag.startY;
  ldrag.wrap.style.transform = `translateY(${dy}px) scale(1.02)`;
  const center = rects[from].top + rects[from].height / 2 + dy;
  let to = 0;
  rects.forEach((r, i) => { if (i !== from && r.top + r.height / 2 < center) to++; });
  ldrag.to = to;
  const h = rects[from].height;
  rows.forEach((r, i) => {
    if (i === from) return;
    let shift = 0;
    if (from < to && i > from && i <= to) shift = -h;
    if (from > to && i >= to && i < from) shift = h;
    r.style.transform = shift ? `translateY(${shift}px)` : '';
  });
}, { passive: false });
// while lifting a row, the page must not scroll
document.addEventListener('touchmove', ev => { if (ldrag) ev.preventDefault(); }, { passive: false });
function endLongDrag() {
  cancelLongPress();
  if (!ldrag) return;
  const { rows, from, to, wrap } = ldrag;
  ldrag = null;
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 350);
  rows.forEach(r => { r.style.transform = ''; });
  wrap.classList.remove('lifted');
  if (from === to) return;
  const oldIds = rows.map(r => r.dataset.id);
  const newIds = [...oldIds];
  const [moved] = newIds.splice(from, 1);
  newIds.splice(to, 0, moved);
  if (wrap.dataset.reorder === 'cat') {
    const others = cats().filter(c => !newIds.includes(c.id));
    [...newIds.map(catById), ...others].forEach((c, i) => { if (c) c.order = i; });
  } else {
    const c = catById(ui.catId);
    // every item currently shown, in screen order, with this section replaced by its new order
    const all = [...document.querySelectorAll('#catlist .swipe[data-reorder="entry"]')].map(r => r.dataset.id);
    const first = all.indexOf(oldIds[0]);
    all.splice(first, oldIds.length, ...newIds);
    all.forEach((eid, i) => { const e = entryById(eid); if (e) e.pos = i; });
    if (c && c.groupMode === 'date') {
      c.groupMode = 'none';
      toast('Lista e acum în „Ordinea mea”. Revii din ⋯ → Grupare după dată.');
    }
  }
  save();
  render();
}
document.addEventListener('pointerup', endLongDrag);
document.addEventListener('pointercancel', ev => { if (!ldrag) cancelLongPress(); else endLongDrag(); });

// ---------- iPhone: close the keyboard when you start scrolling ----------
// (otherwise the blinking text cursor drifts while the panel scrolls)
let touchY = null;
document.addEventListener('touchstart', ev => { touchY = ev.touches[0]?.clientY ?? null; }, { passive: true });
document.addEventListener('touchmove', ev => {
  if (touchY === null || drag) return;
  const a = document.activeElement;
  if (!a || !['INPUT', 'TEXTAREA'].includes(a.tagName) || a.contains(ev.target)) return;
  if (Math.abs((ev.touches[0]?.clientY ?? touchY) - touchY) > 12) { a.blur(); touchY = null; }
}, { passive: true });

// in-app heads-up for reminders that become due while the app is open
let lastCheck = Date.now();
function tick() {
  const now = Date.now();
  for (const e of db.entries) {
    if (!e.hasReminder || e.done || (e.repeat && e.repeat !== 'none')) continue;
    const due = parseLocal(e.reminder);
    if (due && +due > lastCheck && +due <= now) toast('🔔 ' + e.title);
  }
  lastCheck = now;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (!ui.sheet && !typing) render();
}

// ---------- start ----------
cleanup();
render();
setInterval(tick, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { cleanup(); if (!ui.sheet) render(); } });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
try { navigator.storage?.persist?.(); } catch (e) { /* ignore */ }
