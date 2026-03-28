
const state = { menu: [], freskisMenu: [], filtered: [], cart: [], currentFreskiBase: null, audioPlaying: false, audioReady: false };
const MXN = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

async function loadJSON(path){ const r = await fetch(path); return r.json(); }
function slug(value=''){ return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function resolveImage(name=''){
  const cleaned = String(name||'').trim().toLowerCase();
  const map = {
    'hambg.jpeg':'assets/images/hambg.jpeg',
    'hotdog.jpeg':'assets/images/hotdog.jpeg',
    'alitas.jpeg':'assets/images/alitas.jpeg',
    'freskis.jpeg':'assets/images/freskis.jpeg',
    'gorditas.jpeg':'assets/images/gorditas.jpeg',
    'quesa.jpeg':'assets/images/quesa.jpeg',
    'chicha.jpeg':'assets/images/chicha.jpeg'
  };
  return map[cleaned] || 'assets/images/freskis.jpeg';
}
function unique(arr){ return [...new Set(arr.filter(Boolean))]; }
function fillSelect(el, values, placeholder){
  if(!el) return;
  const current = el.value;
  el.innerHTML = `<option value="">${placeholder}</option>` + values.map(v=>`<option value="${String(v).replace(/"/g,'&quot;')}">${v}</option>`).join('');
  if(values.includes(current)) el.value = current;
}
function getPresentacion(item){ return item.presentacion_ || item.presentacion || item.presentacion__ || ''; }
function isYes(value){ return ['si','sí','yes','true','1','x'].includes(String(value || '').trim().toLowerCase()); }
function normalizeMenuRow(row){
  return {
    ...row,
    categoria: String(row.categoria || row.Categoria || '').trim(),
    subcategoria: String(row.subcategoria || row.Subcategoria || row['Subcategoría'] || '').trim(),
    nombre: String(row.nombre || row.Nombre || '').trim(),
    variante: String(row.variante || row.Variante || '').trim(),
    descripcion: String(row.descripcion || row.Descripcion || row['Descripción'] || '').trim(),
    presentacion: String(row.presentacion || row.presentacion_ || row.Presentacion || row['Presentación'] || '').trim(),
    precio: Number(row.precio || row.Precio || 0),
    activo: row.activo ?? row.Activo ?? 'Sí',
    visible_web: row.visible_web ?? row['visible web'] ?? row.Visible_web ?? row['Visible Web'] ?? 'Sí',
    imagen_url: row.imagen_url || row.Imagen || row['Imagen URL'] || 'Freskis.jpeg'
  };
}
function normalizeFreskiRow(row){
  return {
    ...row,
    categoria: String(row.categoria || row.Categoria || '').trim(),
    tipo: String(row.tipo || row.Tipo || '').trim(),
    descripcion: String(row.descripcion || row.Descripcion || row['Descripción'] || '').trim(),
    imagen_url: row.imagen_url || row.Imagen || row['Imagen URL'] || 'Freskis.jpeg'
  };
}
function populateFilters(){
  fillSelect($('#f-categoria'), unique(state.menu.map(x=>x.categoria)), 'Todas las categorías');
  fillSelect($('#f-subcategoria'), unique(state.menu.map(x=>x.subcategoria)), 'Todas las subcategorías');
  fillSelect($('#f-presentacion'), unique(state.menu.map(getPresentacion)), 'Todas las presentaciones');
}
function applyFilters(){
  const q = ($('#f-buscar')?.value || '').trim().toLowerCase();
  const categoria = $('#f-categoria')?.value || '';
  const subcategoria = $('#f-subcategoria')?.value || '';
  const presentacion = $('#f-presentacion')?.value || '';
  state.filtered = state.menu
    .filter(x => !categoria || x.categoria === categoria)
    .filter(x => !subcategoria || x.subcategoria === subcategoria)
    .filter(x => !presentacion || getPresentacion(x) === presentacion)
    .filter(x => !q || [x.nombre,x.variante,x.descripcion,x.subcategoria,x.categoria].join(' ').toLowerCase().includes(q))
    .sort((a,b)=> (Number(a.orden)||0) - (Number(b.orden)||0));
  renderMenu();
}
function menuCard(item){
  return `
  <article class="item-card">
    <img src="${resolveImage(item.imagen_url)}" alt="${item.nombre}">
    <div class="item-body">
      <div class="tags">
        <span class="tag">${item.categoria}</span>
        <span class="tag">${item.subcategoria}</span>
        <span class="tag">${getPresentacion(item) || 'Individual'}</span>
      </div>
      <div>
        <h4 style="margin:0 0 4px">${item.nombre}</h4>
        <div class="muted">${item.variante || 'Especialidad de la casa'}</div>
      </div>
      <div class="muted">${item.descripcion || ''}</div>
      <div class="row"><div class="price">${MXN.format(Number(item.precio)||0)}</div></div>
      <div class="item-actions">
        <button class="small-btn primary" data-action="add" data-id="${item.id}">Agregar</button>
        <button class="small-btn" data-action="note" data-id="${item.id}">Agregar con observación</button>
      </div>
    </div>
  </article>`;
}
function renderMenu(){
  const wrap = $('#menu-grid');
  if(!wrap) return;
  wrap.innerHTML = state.filtered.length ? state.filtered.map(menuCard).join('') : '<div class="notice">No se encontraron productos con esos filtros.</div>';
  $$('[data-action="add"]', wrap).forEach(btn=> btn.addEventListener('click', ()=> handleAdd(btn.dataset.id, '')));
  $$('[data-action="note"]', wrap).forEach(btn=> btn.addEventListener('click', ()=> {
    const note = prompt('Escribe la observación adicional para este producto:', '');
    if(note === null) return;
    handleAdd(btn.dataset.id, note);
  }));
}
function handleAdd(id, note){
  const item = state.menu.find(x=> x.id === id);
  if(!item) return;
  if(String(item.categoria).trim().toLowerCase() === 'freskis'){
    state.currentFreskiBase = {...item, note};
    openFreskiBuilder();
    return;
  }
  state.cart.push({
    key: crypto.randomUUID(),
    id: item.id,
    nombre: item.nombre,
    variante: item.variante,
    presentacion: getPresentacion(item),
    precio: Number(item.precio)||0,
    imagen: resolveImage(item.imagen_url),
    observacion: note || '',
    qty: 1,
    detalle: item.descripcion || ''
  });
  renderCart();
}
function renderCart(){
  const list = $('#cart-list');
  if(!list) return;
  if(!state.cart.length){
    list.innerHTML = '<div class="notice">Tu pedido está vacío. Agrega productos desde la carta digital.</div>';
  } else {
    list.innerHTML = state.cart.map(item => `
      <div class="cart-item">
        <div class="row"><strong>${item.nombre}</strong><strong>${MXN.format(item.precio * item.qty)}</strong></div>
        <div class="muted">${[item.variante,item.presentacion,item.detalle].filter(Boolean).join(' · ')}</div>
        ${item.observacion ? `<div class="muted"><strong>Obs.:</strong> ${item.observacion}</div>` : ''}
        <div class="qty-controls">
          <button data-cart="minus" data-key="${item.key}">−</button>
          <strong>${item.qty}</strong>
          <button data-cart="plus" data-key="${item.key}">+</button>
          <button class="small-btn" data-cart="edit" data-key="${item.key}">Editar observación</button>
          <button class="small-btn" data-cart="remove" data-key="${item.key}">Eliminar</button>
        </div>
      </div>`).join('');
  }
  const total = state.cart.reduce((sum, item) => sum + (item.precio * item.qty), 0);
  $('#cart-total').textContent = MXN.format(total);
  $$('[data-cart]', list).forEach(btn => btn.addEventListener('click', () => {
    const item = state.cart.find(x => x.key === btn.dataset.key);
    if(!item) return;
    if(btn.dataset.cart === 'plus') item.qty += 1;
    if(btn.dataset.cart === 'minus') item.qty = Math.max(1, item.qty - 1);
    if(btn.dataset.cart === 'remove') state.cart = state.cart.filter(x => x.key !== item.key);
    if(btn.dataset.cart === 'edit'){
      const updated = prompt('Editar observación:', item.observacion || '');
      if(updated !== null) item.observacion = updated;
    }
    renderCart();
  }));
}
function buildFreskiOptions(stepLabel, categoryNames){
  return state.freskisMenu.filter(x => categoryNames.includes(String(x.categoria||'').trim().toLowerCase())).map(x => ({
    id: x.id,
    step: stepLabel,
    categoria: String(x.categoria||'').trim(),
    tipo: x.tipo,
    descripcion: x.descripcion,
    imagen: resolveImage(x.imagen_url)
  }));
}
function openFreskiBuilder(){
  const modal = $('#freski-modal');
  const body = $('#freski-body');
  const fruta = buildFreskiOptions('Paso 1: fruta', ['fruta']);
  const topping = buildFreskiOptions('Paso 2: topping', ['topping']);
  const crema = buildFreskiOptions('Paso 3: crema', ['crema']);
  const top = buildFreskiOptions('Paso 4: top', ['top']);
  const groups = [fruta, topping, crema, top];
  body.innerHTML = groups.map((group, idx) => `
    <section class="card" style="padding:16px;margin-bottom:14px">
      <h4 style="margin:0 0 10px">${group[0]?.step || `Paso ${idx+1}`}</h4>
      <div class="step-grid">
      ${group.map(opt => `
        <label class="option-card">
          <input type="radio" name="freski-step-${idx}" value="${opt.id}" style="margin-right:10px">
          <strong>${opt.tipo}</strong>
          <div class="muted">${opt.descripcion || ''}</div>
        </label>`).join('')}
      </div>
    </section>`).join('') + `
      <div class="field">
        <label>Observaciones adicionales</label>
        <textarea id="freski-note" rows="3" placeholder="Ej. sin lechera, con extra crema"></textarea>
      </div>`;
  modal.classList.add('show');
}
function closeFreskiBuilder(){ $('#freski-modal').classList.remove('show'); }
function confirmFreski(){
  const selected = [0,1,2,3].map(i => $(`input[name="freski-step-${i}"]:checked`)).filter(Boolean);
  if(selected.length < 4){ alert('Selecciona una opción en cada paso para armar tu Freski.'); return; }
  const parts = selected.map(sel => state.freskisMenu.find(x => x.id === sel.value)).filter(Boolean);
  const extraNote = $('#freski-note').value.trim();
  const base = state.currentFreskiBase;
  state.cart.push({
    key: crypto.randomUUID(),
    id: base.id,
    nombre: base.nombre,
    variante: base.variante,
    presentacion: getPresentacion(base),
    precio: Number(base.precio)||0,
    imagen: resolveImage(base.imagen_url),
    observacion: [base.note, extraNote].filter(Boolean).join(' | '),
    qty: 1,
    detalle: `Arma tu Freski: ${parts.map(p => `${p.categoria.trim()}: ${p.tipo}`).join(' · ')}`
  });
  renderCart();
  closeFreskiBuilder();
}
function getFolio(){
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `PED-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
function buildOrderMessage(){
  if(!state.cart.length){ alert('Agrega al menos un producto al pedido.'); return null; }
  const orderType = $('input[name="consumo"]:checked')?.value || 'Para comer aquí';
  const lines = [
    '🍔 *Nuevo pedido Freskis + La Gran Pantalla*',
    `Folio: *${getFolio()}*`,
    '',
    '*Productos:*'
  ];
  state.cart.forEach((item, idx) => {
    lines.push(`${idx+1}. ${item.qty} x ${item.nombre} (${[item.variante,item.presentacion].filter(Boolean).join(' / ')}) - ${MXN.format(item.precio * item.qty)}`);
    if(item.detalle) lines.push(`   ${item.detalle}`);
    if(item.observacion) lines.push(`   Observación: ${item.observacion}`);
  });
  const total = state.cart.reduce((sum, item) => sum + item.precio * item.qty, 0);
  lines.push('', `*Total:* ${MXN.format(total)}`, `*Consumo:* ${orderType}`);
  if(orderType === 'Envío a domicilio'){
    lines.push(`Nombre: ${$('#envio-nombre').value || '-'}`);
    lines.push(`Dirección: ${$('#envio-direccion').value || '-'}`);
    lines.push(`Ubicación WhatsApp: ${$('#envio-ubicacion').value || '-'}`);
  }
  return encodeURIComponent(lines.join('\n'));
}
function setupWhatsApp(){
  $$('.wa-btn').forEach(btn => btn.addEventListener('click', () => {
    const text = buildOrderMessage();
    if(!text) return;
    window.open(`https://wa.me/${btn.dataset.phone}?text=${text}`, '_blank');
  }));
}
function setupConsumption(){
  const wrap = $('#delivery-fields');
  $$('input[name="consumo"]').forEach(r => r.addEventListener('change', ()=> {
    wrap.classList.toggle('hidden', $('input[name="consumo"]:checked')?.value !== 'Envío a domicilio');
  }));
}
function setupAudio(){
  const audio = $('#bg-audio');
  const toggle = $('#audio-toggle');
  const status = $('#audio-status');
  if(!audio || !toggle) return;

  audio.volume = 0.65;
  audio.setAttribute('playsinline', '');

  function sync(message=''){
    toggle.textContent = audio.paused ? '▶ Reproducir música' : '⏸ Pausar música';
    if(status) status.textContent = message || (audio.paused ? 'Música en pausa' : 'Música reproduciéndose');
  }

  async function tryPlay(){
    try{
      await audio.play();
      state.audioReady = true;
      sync('Música reproduciéndose');
    }catch(e){
      console.warn('No se pudo reproducir audio automáticamente:', e);
      sync('Toca el botón para activar la música');
    }
  }

  toggle.addEventListener('click', async () => {
    if(audio.paused){
      await tryPlay();
    } else {
      audio.pause();
      sync('Música en pausa');
    }
  });

  ['click','touchstart','keydown'].forEach(evt => {
    document.addEventListener(evt, async function once(){
      if(audio.paused && !state.audioReady){ await tryPlay(); }
      document.removeEventListener(evt, once);
    }, { once:true, passive:true });
  });

  audio.addEventListener('canplay', ()=> sync(state.audioReady ? 'Música lista' : 'Audio cargado'));
  audio.addEventListener('error', ()=> sync('No se pudo cargar el archivo de audio'));
  sync('Cargando audio...');
}
async function loadWorkbookSheet(path){
  if(typeof XLSX === 'undefined') return null;
  const response = await fetch(path);
  if(!response.ok) throw new Error(`No se pudo abrir ${path}`);
  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type:'array' });
  const firstSheet = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval:'' });
}
async function loadMenuData(){
  let menu = [];
  let freskisMenu = [];
  try {
    const rows = await loadWorkbookSheet('data/LGP-Menu.xlsx');
    if(rows?.length) menu = rows.map(normalizeMenuRow);
  } catch(e){ console.warn('No se pudo leer el Excel principal, se usará JSON.', e); }
  try {
    const rows = await loadWorkbookSheet('data/Freskis-Menu.xlsx');
    if(rows?.length) freskisMenu = rows.map(normalizeFreskiRow);
  } catch(e){ console.warn('No se pudo leer el Excel de Freskis, se usará JSON.', e); }
  if(!menu.length){
    menu = (await loadJSON('data/lgp-menu.json')).map(normalizeMenuRow);
  }
  if(!freskisMenu.length){
    freskisMenu = (await loadJSON('data/freskis-menu.json')).map(normalizeFreskiRow);
  }
  return { menu, freskisMenu };
}
async function initHome(){
  if(!$('#menu-grid')) return;
  const { menu, freskisMenu } = await loadMenuData();
  state.menu = menu.filter(x => isYes(x.activo) && isYes(x.visible_web));
  state.freskisMenu = freskisMenu;
  populateFilters();
  ['#f-categoria','#f-subcategoria','#f-presentacion','#f-buscar'].forEach(sel => $(sel).addEventListener('input', applyFilters));
  applyFilters();
  renderCart();
  setupWhatsApp();
  setupConsumption();
  setupAudio();
  $('#empty-cart').addEventListener('click', ()=> { state.cart = []; renderCart(); });
  $('#freski-close').addEventListener('click', closeFreskiBuilder);
  $('#freski-confirm').addEventListener('click', confirmFreski);
}
function initAdmin(){
  const login = $('#admin-login');
  if(!login) return;
  const gate = $('#admin-gate');
  const panel = $('#admin-panel');
  const passInput = $('#admin-password');
  const unlock = () => {
    if(passInput.value === '1A972df8$'){
      sessionStorage.setItem('freskis_admin', 'ok');
      gate.classList.add('hidden');
      panel.classList.remove('hidden');
    } else {
      alert('Contraseña incorrecta.');
    }
  };
  login.addEventListener('click', unlock);
  if(sessionStorage.getItem('freskis_admin') === 'ok'){ gate.classList.add('hidden'); panel.classList.remove('hidden'); }
  $('#admin-exit').addEventListener('click', ()=> { sessionStorage.removeItem('freskis_admin'); location.reload(); });
}
document.addEventListener('DOMContentLoaded', () => { initHome(); initAdmin(); });
