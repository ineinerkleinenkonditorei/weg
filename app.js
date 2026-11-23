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
const active = () => tasks.filter(t => t.status === 'active');
const done = () => tasks.filter(t => t.status === 'done');
const visible = () => active().filter(t => mode === 'all' || t.cat === mode);
async function saveTask(t){ await DB.put('tasks', t); }

/* ---------------- Map ---------------- */
const ZH = L.latLngBounds([47.155, 8.355], [47.70, 8.99]);
const map = L.map('map', {
  zoomControl:false, zoomSnap:.25, minZoom:9, maxZoom:19,
  maxBounds:ZH.pad(.35), maxBoundsViscosity:.9, attributionControl:true,
});
const START_ZOOM = 15;
map.setView([HQ_DEFAULT.lat, HQ_DEFAULT.lng], START_ZOOM);
map.attributionControl.setPrefix(false);

map.createPane('labels'); map.getPane('labels').style.zIndex = 390; map.getPane('labels').style.pointerEvents = 'none';
map.createPane('mask');   map.getPane('mask').style.zIndex = 395;   map.getPane('mask').style.pointerEvents = 'none';

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const LAYERS = {
  atlas:  {name:'Atlas', base:L.tileLayer(ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, maxNativeZoom:16, className:'base-tiles', attribution:'&copy; Esri, HERE, ' + OSM}),
           glow:L.tileLayer(ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, maxNativeZoom:16, className:'glow-tiles'}),
           labels:L.tileLayer(ESRI + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {maxZoom:14, pane:'labels'})},
  sat:    {name:'Satellite', base:L.tileLayer('https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg', {maxZoom:19, className:'base-tiles', attribution:'&copy; swisstopo'}),
           labels:L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, pane:'labels'})},
};
let layerKey = store.get('layer', 'atlas');
let showLabels = store.get('labels', true);
function applyLayer(){
  for (const k in LAYERS) for (const p of ['base', 'glow', 'labels']) LAYERS[k][p] && map.removeLayer(LAYERS[k][p]);
  if (!LAYERS[layerKey]) layerKey = 'atlas';
  const L_ = LAYERS[layerKey];
  L_.base.addTo(map);
  if (L_.glow) L_.glow.addTo(map);
  if (showLabels && L_.labels) L_.labels.addTo(map);
  document.body.dataset.layer = layerKey;
}
applyLayer();

// Canton "island": darken everything outside Kanton Zürich + glowing border
if (window.ZH_BOUNDARY){
  const g = window.ZH_BOUNDARY;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const rings = polys.map(p => p[0].map(([x, y]) => [y, x]));
  const world = [[-85, -180], [85, -180], [85, 180], [-85, 180]];
  L.polygon([world, ...rings], {pane:'mask', stroke:false, fillColor:'#05070f', fillOpacity:.8, interactive:false}).addTo(map);
  rings.forEach(r => {
    L.polyline(r, {pane:'mask', color:'#ff3d8b', weight:7, opacity:.25, interactive:false}).addTo(map);
    L.polyline(r, {pane:'mask', color:'#ffb3d1', weight:1.6, opacity:.9, interactive:false}).addTo(map);
  });
}

const markers = L.layerGroup().addTo(map);
let meMarker = null;

function taskMarker(t, ll, z = 0){
  const badge = t.steps.length > 1 ? `<span class="stp">${t.cur + 1}/${t.steps.length}</span>` : '';
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
  for (const k in CATS) h += `<button class="cat" data-k="${k}" style="--c:${CATS[k].color}"><span class="ic">${CATS[k].icon}</span><span><b>${CATS[k].name}</b><small>${CATS[k].hint}</small></span></button>`;
  h += `</div>`;
  openSheet(h, b => b.querySelectorAll('.cat').forEach(btn => btn.onclick = () => {
    draft = {id:uid(), cat:btn.dataset.k, title:'', desc:'', steps:[], multi:false, created:Date.now(), cur:0, status:'active'};
    sheetDetails();
  }));
}

function sheetDetails(){
  const c = CATS[draft.cat];
  openSheet(`
    <div class="kicker" style="--c:${c.color}">${c.name}</div>
    <div class="h">Objective details</div>
    <label class="f">Title</label>
    <input class="inp" id="dTitle" maxlength="80" placeholder="e.g. Get my driver's licence" value="${esc(draft.title)}">
    <label class="f">Description</label>
    <textarea class="inp" id="dDesc" rows="3" placeholder="What's it about? Notes, details…">${esc(draft.desc)}</textarea>
    <label class="toggle"><span><b>Multi-step objective</b><br><small style="color:var(--muted)">Next step appears when one is done</small></span><input type="checkbox" id="dMulti" ${draft.multi ? 'checked' : ''}></label>
    <button class="btn primary block" id="dNext">Next · Set place</button>
    <button class="btn ghost block" id="dBack">Back</button>`,
  b => {
    const title = b.querySelector('#dTitle'), multi = b.querySelector('#dMulti'), next = b.querySelector('#dNext');
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
    <div class="meta"><span class="chip">Started ${fmtDate(t.created)}</span>${meLatLng ? `<span class="chip">${distTo(s)} away</span>` : ''}</div>
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
    <button class="btn ghost danger block" id="mDel">Abandon objective</button>`,
  b => {
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
    <button class="btn block" id="xMove">📍 Move current step</button>
    <button class="btn block" id="xAdd">+ Add a step at the end</button>
    <button class="btn primary block" id="xSave">Save</button>
    <button class="btn ghost block" id="xBack">Back</button>`,
  b => {
    const commit = async () => {
      t.title = b.querySelector('#xTitle').value.trim() || t.title;
      t.desc = b.querySelector('#xDesc').value.trim();
      s.title = b.querySelector('#xStep').value.trim() || s.title;
      if (t.steps.length === 1) s.title = t.title;
      await saveTask(t);
    };
    b.querySelector('#xSave').onclick = async () => { await commit(); render(); openMission(t.id); };
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
    <div class="sub">Capture the moment for your story archive.</div>
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
  if (t.cur >= t.steps.length){
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
  const list = visible().sort((a, b) => (a.cat === 'story' ? -1 : 0) - (b.cat === 'story' ? -1 : 0) || a.created - b.created);
  openSheet(`
    <div class="h grad">${mode === 'all' ? 'All' : CATS[mode].name}</div>
    <div class="sub">${list.length} active</div>
    ${list.length ? list.map(t => { const s = t.steps[t.cur]; return `
      <button class="list-item" data-id="${t.id}">${blip(t.cat)}
        <span class="t"><b>${esc(t.title)}</b><small>${t.steps.length > 1 ? `${t.cur + 1}/${t.steps.length} · ${esc(s.title)}` : esc(s.place || '')}${meLatLng ? ' · ' + distTo(s) : ''}</small></span>
      </button>`; }).join('') : '<div class="empty">No active objectives. Tap + to add one.</div>'}`,
  b => b.querySelectorAll('.list-item').forEach(el => el.onclick = () => openMission(el.dataset.id)));
};

/* ---------------- Archive ---------------- */
$('#btnArchive').onclick = () => { $('#archive').hidden = false; renderArchive(); };
$('#archClose').onclick = () => { $('#archive').hidden = true; };

async function renderArchive(){
  const list = done().sort((a, b) => b.doneAt - a.doneAt);
  const counts = {}; list.forEach(t => counts[t.cat] = (counts[t.cat] || 0) + 1);
  let h = `<div class="stats"><div class="stat"><b>${list.length}</b><small>Objectives passed</small></div>`;
  for (const k in CATS) if (counts[k]) h += `<div class="stat" style="--c:${CATS[k].color}"><b>${counts[k]}</b><small>${CATS[k].name}</small></div>`;
  h += `</div><div class="arch-list">`;
  if (!list.length) h += `<div class="empty">Your story starts here.<br>Completed objectives appear in this archive with photos and timestamps.</div>`;
  let month = '';
  for (const t of list){
    const m = new Date(t.doneAt).toLocaleDateString('en-GB', {month:'long', year:'numeric'});
    if (m !== month){ month = m; h += `<div class="month">${m}</div>`; }
    const c = CATS[t.cat];
    h += `<button class="arch-card" data-id="${t.id}" style="--c:${c.color}">
      <div class="img" data-cover="${esc(coverId(t) || '')}">${coverId(t) ? '' : blip(t.cat)}</div>
      <div class="cap"><div class="kicker">${c.name}${t.steps.length > 1 ? ` · ${t.steps.length} steps` : ''}</div><b>${esc(t.title)}</b><small>${fmtDT(t.doneAt)}</small></div>
    </button>`;
  }
  h += `</div>`;
  const body = $('#archBody');
  body.innerHTML = h;
  body.querySelectorAll('.arch-card').forEach(el => el.onclick = () => renderArchiveDetail(el.dataset.id));
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
      <div class="kicker">${c.name} · Objective passed</div><div class="h">${esc(t.title)}</div></div></div>
    <div class="timeline">
      <div class="meta" style="margin-top:-6px"><span class="chip">Started ${fmtDT(t.created)}</span><span class="chip">Passed ${fmtDT(t.doneAt)}</span><span class="chip">⏱ ${fmtDur(t.doneAt - t.created)}</span></div>
      ${t.desc ? `<div class="desc" style="margin-bottom:18px">${esc(t.desc)}</div>` : ''}`;
  for (const s of t.steps){
    const u = await photoUrl(s.photoId);
    h += `<div class="tl" style="--c:${c.color}">
      <div class="when">${fmtDT(s.doneAt)}</div>
      <b>${esc(s.title)}</b>
      <small>📍 ${esc(s.place || '')}</small>
      ${s.desc ? `<div class="desc" style="margin-top:4px;font-size:13px">${esc(s.desc)}</div>` : ''}
      ${s.note ? `<div class="note">“${esc(s.note)}”</div>` : ''}
      ${u ? `<img src="${u}" alt="">` : ''}
    </div>`;
  }
  h += `<button class="btn block" id="adBack">Back to archive</button>
        <button class="btn ghost danger block" id="adDel">Delete from archive</button></div>`;
  $('#archBody').innerHTML = h;
  $('#archive').scrollTop = 0;
  $('#adBack').onclick = renderArchive;
  $('#adDel').onclick = async () => {
    if (!confirm(`Delete "${t.title}" and its photos permanently?`)) return;
    await deleteTask(t); renderArchive();
  };
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
    <div class="sub" style="margin:0 0 4px">Everything lives only on this phone. Export a backup now and then (includes photos).</div>
    <div class="row"><button class="btn" id="oExport">Export</button><button class="btn" id="oImport">Import</button></div>
    <div class="sub" style="margin-top:18px">${active().length} active · ${done().length} passed</div>`,
  b => {
    b.querySelectorAll('[data-l]').forEach(x => x.onclick = () => { layerKey = x.dataset.l; store.set('layer', layerKey); applyLayer(); $('#btnMenu').click(); });
    b.querySelector('#oLabels').onchange = e => { showLabels = e.target.checked; store.set('labels', showLabels); applyLayer(); };
    b.querySelectorAll('[data-place]').forEach(x => x.onclick = () => sheetPlace(placeById(x.dataset.place)));
    b.querySelector('#oAddPlace').onclick = () => sheetPlace(null);
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
  render();
})();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
