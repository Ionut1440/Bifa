'use strict';
/* MindMe – Vacanțe: trips with a day-by-day program, ideas (restaurants, cafés, museums…),
   tickets & documents (photos / PDF kept on the phone, also offline), packing list and budget.
   Uses the helpers and state from app.js (db, ui, render, renderSheet, esc, chip, …). */

const TRIP_TYPES = [
  // key, icon, label, group  (group: transport | stay | visit | food | other)
  ['flight', '✈️', 'Zbor', 'transport'],
  ['train', '🚆', 'Tren', 'transport'],
  ['bus', '🚌', 'Autobuz', 'transport'],
  ['metro', '🚇', 'Metrou / transport local', 'transport'],
  ['taxi', '🚕', 'Taxi / transfer', 'transport'],
  ['car', '🚗', 'Mașină', 'transport'],
  ['ferry', '⛴️', 'Feribot', 'transport'],
  ['hotel', '🏨', 'Cazare', 'stay'],
  ['museum', '🏛️', 'Muzeu', 'visit'],
  ['sight', '🗺️', 'Obiectiv / atracție', 'visit'],
  ['event', '🎫', 'Spectacol / eveniment', 'visit'],
  ['activity', '🥾', 'Activitate', 'visit'],
  ['tour', '🧭', 'Tur ghidat', 'visit'],
  ['beach', '🏖️', 'Plajă', 'visit'],
  ['restaurant', '🍽️', 'Restaurant', 'food'],
  ['cafe', '☕', 'Cafenea', 'food'],
  ['bar', '🍸', 'Bar', 'food'],
  ['shop', '🛍️', 'Cumpărături', 'other'],
  ['doc', '📄', 'Document (pașaport, asigurare…)', 'other'],
  ['note', '📝', 'Notă', 'other'],
];
const TT = Object.fromEntries(TRIP_TYPES.map(t => [t[0], { icon: t[1], label: t[2], group: t[3] }]));
const isTransport = type => TT[type]?.group === 'transport';
const TRIP_EMOJIS = ['🏖️', '🏝️', '🏔️', '⛷️', '🏙️', '🗼', '🗽', '🏛️', '🕌', '🌴', '🚢', '🏕️', '🎡', '🍷', '✈️', '🧳'];
const TRIP_CURRENCIES = ['EUR', 'RON', 'USD', 'GBP', 'CHF', 'HUF', 'CZK', 'PLN', 'TRY', 'BGN'];
// the user's own standard packing list (editable in the app; every new trip starts with it)
const PACK_DEFAULT = ['Haine (pantaloni, tricouri, cămăși, bluze, pulovere, șosete, chiloți, pijamale)', 'Papuci', 'Lanternă', 'Kindle', 'Buletin',
  'Pașaport', 'Carnet vaccin', 'Încărcător telefon', 'Spray țânțari', 'Baterie externă', 'Pastă de dinți', 'Periuță de dinți', 'Bețișoare de urechi',
  'Pieptăn', 'Fixativ', 'Gel de duș', 'Deodorant', 'Telefon', 'Chei', 'Portofel', 'Parfum', 'Căști', 'Șampon', 'Mini uscător',
  'Șervețele pentru ochelari', 'Șervețele umede', 'Șervețele', 'Umbrelă', 'Plasă goală pentru haine', 'Plasturi', 'Pastile',
  'Picături și unguent pentru ochi', 'Bani', 'Cabluri de încărcare', 'Creme', 'Card', 'Card metrou + STB', 'Pelerină de ploaie', 'Biguri'];
const packTemplate = () => { (db.settings ||= {}).packTemplate ||= [...PACK_DEFAULT]; return db.settings.packTemplate; };
const packFromTemplate = () => packTemplate().map(title => ({ id: uid(), title, done: false }));
// examples shown in the empty fields, per kind of transport
const TRIP_HINTS = {
  flight: ['Wizz W6 3141', 'OTP București', 'FCO Roma'],
  train: ['IR 1581', 'București Nord', 'Brașov'],
  bus: ['FlixBus 1234', 'Autogara Militari', 'Viena'],
  metro: ['M2 / autobuz 783', 'Piața Unirii', 'Aeroport'],
  taxi: ['Bolt / Uber / transfer', 'Aeroport', 'Hotel'],
  car: ['Mașină închiriată', 'Aeroport', 'Hotel'],
  ferry: ['Feribot Blue Star', 'Pireu', 'Mykonos'],
};

const isTripCat = c => c?.kind === 'trips';
const tripOf = e => e?.trip;
function tripDays(t) {
  const s = dayOf(t.start), e = dayOf(t.end || t.start);
  const out = [];
  for (let d = s, i = 0; d <= e && i < 120; d = addDays(d, 1), i++) out.push(new Date(d));
  return out;
}
function tripStatus(t) {
  const today = startOfDay(new Date());
  const s = dayOf(t.start), e = dayOf(t.end || t.start);
  const total = Math.round((e - s) / 86400000) + 1;
  if (today < s) {
    const n = Math.round((s - today) / 86400000);
    return { state: 'future', text: n === 1 ? 'Mâine pleci! 🧳' : `Peste ${n} zile`, color: 'var(--blue)' };
  }
  if (today > e) return { state: 'past', text: 'Încheiată', color: 'var(--muted)' };
  const n = Math.round((today - s) / 86400000) + 1;
  return { state: 'now', text: `Ziua ${n} din ${total}`, color: 'var(--green)' };
}
const fDayMonth = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long' });
function tripRange(t) {
  const s = dayOf(t.start), e = dayOf(t.end || t.start);
  const yr = e.getFullYear() !== new Date().getFullYear() ? ' ' + e.getFullYear() : '';
  return sameDay(s, e) ? fLong.format(s) : `${fDayMonth.format(s)} – ${fDayMonth.format(e)}${yr}`;
}
const tripItems = t => (t.items ||= []);
const sortByTime = list => [...list].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.createdAt - b.createdAt);
const mapsUrl = q => `https://maps.apple.com/?q=${encodeURIComponent(q)}`;

// ---------- tickets & documents: files kept on the phone (IndexedDB), work offline ----------
let fileDbP;
function fileDb() {
  return fileDbP ||= new Promise((res, rej) => {
    const r = indexedDB.open('mindme-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function fileStore(mode, fn) {
  const d = await fileDb();
  return new Promise((res, rej) => {
    const tx = d.transaction('files', mode);
    const req = fn(tx.objectStore('files'));
    tx.oncomplete = () => res(req?.result);
    tx.onerror = () => rej(tx.error);
  });
}
const filePut = (id, blob) => fileStore('readwrite', s => s.put(blob, id));
const fileGet = id => fileStore('readonly', s => s.get(id));
const fileDel = id => fileStore('readwrite', s => s.delete(id));
const fileUrls = {};
async function fileUrl(id) {
  if (fileUrls[id]) return fileUrls[id];
  const b = await fileGet(id);
  if (!b) return null;
  return (fileUrls[id] = URL.createObjectURL(b));
}
// after a render: put the picture thumbnails in place
function tripAfterRender() {
  document.querySelectorAll('[data-thumb]').forEach(async el => {
    const u = await fileUrl(el.dataset.thumb).catch(() => null);
    if (u && el.dataset.kind === 'image') el.style.backgroundImage = `url("${u}")`;
  });
}

// ---------- read the data from a ticket (PDF text with pdf.js, photos with OCR) ----------
const LIB_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const LIB_PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const LIB_OCR = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const libs = {};
function loadScript(url) {
  return libs[url] ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.async = true; s.onload = res; s.onerror = () => { delete libs[url]; rej(new Error('load ' + url)); };
    document.head.appendChild(s);
  });
}
async function ticketText(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
    await loadScript(LIB_PDF);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIB_PDF_WORKER;
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let txt = '';
    for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
      const c = await (await pdf.getPage(p)).getTextContent();
      txt += ' ' + c.items.map(i => i.str).join(' ');
    }
    return txt;
  }
  if ((file.type || '').startsWith('image/')) {
    await loadScript(LIB_OCR);
    const img = await ocrPrep(file).catch(() => file);
    // Romanian + English, so "Bușteni", "Plecare", "Sosire" are read correctly
    const r = await window.Tesseract.recognize(img, 'ron+eng').catch(() => window.Tesseract.recognize(img, 'eng'));
    // a screenshot starts with the phone's status bar ("21:46 … 72%"): drop that first line
    return (r?.data?.text || '').replace(/^\s*\d{1,2}[:.]\d{2}\b[^\n]*\n/, '');
  }
  return '';
}
// photos/screenshots read much better when big, gray and high-contrast
async function ocrPrep(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    await new Promise((res, rej) => { im.onload = res; im.onerror = rej; setTimeout(() => rej(new Error('img timeout')), 8000); im.src = url; });
    const scale = Math.max(1, Math.min(3, 2400 / (im.naturalWidth || 1)));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * scale); c.height = Math.round(im.naturalHeight * scale);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(im, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      const v = Math.max(0, Math.min(255, (g - 128) * 1.6 + 140));   // more contrast, slightly lighter background
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    x.putImageData(d, 0, 0);
    return c;
  } finally { URL.revokeObjectURL(url); }
}
const MONTHS = { ian: 1, jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, iun: 6, jun: 6, iul: 7, jul: 7, aug: 8, sep: 9, oct: 10, noi: 11, nov: 11, dec: 12 };
// common airport codes, so "OTP IST" or the barcode text "OTPGDN" side by side is read as a route
const IATA = new Set(('OTP BBU CLJ TSR IAS SBZ CND BCM OMR SCV CRA TGM SUJ BAY ' +
  'IST SAW AYT ADB ESB DLM BJV ' +
  'FCO CIA MXP LIN BGY VCE TSF TRS BLQ PSA FLR NAP BRI CTA PMO CAG OLB AHO TRN GOA VRN BDS SUF ' +
  'LHR LGW STN LTN LCY MAN BHX EDI GLA BRS LPL DUB ' +
  'CDG ORY BVA NCE MRS LYS TLS BOD NTE ' +
  'MAD BCN AGP PMI VLC ALC SVQ IBZ TFS LPA ACE BIO ' +
  'LIS OPO FAO FNC ' +
  'FRA MUC BER DUS HAM CGN STR NUE DTM HHN FMM ' +
  'AMS EIN RTM BRU CRL LUX ZRH GVA BSL VIE SZG INN PRG BUD WAW WMI KRK GDN KTW WRO POZ ' +
  'ATH SKG HER RHO CFU CHQ JMK JTR KGS ZTH ' +
  'SOF VAR BOJ BEG TIA SKP PRN SJJ ZAG SPU DBV LJU KIV ' +
  'CPH ARN OSL HEL RIX VNO TLL KEF BGO ' +
  'DXB AUH DOH TLV CAI HRG SSH RAK CMN TUN JFK EWR LAX MIA ORD').split(' ').filter(Boolean));
function parseTicket(raw, trip, single) {
  raw = String(raw || '').replace(/\u001f/g, 'i');          // some PDFs (Turkish Airlines) lose the letter "i"
  const T = ' ' + raw.replace(/\s+/g, ' ') + ' ';
  // a ticket with several trains (CFR: București → Pitești → Curtea de Argeș): one part per train
  if (!single) {
    const starts = [...T.matchAll(/(?:\d{1,2}\s?[A-Za-zăâîșț]{3,9}\.?\s?20\d{2}\s+)?\d{1,2}:\d{2}\s+Plecare\s*\/\s*Departure/gi)].map(m => m.index);
    if (starts.length > 1) {
      const head = T.slice(0, starts[0]);
      const legs = starts.map((st, i) => parseTicket(head.replace(/\d{1,2}:\d{2}/g, ' ') + ' ' + T.slice(st, starts[i + 1] || T.length), trip, true));
      return { ...legs[0], legs };
    }
  }
  const U = normText(T).toUpperCase();
  const out = {};
  // what kind of ticket
  const airlines = [['WIZZ', 'Wizz Air'], ['RYANAIR', 'Ryanair'], ['TAROM', 'TAROM'], ['LUFTHANSA', 'Lufthansa'], ['EASYJET', 'easyJet'], ['TURKISH AIRLINES', 'Turkish Airlines'],
    ['AUSTRIAN', 'Austrian'], ['KLM', 'KLM'], ['AIR FRANCE', 'Air France'], ['BRITISH AIRWAYS', 'British Airways'], ['ITA AIRWAYS', 'ITA Airways'], ['AEGEAN', 'Aegean'],
    ['HISKY', 'HiSky'], ['ANIMAWINGS', 'AnimaWings'], ['SWISS', 'Swiss'], ['VUELING', 'Vueling'], ['EUROWINGS', 'Eurowings'], ['LOT POLISH', 'LOT']];
  const al = airlines.find(([k]) => U.includes(k));
  const fl = U.match(/\b(?:FLIGHT|ZBOR(?:UL)?|FLUG|VOL|VUELO|VOLO)\s*(?:NO\.?|NR\.?|NUMBER|NUMAR)?\s*[:#]?\s*([A-Z0-9]{2})\s?(\d{1,4})\b/)
    || U.match(/\b(W6|W4|W9|FR|RR|RO|LH|OS|AF|KL|BA|TK|U2|EJU|EW|VY|AZ|LO|A3|0B|H4|LX|SN|IB|TP|EK|QR|SK|DY|FB|JU|PC|XQ|HV|TO|V7|AY)\s?(\d{2,4})\b/);
  const trainWords = /CFR|TREN|TRAIN|ZUG|OBB|SNCF|TRENITALIA|FRECCIA|ITALO|BAHN|RENFE|RAIL|VAGON|WAGEN|COACH|CARROZZA|REGIOTRANS|INTERREGIONAL|PKP|INTERCITY|POCIAG|REGIONALE|REGIOJET|LEO EXPRESS|\bMAV\b|\bSBB\b|PENDOLINO/.test(U);
  const strongFlight = al || /BOARDING PASS|IMBARCARE|GATE CLOSES|\bFLIGHT\b|\bZBOR/.test(U);
  // buses first: FlixBus tickets mention "coach", "seat", even rail partners, but they are still a bus
  const isBus = /FLIXBUS|FLIX BUS|AUTOCAR|AUTOBUZ|AUTOGARA|BUS STATION|BUSBAHNHOF|EUROLINES|ATLASSIB|BUS TICKET/.test(U) && !/FLIXTRAIN/.test(U);
  if (isBus && !strongFlight) {
    out.type = 'bus';
    const bn = U.match(/\b(?:LINE|LINIA|LINIE|ROUTE|CURSA)\s*[:#]?\s*([A-Z]?\d{2,5})\b/);
    out.title = (U.includes('FLIX') ? 'FlixBus' : 'Autobuz') + (bn ? ' ' + bn[1] : '');
  } else if (strongFlight || (fl && !trainWords)) {
    out.type = 'flight';
    out.title = [al?.[1], fl ? `${fl[1]} ${fl[2]}` : ''].filter(Boolean).join(' ') || 'Zbor';
  } else {
    const tr = U.match(/\b(?:TREN|TRAIN|ZUG|TRENO)\b(?:\s*\/\s*(?:TRAIN|TREN)\b)?\s*[:#]?\s*(REGIONALE VELOCE|REGIONALE|REGIONAL|IR-N|R-E|IRN|IR|ICE|IC|EC|EN|RJX|RJ|RE|R|TGV|FR|RB)\s?(\d{2,5})\b/)
      || U.match(/\b(IR-N|R-E|IRN|IR|IC|ICE|EC|EN|RJX|RJ|RE|TGV|FR|TLK)\s?(\d{2,5})\b/) || U.match(/\b(R)\s?(\d{3,5})\b/);
    if (trainWords) {
      out.type = 'train';
      const brand = U.includes('FRECCIAROSSA') ? 'Frecciarossa ' : U.includes('ITALO') ? 'Italo ' : '';
      const code = tr ? (tr[1].startsWith('REGIONAL') ? cap(tr[1].toLowerCase()) : tr[1]) : '';
      out.title = tr ? `${brand}${code} ${tr[2]}` : (U.includes('CFR') ? 'CFR Călători' : 'Tren');
    } else if (/FLIXBUS|AUTOCAR|AUTOBUZ|COACH BUS|BUS TICKET/.test(U)) { out.type = 'bus'; out.title = U.includes('FLIXBUS') ? 'FlixBus' : 'Autobuz'; }
    else if (/MUZEU|MUSEUM|MUSEO|MUSEI|MUSEE|GALLERY|GALERIE|PINACOTECA/.test(U)) {
      out.type = 'museum';
      const mm = T.match(/((?:Muzeul|Museo|Musei|Museum|Musée|Galleria|Galeria|Pinacoteca)\s+[A-ZĂÂÎȘȚ][^\d,.;:]{2,40}?)(?=\s+(?:Ticket|Bilet|Entry|Intrare|Date|Data|Biglietto|\d)|$)/i)
        || T.match(/([A-Z][\w']+(?:\s+[A-Z][\w']+){0,3}\s+(?:Museum|Gallery))/);
      if (mm) out.title = mm[1].trim();
    }
    else if (/HOTEL|CHECK-IN|CHECK IN|BOOKING\.COM|AIRBNB|CAZARE|APARTMENT|HOSTEL/.test(U)) {
      out.type = 'hotel';
      const hm = T.match(/\b(Hotel|Hostel|Apartment|Pensiunea|Vila|Residence)\s+([A-ZĂÂÎȘȚ][\wăâîșț'&-]+(?:\s+[A-ZĂÂÎȘȚ][\wăâîșț'&-]+)?)/);
      if (hm && !/^Check/i.test(hm[2])) out.title = `${hm[1]} ${hm[2]}`.replace(/\s+(Check|Confirm|Booking|Total|Rezervare|Data|Date)\b.*$/i, '');
    }
    else if (/CONCERT|TEATRU|THEATRE|THEATER|STADIUM|STADION|EVENT|SHOW/.test(U)) out.type = 'event';
  }
  // route: "OTP - FCO", "(OTP) … (FCO)"
  const r1 = U.match(/\b([A-Z]{3})\s?(?:-|–|→|>|TO)\s?([A-Z]{3})\b/);
  const codes = [...U.matchAll(/\(([A-Z]{3})\)/g)].map(m => m[1]);
  if (r1 && !['THE', 'AND', 'FOR'].includes(r1[1])) { out.from = r1[1]; out.to = r1[2]; }
  else if (codes.length >= 2) { out.from = codes[0]; out.to = codes[1]; }
  else if (out.type === 'flight') {   // "OTP   IST" or the boarding-pass barcode text "OTPGDN"
    const pair = [...U.matchAll(/\b([A-Z]{3})\s+(?=([A-Z]{3})\b)/g)].find(m => m[1] !== m[2] && IATA.has(m[1]) && IATA.has(m[2]))
      || [...U.matchAll(/\b([A-Z]{3})([A-Z]{3})(?=[A-Z0-9]{2}\s?\d)/g)].find(m => m[1] !== m[2] && IATA.has(m[1]) && IATA.has(m[2]));
    if (pair) { out.from = pair[1]; out.to = pair[2]; }
  }
  // times (before the route, because on train tickets the stations sit between the two times)
  const tt = ticketTimes(T);
  if (tt.dep) out.time = tt.dep.t;
  if (tt.arr) out.endTime = tt.arr.t;
  if (!out.from && (out.type === 'train' || out.type === 'bus')) {
    const st = ticketStations(T, tt, raw);
    if (st) { out.from = st[0]; out.to = st[1]; }
  }
  if (!out.from) {
    const fw = T.match(/(?:From|De la|Plecare din|Departure|Abfahrt|Partenza|Din)\s*[:\-]?\s*([A-ZĂÂÎȘȚ][A-Za-zăâîșțéèüöß .'-]{2,28}?)\s+(?:To|Spre|Către|Catre|La|Sosire|Arrival|Ankunft|Arrivo|Nach|A)\s*[:\-]?\s*([A-ZĂÂÎȘȚ][A-Za-zăâîșțéèüöß .'-]{2,28}?)(?=\s|$)/);
    if (fw) { out.from = fw[1].trim(); out.to = fw[2].trim(); }
  }
  // booking code, seat, gate, coach
  const refs = [];
  const ref = T.match(/(?:PNR(?:\s*\/\s*SEQ)?|Booking (?:reference|ref\.?|code|number)|Reservation (?:code|number)|Confirmation (?:code|number)|Cod(?:ul)? (?:de )?rezervare|Rezervare|Buchungsnummer|Codice prenotazione|Ticket (?:id|no\.?|number|code)|NR BILETU|Numer biletu|Bilet (?:nr\.?|id)|Reference)\s*[:#]?\s*(?:Id\s*[:#]?\s*)?([A-Z0-9]{5,12})\b/i);
  if (ref) refs.push(ref[1].toUpperCase());
  const coach = T.match(/\b(?:Coach|Vagon(?:ul)?|Wagen|Carrozza)(?:\s*\/\s*(?:Car|Coach|Wagon|Vagon))?\s*[:#]?\s*(\d{1,3})\b/i); if (coach) refs.push('vagon ' + coach[1]);
  const seat = T.match(/\b(?:Seats?|Places?|Locuri|Loc(?:ul)?|Sitz(?:platz)?|Posti|Posto)(?:\s*\/\s*(?:Places?|Seats?|Locuri))?\s*[:#]?\s*(\d{1,3}[A-K]?(?:\s*,\s*\d{1,3}[A-K]?)*)/i);
  if (seat) refs.push((/,/.test(seat[1]) ? 'locuri ' : 'loc ') + seat[1].replace(/\s*,\s*/g, ', '));
  const gate = T.match(/\b(?:Gate|Poarta|Poartă)(?!\s*clos)\s*[:#]?\s*([A-Z]?\d{1,3}[A-Z]?)\b(?![:.]\d)/i); if (gate) refs.push('poarta ' + gate[1]);
  if (out.type === 'flight') {
    if (!ref) {
      const r2 = U.match(/\b(?:REFERENCE|PNR|BOOKING|RESERVATION|CONFIRMATION|COD REZERVARE)\b[\s\S]{0,40}?\b(?=[A-Z0-9]{6}\b)(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])([A-Z0-9]{6})\b/);
      if (r2) refs.unshift(r2[1]);
    }
    if (!seat) {
      const s2 = U.match(/\bSEAT\b[\s\S]{0,45}?\b(\d{1,2}[A-K])\b/) || U.match(/\bLOC\b[\s\S]{0,30}?\b(\d{1,2}[A-K])\b/);
      if (s2) refs.push('loc ' + s2[1]);
    }
  }
  if (refs.length) out.ref = refs.join(' · ');
  // date → the matching day of the trip
  // (dates of issue / purchase / receipt are not the travel day)
  const dates = [];
  const NT = normText(T);
  const issued = i => /(ISSUE|RECEIPT|BUY DATE|PURCHASE|CUMPARARI|EMIS|EMITERE|WYSTAWIONO|WYGENEROWANO|ZAPLACONO|ORDER DATE|BOOKED ON)[^0-9]{0,30}(?:\d[\d ./:-]{0,25})?[^0-9]{0,12}$/i.test(normText(T.slice(Math.max(0, i - 60), i)) + ' ');
  for (const m of T.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/g)) if (!issued(m.index)) dates.push([+m[3], +m[2], +m[1]]);
  for (const m of T.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) if (!issued(m.index)) dates.push([+m[1], +m[2], +m[3]]);
  for (const m of T.matchAll(/\b(\d{1,2})\s?(?:\/\s?)?([A-Za-zăâîșț]{3})[A-Za-zăâîșț]*\.?\s?(?:\/\s?)?(20\d{2})?(?![\p{L}\d])/gu)) {
    const mo = MONTHS[normText(m[2])]; if (mo && !issued(m.index)) dates.push([m[3] ? +m[3] : dayOf(trip.start).getFullYear(), mo, +m[1]]);
  }
  const days = new Set(tripDays(trip).map(dkey));
  const keys = dates.filter(([y, m, d]) => m >= 1 && m <= 12 && d >= 1 && d <= 31).map(([y, m, d]) => `${y}-${pad(m)}-${pad(d)}`);
  out.day = keys.find(k => days.has(k)) || '';
  // price: the total that was paid (not the VAT, not a discount)
  const CUR = { '€': 'EUR', LEI: 'RON', '$': 'USD', '£': 'GBP', 'ZŁ': 'PLN', ZL: 'PLN', TL: 'TRY' };
  const amounts = [];
  for (const m of T.matchAll(/(\d{1,5}(?:[.,]\d{1,2})?)\s?(EUR|€|RON|LEI|USD|\$|GBP|£|CHF|HUF|CZK|PLN|ZŁ|TL|TRY)(?![A-Za-zăîâșț])/gi)) amounts.push({ num: m[1], cur: m[2], i: m.index });
  for (const m of T.matchAll(/(EUR|€|RON|USD|GBP|£|PLN)\s?(\d{1,5}[.,]\d{1,2})/gi)) amounts.push({ num: m[2], cur: m[1], i: m.index });
  const before = a => normText(T.slice(Math.max(0, a.i - 40), a.i)).toUpperCase();
  const totalRe = /(TOTAL|RAZEM|AMOUNT PAID|PRET ONLINE|ONLINE PRICE|DE PLATA|SUMA|PAID|PLATIT|ACHITAT|GRAND)/;
  const skipRe = /(TVA|VAT|IVA|MWST|REDUCER|DISCOUNT|ULGA|RABAT)\s*[/:]?[^0-9]{0,25}$/;
  let pick = single ? amounts.filter(a => !skipRe.test(before(a)))[0]
    : (amounts.filter(a => totalRe.test(before(a)) && !skipRe.test(before(a))).pop() || amounts.filter(a => !skipRe.test(before(a)))[0]);
  if (!pick && /zł/i.test(T)) {   // Polish tickets: "Razem: 98,00" with the currency in the column header
    const m = T.match(/(?:Razem|Do zapłaty|Suma)\s*:?\s*(\d{1,5}[.,]\d{2})/i);
    if (m) pick = { num: m[1], cur: 'PLN' };
  }
  if (pick) {
    out.cost = parseAmount(pick.num.replace(/^(\d+)\.(\d)$/, '$1,$2'));
    out.currency = CUR[pick.cur.toUpperCase()] || pick.cur.toUpperCase();
  }
  return out;
}
// departure / arrival times. Purchase and boarding times are ignored. A time right after "Plecare/Departure" or
// "Sosire/Arrival" wins; otherwise, on a one-day ticket the earlier time is the departure (tables are read in odd orders).
const DEP_LBL = /(?:PLECARE|DEPARTURE|ABFAHRT|PARTENZA|DEPART|SALIDA|CHECK.?IN)\b/;
const ARR_LBL = /(?:SOSIRE|ARRIVAL|ANKUNFT|ARRIVO|ARRIVEE|LLEGADA|CHECK.?OUT)\b/;
function ticketTimes(T) {
  const U = normText(T).toUpperCase();
  const all = [...U.matchAll(/(?<![\dA-Z.,:])([01]?\d|2[0-3])[:H.]([0-5]\d)(?![\d.,:])(?!\s?(?:EUR|RON|LEI|USD|GBP|CHF|%|€|\$|KG))/g)]
    .map(m => ({ t: `${m[1].padStart(2, '0')}:${m[2]}`, i: m.index }))
    .filter(x => !/(BOARDING|IMBARCARE|GATE CLOSES|CUMPARARI|CUMPARAT|BUY DATE|PURCHASE|ISSUED|ISSUE DATE|ISSUE|EMIS|EMITERE|PRINTED|TIPARIT|WYSTAWIONO|WYGENEROWANO|ARRIVE AT THE AIRPORT|SECURITY CHECK|FLIGHT TIME)[^0-9]{0,25}[\d .\/A-Z-]{0,20}$/.test(U.slice(Math.max(0, x.i - 45), x.i)));
  if (!all.length) return {};
  const after = re => {
    const m = U.match(re);
    if (!m) return null;
    const end = m.index + m[0].length;
    return all.find(x => x.i >= end && x.i - end <= 30) || null;
  };
  let dep = after(DEP_LBL), arr = after(ARR_LBL);
  if (dep && arr && dep.t !== arr.t && (dep.t < arr.t || distinctDates(U) > 1 || /CHECK.?IN/.test(U))) return { dep, arr };
  const uniq = [];
  for (const x of all) if (!uniq.some(u => u.t === x.t)) uniq.push(x);
  const two = uniq.slice(0, 2);
  if (two.length === 2 && distinctDates(U) <= 1) two.sort((a, b) => a.t.localeCompare(b.t));
  return { dep: two[0], arr: two[1] };
}
function distinctDates(U) {
  const s = new Set();
  for (const m of U.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/g)) s.add(`${+m[1]}.${+m[2]}`);
  for (const m of U.matchAll(/\b(\d{1,2})\s?(IAN|JAN|FEB|MAR|APR|MAI|MAY|IUN|JUN|IUL|JUL|AUG|SEP|OCT|NOI|NOV|DEC)[A-Z]*\.?\s?(20\d{2})/g)) s.add(`${+m[1]}.${m[2]}`);
  return s.size;
}
// stations on a train / bus ticket: "Roma Termini → Firenze SMN", or (CFR-style tables) the words between
// the departure and the arrival time: "17:10 Bușteni Sinaia 17:19"
function ticketStations(T, tt, raw) {
  const L = '[A-ZĂÂÎȘȚŞŢÉÈÜÖŁŚŻŹĆŃ]', W = `${L}[\\p{L}.'’-]+`;
  const NAME = `${W}(?:\\s(?:(?:de|di|del|della|du|la|le|sur|am|an|der|im|pe|a|A)\\s)?${W}){0,3}`;
  // 0) labels: "from Bari Centrale To Polignano A Mare", "Departure station X … Arrival station Y"
  const lab = T.match(/(?:Plecare|Departure)(?:\s*\/\s*(?:Departure|Plecare))?\s+(?!station)(.+?)\s+(?:Sosire|Arrival)(?:\s*\/\s*(?:Arrival|Sosire))?\s+(?!station)(.+?)(?=\s+\d{1,2}:\d{2}|\s+\d{1,2}\s?[A-Za-z]{3}\.?\s?20\d{2}|\s+Tren\b|\s+Train\b|\s*$)/)
    || T.match(/Departure station\s*:?\s*(.+?)\s+(?:Hours|Ore|Ora|Time)\b[\s\S]{0,60}?Arrival station\s*:?\s*(.+?)\s+(?:Hours|Ore|Ora|Time)\b/)
    || T.match(/\b(?:from|De la|Von|Da)\s+(.+?)\s+(?:To|Spre|Nach)\s+(.+?)(?=\s+(?:Ticket|Departure|Hours|Train|Tren|Date|Data|Code)\b|\s+\d|\s*$)/)
    || T.match(new RegExp(`(?:Stazione di partenza|Gara de plecare)\\s*:?\\s*(${NAME})[\\s\\S]{0,80}?(?:Stazione di arrivo|Gara de sosire)\\s*:?\\s*(${NAME})`, 'u'));
  if (lab) {
    const cut = x => x.replace(/\s+(?:Hours|Ore|Ora|Ticket|Train|Tren|Date|Data)\b.*$/i, '').trim();
    const f = cut(lab[1]), t = cut(lab[2]);
    if (f && t && f !== t) return [f, t];
  }
  const clean = T.replace(/(?:Plecare|Departure|Sosire|Arrival|Abfahrt|Ankunft|Partenza|Arrivo|Départ|Arrivée|Salida|Llegada)(?:\s*\/\s*(?:Plecare|Departure|Sosire|Arrival))?/gi, ' ')
    .replace(/\b(?:FlixBus|Flix|Trenitalia|Frecciarossa|Frecciargento|Italo|SNCF|TGV|ÖBB|OBB|DB|Deutsche Bahn|CFR Călători|CFR Calatori|CFR|Regio Călători|Astra Trans Carpatic|Softrans|Interregional|Renfe|Eurostar)\b/gi, ' ')
    .replace(/[|()[\]{}]/g, ' ').replace(/\s+/g, ' ');
  const isBad = s => /^(Oct|Nov|Dec|Ian|Jan|Feb|Mar|Apr|Mai|May|Iun|Jun|Iul|Jul|Aug|Sep|Noi|Tren|Train|Trains|Trenuri|Bilet|Ticket|Data|Date|Clasa|Class)$/i.test(s);
  // 1) between the two times
  const findT = t => { const m = clean.match(new RegExp(`(?<![\\d.,:])0?${+t.slice(0, 2)}[:h.]${t.slice(3)}(?![\\d.,:])`)); return m ? m.index : -1; };
  if (tt?.dep && tt?.arr) {
    const a = findT(tt.dep.t), b = findT(tt.arr.t);
    const rev = b < a;                          // arrival written first → the stations are written backwards too
    const [i, j] = rev ? [b, a] : [a, b];
    const fix = p => rev ? [p[1], p[0]] : p;
    if (i >= 0 && j > i && j - i < 90) {
      const seg = clean.slice(i + 5, j).replace(/\d{1,2}\s?[A-Za-z]{3}\.?\s?20\d{2}|\d{1,2}[./-]\d{1,2}[./-]20\d{2}/g, ' ').trim();
      const parts = seg.split(/\s*[→>–]\s*|\s+-\s+/).map(s => s.trim()).filter(Boolean);
      if (parts.length === 2 && parts.every(p => new RegExp(`^${W}(?:\\s${W}){0,2}$`, 'u').test(p))) return fix(parts);
      const words = seg.split(' ').filter(w => new RegExp(`^${W}$`, 'u').test(w) && !isBad(w));
      const groups = [];
      for (const w of words) {
        if (groups.length && /^(Nord|Sud|Est|Vest|Gara|Centrală|Centrala|Central|Centrale|Termini|Hbf|Hauptbahnhof|Bahnhof|Station|Est|Ovest|Mare|Mic|Mică|Bai|Băi|Vechi)$/i.test(w)) groups[groups.length - 1] += ' ' + w;
        else groups.push(w);
      }
      if (groups.length === 2) return fix(groups);
    }
    // 3) each station right after its own time: "22:30 București Nord … 06:10 Cluj Napoca"
    const nameAfter = i => {
      const m = clean.slice(i).match(new RegExp(`^\\S+\\s+(${W}(?:\\s${W}){0,2})`, 'u'));
      return m && !isBad(m[1].split(' ')[0]) ? m[1].trim() : '';
    };
    if (a >= 0 && b >= 0) { const f = nameAfter(a), t = nameAfter(b); if (f && t && f !== t) return [f, t]; }
  }
  // 2) "A → B" / "A - B" anywhere
  const NM = `${W}(?:\\s(?:(?:de|di|del|della|du|la|le|sur|am|an|der|im|pe)\\s)?${W}){0,3}`;   // "Paris Gare de Lyon"
  const st = clean.match(new RegExp(`(${NM})\\s?[→>–]\\s?(${NM})|(${NM})\\s+-\\s+(${NM})`, 'u'));
  if (st) {
    const f = (st[1] || st[3] || '').trim(), t = (st[2] || st[4] || '').trim();
    if (f && t && !isBad(f) && !isBad(t) && !/ticket|issuer|bilet/i.test(f + ' ' + t)) return [f, t];
  }
  // 4) PDFs list the stations as two separate pieces next to each other: "Poznań Główny", "Wrocław Główny"
  if (raw) {
    const pieces = raw.split(/\s{3,}|\n/).map(x => x.trim()).filter(Boolean);
    const isName = x => new RegExp(`^${NAME}$`, 'u').test(x) && !isBad(x.split(' ')[0]) && x.length >= 4
      && !/^(Bilet|Ticket|Informacje|Vasile|Passenger|Pasager|Legenda|Razem|Clasa|Class|Tren|Train)/i.test(x);
    for (let i = 0; i + 1 < pieces.length; i++) if (isName(pieces[i]) && isName(pieces[i + 1]) && pieces[i] !== pieces[i + 1]) return [pieces[i], pieces[i + 1]];
  }
  return null;
}
// fill only the empty fields of the draft; returns the list of what was filled
function applyTicket(d, p) {
  const got = [];
  const isNew = !(d.title || '').trim();
  if (p.type && isNew) { d.type = p.type; got.push(TT[p.type].label.toLowerCase()); }
  if (p.title && isNew) d.title = p.title;
  if (p.from && !d.from) { d.from = p.from; d.to = d.to || p.to || ''; got.push('traseul'); }
  if (p.time && !d.time) { d.time = p.time; got.push('ora'); }
  if (p.endTime && !d.endTime) d.endTime = p.endTime;
  if (p.day && !d.day) { d.day = p.day; got.push('ziua'); }
  if (p.ref && !d.ref) { d.ref = p.ref; got.push('codul'); }
  if (p.cost && !parseAmount(d.costText)) { d.costText = String(p.cost).replace('.', ','); if (p.currency) d.currency = p.currency; got.push('prețul'); }
  return got;
}

// ---------- screens ----------
function currentTrip() { const e = ui.trip?.id ? entryById(ui.trip.id) : null; return e?.trip ? e : null; }

function screenTrips(c) {
  const open = currentTrip();
  if (open && open.cat === c.id) return screenTripDetail(c, open);
  ui.trip = null;
  const col = colorOf(c);
  const trips = db.entries.filter(e => e.cat === c.id && e.trip).sort((a, b) => a.trip.start.localeCompare(b.trip.start));
  const by = { now: [], future: [], past: [] };
  trips.forEach(e => by[tripStatus(e.trip).state].push(e));
  by.past.reverse();
  const card = e => {
    const t = e.trip, st = tripStatus(t), items = tripItems(t);
    const tickets = items.filter(i => i.ref || (i.files || []).length).length;
    const packed = (t.packing || []).length ? `${t.packing.filter(p => p.done).length}/${t.packing.length} în bagaj` : '';
    return `<div class="swipe" data-swipe="trip" data-id="${e.id}"><button class="swipe-del" data-act="tr-del-trip" data-id="${e.id}">${ICON.trash}<span>Șterge</span></button>
      <div class="tripcard swipe-content" data-act="tr-open" data-id="${e.id}" style="--c:${col}">
        <div class="tc-emoji">${t.emoji || '✈️'}</div>
        <div class="tc-body"><div class="tc-dest">${esc(t.dest)}</div><div class="tc-dates">${esc(tripRange(t))}</div>
          <div class="chips">${chip(st.text, st.color)}${items.length ? chip(`${items.length} în program`, 'var(--muted)') : ''}${tickets ? chip(`🎫 ${tickets}`, 'var(--purple)') : ''}${packed ? chip('🧳 ' + packed, 'var(--orange)') : ''}</div></div>
        <span class="chev">${ICON.chev}</span></div></div>`;
  };
  const sec = (title, list) => list.length ? `<div class="sec-title">${title}</div><div class="tripcards">${list.map(card).join('')}</div>` : '';
  return `
    <div class="topbar"><div class="left"><button class="back" data-act="back">${ICON.back}Liste</button></div>
      <div class="right"><button class="iconbtn fill" style="background:${col}" data-act="tr-new" data-id="${c.id}">${ICON.plus}</button></div></div>
    <h1><span class="emo">${c.icon}</span>${esc(c.name)}</h1>
    ${!trips.length ? `<div class="empty"><div class="big">🧳</div><b>Nicio vacanță încă</b></div>` : ''}
    ${sec('Acum în vacanță', by.now)}${sec('Urmează', by.future)}${sec('Trecute', by.past)}`;
}

function itemRow(it, opts = {}) {
  const tt = TT[it.type] || TT.note;
  const chips = [];
  if (isTransport(it.type) && (it.from || it.to)) chips.push(chip(`${it.from || '?'} → ${it.to || '?'}`, 'var(--blue)'));
  if (it.ref) chips.push(chip('🎫 ' + it.ref, 'var(--purple)'));
  if (it.place && !isTransport(it.type)) chips.push(chip('📍 ' + it.place, 'var(--muted)'));
  if (it.cost) chips.push(chip(money(it.cost, it.currency) + (it.paid ? ' ✓' : ''), it.paid ? 'var(--green)' : 'var(--orange)'));
  if ((it.files || []).length) chips.push(chip(`📎 ${it.files.length}`, 'var(--muted)'));
  if (opts.showDay && it.day) chips.push(chip(fmtDay(dayOf(it.day)), 'var(--muted)'));
  const row = `<div class="row trow ${opts.swipe ? 'swipe-content' : ''} ${it.done ? 'done' : ''}" data-act="tr-item" data-iid="${it.id}">
    <button class="check ${it.done ? 'on' : ''}" style="--c:var(--accent)" data-act="tr-done" data-iid="${it.id}" aria-label="Făcut">${ICON.check}</button>
    <div class="ticon">${tt.icon}</div>
    <div class="rbody"><div class="rtitle">${esc(it.title || tt.label)}</div>${it.notes ? `<div class="rdetails">${esc(it.notes)}</div>` : ''}
      ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}</div>
    ${it.time ? `<div class="dtime">${esc(it.time)}${it.endTime ? `<div class="tend">${esc(it.endTime)}</div>` : ''}</div>` : ''}
  </div>`;
  if (!opts.swipe) return row;
  return `<div class="swipe" data-swipe="titem" data-id="${it.id}"><button class="swipe-del" data-act="swipe-del" data-kind="titem" data-id="${it.id}">${ICON.trash}<span>Șterge</span></button>${row}</div>`;
}

function screenTripDetail(c, e) {
  const t = e.trip, col = colorOf(c), st = tripStatus(t);
  const view = ui.trip.view || 'program';
  const views = [['program', 'Program'], ['bilete', 'Bilete'], ['bagaj', 'Bagaj'], ['buget', 'Buget']];
  let body = '';
  if (view === 'program') body = tripProgramHtml(e);
  else if (view === 'bilete') body = tripTicketsHtml(e);
  else if (view === 'bagaj') body = tripPackingHtml(e);
  else body = tripBudgetHtml(e);
  return `
    <div class="topbar"><div class="left"><button class="back" data-act="back">${ICON.back}${esc(c.name)}</button></div>
      <div class="right"><button class="iconbtn" data-act="tr-menu" data-id="${e.id}">${ICON.more}</button>
      <button class="iconbtn fill" style="background:${col}" data-act="tr-add" data-day="">${ICON.plus}</button></div></div>
    <h1><span class="emo">${t.emoji || '✈️'}</span>${esc(t.dest)}</h1>
    <div class="sub" style="margin-top:-6px">${esc(tripRange(t))} · <span style="color:${st.color};font-weight:700">${esc(st.text)}</span></div>
    <div class="seg">${views.map(([k, l]) => `<button class="${view === k ? 'on' : ''}" data-act="tr-view" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="sl-in">${body}</div>`;
}

function tripProgramHtml(e) {
  const t = e.trip, items = tripItems(t);
  const today = new Date();
  const days = tripDays(t).map((d, i) => {
    const k = dkey(d);
    const list = sortByTime(items.filter(it => it.day === k));
    return `<div class="sec-title ${sameDay(d, today) ? 'orange' : ''}" ${sameDay(d, today) ? 'id="tr-today"' : ''}>Ziua ${i + 1} · ${esc(cap(fLong.format(d)))}${sameDay(d, today) ? ' · azi' : ''}</div>
      <div class="group">${list.map(it => itemRow(it, { swipe: true })).join('')}
        <button class="linkrow" data-act="tr-add" data-day="${k}">${ICON.plus} Adaugă în ziua ${i + 1}</button></div>`;
  }).join('');
  // ideas: places you want to try, not on a day yet
  const ideas = items.filter(it => !it.day && it.type !== 'doc');
  const groups = [['food', '🍽️ Unde mănânci / bei'], ['visit', '🏛️ De văzut și de făcut'], ['stay', '🏨 Cazare'], ['transport', '🚆 Transport'], ['other', '📝 Altele']];
  const ideasHtml = groups.map(([g, title]) => {
    const list = ideas.filter(it => (TT[it.type]?.group || 'other') === g);
    return list.length ? `<div class="fhead" style="margin-top:14px">${title}</div><div class="group">${sortByTime(list).map(it => itemRow(it, { swipe: true })).join('')}</div>` : '';
  }).join('');
  return `${days}
    <div class="sec-title" style="margin-top:28px">💡 Idei · de programat</div>
    <div class="quickadd" style="--c:var(--accent)">
      <button class="qa-plus" data-act="tr-idea-add" aria-label="Adaugă">${ICON.plus}</button>
      <input id="tr-idea" type="text" placeholder="Scrie și Enter, sau + pentru detalii" autocomplete="off" enterkeyhint="done">
    </div>
    <div class="quick wrap" style="--pink:var(--accent);padding:8px 0 0">${['restaurant', 'cafe', 'museum', 'sight', 'bar', 'beach', 'shop'].map(k => `<button data-act="tr-idea-type" data-v="${k}" class="${(ui.trip.ideaType || 'restaurant') === k ? 'on' : ''}">${TT[k].icon} ${TT[k].label}</button>`).join('')}</div>
    ${ideasHtml}`;
}

function tripTicketsHtml(e) {
  const items = tripItems(e.trip);
  // your own order (long-press + drag) wins; otherwise by day and time
  const byOrder = list => [...list].sort((a, b) => {
    const pa = typeof a.tpos === 'number', pb = typeof b.tpos === 'number';
    if (pa && pb) return a.tpos - b.tpos;
    if (pa !== pb) return pa ? -1 : 1;
    return (a.day || '9999').localeCompare(b.day || '9999') || (a.time || '').localeCompare(b.time || '');
  });
  const tickets = byOrder(items.filter(it => it.type !== 'doc' && (it.ref || (it.files || []).length || isTransport(it.type) || it.type === 'hotel' || it.type === 'museum' || it.type === 'event')));
  const docs = byOrder(items.filter(it => it.type === 'doc'));
  // swipe right = delete (with confirmation), long-press + drag = move
  const card = it => {
    const tt = TT[it.type] || TT.note;
    return `<div class="swipe tk-wrap" data-swipe="titem" data-reorder="titem" data-id="${it.id}">
      <button class="swipe-del" data-act="swipe-del" data-kind="titem" data-id="${it.id}">${ICON.trash}<span>Șterge</span></button>
      <div class="ticket swipe-content" data-act="tr-item" data-iid="${it.id}">
      <div class="tk-top"><span class="tk-ico">${tt.icon}</span><div class="tk-main"><div class="tk-title">${esc(it.title || tt.label)}</div>
        <div class="tk-when">${it.day ? esc(cap(fLong.format(dayOf(it.day)))) : 'Fără dată'}${it.time ? ' · ' + esc(it.time) : ''}${it.endTime ? '–' + esc(it.endTime) : ''}</div></div></div>
      ${isTransport(it.type) && (it.from || it.to) ? `<div class="tk-route"><b>${esc(it.from || '—')}</b><span>→</span><b>${esc(it.to || '—')}</b></div>` : ''}
      ${it.ref ? `<div class="tk-ref"><span>Cod / loc / poartă</span><b>${esc(it.ref)}</b></div>` : ''}
      ${(it.files || []).length ? `<div class="tk-files">${it.files.map(f => `<button class="tk-file" data-act="tr-file-open" data-fid="${f.id}" data-thumb="${f.id}" data-kind="${f.type.startsWith('image/') ? 'image' : 'doc'}">${f.type.startsWith('image/') ? '' : '📄'}</button>`).join('')}</div>` : ''}
    </div></div>`;
  };
  return `
    <button class="btn block" data-act="tr-tickets-files">📎 Adaugă bilete din fișiere (PDF sau poze)</button>
    ${tickets.length ? `<div class="tk-list">${tickets.map(card).join('')}</div>` : `<div class="empty"><div class="big">🎫</div><b>Niciun bilet încă</b></div>`}
    <div class="sec-title" style="margin-top:24px">📄 Documente</div>
    ${docs.length ? `<div class="tk-list">${docs.map(card).join('')}</div>` : ''}

    <button class="btn light block mt" data-act="tr-add-doc">＋ Adaugă document</button>`;
}

function tripPackingHtml(e) {
  const t = e.trip;
  const list = (t.packing ||= []);
  const done = list.filter(p => p.done).length;
  const have = new Set(list.map(p => norm(p.title)));
  const sugg = packTemplate().filter(x => !have.has(norm(x)));
  return `
    ${list.length ? `<div class="medtoday" style="--c:var(--orange)"><div><div class="mt-l">În bagaj</div><div class="mt-v">${done} din ${list.length}</div></div>
      <div class="mt-bar"><span style="width:${Math.round(done / list.length * 100)}%"></span></div></div>`
      : `<button class="btn block" style="background:var(--orange)" data-act="tr-pack-std">🧳 Pune lista mea standard (${packTemplate().length})</button>`}
    <div class="quickadd mt" style="--c:var(--orange)">
      <button class="qa-plus" data-act="tr-pack-add" aria-label="Adaugă">${ICON.plus}</button>
      <input id="tr-pack" type="text" placeholder="Mai iei ceva pentru vacanța asta?" autocomplete="off" enterkeyhint="done">
    </div>
    <div class="qa-links"><button data-act="tr-pack-edit">✏️ Lista mea standard</button></div>
    ${sugg.length && list.length ? `<div class="sl-title" style="margin:10px 4px 8px">Din lista standard · atinge ca să adaugi</div>
      <div class="quick wrap" style="--pink:var(--orange);padding:0">${sugg.map(x => `<button data-act="tr-pack-sugg" data-v="${esc(x)}">＋ ${esc(x)}</button>`).join('')}</div>` : ''}
    ${list.length ? `<div class="sec-title">De pus în bagaj</div><div class="group">${list.map(p => `
      <div class="row ${p.done ? 'done' : ''}" data-act="tr-pack-toggle" data-pid="${p.id}">
        <button class="check ${p.done ? 'on' : ''}" style="--c:var(--orange)" data-act="tr-pack-toggle" data-pid="${p.id}">${ICON.check}</button>
        <div class="rbody"><div class="rtitle">${esc(p.title)}</div></div>
        <button class="x" data-act="tr-pack-del" data-pid="${p.id}" style="color:var(--muted);font-size:16px;width:30px">✕</button></div>`).join('')}</div>` : ''}`;
}

function tripBudgetHtml(e) {
  const t = e.trip;
  const items = tripItems(t).filter(it => +it.cost > 0);
  const pairs = l => l.map(it => [+it.cost, it.currency || t.currency || 'EUR']);
  const paid = items.filter(it => it.paid), unpaid = items.filter(it => !it.paid);
  const groups = [['transport', '🚆 Transport'], ['stay', '🏨 Cazare'], ['visit', '🏛️ Vizite și activități'], ['food', '🍽️ Mâncare și băutură'], ['other', '🛍️ Altele']];
  return `
    <div class="tiles">
      ${tile('Total', totals(pairs(items)), 'var(--accent)')}
      ${tile('Plătit deja', totals(pairs(paid)), 'var(--green)')}
      ${tile('De plătit', totals(pairs(unpaid)), 'var(--orange)')}
      ${tile('Pe zi', tripDays(t).length && items.length ? totals(pairs(items).map(([a, cur]) => [a / tripDays(t).length, cur])) : '–', 'var(--blue)')}
    </div>
    ${groups.map(([g, title]) => {
      const l = items.filter(it => (TT[it.type]?.group || 'other') === g);
      return l.length ? `<div class="sec-title">${title} · ${esc(totals(pairs(l)))}</div><div class="group">${l.map(it => itemRow(it, { showDay: true })).join('')}</div>` : '';
    }).join('')}
    ${!items.length ? '<div class="empty"><div class="big">💶</div><b>Încă nu ai costuri</b></div>' : ''}`;
}

// ---------- Azi: today's plan while you're on holiday ----------
function tripTodayHtml() {
  const today = dkey(new Date());
  const out = [];
  for (const e of db.entries) {
    if (!e.trip || !isTripCat(catById(e.cat)) || tripStatus(e.trip).state !== 'now') continue;
    const list = sortByTime(tripItems(e.trip).filter(it => it.day === today));
    out.push(`<div class="sec-title" style="color:var(--text);font-size:15px;text-transform:none;margin-top:24px">${e.trip.emoji || '✈️'} Azi în ${esc(e.trip.dest)} · ${esc(tripStatus(e.trip).text)}</div>
      <div class="group">${list.length ? list.map(it => itemRow(it).replace('data-act="tr-item"', `data-act="tr-goto" data-id="${e.id}"`)).join('') : `<button class="linkrow" data-act="tr-goto" data-id="${e.id}">${ICON.plus} Fă-ți programul pentru azi</button>`}</div>`);
  }
  return out.join('');
}

// ---------- sheets: trip editor, item editor, file viewer ----------
function tripSheetHtml(type) {
  const s = ui.sheet;
  if (type === 'tripedit') {
    const d = s.d;
    return `<div class="overlay"></div><div class="panel">
      <div class="panel-head"><button data-act="sheet-close">Renunță</button><div class="t">${s.isNew ? 'Vacanță nouă' : 'Editează vacanța'}</div>
        <button class="save" data-act="tr-save-trip" ${d.dest.trim() ? '' : 'disabled'}>Salvează</button></div>
      <div class="panel-body">
        <div class="form"><div class="field"><input type="text" id="f-title" class="titlein" data-tb="dest" placeholder="Unde mergi? (ex. Roma)" value="${esc(d.dest)}"></div></div>
        <div class="tr-emojis">${TRIP_EMOJIS.map(x => `<button class="${d.emoji === x ? 'on' : ''}" data-act="tr-emoji" data-v="${x}">${x}</button>`).join('')}</div>
        <div class="fhead">Când</div>
        <div class="form">
          <div class="field"><span class="lbl">Plecare</span><input type="date" data-tb="start" value="${esc(d.start)}"></div>
          <div class="field"><span class="lbl">Întoarcere</span><input type="date" data-tb="end" value="${esc(d.end)}"></div>
        </div>
        <div class="form" style="margin-top:14px">
          <div class="field"><span class="lbl">Moneda locală</span><select data-tb="currency">${TRIP_CURRENCIES.map(x => `<option ${x === d.currency ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          <div class="field"><input type="text" data-tb="notes" placeholder="Notițe" value="${esc(d.notes || '')}"></div>
        </div>
        ${!s.isNew ? '<button class="btn red block mt" data-act="tr-del-trip-sheet">Șterge vacanța</button>' : ''}
      </div></div>`;
  }
  if (type === 'tripitem') {
    const d = s.d, e = entryById(s.tripId), t = e.trip;
    const tt = TT[d.type] || TT.note;
    const tr = isTransport(d.type);
    const hint = TRIP_HINTS[d.type];
    return `<div class="overlay"></div><div class="panel">
      <div class="panel-head"><button data-act="sheet-close">Renunță</button><div class="t">${s.isNew ? 'Adaugă' : 'Editează'}</div>
        <button class="save" data-act="tr-save-item">Salvează</button></div>
      <div class="panel-body">
        <div class="tr-types">${TRIP_TYPES.map(([k, ic, lbl]) => `<button class="${d.type === k ? 'on' : ''}" data-act="tr-type" data-v="${k}"><span>${ic}</span>${esc(lbl.split(' (')[0].split(' / ')[0])}</button>`).join('')}</div>
        <div class="form" style="margin-top:12px">
          <div class="field"><input type="text" id="f-title" class="titlein" data-tb="title" placeholder="${esc(tt.label)}${hint ? ' (ex. ' + hint[0] + ')' : d.type === 'restaurant' ? ' (ex. Da Enzo)' : d.type === 'hotel' ? ' (ex. Hotel Roma)' : ''}" value="${esc(d.title)}"></div>
          <div class="field"><input type="text" data-tb="notes" placeholder="Detalii (opțional)" value="${esc(d.notes || '')}"></div>
        </div>
        <div class="fhead">Când</div>
        <div class="tr-days">
          <button class="${!d.day ? 'on' : ''}" data-act="tr-day" data-v=""><b>Idee</b><span>neprogramat</span></button>
          ${tripDays(t).map((x, i) => { const k = dkey(x), p = fLong.format(x).split(', ');
            return `<button class="${d.day === k ? 'on' : ''}" data-act="tr-day" data-v="${k}"><b>Ziua ${i + 1}</b><span>${esc(p[0])}<br>${esc(p[1] || '')}</span></button>`; }).join('')}
        </div>
        <div class="form" style="margin-top:10px">
          <label class="field plainrow ${d.time ? 'has' : ''}"><span class="lbl">${tr ? 'Plecare' : d.type === 'hotel' ? 'Check-in' : 'Ora'}</span><input type="time" class="plaintime" data-tb="time" value="${esc(d.time || '')}"></label>
          <label class="field plainrow ${d.endTime ? 'has' : ''}"><span class="lbl">${tr ? 'Sosire' : d.type === 'hotel' ? 'Check-out' : 'Până la'}</span><input type="time" class="plaintime" data-tb="endTime" value="${esc(d.endTime || '')}"></label>
        </div>
        ${tr ? `<div class="fhead">Traseu</div><div class="form">
          <div class="field"><input type="text" data-tb="from" placeholder="De la${hint ? ' (ex. ' + hint[1] + ')' : ''}" value="${esc(d.from || '')}"></div>
          <div class="field"><input type="text" data-tb="to" placeholder="Până la${hint ? ' (ex. ' + hint[2] + ')' : ''}" value="${esc(d.to || '')}"></div></div>` : ''}
        ${d.type !== 'note' ? `<div class="fhead">${tr ? 'Rezervare' : 'Loc și rezervare'}</div><div class="form">
          ${!tr ? `<div class="field"><input type="text" data-tb="place" placeholder="Adresă sau loc (pentru hărți)" value="${esc(d.place || '')}"></div>` : ''}
          <div class="field"><input type="text" data-tb="ref" placeholder="Cod rezervare / loc / poartă" value="${esc(d.ref || '')}" autocapitalize="characters"></div>
          ${!tr && (d.place || d.title) ? `<a class="linkrow" href="${mapsUrl(d.place || (d.title + ' ' + t.dest))}" target="_blank" rel="noopener">🗺️ Deschide în Hărți</a>` : ''}
        </div>` : ''}
        <div class="fhead">Cost</div>
        <div class="form">
          <div class="field"><input type="text" inputmode="decimal" class="amountin" data-tb="costText" placeholder="Preț (opțional)" value="${esc(d.costText || '')}">
            <select data-tb="currency" style="max-width:90px">${TRIP_CURRENCIES.map(x => `<option ${x === d.currency ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          <div class="field"><span class="lbl">Plătit deja</span>${trSw('paid', d.paid)}</div>
        </div>
        ${(() => { const fk = fileKind(d.type); if (!fk && !(d.files || []).length) return '';
          return `<div class="fhead">${fk ? fk.head : 'Fișiere'}</div>
        <div class="form">
          ${(d.files || []).map(f => `<div class="field"><span class="ico">${f.type.startsWith('image/') ? '🖼️' : '📄'}</span>
            <button class="lbl" style="text-align:left;color:var(--accent)" data-act="tr-file-open" data-fid="${f.id}">${esc(f.name)}</button>
            <button class="x" data-act="tr-file-del" data-fid="${f.id}" style="color:var(--muted);font-size:16px;width:30px">✕</button></div>`).join('')}
          ${fk ? `<button class="linkrow" data-act="tr-file-add">📎 ${fk.add}</button>` : ''}
        </div>
`; })()}
        ${!s.isNew ? `<div class="form" style="margin-top:20px"><div class="field"><span class="lbl">Făcut</span>${trSw('done', d.done)}</div></div>
          <button class="btn red block mt" data-act="tr-del-item">Șterge</button>` : ''}
      </div></div>`;
  }
  if (type === 'trippack') {
    const list = packTemplate();
    return `<div class="overlay"></div><div class="panel">
      <div class="panel-head"><button data-act="sheet-close">Gata</button><div class="t">Lista mea standard</div><span style="min-width:70px"></span></div>
      <div class="panel-body">
        <div class="form sublist">${list.map((x, i) => `<div class="subedit" data-row="${i}">
          <span style="width:20px;text-align:center">🧳</span>
          <input type="text" value="${esc(x)}" data-tb="pk:${i}">
          <button class="x" data-act="tr-pk-del" data-i="${i}" aria-label="Șterge">✕</button>
          <span class="handle" data-drag="${i}">${ICON.grip}</span></div>`).join('')}</div>
        <div class="form"><div class="subedit"><span style="color:var(--orange);font-size:22px;width:20px;text-align:center">+</span>
          <input type="text" id="tr-pk-new" placeholder="Adaugă în lista standard" enterkeyhint="next"></div></div>
        <button class="btn light block mt" data-act="tr-pk-reset">Revino la lista inițială</button>
      </div></div>`;
  }
  if (type === 'tripfile') {
    return `<div class="overlay"></div><div class="panel">
      <div class="panel-head"><button data-act="sheet-close">Închide</button><div class="t">${esc(s.name || 'Bilet')}</div><span style="min-width:70px"></span></div>
      <div class="panel-body" style="padding:0 0 30px">
        ${s.url ? (s.isImage ? `<img src="${s.url}" alt="" style="width:100%;display:block;pointer-events:auto">` :
          `<iframe src="${s.url}" style="width:100%;height:75dvh;border:0;background:#fff"></iframe>
           <a class="btn block mt" href="${s.url}" target="_blank" rel="noopener" style="margin:12px 16px 0">Deschide documentul</a>`) : '<div class="empty">Fișierul nu mai există pe telefon.</div>'}
      </div></div>`;
  }
  return '';
}
const trSw = (field, on) => `<label class="sw"><input type="checkbox" data-tb="${field}" ${on ? 'checked' : ''}><span></span></label>`;

// ---------- actions ----------
function openTripEditor(catId, tripId) {
  const e = tripId ? entryById(tripId) : null;
  const t = e?.trip;
  const today = new Date();
  ui.sheet = { type: 'tripedit', isNew: !e, catId, tripId,
    d: { dest: t?.dest || '', emoji: t?.emoji || '🏖️', start: t?.start || dkey(addDays(today, 14)), end: t?.end || dkey(addDays(today, 18)), currency: t?.currency || 'EUR', notes: t?.notes || '' } };
  renderSheet();
  if (!e) setTimeout(() => document.getElementById('f-title')?.focus(), 300);
}
function openTripItem(tripId, itemId, day, type) {
  const e = entryById(tripId);
  const it = itemId ? tripItems(e.trip).find(x => x.id === itemId) : null;
  ui.sheet = { type: 'tripitem', tripId, isNew: !it,
    d: it ? { ...clone(it), costText: it.cost ? String(it.cost).replace('.', ',') : '' }
      : { id: null, type: type || (day ? 'sight' : 'restaurant'), title: '', notes: '', day: day || '', time: '', endTime: '', from: '', to: '', place: '', ref: '', costText: '', currency: e.trip.currency || 'EUR', paid: false, files: [], done: false } };
  renderSheet();
}
function saveTripItem() {
  const s = ui.sheet, d = s.d, e = entryById(s.tripId);
  const items = tripItems(e.trip);
  const data = { type: d.type, title: (d.title || '').trim(), notes: (d.notes || '').trim(), day: d.day || '', time: d.time || '', endTime: d.endTime || '',
    from: (d.from || '').trim(), to: (d.to || '').trim(), place: (d.place || '').trim(), ref: (d.ref || '').trim(),
    cost: parseAmount(d.costText), currency: d.currency, paid: !!d.paid, files: d.files || [], done: !!d.done };
  if (!data.title) data.title = TT[d.type]?.label || 'Activitate';
  if (d.id) Object.assign(items.find(x => x.id === d.id), data);
  else items.push({ id: uid(), createdAt: Date.now(), ...data });
  save(); closeSheet(); toast('Salvat ✓');
}
function pickFiles(cb) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*,application/pdf'; inp.multiple = true;
  inp.onchange = () => cb([...inp.files]);
  inp.click();
}
async function storeFile(f) {
  if (f.size > 25 * 1024 * 1024) { toast('Fișierul e prea mare (max 25 MB)'); return null; }
  const id = 'f' + uid();
  try { await filePut(id, f); } catch (err) { toast('Nu am putut salva fișierul'); return null; }
  try { navigator.storage?.persist?.(); } catch (err) { /* ignore */ }
  return { id, name: f.name || 'bilet', type: f.type || 'application/octet-stream' };
}
// what kind of file makes sense for each type (none for a café, beach, shop or note)
function fileKind(type) {
  const g = TT[type]?.group;
  if (g === 'transport' || ['museum', 'sight', 'event', 'activity', 'tour'].includes(type))
    return { head: 'Bilet', add: 'Adaugă bilet (poză sau PDF)', read: true };
  if (type === 'hotel') return { head: 'Rezervare', add: 'Adaugă rezervarea (poză sau PDF)', read: true };
  if (type === 'restaurant') return { head: 'Rezervare', add: 'Adaugă rezervarea (poză sau PDF)' };
  if (type === 'doc') return { head: 'Document', add: 'Adaugă documentul (poză sau PDF)' };
  return null;
}

// inside the item editor: attach one or more files and fill the empty fields from the first ticket
function addTripFiles() {
  pickFiles(async files => {
    const s = ui.sheet;
    let filled = [];
    for (const f of files) {
      const meta = await storeFile(f);
      if (!meta) continue;
      (s.d.files ||= []).push(meta);
      renderSheet();
      if (!fileKind(s.d.type)?.read) { filled = null; continue; }
      if (!filled.length) {
        toast('Citesc biletul…');
        try {
          const e = entryById(s.tripId), parsed = parseTicket(await ticketText(f), e.trip);
          filled = applyTicket(s.d, parsed);
          const more = (parsed.legs || []).slice(1);
          more.forEach(leg => tripItems(e.trip).push(ticketItem(leg, e.trip, meta, f.name)));
          if (more.length) { save(); filled.push(more.length === 1 ? 'și al doilea tren' : `și încă ${more.length} trenuri`); }
        } catch (err) { /* no text found */ }
      }
    }
    if (ui.sheet === s) renderSheet();
    toast(filled === null ? 'Am salvat fișierul' : filled.length ? `Am completat: ${filled.join(', ')}` : 'Am salvat biletul (n-am găsit date de citit)');
  });
}
// one trip item from what was read on a ticket (one train / flight)
function ticketItem(p, trip, meta, fname) {
  const d = { type: 'event', title: '', notes: '', day: '', time: '', endTime: '', from: '', to: '', place: '', ref: '', costText: '', currency: trip.currency || 'EUR' };
  applyTicket(d, p || {});
  return { id: uid(), createdAt: Date.now(), type: d.type, title: d.title || (fname || 'Bilet').replace(/\.[a-z0-9]+$/i, ''),
    notes: '', day: d.day, time: d.time, endTime: d.endTime, from: d.from, to: d.to, place: '', ref: d.ref,
    cost: parseAmount(d.costText), currency: d.currency, paid: !!parseAmount(d.costText), files: [meta], done: false };
}
// in "Bilete": each chosen file becomes a ticket (one per train when a ticket has several), filled from what's written on it
function addTicketsFromFiles(tripId) {
  pickFiles(async files => {
    const e = entryById(tripId);
    if (!e) return;
    let n = 0;
    toast(files.length > 1 ? `Citesc ${files.length} bilete…` : 'Citesc biletul…');
    for (const f of files) {
      const meta = await storeFile(f);
      if (!meta) continue;
      let parsed = {};
      try { parsed = parseTicket(await ticketText(f), e.trip); } catch (err) { /* keep the file anyway */ }
      for (const leg of (parsed.legs || [parsed])) { tripItems(e.trip).push(ticketItem(leg, e.trip, meta, f.name)); n++; }
      save(); render();
    }
    toast(n ? `Am adăugat ${n === 1 ? 'biletul' : n + ' bilete'} — apasă pe ${n === 1 ? 'el' : 'ele'} ca să verifici datele` : 'Nu am putut adăuga biletele');
  });
}
async function openTripFile(fid) {
  const back = ui.sheet;
  let meta = null;
  for (const e of db.entries) for (const it of e.trip?.items || []) for (const f of it.files || []) if (f.id === fid) meta = f;
  meta ||= (back?.d?.files || []).find(f => f.id === fid);
  const url = await fileUrl(fid).catch(() => null);
  ui.sheet = { type: 'tripfile', url, name: meta?.name, isImage: (meta?.type || '').startsWith('image/'), back: back?.type === 'tripitem' ? back : null };
  renderSheet();
}

// the trip that holds an item (also when you tap it from the Azi screen)
function tripOfItem(iid) { return db.entries.find(e => e.trip && tripItems(e.trip).some(x => x.id === iid)); }

function tripClick(act, el) {
  const s = ui.sheet;
  const cur = currentTrip() || (el.dataset.iid ? tripOfItem(el.dataset.iid) : null);
  switch (act) {
    case 'tr-new': openTripEditor(el.dataset.id); break;
    case 'tr-open': ui.trip = { id: el.dataset.id, view: 'program' }; render(); scroller().scrollTo(0, 0);
      setTimeout(() => document.getElementById('tr-today')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120); break;
    case 'tr-goto': { const e = entryById(el.dataset.id); if (e) { ui.tab = 'lists'; ui.catId = e.cat; ui.trip = { id: e.id, view: 'program' }; render(); scroller().scrollTo(0, 0);
      setTimeout(() => document.getElementById('tr-today')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120); } break; }
    case 'tr-view': ui.trip.view = el.dataset.v; render(); break;
    case 'tr-menu': openActions(cur?.trip.dest || '', [
      { label: '✏️ Editează vacanța', run: () => openTripEditor(cur.cat, cur.id) },
      { label: '🧳 Pune lista mea standard la bagaj', run: () => { addStandardPacking(cur); ui.trip.view = 'bagaj'; render(); } },
      { label: '🗑 Șterge vacanța', danger: true, run: () => confirmDeleteTrip(cur.id) },
    ]); break;
    case 'tr-emoji': s.d.emoji = el.dataset.v; renderSheet(); break;
    case 'tr-save-trip': {
      const d = s.d;
      if (!d.dest.trim()) return;
      if (d.end < d.start) d.end = d.start;
      let e = s.tripId ? entryById(s.tripId) : null;
      if (!e) {
        e = { id: uid(), createdAt: Date.now(), cat: s.catId, title: d.dest.trim(), details: '', group: '', done: false, hasDeadline: false, hasReminder: false,
          hasAmount: false, amount: 0, currency: 'RON', subs: [], vendor: '', tracking: '', priority: 0, repeat: 'none',
          trip: { items: [], packing: packFromTemplate() } };   // every new trip starts with the standard packing list
        db.entries.push(e);
      }
      Object.assign(e.trip, { dest: d.dest.trim(), emoji: d.emoji, start: d.start, end: d.end, currency: d.currency, notes: d.notes });
      e.title = d.dest.trim();
      save(); closeSheet(); ui.trip = { id: e.id, view: 'program' }; render(); toast('Vacanța e salvată ✓');
      break;
    }
    case 'tr-del-trip': case 'tr-del-trip-sheet': confirmDeleteTrip(el.dataset.id || s?.tripId); break;
    case 'tr-add': openTripItem(cur.id, null, el.dataset.day || ''); break;
    case 'tr-add-doc': openTripItem(cur.id, null, '', 'doc'); break;
    case 'tr-item': openTripItem(cur.id, el.dataset.iid); break;
    case 'tr-done': { const it = tripItems(cur.trip).find(x => x.id === el.dataset.iid); if (it) { it.done = !it.done; save(); render(); } break; }
    case 'tr-type': s.d.type = el.dataset.v; renderSheet(); break;
    case 'tr-day': s.d.day = el.dataset.v; renderSheet(); break;
    case 'tr-save-item': saveTripItem(); break;
    case 'tr-del-item': openActions(`Ștergi „${s.d.title || 'elementul'}”?`, [{ label: '🗑 Șterge', danger: true, run: () => {
      const e = entryById(s.tripId); e.trip.items = tripItems(e.trip).filter(x => x.id !== s.d.id); (s.d.files || []).forEach(f => fileDel(f.id).catch(() => {})); save(); render(); toast('Șters'); } }]); break;
    case 'tr-file-add': addTripFiles(); break;
    case 'tr-tickets-files': addTicketsFromFiles(cur.id); break;
    case 'tr-file-open': openTripFile(el.dataset.fid); break;
    case 'tr-file-del': s.d.files = (s.d.files || []).filter(f => f.id !== el.dataset.fid); fileDel(el.dataset.fid).catch(() => {}); renderSheet(); break;
    case 'tr-idea-type': ui.trip.ideaType = el.dataset.v; render(); document.getElementById('tr-idea')?.focus(); break;
    case 'tr-idea-add': {
      // Enter = quick add; the + opens the full form (address, notes, cost, day…) prefilled with the name and type
      const inp = document.getElementById('tr-idea');
      const title = (inp?.value || '').trim();
      if (inp) { inp.value = ''; inp.blur(); }
      openTripItem(cur.id, null, '', ui.trip.ideaType || 'restaurant');
      if (title) { ui.sheet.d.title = title; renderSheet(); }
      break;
    }
    case 'tr-pack-add': addPack(document.getElementById('tr-pack')?.value); break;
    case 'tr-pack-sugg': addPack(el.dataset.v); break;
    case 'tr-pack-toggle': { const p = (cur.trip.packing || []).find(x => x.id === el.dataset.pid); if (p) { p.done = !p.done; save(); render(); } break; }
    case 'tr-pack-del': cur.trip.packing = (cur.trip.packing || []).filter(x => x.id !== el.dataset.pid); save(); render(); break;
    case 'tr-pack-std': addStandardPacking(cur); render(); break;
    case 'tr-pack-edit': ui.sheet = { type: 'trippack' }; renderSheet(); break;
    case 'tr-pk-del': packTemplate().splice(+el.dataset.i, 1); save(); renderSheet(); break;
    case 'tr-pk-reset': openActions('Revii la lista inițială de bagaj? Modificările tale din lista standard se pierd.', [{ label: 'Revino la lista inițială', danger: true,
      run: () => { db.settings.packTemplate = [...PACK_DEFAULT]; save(); ui.sheet = { type: 'trippack' }; renderSheet(); } }]); break;
  }
}
function addIdea() {
  const cur = currentTrip(), inp = document.getElementById('tr-idea');
  const title = (inp?.value || '').trim();
  if (!cur || !title) return;
  tripItems(cur.trip).push({ id: uid(), createdAt: Date.now(), type: ui.trip.ideaType || 'restaurant', title, notes: '', day: '', time: '', endTime: '',
    from: '', to: '', place: '', ref: '', cost: 0, currency: cur.trip.currency || 'EUR', paid: false, files: [], done: false });
  save(); render(); document.getElementById('tr-idea')?.focus(); toast(`${title} → idei`);
}
function addPack(text) {
  const cur = currentTrip();
  const title = (text || '').trim();
  if (!cur || !title) return;
  const p = (cur.trip.packing ||= []);
  if (!p.some(x => norm(x.title) === norm(title))) p.push({ id: uid(), title, done: false });
  save(); render(); document.getElementById('tr-pack')?.focus();
}
// delete one item of a trip (ticket, activity…) after asking
function confirmDeleteTripItem(iid) {
  const e = tripOfItem(iid);
  const it = e && tripItems(e.trip).find(x => x.id === iid);
  if (!it) return;
  openActions(`Ștergi „${it.title || 'elementul'}”${(it.files || []).length ? ' și fișierele lui' : ''}? Nu se poate anula.`, [{ label: '🗑 Șterge', danger: true, run: () => {
    e.trip.items = tripItems(e.trip).filter(x => x.id !== iid);
    (it.files || []).forEach(f => fileDel(f.id).catch(() => {}));
    save(); render(); toast('Șters');
  } }]);
}
function reorderTripItems(ids) {
  ids.forEach((iid, i) => { const e = tripOfItem(iid); const it = e && tripItems(e.trip).find(x => x.id === iid); if (it) it.tpos = i; });
  save();
}
function addStandardPacking(cur) {
  const p = (cur.trip.packing ||= []);
  const have = new Set(p.map(x => norm(x.title)));
  packTemplate().forEach(x => { if (!have.has(norm(x))) p.push({ id: uid(), title: x, done: false }); });
  save();
}
function confirmDeleteTrip(id) {
  const e = entryById(id);
  if (!e) return;
  openActions(`Ștergi vacanța „${e.trip.dest}” cu tot programul și biletele ei? Nu se poate anula.`, [{ label: '🗑 Șterge vacanța', danger: true, run: () => {
    tripItems(e.trip).forEach(it => (it.files || []).forEach(f => fileDel(f.id).catch(() => {})));
    db.entries = db.entries.filter(x => x.id !== id); ui.trip = null; save(); render(); toast('Vacanța a fost ștearsă');
  } }]);
}
// form fields of the trip sheets (data-tb)
function tripBind(t, isChange) {
  const s = ui.sheet;
  const k = t.dataset.tb;
  if (k.startsWith('pk:')) {   // standard packing list: rename an item
    const i = +k.slice(3), v = t.value.trim();
    if (v) { packTemplate()[i] = v; save(); }
    return true;
  }
  if (!s || !s.d) return false;
  s.d[k] = t.type === 'checkbox' ? t.checked : t.value;
  if (k === 'dest' || k === 'title') { const b = document.querySelector('.panel-head .save'); if (b && k === 'dest') b.disabled = !t.value.trim(); }
  if (isChange && (t.type === 'checkbox' || t.tagName === 'SELECT') && k !== 'currency') renderSheet();
  return true;
}
function tripKey(ev) {
  if (ev.key !== 'Enter') return false;
  if (ev.target.id === 'tr-idea') { ev.preventDefault(); addIdea(); return true; }
  if (ev.target.id === 'tr-pack') { ev.preventDefault(); addPack(ev.target.value); return true; }
  if (ev.target.id === 'tr-pk-new') {
    ev.preventDefault();
    const v = ev.target.value.trim();
    if (v && !packTemplate().some(x => norm(x) === norm(v))) { packTemplate().push(v); save(); }
    renderSheet(); setTimeout(() => document.getElementById('tr-pk-new')?.focus(), 0);
    return true;
  }
  return false;
}
