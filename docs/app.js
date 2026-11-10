'use strict';
/* MindMe – web app (PWA). Data stays on the phone (localStorage). */

const KEY = 'bifa.data.v1';
const VERSION = '1.5';
const BUILD_DATE = '10 noiembrie 2026';
const BUILD_ID = '20261110-220948';   // set automatically by tools/publish.ps1 on every publish

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

const fDayShort = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long' });
const fDayYear = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
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
const REPEATS = { none: 'Niciodată', daily: 'Zilnic', custom: 'La fiecare câteva zile', dates: 'Zile alese din calendar', weekly: 'Săptămânal', monthly: 'Lunar', yearly: 'Anual' };
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
  shopping: { label: 'Cumpărături', icon: '🛒', color: 2 },
  trips: { label: 'Vacanțe', icon: '✈️', color: 6 },
  leave: { label: 'Zile de concediu', icon: '🏖️', color: 6 },
  office: { label: 'Zile la birou', icon: '🏢', color: 0 },
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
  if (t === 'order') set({ deadlineLabel: 'Livrare estimată', deadlineTime: false, usesAmount: true, usesPaid: true, usesVendor: true, vendorLabel: 'Magazin / curier', usesTracking: true, trackingLabel: 'AWB / număr comandă', usesSubs: true, subsLabel: 'Produse', doneLabel: 'Primită', placeholder: 'Ce ai comandat?' });
  if (t === 'payment') set({ deadlineLabel: 'Scadență', deadlineTime: false, usesAmount: true, usesDir: true, usesVendor: true, vendorLabel: 'Către / de la cine', autoRem: true, doneLabel: 'Achitată', placeholder: 'Pentru ce e plata?' });
  if (t === 'note') set({ usesGroups: true, groupMode: 'group', placeholder: 'Titlu notiță' });
  if (t === 'reminder') set({ usesDeadline: false, reminderMode: 'always', doneLabel: 'Gata', placeholder: 'Ce să-ți amintesc?' });
  if (t === 'blank') set({ usesDeadline: false, groupMode: 'none' });
  // "app" lists open a full mini-app (the Concediu / Calendar Birou apps) inside MindMe
  if (t === 'leave') set({ kind: 'app', appUrl: 'concediu.html', usesDeadline: false, reminderMode: 'off', groupMode: 'none', summary: false });
  if (t === 'office') set({ kind: 'app', appUrl: 'birou.html', usesDeadline: false, reminderMode: 'off', groupMode: 'none', summary: false });
  if (t === 'trips') set({ kind: 'trips', usesDeadline: false, reminderMode: 'off', groupMode: 'none', summary: false, placeholder: 'Destinația' });
  if (t === 'shopping') set({ kind: 'shopping', usesDeadline: false, reminderMode: 'off', usesGroups: true, groupMode: 'group', summary: false, placeholder: 'Ce cumperi?', doneLabel: 'În coș' });
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
      if (d && Array.isArray(d.categories) && Array.isArray(d.entries)) return shortenHints(d) && addTripsListOnce(addAppListsOnce(addShoppingListOnce(addMedsListOnce(d))));
    }
  } catch (e) { /* ignore */ }
  const d = { v: 1, categories: [], entries: [], medsAdded: true, shopAdded: true, appsAdded: true, tripsAdded: true };
  ['task', 'shopping', 'order', 'payment', 'note', 'reminder', 'meds', 'trips', 'leave', 'office'].forEach((t, i) => {
    d.categories.push({ id: uid(), name: TEMPLATES[t].label, icon: TEMPLATES[t].icon, color: TEMPLATES[t].color, order: i, ...templateRules(t) });
  });
  return d;
}
// (function declarations, because they already run while the data loads)
function normText(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

// store aisles, in the order you walk through a shop; keywords without diacritics
// all aisles: the built-in ones, then the ones you made yourself, and "Altele" last
function aisles() {
  const base = builtinAisles();
  let mine = [];
  try { mine = (db?.settings?.myAisles || []).map(a => [a.name, a.icon || '🏷️', '']); } catch (e) { /* data still loading */ }
  const other = base.pop();
  return [...base, ...mine.filter(m => !base.some(b => normText(b[0]) === normText(m[0]))), other];
}
// 30 icons = 5 full rows of 6 (no half-empty last row)
const AISLE_ICONS = ['🏷️', '🌱', '🥦', '🍎', '🥖', '🧀', '🥚', '🥩', '🍗', '🐟', '🥫', '🍝', '🍚', '🧂', '🍫', '🍬', '🍪', '🥜', '🧃', '🍷', '🍺', '☕', '🧊', '🧴', '🧻', '🧹', '🐶', '👶', '🎁', '🛠️'];
function builtinAisles() {
  return [
    ['Fructe și legume', '🥦', 'mere mar banane banana portocal lamai lamaie lime mandarin grepfrut struguri capsuni afine zmeura pere para kiwi ananas pepene piersic nectarin caise cirese visine prune avocado mango rodie rosii rosie cherry castrav ardei ceapa usturoi cartof morcov varza salata spanac broccoli brocoli conopid dovlec vinete ciuperci patrunjel marar leustean telina ridichi sfecla ghimbir rucola verdeata fructe legume lamaita praz'],
    ['Brutărie', '🥖', 'paine franzel bagheta chifl covrigi proaspeti corn croissant lipie toast pandispan cozonac blat chec placinta merdenea foietaj'],
    ['Lactate și ouă', '🥛', 'lapte iaurt branza telemea cascaval smantana unt oua ou kefir sana frisca mozzarella parmezan mascarpone ricotta cottage urda lactate budinca branzica margarina'],
    ['Carne și pește', '🥩', 'carne pui piept pulpe pulpa porc vita vitel curcan miel tocat tocata ceafa cotlet antricot muschi peste somon crap pastrav dorada creveti file aripi ficat mici'],
    ['Mezeluri', '🥓', 'salam sunca parizer crenvurst carnati bacon kaiser pastrama prosciutto pate mezel'],
    ['Congelate', '🧊', 'congelat congelate inghetata cuburi gheata'],
    ['Băcănie', '🍝', 'paste spaghete penne macaroane taitei orez faina zahar sare piper ulei otet conserv ton fasole mazare porumb linte naut malai gris fulgi cereale musli ketchup mustar maioneza sos bulion pasta de tomate condiment boia oregano cimbru drojdie praf de copt miere gem dulceata unt de arahide nutella supa foi quinoa masline cornflakes'],
    ['Dulciuri și snacks', '🍫', 'ciocolat biscuit napolitan chips bomboan prajitur tort alune arahide nuci migdale caju seminte popcorn covrigei snacks baton guma jeleuri dulciuri'],
    ['Băuturi', '🥤', 'apa suc sucuri cola pepsi fanta sprite bere vin sampanie prosecco whisky vodka tuica gin lichior limonada energizant red bull nectar sirop tonic'],
    ['Cafea și ceai', '☕', 'cafea ceai capsule espresso nescafe cacao'],
    ['Curățenie', '🧽', 'detergent balsam de rufe clor domestos vanish burete bureti lavete saci menajer saci de gunoi solutie geamuri vase pastile vase tablete vase hartie de bucatarie prosoape de hartie servetele folie odorizant mop manusi'],
    ['Igienă și cosmetice', '🧴', 'sapun sampon balsam de par gel de dus pasta de dinti periuta deodorant hartie igienica crema lame aparat de ras spuma de ras tampoane absorbante dischete betisoare ata dentara apa de gura parfum lotiune servetele umede'],
    ['Bebeluși', '👶', 'scutece lapte praf piure biberon'],
    ['Animale', '🐾', 'hrana caine hrana pisica hrana pisici mancare caine mancare pisica nisip pisici'],
    ['Farmacie', '💊', 'paracetamol nurofen ibuprofen algocalmin vitamine plasturi sirop de tuse'],
    ['Casă și bucătărie', '🏠', 'becuri baterii pungi lumanari chibrituri brichete pahare farfurii tacamuri paie servetele de masa'],
    ['Altele', '🧺', ''],
  ];
}
// big product catalog (nice names with diacritics) used for suggestions while typing and for sorting.
// Brands from Romanian shops included, so "Snickers" or "lapte Zuzu" land in the right aisle.
function shopCatalog() {
  const C = {
    'Fructe și legume': 'Mere, Banane, Portocale, Lămâi, Lime, Mandarine, Clementine, Grepfrut, Struguri, Căpșuni, Afine, Zmeură, Mure, Pere, Kiwi, Ananas, Pepene verde, Pepene galben, Piersici, Nectarine, Caise, Cireșe, Vișine, Prune, Avocado, Mango, Rodie, Smochine, Curmale, Roșii, Roșii cherry, Castraveți, Ardei gras, Ardei kapia, Ardei iute, Ceapă, Ceapă roșie, Ceapă verde, Usturoi, Cartofi, Cartofi dulci, Morcovi, Varză, Varză roșie, Salată verde, Spanac, Rucola, Broccoli, Conopidă, Dovlecei, Dovleac, Vinete, Ciuperci, Pătrunjel, Mărar, Leuștean, Busuioc, Țelină, Ridichi, Sfeclă roșie, Praz, Ghimbir, Fasole verde, Porumb dulce, Varză chinezească',
    'Brutărie': 'Pâine, Pâine albă, Pâine neagră, Pâine integrală, Franzelă, Baghetă, Chifle, Covrigi, Cornuri, Croissant, Lipii, Pâine toast, Cozonac, Pandișpan, Blat de tort, Chec, Plăcintă, Merdenele, Foietaj, Vel Pitar, Boromir, 7Days',
    'Lactate și ouă': 'Lapte, Lapte Zuzu, Lapte Napolact, Lapte Covalact, Lapte fără lactoză, Lapte de ovăz, Lapte de migdale, Iaurt, Iaurt grecesc, Iaurt de băut, Activia, Danone, Kefir, Sana, Lapte bătut, Smântână, Frișcă, Unt, Margarină, Brânză, Brânză de vaci, Telemea, Telemea de vacă, Cașcaval, Mozzarella, Parmezan, Mascarpone, Ricotta, Brânză topită, Hochland, Philadelphia, Delaco, Olympus, President, Babybel, Ouă, Budincă, Desert lactat',
    'Carne și pește': 'Piept de pui, Pulpe de pui, Aripioare de pui, Pui întreg, Carne tocată, Carne de porc, Ceafă de porc, Cotlet de porc, Mușchi de porc, Carne de vită, Mușchi de vită, Carne de curcan, Carne de miel, Mici, Ficat de pui, Somon, Păstrăv, Crap, Doradă, Biban, Creveți, File de pește, Cod',
    'Mezeluri': 'Salam, Salam de Sibiu, Șuncă, Parizer, Crenvurști, Cârnați, Bacon, Kaiser, Pastramă, Prosciutto, Pate, Cris-Tim, Aldis, Caroli, Scandia, Angst, Pate de ficat',
    'Congelate': 'Înghețată, Magnum, Algida, Cornetto, Pizza congelată, Legume congelate, Cartofi prăjiți congelați, Pește congelat, Gheață, Fructe congelate',
    'Băcănie': 'Paste, Spaghete, Penne, Fusilli, Macaroane, Tăiței, Barilla, Panzani, Orez, Făină, Mălai, Griș, Zahăr, Zahăr pudră, Sare, Piper, Ulei, Ulei de măsline, Oțet, Fasole boabe, Mazăre, Porumb conservă, Ton conservă, Linte, Năut, Fulgi de ovăz, Cereale, Musli, Cornflakes, Ketchup, Muștar, Maioneză, Sos de roșii, Bulion, Pastă de tomate, Condimente, Boia, Oregano, Cimbru, Drojdie, Praf de copt, Zahăr vanilat, Miere, Gem, Dulceață, Unt de arahide, Nutella, Supă la plic, Knorr, Maggi, Kotanyi, Foi de lasagna, Quinoa, Măsline, Conserve, Heinz, Hellmann\'s, Develey',
    'Dulciuri și snacks': 'Ciocolată, Ciocolată cu lapte, Ciocolată neagră, Milka, Snickers, Mars, Twix, Bounty, KitKat, Lion, Kinder, Kinder Bueno, Ferrero Rocher, Raffaello, Toblerone, Lindt, Heidi, Poiana, Rom, Africana, Kandia, Biscuiți, Oreo, Belvita, Eugenia, Napolitane, Joe, Chips, Lay\'s, Chio, Pringles, Doritos, Bomboane, Haribo, Jeleuri, M&M\'s, Skittles, Mentos, Gumă, Orbit, Tic Tac, Prăjitură, Tort, Alune, Arahide, Nuci, Migdale, Caju, Semințe, Popcorn, Covrigei, Batoane proteice, Croissant 7Days, Toffifee',
    'Băuturi': 'Apă plată, Apă minerală, Borsec, Dorna, Aqua Carpatica, Bucovina, Izvorul Minunilor, Suc, Suc de portocale, Coca-Cola, Pepsi, Fanta, Sprite, Schweppes, 7Up, Tymbark, Cappy, Granini, Prigat, Limonadă, Ice tea, Fuze Tea, Red Bull, Monster, Hell, Bere, Ursus, Timișoreana, Ciuc, Heineken, Stella Artois, Tuborg, Carlsberg, Peroni, Bergenbier, Vin roșu, Vin alb, Vin rose, Șampanie, Prosecco, Whisky, Vodcă, Gin, Rom de băut, Țuică, Lichior, Sirop',
    'Cafea și ceai': 'Cafea, Cafea boabe, Cafea măcinată, Capsule cafea, Jacobs, Lavazza, Tchibo, Doncafe, Nescafe, Illy, Ceai, Ceai verde, Ceai negru, Lipton, Cacao, Ciocolată caldă',
    'Curățenie': 'Detergent rufe, Ariel, Persil, Dero, Bonux, Omo, Balsam de rufe, Lenor, Detergent de vase, Fairy, Pur, Tablete mașină de spălat vase, Finish, Somat, Calgon, Soluție de geamuri, Cif, Domestos, Mr. Proper, Vanish, Clor, Bureți, Lavete, Saci menajeri, Saci de gunoi, Hârtie de bucătărie, Prosoape de hârtie, Șervețele, Folie alimentară, Folie de aluminiu, Odorizant, Mop, Mănuși',
    'Igienă și cosmetice': 'Hârtie igienică, Zewa, Săpun, Săpun lichid, Gel de duș, Șampon, Balsam de păr, Pastă de dinți, Colgate, Sensodyne, Periuță de dinți, Apă de gură, Ață dentară, Deodorant, Nivea, Dove, Rexona, Head & Shoulders, Gillette, Lame de ras, Spumă de ras, Palmolive, Garnier, Cremă de mâini, Cremă de față, Loțiune de corp, Dischete demachiante, Bețișoare, Absorbante, Tampoane, Servețele umede, Parfum',
    'Bebeluși': 'Scutece, Pampers, Huggies, Lapte praf, Piure pentru copii, Biberon, Servețele bebeluși',
    'Animale': 'Hrană câini, Hrană pisici, Whiskas, Pedigree, Friskies, Purina, Felix, Nisip pisici, Recompense câini',
    'Farmacie': 'Paracetamol, Nurofen, Ibuprofen, Algocalmin, Vitamine, Vitamina C, Magneziu, Plasturi, Sirop de tuse, Spray nazal, Termometru',
  };
  const out = [];
  const seen = new Set();
  const addAll = src => {
    for (const [aisle, list] of Object.entries(src || {})) {
      String(list).split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
        const k = normText(name);
        if (!seen.has(k)) { seen.add(k); out.push({ name, aisle }); }
      });
    }
  };
  addAll(typeof window !== 'undefined' ? window.MINDME_CATALOG : null);   // the big catalog (catalog.js)
  addAll(C);                                                               // built-in fallback
  return out;
}
var SHOP_CATALOG;
function catalog() { if (!SHOP_CATALOG) SHOP_CATALOG = shopCatalog(); return SHOP_CATALOG; }

// keyword → aisle, longest keywords first so "lapte praf" beats "lapte" and "apa de gura" beats "apa"
function aisleKeywords() {
  const out = [];
  for (const [name, , words] of aisles()) {
    // multi-word keywords are written with their words joined by single spaces in the list above;
    // known multi-word phrases are matched first
    const phrases = ['balsam de rufe', 'saci menajer', 'saci de gunoi', 'pastile vase', 'tablete vase', 'hartie de bucatarie', 'prosoape de hartie',
      'balsam de par', 'gel de dus', 'pasta de dinti', 'hartie igienica', 'aparat de ras', 'spuma de ras', 'ata dentara', 'apa de gura', 'servetele umede',
      'lapte praf', 'hrana caine', 'hrana pisica', 'hrana pisici', 'mancare caine', 'mancare pisica', 'nisip pisici', 'sirop de tuse',
      'unt de arahide', 'praf de copt', 'pasta de tomate', 'red bull', 'covrigi proaspeti', 'servetele de masa'];
    let rest = ' ' + words + ' ';
    for (const p of phrases) if (rest.includes(' ' + p + ' ')) { out.push([p, name]); rest = rest.replace(' ' + p + ' ', ' '); }
    // single words of 1–2 letters ("de", "cu") are never keywords
    rest.split(' ').filter(w => w.length >= 3).forEach(w => out.push([w, name]));
  }
  // every catalog product / brand is a keyword too ("snickers", "lapte zuzu", "aqua carpatica"...)
  for (const p of catalog()) {
    const k = normText(p.name).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (k) out.push([k, p.aisle]);
  }
  return out.sort((a, b) => b[0].length - a[0].length);
}
var AISLE_KW;   // var: it is used while the data loads, before this line runs
// In Romanian the product usually comes first ("pâine cu semințe", "lapte Zuzu", "bere Ursus"),
// so the keyword found earliest in the text wins; among those starting at the same place, the longest.
function guessAisle(title) {
  if (!AISLE_KW) AISLE_KW = aisleKeywords();
  let s = normText(title).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(\d+([.,]\d+)?\s*(x|buc|bucati|kg|g|gr|l|ml|pachete|pachet|cutii|sticle)?\s+)+/, '');   // "2 kg mere" → "mere"
  const n = ' ' + s + ' ';
  let best = null, bestPos = Infinity, bestLen = 0;
  for (const [kw, name] of AISLE_KW) {
    const pos = n.indexOf(' ' + kw);
    if (pos < 0) continue;
    if (pos < bestPos || (pos === bestPos && kw.length > bestLen)) { best = name; bestPos = pos; bestLen = kw.length; }
  }
  return best || 'Altele';
}
function aisleIcon(name) { const a = aisles().find(x => x[0] === name); return a ? a[1] : '🧺'; }

// existing users get the "Cumpărături" list once: a list already called "Cumpărături" is upgraded
// (its items are kept and sorted into aisles), otherwise a new one is added right after the first list
function addShoppingListOnce(d) {
  if (d.shopAdded) return d;
  if (!d.categories.some(c => c.kind === 'shopping')) {
    const same = d.categories.find(c => normText(c.name) === 'cumparaturi');
    if (same) {
      const keep = { id: same.id, name: same.name, icon: same.icon, color: same.color, order: same.order };
      Object.assign(same, templateRules('shopping'), keep);
      d.entries.filter(e => e.cat === same.id && !e.group).forEach(e => { e.group = guessAisle(e.title); });
    } else {
      d.categories.forEach(c => { if ((c.order || 0) >= 1) c.order = (c.order || 0) + 1; });
      d.categories.push({ id: uid(), name: TEMPLATES.shopping.label, icon: TEMPLATES.shopping.icon, color: TEMPLATES.shopping.color, order: 1, ...templateRules('shopping') });
    }
  }
  d.shopAdded = true;
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  return d;
}
// existing users get "Vacanțe" once
function addTripsListOnce(d) {
  if (d.tripsAdded) return d;
  if (!d.categories.some(c => c.kind === 'trips')) {
    const order = Math.max(-1, ...d.categories.map(c => c.order || 0)) + 1;
    d.categories.push({ id: uid(), name: TEMPLATES.trips.label, icon: TEMPLATES.trips.icon, color: TEMPLATES.trips.color, order, ...templateRules('trips') });
  }
  d.tripsAdded = true;
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  return d;
}
// existing users get "Zile de concediu" + "Zile la birou" once, at the end of the lists
function addAppListsOnce(d) {
  if (d.appsAdded) return d;
  let order = Math.max(-1, ...d.categories.map(c => c.order || 0)) + 1;
  for (const t of ['leave', 'office']) {
    const url = templateRules(t).appUrl;
    const old = url.replace('.html', '/');
    if (d.categories.some(c => c.kind === 'app' && (c.appUrl === url || c.appUrl === old))) continue;
    d.categories.push({ id: uid(), name: TEMPLATES[t].label, icon: TEMPLATES[t].icon, color: TEMPLATES[t].color, order: order++, ...templateRules(t) });
  }
  d.appsAdded = true;
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
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
// old long hints saved inside existing lists → the short ones
function shortenHints(d) {
  const map = { 'Ce ai comandat? (ex: eMAG, Zara)': 'Ce ai comandat?' };
  (d.categories || []).forEach(c => { if (map[c.placeholder]) c.placeholder = map[c.placeholder]; });
  return d;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Nu am putut salva! Memorie plină?'); }
}
const cats = () => [...db.categories].sort((a, b) => a.order - b.order);
const catById = id => db.categories.find(c => c.id === id);
// how many things are still open in a list (medicines: treatments in progress; mini-apps: 0)
function activeCount(c) {
  if (c.kind === 'app') return 0;
  if (c.kind === 'trips') return db.entries.filter(e => e.cat === c.id && e.trip && typeof tripStatus === 'function' && tripStatus(e.trip).state !== 'past').length;
  if (c.kind === 'meds') return db.entries.filter(e => e.cat === c.id && e.med && medStatus(e).state === 'active').length;
  return db.entries.filter(e => e.cat === c.id && !e.done).length;
}
// lists ordered by themselves: most open things first, then alphabetically
const catsByActivity = () => [...db.categories].sort((a, b) => activeCount(b) - activeCount(a) || a.name.localeCompare(b.name, 'ro'));
const entryById = id => db.entries.find(e => e.id === id);
const colorOf = c => PALETTE[((c?.color ?? 0) % PALETTE.length + PALETTE.length) % PALETTE.length];

// ---------- entry logic ----------
// repeating reminders: daily / every N days ("custom") / weekly / monthly / yearly,
// optionally ending after N times (repEnd 'count') or on a date (repEnd 'until')
const isRepeating = e => !!e.repeat && e.repeat !== 'none';
function remStep(e, d, r) {
  switch (e.repeat) {
    case 'daily': return addDays(d, 1);
    case 'custom': return addDays(d, Math.max(1, +e.repInterval || 1));
    case 'weekly': return addDays(d, 7);
    case 'monthly': return new Date(d.getFullYear(), d.getMonth() + 1, r.getDate(), r.getHours(), r.getMinutes());
    case 'yearly': return new Date(d.getFullYear() + 1, r.getMonth(), r.getDate(), r.getHours(), r.getMinutes());
    default: return null;
  }
}
// is occurrence number `idx` (0 = the first one), falling on date d, past the end?
function remPastEnd(e, d, idx) {
  if (e.repEnd === 'count') return idx >= Math.max(1, +e.repCount || 1);
  if (e.repEnd === 'until' && e.repUntil) return startOfDay(d) > parseLocal(e.repUntil + 'T00:00');
  return false;
}
// the last occurrence, when the repetition has an end (null = never ends)
function remLast(e) {
  if (e.repeat === 'dates') { const l = remDates(e); return l[l.length - 1] || null; }
  const r = parseLocal(e.reminder);
  if (!r || !isRepeating(e) || !e.repEnd || e.repEnd === 'never') return null;
  let d = new Date(r);
  for (let i = 1; i < 5000; i++) {
    const n = remStep(e, d, r);
    if (!n || remPastEnd(e, n, i)) return d;
    d = n;
  }
  return d;
}
// "dates" mode: the reminder rings at the same time on each day picked in the calendar
function remDates(e) {
  const t = (e.reminder || '').split('T')[1] || '09:00';
  return [...new Set(e.repDates || [])].sort().map(k => parseLocal(k + 'T' + t)).filter(Boolean);
}
function nextReminder(e) {
  if (e.repeat === 'dates') return remDates(e).find(d => d > new Date()) || null;
  const r = parseLocal(e.reminder);
  if (!r) return null;
  const now = new Date();
  if (!isRepeating(e) || r > now) return r;
  let d = new Date(r);
  for (let i = 1; i < 5000 && d <= now; i++) {
    const n = remStep(e, d, r);
    if (!n) break;
    if (remPastEnd(e, n, i)) return null;   // the repetition is over
    d = n;
  }
  return d;
}
function repeatText(e) {
  if (!isRepeating(e)) return '';
  if (e.repeat === 'dates') { const n = (e.repDates || []).length; return `${n} ${n === 1 ? 'zi aleasă' : 'zile alese'}`; }
  let t = e.repeat === 'custom' ? `la fiecare ${Math.max(1, +e.repInterval || 1)} zile` : REPEATS[e.repeat].toLowerCase();
  if (e.repeat === 'custom' && +e.repInterval === 1) t = 'zilnic';
  if (e.repEnd === 'count') t += ` · de ${Math.max(1, +e.repCount || 1)} ori`;
  else if (e.repEnd === 'until' && e.repUntil) t += ` · până ${fmtDay(parseLocal(e.repUntil + 'T00:00')).toLowerCase()}`;
  return t;
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
  : `${e.reminder}|${e.repeat}|${e.repInterval || ''}|${e.repEnd || ''}|${e.repCount || ''}|${e.repUntil || ''}|${(e.repDates || []).join(',')}|${e.title}`);
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
// deleting never loses anything at once: items go to "Șterse recent" for 30 days (Setări), where they can be restored
const TRASH_DAYS = 30;
function deleteEntries(ids) {
  const set = new Set(ids);
  const gone = db.entries.filter(e => set.has(e.id));
  if (!gone.length) return;
  db.entries = db.entries.filter(e => !set.has(e.id));
  const now = Date.now();
  db.trash = [...gone.map(e => ({ ...e, deletedAt: now, catName: catById(e.cat)?.name || '' })), ...(db.trash || [])]
    .filter(e => now - e.deletedAt < TRASH_DAYS * 86400000).slice(0, 400);
  save();
  const withAlarm = gone.filter(alarmUpcoming);
  if (withAlarm.length) setTimeout(() => calendarLeftover(withAlarm), 350);
}
function deleteEntry(id) { deleteEntries([id]); }
function restoreEntry(id) {
  const i = (db.trash || []).findIndex(e => e.id === id);
  if (i < 0) return;
  const e = { ...db.trash[i] };
  let c = catById(e.cat) || db.categories.find(x => x.name === e.catName);
  if (!c) { toast(`Lista „${e.catName}” nu mai există`); return; }
  e.cat = c.id; delete e.deletedAt; delete e.catName;
  db.trash.splice(i, 1);
  db.entries.push(e);
  save(); toast(`„${e.title}” a revenit în ${c.name}`);
}
function trashSheetHtml() {
  const now = Date.now();
  const list = (db.trash || []).filter(e => now - e.deletedAt < TRASH_DAYS * 86400000);
  return `<div class="overlay"></div><div class="panel">
    <div class="panel-head"><button data-act="sheet-close">Închide</button><div class="t">Șterse recent</div><span style="min-width:70px"></span></div>
    <div class="panel-body">
      ${list.length ? `<div class="form">${list.map(e => `<div class="field trashrow">
          <div class="lbl"><b>${esc(e.title)}</b><small>${esc(e.catName || '')} · ${esc(fmtDayTime(new Date(e.deletedAt)))}</small></div>
          <button class="restore" data-act="trash-restore" data-v="${e.id}">Recuperează</button></div>`).join('')}</div>
        <button class="btn light block mt wipe" data-act="trash-empty">Golește definitiv</button>` : '<div class="empty"><div class="big">🗑️</div><b>Nimic șters</b></div>'}
    </div></div>`;
}
// an alarm that would still ring (a past one-time alarm is harmless and not worth a message)
const alarmUpcoming = e => alarmAdded(e) && (e.med ? (typeof medStatus !== 'function' || medStatus(e).state !== 'finished')
  : (e.repeat && e.repeat !== 'none') || (parseLocal(e.reminder) || 0) > new Date());
// A web app is not allowed to delete events from the iPhone Calendar. So when something with an alarm is deleted,
// say so right away and open the Calendar on that day, where the event is removed with two taps.
function alarmDate(e) {
  if (e.med) return parseLocal((e.med.start || dkey(new Date())) + 'T' + (e.med.times?.[0] || '08:00'));
  return (typeof nextReminder === 'function' && nextReminder(e)) || parseLocal(e.reminder) || new Date();
}
function calendarLeftover(list) {
  if (!list.length) return;
  const d = alarmDate(list[0]);
  const what = list.length === 1 ? `„${list[0].title}” avea o alarmă în Calendar (${fmtDayTime(d)}).` : `${list.length} elemente aveau alarme în Calendar.`;
  openActions(`${what} Aplicația nu are voie să o șteargă de acolo: deschide Calendarul, apasă pe eveniment → „Șterge evenimentul”.`, [
    { label: '📅 Deschide Calendarul la ' + fmtDay(d).toLowerCase(), run: () => {
      // calshow:<seconds since 1 Jan 2001> opens the iOS Calendar on that day
      window.location.href = 'calshow:' + Math.round((d.getTime() - Date.UTC(2001, 0, 1)) / 1000);
    } },
  ]);
}
function cleanup() {
  const now = Date.now();
  let changed = false;
  for (const c of db.categories) {
    if (!c.autoDelete) continue;
    const old = db.entries.filter(e => e.cat === c.id && e.done && now - (e.doneAt || e.createdAt) > c.autoDelete * 86400000);
    if (old.length) { deleteEntries(old.map(e => e.id)); changed = true; }   // → "Șterse recent", never silently lost
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
  let rrule = { daily: 'DAILY', custom: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }[e.repeat];
  if (rrule) {
    if (e.repeat === 'custom' && +e.repInterval > 1) rrule += `;INTERVAL=${+e.repInterval}`;
    if (e.repEnd === 'count') rrule += `;COUNT=${Math.max(1, +e.repCount || 1)}`;
    else if (e.repEnd === 'until' && e.repUntil) rrule += `;UNTIL=${e.repUntil.replace(/-/g, '')}T235900`;
  }
  // "dates" mode → one event per picked day (all added with a single "Adaugă")
  const starts = e.repeat === 'dates' ? remDates(e).filter(d => d > now) : [start];
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MindMe//RO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const s of starts) {
    out.push('BEGIN:VEVENT',
      `UID:${e.id}${e.repeat === 'dates' ? '-' + icsDate(s) : ''}@bifa`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${e.alarmSeq || 0}`,
      `DTSTART:${icsDate(s)}`,
      `DTEND:${icsDate(new Date(s.getTime() + 15 * 60000))}`,
      `SUMMARY:${icsEscape('🔔 ' + e.title)}`,
      `DESCRIPTION:${icsEscape(lines.join('\n'))}`);
    if (rrule) out.push(`RRULE:FREQ=${rrule}`);
    out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(e.title)}`, 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}
async function addAlarm(e) {
  if (!e.med && (!e.hasReminder || !e.reminder)) return;
  e.alarmSeq = (e.alarmSeq || 0) + (e.alarmFor ? 1 : 0);
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
  searching: false, searchQ: '', searchFilter: null,
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
      let t = (isRepeating(e) ? '🔁 ' : '🔔 ') + fmtDayTime(r);
      if (isRepeating(e)) t += ' · ' + repeatText(e);
      chips.push(chip(t, reminderMissed(e) ? 'var(--red)' : 'var(--pink)'));
    } else if (isRepeating(e)) {
      chips.push(chip('🔁 Remindere încheiate', 'var(--muted)'));
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
  // shopping: quantity with − / + right on the row
  if (isShopCat(c)) {
    amount = e.done
      ? (e.qty ? `<div class="qtydone">${esc(qtyText(e))}</div>` : '')
      : `<div class="qtyctl"><button data-act="qty-minus" data-id="${e.id}" aria-label="Mai puțin">−</button>
          <span>${esc(qtyText(e))}</span><button data-act="qty-plus" data-id="${e.id}" aria-label="Mai mult">+</button></div>`;
  }
  const prio = c?.usesPriority && e.priority && !e.done ? `<span class="prio" style="color:${e.priority === 2 ? 'var(--red)' : 'var(--orange)'}">${e.priority === 2 ? '!!' : '!'}</span>` : '';
  const catmark = opts.showCat && c ? `<span class="catdot">${c.icon}</span>` : '';
  const subsHtml = subs.length && !e.done ? `<div class="subs">${subs.slice(0, 8).map(s => `
      <div class="subrow ${s.done ? 'on' : ''}"><button class="subcheck ${s.done ? 'on' : ''}" style="--c:${col}" data-act="sub" data-id="${e.id}" data-sid="${s.id}">${ICON.check}</button><span>${esc(s.title)}</span></div>`).join('')}
      ${subs.length > 8 ? `<div class="footnote" style="margin:0">+ încă ${subs.length - 8}</div>` : ''}</div>` : '';

  return `<div class="swipe" data-swipe="entry" data-id="${e.id}" ${opts.reorder ? `data-reorder="${opts.reorder === 'shop' ? 'shop' : 'entry'}"` : ''}><button class="swipe-del" data-act="swipe-del" data-kind="entry" data-id="${e.id}">${ICON.trash}<span>Șterge</span></button>
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
const tile = (label, value, color, f) => f
  ? `<button class="tile" style="--tc:${color}" data-act="tile-filter" data-f="${f}"><div class="tl">${esc(label)}</div><div class="tv">${esc(value)}</div></button>`
  : `<div class="tile" style="--tc:${color}"><div class="tl">${esc(label)}</div><div class="tv">${esc(value)}</div></div>`;

// a tile that works as a filter: tap = show only those, tap again = back to everything (the active one is more coloured)
const ttile = (label, value, color, act, key, on) =>
  `<button class="tile tog ${on ? 'on' : ''}" style="--tc:${color}" data-act="${act}" data-k="${key}"><div class="tl">${esc(label)}</div><div class="tv">${esc(value)}</div></button>`;
// list tiles → which items they keep
const TILE_FILTERS = {
  active: e => !e.done,
  overdue: e => !e.done && isOverdue(e),
  topay: e => !e.done && e.hasAmount && e.dir !== 'in',
  toreceive: e => !e.done && e.hasAmount && e.dir === 'in',
  unpaid: e => e.hasAmount && !e.paid,
  total: e => !e.done && e.hasAmount,
  scheduled: e => !e.done && e.hasReminder && !reminderMissed(e),
};

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
  // medicine doses count too: past their hour today (or forgotten on earlier days) = late; still to come today = today
  const f = ui.todayF || null;
  const nowD = new Date(), dToday = dosesOn(nowD);
  const nLate = ov.length + dToday.filter(x => doseLate(x, nowD)).length + missedDoses().length;
  const dosesAhead = dToday.filter(x => !x.taken && !doseLate(x, nowD)).length;
  const install = !isStandalone() ? `<div class="banner"><b>📲 Pune MindMe pe ecranul telefonului</b>În Safari apasă <b style="display:inline">Partajează</b> (pătratul cu săgeată) → <b style="display:inline">Adaugă pe ecranul principal</b>.</div>` : '';
  const sec = (title, items, cls) => items.length ? `<div class="sec-title ${cls}">${title}</div><div class="group">${items.map(e => rowHtml(e, { showCat: true })).join('')}</div>` : '';
  return `
    ${mainHead(cap(fLong.format(new Date())), `<button class="iconbtn fill" data-act="new-pick">${ICON.plus}</button>`)}
    ${install}
    <div class="tiles three">
      ${ttile('Întârziate', nLate, nLate ? 'var(--red)' : 'var(--muted)', 'today-f', 'late', ui.todayF === 'late')}
      ${ttile('Azi', td.length + dosesAhead, 'var(--orange)', 'today-f', 'today', ui.todayF === 'today')}
      ${ttile('7 zile', wk.length, 'var(--blue)', 'today-f', 'week', ui.todayF === 'week')}
    </div>
    ${!ov.length && !td.length && !wk.length && !dosesOn(new Date()).length ? `<div class="empty"><div class="big">☀️</div><b>Ziua e liberă</b></div>` : ''}
    ${!f || f === 'late' ? missedDosesHtml() : ''}
    ${!f && typeof tripTodayHtml === 'function' ? tripTodayHtml() : ''}
    ${medsTodayHtml(f)}
    ${!f || f === 'late' ? sec('Întârziate', ov, 'red') : ''}
    ${!f || f === 'today' ? sec('Azi', td, 'orange') : ''}
    ${!f || f === 'week' ? sec('Următoarele 7 zile', wk, '') : ''}
    ${f && !(f === 'late' ? nLate : f === 'today' ? td.length + dosesAhead : wk.length) ? '<div class="empty"><b>Nimic aici</b></div>' : ''}`;
}

function medsTodayHtml(f) {
  const now = new Date();
  let doses = dosesOn(now);
  if (f === 'late') doses = doses.filter(x => doseLate(x, now));
  else if (f === 'today') doses = doses.filter(x => !x.taken && !doseLate(x, now));
  else if (f === 'week') doses = [];
  if (!doses.length) return '';
  const taken = doses.filter(x => x.taken).length;
  return `<div class="sec-title" style="color:var(--text);font-size:15px;text-transform:none;margin-top:24px">💊 Medicamente azi · ${taken} din ${doses.length} luate</div>
    ${doseRowsHtml(doses, new Date())}`;
}

function screenLists() {
  const rows = catsByActivity().map((c, i, arr) => {
    const items = db.entries.filter(e => e.cat === c.id);
    const active = items.filter(e => !e.done);
    const over = active.filter(e => isOverdue(e) || reminderMissed(e)).length;
    const today = active.filter(isDueToday).length;
    let sub = active.length ? `${active.length} ${active.length === 1 ? 'activ' : 'active'}` : 'Totul e bifat ✓';
    if (today) sub += ` · ${today} azi`;
    if (over) sub += ` · ${over} întârziat${over === 1 ? '' : 'e'}`;
    if (c.kind === 'trips') {
      const next = db.entries.filter(e => e.cat === c.id && e.trip && tripStatus(e.trip).state !== 'past').sort((a, b) => a.trip.start.localeCompare(b.trip.start))[0];
      sub = next ? `${next.trip.emoji || '✈️'} ${next.trip.dest} · ${tripStatus(next.trip).text}` : 'Planifică o vacanță';
    }
    if (c.kind === 'app') sub = appUrlOf(c) === 'birou.html' ?'Zile de birou pe lună, după reguli' : 'Sold, calendar și idei de punți';
    if (isMedCat(c)) {
      const running = items.filter(e => e.med && medStatus(e).state === 'active').length;
      const doses = dosesOn(new Date()).filter(x => x.e.cat === c.id);
      sub = running ? `${running} ${running === 1 ? 'tratament' : 'tratamente'} în curs` : 'Niciun tratament în curs';
      if (doses.length) sub += ` · azi ${doses.filter(x => x.taken).length}/${doses.length} luate`;
    }
    const right = ui.reorder
      ? `<div class="order-btns"><button data-act="cat-up" data-id="${c.id}" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>${ICON.up}</button><button data-act="cat-down" data-id="${c.id}" ${i === arr.length - 1 ? 'disabled style="opacity:.3"' : ''}>${ICON.down}</button></div>`
      : `${active.length ? `<span class="badge" style="--c:${colorOf(c)}">${active.length}</span>` : ''}
         <span class="chev">${ICON.chev}</span>`;
    return `<div class="swipe" ${ui.reorder ? '' : 'data-swipe="cat"'} data-id="${c.id}"><button class="swipe-del" data-act="swipe-del" data-kind="cat" data-id="${c.id}">${ICON.trash}<span>Șterge</span></button>
    <button class="swipe-set" data-act="swipe-set" data-id="${c.id}">${ICON.gear}<span>Setări</span></button>
    <div class="catrow swipe-content" data-act="${ui.reorder ? '' : 'open-cat'}" data-id="${c.id}">
      <div class="caticon" style="--c:${colorOf(c)}">${c.icon}</div>
      <div style="flex:1;min-width:0"><div class="catname">${esc(c.name)}</div><div class="catsub ${over ? 'red' : ''}">${sub}</div></div>
      ${right}
    </div></div>`;
  }).join('');
  return `
    ${mainHead('Liste', `<button class="iconbtn fill" data-act="cat-new">${ICON.plus}</button>`)}
    <div class="group">${rows || '<div class="empty">Nicio listă.</div>'}</div>
`;
}

// ---------- Setări ----------
// "Despre": several wordings; on the phone itself we keep the one whose last line is (almost) full,
// so the justified paragraph is a perfect block (fonts differ between devices, so this is measured live)
const ABOUT_STARTS = [
  'Organizatorul tău personal: ce ai de făcut, comenzi, plăți, notițe, remindere, medicamente, cumpărături, vacanțe, zile de concediu și zile la birou, într-o singură aplicație.',
  'Organizatorul tău personal: ce ai de făcut, comenzi, plăți, notițe, remindere, cumpărături, medicamente, vacanțe, zile de concediu și zile la birou, toate într-o singură aplicație.',
  'Organizatorul tău personal, cu tot ce contează într-o singură aplicație: ce ai de făcut, comenzi, plăți, notițe, remindere, medicamente, cumpărături, vacanțe, zile de concediu și zile la birou.',
  'MindMe îți ține ordinea în viață: ce ai de făcut, comenzi, plăți, notițe, remindere, medicamente, cumpărături, vacanțe, zile de concediu și zile la birou, într-o singură aplicație.',
];
const ABOUT_ENDS = ['', ' Datele rămân doar pe telefonul tău.', ' Totul rămâne doar pe telefonul tău.', ' Totul rămâne doar pe telefonul tău, fără cont.',
  ' Totul rămâne doar pe telefonul tău, fără cont și fără reclame.', ' Totul rămâne doar pe telefonul tău, fără cont, fără server și fără reclame.',
  ' Datele tale rămân doar pe telefon: fără cont, fără server și fără reclame.', ' Datele tale rămân doar pe telefonul tău: fără cont, fără server, fără reclame.'];
const ABOUT_TAILS = ['', ' Simplu și rapid.', ' Simplu, rapid și al tău.', ' Simplă, rapidă și doar a ta.', ' Gândită să-ți fie la îndemână în fiecare zi.'];
const ABOUT_VARIANTS = ABOUT_STARTS.flatMap(st => ABOUT_ENDS.flatMap(e => ABOUT_TAILS.map(t => st + e + t)));
function fitAbout() {
  const p = document.getElementById('abouttxt');
  if (!p || !p.clientWidth) return;
  const probe = p.cloneNode(false);
  probe.removeAttribute('id');
  Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', left: '0', top: '0', width: p.clientWidth + 'px', textAlign: 'left', textAlignLast: 'auto' });
  document.body.appendChild(probe);
  let best = null;
  for (const v of ABOUT_VARIANTS) {
    probe.textContent = v.replace(GLUE_RE, '$1‑');
    const r = document.createRange(); r.selectNodeContents(probe);
    const rects = [...r.getClientRects()].filter(x => x.width > 0);
    const lastTop = Math.max(...rects.map(x => Math.round(x.top)));
    const last = rects.filter(x => Math.round(x.top) === lastTop);
    const fill = (Math.max(...last.map(x => x.right)) - Math.min(...last.map(x => x.left))) / probe.clientWidth;
    const tops = [...new Set(rects.map(x => Math.round(x.top)))];
    const lines = tops.length;
    // fullness of the other lines too (a half-empty line would get big gaps when justified)
    const minFill = Math.min(1, ...tops.slice(0, -1).map(t => { const rs = rects.filter(x => Math.round(x.top) === t);
      return (Math.max(...rs.map(x => x.right)) - Math.min(...rs.map(x => x.left))) / probe.clientWidth; }));
    // best: last line (almost) full, every line well filled, then the richest text — at most 6 lines
    const score = lines > 6 ? fill - 5 : (fill >= 0.93 ? 2 : fill) + minFill * 1.5 + v.length / 2000;
    if (!best || score > best.score) best = { v, score };
  }
  probe.remove();
  p.textContent = best.v.replace(GLUE_RE, '$1‑');
  p.classList.add('fitted');
}
window.addEventListener('resize', () => { if (ui.tab === 'settings') fitAbout(); });
function themePref() { try { return localStorage.getItem('mindme.theme') || 'auto'; } catch (e) { return 'auto'; } }
function applyTheme(t) {
  try { if (t === 'auto') localStorage.removeItem('mindme.theme'); else localStorage.setItem('mindme.theme', t); } catch (e) { /* ignore */ }
  const set = doc => { if (!doc) return; if (t === 'auto') doc.documentElement.removeAttribute('data-theme'); else doc.documentElement.setAttribute('data-theme', t); };
  set(document);
  // iPhone status bar + browser bar colour follow the chosen theme (the status bar style is applied on the next start)
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="apple-mobile-web-app-status-bar-style"]').forEach(m => { m.content = dark ? 'black-translucent' : 'default'; });
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = dark ? '#000000' : '#F2F2F7'; });
  document.querySelectorAll('iframe').forEach(f => { try { set(f.contentDocument); } catch (e) { /* ignore */ } });
}
function storageUsed() {
  let n = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch (e) { /* ignore */ }
  return n < 1048576 ? `${fNum.format(Math.max(1, Math.round(n / 1024)))} KB` : `${fNum.format(Math.round(n / 104857.6) / 10)} MB`;
}
function screenSettings() {
  const th = themePref();
  const nItems = db.entries.length, nLists = db.categories.length;
  const row = (icon, label, right, act = '', extra = '') => `<div class="setrow" ${act ? `data-act="${act}" ${extra}` : ''}><span class="seticon">${icon}</span><span class="setlbl">${label}</span>${right}</div>`;
  const chev = `<span class="chev">${ICON.chev}</span>`;
  return `
    ${mainHead('Setări', '')}
    <div class="sec-title">Aspect</div>
    <div class="group setgroup">
      <div class="setrow col"><div class="setrow-top"><span class="seticon">🌗</span><span class="setlbl">Temă</span></div>
        <div class="seg">${[['auto', 'Automat'], ['light', 'Luminos'], ['dark', 'Întunecat']].map(([k, l]) => `<button class="${th === k ? 'on' : ''}" data-act="theme" data-v="${k}">${l}</button>`).join('')}</div></div>
    </div>

    <div class="sec-title">Liste</div>
    <div class="group setgroup">
      ${row('🧳', 'Lista mea standard de bagaj', chev, 'set-pack')}
      ${row('🏷️', 'Produsele mele (cumpărături)', chev, 'my-products')}
    </div>

    <div class="sec-title">Date și backup</div>
    <div class="group setgroup">
      ${row('⬇️', 'Salvează o copie (backup)', chev, 'export')}
      ${row('⬆️', 'Încarcă dintr-un backup', chev, 'import')}
      ${row('🗑️', 'Șterse recent', `${(db.trash || []).length ? `<span class="setval">${db.trash.length}</span>` : ''}${chev}`, 'trash-open')}
      ${row('💾', 'Spațiu folosit', `<span class="setval">${storageUsed()}</span>`)}
      ${row('🗂️', 'Conținut', `<span class="setval">${nLists} ${nLists === 1 ? 'listă' : 'liste'} · ${nItems} ${nItems === 1 ? 'element' : 'elemente'}</span>`)}
    </div>
    <div class="group setgroup" style="margin-top:14px">
      ${row('🗑️', '<span style="color:var(--red)">Șterge toate datele</span>', '', 'wipe-all')}
    </div>

    ${!isStandalone() ? `<div class="sec-title">Pe telefon</div>
    <div class="banner" style="margin-top:0"><b>📲 Pune MindMe pe ecranul telefonului</b>În Safari apasă <b style="display:inline">Partajează</b> (pătratul cu săgeată) → <b style="display:inline">Adaugă pe ecranul principal</b>. Așa se deschide ca o aplicație, pe tot ecranul.</div>` : ''}

    <div class="sec-title">Despre</div>
    <div class="about">
      <img src="icons/icon-192.png" alt="" class="about-ico">
      <div class="about-name">MindMe</div>
      <div class="about-ver">Versiunea ${VERSION} · ${BUILD_DATE}</div>
      <p class="about-txt" id="abouttxt">${esc(ABOUT_VARIANTS[0])}</p>
      <div class="about-dev">Dezvoltată de <b>Ionuț Mătanie</b></div>
      <div class="about-copy">© 2026 Ionuț Mătanie. Toate drepturile rezervate.</div>
    </div>`;
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
    if (ui.tileF && TILE_FILTERS[ui.tileF]) { if (!TILE_FILTERS[ui.tileF](e)) return false; }
    else {
      if (ui.filter === 'active' && settledDone(e)) return false;
      if (ui.filter === 'done' && !e.done) return false;
    }
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
    return `<div class="empty"><div class="big">${c.icon}</div><b>${ui.filter === 'done' ? 'Nimic bifat încă' : 'Nimic aici'}</b></div>`;
  }
  return sectionsHtml(sections, { showGroup: c.groupMode !== 'group', reorder: true });
}
function screenCategory(c) {
  if (isMedCat(c)) return screenMeds(c);
  if (isShopCat(c)) return screenShopping(c);
  if (c.kind === 'app') return screenApp(c);
  if (c.kind === 'trips' && typeof screenTrips === 'function') return screenTrips(c);
  const all = db.entries.filter(e => e.cat === c.id);
  const active = all.filter(e => !e.done);
  const col = colorOf(c);
  const T = (label, value, color, key) => ttile(label, value, color, 'list-f', key, ui.tileF === key);
  const tiles = [T('Active', active.length, col, 'active')];
  if (c.usesDeadline) { const o = active.filter(isOverdue).length; tiles.push(T('Întârziate', o, o ? 'var(--red)' : 'var(--muted)', 'overdue')); }
  if (c.usesAmount) {
    const pairs = l => l.filter(e => e.hasAmount).map(e => [e.amount, e.currency]);
    if (c.usesDir) {
      tiles.push(T('De plătit', totals(pairs(active.filter(e => e.dir !== 'in'))), 'var(--red)', 'topay'));
      tiles.push(T('De primit', totals(pairs(active.filter(e => e.dir === 'in'))), 'var(--green)', 'toreceive'));
    } else if (c.usesPaid) tiles.push(T('Neplătit', totals(pairs(all.filter(e => !e.paid))), 'var(--red)', 'unpaid'));
    else tiles.push(T('Total', totals(pairs(active)), 'var(--blue)', 'total'));
  }
  if (!c.usesDeadline && c.reminderMode !== 'off') tiles.push(T('Programate', active.filter(e => e.hasReminder && !reminderMissed(e)).length, 'var(--pink)', 'scheduled'));
  const showTiles = c.summary && all.length;
  return `
    <div class="topbar"><div class="left"><button class="back" data-act="back">${ICON.back}Liste</button></div>
      <div class="right">
      <button class="iconbtn" data-act="cat-menu" data-id="${c.id}">${ICON.more}</button>
      <button class="iconbtn fill" style="background:${col}" data-act="new" data-id="${c.id}">${ICON.plus}</button></div></div>
    <h1><span class="emo">${c.icon}</span>${esc(c.name)}</h1>
    ${showTiles ? `<div class="tiles">${tiles.join('')}</div>` : ''}
    <div class="seg">${['active', 'done', 'all'].map(f => `<button class="${ui.filter === f ? 'on' : ''}" data-act="filter" data-f="${f}">${{ active: 'Active', done: 'Bifate', all: 'Toate' }[f]}</button>`).join('')}</div>
    <input class="search" type="search" id="search" placeholder="Caută în ${esc(c.name)}" value="${esc(ui.search)}">
    <div id="catlist">${categoryListHtml(c)}</div>
    ${!ui.tileF && ui.filter === 'done' && all.some(e => e.done) ? `<button class="btn light block mt wipe" data-act="list-wipe" data-v="done" data-id="${c.id}">Șterge bifatele</button>` : ''}
    ${!ui.tileF && ui.filter === 'all' && all.length ? `<button class="btn light block mt wipe" data-act="list-wipe" data-v="all" data-id="${c.id}">Șterge tot din listă</button>` : ''}`;
}

function screenReminders() {
  const list = db.entries.filter(e => e.hasReminder && catById(e.cat));
  const missed = list.filter(reminderMissed).sort((a, b) => parseLocal(b.reminder) - parseLocal(a.reminder));
  const upcoming = list.filter(e => (!e.done || isRecent(e)) && !reminderMissed(e) && nextReminder(e));
  const days = {};
  for (const e of upcoming) { const d = startOfDay(nextReminder(e)); (days[+d] ||= []).push(e); }
  const keys = Object.keys(days).map(Number).sort((a, b) => a - b);
  const notAdded = upcoming.filter(e => !alarmAdded(e)).length;
  return `
    ${mainHead('Remindere', `<button class="iconbtn fill" data-act="new-pick" data-rem="1">${ICON.plus}</button>`)}
    ${notAdded ? `<div class="banner"><b>🔔 ${notAdded} ${notAdded === 1 ? 'reminder fără alarmă' : 'remindere fără alarmă'}</b></div>` : ''}
    ${!missed.length && !keys.length ? `<div class="empty"><div class="big">🔔</div><b>Niciun reminder</b></div>` : ''}
    ${missed.length ? `<div class="sec-title red">Trecute, nebifate</div><div class="group">${missed.map(e => rowHtml(e, { showCat: true })).join('')}</div>` : ''}
    ${keys.map(k => `<div class="sec-title">${esc(dayHeader(new Date(k)))}</div><div class="group">${sortByRem(days[k]).map(e => rowHtml(e, { showCat: true })).join('')}</div>`).join('')}`;
}
const sortByRem = l => [...l].sort((a, b) => nextReminder(a) - nextReminder(b));

function render() {
  const app = document.getElementById('app');
  // a mini-app is open: never rebuild it (it would reload and lose what you were doing)
  const cur = ui.tab === 'lists' && ui.catId ? catById(ui.catId) : null;
  document.body.classList.toggle('inapp', cur?.kind === 'app');
  if (cur?.kind === 'app') {
    const fr = document.getElementById('appframe');
    if (fr && fr.dataset.cat === cur.id) { renderTabbar(); return; }
  }
  const y = scroller().scrollTop;
  let html;
  if (ui.tab === 'lists' && ui.catId && catById(ui.catId)) html = screenCategory(catById(ui.catId));
  else if (ui.tab === 'lists') { ui.catId = null; html = screenLists(); }
  else if (ui.tab === 'reminders') html = screenReminders();
  else if (ui.tab === 'settings') html = screenSettings();
  else html = screenToday();
  const isMain = !(ui.tab === 'lists' && ui.catId);
  if (isMain) html += `</div><div class="searchlayer" id="slayer">${ui.searching ? searchLayerHtml() : ''}</div>`;
  else ui.searching = false;
  app.innerHTML = html;
  app.classList.toggle('searching', !!(isMain && ui.searching));
  document.body.classList.toggle('searching', !!(isMain && ui.searching));
  pinHeader(app);
  glueHyphens(app); glueHyphens(document.getElementById('fixhead'));
  requestAnimationFrame(markScrolled);
  if (ui.tab === 'settings') requestAnimationFrame(fitAbout);
  openSwipeEl = null;
  scroller().scrollTo(0, ui.searching ? 0 : y);
  renderTabbar();
  initSegs(app);
  if (typeof tripAfterRender === 'function') tripAfterRender();
}

// ---------- the top of every screen stays put (title, date, + / ‹ back, title, buttons) ----------
// The header is moved into #fixhead (fixed, frosted glass); the page scrolls (and bounces) underneath it.
let fixObs = null;
// hairline under the fixed header only when something is scrolled underneath it
function markScrolled() { document.body.classList.toggle('scrolled', (scroller().scrollTop || 0) > 4); }
window.addEventListener('scroll', markScrolled, { passive: true });
// Romanian short forms joined by a hyphen ("salvează-l", "într-o", "dintr-un") must never break at the hyphen:
// swap the hyphen for a non-breaking one (looks identical) in everything on screen
const GLUE_RE = /(\p{L})-(?=(?:l|o|i|le|li|lor|mi|ți|ti|și|si|ne|vă|va|un|al|ai|am|ați|au|a|s|n|lea|nd)(?!\p{L}))/gu;
function glueHyphens(root) {
  if (!root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeValue.includes('-') && !n.parentElement?.closest('input,textarea,script,style')) {
      const v = n.nodeValue.replace(GLUE_RE, '$1‑');
      if (v !== n.nodeValue) n.nodeValue = v;
    }
  }
}
function pinHeader(app) {
  const fh = document.getElementById('fixhead');
  fh.innerHTML = '';
  const parts = [];
  if (!document.body.classList.contains('inapp')) {
    const hrow = app.querySelector('.mainhead .hrow');
    if (hrow) { parts.push(hrow); const sb = app.querySelector('.mainhead .sbar'); if (sb) parts.push(sb); }
    else {
      const tb = app.querySelector(':scope > .topbar');
      if (tb) { parts.push(tb); const h1 = tb.nextElementSibling; if (h1 && h1.tagName === 'H1') parts.push(h1); }
    }
  }
  parts.forEach(p => fh.appendChild(p));
  fh.classList.toggle('on', parts.length > 0);
  const fit = () => { app.style.paddingTop = fh.classList.contains('on') ? fh.offsetHeight + 'px' : ''; };
  fit();
  if (!fixObs && window.ResizeObserver) { fixObs = new ResizeObserver(fit); fixObs.observe(fh); }
}

// ---------- main header: title + "+" on one row, full-width search bar below (like WhatsApp) ----------
function mainHead(title, right) {
  return `<div class="mainhead">
    <div class="hrow"><h1>${esc(title)}</h1><div class="right">${right}</div></div>
    <div class="sbar">
      <label class="sfield">${ICON.search}<input id="gsearch" type="search" placeholder="Caută" autocomplete="off" autocorrect="off" enterkeyhint="search" value="${esc(ui.searchQ || '')}"></label>
      <button class="scancel" data-act="search-cancel">Anulează</button>
    </div>
  </div><div class="screen-body">`;
}

// ---------- in-place search: suggestions, recent searches, lists ----------
const SEARCH_FILTERS = [
  { k: 'today', label: '📅 Azi', items: () => db.entries.filter(e => !e.med && !e.done && (isDueToday(e) || (e.hasReminder && nextReminder(e) && sameDay(nextReminder(e), new Date())))) },
  { k: 'overdue', label: '⚠️ Întârziate', items: () => db.entries.filter(e => !e.med && !e.done && (isOverdue(e) || reminderMissed(e))) },
  { k: 'meds', label: '💊 Medicamente azi', items: () => [...new Set(dosesOn(new Date()).map(x => x.e))] },
  { k: 'unpaid', label: '💸 De plătit', items: () => moneyItems().filter(x => x.flow === 'toPay').map(x => x.e) },
  { k: 'receive', label: '💰 De primit', items: () => moneyItems().filter(x => x.flow === 'toReceive').map(x => x.e) },
  { k: 'partial', label: '📦 Parțial primite', items: () => db.entries.filter(e => !e.done && (e.subs || []).length && e.subs.some(s => s.done) && !e.subs.every(s => s.done)) },
  { k: 'reminders', label: '🔔 Cu reminder', items: () => db.entries.filter(e => !e.med && !e.done && e.hasReminder) },
  { k: 'recent', label: '✓ Bifate recent', items: () => db.entries.filter(e => e.done && e.doneAt && Date.now() - e.doneAt < 7 * 86400000) },
];
const recents = () => (db.settings ||= {}).recent ||= [];
function addRecent(q) {
  q = (q || '').trim();
  if (q.length < 2) return;
  const r = recents();
  const i = r.findIndex(x => norm(x) === norm(q));
  if (i >= 0) r.splice(i, 1);
  r.unshift(q);
  r.length = Math.min(r.length, 8);
  save();
}
function resultsByList(items) {
  let html = '';
  let i = 0;
  for (const c of cats()) {
    const list = items.filter(e => e.cat === c.id);
    if (!list.length) continue;
    html += `<div class="sl-in" style="--i:${i++}"><div class="sec-title">${c.icon} ${esc(c.name)} · ${list.length}</div>
      <div class="group">${sortEntries(list).map(e => rowHtml(e, {})).join('')}</div></div>`;
  }
  return html;
}
function searchLayerHtml() {
  const q = (ui.searchQ || '').trim();
  if (ui.searchFilter) {
    const f = SEARCH_FILTERS.find(x => x.k === ui.searchFilter) || STAT_FILTERS[ui.searchFilter];
    const items = f ? f.items() : [];
    return `<div class="sl-in"><button class="sl-active" data-act="filter-clear">${esc(f?.label || '')} <span>✕</span></button></div>
      ${items.length ? resultsByList(items) : `<div class="empty sl-in"><div class="big">✨</div><b>Nimic aici</b>Nu ai elemente pentru „${esc(f?.label || '')}”.</div>`}`;
  }
  if (q) return searchResultsHtml(q);
  const chips = SEARCH_FILTERS.map(f => ({ f, n: f.items().length })).filter(x => x.n);
  const r = recents();
  let i = 0;
  return `
    ${chips.length ? `<div class="sl-in" style="--i:${i++}"><div class="sl-title">Sugestii</div>
      <div class="sl-chips">${chips.map(({ f, n }) => `<button data-act="sugg" data-v="${f.k}">${esc(f.label)} <b>${n}</b></button>`).join('')}</div></div>` : ''}
    ${r.length ? `<div class="sl-in" style="--i:${i++}"><div class="sl-head"><span>Căutări recente</span><button data-act="recent-clear">Șterge tot</button></div>
      <div class="group">${r.map((t, k) => `<div class="sl-recent" data-act="recent" data-v="${esc(t)}">
        <span class="sl-ico">🕘</span><span class="sl-txt">${esc(t)}</span>
        <button class="sl-x" data-act="recent-del" data-i="${k}" aria-label="Șterge">✕</button></div>`).join('')}</div></div>` : ''}
    <div class="sl-in" style="--i:${i++}"><div class="sl-title">Liste</div>
      <div class="group">${catsByActivity().map(c => {
        const n = activeCount(c);
        return `<div class="catrow" data-act="search-cat" data-id="${c.id}"><div class="caticon" style="--c:${colorOf(c)}">${c.icon}</div>
          <div style="flex:1"><div class="catname">${esc(c.name)}</div></div>${n ? `<span class="badge" style="--c:${colorOf(c)}">${n}</span>` : ''}<span class="chev">${ICON.chev}</span></div>`;
      }).join('')}</div></div>`;
}
function updateSearchLayer() {
  const l = document.getElementById('slayer');
  if (l && ui.searching) l.innerHTML = searchLayerHtml();
}
function enterSearch() {
  if (ui.searching) return;
  ui.searching = true;
  scroller().scrollTo(0, 0);
  document.getElementById('app').classList.add('searching');
  document.body.classList.add('searching');
  updateSearchLayer();
}
function exitSearch() {
  ui.searching = false;
  ui.searchQ = '';
  ui.searchFilter = null;
  const app = document.getElementById('app');
  const inp = document.getElementById('gsearch');
  if (inp) { inp.value = ''; inp.blur(); }
  app.classList.remove('searching');
  document.body.classList.remove('searching');
  const body = app.querySelector('.screen-body');
  if (body) { body.classList.remove('fadein'); void body.offsetWidth; body.classList.add('fadein'); }
  document.getElementById('tabbar')?.classList.remove('compact');
  setTimeout(() => { if (!ui.searching) { const l = document.getElementById('slayer'); if (l) l.innerHTML = ''; } }, 50);
}
document.addEventListener('focusin', ev => { if (ev.target.id === 'gsearch') enterSearch(); });

// while you type (keyboard open), hide the bottom bar — on iPhone it would float above the keyboard —
// and bring the shopping "add" field near the top so its suggestions are visible above the keyboard
const isTypingField = el => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(el.type)));
document.addEventListener('focusin', ev => {
  if (!isTypingField(ev.target)) return;
  document.body.classList.add('typing');
  if (ev.target.id === 'quickadd') {
    setTimeout(() => {
      const top = ev.target.getBoundingClientRect().top + scroller().scrollTop - 72;
      scroller().scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 250);
  }
});
document.addEventListener('focusout', () => {
  setTimeout(() => { if (!isTypingField(document.activeElement)) document.body.classList.remove('typing'); }, 80);
});
// Bottom bar like WhatsApp: a "bubble" sits behind the selected tab and slides;
// drag your finger along the bar and the bubble follows, let go to open that tab.
const TABS = [['today', 'Azi', 'sun'], ['lists', 'Liste', 'grid'], ['reminders', 'Remindere', 'bell'], ['settings', 'Setări', 'gear']];   // no Statistici: the user doesn't want statistics
function renderTabbar() {
  const bar = document.getElementById('tabbar');
  const badge = db.entries.filter(e => !e.done && !e.med && catById(e.cat) && (isOverdue(e) || isDueToday(e) || reminderMissed(e))).length
    + dosesOn(new Date()).filter(x => doseLate(x, new Date())).length
    + missedDoses().length;
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
  if (ui.tab === id && !ui.catId) { scroller().scrollTo({ top: 0, behavior: 'smooth' }); return; }
  ui.tab = id; ui.catId = null; ui.reorder = false; ui.search = '';
  ui.searching = false; ui.searchQ = ''; ui.searchFilter = null; ui.trip = null;
  document.getElementById('tabbar')?.classList.remove('compact');
  render();
  scroller().scrollTo(0, 0);
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
  bar.classList.add('dragging', 'pressing', 'dragstart');
  clearTimeout(bar._ds); bar._ds = setTimeout(() => bar.classList.remove('dragstart'), 170);
  bar.classList.remove('compact');
  placePill(tabDrag.over, ev.clientX);
  markOver(tabDrag.over);
  lensMove(ev.clientX, true);
});
// ---------- liquid-glass lens (like iOS 26 / WhatsApp): while you drag along the bottom bar, a clear lens
// follows the finger and magnifies the icons under it, with bright rim and rainbow edges ----------
function lensMove(x, start) {
  const bar = document.getElementById('tabbar');
  let L = document.getElementById('lens');
  if (!L) {
    L = document.createElement('div'); L.id = 'lens';
    L.innerHTML = '<div class="lensrow"></div><i class="lensrim"></i><i class="lensshine"></i>';
    document.body.appendChild(L);
  }
  const btns = [...bar.querySelectorAll('button[data-tab]')];
  const row = L.querySelector('.lensrow');
  row.innerHTML = btns.map(b => b.outerHTML).join('');
  row.querySelectorAll('button').forEach(b => { b.style.transform = ''; b.removeAttribute('data-tab'); });
  const br = bar.getBoundingClientRect();
  const bw = br.width / btns.length;
  const w = bw + 34, h = br.height + 12;
  const cx = Math.max(br.left + w / 2 - 6, Math.min(br.right - w / 2 + 6, x));
  const left = cx - w / 2, top = br.top + br.height / 2 - h / 2;
  Object.assign(L.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px' });
  Object.assign(row.style, { left: (br.left - left) + 'px', top: (br.top - top) + 'px', width: br.width + 'px', height: br.height + 'px',
    transformOrigin: `${cx - br.left}px 50%` });
  if (start) { L.classList.remove('off'); void L.offsetWidth; L.classList.add('on'); bar.classList.add('lensing'); }
}
function lensHide() {
  const L = document.getElementById('lens');
  document.getElementById('tabbar')?.classList.remove('lensing');
  if (L) L.classList.remove('on');
}
function markOver(btn) {
  document.querySelectorAll('#tabbar button[data-tab]').forEach(b => b.classList.toggle('over', b === btn));
}
// "magnifier" while your finger slides along a row of buttons: the one under the finger grows,
// its neighbours a little less, the rest stay normal — changing smoothly with the distance
function magnify(buttons, x, maxScale, reach) {
  buttons.forEach(b => {
    const r = b.getBoundingClientRect();
    const dist = Math.abs(x - (r.left + r.width / 2));
    const k = Math.max(0, 1 - dist / (r.width * reach));
    const s = 1 + (maxScale - 1) * k * k * (3 - 2 * k);   // smooth curve
    b.style.transform = s > 1.001 ? `scale(${s.toFixed(3)})` : '';   // grows in place, stays inside the capsule
  });
}
function unmagnify(buttons) { buttons.forEach(b => { b.style.transform = ''; }); }
// liquid glass: while you drag, the bubble stretches with the finger's speed and settles when it slows down
function stretchPill(pill, drag, x) {
  return;   // stretching turned off: the user wants a plain clear bubble
  // eslint-disable-next-line no-unreachable
  if (!pill) return;
  const now = performance.now();
  const dt = Math.max(16, now - (drag.t || now));
  const v = drag.lx === undefined ? 0 : (x - drag.lx) / dt;
  drag.t = now; drag.lx = x;
  const s = 1 + Math.min(0.3, Math.abs(v) * 0.4);
  pill.style.scale = `${s.toFixed(3)} ${(1 - (s - 1) * 0.35).toFixed(3)}`;
  clearTimeout(pill._settle);
  pill._settle = setTimeout(() => { pill.style.scale = ''; }, 110);
}
document.addEventListener('pointermove', ev => {
  if (!tabDrag || ev.pointerId !== tabDrag.id) return;
  if (Math.abs(ev.clientX - tabDrag.startX) > 6) tabDrag.moved = true;
  const over = tabAt(ev.clientX);
  if (over !== tabDrag.over) { tabDrag.over = over; try { navigator.vibrate?.(6); } catch (e) { /* ignore */ } }
  markOver(over);
  placePill(over, ev.clientX);
  lensMove(ev.clientX);
});
function endTabDrag(ev) {
  if (!tabDrag || (ev && ev.pointerId !== tabDrag.id)) return;
  const target = tabDrag.over;
  tabDrag = null;
  const bar = document.getElementById('tabbar');
  bar.classList.remove('dragging', 'pressing');
  markOver(null);
  lensHide();
  unmagnify([...bar.querySelectorAll('button[data-tab]')]);
  if (ev && ev.type === 'pointercancel') { renderTabbar(); return; }
  if (target) { placePill(target); switchTab(target.dataset.tab); }
}
document.addEventListener('pointerup', endTabDrag);
document.addEventListener('pointercancel', endTabDrag);
window.addEventListener('resize', () => { if (!tabDrag) placePill(document.querySelector(`#tabbar button[data-tab="${ui.tab}"]`)); });
// scrolling down: the glass bar gets a little smaller; scrolling up or at the top: back to normal
let lastScrollY = 0;
// (the bar no longer shrinks while scrolling: content now stops right above it)
function scroller() { return document.scrollingElement || document.documentElement; }

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
    repInterval: 2, repEnd: 'never', repCount: 5, repUntil: dkey(addDays(new Date(), 7)), repDates: [], calMonth: dkey(new Date()).slice(0, 7),
    qtyText: '', unit: 'buc',
    subs: [], remTouched: false,
  };
}
function draftFrom(e) {
  const firstPicked = [...(e.repDates || [])].sort()[0];
  return {
    ...clone(e), amountText: e.amount ? String(e.amount).replace('.', ',') : '', subs: clone(e.subs || []), remTouched: !!e.hasReminder,
    repInterval: e.repInterval || 2, repEnd: e.repEnd || 'never', repCount: e.repCount || 5,
    repUntil: e.repUntil || dkey(addDays(new Date(), 7)), repDates: [...(e.repDates || [])],
    calMonth: (firstPicked || dkey(new Date())).slice(0, 7),
    qtyText: e.qty ? fNum.format(e.qty) : '', unit: e.unit || 'buc',
  };
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
  const groups = isShopCat(c)
    ? aisles().map(a => a[0])                       // shopping: pick the aisle
    : [...new Set(db.entries.filter(e => e.cat === c.id && e.group).map(e => e.group))].sort((a, b) => a.localeCompare(b, 'ro'));
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
    const rep = d.repeat && d.repeat !== 'none';
    if (on) {
      h += (d.repeat === 'dates'
        ? `<div class="field"><span class="lbl">La ora</span><input type="time" data-bind="remTime" value="${esc(d.reminder.split('T')[1] || '09:00')}"></div>`
        : `<div class="field"><span class="lbl">Când</span><input type="datetime-local" data-bind="reminder" value="${esc(d.reminder)}"></div>`) + `
        <div class="field"><span class="ico">🔁</span><span class="lbl">Repetă</span><select data-bind="repeat">${Object.entries(REPEATS).map(([k, v]) => `<option value="${k}" ${d.repeat === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
      if (d.repeat === 'custom') {
        h += `<div class="field"><span class="lbl">La fiecare ${d.repInterval} ${+d.repInterval === 1 ? 'zi' : 'zile'}</span>
          <div class="order-btns"><button data-act="r-int" data-v="-1">−</button><button data-act="r-int" data-v="1">+</button></div></div>`;
      }
      if (d.repeat === 'dates') {
        h += `<div class="fieldcol">${calPickerHtml(d)}</div>`;
      } else if (rep) {
        h += `<div class="fieldcol"><div class="lbl" style="font-size:14px;color:var(--muted);margin-bottom:6px">Se oprește</div>
          <div class="segin" style="margin:0">
            <button class="${d.repEnd === 'never' ? 'on' : ''}" data-act="r-end" data-v="never">Niciodată</button>
            <button class="${d.repEnd === 'count' ? 'on' : ''}" data-act="r-end" data-v="count">După un număr de ori</button>
            <button class="${d.repEnd === 'until' ? 'on' : ''}" data-act="r-end" data-v="until">La o dată</button></div></div>`;
        if (d.repEnd === 'count') {
          h += `<div class="field"><span class="lbl">De ${d.repCount} ${+d.repCount === 1 ? 'dată' : 'ori'}</span>
            <div class="order-btns"><button data-act="r-count" data-v="-1">−</button><button data-act="r-count" data-v="1">+</button></div></div>
            <div class="quick">${[3, 5, 7, 10, 14, 30].map(n => `<button data-act="r-countset" data-v="${n}">${n} ori</button>`).join('')}</div>`;
        }
        if (d.repEnd === 'until') h += `<div class="field"><span class="lbl">Ultima zi</span><input type="date" data-bind="repUntil" value="${esc(d.repUntil)}"></div>`;
      }
      h += `<div class="quick">
          <button data-act="r-preset" data-v="5">🔁 5 zile la rând</button><button data-act="r-preset" data-v="7">🔁 7 zile la rând</button>
          ${quickOptions(d, c).map(([l, dt]) => `<button data-act="quick" data-v="${toLocal(dt)}">${l}</button>`).join('')}</div>`;
    }
    h += `</div>`;
    if (past) h += `<div class="ffoot orange">Ora aleasă a trecut deja — alege una din viitor.</div>`;
    else if (on) {
      let sum = '';
      if (d.repeat === 'dates') {
        const n = d.repDates.length;
        sum = n ? `Reminder în ${n} ${n === 1 ? 'zi' : 'zile'}, la ora ${(d.reminder.split('T')[1] || '')}. ` : '';
      } else if (rep) {
        const last = remLast({ ...d });
        sum = last ? `Ultimul reminder: ${fLong.format(last)}, ${fTime.format(last)}. ` : 'Se repetă fără oprire. ';
      }
      h += `<div class="ffoot" id="remsum">${esc(sum)}</div>`;
    }
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
    ${d.subs.length ? `<div class="ffoot">${done} din ${d.subs.length} bifate</div>` : ''}`);
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
        if (c.usesPaid) h += `<div class="field"><span class="ico">${d.paid ? '✅' : '💵'}</span><span class="lbl">${d.paid ? 'Plătit' : 'Neplătit (ex. ramburs)'}</span>${sw('paid', d.paid)}</div>`;
      }
    }
    parts.push(h + `</div>`);
  }

  if (isShopCat(c)) {
    // shopping: how much / how many
    parts.push(`<div class="fhead">Cantitate</div><div class="form">
      <div class="field"><input type="text" inputmode="decimal" class="amountin" data-bind="qtyText" placeholder="ex. 2" value="${esc(d.qtyText || '')}">
        <select data-bind="unit" style="max-width:110px">${UNITS.map(u => `<option value="${u}" ${u === (d.unit || 'buc') ? 'selected' : ''}>${unitLabel(u, 2)}</option>`).join('')}</select></div></div>`);
  }
  if (c.usesPriority || c.usesGroups) {
    let h = `<div class="form" style="margin-top:18px">`;
    if (c.usesPriority) h += `<div class="field"><span class="ico">🚩</span><span class="lbl">Prioritate</span><select data-bind="priority">${PRIORITIES.map((p, i) => `<option value="${i}" ${+d.priority === i ? 'selected' : ''}>${p}</option>`).join('')}</select></div>`;
    if (c.usesGroups) {
      h += `<div class="field"><span class="ico">📁</span><input type="text" data-bind="group" list="grouplist" placeholder="${isShopCat(c) ? 'Raion' : 'Grup (ex. Casă)'}" value="${esc(d.group)}">
        <datalist id="grouplist">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></div>`;
      if (groups.length) h += `<div class="quick wrap" style="--pink:var(--purple)">${groups.map(g => `<button data-act="pickgroup" data-v="${esc(g)}" class="${d.group === g ? 'on' : ''}">${isShopCat(c) ? aisleIcon(g) + ' ' : ''}${esc(g)}</button>`).join('')}</div>`;
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
  const remOn = c.reminderMode === 'always' || (c.reminderMode === 'optional' && d.hasReminder);
  if (remOn && d.repeat === 'dates' && !d.repDates.length) { toast('Alege în calendar cel puțin o zi'); return; }
  let e = d.id ? entryById(d.id) : null;
  const hadAlarm = !!e && alarmUpcoming(e), oldWhen = hadAlarm ? alarmDate(e) : null;
  if (!e) { e = { id: uid(), createdAt: Date.now() }; db.entries.push(e); }
  const amount = parseAmount(d.amountText);
  if (d.done !== !!e.done) e.doneAt = d.done ? Date.now() : null;
  Object.assign(e, {
    cat: c.id,
    title: d.title.trim(),
    details: d.details.trim(),
    group: c.usesGroups ? (d.group.trim() || (isShopCat(c) ? shopGuess(d.title) : '')) : (e.group || ''),
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
    reminder: d.repeat === 'dates' && d.repDates.length
      ? [...d.repDates].sort()[0] + 'T' + (d.reminder.split('T')[1] || '09:00')
      : d.reminder,
    repeat: d.repeat || 'none',
    repInterval: Math.max(1, +d.repInterval || 1), repEnd: d.repEnd || 'never', repCount: Math.max(1, +d.repCount || 1),
    repUntil: d.repUntil, repDates: [...new Set(d.repDates || [])].sort(),
    subs: d.subs.filter(x => x.title.trim()).map(x => ({ id: x.id, title: x.title.trim(), done: !!x.done })),
    ...(isShopCat(c) ? { qty: parseAmount(d.qtyText) || 0, unit: parseAmount(d.qtyText) ? (d.unit || 'buc') : '' } : {}),
    alarmFor: d.alarmFor || e.alarmFor || null,
  });
  if (c.usesSubs && c.subsAuto && e.subs.length && e.subs.every(x => x.done) && !e.done) { e.done = true; e.doneAt = Date.now(); }
  // shopping: you moved it to another aisle than the one we'd guess → remember it for next time
  if (isShopCat(c) && e.group && e.group !== guessAisle(e.title)) learnProduct(e.title, e.group);
  save();
  closeSheet();
  const needsAlarm = e.hasReminder && !e.done && !alarmAdded(e) && (e.repeat !== 'none' || parseLocal(e.reminder) > new Date());
  if (needsAlarm && hadAlarm && !withAlarm) {
    // the time changed on something that already had an alarm: one tap to put the new one in Calendar,
    // then (when you come back) a shortcut to the old one, in case the iPhone kept both
    openActions(`Ai schimbat ora pentru „${e.title}”. Pune alarma nouă în Calendar.`, [
      { label: '📅 Actualizează alarma în Calendar', run: () => { pendingOldAlarm = { title: e.title, when: oldWhen }; addAlarm(e); } },
    ]);
  } else if (withAlarm || needsAlarm) addAlarm(e);
  else toast('Salvat ✓');
}
let pendingOldAlarm = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !pendingOldAlarm) return;
  const o = pendingOldAlarm; pendingOldAlarm = null;
  setTimeout(() => openActions(`Dacă în Calendar a rămas și alarma veche pentru „${o.title}” (${fmtDayTime(o.when)}), șterge-o: apasă pe ea → „Șterge evenimentul”.`, [
    { label: '📅 Deschide Calendarul la ' + fmtDay(o.when).toLowerCase(), run: () => { window.location.href = 'calshow:' + Math.round((o.when.getTime() - Date.UTC(2001, 0, 1)) / 1000); } },
  ]), 600);
});

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
      ${d.kind === 'meds' || d.kind === 'app' ? '' : `

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
        ${tx('doneLabel', 'Starea după bifare', 'ex. Făcut')}
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
      ${!all.length ? `<div class="empty"><div class="big">📊</div><b>Încă nu sunt date</b></div>` : `
      <div class="tiles">${tiles.join('')}</div>
      <div class="fhead">${c.usesDir ? 'De plătit' : 'Total'} pe luni (${esc(cur)})</div>
      <div class="form chart">
        <div class="readout"><b>${esc(cap(fMonthLong.format(sel.d)))}</b><span>${esc(money(sel.sum, cur))} · ${nItems(sel.n)}</span></div>
        <div class="bars">${bars}</div>
      </div>
      <div class="ffoot">Apasă sau glisează peste luni ca să vezi ce e în ele.${other.length ? ` Sumele în altă monedă (${esc(totals(other.map(e => [e.amount, e.currency])))}) nu apar în grafic.` : ''}</div>
      ${monthListHtml(sel, main.filter(e => monthKey(itemDate(e, c)) === sel.key), c.name)}
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
  if (!q) return `<div class="empty"><div class="big">🔍</div><b>Caută în toate listele</b></div>`;
  const listHits = cats().filter(c => norm(c.name).includes(q));
  const hits = db.entries.filter(e => catById(e.cat) && [
    e.title, e.details, e.vendor, e.group, e.tracking,
    e.hasAmount && e.amount ? fNum.format(e.amount) + ' ' + e.amount : '',
    ...(e.subs || []).map(s => s.title),
  ].some(t => norm(t).includes(q)));
  if (!hits.length && !listHits.length) return `<div class="empty"><div class="big">🤷</div><b>Nimic găsit</b></div>`;
  let html = '';
  if (listHits.length) {
    html += `<div class="sl-in"><div class="sec-title">Liste</div><div class="group">${listHits.map(c => `
      <div class="catrow" data-act="search-cat" data-id="${c.id}"><div class="caticon" style="--c:${colorOf(c)}">${c.icon}</div>
      <div style="flex:1"><div class="catname">${esc(c.name)}</div></div><span class="chev">${ICON.chev}</span></div>`).join('')}</div></div>`;
  }
  return html + resultsByList(hits);
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

// ---------- mini-apps inside MindMe (Zile de concediu, Zile la birou) ----------
// the mini-apps are single files now (easy to upload); old saved lists still point to the folder names
const appUrlOf = c => ({ 'concediu/': 'concediu.html', 'birou/': 'birou.html' }[c.appUrl] || c.appUrl);
// same header as every other list; the mini-app fills the rest of the screen and MindMe's
// bottom bar stays on top of it, so it feels like one app
function screenApp(c) {
  return `<div class="appview">
    <div class="topbar"><div class="left"><button class="back" data-act="back">${ICON.back}Liste</button></div><div class="right"></div></div>
    <h1><span class="emo">${c.icon}</span>${esc(c.name)}</h1>
    <iframe id="appframe" data-cat="${c.id}" src="${esc(appUrlOf(c))}" title="${esc(c.name)}"></iframe>
  </div>`;
}

// ---------- shopping list ----------
const isShopCat = c => c?.kind === 'shopping';
// ---------- "Produsele mele": your own products and the aisle you want them in ----------
// Learned automatically when you move a product to another aisle, or added by hand.
const myProducts = () => (db.myProducts ||= {});
function learnProduct(name, aisle) {
  const n = String(name || '').trim();
  if (!n || !aisle) return;
  myProducts()[norm(n)] = { name: n.charAt(0).toUpperCase() + n.slice(1), aisle };
  save();
}
// your own products win over the catalog: exact name first, then a name of yours contained in what you typed
function shopGuess(title) {
  const t = norm(title).trim();
  const mine = myProducts();
  if (mine[t]) return mine[t].aisle;
  const padded = ' ' + t.replace(/[^a-z0-9 ]+/g, ' ') + ' ';
  const hit = Object.entries(mine).sort((a, b) => b[0].length - a[0].length)
    .find(([k]) => padded.includes(' ' + k.replace(/[^a-z0-9 ]+/g, ' ') + ' '));
  return hit ? hit[1].aisle : guessAisle(title);
}
function myProductsSheetHtml() {
  const s = ui.sheet;
  const list = Object.values(myProducts()).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const opts = sel => aisles().map(a => `<option value="${esc(a[0])}" ${a[0] === sel ? 'selected' : ''}>${a[1]} ${esc(a[0])}</option>`).join('');
  return `<div class="overlay"></div>
  <div class="panel">
    <div class="panel-head"><button data-act="sheet-close">Închide</button><div class="t">Produsele mele</div><span style="min-width:70px"></span></div>
    <div class="panel-body">
      <div class="fhead">Adaugă un produs</div>
      <div class="form">
        <div class="field"><input type="text" id="mp-name" placeholder="Nume (ex. Brânză)" value="${esc(s.name || '')}" autocomplete="off"></div>
        <div class="field"><span class="lbl">Raion</span><select id="mp-aisle">${opts(s.aisle || 'Altele')}</select></div>
      </div>
      <button class="btn block mt" data-act="mp-add">＋ Salvează produsul</button>
      <div class="fhead">Adaugă un raion</div>
      <div class="form">
        <div class="field"><span class="ico">${s.aicon || '🏷️'}</span><input type="text" id="ma-name" placeholder="Nume (ex. Produse bio)" value="${esc(s.aname || '')}" autocomplete="off"></div>
      </div>
      <div class="icongrid">${AISLE_ICONS.map(ic => `<button class="${(s.aicon || '🏷️') === ic ? 'on' : ''}" data-act="ma-icon" data-v="${ic}">${ic}</button>`).join('')}</div>
      <button class="btn block mt" data-act="ma-add">＋ Salvează raionul</button>
      ${(db.settings?.myAisles || []).length ? `<div class="fhead">Raioanele tale · ${db.settings.myAisles.length}</div><div class="form">${db.settings.myAisles.map(a => `<div class="field">
          <span class="ico">${a.icon || '🏷️'}</span><span class="lbl">${esc(a.name)}</span>
          <button class="x" data-act="ma-del" data-v="${esc(a.name)}" aria-label="Șterge" style="color:var(--muted);font-size:18px;width:30px">✕</button></div>`).join('')}</div>` : ''}
      <div class="fhead">${list.length ? `Produsele tale · ${list.length}` : 'Încă nu ai produse proprii'}</div>
      ${list.length ? `<div class="form">${list.map(p => `<div class="field">
          <span class="ico">${aisleIcon(p.aisle)}</span><span class="lbl">${esc(p.name)}</span>
          <select data-mp="${esc(norm(p.name))}">${opts(p.aisle)}</select>
          <button class="x" data-act="mp-del" data-v="${esc(norm(p.name))}" aria-label="Șterge" style="color:var(--muted);font-size:18px;width:30px">✕</button></div>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

// suggestions while typing: what you bought before + the product catalog, best matches first
function shopSuggestions(c, q) {
  const qn = norm(q).trim();
  if (!qn) return [];
  const active = new Set(db.entries.filter(e => e.cat === c.id && !e.done).map(e => norm(e.title)));
  const seen = new Set();
  const out = [];
  const consider = (name, aisle, bonus) => {
    const n = norm(name);
    if (seen.has(n) || active.has(n)) return;
    let s = 0;
    if (n === qn) s = 100;
    else if (n.startsWith(qn)) s = 60;
    else if (n.split(/\s+/).some(w => w.startsWith(qn))) s = 40;
    else if (qn.length >= 3 && n.includes(qn)) s = 20;
    if (!s) return;
    seen.add(n);
    out.push({ name, aisle: aisle || guessAisle(name), s: s + bonus - n.length * 0.1 });
  };
  Object.values(myProducts()).forEach(p => consider(p.name, p.aisle, 25));
  Object.values(c.history || {}).forEach(h => consider(h.name, shopGuess(h.name), 15 + Math.min(10, h.n)));
  catalog().forEach(p => consider(p.name, p.aisle, 0));
  out.sort((a, b) => b.s - a.s);
  return out.slice(0, 6);
}
// ---------- quantities: "2 kg mere", "mere 1,5 kg", "lapte x3", "6 ouă" ----------
const UNITS = ['buc', 'kg', 'g', 'l', 'ml', 'pachet', 'cutie', 'sticlă', 'doză'];
const UNIT_ALIASES = { x: 'buc', buc: 'buc', bucata: 'buc', bucati: 'buc', bucăți: 'buc', bucată: 'buc', kg: 'kg', kile: 'kg', kilograme: 'kg', g: 'g', gr: 'g', grame: 'g',
  l: 'l', litru: 'l', litri: 'l', ml: 'ml', pachet: 'pachet', pachete: 'pachet', pac: 'pachet', cutie: 'cutie', cutii: 'cutie', sticla: 'sticlă', sticlă: 'sticlă', sticle: 'sticlă',
  doza: 'doză', doză: 'doză', doze: 'doză' };
const UNIT_RX = '(x|buc(?:ata|ati|ăți|ată)?|kg|kile|kilograme|grame|gr|g|litri|litru|l|ml|pachete|pachet|pac|cutii|cutie|sticle|sticla|sticlă|doze|doza|doză)';
function parseQty(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  const num = s => parseFloat(String(s).replace(',', '.'));
  let m = t.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RX}?\\.?\\s+(.+)$`, 'i'));          // "2 kg mere", "6 ouă"
  if (m && num(m[1]) > 0) return { name: m[3].trim(), qty: num(m[1]), unit: UNIT_ALIASES[(m[2] || 'buc').toLowerCase()] || 'buc' };
  m = t.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RX}?\\.?$`, 'i'));               // "mere 1,5 kg", "ouă 10"
  if (m && num(m[2]) > 0 && !/\d$/.test(m[1])) return { name: m[1].trim(), qty: num(m[2]), unit: UNIT_ALIASES[(m[3] || 'buc').toLowerCase()] || 'buc' };
  m = t.match(/^(.+?)\s*[x×]\s*(\d+)$/i);                                                          // "lapte x3"
  if (m) return { name: m[1].trim(), qty: +m[2], unit: 'buc' };
  return { name: t, qty: 0, unit: '' };
}
// 'buc' is stored internally, but shown in full
const unitLabel = (u, q) => u === 'buc' ? (+q === 1 ? 'bucată' : 'bucăți') : u;
const qtyStep = unit => (unit === 'kg' || unit === 'l') ? 0.5 : (unit === 'g' || unit === 'ml') ? 100 : 1;
const qtyText = e => {
  const q = +e.qty || 1, u = e.unit || 'buc';
  return `${fNum.format(q)}${u === 'buc' ? '' : ' ' + u}`;
};

function shopSuggestHtml(c, q) {
  const full = q.trim();
  if (!full) return '';
  const pq = parseQty(full);
  const raw = pq.name;                       // match on the product, keep the quantity you typed
  const qtyPart = pq.qty ? ` · ${fNum.format(pq.qty)} ${unitLabel(pq.unit, pq.qty)}` : '';
  const list = shopSuggestions(c, raw);
  const typed = raw.charAt(0).toUpperCase() + raw.slice(1);
  const exact = list.some(x => norm(x.name) === norm(raw));
  const rows = list.map(x => `<button data-act="qa-pick" data-id="${c.id}" data-v="${esc(x.name)}" data-g="${esc(x.aisle)}">
      <span class="qs-ico">${aisleIcon(x.aisle)}</span><span class="qs-name">${esc(x.name)}${esc(qtyPart)}</span><span class="qs-aisle">${esc(x.aisle)}</span></button>`);
  if (!exact && !raw.includes(',')) {
    const g = shopGuess(raw);
    rows.push(`<button data-act="qa-pick" data-id="${c.id}" data-v="${esc(typed)}" data-g="${esc(g)}">
      <span class="qs-ico">＋</span><span class="qs-name">Adaugă „${esc(typed)}”${esc(qtyPart)}</span><span class="qs-aisle">${aisleIcon(g)} ${esc(g)}</span></button>`);
    // a new product of yours: choose its aisle once, it's remembered
    rows.push(`<button data-act="qa-pickaisle" data-id="${c.id}" data-v="${esc(typed)}">
      <span class="qs-ico">🏷️</span><span class="qs-name">Produs nou „${esc(typed)}” · alege raionul</span><span class="qs-aisle">›</span></button>`);
  }
  return rows.join('');
}

// add one or more products ("lapte, 2 kg mere, ouă x10"); a product already on the list gets more quantity
function shopAdd(c, text, forcedGroup, qtyFrom) {
  const names = String(text || '').replace(/(\d),(\d)/g, '$1.$2').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  const extra = qtyFrom ? parseQty(qtyFrom) : null;   // quantity typed in the box when you tap a suggestion
  let added = 0, merged = 0;
  for (const raw of names) {
    const pq = parseQty(raw);
    const qty = pq.qty || extra?.qty || 0, unit = pq.qty ? pq.unit : (extra?.qty ? extra.unit : '');
    const title = pq.name.charAt(0).toUpperCase() + pq.name.slice(1);
    const same = db.entries.find(e => e.cat === c.id && !e.done && norm(e.title) === norm(title));
    if (same) {
      // already on the list: add to its quantity
      const u = same.unit || unit || 'buc';
      if (!unit || unit === u) { same.qty = (+same.qty || 1) + (qty || 1); same.unit = u; }
      else { same.qty = qty; same.unit = unit; }
      merged++;
      toast(`${same.title} → ${qtyText(same)}`);
      continue;
    }
    const now = new Date();
    db.entries.push({
      id: uid(), createdAt: Date.now(), cat: c.id, title, details: '', group: (names.length === 1 && forcedGroup) || shopGuess(title), done: false, doneAt: null,
      hasDeadline: false, deadline: toLocal(now), deadlineTime: false, hasAmount: false, amount: 0, currency: c.currency || 'RON',
      paid: false, dir: 'out', vendor: '', tracking: '', priority: 0, hasReminder: false, reminder: toLocal(now), repeat: 'none', subs: [],
      qty: qty || 0, unit: qty ? unit : '',
    });
    const h = (c.history ||= {});
    const k = norm(title);
    h[k] = { name: title, n: (h[k]?.n || 0) + 1, last: Date.now() };
    added++;
  }
  if (added || merged) save();
  return added + merged;
}
function screenShopping(c) {
  const col = colorOf(c);
  const items = db.entries.filter(e => e.cat === c.id);
  const active = items.filter(e => !settledDone(e));
  const cart = items.filter(settledDone);
  const order = aisles().map(a => a[0]);
  const by = {};
  active.forEach(e => { (by[e.group || 'Altele'] ||= []).push(e); });
  const groups = [...order.filter(g => by[g]), ...Object.keys(by).filter(g => !order.includes(g)).sort((a, b) => a.localeCompare(b, 'ro'))];
  const activeNames = new Set(active.map(e => norm(e.title)));
  const freq = Object.values(c.history || {}).filter(h => !activeNames.has(norm(h.name)))
    .sort((a, b) => b.n - a.n || b.last - a.last).slice(0, 14);
  const total = active.length + cart.length;
  return `
    <div class="topbar"><div class="left"><button class="back" data-act="back">${ICON.back}Liste</button></div>
      <div class="right"><button class="iconbtn" data-act="cat-menu" data-id="${c.id}">${ICON.more}</button></div></div>
    <h1><span class="emo">${c.icon}</span>${esc(c.name)}</h1>
    <div class="quickadd" style="--c:${col}">
      <button class="qa-plus" data-act="qa-add" data-id="${c.id}" aria-label="Adaugă">${ICON.plus}</button>
      <input id="quickadd" type="text" placeholder="Adaugă un produs" autocomplete="off" autocorrect="off" enterkeyhint="done" data-cat="${c.id}">
    </div>
    <div id="qasugg" class="qa-sugg"></div>
    <div class="qa-links"><button data-act="my-products">🏷️ Produsele mele${Object.keys(myProducts()).length ? ` · ${Object.keys(myProducts()).length}` : ''}</button></div>
    ${freq.length ? `<div class="sl-title" style="margin:14px 4px 8px">Cumpărate des · atinge ca să adaugi</div>
      <div class="quick qa-freq" style="--pink:${col};padding:0 0 4px">${freq.map(h => `<button data-act="qa-again" data-id="${c.id}" data-v="${esc(h.name)}">＋ ${esc(h.name)}</button>`).join('')}</div>` : ''}
    ${total ? `<div class="medtoday" style="--c:${col};margin-top:14px">
        <div><div class="mt-l">În coș</div><div class="mt-v">${cart.length} din ${total}</div></div>
        <div class="mt-bar"><span style="width:${Math.round(cart.length / total * 100)}%"></span></div></div>` : ''}
    ${!total ? `<div class="empty"><div class="big">🛒</div><b>Lista e goală</b></div>` : ''}
    ${!active.length && cart.length ? `<div class="banner" style="margin-top:12px"><b>Gata, ai luat tot! 🎉</b>Golește coșul când ajungi acasă.</div>` : ''}
    ${groups.map(g => `<div class="sec-title">${aisleIcon(g)} ${esc(g)} · ${by[g].length}</div>
      <div class="group">${sortManual(by[g]).map(e => rowHtml(e, { showGroup: false, reorder: 'shop' })).join('')}</div>`).join('')}
    ${cart.length ? `<div class="sl-head" style="margin-top:26px"><span>🛒 În coș · ${cart.length}</span><button data-act="cart-clear" data-id="${c.id}">Golește coșul</button></div>
      <div class="group">${cart.map(e => rowHtml(e, { showGroup: false })).join('')}</div>` : ''}
    `;
}

// ---------- month calendar to pick several days (reminder "Zile alese din calendar") ----------
function calPickerHtml(d) {
  const [y, m] = (d.calMonth || dkey(new Date()).slice(0, 7)).split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;            // Monday first
  const daysIn = new Date(y, m, 0).getDate();
  const today = startOfDay(new Date());
  const thisMonth = today.getFullYear() === y && today.getMonth() === m - 1;
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span></span>';
  for (let day = 1; day <= daysIn; day++) {
    const k = `${y}-${pad(m)}-${pad(day)}`;
    const date = new Date(y, m - 1, day);
    const past = date < today;
    const on = d.repDates.includes(k);
    cells += `<button class="${on ? 'on' : ''} ${sameDay(date, today) ? 'today' : ''}" ${past ? 'disabled' : `data-act="cal-day" data-v="${k}"`}>${day}</button>`;
  }
  const title = cap(new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(first));
  return `<div class="calpick">
    <div class="cal-head"><button data-act="cal-nav" data-v="-1" ${thisMonth ? 'disabled' : ''}>${ICON.back}</button><b>${esc(title)}</b><button data-act="cal-nav" data-v="1"><span style="display:inline-block;transform:scaleX(-1)">${ICON.back}</span></button></div>
    <div class="cal-grid cal-wd">${['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map(w => `<span>${w}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    ${d.repDates.length ? `<div class="cal-foot"><span>${d.repDates.length} ${d.repDates.length === 1 ? 'zi aleasă' : 'zile alese'}</span><button data-act="cal-clear">Șterge alegerea</button></div>` : ''}
  </div>`;
}

// ---------- medicines ----------
// Each medicine is one treatment: dose, times of day, which days, start date and how long
// (a number of days, until a date, or forever). Doses taken are logged per day.
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOf = s => parseLocal((s || dkey(new Date())) + 'T00:00');
const WD_SHORT = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];   // full names: no abbreviations in the app
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
// ---------- missed doses: what you didn't check in the past days ----------
function doseState(e, day, t) {
  const k = dkey(day);
  if ((e.med.taken?.[k] || []).includes(t)) return 'taken';
  if ((e.med.skipped?.[k] || []).includes(t)) return 'skipped';
  return 'missed';
}
// set one dose of one day: 'taken' | 'skipped' | 'missed' (= not checked)
function setDose(eid, k, t, state) {
  const e = entryById(eid);
  if (!e?.med) return;
  const m = e.med;
  m.taken ||= {}; m.skipped ||= {};
  for (const o of [m.taken, m.skipped]) if (o[k]) { o[k] = o[k].filter(x => x !== t); if (!o[k].length) delete o[k]; }
  if (state === 'taken') (m.taken[k] ||= []).push(t);
  if (state === 'skipped') (m.skipped[k] ||= []).push(t);
  save();
}
// doses of the last `back` days (not today) that are neither taken nor skipped
function missedDoses(back = 7) {
  const today = startOfDay(new Date());
  const out = [];
  for (const e of db.entries) {
    if (!e.med || !isMedCat(catById(e.cat)) || e.done) continue;
    const added = startOfDay(new Date(e.createdAt || 0));
    for (let i = 1; i <= back; i++) {
      const day = addDays(today, -i);
      if (day < added || !medOnDay(e, day)) continue;
      for (const t of e.med.times) if (doseState(e, day, t) === 'missed') out.push({ e, day, t });
    }
  }
  return out.sort((a, b) => b.day - a.day || a.t.localeCompare(b.t));
}
function missedDosesHtml() {
  const list = missedDoses();
  if (!list.length) return '';
  const n = list.length;
  return `<div class="missedcard">
    <div class="mc-head">⚠️ ${n === 1 ? 'Ai uitat o doză' : `Ai uitat ${n} doze`}</div>
    ${list.slice(0, 10).map(x => `<div class="mrow">
      <div class="mrow-t"><b>💊 ${esc(x.e.title)}</b><span>${esc(fmtDay(x.day))} · ${esc(x.t)}${x.e.med.dose ? ' · ' + esc(x.e.med.dose) : ''}</span></div>
      <button class="mbtn ok" data-act="dose-set" data-id="${x.e.id}" data-k="${dkey(x.day)}" data-t="${x.t}" data-s="taken">Am luat-o</button>
      <button class="mbtn" data-act="dose-set" data-id="${x.e.id}" data-k="${dkey(x.day)}" data-t="${x.t}" data-s="skipped">Am sărit-o</button></div>`).join('')}
    ${n > 10 ? `<div class="mc-sub" style="margin-top:6px">+ încă ${n - 10}</div>` : ''}
    ${n > 1 ? `<button class="mc-all" data-act="dose-skipall">Le-am sărit pe toate</button>` : ''}
  </div>`;
}

// history of one medicine: a month calendar coloured by how the day went; tap a day to fix its doses
function medDayStatus(e, day) {
  if (!medOnDay(e, day)) return 'off';
  const today = startOfDay(new Date());
  if (day > today) return 'future';
  const states = e.med.times.map(t => doseState(e, day, t));
  const now = new Date();
  // today: doses whose time hasn't come yet don't count as missed
  const due = sameDay(day, today) ? e.med.times.filter(t => { const [h, m] = t.split(':').map(Number); return atTime(day, h, m) <= now; }) : e.med.times;
  if (!due.length) return 'future';
  if (states.every(s => s === 'taken')) return 'ok';
  if (states.every(s => s === 'skipped')) return 'skip';
  if (states.some(s => s === 'taken')) return 'part';
  return sameDay(day, today) ? 'part' : 'bad';
}
function medHistoryHtml(e) {
  const s = ui.sheet;
  const [y, m] = (s.histMonth || dkey(new Date()).slice(0, 7)).split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysIn = new Date(y, m, 0).getDate();
  const today = startOfDay(new Date());
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span></span>';
  for (let dd = 1; dd <= daysIn; dd++) {
    const day = new Date(y, m - 1, dd);
    const st = medDayStatus(e, day);
    const k = dkey(day);
    cells += `<button class="mh-${st} ${s.histDay === k ? 'sel' : ''} ${sameDay(day, today) ? 'today' : ''}" ${st === 'off' || st === 'future' ? 'disabled' : `data-act="mh-day" data-v="${k}"`}>${dd}</button>`;
  }
  let detail = '';
  if (s.histDay) {
    const day = dayOf(s.histDay);
    detail = `<div class="mh-detail"><div class="mh-dtitle">${esc(cap(fLong.format(day)))}</div>
      ${e.med.times.map(t => {
        const st = doseState(e, day, t);
        const b = (state, label) => `<button class="${st === state ? 'on' : ''}" data-act="dose-set" data-id="${e.id}" data-k="${s.histDay}" data-t="${t}" data-s="${state}">${label}</button>`;
        return `<div class="mh-dose"><b>${t}</b><div class="mh-seg">${b('taken', '✓ Luată')}${b('skipped', 'Sărită')}${b('missed', 'Neluată')}</div></div>`;
      }).join('')}</div>`;
  }
  const title = cap(new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(first));
  return `<div class="fhead">Istoric</div>
    <div class="form"><div class="fieldcol"><div class="calpick">
      <div class="cal-head"><button data-act="mh-nav" data-v="-1">${ICON.back}</button><b>${esc(title)}</b><button data-act="mh-nav" data-v="1"><span style="display:inline-block;transform:scaleX(-1)">${ICON.back}</span></button></div>
      <div class="cal-grid cal-wd">${['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map(w => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid mh-grid">${cells}</div>
      <div class="mh-legend"><span class="ok">luat tot</span><span class="part">parțial</span><span class="bad">uitat</span><span class="skip">sărit</span></div>
      ${detail}
    </div></div></div>
    `;
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
    ${missedDosesHtml()}
    ${doses.length ? `
      <div class="medtoday" style="--c:${col}">
        <div><div class="mt-l">Azi</div><div class="mt-v">${takenN} din ${doses.length} luate</div></div>
        <div class="mt-bar"><span style="width:${Math.round(takenN / doses.length * 100)}%"></span></div>
      </div>
      ${doseRowsHtml(doses, today)}` : meds.length ? `<div class="banner" style="margin-top:6px"><b>Azi nu ai nimic de luat ✓</b></div>` : ''}
    ${!meds.length ? `<div class="empty"><div class="big">💊</div><b>Niciun medicament încă</b></div>` : ''}
    ${sec('Tratamente în curs', groups.active)}
    ${sec('Urmează', groups.future)}
    ${sec('Terminate', groups.finished)}
    ${sec('Oprite', groups.stopped)}
    `;
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
      until: m.until || dkey(today),   // "Până la" opens on today's date, not a month ahead
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
        <div class="field"><input type="text" data-bind="m.dose" placeholder="Doza (ex. 1 pastilă)" value="${esc(d.dose)}"></div>
        <div class="field"><input type="text" data-bind="details" placeholder="Notă (ex. după masă)" value="${esc(d.details)}"></div>
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
          <button class="${d.durType === 'days' ? 'on' : ''}" data-act="m-dur" data-v="days">Număr de zile</button>
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

      ${!isNew && entryById(d.id) ? medHistoryHtml(entryById(d.id)) : ''}
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

// every medicine dose you checked as taken, from `start` on: { e, t, date }
function doseEvents(start) {
  const out = [];
  for (const e of db.entries) {
    if (!e.med || !catById(e.cat)) continue;
    for (const [k, arr] of Object.entries(e.med.taken || {})) {
      const day = dayOf(k);
      if (!day || day < startOfDay(start)) continue;
      for (const t of arr) { const [h, m] = t.split(':').map(Number); out.push({ e, t, date: atTime(day, h, m) }); }
    }
  }
  return out.sort((a, b) => b.date - a.date);
}
function doseRowHtml(x) {
  return `<div class="row" data-act="open" data-id="${x.e.id}">
    <div class="medico" style="--c:${colorOf(catById(x.e.cat))}">💊</div>
    <div class="rbody"><div class="rtitle">${esc(x.e.title)}</div><div class="chips">${x.e.med.dose ? chip(x.e.med.dose, 'var(--muted)') : ''}${chip('✓ luată', 'var(--green)')}</div></div>
    <div class="dtime" style="color:var(--muted);text-align:right">${x.t}<div style="font-size:12px;font-weight:600">${esc(fmtDay(x.date))}</div></div></div>`;
}

function generalStatsHtml() {
  const s = ui.stats;
  const entries = db.entries.filter(e => catById(e.cat));
  if (!entries.length) return `<div class="empty"><div class="big">📊</div><b>Încă nu sunt date</b></div>`;
  const { months, start } = rangeOf(s, entries.map(e => e.createdAt));
  const active = entries.filter(e => !e.done && !e.med);
  const overdueNow = active.filter(e => isOverdue(e) || reminderMissed(e)).length;
  const done = entries.filter(e => e.done && !e.med && e.doneAt && e.doneAt >= +start);
  const doses = doseEvents(start);            // medicine doses checked as taken count as "bifate" too
  const added = entries.filter(e => e.createdAt >= +start);
  const withDl = done.filter(e => e.hasDeadline && parseLocal(e.deadline));
  const onTime = withDl.filter(e => {
    const d = parseLocal(e.deadline);
    return e.doneAt <= +(e.deadlineTime ? d : addDays(startOfDay(d), 1));
  }).length;
  const rate = withDl.length ? Math.round((onTime / withDl.length) * 100) + '%' : '–';

  const metric = s.act || 'done';
  const src = metric === 'done' ? [...done.map(e => new Date(e.doneAt)), ...doses.map(x => x.date)] : added.map(e => new Date(e.createdAt));
  const buckets = monthBuckets(months, start);
  const byKey = Object.fromEntries(buckets.map(b => [b.key, b]));
  src.forEach(d => { const b = byKey[monthKey(d)]; if (b) b.n++; });
  const sel = byKey[s.sel] || buckets[buckets.length - 1];

  // per list
  const per = cats().map(c => ({ c, n: done.filter(e => e.cat === c.id).length + doses.filter(x => x.e.cat === c.id).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
  const pmax = per.length ? per[0].n : 0;
  // best weekday
  const wd = [0, 0, 0, 0, 0, 0, 0];
  done.forEach(e => { wd[new Date(e.doneAt).getDay()]++; });
  doses.forEach(x => { wd[x.date.getDay()]++; });
  const best = Math.max(...wd);
  // reminders
  const rem = entries.filter(e => e.hasReminder);
  const remUpcoming = rem.filter(e => !e.done && !reminderMissed(e)).length;
  const remMissed = rem.filter(reminderMissed).length;
  const remRepeat = rem.filter(e => !e.done && e.repeat && e.repeat !== 'none').length;

  return `
    <div class="tiles">
      ${tile('Active acum', active.length, 'var(--accent)', 'st-active')}
      ${tile('Întârziate acum', overdueNow, overdueNow ? 'var(--red)' : 'var(--muted)', 'st-overdue')}
      ${tile('Bifate', done.length + doses.length, 'var(--green)', 'st-done')}
      ${tile('Gata la timp', rate, 'var(--blue)', 'st-ontime')}
    </div>
    <div class="segin" style="margin-top:20px">
      <button class="${metric === 'done' ? 'on' : ''}" data-act="stat-metric" data-v="done">✓ Bifate</button>
      <button class="${metric === 'added' ? 'on' : ''}" data-act="stat-metric" data-v="added">＋ Adăugate</button>
    </div>
    <div class="form chart">
      <div class="readout"><b>${esc(cap(fMonthLong.format(sel.d)))}</b><span>${nItems(sel.n)}</span></div>
      <div class="bars">${barsHtml(buckets, sel.key, metric === 'done' ? '#2EB87A' : '#7C5CFA', 'stat-sel', b => b.n)}</div>
    </div>
    <div class="ffoot">${metric === 'done' ? 'Câte ai bifat' : 'Câte ai adăugat'} în fiecare lună. Apasă sau glisează peste luni ca să vezi ce e în ele.</div>
    ${monthListHtml(sel,
      (metric === 'done' ? done.filter(e => monthKey(new Date(e.doneAt)) === sel.key) : added.filter(e => monthKey(new Date(e.createdAt)) === sel.key)).filter(e => !e.med),
      metric === 'done' ? 'Bifate' : 'Adăugate',
      metric === 'done' ? doses.filter(x => monthKey(x.date) === sel.key) : [])}
    ${per.length ? `<div class="fhead">Bifate pe liste</div><div class="form">${per.map(x => hbarRow(`${x.c.icon} ${esc(x.c.name)}`, x.n, pmax ? x.n / pmax : 0, colorOf(x.c), '')).join('')}</div>` : ''}
    <div class="fhead">Remindere</div>
    <div class="tiles three">
      ${tile('Programate', remUpcoming, 'var(--pink)', 'st-remup')}
      ${tile('Ratate', remMissed, remMissed ? 'var(--red)' : 'var(--muted)', 'st-remmiss')}
      ${tile('Repetate', remRepeat, 'var(--purple)', 'st-remrep')}
    </div>
    ${best ? `<div class="fhead">Pe scurt</div><div class="form">
      <div class="field"><span class="lbl">Ziua în care bifezi cel mai mult</span><b>${cap(WEEKDAYS[wd.indexOf(best)])}</b></div>
      <div class="field"><span class="lbl">Adăugate în perioadă</span><b>${added.length}</b></div>
      ${doses.length ? `<div class="field"><span class="lbl">Doze de medicamente luate</span><b>${doses.length}</b></div>` : ''}
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
    ${mainHead('Statistici', '')}
    <div class="seg" style="margin-top:0">${views.map(([k, l]) => `<button class="${s.view === k ? 'on' : ''}" data-act="stat-view" data-v="${k}">${l}</button>`).join('')}</div>
    ${s.view !== 'liste' ? `<div class="segin" style="margin:12px 0 14px">${[['6', '6 luni'], ['12', '12 luni'], ['all', 'Tot']].map(([k, l]) => `<button class="${s.range === k ? 'on' : ''}" data-act="stat-range" data-v="${k}">${l}</button>`).join('')}</div>` : '<div style="height:14px"></div>'}
    ${body}`;
}

// items of the selected month, under a chart: one row per list (with how many), tap to expand it
const accOpen = new Set();
function monthListHtml(sel, items, word, doses = []) {
  const month = cap(fMonthLong.format(sel.d));
  const total = items.length + doses.length;
  if (!total) return `<div class="fhead">${esc(month)}</div><div class="footnote" style="margin-top:0">Nimic în luna asta.</div>`;
  const blocks = cats().map(c => {
    const list = items.filter(e => e.cat === c.id);
    const ds = doses.filter(x => x.e.cat === c.id);
    const n = list.length + ds.length;
    if (!n) return '';
    const key = `${sel.key}:${c.id}`;
    const count = ds.length && !list.length ? `${ds.length} ${ds.length === 1 ? 'doză' : 'doze'}` : n;
    return `<div class="acc ${accOpen.has(key) ? 'open' : ''}">
      <button class="acc-head" data-act="acc" data-k="${key}">
        <span class="caticon" style="--c:${colorOf(c)};width:32px;height:32px;font-size:17px;border-radius:9px">${c.icon}</span>
        <span class="acc-name">${esc(c.name)}</span><b class="acc-n" style="--c:${colorOf(c)}">${count}</b><span class="acc-chev">${ICON.chev}</span>
      </button>
      <div class="acc-body"><div class="acc-inner">${sortEntries(list).map(e => rowHtml(e, {})).join('')}${ds.map(doseRowHtml).join('')}</div></div>
    </div>`;
  }).join('');
  return `<div class="fhead">${esc(word)} în ${esc(month.toLowerCase())} · ${nItems(total)}</div><div class="group accs">${blocks}</div>
    <div class="footnote">Apasă pe o listă ca s-o desfaci.</div>`;
}

// tiles in "Statistici" that open the matching items (shown in the search view, with a ✕ to go back)
function statStart() { return rangeOf(ui.stats, db.entries.map(e => e.createdAt)).start; }
function moneyStart() { return rangeOf(ui.stats, moneyItems().map(x => +x.date)).start; }
const STAT_FILTERS = {
  'st-active': { label: 'Active acum', items: () => db.entries.filter(e => !e.done && !e.med && catById(e.cat)) },
  'st-overdue': { label: 'Întârziate acum', items: () => db.entries.filter(e => !e.done && !e.med && (isOverdue(e) || reminderMissed(e))) },
  'st-done': { label: 'Bifate în perioadă', items: () => {
    const st = statStart();
    const meds = [...new Set(doseEvents(st).map(x => x.e))];
    return [...db.entries.filter(e => e.done && !e.med && e.doneAt >= +st), ...meds];
  } },
  'st-ontime': { label: 'Cu termen, bifate', items: () => db.entries.filter(e => e.done && !e.med && e.hasDeadline && e.doneAt >= +statStart()) },
  'st-remup': { label: 'Remindere programate', items: () => db.entries.filter(e => e.hasReminder && !e.done && !reminderMissed(e)) },
  'st-remmiss': { label: 'Remindere ratate', items: () => db.entries.filter(reminderMissed) },
  'st-remrep': { label: 'Remindere repetate', items: () => db.entries.filter(e => e.hasReminder && !e.done && e.repeat && e.repeat !== 'none') },
  'mo-spent': { label: 'Cheltuit', items: () => moneyItems().filter(x => x.flow === 'spent' && x.date >= moneyStart()).map(x => x.e) },
  'mo-received': { label: 'Primit', items: () => moneyItems().filter(x => x.flow === 'received' && x.date >= moneyStart()).map(x => x.e) },
  'mo-all': { label: 'Tranzacții', items: () => moneyItems().filter(x => (x.flow === 'spent' || x.flow === 'received') && x.date >= moneyStart()).map(x => x.e) },
  'mo-topay': { label: 'De plătit', items: () => moneyItems().filter(x => x.flow === 'toPay').map(x => x.e) },
  'mo-toreceive': { label: 'De primit', items: () => moneyItems().filter(x => x.flow === 'toReceive').map(x => x.e) },
};

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
      ${!all.length ? `<div class="empty"><div class="big">💰</div><b>Încă nu sunt sume</b></div>` : `
      <div class="tiles">
        ${tile('Cheltuit', totals(pairs(spent)), 'var(--red)', 'mo-spent')}
        ${tile('Primit', totals(pairs(received)), 'var(--green)', 'mo-received')}
      </div>
      <div class="tiles" style="margin-top:10px">
        ${tile('Diferență', (diff > 0 ? '+' : diff < 0 ? '−' : '') + money(Math.abs(diff), cur), diff >= 0 ? 'var(--green)' : 'var(--red)')}
        ${tile('Tranzacții', spent.length + received.length, 'var(--blue)', 'mo-all')}
      </div>
      <div class="fhead">Încă în așteptare (acum)</div>
      <div class="tiles">
        ${tile('De plătit', totals(pairs(toPay)), 'var(--orange)', 'mo-topay')}
        ${tile('De primit', totals(pairs(toReceive)), 'var(--purple)', 'mo-toreceive')}
      </div>

      <div class="segin" style="margin-top:20px">
        <button class="${metric === 'spent' ? 'on' : ''}" data-act="money-metric" data-v="spent">↗ Cheltuit</button>
        <button class="${metric === 'received' ? 'on' : ''}" data-act="money-metric" data-v="received">↙ Primit</button>
      </div>
      <div class="form chart">
        <div class="readout"><b>${esc(cap(fMonthLong.format(sel.d)))}</b><span>${esc(money(sel.sum, cur))} · ${nItems(sel.n)}</span></div>
        <div class="bars">${bars}</div>
      </div>
      <div class="ffoot">${word} pe luni, în ${esc(cur)}. Apasă sau glisează peste luni ca să vezi ce e în ele.${other.length ? ` Sumele în altă monedă (${esc(totals(pairs(other)))}) nu apar în grafic.` : ''}</div>
      ${monthListHtml(sel, metricItems.filter(x => monthKey(x.date) === sel.key).map(x => x.e), word)}

      ${lists.length ? `<div class="fhead">${word} pe liste</div><div class="form">${lists.map(l => hbar(`${l.c.icon} ${esc(l.c.name)}`, l.sum, lmax, colorOf(l.c), nItems(l.n))).join('')}</div>` : ''}
      ${vendors.length ? `<div class="fhead">${metric === 'spent' ? 'Cui ai plătit cel mai mult' : 'De la cine ai primit cel mai mult'}</div><div class="form">${vendors.map(([n, v]) => hbar(esc(n), v.sum, vmax, color, nItems(v.n))).join('')}</div>` : ''}
      <div class="ffoot" style="margin-top:14px">Cheltuit = plăți achitate și comenzi marcate „Plătit”. Primit = sumele „de primit” bifate. Data folosită: scadența (la plăți) sau ziua adăugării.</div>`}`;
}

// ---------- action sheet ----------
function openActions(title, actions, opts = {}) {
  ui.sheet = { type: 'actions', title, actions, grid: !!opts.grid, seg: opts.seg || null };
  renderSheet();
}
function actionsHtml() {
  const { title, actions, grid, seg } = ui.sheet;
  // long lists scroll inside the sheet; "grid" = two columns of tiles (e.g. choosing a store aisle)
  return `<div class="overlay" data-act="sheet-close"></div>
    <div class="asheet">
      <div class="agroup ascroll ${grid ? 'agrid' : ''}">${title ? `<div class="atitle">${esc(title)}</div>` : ''}
        ${seg ? `<div class="aseg"><div class="aseg-l">${esc(seg.label)}</div><div class="seg">${seg.options.map((o, i) => `<button class="${o.selected ? 'on' : ''}" data-act="aseg" data-i="${i}">${esc(o.label)}</button>`).join('')}</div></div>` : ''}
        <div class="aitems">${actions.map((a, i) => `<button class="${a.danger ? 'danger' : ''} ${a.selected ? 'sel' : ''}" data-act="action" data-i="${i}">${grid && a.icon
          ? `<span class="ag-ico">${a.icon}</span><span class="ag-lbl">${esc(a.label)}</span>` : esc(a.label)}</button>`).join('')}</div></div>
      <div class="agroup"><button class="cancel" data-act="sheet-close">Renunță</button></div></div>`;
}

function renderSheet() {
  const el = document.getElementById('sheet');
  if (!ui.sheet) { el.innerHTML = ''; document.body.style.overflow = ''; return; }
  ui.pendingRerender = false;
  const body = el.querySelector('.panel-body');
  const scroll = body ? body.scrollTop : 0;
  const t = ui.sheet.type;
  el.innerHTML = t === 'trash' ? trashSheetHtml() : t === 'entry' ? entrySheetHtml() : t === 'category' ? categorySheetHtml() : t === 'stats' ? statsHtml()
    : t === 'search' ? searchSheetHtml() : t === 'med' ? medSheetHtml() : t === 'myprod' ? myProductsSheetHtml()
    : t.startsWith('trip') ? tripSheetHtml(t) : actionsHtml();
  const nb = el.querySelector('.panel-body');
  if (nb) nb.scrollTop = scroll;
  // no slide animation on re-render
  if (body) el.querySelectorAll('.panel, .overlay').forEach(x => (x.style.animation = 'none'));
  document.body.style.overflow = 'hidden';
  initSegs(el);
  glueHyphens(el);
  if (typeof tripAfterRender === 'function') tripAfterRender();
}
function closeSheet() { ui.sheet = null; ui.pendingRerender = false; renderSheet(); render(); }

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = String(msg).replace(GLUE_RE, '$1‑');
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
    case 'dose-set':
      setDose(id, el.dataset.k, el.dataset.t, el.dataset.s);
      try { navigator.vibrate?.(8); } catch (err) { /* ignore */ }
      toast(el.dataset.s === 'taken' ? 'Bifat ca luată ✓' : el.dataset.s === 'skipped' ? 'Marcat ca sărită' : 'Debifat');
      if (s?.type === 'med') renderSheet(); else render();
      break;
    case 'dose-skipall': {
      const list = missedDoses();
      openActions(`Marchezi ca sărite toate cele ${list.length} doze uitate?`, [{ label: 'Le-am sărit pe toate', run: () => {
        list.forEach(x => setDose(x.e.id, dkey(x.day), x.t, 'skipped')); render(); toast('Gata');
      } }]);
      break;
    }
    case 'mh-day': s.histDay = el.dataset.v; renderSheet(); break;
    case 'mh-nav': {
      const [y, m] = (s.histMonth || dkey(new Date()).slice(0, 7)).split('-').map(Number);
      const nd = new Date(y, m - 1 + +el.dataset.v, 1);
      s.histMonth = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`; renderSheet(); break;
    }
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
    case 'm-dur':
      s.d.durType = el.dataset.v;
      // "Până la" never starts before the start day
      if (s.d.durType === 'until' && s.d.until < s.d.start) s.d.until = s.d.start;
      renderSheet(); break;
    case 'm-days': s.d.days = Math.max(1, Math.min(3650, (+s.d.days || 1) + +el.dataset.v)); renderSheet(); break;
    case 'm-daysset': s.d.days = +el.dataset.v; renderSheet(); break;
    case 'search-cat': if (ui.searching && ui.searchQ) addRecent(ui.searchQ); ui.searching = false; ui.searchQ = ''; ui.searchFilter = null; ui.sheet = null; renderSheet(); ui.tab = 'lists'; ui.catId = id; ui.filter = 'active'; ui.search = ''; render(); scroller().scrollTo(0, 0); break;
    case 'open': { const e = entryById(id); if (ui.searching && ui.searchQ) addRecent(ui.searchQ); if (e) openEntry(e.cat, e.id); break; }
    case 'search-cancel': exitSearch(); break;
    case 'acc': {
      // expand / collapse a list inside the month view (animated, no re-render)
      const box = el.closest('.acc');
      const k = el.dataset.k;
      if (box.classList.toggle('open')) accOpen.add(k); else accOpen.delete(k);
      break;
    }
    // shopping list
    case 'qa-add': {
      const inp = document.getElementById('quickadd');
      const c = catById(id);
      if (c && inp && shopAdd(c, inp.value)) { render(); document.getElementById('quickadd')?.focus(); }
      break;
    }
    case 'qty-minus': case 'qty-plus': {
      // − / + on a shopping row
      const e = entryById(id);
      if (!e) break;
      const step = qtyStep(e.unit || 'buc');
      const cur = +e.qty || 1;
      const next = Math.round((act === 'qty-plus' ? cur + step : cur - step) * 100) / 100;
      if (next <= 0) { toast('Glisează spre dreapta ca să-l ștergi'); break; }
      e.qty = next; e.unit = e.unit || 'buc';
      try { navigator.vibrate?.(6); } catch (err) { /* ignore */ }
      save(); render();
      break;
    }
    case 'qa-pick': {
      const c = catById(id);
      if (c && shopAdd(c, el.dataset.v, el.dataset.g, document.getElementById('quickadd')?.value)) {
        render();
        toast(`${el.dataset.v} → ${el.dataset.g}`);
        document.getElementById('quickadd')?.focus();
      }
      break;
    }
    case 'qa-pickaisle': {
      const c = catById(id); const name = el.dataset.v;
      openActions('Raion', aisles().map(a => ({
        label: a[0], icon: a[1],
        run: () => { learnProduct(name, a[0]); if (c && shopAdd(c, name, a[0])) { render(); toast(`${name} → ${a[0]}`); } },
      })), { grid: true });
      break;
    }
    case 'my-products': ui.sheet = { type: 'myprod', name: '', aisle: 'Altele' }; renderSheet(); break;
    case 'mp-add': {
      const n = document.getElementById('mp-name')?.value.trim();
      const a = document.getElementById('mp-aisle')?.value;
      if (!n) { toast('Scrie numele produsului'); break; }
      learnProduct(n, a); s.name = ''; s.aisle = a; renderSheet(); toast(`${n} → ${a}`);
      break;
    }
    case 'mp-del': delete myProducts()[el.dataset.v]; save(); renderSheet(); break;
    case 'ma-icon': s.aname = document.getElementById('ma-name')?.value || ''; s.name = document.getElementById('mp-name')?.value || ''; s.aicon = el.dataset.v; renderSheet(); break;
    case 'ma-add': {
      const n = (document.getElementById('ma-name')?.value || '').trim();
      if (!n) { toast('Scrie numele raionului'); break; }
      const name = n.charAt(0).toUpperCase() + n.slice(1);
      if (aisles().some(a => normText(a[0]) === normText(name))) { toast(`Raionul „${name}” există deja`); break; }
      ((db.settings ||= {}).myAisles ||= []).push({ name, icon: s.aicon || '🏷️' });
      save(); s.aname = ''; s.aicon = ''; s.aisle = name; s.name = document.getElementById('mp-name')?.value || '';
      renderSheet(); toast(`Raionul „${name}” e gata`);
      break;
    }
    case 'ma-del': {
      const name = el.dataset.v;
      const n = db.entries.filter(e => e.group === name && isShopCat(catById(e.cat))).length;
      openActions(`Ștergi raionul „${name}”?${n === 1 ? ' Produsul din el trece la „Altele”.' : n ? ` Cele ${n} produse din el trec la „Altele”.` : ''} Nu se poate anula.`, [
        { label: '🗑 Șterge raionul', danger: true, run: () => {
          db.settings.myAisles = (db.settings.myAisles || []).filter(a => a.name !== name);
          db.entries.forEach(e => { if (e.group === name && isShopCat(catById(e.cat))) e.group = 'Altele'; });
          Object.values(myProducts()).forEach(p => { if (p.aisle === name) p.aisle = 'Altele'; });
          save(); ui.sheet = { type: 'myprod', name: '', aisle: 'Altele' }; renderSheet(); render();
        } },
      ]);
      break;
    }
    case 'qa-again': { const c = catById(id); if (c && shopAdd(c, el.dataset.v)) { render(); toast(`${el.dataset.v} adăugat`); } break; }
    case 'cart-clear': {
      const c = catById(id);
      const n = db.entries.filter(e => e.cat === id && e.done).length;
      openActions(n === 1 ? 'Scoți din listă produsul din coș?' : `Scoți din listă cele ${n} produse din coș?`, [
        { label: '🛒 Golește coșul', danger: true, run: () => { db.entries = db.entries.filter(e => !(e.cat === id && e.done)); save(); render(); toast('Coșul e gol'); } },
      ]);
      break;
    }
    case 'tile-filter': ui.searchFilter = el.dataset.f; ui.searchQ = ''; ui.searching = true; render(); scroller().scrollTo(0, 0); break;
    case 'sugg': {
      ui.searchFilter = el.dataset.v; ui.searchQ = '';
      const inp = document.getElementById('gsearch'); if (inp) { inp.value = ''; inp.blur(); }
      updateSearchLayer(); break;
    }
    case 'filter-clear':
      // a filter opened from a Statistici tile → ✕ goes straight back to the stats
      if (STAT_FILTERS[ui.searchFilter]) { exitSearch(); render(); }
      else { ui.searchFilter = null; updateSearchLayer(); }
      break;
    case 'recent': {
      ui.searchQ = el.dataset.v; ui.searchFilter = null; addRecent(ui.searchQ);
      const inp = document.getElementById('gsearch'); if (inp) inp.value = ui.searchQ;
      updateSearchLayer(); break;
    }
    case 'recent-del': recents().splice(+el.dataset.i, 1); save(); updateSearchLayer(); break;
    case 'recent-clear': (db.settings ||= {}).recent = []; save(); updateSearchLayer(); break;
    case 'toggle': { const e = entryById(id); if (e) askThenToggle(e); break; }
    case 'undo': undoDone(id); break;
    case 'stats': openStats(id); break;
    case 'money-metric': ui.stats.metric = el.dataset.v; render(); break;
    case 'money-sel': case 'stat-sel': ui.stats.sel = el.dataset.k; render(); break;
    case 'stat-view': ui.stats.view = el.dataset.v; ui.stats.sel = monthKey(new Date()); render(); scroller().scrollTo(0, 0); break;
    case 'stat-range': ui.stats.range = el.dataset.v; ui.stats.sel = monthKey(new Date()); render(); break;
    case 'stat-metric': ui.stats.act = el.dataset.v; render(); break;
    case 'swipe-del': closeSwipe(); confirmSwipeDelete(el.dataset.kind, id); break;
    case 'swipe-set': closeSwipe(); openCategory(id); break;
    case 'stats-range': s.range = el.dataset.v; s.sel = monthKey(new Date()); renderSheet(); break;
    case 'stats-sel': s.sel = el.dataset.k; renderSheet(); break;
    case 'set-confirm': db.settings = { ...(db.settings || {}), confirmCheck: !db.settings?.confirmCheck }; save(); render(); break;
    case 'sub': { const e = entryById(id); if (e) { toggleSub(e, el.dataset.sid); render(); } break; }
    case 'alarm': { const e = entryById(id); if (e) addAlarm(e); break; }
    case 'open-cat': ui.trip = null; ui.catId = id; ui.filter = 'active'; ui.search = ''; ui.tileF = null; render(); scroller().scrollTo(0, 0); break;
    case 'back':
      if (ui.trip) { ui.trip = null; render(); scroller().scrollTo(0, 0); break; }   // from a trip back to the list of trips
      ui.catId = null; render(); scroller().scrollTo(0, 0); break;
    case 'new': openEntry(id); break;
    case 'new-pick': {
      const list = el.dataset.rem ? cats().filter(c => c.reminderMode !== 'off').sort((a, b) => (b.reminderMode === 'always') - (a.reminderMode === 'always')) : cats();
      if (list.length === 1) openEntry(list[0].id);
      else openActions('Adaugă în…', list.map(c => ({ label: `${c.icon}  ${c.name}`, run: () => openEntry(c.id) })));
      break;
    }
    case 'filter': ui.filter = el.dataset.f; ui.tileF = null; render(); break;
    case 'trash-open': ui.sheet = { type: 'trash' }; renderSheet(); break;
    case 'trash-restore': restoreEntry(el.dataset.v); renderSheet(); render(); break;
    case 'trash-empty':
      openActions('Golești definitiv lista „Șterse recent”? Nu se poate anula.', [
        { label: '🗑 Golește definitiv', danger: true, run: () => { db.trash = []; save(); ui.sheet = { type: 'trash' }; renderSheet(); render(); } },
      ]);
      break;
    case 'list-wipe': {
      const c = catById(id), all = el.dataset.v === 'all';
      const list = db.entries.filter(e => e.cat === id && (all || e.done));
      if (!c || !list.length) break;
      const n = list.length;
      openActions(all ? (n === 1 ? `Ștergi elementul din ${c.name}?` : `Ștergi toate cele ${n} elemente din ${c.name}?`)
        : (n === 1 ? `Ștergi elementul bifat din ${c.name}?` : `Ștergi cele ${n} elemente bifate din ${c.name}?`), [
        { label: all ? '🗑 Șterge tot' : '🗑 Șterge bifatele', danger: true, run: () => { deleteEntries(list.map(e => e.id)); render(); toast(n === 1 ? 'Șters' : `${n} elemente șterse`); } },
      ]);
      break;
    }
    case 'today-f': ui.todayF = ui.todayF === el.dataset.k ? null : el.dataset.k; render(); break;
    case 'list-f': ui.tileF = ui.tileF === el.dataset.k ? null : el.dataset.k; render(); break;
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
        .map(([k, v]) => ({ label: v, selected: c.groupMode === k, run: () => { c.groupMode = k; save(); render(); } }));
      openActions(c.name, [
        ...(isShopCat(c) ? [{ label: '🏷️ Produsele mele', run: () => { ui.sheet = { type: 'myprod', name: '', aisle: 'Altele' }; renderSheet(); } }] : []),
        { label: '⚙️ Reguli listă', run: () => openCategory(c.id) },
        { label: 'Șterge bifatele', danger: true, run: () => {
          const n = db.entries.filter(e => e.cat === c.id && e.done).length;
          if (!n) { toast('Nu ai nimic bifat aici'); return; }
          if (confirm(n === 1 ? `Ștergi elementul bifat din ${c.name}?` : `Ștergi cele ${n} elemente bifate din ${c.name}?`)) { deleteEntries(db.entries.filter(e => e.cat === c.id && e.done).map(e => e.id)); render(); }
        } },
      ], { seg: { label: 'Grupare', options: gm } });
      break;
    }
    case 'aseg': { const o = s?.seg?.options?.[+el.dataset.i]; if (o) { o.run(); s.seg.options.forEach(x => { x.selected = x === o; }); renderSheet(); } break; }
    case 'action': { const a = s?.actions?.[+el.dataset.i]; ui.sheet = null; renderSheet(); render(); a?.run(); break; }
    case 'sheet-close':
      if (s?.type === 'tripfile' && s.back) { ui.sheet = s.back; renderSheet(); break; }   // ticket viewer → back to the item
      closeSheet(); break;
    case 'export': exportData(); break;
    case 'theme': applyTheme(el.dataset.v); render(); break;
    case 'set-pack': ui.sheet = { type: 'trippack' }; renderSheet(); break;
    case 'wipe-all':
      openActions('Ștergi toate listele și toate datele din MindMe? Nu se poate anula. Fă înainte un backup dacă vrei să le păstrezi.', [
        { label: '⬇️ Salvează întâi un backup', run: () => exportData() },
        { label: '🗑 Șterge tot', danger: true, run: () => {
          if (!confirm('Sigur? Toate datele vor fi șterse definitiv.')) return;
          try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
          db = load(); save(); ui.catId = null; ui.trip = null; switchTab('today'); toast('Toate datele au fost șterse');
        } },
      ]);
      break;
    case 'import': importData(); break;

    // entry editor
    case 'entry-save': saveEntry(false); break;
    case 'entry-save-alarm': saveEntry(true); break;
    case 'entry-delete':
      if (confirm(`Ștergi „${s.d.title || 'elementul'}”?`)) { deleteEntry(s.d.id); closeSheet(); toast('Șters'); }
      break;
    case 'quick': s.d.reminder = el.dataset.v; s.d.hasReminder = true; s.d.remTouched = true; renderSheet(); break;
    // repeating reminders
    case 'r-int': s.d.repInterval = Math.max(1, Math.min(365, (+s.d.repInterval || 1) + +el.dataset.v)); renderSheet(); break;
    case 'r-end': s.d.repEnd = el.dataset.v; renderSheet(); break;
    case 'r-count': s.d.repCount = Math.max(1, Math.min(999, (+s.d.repCount || 1) + +el.dataset.v)); renderSheet(); break;
    case 'r-countset': s.d.repCount = +el.dataset.v; renderSheet(); break;
    case 'r-preset': s.d.hasReminder = true; s.d.remTouched = true; s.d.repeat = 'daily'; s.d.repEnd = 'count'; s.d.repCount = +el.dataset.v; renderSheet(); break;
    case 'cal-day': {
      const k = el.dataset.v; const i = s.d.repDates.indexOf(k);
      if (i >= 0) s.d.repDates.splice(i, 1); else s.d.repDates.push(k);
      try { navigator.vibrate?.(6); } catch (e) { /* ignore */ }
      renderSheet(); break;
    }
    case 'cal-nav': {
      const [y, m] = s.d.calMonth.split('-').map(Number);
      const nd = new Date(y, m - 1 + +el.dataset.v, 1);
      s.d.calMonth = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`; renderSheet(); break;
    }
    case 'cal-clear': s.d.repDates = []; renderSheet(); break;
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
        deleteEntries(db.entries.filter(e => e.cat === c.id).map(e => e.id));
        db.categories = db.categories.filter(x => x.id !== c.id);
        save(); ui.catId = null; closeSheet(); toast('Lista a fost ștearsă');
      }
      break;
    }
  }
  if (act.startsWith('tr-') && typeof tripClick === 'function') tripClick(act, el);   // Vacanțe (trips.js)
  if (ui.sheet?.type === 'search' && ['toggle', 'sub', 'undo', 'alarm'].includes(act)) refreshSearch();
  if (act === 'toggle' || act === 'sub' || act === 'alarm' || act === 'dsub-toggle' || act === 'dsub-del' || act === 'c-color' || act === 'c-icon') ev.stopPropagation();
});

// bound inputs (data-bind) – text fields update silently, toggles/selects re-render
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.tb !== undefined && typeof tripBind === 'function') { tripBind(t, false); return; }
  if (t.id === 'quickadd') {
    const box = document.getElementById('qasugg');
    const c = catById(t.dataset.cat);
    if (box && c) box.innerHTML = shopSuggestHtml(c, t.value);
    return;
  }
  if (t.id === 'gsearch') {
    ui.searchQ = t.value;
    if (t.value) ui.searchFilter = null;
    if (!ui.searching) enterSearch(); else updateSearchLayer();
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
  if (t.dataset.tb !== undefined && typeof tripBind === 'function') { tripBind(t, true); return; }
  // "Produsele mele": change the aisle of one of your products
  if (t.dataset.mp !== undefined && ui.sheet?.type === 'myprod') {
    const p = myProducts()[t.dataset.mp];
    if (p) { p.aisle = t.value; save(); renderSheet(); }
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
  else if (typeof tripKey === 'function' && tripKey(ev)) { /* handled by Vacanțe */ }
  else if (ev.key === 'Enter' && ev.target.id === 'quickadd') {
    ev.preventDefault();
    const c = catById(ev.target.dataset.cat);
    if (c && shopAdd(c, ev.target.value)) {
      render();
      const inp = document.getElementById('quickadd');
      if (inp) inp.focus();               // keep typing the next product
    }
  }
  else if (ev.key === 'Enter' && ev.target.id === 'gsearch') { ev.preventDefault(); addRecent(ev.target.value); ev.target.blur(); }
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
    } else if (b === 'remTime') {
      if (value) d.reminder = (d.reminder.split('T')[0] || dkey(new Date())) + 'T' + value;
      d.remTouched = true;
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
  if (!h || !['entry', 'trippack'].includes(ui.sheet?.type)) return;
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
  const isPack = ui.sheet?.type === 'trippack';
  const subs = isPack ? packTemplate() : ui.sheet?.d?.subs;
  if (subs && from !== to) {
    const [moved] = subs.splice(from, 1);
    subs.splice(to, 0, moved);
    if (isPack) save();
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
  if (kind === 'trip' && typeof confirmDeleteTrip === 'function') { confirmDeleteTrip(id); return; }
  if (kind === 'titem' && typeof confirmDeleteTripItem === 'function') { confirmDeleteTripItem(id); return; }
  if (kind === 'cat') {
    const c = catById(id);
    if (!c) return;
    const n = db.entries.filter(e => e.cat === id).length;
    openActions(`Ștergi lista „${c.name}”${n === 1 ? ' și elementul din ea' : n ? ` și cele ${n} elemente din ea` : ''}? Nu se poate anula.`, [
      { label: '🗑 Șterge lista', danger: true, run: () => {
        deleteEntries(db.entries.filter(e => e.cat === id).map(e => e.id));
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
  if (wrap.dataset.reorder === 'titem' && typeof reorderTripItems === 'function') {
    reorderTripItems(newIds);   // tickets: your own order
  } else if (wrap.dataset.reorder === 'shop') {
    // shopping: the new order inside this aisle
    newIds.forEach((eid, i) => { const e = entryById(eid); if (e) e.pos = i; });
  } else if (wrap.dataset.reorder === 'cat') {
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

// ---------- segmented buttons: sliding bubble + drag your finger across (like the bottom bar) ----------
const segPos = {};
const segKey = seg => [...seg.querySelectorAll(':scope > button')].map(b => `${b.dataset.act || ''}:${b.dataset.v || b.dataset.f || ''}`).join('|');
const setSegPill = (p, pos) => { p.style.width = pos.width + 'px'; p.style.transform = `translateX(${pos.left}px)`; };
function initSegs(root) {
  (root || document).querySelectorAll('.seg, .segin').forEach(seg => {
    let pill = seg.querySelector(':scope > .segpill');
    if (!pill) { pill = document.createElement('span'); pill.className = 'segpill'; seg.prepend(pill); }
    const on = seg.querySelector(':scope > button.on');
    if (!on || !on.offsetWidth) { pill.style.opacity = on ? '' : '0'; return; }
    pill.style.opacity = '';
    const key = segKey(seg);
    const to = { left: on.offsetLeft, width: on.offsetWidth };
    const from = segPos[key];
    seg.classList.add('noanim');
    setSegPill(pill, from && from.left !== to.left ? from : to);
    void pill.offsetWidth;
    seg.classList.remove('noanim');
    if (from && from.left !== to.left) requestAnimationFrame(() => setSegPill(pill, to));
    segPos[key] = to;
  });
}
let segDrag = null;
document.addEventListener('pointerdown', ev => {
  const seg = ev.target.closest('.seg, .segin');
  if (!seg || ev.button > 0) return;
  segDrag = { seg, id: ev.pointerId, x: ev.clientX, moved: false, over: null, left: 0, width: 0 };
});
document.addEventListener('pointermove', ev => {
  if (!segDrag || ev.pointerId !== segDrag.id) return;
  const { seg } = segDrag;
  if (!segDrag.moved && Math.abs(ev.clientX - segDrag.x) < 7) return;
  if (!segDrag.moved) {
    seg.classList.add('dragstart');
    clearTimeout(seg._ds); seg._ds = setTimeout(() => seg.classList.remove('dragstart'), 170);
  }
  segDrag.moved = true;
  seg.classList.add('dragging');
  const btns = [...seg.querySelectorAll(':scope > button')];
  const sr = seg.getBoundingClientRect();
  const over = btns.find(b => { const r = b.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX < r.right; })
    || (ev.clientX < sr.left + sr.width / 2 ? btns[0] : btns[btns.length - 1]);
  if (over !== segDrag.over) { segDrag.over = over; try { navigator.vibrate?.(6); } catch (e) { /* ignore */ } }
  btns.forEach(b => b.classList.toggle('over', b === over));
  magnify(btns, ev.clientX, 1.07, 1.1);
  const w = over.offsetWidth;
  const left = Math.max(2, Math.min(seg.offsetWidth - w - 2, ev.clientX - sr.left - w / 2));
  segDrag.left = left; segDrag.width = w;
  const pill = seg.querySelector(':scope > .segpill');
  if (pill) { setSegPill(pill, { left, width: w }); stretchPill(pill, segDrag, ev.clientX); }
});
function endSegDrag(ev) {
  if (!segDrag || (ev && ev.pointerId !== segDrag.id)) return;
  const d = segDrag;
  segDrag = null;
  d.seg.classList.remove('dragging');
  d.seg.querySelectorAll('.over').forEach(b => b.classList.remove('over'));
  unmagnify([...d.seg.querySelectorAll(':scope > button')]);
  if (!d.moved || !d.over) return;
  segPos[segKey(d.seg)] = { left: d.left, width: d.width };   // the bubble continues from where your finger was
  if (d.over.classList.contains('on')) { initSegs(d.seg.parentElement); }
  else d.over.click();
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 350);
}
document.addEventListener('pointerup', endSegDrag);
document.addEventListener('pointercancel', endSegDrag);

// ---------- charts: slide your finger across the months ----------
let barDrag = null;
document.addEventListener('pointerdown', ev => {
  const bars = ev.target.closest('.bars');
  if (!bars) return;
  barDrag = { id: ev.pointerId, x: ev.clientX, moved: false, last: null, root: ev.target.closest('#sheet') ? '#sheet' : '#app' };
});
document.addEventListener('pointermove', ev => {
  if (!barDrag || ev.pointerId !== barDrag.id) return;
  if (!barDrag.moved && Math.abs(ev.clientX - barDrag.x) < 7) return;
  barDrag.moved = true;
  const bar = [...document.querySelectorAll(`${barDrag.root} .bars .bar`)].find(b => { const r = b.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX < r.right; });
  if (bar && bar.dataset.k !== barDrag.last && !bar.classList.contains('sel')) {
    barDrag.last = bar.dataset.k;
    try { navigator.vibrate?.(5); } catch (e) { /* ignore */ }
    bar.click();
  }
});
function endBarDrag(ev) {
  if (!barDrag || (ev && ev.pointerId !== barDrag.id)) return;
  const moved = barDrag.moved;
  barDrag = null;
  if (moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 350); }
}
document.addEventListener('pointerup', endBarDrag);
document.addEventListener('pointercancel', endBarDrag);

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


// ---------- self-update: when the app comes back to the screen, check if a newer version was published ----------
// (iOS resumes a home-screen app as it was, so without this an old version can stay open for days)
async function checkForUpdate() {
  if (BUILD_ID === 'dev' || ui.sheet || document.body.classList.contains('typing')) return;
  try {
    const t = await (await fetch('app.js?u=' + Date.now(), { cache: 'no-store' })).text();
    const m = t.match(/const BUILD_ID = '([^']+)'/);
    if (m && m[1] !== BUILD_ID && !ui.sheet) {
      try { sessionStorage.setItem('mindme.ui', JSON.stringify({ tab: ui.tab, catId: ui.catId, trip: ui.trip, y: scroller().scrollTop })); } catch (e) { /* ignore */ }
      location.reload();
    }
  } catch (e) { /* offline: try again next time */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
window.addEventListener('pageshow', () => setTimeout(checkForUpdate, 1500));
// after an automatic update, come back to the same screen
(function restoreUi() {
  let st = null;
  try { st = JSON.parse(sessionStorage.getItem('mindme.ui') || 'null'); sessionStorage.removeItem('mindme.ui'); } catch (e) { /* ignore */ }
  if (!st) return;
  ui.tab = st.tab || ui.tab; ui.catId = st.catId || null; ui.trip = st.trip || null;
  render();
  setTimeout(() => scroller().scrollTo(0, st.y || 0), 50);
})();

// trip time rows: the label turns from placeholder-grey to normal once a time is chosen
document.addEventListener('change', ev => {
  if (ev.target.classList?.contains('plaintime')) ev.target.closest('.plainrow')?.classList.toggle('has', !!ev.target.value);
});
// the bottom-bar bubble follows size changes (rotation, split view)
window.addEventListener('resize', () => { if (!tabDrag) placePill(document.querySelector(`#tabbar button[data-tab="${ui.tab}"]`)); });
