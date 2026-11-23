/* ZH Story — personal objective map for Kanton Zürich */
'use strict';

/* ---------------- Categories ---------------- */
const ICONS = {
  story:   '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z"/></svg>',
  money:   '<svg viewBox="0 0 24 24"><text x="12" y="19" text-anchor="middle" font-size="19" font-weight="900" font-family="Arial Black,Arial,sans-serif">$</text></svg>',
  vehicle: '<svg viewBox="0 0 24 24"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11a2 2 0 0 1 2 2v4h-2v2h-3v-2H8v2H5v-2H3v-4a2 2 0 0 1 2-2zm2.1 0h9.8l-1-3.2a1 1 0 0 0-1-.8H9.1a1 1 0 0 0-1 .8zM6.5 15.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>',
  personal:'<svg viewBox="0 0 24 24"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z"/></svg>',
  health:  '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.5 1.1 5.2 3 1.7-1.9 3.2-3 5.2-3 3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z"/></svg>',
  social:  '<svg viewBox="0 0 24 24"><path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>',
  errand:  '<svg viewBox="0 0 24 24"><path d="M6 7V6a6 6 0 0 1 12 0v1h3l-1 14H4L3 7zm2 0h8V6a4 4 0 0 0-8 0z"/></svg>',
};
const CATS = {
  story:    {name:'Story',    hint:'Main goals',            color:'#f5c518'},
  money:    {name:'Money',    hint:'Work & income',         color:'#2ecc71'},
  vehicle:  {name:'Vehicle',  hint:'Car, bike, transport',  color:'#3aa0ff'},
  personal: {name:'Personal', hint:'Me, home, life admin',  color:'#ff5fa2'},
  health:   {name:'Health',   hint:'Sport, body, mind',     color:'#ff4d4d'},
  social:   {name:'Social',   hint:'Friends & family',      color:'#b77dff'},
  errand:   {name:'Errands',  hint:'Shopping, pickups',     color:'#ff9f43'},
};
// custom PNG symbols (app/icons/<key>.png) replace the built-in drawings
const ICON_IMG = k => `<img class="ic-img" src="icons/${k}.png" alt="" draggable="false">`;
for (const k in CATS) CATS[k].icon = ICON_IMG(k);

/* ---------------- Helpers ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const fmtDate = t => new Date(t).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
const fmtTime = t => new Date(t).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
const fmtDT = t => `${fmtDate(t)} · ${fmtTime(t)}`;
function fmtDur(ms){
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}
function blip(cat, cls = '', badge = ''){
  const c = CATS[cat];
  return `<div class="blip ${cls}" style="--c:${c.color}">${c.icon}${badge}</div>`;
}

/* ---------------- IndexedDB ---------------- */
const DB = {
  db: null,
  open(){
    return new Promise((res, rej) => {
      const r = indexedDB.open('zh-story', 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('tasks')) d.createObjectStore('tasks', {keyPath:'id'});
        if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos');
        if (!d.objectStoreNames.contains('places')) d.createObjectStore('places', {keyPath:'id'});
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(st, mode, fn){
    return new Promise((res, rej) => {
      const t = this.db.transaction(st, mode);
      const req = fn(t.objectStore(st));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  },
  all(st){ return this.tx(st, 'readonly', s => s.getAll()); },
  allKeys(st){ return this.tx(st, 'readonly', s => s.getAllKeys()); },
  get(st, k){ return this.tx(st, 'readonly', s => s.get(k)); },
  put(st, v, k){ return this.tx(st, 'readwrite', s => k === undefined ? s.put(v) : s.put(v, k)); },
  del(st, k){ return this.tx(st, 'readwrite', s => s.delete(k)); },
};

/* ---------------- Fixed places (headquarter, garage, gym …) ---------------- */
const PLACE_ICONS = {
  hq:     ICON_IMG('hq'),
  home:   '<svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/></svg>',
  garage: '<svg viewBox="0 0 24 24"><path d="M21 7.5a5 5 0 0 1-6.6 4.7L6.7 20a2 2 0 0 1-2.8-2.8l7.8-7.7A5 5 0 0 1 17.6 3l-3 3 .9 2.5 2.5.9z"/></svg>',
  gym:    '<svg viewBox="0 0 24 24"><path d="M1 10h2V8h2v8H3v-2H1zm22 0h-2V8h-2v8h2v-2h2zM6 6h3v12H6zm9 0h3v12h-3zm-6 5h6v2H9z"/></svg>',
  work:   '<svg viewBox="0 0 24 24"><path d="M9 4h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2zm0 3h6V6H9z"/></svg>',
  pin:    '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>',
};
const PLACE_COLORS = ['#39ff14', '#00e5ff', '#ffd400', '#ff2bd6', '#ff6a00', '#ffffff'];
const HQ_DEFAULT = {id:'hq', hq:true, name:'Headquarter', icon:'hq', color:'#39ff14', lat:47.3614084, lng:8.6375598};
let places = [];
let openPlaceId = null;   // place whose objectives are fanned out in a ring
const placeById = id => places.find(p => p.id === id);
const hq = () => placeById('hq') || HQ_DEFAULT;
function placeIcon(p, cls = '', badge = 0){
  const b = badge ? `<span class="badge">${badge > 99 ? '99+' : badge}</span>` : '';
  return `<div class="place ${p.hq ? 'hq' : ''} ${cls}" style="--c:${p.color}">${PLACE_ICONS[p.icon] || PLACE_ICONS.pin}${b}</div>`;
}
async function savePlace(p){
  await DB.put('places', p);
  // keep objectives stored at this place in sync with its position / name
  for (const t of tasks){
    let changed = false;
    for (const s of t.steps) if (s.placeId === p.id){ s.lat = p.lat; s.lng = p.lng; s.place = p.name; changed = true; }
    if (changed) await DB.put('tasks', t);
  }
}

/* ---------------- State ---------------- */
let tasks = [];
let mode = store.get('mode', 'all');
let selectedId = null;
let meLatLng = null;
const photoUrls = new Map();

async function photoUrl(id){
  if (!id) return null;
  if (photoUrls.has(id)) return photoUrls.get(id);
  const b = await DB.get('photos', id);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  photoUrls.set(id, u);
  return u;
}
// active = on the map right now; waiting = recurring objectives outside their window
const active = () => tasks.filter(t => t.status === 'active' && isShown(t));
const waiting = () => tasks.filter(t => t.status === 'active' && !isShown(t));
const done = () => tasks.filter(t => t.status === 'done');
const visible = () => active().filter(t => mode === 'all' || t.cat === mode);
async function saveTask(t){ await DB.put('tasks', t); }

/* ---------------- Map ---------------- */
const ZH = L.latLngBounds([47.155, 8.355], [47.70, 8.99]);
const map = L.map('map', {
  zoomControl:false, zoomSnap:1, minZoom:9, maxZoom:19,   // whole zoom levels = tiles never stretched
  maxBounds:ZH.pad(.35), maxBoundsViscosity:.9, attributionControl:true,
});
const START_ZOOM = 15;
map.setView([HQ_DEFAULT.lat, HQ_DEFAULT.lng], START_ZOOM);
map.attributionControl.setPrefix(false);

map.createPane('labels'); map.getPane('labels').style.zIndex = 390; map.getPane('labels').style.pointerEvents = 'none';
map.createPane('mask');   map.getPane('mask').style.zIndex = 395;   map.getPane('mask').style.pointerEvents = 'none';

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
// sharp on iPhone: on high-density screens load one zoom level deeper at half size (detectRetina).
// maxNativeZoom = deepest level the source has, minus 1 on retina because of that offset.
const RETINA = L.Browser.retina;
const sharp = (deepest, extra) => ({detectRetina:true, maxZoom:20, maxNativeZoom:RETINA ? deepest - 1 : deepest, ...extra});
const LAYERS = {
  // neon look: wide soft halo (bottom) + tight halo (middle) + crisp streets on top (blended with "lighten")
  atlas:  {name:'Atlas', base:L.tileLayer(ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', sharp(16, {className:'base-tiles', zIndex:3, attribution:'&copy; Esri, HERE, ' + OSM})),
           glow:L.tileLayer(ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', sharp(16, {className:'glow-tiles', zIndex:2})),
           glowWide:L.tileLayer(ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', sharp(16, {className:'glow-wide', zIndex:1})),
           labels:L.tileLayer(ESRI + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {maxZoom:14, pane:'labels'})},
  sat:    {name:'Satellite', base:L.tileLayer('https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg', sharp(19, {className:'base-tiles', attribution:'&copy; swisstopo'})),
           labels:L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, pane:'labels'})},
};
let layerKey = store.get('layer', 'atlas');
let showLabels = store.get('labels', true);
function applyLayer(){
  for (const k in LAYERS) for (const p of ['base', 'glow', 'glowWide', 'labels']) LAYERS[k][p] && map.removeLayer(LAYERS[k][p]);
  if (!LAYERS[layerKey]) layerKey = 'atlas';
  const L_ = LAYERS[layerKey];
  if (L_.glowWide) L_.glowWide.addTo(map);
  if (L_.glow) L_.glow.addTo(map);
  L_.base.addTo(map);
  if (showLabels && L_.labels) L_.labels.addTo(map);
  document.body.dataset.layer = layerKey;
}
applyLayer();

/* ---- icon size follows zoom (CSS reads #map[data-z]); HQ is excluded in the CSS ---- */
const setZoomAttr = () => { $('#map').dataset.z = Math.round(map.getZoom()); };
map.on('zoomend', setZoomAttr); setZoomAttr();

/* ---- performance: no glow / vignette blur during zoom animations (pinch or programmatic) ---- */
{
  let t;
  map.on('zoomstart', () => { clearTimeout(t); document.body.classList.add('zooming'); });
  map.on('zoomend', () => { clearTimeout(t); t = setTimeout(() => document.body.classList.remove('zooming'), 120); });
}

/* ---- start-up: a red glow flash (pure CSS); remove the layer once it has played ---- */
setTimeout(() => $('#flash')?.remove(), 2000);

// Canton "island": darken everything outside Kanton Zürich + glowing border
if (window.ZH_BOUNDARY){
  const g = window.ZH_BOUNDARY;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const rings = polys.map(p => p[0].map(([x, y]) => [y, x]));
  const world = [[-85, -180], [85, -180], [85, 180], [-85, 180]];
  L.polygon([world, ...rings], {pane:'mask', stroke:false, fillColor:'#05070f', fillOpacity:.8, interactive:false}).addTo(map);
  rings.forEach(r => {
    L.polyline(r, {pane:'mask', color:'#c0283f', weight:8, opacity:.35, interactive:false}).addTo(map);
    L.polyline(r, {pane:'mask', color:'#ff5a72', weight:1.6, opacity:.9, interactive:false}).addTo(map);
  });
}

// always-visible glowing outlines: Stadt Zürich (light blue → white) and Benglen (neon green like HQ)
const BORDER_STYLE = {
  'Zürich':  {glow:'#6cc8ff', line:'#ffffff', cls:'zh-line'},
  'Benglen': {glow:'#39ff14', line:'#39ff14', cls:''},
};
for (const b of window.EXTRA_BORDERS || []){
  const st = BORDER_STYLE[b.name] || BORDER_STYLE.Benglen;
  const polys = b.geo.type === 'Polygon' ? [b.geo.coordinates] : b.geo.coordinates;
  for (const p of polys){
    const ring = p[0].map(([x, y]) => [y, x]);
    L.polyline(ring, {pane:'mask', color:st.glow, weight:10, opacity:.18, interactive:false}).addTo(map);
    L.polyline(ring, {pane:'mask', color:st.glow, weight:5, opacity:.4, interactive:false}).addTo(map);
    L.polyline(ring, {pane:'mask', color:st.line, weight:1.8, opacity:1, interactive:false, className:st.cls}).addTo(map);
  }
}
// SVG gradient used by .zh-line (defined inside the pane's SVG so url(#zhGrad) resolves)
{
  const svg = map.getPane('mask').querySelector('svg');
  if (svg){
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = '<linearGradient id="zhGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fd6ff"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#7fd6ff"/></linearGradient>';
    svg.insertBefore(defs, svg.firstChild);
  }
}

const markers = L.layerGroup().addTo(map);
let meMarker = null;

function taskMarker(t, ll, z = 0){
  const ds = dueState(t);
  const clock = ds ? `<span class="clk ${ds}"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm-1 2h2v4.6l3.2 2-1 1.7L11 12.7z"/></svg></span>` : '';
  const badge = (t.steps.length > 1 ? `<span class="stp">${t.cur + 1}/${t.steps.length}</span>` : '') + clock;
  const icon = L.divIcon({className:'blip-wrap', html:blip(t.cat, t.id === selectedId ? 'sel' : '', badge), iconSize:[34, 34], iconAnchor:[17, 17]});
  return L.marker(ll, {icon, zIndexOffset:z + (t.cat === 'story' ? 500 : 0)}).on('click', () => openMission(t.id));
}

function render(){
  markers.clearLayers();
  const atPlace = {};
  for (const t of visible()){
    const s = t.steps[t.cur];
    if (!s) continue;
    if (s.placeId && placeById(s.placeId)){ (atPlace[s.placeId] ||= []).push(t); continue; }
    taskMarker(t, [s.lat, s.lng]).addTo(markers);
  }
  for (const p of places){
    const list = atPlace[p.id] || [];
    const size = p.hq ? 52 : 40;
    const open = p.id === openPlaceId && list.length;
    const icon = L.divIcon({className:'blip-wrap', html:placeIcon(p, open ? 'open' : '', open ? 0 : list.length), iconSize:[size, size], iconAnchor:[size / 2, size / 2]});
    L.marker([p.lat, p.lng], {icon, zIndexOffset: p.hq ? 3000 : 2500})
      .on('click', () => togglePlace(p, list.length))
      .addTo(markers);
    if (open) drawRing(p, list, size);
  }
  renderModes();
}

// fan the objectives stored at a place out in rings around it
function drawRing(p, list, size){
  const BLIP = 34, GAP = 10, STEP = BLIP + GAP;
  const c = map.latLngToContainerPoint([p.lat, p.lng]);
  const rings = [];
  let left = list.length, r = size / 2 + 14 + BLIP / 2;
  while (left > 0){
    const cap = Math.max(1, Math.floor(2 * Math.PI * r / STEP));
    const n = Math.min(cap, left);
    rings.push({r, n});
    left -= n; r += STEP;
  }
  const outer = rings[rings.length - 1].r + BLIP / 2 + 12;
  const bg = L.divIcon({className:'blip-wrap', html:`<div class="ring-bg" style="--c:${p.color};width:${outer * 2}px;height:${outer * 2}px"></div>`, iconSize:[outer * 2, outer * 2], iconAnchor:[outer, outer]});
  L.marker([p.lat, p.lng], {icon:bg, interactive:false, zIndexOffset:2000}).addTo(markers);
  let i = 0;
  for (const {r, n} of rings){
    const off = rings.length > 1 && r !== rings[0].r ? Math.PI / n : 0;
    for (let k = 0; k < n; k++, i++){
      const a = -Math.PI / 2 + off + k * 2 * Math.PI / n;
      const ll = map.containerPointToLatLng([c.x + r * Math.cos(a), c.y + r * Math.sin(a)]);
      taskMarker(list[i], ll, 4000).addTo(markers);
    }
  }
}
function togglePlace(p, n){
  if (!n){ toast(`${p.name}: no objectives here`); openPlaceId = null; render(); return; }
  openPlaceId = openPlaceId === p.id ? null : p.id;
  if (openPlaceId) map.panTo([p.lat, p.lng]);
  render();
}
map.on('zoomend', () => { if (openPlaceId) render(); });
map.on('click', () => { if (openPlaceId && !pickCb){ openPlaceId = null; render(); } });

/* ---------------- Mode bar ---------------- */
function renderModes(){
  const counts = {};
  active().forEach(t => counts[t.cat] = (counts[t.cat] || 0) + 1);
  const all = active().length;
  let h = `<button class="mode all ${mode === 'all' ? 'on' : ''}" data-m="all" aria-label="All"><span class="ic"></span><span class="n">${all || ''}</span></button>`;
  for (const k in CATS){
    h += `<button class="mode ${mode === k ? 'on' : ''}" data-m="${k}" style="--c:${CATS[k].color}" aria-label="${CATS[k].name}"><span class="ic">${CATS[k].icon}</span><span class="n">${counts[k] || ''}</span></button>`;
  }
  $('#modebar').innerHTML = h;
  $('#modeName').textContent = mode === 'all' ? 'All' : CATS[mode].name;
  const n = visible().length;
  $('#modeCount').textContent = n ? `${n} active` : 'Nothing here — add one';
}
$('#modebar').addEventListener('click', e => {
  const b = e.target.closest('.mode');
  if (!b) return;
  mode = (b.dataset.m === mode && mode !== 'all') ? 'all' : b.dataset.m;
  store.set('mode', mode);
  render();
  const pts = visible().map(t => t.steps[t.cur]).filter(Boolean).map(s => [s.lat, s.lng]);
  if (pts.length > 1) map.flyToBounds(pts, {padding:[80, 90], maxZoom:15, duration:.8});
  else if (pts.length === 1) map.flyTo(pts[0], Math.max(map.getZoom(), 14), {duration:.8});
});

/* ---------------- Sheet ---------------- */
const sheet = $('#sheet'), scrim = $('#scrim');
let onSheetClose = null;
function openSheet(html, mount, onClose){
  $('#sheetBody').innerHTML = html;
  sheet.scrollTop = 0;
  scrim.hidden = false;
  requestAnimationFrame(() => { if (!scrim.hidden) sheet.classList.add('open'); });
  onSheetClose = onClose || null;
  mount && mount($('#sheetBody'));
}
function closeSheet(){
  sheet.classList.remove('open');
  scrim.hidden = true;
  const cb = onSheetClose; onSheetClose = null;
  cb && cb();
  if (selectedId){ selectedId = null; render(); }
}
scrim.addEventListener('click', closeSheet);

/* ---------------- Toast / banner ---------------- */
let toastT;
function toast(msg){
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2600);
}
let bannerT;
function banner(top, main, sub, color){
  const b = $('#banner');
  $('#bTop').textContent = top; $('#bTop').style.color = color || '';
  $('#bMain').textContent = main; $('#bSub').textContent = sub || '';
  b.classList.remove('out'); b.hidden = false;
  b.style.animation = 'none'; b.offsetHeight; b.style.animation = '';
  if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  clearTimeout(bannerT);
  bannerT = setTimeout(() => { b.classList.add('out'); setTimeout(() => b.hidden = true, 500); }, 3000);
}

/* ---------------- New mission flow ---------------- */
let draft = null;

$('#btnAdd').addEventListener('click', () => sheetCategory());

function sheetCategory(){
  let h = `<div class="h grad">New Objective</div><div class="sub">Choose a category</div><div class="catgrid">`;
  for (const k in CATS) h += `<button class="cat" data-k="${k}" style="--c:${CATS[k].color}"><span class="ic">${CATS[k].icon}</span><b>${CATS[k].name}</b></button>`;
  h += `</div>`;
  openSheet(h, b => b.querySelectorAll('.cat').forEach(btn => btn.onclick = () => {
    draft = {id:uid(), cat:btn.dataset.k, title:'', desc:'', steps:[], multi:false, created:Date.now(), cur:0, status:'active'};
    sheetDetails();
  }));
}

/* ---------------- Fixed time, alerts, iPhone calendar ---------------- */
const ALERT_OPTS = [[-1, 'No alert'], [0, 'At time'], [15, '15 min before'], [60, '1 hour before'], [180, '3 hours before'], [1440, '1 day before'], [2880, '2 days before'], [10080, '1 week before']];
const DEFAULT_ALERTS = [60, 1440];
function toLocalInput(ms){ const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
function defaultDue(){ const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime(); }
function dueLabel(ms){
  const now = Date.now(), diff = ms - now, min = Math.round(Math.abs(diff) / 60000);
  if (min < 1) return 'due now';
  const span = min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} days`;
  if (diff < 0) return `overdue ${span}`;
  const d = new Date(ms), today = new Date(), tom = new Date(); tom.setDate(tom.getDate() + 1);
  const hm = fmtTime(ms);
  if (d.toDateString() === today.toDateString()) return `today ${hm} · in ${span}`;
  if (d.toDateString() === tom.toDateString()) return `tomorrow ${hm}`;
  return `${d.toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'})} ${hm} · in ${span}`;
}
const dueState = t => !t.due ? '' : t.due < Date.now() ? 'over' : t.due - Date.now() < 864e5 ? 'soon' : 'later';
const alertText = t => (t.alerts || []).map(m => ALERT_OPTS.find(o => o[0] === m)?.[1]).filter(Boolean).join(' + ') || 'no alerts';

/* ---- recurring ---- */
const REPEAT_OPTS = [['', 'Does not repeat'], ['day', 'Every day'], ['week', 'Every week'], ['2week', 'Every 2 weeks'], ['month', 'Every month'], ['year', 'Every year']];
const SHOW_OPTS = [[0, 'Show on the day'], [1, 'Show 1 day before'], [3, 'Show 3 days before'], [-1, 'Always show (until next)']];
const RRULE = {day:'FREQ=DAILY', week:'FREQ=WEEKLY', '2week':'FREQ=WEEKLY;INTERVAL=2', month:'FREQ=MONTHLY', year:'FREQ=YEARLY'};
const repeatName = r => REPEAT_OPTS.find(o => o[0] === r)?.[1].toLowerCase() || '';
function nextDue(ms, every){
  const d = new Date(ms);
  if (every === 'day') d.setDate(d.getDate() + 1);
  else if (every === 'week') d.setDate(d.getDate() + 7);
  else if (every === '2week') d.setDate(d.getDate() + 14);
  else if (every === 'month') d.setMonth(d.getMonth() + 1);
  else if (every === 'year') d.setFullYear(d.getFullYear() + 1);
  return d.getTime();
}
const dayStart = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayEnd = ms => { const d = new Date(ms); d.setHours(23, 59, 59, 999); return d.getTime(); };
// a recurring objective is only on the map inside its window
function isShown(t){
  if (!t.repeat || !t.due) return true;
  const show = t.repeat.show ?? 0;
  return show < 0 || Date.now() >= dayStart(t.due) - show * 864e5;
}
// missed occurrence (its day is over) → quietly move on to the next one
function rollOver(t){
  if (!t.repeat || !t.due || t.status !== 'active') return false;
  let moved = false;
  while (Date.now() > dayEnd(t.due)){ t.due = nextDue(t.due, t.repeat.every); moved = true; }
  if (moved) resetSteps(t);
  return moved;
}
function resetSteps(t){
  t.cur = 0;
  for (const s of t.steps){ delete s.doneAt; delete s.photoId; delete s.note; }
}
async function rollAll(){
  for (const t of tasks) if (rollOver(t)) await saveTask(t);
}

function timeFields(o){
  const opt = sel => ALERT_OPTS.map(([v, l]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${l}</option>`).join('');
  const a = o.alerts || DEFAULT_ALERTS;
  const rep = o.repeat?.every || '', show = o.repeat?.show ?? 0;
  return `
    <label class="toggle"><span><b>Fixed date &amp; time</b></span><input type="checkbox" id="tOn" ${o.due ? 'checked' : ''}></label>
    <div id="tBox" ${o.due ? '' : 'hidden'}>
      <label class="f">When</label>
      <input class="inp" type="datetime-local" id="tWhen" value="${toLocalInput(o.due || defaultDue())}">
      <label class="f">Calendar alerts</label>
      <div class="row"><select class="inp" id="tA1">${opt(a[0] ?? -1)}</select><select class="inp" id="tA2">${opt(a[1] ?? -1)}</select></div>
      <label class="f">Repeat</label>
      <select class="inp" id="tRep">${REPEAT_OPTS.map(([v, l]) => `<option value="${v}" ${v === rep ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div id="tShowBox" ${rep ? '' : 'hidden'}>
        <label class="f">On the map</label>
        <select class="inp" id="tShow">${SHOW_OPTS.map(([v, l]) => `<option value="${v}" ${v === show ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <div class="sub" style="margin:6px 0 0">Not done by the end of its day? It disappears and comes back for the next one.</div>
      </div>
    </div>`;
}
// wires the fields up and returns a function that writes them into the object
function bindTime(b, o){
  const on = b.querySelector('#tOn'), box = b.querySelector('#tBox'), rep = b.querySelector('#tRep');
  on.onchange = () => box.hidden = !on.checked;
  rep.onchange = () => b.querySelector('#tShowBox').hidden = !rep.value;
  return () => {
    const ms = new Date(b.querySelector('#tWhen').value).getTime();
    if (on.checked && ms){
      o.due = ms;
      o.alerts = [...new Set([+b.querySelector('#tA1').value, +b.querySelector('#tA2').value])].filter(v => v >= 0).sort((x, y) => x - y);
      if (rep.value) o.repeat = {every:rep.value, show:+b.querySelector('#tShow').value}; else delete o.repeat;
    } else { delete o.due; delete o.alerts; delete o.repeat; }
  };
}

function icsFor(t){
  const f = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const e = x => String(x || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
  const s = t.steps[t.cur] || t.steps[0];
  const alarms = (t.alerts || []).flatMap(m => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${e(t.title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM']);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ZH Story//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${t.id}@zh-story`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(t.due)}`, `DTEND:${f(t.due + 36e5)}`,
    `SUMMARY:${e(t.title)}`, `LOCATION:${e(s.place)}`, `DESCRIPTION:${e([CATS[t.cat].name, t.desc].filter(Boolean).join(' – '))}`,
    ...(t.repeat ? [`RRULE:${RRULE[t.repeat.every]}`] : []),
    ...alarms, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
function addToCalendar(t){
  const name = (t.title.replace(/[^\w\- ]+/g, '').trim() || 'objective') + '.ics';
  const url = URL.createObjectURL(new Blob([icsFor(t)], {type:'text/calendar'}));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function offerCalendar(t, back){
  openSheet(`
    <div class="kicker" style="--c:${CATS[t.cat].color}">Reminder</div>
    <div class="h">Add to iPhone calendar?</div>
    <div class="sub">${esc(t.title)}<br>⏰ ${dueLabel(t.due)} · ${alertText(t)}${t.repeat ? `<br>🔁 ${repeatName(t.repeat.every)} – one repeating calendar event` : ''}</div>
    <button class="btn primary block" id="calGo">📅 Add to calendar</button>
    <button class="btn ghost block" id="calNo">${back ? 'Back' : 'Not now'}</button>`,
  b => {
    b.querySelector('#calGo').onclick = () => { addToCalendar(t); back ? back() : closeSheet(); };
    b.querySelector('#calNo').onclick = () => back ? back() : closeSheet();
  });
}

function sheetDetails(){
  const c = CATS[draft.cat];
  openSheet(`
    <div class="kicker" style="--c:${c.color}">${c.name}</div>
    <div class="h">Objective details</div>
    <label class="f">Title</label>
    <input class="inp" id="dTitle" maxlength="80" placeholder="..." value="${esc(draft.title)}">
    <label class="f">Description</label>
    <textarea class="inp" id="dDesc" rows="3" placeholder="...">${esc(draft.desc)}</textarea>
    <label class="toggle"><span><b>Multi-step objective</b><br><small style="color:var(--muted)">Next step appears when one is done</small></span><input type="checkbox" id="dMulti" ${draft.multi ? 'checked' : ''}></label>
    ${timeFields(draft)}
    <button class="btn primary block" id="dNext">Next · Set place</button>
    <button class="btn ghost block" id="dBack">Back</button>`,
  b => {
    const title = b.querySelector('#dTitle'), multi = b.querySelector('#dMulti'), next = b.querySelector('#dNext');
    const readTime = bindTime(b, draft);
    b.querySelector('#dBack').addEventListener('click', readTime);
    next.addEventListener('click', readTime);
    const upd = () => { next.disabled = !title.value.trim(); next.textContent = multi.checked ? 'Next · Add steps' : 'Next · Set place'; };
    title.oninput = upd; multi.onchange = upd; upd();
    setTimeout(() => title.focus(), 300);
    b.querySelector('#dBack').onclick = sheetCategory;
    next.onclick = () => {
      draft.title = title.value.trim();
      draft.desc = b.querySelector('#dDesc').value.trim();
      draft.multi = multi.checked;
      if (!draft.multi){
        const s = draft.steps[0] || {id:uid()};
        s.title = draft.title; s.desc = '';
        draft.steps = [s];
        startPick(draft.cat, s, ok => ok ? finishDraft() : sheetDetails());
      } else {
        if (draft.steps.length === 1 && draft.steps[0].title === draft.title) draft.steps[0].title = '';
        sheetSteps();
      }
    };
  });
}

function sheetSteps(){
  const c = CATS[draft.cat];
  const items = draft.steps.map((s, i) => `
    <div class="step" style="--c:${c.color}" data-i="${i}">
      <span class="num">${i + 1}</span>
      <span class="t"><b>${esc(s.title || 'Untitled step')}</b><small>${s.lat ? '📍 ' + esc(s.place || 'Place set') : 'No place yet'}</small></span>
      <button class="x" data-del="${i}" aria-label="Remove">✕</button>
    </div>`).join('');
  const ready = draft.steps.length > 0 && draft.steps.every(s => s.lat && s.title);
  openSheet(`
    <div class="kicker" style="--c:${c.color}">${c.name} · ${esc(draft.title)}</div>
    <div class="h">Steps</div>
    <div class="sub">Each step has its own place. Only the current one shows on the map.</div>
    <div class="steps">${items || '<div class="empty">No steps yet</div>'}</div>
    <button class="btn block" id="sAdd">+ Add step</button>
    <button class="btn primary block" id="sGo" ${ready ? '' : 'disabled'}>Start objective</button>
    <button class="btn ghost block" id="sBack">Back</button>`,
  b => {
    b.querySelector('#sAdd').onclick = () => sheetStepEdit(draft.steps.length);
    b.querySelector('#sBack').onclick = sheetDetails;
    b.querySelector('#sGo').onclick = finishDraft;
    b.querySelectorAll('[data-del]').forEach(x => x.onclick = e => { e.stopPropagation(); draft.steps.splice(+x.dataset.del, 1); sheetSteps(); });
    b.querySelectorAll('.step').forEach(el => el.onclick = () => sheetStepEdit(+el.dataset.i));
  });
}

function sheetStepEdit(i){
  const c = CATS[draft.cat];
  const s = draft.steps[i] || {id:uid(), title:'', desc:''};
  openSheet(`
    <div class="kicker" style="--c:${c.color}">Step ${i + 1}</div>
    <div class="h">${draft.steps[i] ? 'Edit step' : 'New step'}</div>
    <label class="f">Step</label>
    <input class="inp" id="eTitle" maxlength="80" placeholder="e.g. Book theory exam" value="${esc(s.title)}">
    <label class="f">Details (optional)</label>
    <textarea class="inp" id="eDesc" rows="2">${esc(s.desc)}</textarea>
    <button class="btn primary block" id="eNext">${s.lat ? 'Change place' : 'Set place'}</button>
    ${s.lat ? '<button class="btn block" id="eSave">Save</button>' : ''}
    <button class="btn ghost block" id="eBack">Back</button>`,
  b => {
    const t = b.querySelector('#eTitle'), nx = b.querySelector('#eNext');
    const upd = () => nx.disabled = !t.value.trim(); t.oninput = upd; upd();
    setTimeout(() => t.focus(), 300);
    const commit = () => { s.title = t.value.trim(); s.desc = b.querySelector('#eDesc').value.trim(); draft.steps[i] = s; };
    nx.onclick = () => { commit(); startPick(draft.cat, s, () => sheetSteps()); };
    const sv = b.querySelector('#eSave'); if (sv) sv.onclick = () => { if (t.value.trim()){ commit(); sheetSteps(); } };
    b.querySelector('#eBack').onclick = sheetSteps;
  });
}

async function finishDraft(){
  const t = draft; draft = null;
  delete t.multi;
  tasks.push(t);
  await saveTask(t);
  closeSheet();
  if (mode !== 'all' && mode !== t.cat){ mode = 'all'; store.set('mode', mode); }
  render();
  const s = t.steps[0];
  map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 14), {duration:.8});
  banner(CATS[t.cat].name, 'New Objective', t.title, CATS[t.cat].color);
  if (t.due) setTimeout(() => offerCalendar(t), 900);
}

/* ---------------- Place picker ---------------- */
let pickCb = null, pickTarget = null, revT = null, revCtl = null, prevView = null;
// cat: a category key, or a place object when positioning a fixed place
function startPick(cat, step, cb){
  pickCb = cb; pickTarget = step;
  sheet.classList.remove('open'); scrim.hidden = true; onSheetClose = null;
  openPlaceId = null; render();
  document.body.classList.add('picking');
  $('#picker').hidden = false;
  const forPlace = typeof cat === 'object';
  $('#crossBlip').outerHTML = forPlace
    ? `<div id="crossBlip" class="blip big" style="--c:${cat.color}">${PLACE_ICONS[cat.icon] || PLACE_ICONS.pin}</div>`
    : `<div id="crossBlip" class="blip big" style="--c:${CATS[cat].color}">${CATS[cat].icon}</div>`;
  const chips = $('#pickChips');
  chips.innerHTML = forPlace ? '' : places.map(p => `<button class="pchip" data-p="${p.id}" style="--c:${p.color}">${placeIcon(p)}<span>${esc(p.name)}</span></button>`).join('');
  chips.hidden = forPlace || !places.length;
  chips.querySelectorAll('.pchip').forEach(b => b.onclick = () => {
    const p = placeById(b.dataset.p);
    Object.assign(pickTarget, {lat:p.lat, lng:p.lng, place:p.name, placeId:p.id});
    document.body.classList.remove('picking');
    $('#picker').hidden = true;
    const f = pickCb; pickCb = null;
    if (prevView) map.setView(prevView.c, prevView.z);
    f && f(true);
  });
  $('#searchInput').value = ''; $('#searchResults').innerHTML = '';
  map.stop();
  prevView = {c:map.getCenter(), z:map.getZoom()};
  if (step.lat) map.setView([step.lat, step.lng], 17);
  else if (map.getZoom() < 13) map.setView(meLatLng || [47.3769, 8.5417], 14);
  reverse();
}
function endPick(ok){
  document.body.classList.remove('picking');
  $('#picker').hidden = true;
  const cb = pickCb; pickCb = null;
  if (ok){
    const c = map.getCenter();
    pickTarget.lat = +c.lat.toFixed(6); pickTarget.lng = +c.lng.toFixed(6);
    pickTarget.place = $('#pickPlace').dataset.place || `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
    delete pickTarget.placeId;
  }
  cb && cb(ok);
}
map.on('movestart', () => { if (pickCb) $('#crosshair').classList.add('lift'); });
map.on('moveend', () => { if (pickCb){ $('#crosshair').classList.remove('lift'); reverse(); } });

function reverse(){
  const el = $('#pickPlace'); el.textContent = 'Locating…'; el.dataset.place = '';
  clearTimeout(revT);
  revT = setTimeout(async () => {
    const c = map.getCenter();
    if (!ZH.contains(c)){ el.textContent = '⚠︎ Outside Kanton Zürich'; }
    try {
      revCtl && revCtl.abort(); revCtl = new AbortController();
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=de&lat=${c.lat}&lon=${c.lng}`, {signal:revCtl.signal});
      const j = await r.json();
      const a = j.address || {};
      const street = [a.road || a.pedestrian || a.footway || a.path, a.house_number].filter(Boolean).join(' ');
      const town = a.city || a.town || a.village || a.municipality || '';
      const label = [j.name && j.name !== street ? j.name : '', street, town].filter(Boolean).join(', ') || j.display_name || '';
      el.textContent = '📍 ' + (label || `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
      el.dataset.place = label;
    } catch (e) {
      if (e.name !== 'AbortError') el.textContent = `📍 ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
    }
  }, 450);
}
let searchT;
$('#searchInput').addEventListener('input', e => {
  clearTimeout(searchT);
  const q = e.target.value.trim();
  if (q.length < 3){ $('#searchResults').innerHTML = ''; return; }
  searchT = setTimeout(async () => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=de&countrycodes=ch&viewbox=8.30,47.75,9.05,47.10&bounded=1&q=${encodeURIComponent(q)}`);
      const j = await r.json();
      $('#searchResults').innerHTML = j.length ? j.map(x => `<button data-lat="${x.lat}" data-lon="${x.lon}">${esc(x.display_name)}</button>`).join('') : '<button disabled>No results in Kanton Zürich</button>';
    } catch { $('#searchResults').innerHTML = '<button disabled>Search unavailable offline</button>'; }
  }, 400);
});
$('#searchResults').addEventListener('click', e => {
  const b = e.target.closest('button[data-lat]'); if (!b) return;
  $('#searchResults').innerHTML = ''; $('#searchInput').blur();
  map.setView([+b.dataset.lat, +b.dataset.lon], 17);
});
$('#pickOk').onclick = () => endPick(true);
$('#pickCancel').onclick = () => { if (prevView) map.setView(prevView.c, prevView.z); endPick(false); };
$('#pickMe').onclick = () => locate(ll => map.setView(ll, 17));

/* ---------------- Location ---------------- */
function locate(cb){
  if (!navigator.geolocation) return toast('Location not available');
  navigator.geolocation.getCurrentPosition(p => {
    meLatLng = [p.coords.latitude, p.coords.longitude];
    const icon = L.divIcon({className:'blip-wrap', html:'<div class="me-dot"></div>', iconSize:[18, 18], iconAnchor:[9, 9]});
    if (meMarker) meMarker.setLatLng(meLatLng); else meMarker = L.marker(meLatLng, {icon, interactive:false, zIndexOffset:1000}).addTo(map);
    cb && cb(meLatLng);
  }, () => toast('Could not get your location'), {enableHighAccuracy:true, timeout:10000, maximumAge:30000});
}
$('#btnLocate').onclick = () => locate(ll => map.flyTo(ll, 16, {duration:.8}));

/* ---------------- Mission detail ---------------- */
function openMission(id){
  const t = tasks.find(x => x.id === id); if (!t) return;
  selectedId = id; render();
  const c = CATS[t.cat], s = t.steps[t.cur], multi = t.steps.length > 1;
  const stepsHtml = multi ? `<label class="f">Steps</label><div class="steps">` + t.steps.map((x, i) => `
      <div class="step ${i < t.cur ? 'done' : i === t.cur ? 'cur' : ''}" style="--c:${c.color}">
        <span class="num">${i < t.cur ? '✓' : i + 1}</span>
        <span class="t"><b>${esc(x.title)}</b><small>${i < t.cur ? 'Done ' + fmtDT(x.doneAt) : esc(x.place || '')}</small></span>
      </div>`).join('') + `</div>` : '';
  openSheet(`
    <div class="mission-head">${blip(t.cat, 'big')}<div><div class="kicker" style="--c:${c.color}">${c.name}${multi ? ` · Step ${t.cur + 1} of ${t.steps.length}` : ''}</div><div class="h">${esc(t.title)}</div></div></div>
    <div class="meta">${t.due ? `<span class="chip due-${dueState(t)}">⏰ ${dueLabel(t.due)}</span>` : ''}${t.repeat ? `<span class="chip">🔁 ${repeatName(t.repeat.every)}</span>` : ''}<span class="chip">Started ${fmtDate(t.created)}</span>${meLatLng ? `<span class="chip">${distTo(s)} away</span>` : ''}</div>
    ${t.desc ? `<div class="desc">${esc(t.desc)}</div>` : ''}
    <div class="objective" style="--c:${c.color}">
      <div class="kicker">Current step</div>
      <b>${esc(s.title)}</b>
      ${s.desc ? `<div class="desc" style="margin-top:4px">${esc(s.desc)}</div>` : ''}
      <div style="color:var(--muted);font-size:12px;margin-top:6px">📍 ${esc(s.place || '')}</div>
    </div>
    ${stepsHtml}
    <button class="btn primary block" id="mDone">${multi && t.cur < t.steps.length - 1 ? 'Complete step' : 'Complete objective'}</button>
    <div class="row" style="margin-top:10px">
      <button class="btn" id="mNav">Navigate</button>
      <button class="btn" id="mEdit">Edit</button>
    </div>
    ${t.due ? '<button class="btn block" id="mCal">📅 Add to calendar</button>' : ''}
    <button class="btn ghost danger block" id="mDel">Abandon objective</button>`,
  b => {
    const cal = b.querySelector('#mCal'); if (cal) cal.onclick = () => addToCalendar(t);
    b.querySelector('#mDone').onclick = () => sheetComplete(t);
    b.querySelector('#mNav').onclick = () => window.open(`https://maps.apple.com/?daddr=${s.lat},${s.lng}`, '_blank');
    b.querySelector('#mEdit').onclick = () => sheetEdit(t);
    b.querySelector('#mDel').onclick = async () => {
      if (!confirm(`Abandon "${t.title}"? It will be deleted.`)) return;
      await deleteTask(t); closeSheet(); render(); toast('Objective abandoned');
    };
  });
  map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 14), {duration:.6});
}
function distTo(s){
  const d = map.distance(meLatLng, [s.lat, s.lng]);
  return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
}
async function deleteTask(t){
  for (const s of t.steps) if (s.photoId) await DB.del('photos', s.photoId);
  await DB.del('tasks', t.id);
  tasks = tasks.filter(x => x.id !== t.id);
}

function sheetEdit(t){
  const c = CATS[t.cat], s = t.steps[t.cur];
  openSheet(`
    <div class="kicker" style="--c:${c.color}">${c.name}</div><div class="h">Edit objective</div>
    <label class="f">Title</label><input class="inp" id="xTitle" maxlength="80" value="${esc(t.title)}">
    <label class="f">Description</label><textarea class="inp" id="xDesc" rows="3">${esc(t.desc)}</textarea>
    <label class="f">Current step</label><input class="inp" id="xStep" maxlength="80" value="${esc(s.title)}">
    ${timeFields(t)}
    <button class="btn block" id="xMove">📍 Move current step</button>
    <button class="btn block" id="xAdd">+ Add a step at the end</button>
    <button class="btn primary block" id="xSave">Save</button>
    <button class="btn ghost block" id="xBack">Back</button>`,
  b => {
    const readTime = bindTime(b, t), oldDue = t.due, oldAlerts = String(t.alerts) + JSON.stringify(t.repeat || '');
    const commit = async () => {
      readTime();
      t.title = b.querySelector('#xTitle').value.trim() || t.title;
      t.desc = b.querySelector('#xDesc').value.trim();
      s.title = b.querySelector('#xStep').value.trim() || s.title;
      if (t.steps.length === 1) s.title = t.title;
      await saveTask(t);
    };
    b.querySelector('#xSave').onclick = async () => {
      await commit(); render();
      // time changed → offer to put the new time in the calendar
      if (t.due && (t.due !== oldDue || String(t.alerts) + JSON.stringify(t.repeat || '') !== oldAlerts)) offerCalendar(t, () => openMission(t.id));
      else if (!isShown(t)){ closeSheet(); toast(`Hidden until ${dueLabel(t.due).split(' · ')[0]}`); return; }
      else openMission(t.id);
    };
    b.querySelector('#xBack').onclick = () => openMission(t.id);
    b.querySelector('#xMove').onclick = async () => { await commit(); startPick(t.cat, s, async ok => { if (ok) await saveTask(t); render(); openMission(t.id); }); };
    b.querySelector('#xAdd').onclick = async () => { await commit(); sheetAddStep(t); };
  });
}
function sheetAddStep(t){
  const c = CATS[t.cat];
  openSheet(`
    <div class="kicker" style="--c:${c.color}">Step ${t.steps.length + 1}</div><div class="h">New step</div>
    <label class="f">Step</label><input class="inp" id="aTitle" maxlength="80">
    <label class="f">Details (optional)</label><textarea class="inp" id="aDesc" rows="2"></textarea>
    <button class="btn primary block" id="aNext" disabled>Set place</button>
    <button class="btn ghost block" id="aBack">Back</button>`,
  b => {
    const ti = b.querySelector('#aTitle'), nx = b.querySelector('#aNext');
    ti.oninput = () => nx.disabled = !ti.value.trim();
    setTimeout(() => ti.focus(), 300);
    b.querySelector('#aBack').onclick = () => sheetEdit(t);
    nx.onclick = () => {
      const s = {id:uid(), title:ti.value.trim(), desc:b.querySelector('#aDesc').value.trim()};
      startPick(t.cat, s, async ok => {
        if (ok){ t.steps.push(s); await saveTask(t); toast('Step added'); }
        render(); openMission(t.id);
      });
    };
  });
}

/* ---------------- Completion + photo ---------------- */
let pendingPhoto = null;
function sheetComplete(t){
  const c = CATS[t.cat], s = t.steps[t.cur];
  const last = t.cur >= t.steps.length - 1;
  pendingPhoto = null;
  openSheet(`
    <div class="kicker" style="--c:${c.color}">${last ? 'Objective complete' : 'Step complete'}</div>
    <div class="h">${esc(s.title)}</div>
    <div class="sub">Capture the moment for your archive.</div>
    <button class="photo-prev" id="cPhoto">📷 Tap to take a photo</button>
    <label class="f">Note (optional)</label>
    <textarea class="inp" id="cNote" rows="2" placeholder="How did it go?"></textarea>
    <button class="btn primary block" id="cSave">${last ? 'Objective passed' : 'Done · Next step'}</button>
    <button class="btn ghost block" id="cBack">Back</button>`,
  b => {
    const prev = b.querySelector('#cPhoto');
    prev.onclick = () => { $('#photoInput').value = ''; $('#photoInput').click(); };
    $('#photoInput').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      prev.textContent = 'Processing…';
      try {
        pendingPhoto = await resizeImage(f, 1600);
        prev.style.backgroundImage = `url(${URL.createObjectURL(pendingPhoto)})`;
        prev.style.borderStyle = 'solid'; prev.textContent = '';
      } catch { prev.textContent = 'Could not read photo — try again'; }
    };
    b.querySelector('#cBack').onclick = () => openMission(t.id);
    b.querySelector('#cSave').onclick = async e => {
      e.target.disabled = true;
      await completeStep(t, b.querySelector('#cNote').value.trim(), pendingPhoto);
    };
  });
}
function resizeImage(file, max){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/jpeg', .85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('load')); };
    img.src = url;
  });
}
async function completeStep(t, note, photo){
  const s = t.steps[t.cur];
  s.doneAt = Date.now();
  if (note) s.note = note;
  if (photo){ s.photoId = uid(); await DB.put('photos', photo, s.photoId); }
  t.cur++;
  const c = CATS[t.cat];
  if (t.cur >= t.steps.length && t.repeat){
    // recurring: archive this occurrence as its own entry, then jump to the next date
    const copy = JSON.parse(JSON.stringify(t));
    Object.assign(copy, {id:uid(), status:'done', doneAt:s.doneAt, repeatOf:t.id, occurrence:t.due, created:Math.min(dayStart(t.due), s.doneAt)});
    delete copy.repeat;
    tasks.push(copy); await saveTask(copy);
    do { t.due = nextDue(t.due, t.repeat.every); } while (t.due <= Date.now() && dayEnd(t.due) < Date.now());
    if (dayEnd(t.due) === dayEnd(copy.occurrence)) t.due = nextDue(t.due, t.repeat.every); // never the same day twice
    resetSteps(t);
    await saveTask(t);
    selectedId = null; closeSheet(); render();
    banner(c.name, 'Objective Passed', `${t.title} · next ${dueLabel(t.due).split(' · ')[0]}`, c.color);
  } else if (t.cur >= t.steps.length){
    t.status = 'done'; t.doneAt = s.doneAt;
    await saveTask(t);
    selectedId = null; closeSheet(); render();
    banner(c.name, 'Objective Passed', t.title, c.color);
  } else {
    await saveTask(t);
    selectedId = null; closeSheet(); render();
    const n = t.steps[t.cur];
    banner(`Step ${t.cur} of ${t.steps.length} complete`, 'Next Step', n.title, c.color);
    setTimeout(() => map.flyTo([n.lat, n.lng], Math.max(map.getZoom(), 14), {duration:1}), 600);
  }
}

/* ---------------- Objective list ---------------- */
$('#btnList').onclick = () => {
  // timed objectives first (soonest / overdue on top), then story, then oldest
  const list = visible().sort((a, b) => (a.due || Infinity) - (b.due || Infinity) || (a.cat === 'story' ? -1 : 0) - (b.cat === 'story' ? -1 : 0) || a.created - b.created);
  openSheet(`
    <div class="h grad">${mode === 'all' ? 'All' : CATS[mode].name}</div>
    <div class="sub">${list.length} active</div>
    ${list.length ? list.map(t => { const s = t.steps[t.cur]; return `
      <button class="list-item" data-id="${t.id}">${blip(t.cat)}
        <span class="t"><b>${esc(t.title)}</b>${t.due ? `<small class="due-${dueState(t)}">⏰ ${dueLabel(t.due)}</small>` : ''}<small>${t.steps.length > 1 ? `${t.cur + 1}/${t.steps.length} · ${esc(s.title)}` : esc(s.place || '')}${meLatLng ? ' · ' + distTo(s) : ''}</small></span>
      </button>`; }).join('') : '<div class="empty">No active objectives. Tap + to add one.</div>'}`,
  b => b.querySelectorAll('.list-item').forEach(el => el.onclick = () => openMission(el.dataset.id)));
};

/* ---------------- Archive ---------------- */
$('#btnArchive').onclick = () => { $('#archive').hidden = false; renderArchive(); };
$('#archClose').onclick = () => { $('#archive').hidden = true; };
$('#archAdd').onclick = () => sheetArchiveEntry();

// manual archive entry: same "capture the moment" flow, without an objective
function sheetArchiveEntry(){
  let cat = null; pendingPhoto = null;
  openSheet(`
    <div class="kicker">Archive</div>
    <div class="h">New entry</div>
    <div class="sub">Capture the moment for your archive.</div>
    <div class="catgrid">${Object.keys(CATS).map(k => `<button class="cat" data-k="${k}" style="--c:${CATS[k].color}"><span class="ic">${CATS[k].icon}</span><b>${CATS[k].name}</b></button>`).join('')}</div>
    <label class="f">Title</label>
    <input class="inp" id="eTitle" maxlength="80" placeholder="What happened?">
    <button class="photo-prev" id="cPhoto">📷 Tap to take a photo</button>
    <label class="f">Note (optional)</label>
    <textarea class="inp" id="cNote" rows="2" placeholder="How did it go?"></textarea>
    <button class="btn primary block" id="eSave" disabled>Save to archive</button>
    <button class="btn ghost block" id="eBack">Cancel</button>`,
  b => {
    const title = b.querySelector('#eTitle'), save = b.querySelector('#eSave');
    const upd = () => save.disabled = !cat || !title.value.trim();
    title.oninput = upd;
    b.querySelectorAll('.cat').forEach(x => x.onclick = () => {
      cat = x.dataset.k;
      b.querySelectorAll('.cat').forEach(y => y.classList.toggle('on', y === x));
      upd();
    });
    const prev = b.querySelector('#cPhoto');
    prev.onclick = () => { $('#photoInput').value = ''; $('#photoInput').click(); };
    $('#photoInput').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      prev.textContent = 'Processing…';
      try {
        pendingPhoto = await resizeImage(f, 1600);
        prev.style.backgroundImage = `url(${URL.createObjectURL(pendingPhoto)})`;
        prev.style.borderStyle = 'solid'; prev.textContent = '';
      } catch { prev.textContent = 'Could not read photo — try again'; }
    };
    b.querySelector('#eBack').onclick = closeSheet;
    save.onclick = async () => {
      save.disabled = true;
      const now = Date.now(), s = {id:uid(), title:title.value.trim(), doneAt:now, place:''};
      const note = b.querySelector('#cNote').value.trim(); if (note) s.note = note;
      if (pendingPhoto){ s.photoId = uid(); await DB.put('photos', pendingPhoto, s.photoId); }
      if (meLatLng){ s.lat = meLatLng[0]; s.lng = meLatLng[1]; }
      const t = {id:uid(), cat, title:s.title, desc:'', created:now, doneAt:now, status:'done', manual:true, cur:1, steps:[s]};
      tasks.push(t); await saveTask(t);
      closeSheet(); renderArchive(); toast('Added to your archive');
    };
  });
}

// archive view settings (remembered on this phone)
const ARCH_SORTS = [['new', 'Newest first'], ['old', 'Oldest first'], ['az', 'Title A–Z'], ['cat', 'By category']];
const ARCH_SHOW = [['', 'Everything'], ['star', '★ Highlights'], ['obj', 'Objectives only'], ['entry', 'Own entries only'], ['photo', 'With photo']];
function archOpts(){ return {sort:'new', filter:'', view:'cards', ...store.get('arch', {})}; }

async function renderArchive(){
  const o = archOpts();
  const all = done();
  const counts = {}; all.forEach(t => counts[t.cat] = (counts[t.cat] || 0) + 1);
  // filter
  let list = all.filter(t =>
    !o.filter ? true :
    o.filter === 'obj' ? !t.manual :
    o.filter === 'entry' ? !!t.manual :
    o.filter === 'photo' ? !!coverId(t) :
    o.filter === 'star' ? !!t.star :
    t.cat === o.filter);
  // sort
  const byDate = (a, b) => b.doneAt - a.doneAt;
  list.sort(o.sort === 'old' ? (a, b) => a.doneAt - b.doneAt
    : o.sort === 'az' ? (a, b) => a.title.localeCompare(b.title, 'de')
    : o.sort === 'cat' ? (a, b) => Object.keys(CATS).indexOf(a.cat) - Object.keys(CATS).indexOf(b.cat) || byDate(a, b)
    : byDate);

  let h = `<div class="stats"><div class="stat"><b>${all.length}</b><small>In archive</small></div><button class="stat star-stat" id="aStars"><b>★ ${all.filter(t => t.star).length}</b><small>Highlights</small></button>`;
  for (const k in CATS) if (counts[k]) h += `<div class="stat" style="--c:${CATS[k].color}"><b>${counts[k]}</b><small>${CATS[k].name}</small></div>`;
  h += `</div>
  <div class="arch-ctrl">
    <select class="inp" id="aSort">${ARCH_SORTS.map(([v, l]) => `<option value="${v}" ${o.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select class="inp" id="aFilter">
      ${ARCH_SHOW.map(([v, l]) => `<option value="${v}" ${o.filter === v ? 'selected' : ''}>${l}</option>`).join('')}
      <optgroup label="Category">${Object.keys(CATS).map(k => `<option value="${k}" ${o.filter === k ? 'selected' : ''}>${CATS[k].name}</option>`).join('')}</optgroup>
    </select>
    <button class="icon-btn view-toggle" id="aView" aria-label="${o.view === 'list' ? 'Show as cards' : 'Show as list'}">${o.view === 'list'
      ? '<svg viewBox="0 0 24 24"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z"/></svg>'}</button>
  </div>
  <div class="arch-list ${o.view === 'list' ? 'as-list' : ''}">`;
  if (!all.length) h += `<div class="empty">Your story starts here.<br>Completed objectives appear in this archive with photos and timestamps.</div>`;
  else if (!list.length) h += `<div class="empty">Nothing matches this filter.</div>`;
  let group = '';
  for (const t of list){
    // section headers: month when sorted by date, category when sorted by category
    const g = o.sort === 'cat' ? CATS[t.cat].name : o.sort === 'az' ? '' : new Date(t.doneAt).toLocaleDateString('en-GB', {month:'long', year:'numeric'});
    if (g && g !== group){ group = g; h += `<div class="month">${g}</div>`; }
    const c = CATS[t.cat];
    if (o.view === 'list'){
      h += `<button class="arch-row" data-id="${t.id}" style="--c:${c.color}">
        <span class="dot"></span>
        <span class="t"><b>${t.star ? '<i class="star">★</i> ' : ''}${esc(t.title)}</b><small>${c.name} · ${fmtDT(t.doneAt)}${t.manual ? ' · entry' : ''}</small></span>
        ${coverId(t) ? '<span class="cam">📷</span>' : ''}
      </button>`;
    } else {
      h += `<button class="arch-card" data-id="${t.id}" style="--c:${c.color}">
        <div class="img" data-cover="${esc(coverId(t) || '')}">${coverId(t) ? '' : blip(t.cat)}</div>
        <div class="cap"><div class="kicker">${c.name}${t.steps.length > 1 ? ` · ${t.steps.length} steps` : ''}</div><b>${t.star ? '<i class="star">★</i> ' : ''}${esc(t.title)}</b><small>${fmtDT(t.doneAt)}</small></div>
      </button>`;
    }
  }
  h += `</div>`;
  const body = $('#archBody');
  body.innerHTML = h;
  const set = patch => { store.set('arch', {...archOpts(), ...patch}); renderArchive(); };
  body.querySelector('#aSort').onchange = e => set({sort:e.target.value});
  body.querySelector('#aFilter').onchange = e => set({filter:e.target.value});
  body.querySelector('#aView').onclick = () => set({view:o.view === 'list' ? 'cards' : 'list'});
  body.querySelector('#aStars').onclick = () => set({filter:o.filter === 'star' ? '' : 'star'});
  body.querySelectorAll('.arch-card,.arch-row').forEach(el => el.onclick = () => renderArchiveDetail(el.dataset.id));
  for (const el of body.querySelectorAll('[data-cover]')){
    const u = await photoUrl(el.dataset.cover);
    if (u) el.style.backgroundImage = `url(${u})`;
  }
  $('#archive').scrollTop = 0;
}
const coverId = t => [...t.steps].reverse().find(s => s.photoId)?.photoId;

async function renderArchiveDetail(id){
  const t = tasks.find(x => x.id === id); if (!t) return;
  const c = CATS[t.cat];
  const cover = await photoUrl(coverId(t));
  let h = `<div class="hero" style="${cover ? `background-image:url(${cover})` : ''}"><div class="cap" style="--c:${c.color}">
      <div class="kicker">${c.name} · ${t.manual ? 'Entry' : 'Objective passed'}</div><div class="h">${esc(t.title)}</div></div></div>
    <div class="timeline">
      <div class="meta" style="margin-top:-6px">${t.manual
        ? `<span class="chip">Entered ${fmtDT(t.doneAt)}</span>`
        : `<span class="chip">Started ${fmtDT(t.created)}</span><span class="chip">Passed ${fmtDT(t.doneAt)}</span><span class="chip">⏱ ${fmtDur(t.doneAt - t.created)}</span>`}</div>
      ${t.desc ? `<div class="desc" style="margin-bottom:18px">${esc(t.desc)}</div>` : ''}`;
  for (const s of t.steps){
    const u = await photoUrl(s.photoId);
    h += `<div class="tl" style="--c:${c.color}">
      <div class="when">${fmtDT(s.doneAt)}</div>
      <b>${esc(s.title)}</b>
      ${s.place ? `<small>📍 ${esc(s.place)}</small>` : ''}
      ${s.desc ? `<div class="desc" style="margin-top:4px;font-size:13px">${esc(s.desc)}</div>` : ''}
      ${s.note ? `<div class="note">“${esc(s.note)}”</div>` : ''}
      ${u ? `<img src="${u}" alt="">` : ''}
    </div>`;
  }
  h += `<button class="btn block star-btn ${t.star ? 'on' : ''}" id="adStar">${t.star ? '★ Highlighted' : '☆ Highlight'}</button>`;
  h += `<button class="btn block" id="adBack">Back to archive</button>
        <button class="btn ghost danger block" id="adDel">Delete from archive</button></div>`;
  $('#archBody').innerHTML = h;
  $('#archive').scrollTop = 0;
  $('#adBack').onclick = renderArchive;
  $('#adStar').onclick = async () => {
    if (t.star) delete t.star; else t.star = true;
    await saveTask(t);
    const b = $('#adStar');
    b.classList.toggle('on', !!t.star);
    b.textContent = t.star ? '★ Highlighted' : '☆ Highlight';
    if (t.star) toast('Added to highlights');
  };
  $('#adDel').onclick = async () => {
    if (!confirm(`Delete "${t.title}" and its photos permanently?`)) return;
    await deleteTask(t); renderArchive();
  };
}

/* ---------------- Automatic cloud backup → private GitHub repo ----------------
   data.json  = all objectives, archive entries and places
   photos/*.jpg = every photo (uploaded once, kept forever – history is in git)
   The access key stays on this phone only (localStorage), never in backups. */
const b64utf8 = s => { const u = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); };
const Backup = {
  timer:null, busy:false, state:'',
  cfg(){ return store.get('bk-cfg', null); },
  async api(path, opts = {}){
    const c = this.cfg();
    return fetch(`https://api.github.com/repos/${c.repo}${path ? '/' + path : ''}`, {...opts, cache:'no-store', headers:{
      Authorization:`Bearer ${c.token}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', ...(opts.headers || {})}});
  },
  async putFile(path, b64, msg){
    const g = await this.api('contents/' + path);
    if (!g.ok && g.status !== 404) throw new Error(`GitHub ${g.status}`);
    const sha = g.ok ? (await g.json()).sha : undefined;
    const r = await this.api('contents/' + path, {method:'PUT', body:JSON.stringify({message:msg, content:b64, ...(sha ? {sha} : {})})});
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
  },
  dirty(){
    if (!this.cfg()) return;
    store.set('bk-dirty', true);
    clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), 4000);
  },
  status(s, msg){ this.state = s; if (msg !== undefined) store.set('bk-err', msg); const el = $('#bkStatus'); if (el) el.innerHTML = this.label(); },
  label(){
    if (!this.cfg()) return 'Not connected';
    if (this.state === 'busy') return '⟳ Backing up…';
    const last = store.get('bk-last', 0), err = store.get('bk-err', '');
    if (this.state === 'err' || (err && store.get('bk-dirty', false))) return `<span style="color:#ff5a5a">⚠ Backup failed: ${esc(err)}</span>`;
    return last ? `✓ Backed up ${fmtDT(last)}` : 'Waiting for first backup';
  },
  async run(force){
    if (this.busy || !this.cfg()) return;
    if (!force && !store.get('bk-dirty', false)) return;
    if (!navigator.onLine){ this.status('err', 'offline – will retry'); return; }
    this.busy = true; this.status('busy');
    try {
      store.set('bk-dirty', false);
      const sent = new Set(store.get('bk-photos', []));
      for (const k of await DB.allKeys('photos')){
        if (sent.has(k)) continue;
        const blob = await DB.get('photos', k); if (!blob) continue;
        await this.putFile(`photos/${k}.jpg`, (await blobToDataURL(blob)).split(',')[1], 'photo');
        sent.add(k); store.set('bk-photos', [...sent]);
      }
      const data = JSON.stringify({app:'zh-story', v:2, saved:Date.now(), tasks, places}, null, 1);
      await this.putFile('data.json', b64utf8(data), `backup ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
      store.set('bk-last', Date.now()); store.set('bk-err', ''); this.status('ok');
    } catch (e) {
      store.set('bk-dirty', true);
      const m = String(e.message || e);
      this.status('err', /401|403/.test(m) ? 'access key invalid or expired' : /404/.test(m) ? 'repository not found' : m);
      if (!/401|403|404/.test(m)){ clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), 60000); }
    } finally { this.busy = false; }
  },
  async restore(){
    const r = await this.api('contents/data.json', {headers:{Accept:'application/vnd.github.raw+json'}});
    if (!r.ok) throw new Error(r.status === 404 ? 'no backup found yet' : `GitHub ${r.status}`);
    const d = await r.json();
    const sent = new Set(store.get('bk-photos', [])), have = new Set(await DB.allKeys('photos'));
    const ids = (d.tasks || []).flatMap(t => t.steps.map(s => s.photoId)).filter(Boolean);
    let n = 0;
    for (const id of ids){
      if (have.has(id)) continue;
      toast(`Restoring photos… ${++n}`);
      const p = await this.api(`contents/photos/${id}.jpg`, {headers:{Accept:'application/vnd.github.raw+json'}});
      if (p.ok){ await DB.put('photos', await p.blob(), id); sent.add(id); }
    }
    store.set('bk-photos', [...sent]);
    for (const t of d.tasks || []) await DB.put('tasks', t);
    for (const p of d.places || []) await DB.put('places', p);
    tasks = await DB.all('tasks'); places = await DB.all('places');
    places.sort((a, b) => (b.hq ? 1 : 0) - (a.hq ? 1 : 0));
    return (d.tasks || []).length;
  },
};
// every change to objectives, places or photos schedules a backup
for (const fn of ['put', 'del']){
  const orig = DB[fn].bind(DB);
  DB[fn] = async (...a) => { const r = await orig(...a); Backup.dirty(); return r; };
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) Backup.run(); });
window.addEventListener('online', () => Backup.run());

function sheetBackup(){
  const c = Backup.cfg();
  openSheet(c ? `
    <div class="h grad">Cloud backup</div>
    <div class="sub">Every change is copied automatically to your private GitHub repository <b>${esc(c.repo)}</b>.</div>
    <div class="objective" style="--c:#c0283f"><div id="bkStatus">${Backup.label()}</div></div>
    <button class="btn primary block" id="bkNow">Back up now</button>
    <button class="btn block" id="bkRestore">Restore from backup</button>
    <button class="btn ghost danger block" id="bkOff">Disconnect</button>
    <button class="btn ghost block" id="bkBack">Back</button>` : `
    <div class="h grad">Cloud backup</div>
    <div class="sub">Connect a private GitHub repository once – after that everything backs up by itself.</div>
    <label class="f">Repository</label>
    <input class="inp" id="bkRepo" value="ineinerkleinenkonditorei/zh-story-backup" autocapitalize="off" autocorrect="off" spellcheck="false">
    <label class="f">Access key (token)</label>
    <input class="inp" id="bkToken" type="password" placeholder="github_pat_…" autocapitalize="off" autocorrect="off" spellcheck="false">
    <button class="btn primary block" id="bkConnect">Connect</button>
    <button class="btn ghost block" id="bkBack">Back</button>`,
  b => {
    b.querySelector('#bkBack').onclick = () => $('#btnMenu').click();
    if (!c){
      b.querySelector('#bkConnect').onclick = async e => {
        const repo = b.querySelector('#bkRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
        const token = b.querySelector('#bkToken').value.trim();
        if (!repo.includes('/') || !token) return toast('Fill in repository and access key');
        e.target.disabled = true; e.target.textContent = 'Checking…';
        store.set('bk-cfg', {repo, token});
        try {
          const r = await Backup.api('');
          if (!r.ok) throw new Error(r.status === 404 ? 'Repository not found (check name and key access)' : r.status === 401 ? 'Access key not accepted' : `GitHub ${r.status}`);
          const info = await r.json();
          if (!info.private) toast('⚠ This repository is public – make it private on GitHub!');
          const has = (await Backup.api('contents/data.json')).ok;
          if (has && confirm('This repository already has a backup. Restore it onto this phone first?')){ const n = await Backup.restore(); render(); toast(`Restored ${n} entries`); }
          store.set('bk-dirty', true); Backup.run(true);
          sheetBackup();
        } catch (err) {
          store.set('bk-cfg', null);
          toast(String(err.message || err)); e.target.disabled = false; e.target.textContent = 'Connect';
        }
      };
      return;
    }
    b.querySelector('#bkNow').onclick = () => Backup.run(true);
    b.querySelector('#bkRestore').onclick = async e => {
      if (!confirm('Load everything from the cloud backup onto this phone? Entries on this phone are kept; matching ones are replaced by the backup version.')) return;
      e.target.disabled = true;
      try { const n = await Backup.restore(); render(); toast(`Restored ${n} entries`); }
      catch (err) { toast('Restore failed: ' + (err.message || err)); }
      e.target.disabled = false;
    };
    b.querySelector('#bkOff').onclick = () => {
      if (!confirm('Stop backing up? Your backup on GitHub stays where it is.')) return;
      ['bk-cfg', 'bk-dirty', 'bk-last', 'bk-err', 'bk-photos'].forEach(k => store.set(k, null));
      sheetBackup();
    };
  });
}

/* ---------------- Menu / settings / backup ---------------- */
$('#btnMenu').onclick = () => {
  const opts = Object.entries(LAYERS).map(([k, v]) => `<button class="btn ${k === layerKey ? 'primary' : ''}" data-l="${k}">${v.name}</button>`).join('');
  openSheet(`
    <div class="h grad">Settings</div>
    <label class="f">Map style</label><div class="row">${opts}</div>
    <label class="toggle"><span>Show place names</span><input type="checkbox" id="oLabels" ${showLabels ? 'checked' : ''}></label>
    <label class="f">Fixed places</label>
    ${places.map(p => `<button class="list-item" data-place="${p.id}">${placeIcon(p)}<span class="t"><b>${esc(p.name)}</b><small>${esc(p.place || '')}</small></span></button>`).join('')}
    <button class="btn block" id="oAddPlace">+ Add place</button>
    <label class="f">Backup</label>
    <button class="list-item" id="oCloud"><span class="t"><b>☁ Cloud backup</b><small id="bkStatus">${Backup.label()}</small></span></button>
    <div class="sub" style="margin:10px 0 4px">Backup file (manual)</div>
    <div class="row"><button class="btn" id="oExport">Export</button><button class="btn" id="oImport">Import</button></div>
    <div class="sub" style="margin-top:18px">${active().length} active · ${done().length} passed</div>`,
  b => {
    b.querySelectorAll('[data-l]').forEach(x => x.onclick = () => { layerKey = x.dataset.l; store.set('layer', layerKey); applyLayer(); $('#btnMenu').click(); });
    b.querySelector('#oLabels').onchange = e => { showLabels = e.target.checked; store.set('labels', showLabels); applyLayer(); };
    b.querySelectorAll('[data-place]').forEach(x => x.onclick = () => sheetPlace(placeById(x.dataset.place)));
    b.querySelector('#oAddPlace').onclick = () => sheetPlace(null);
    b.querySelector('#oCloud').onclick = sheetBackup;
    b.querySelector('#oExport').onclick = exportData;
    b.querySelector('#oImport').onclick = () => { $('#importInput').value = ''; $('#importInput').click(); };
  });
};
function sheetPlace(existing){
  const p = existing ? {...existing} : {id:uid(), name:'', icon:'pin', color:PLACE_COLORS[1]};
  const draw = () => openSheet(`
    <div class="h grad">${existing ? 'Edit place' : 'New place'}</div>
    <label class="f">Name</label>
    <input class="inp" id="plName" maxlength="30" placeholder="e.g. garage, gym" value="${esc(p.name)}">
    <label class="f">Icon</label>
    <div class="pick-row">${Object.keys(PLACE_ICONS).map(k => `<button class="pick-opt ${p.icon === k ? 'on' : ''}" data-icon="${k}" style="--c:${p.color}">${PLACE_ICONS[k]}</button>`).join('')}</div>
    <label class="f">Colour</label>
    <div class="pick-row">${PLACE_COLORS.map(c => `<button class="pick-opt swatch ${p.color === c ? 'on' : ''}" data-color="${c}" style="--c:${c}"></button>`).join('')}</div>
    <label class="f">Location</label>
    <button class="btn block" id="plLoc">${p.lat ? '📍 ' + esc(p.place || 'Location set') + ' · move' : '📍 Set location'}</button>
    <button class="btn primary block" id="plSave">Save</button>
    ${existing && !existing.hq ? '<button class="btn ghost danger block" id="plDel">Delete place</button>' : ''}
    <button class="btn ghost block" id="plBack">Back</button>`,
  b => {
    const name = b.querySelector('#plName'), save = b.querySelector('#plSave');
    const upd = () => save.disabled = !name.value.trim() || !p.lat;
    name.oninput = () => { p.name = name.value; upd(); }; upd();
    b.querySelectorAll('[data-icon]').forEach(x => x.onclick = () => { p.icon = x.dataset.icon; draw(); });
    b.querySelectorAll('[data-color]').forEach(x => x.onclick = () => { p.color = x.dataset.color; draw(); });
    b.querySelector('#plLoc').onclick = () => startPick(p, p, () => draw());
    b.querySelector('#plBack').onclick = () => $('#btnMenu').click();
    save.onclick = async () => {
      p.name = name.value.trim();
      delete p.placeId;
      if (existing) Object.assign(existing, p); else places.push(p);
      await savePlace(existing || p);
      render(); $('#btnMenu').click(); toast(`${p.name} saved`);
    };
    const del = b.querySelector('#plDel');
    if (del) del.onclick = async () => {
      if (!confirm(`Delete "${existing.name}"? Objectives there stay on the map as normal pins.`)) return;
      for (const t of tasks){
        let ch = false;
        for (const s of t.steps) if (s.placeId === existing.id){ delete s.placeId; ch = true; }
        if (ch) await saveTask(t);
      }
      await DB.del('places', existing.id);
      places = places.filter(x => x.id !== existing.id);
      render(); $('#btnMenu').click();
    };
  });
  draw();
}

const blobToDataURL =b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
async function exportData(){
  toast('Preparing backup…');
  const photos = {};
  for (const k of await DB.allKeys('photos')) photos[k] = await blobToDataURL(await DB.get('photos', k));
  const json = JSON.stringify({app:'zh-story', v:1, exported:Date.now(), tasks, places, photos});
  const name = `zh-story-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, {type:'application/json'});
  if (navigator.canShare && navigator.canShare({files:[file]})){
    try { await navigator.share({files:[file], title:name}); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
}
$('#importInput').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.app !== 'zh-story') throw new Error('bad file');
    for (const [k, v] of Object.entries(d.photos || {})) await DB.put('photos', await (await fetch(v)).blob(), k);
    for (const t of d.tasks || []) await DB.put('tasks', t);
    for (const p of d.places || []) await DB.put('places', p);
    tasks = await DB.all('tasks');
    places = await DB.all('places');
    closeSheet(); render(); toast(`Imported ${d.tasks.length} objectives`);
  } catch { toast('That file is not a ZH Story backup'); }
};

/* ---------------- Clock ---------------- */
function tick(){
  const n = new Date();
  $('#clock').textContent = n.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
  $('#date').textContent = n.toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'}) + ' · Kanton Zürich';
}
tick(); setInterval(tick, 10000);

/* ---------------- Boot ---------------- */
(async () => {
  try {
    await DB.open();
    tasks = await DB.all('tasks');
    places = await DB.all('places');
    if (!placeById('hq')){ places.unshift({...HQ_DEFAULT, place:'Bodenacherstrasse 46, Benglen'}); await DB.put('places', places[0]); }
    places.sort((a, b) => (b.hq ? 1 : 0) - (a.hq ? 1 : 0));
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) { toast('Storage unavailable — data won\'t be saved'); if (!places.length) places = [{...HQ_DEFAULT}]; }
  map.setView([hq().lat, hq().lng], START_ZOOM);
  if (mode !== 'all' && !CATS[mode]) mode = 'all';
  await rollAll();
  render();
  Backup.run();   // finish any backup that was interrupted last time
  const over = active().filter(t => dueState(t) === 'over').length;
  const today = active().filter(t => t.due && t.due >= Date.now() && new Date(t.due).toDateString() === new Date().toDateString()).length;
  if (over || today) setTimeout(() => toast([over && `${over} overdue`, today && `${today} due today`].filter(Boolean).join(' · ')), 800);
  // refresh countdowns / clock colours every minute
  setInterval(async () => {
    await rollAll();
    if (tasks.some(t => t.status === 'active' && t.due) && !pickCb && !sheet.classList.contains('open')) render();
  }, 60000);
})();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
