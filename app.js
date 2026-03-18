const APP_CATALOG_VERSION = '2026-03-17-filters-fix';
const STORAGE_KEYS = {
  catalog: 'freskis_catalog',
  catalogVersion: 'freskis_catalog_version',
  promotions: 'freskis_promotions',
  notice: 'freskis_notice',
  game: 'freskis_game',
  auth: 'freskis_admin_auth'
};

const ADMIN_PASSWORD = '1A972df8$';
let catalog = [];
let cart = [];
let heroIndex = 0;
let heroTimer = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const formatMoney = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));
const safe = (str) => String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[s]));
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

function normalizeCatalogRows(rows = []) {
  const getField = (row, keys, fallback = '') => {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
    }
    return fallback;
  };

  return (Array.isArray(rows) ? rows : []).map((row, idx) => ({
    id: getField(row, ['id', 'ID'], `ITEM-${idx + 1}`),
    categoria: String(getField(row, ['categoria', 'Categoría', 'Categoria'], 'General')).trim(),
    subcategoria: String(getField(row, ['subcategoria', 'Subcategoría', 'Subcategoria'], getField(row, ['categoria', 'Categoría', 'Categoria'], 'General'))).trim(),
    nombre: String(getField(row, ['nombre', 'Nombre'], 'Producto')).trim(),
    variante: String(getField(row, ['variante', 'Variante'], '')).trim(),
    descripcion: String(getField(row, ['descripcion', 'Descripción', 'Descripcion'], '')).trim(),
    tipo_precio: String(getField(row, ['tipo_precio', 'tipo precio', 'Tipo', 'Tipo precio'], 'General')).trim(),
    precio: Number(getField(row, ['precio', 'Precio'], 0)) || 0,
    moneda: String(getField(row, ['moneda', 'Moneda'], 'MXN')).trim(),
    activo: String(getField(row, ['activo', 'Activo'], 'Sí')).trim(),
    visible_web: String(getField(row, ['visible_web', 'Visible web', 'Visible'], 'Sí')).trim(),
    orden: Number(getField(row, ['orden', 'Orden'], idx + 1)) || (idx + 1),
    slug: String(getField(row, ['slug', 'Slug'], '')).trim(),
    imagen_url: String(getField(row, ['imagen_url', 'Imagen', 'imagen'], '')).trim(),
    notas: String(getField(row, ['notas', 'Notas'], '')).trim(),
    imagen_local: row?.imagen_local || resolveProductImage(row || {})
  }));
}

function catalogHasUsableFilters(rows = []) {
  const normalized = normalizeCatalogRows(rows);
  const categories = new Set(normalized.map(r => String(r.categoria || '').trim()).filter(Boolean));
  const subcategories = new Set(normalized.map(r => String(r.subcategoria || '').trim()).filter(Boolean));
  const priceTypes = new Set(normalized.map(r => String(r.tipo_precio || '').trim()).filter(Boolean));
  return normalized.length > 0 && categories.size > 0 && subcategories.size > 0 && priceTypes.size > 0;
}

function getSeedCatalog() {
  return normalizeCatalogRows(window.DEFAULT_MENU_DATA || []);
}

function ensureCatalogReady() {
  const storedVersion = load(STORAGE_KEYS.catalogVersion, '');
  const storedCatalog = load(STORAGE_KEYS.catalog, null);
  const seededCatalog = getSeedCatalog();

  if (storedVersion !== APP_CATALOG_VERSION || !catalogHasUsableFilters(storedCatalog)) {
    save(STORAGE_KEYS.catalog, seededCatalog);
    save(STORAGE_KEYS.catalogVersion, APP_CATALOG_VERSION);
    return seededCatalog;
  }
  return normalizeCatalogRows(storedCatalog);
}

function getVisibleCatalogRows() {
  return ensureCatalogReady().filter(row => {
    const visible = String(row.visible_web || 'Sí').toLowerCase();
    const activo = String(row.activo || 'Sí').toLowerCase();
    const isVisible = !['no', 'false', '0'].includes(visible);
    const isActive = !['no', 'false', '0'].includes(activo);
    return isVisible && isActive;
  });
}

function getCatalog() {
  return getVisibleCatalogRows();
}

function setCatalog(data) {
  const normalized = normalizeCatalogRows(data);
  catalog = normalized.filter(row => {
    const visible = String(row.visible_web || 'Sí').toLowerCase();
    const activo = String(row.activo || 'Sí').toLowerCase();
    return !['no', 'false', '0'].includes(visible) && !['no', 'false', '0'].includes(activo);
  });
  save(STORAGE_KEYS.catalog, normalized);
  save(STORAGE_KEYS.catalogVersion, APP_CATALOG_VERSION);
}


function parseExcelCatalog(file) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    const workbook = XLSX.read(evt.target.result, { type: 'array' });
    const preferredName = workbook.SheetNames.find(name => String(name).toLowerCase().includes('tabla_web'));
    const firstSheet = workbook.Sheets[preferredName || workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    const normalized = normalizeCatalogRows(rows);

    setCatalog(normalized);
    cart = [];
    renderAll();
    alert('Catálogo cargado correctamente.');
  };
  reader.readAsArrayBuffer(file);
}

function resolveProductImage(row) {
  const sub = String(row.subcategoria || row.categoria || '').toLowerCase();
  if (sub.includes('alitas') || sub.includes('papas')) return 'assets/alitas.jpeg';
  if (sub.includes('gorditas') || sub.includes('quesadillas')) return 'assets/gorditas.jpeg';
  if (sub.includes('chicharron')) return 'assets/chicharron.jpeg';
  if (sub.includes('hamburguesas') || sub.includes('hot dog') || sub.includes('bebidas') || sub.includes('frappe')) return 'assets/promo-flayer.jpeg';
  return 'assets/logo-freskis.jpeg';
}

function getCategoryIcon(label) {
  const text = String(label || '').toLowerCase();
  if (text.includes('hamburguesa')) return '🍔';
  if (text.includes('hot dog')) return '🌭';
  if (text.includes('alitas')) return '🍗';
  if (text.includes('papas')) return '🍟';
  if (text.includes('frappe')) return '🥤';
  if (text.includes('bebida') || text.includes('freski') || text.includes('refresc')) return '🧋';
  if (text.includes('caliente')) return '☕';
  if (text.includes('ensalada')) return '🥗';
  if (text.includes('gordita')) return '🫓';
  if (text.includes('quesadilla')) return '🧀';
  if (text.includes('chicharron')) return '🔥';
  return '🍽️';
}

function fillFilterOptions() {
  const rows = getCatalog();

  const normalizeText = (v) => String(v ?? '').trim();
  const uniqueValues = (values) => {
    const seen = new Set();
    return values
      .map(normalizeText)
      .filter(Boolean)
      .filter(v => {
        const key = v.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, 'es'));
  };

  const categoriaSelect = $('#filterCategoria');
  const subcategoriaSelect = $('#filterSubcategoria');
  const tipoSelect = $('#filterTipo');
  const sortMenu = $('#sortMenu');

  const currentCategoria = categoriaSelect?.value || '';
  const currentSubcategoria = subcategoriaSelect?.value || '';
  const currentTipo = tipoSelect?.value || '';
  const currentSort = sortMenu?.value || 'orden';

  const categories = uniqueValues(rows.map(r => r.categoria));
  const subcategories = uniqueValues(rows.map(r => r.subcategoria));
  const priceTypes = uniqueValues(rows.map(r => r.tipo_precio));

  const fill = (select, items, placeholder, currentValue = '') => {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>` + items.map(v => `<option value="${safe(v)}">${safe(v)}</option>`).join('');
    select.value = items.includes(currentValue) ? currentValue : '';
  };

  fill(categoriaSelect, categories, 'Todas las categorías', currentCategoria);
  fill(subcategoriaSelect, subcategories, 'Todas las subcategorías', currentSubcategoria);
  fill(tipoSelect, priceTypes, 'Todos los tipos de precio', currentTipo);

  if (sortMenu) {
    sortMenu.innerHTML = `
      <option value="orden">Orden original</option>
      <option value="precioAsc">Precio menor</option>
      <option value="precioDesc">Precio mayor</option>
      <option value="nombre">Nombre A-Z</option>
    `;
    sortMenu.value = ['orden', 'precioAsc', 'precioDesc', 'nombre'].includes(currentSort) ? currentSort : 'orden';
  }

  const filterStatus = $('#filterStatus');
  if (filterStatus) {
    filterStatus.innerHTML = `
      <span><strong>${categories.length}</strong> categoría(s)</span>
      <span><strong>${subcategories.length}</strong> subcategoría(s)</span>
      <span><strong>${priceTypes.length}</strong> tipo(s) de precio</span>
      <span><strong>Orden original</strong> disponible</span>
    `;
  }
}

function getFilteredCatalog() {
  const search = $('#menuSearch').value.trim().toLowerCase();
  const categoria = $('#filterCategoria').value;
  const subcategoria = $('#filterSubcategoria').value;
  const tipo = $('#filterTipo').value;
  const sortMode = $('#sortMenu').value;

  let rows = getCatalog().filter(row => {
    const haystack = `${row.categoria} ${row.subcategoria} ${row.nombre} ${row.variante} ${row.descripcion} ${row.tipo_precio}`.toLowerCase();
    return (!search || haystack.includes(search))
      && (!categoria || row.categoria === categoria)
      && (!subcategoria || row.subcategoria === subcategoria)
      && (!tipo || row.tipo_precio === tipo);
  });

  rows.sort((a, b) => {
    if (sortMode === 'precioAsc') return Number(a.precio) - Number(b.precio);
    if (sortMode === 'precioDesc') return Number(b.precio) - Number(a.precio);
    if (sortMode === 'nombre') return String(a.nombre).localeCompare(String(b.nombre), 'es');
    return Number(a.orden || 0) - Number(b.orden || 0);
  });

  return rows;
}

function renderCategoryIcons() {
  const rows = getCatalog();
  const labels = [...new Set(rows.map(r => r.subcategoria || r.categoria).filter(Boolean))].slice(0, 10);
  const grid = $('#categoryIconGrid');
  grid.innerHTML = labels.length ? labels.map(label => `
    <article class="category-card">
      <div class="category-icon">${getCategoryIcon(label)}</div>
      <h3>${safe(label)}</h3>
      <p>Disponible para mesa, carta digital y pedido rápido.</p>
    </article>
  `).join('') : '<div class="empty-state">No hay categorías cargadas todavía.</div>';
}

function renderMenuTable() {
  const rows = getFilteredCatalog();
  const wrap = $('#menuTableWrap');
  if (!rows.length) {
    wrap.innerHTML = '<div class="empty-state">No hay productos que coincidan con los filtros actuales.</div>';
    return;
  }

  wrap.innerHTML = `
    <table class="catalog-table">
      <thead>
        <tr>
          <th>Imagen</th>
          <th>Producto</th>
          <th>Categoría</th>
          <th>Precio</th>
          <th>Agregar</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td><img class="product-photo" src="${safe(row.imagen_local || resolveProductImage(row))}" alt="${safe(row.nombre)}"></td>
            <td>
              <span class="product-name">${safe(row.nombre)}</span>
              <span class="product-meta">${safe(row.variante)} · ${safe(row.tipo_precio)}</span>
              <span class="product-meta">${safe(row.descripcion)}</span>
            </td>
            <td>${safe(row.subcategoria || row.categoria)}</td>
            <td>${formatMoney(row.precio)}</td>
            <td><button class="add-btn" data-id="${safe(row.id)}">Agregar</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('.add-btn').forEach(btn => btn.addEventListener('click', () => addToCart(btn.dataset.id)));
}

function addToCart(id) {
  const item = getCatalog().find(r => String(r.id) === String(id));
  if (!item) return;
  const existing = cart.find(ci => ci.id === item.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1, comment: '', image: '' });
  }
  renderCart();
}

function updateCartItem(id, patch, rerender = true) {
  const item = cart.find(ci => ci.id === id);
  if (!item) return;
  Object.assign(item, patch);
  if (rerender) renderCart();
}

function changeQty(id, delta) {
  const item = cart.find(ci => ci.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(ci => ci.id !== id);
  renderCart();
}

function handleItemImage(id, file) {
  const reader = new FileReader();
  reader.onload = (e) => updateCartItem(id, { image: e.target.result }, true);
  reader.readAsDataURL(file);
}

function renderCart() {
  const total = cart.reduce((sum, item) => sum + Number(item.precio) * item.qty, 0);
  const markup = cart.length ? cart.map(item => `
    <div class="cart-item">
      <div class="cart-row">
        <div>
          <h4>${safe(item.nombre)} <small>(${safe(item.variante)} · ${safe(item.tipo_precio)})</small></h4>
          <p>${safe(item.descripcion)}</p>
        </div>
        <strong>${formatMoney(item.precio * item.qty)}</strong>
      </div>

      <div class="qty-controls">
        <button data-action="minus" data-id="${safe(item.id)}">−</button>
        <span>${item.qty}</span>
        <button data-action="plus" data-id="${safe(item.id)}">+</button>
      </div>

      <textarea placeholder="Comentario adicional para este producto..." data-role="comment" data-id="${safe(item.id)}">${safe(item.comment)}</textarea>
      ${item.image ? `<img class="preview-thumb" src="${item.image}" alt="Imagen adicional">` : ''}
    </div>
  `).join('') : '<div class="empty-state">Aún no has agregado productos.</div>';

  $('#cartItems').innerHTML = markup;
  $('#deliveryCartItems').innerHTML = markup;
  $('#cartTotal').textContent = formatMoney(total);
  $('#deliveryTotal').textContent = formatMoney(total);
  $('#orderPreview').textContent = buildOrderMessage();

  $$('[data-action]').forEach(btn => btn.addEventListener('click', () => changeQty(btn.dataset.id, btn.dataset.action === 'plus' ? 1 : -1)));
  $$('textarea[data-role="comment"]').forEach(input => {
    input.addEventListener('input', () => updateCartItem(input.dataset.id, { comment: input.value }, false));
    input.addEventListener('change', () => updateCartItem(input.dataset.id, { comment: input.value }, false));
    input.addEventListener('blur', () => updateCartItem(input.dataset.id, { comment: input.value }, false));
  });
}

function buildOrderMessage() {
  const name = $('#customerName')?.value?.trim() || '';
  const address = $('#customerAddress')?.value?.trim() || '';
  const notes = $('#customerNotes')?.value?.trim() || '';
  const total = cart.reduce((sum, item) => sum + Number(item.precio) * item.qty, 0);

  const lines = [
    'Hola, quiero realizar el siguiente pedido:',
    '',
    ...cart.flatMap((item, idx) => [
      `${idx + 1}. ${item.qty} x ${item.nombre} (${item.variante} · ${item.tipo_precio}) - ${formatMoney(item.precio * item.qty)}`,
      item.comment ? `   Nota: ${item.comment}` : ''
    ].filter(Boolean)),
    '',
    `Total estimado: ${formatMoney(total)}`,
    name ? `Nombre: ${name}` : '',
    address ? `Dirección: ${address}` : '',
    notes ? `Indicaciones generales: ${notes}` : ''
  ].filter(Boolean);

  return lines.join('\n');
}

function renderPromotions() {
  const defaultPromo = [{ name: 'Promoción destacada', type: 'image', data: 'assets/promo-flayer.jpeg' }];
  const promos = load(STORAGE_KEYS.promotions, defaultPromo);
  const grid = $('#promotionsGrid');
  if (!promos.length) {
    grid.innerHTML = '<div class="empty-state">No hay promociones activas por el momento.</div>';
    return;
  }
  grid.innerHTML = promos.map((promo, i) => `
    <article class="promo-card">
      <div class="media">
        <span class="promo-badge">Promo activa</span>
        ${promo.type === 'pdf'
          ? `<embed src="${promo.data}" type="application/pdf">`
          : `<img src="${promo.data}" alt="${safe(promo.name || `Promoción ${i + 1}`)}">`}
      </div>
      <div class="body">
        <h3>${safe(promo.name || `Promoción ${i + 1}`)}</h3>
        <p>${promo.type === 'pdf' ? 'Flyer en PDF cargado desde administración.' : 'Flyer gráfico cargado desde administración.'}</p>
        <a class="promo-link" href="${promo.data}" target="_blank" rel="noopener">Abrir flyer</a>
      </div>
    </article>
  `).join('');
  renderAdminPromoList();
}

function fileToStoredObject(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => callback({
    name: file.name,
    type: file.type.includes('pdf') ? 'pdf' : 'image',
    data: e.target.result
  });
  reader.readAsDataURL(file);
}

function renderAdminPromoList() {
  const list = $('#adminPromoList');
  if (!list) return;
  const promos = load(STORAGE_KEYS.promotions, []);
  list.innerHTML = promos.length ? promos.map((promo, idx) => `
    <div class="file-chip">
      <span>${safe(promo.name)}</span>
      <button class="btn btn-mini" data-remove-promo="${idx}">Eliminar</button>
    </div>
  `).join('') : '<div class="empty-state">No hay flyers cargados.</div>';
  list.querySelectorAll('[data-remove-promo]').forEach(btn => btn.addEventListener('click', () => {
    const promos = load(STORAGE_KEYS.promotions, []);
    promos.splice(Number(btn.dataset.removePromo), 1);
    save(STORAGE_KEYS.promotions, promos);
    renderPromotions();
  }));
}

function renderNotice() {
  const notice = load(STORAGE_KEYS.notice, { enabled: false, text: '', file: null });
  const banner = $('#globalNotice');
  const adminPreview = $('#noticePreviewAdmin');

  const fileData = notice?.file?.data || notice?.file?.url || '';
  const fileName = notice?.file?.name || 'aviso';
  const hasFile = Boolean(fileData);

  if (notice.enabled) {
    banner.classList.remove('hidden');
    banner.innerHTML = `
      <div class="notice-content">
        <span>${safe(notice.text || 'Hay un aviso importante activo.')}</span>
        ${hasFile ? `<a class="notice-link" href="${fileData}" target="_blank" rel="noopener" download="${safe(fileName)}">Ver aviso</a>` : ''}
      </div>
    `;
  } else {
    banner.classList.add('hidden');
    banner.textContent = '';
  }

  if (adminPreview) {
    adminPreview.innerHTML = hasFile
      ? `
        <div class="file-chip">
          <span>${safe(fileName)}</span>
          <span>${notice.enabled ? 'Activo' : 'Inactivo'}</span>
          <a class="inline-link" href="${fileData}" target="_blank" rel="noopener" download="${safe(fileName)}">Ver aviso</a>
        </div>
      `
      : '<div class="empty-state">No hay archivo de aviso cargado.</div>';
  }

  if ($('#noticeEnabled')) $('#noticeEnabled').checked = !!notice.enabled;
  if ($('#noticeText')) $('#noticeText').value = notice.text || '';
}

function renderGame() {
  const game = load(STORAGE_KEYS.game, { path: 'game-placeholder.html', target: '', prize: '' });
  $('#gameFrame').src = game.path || 'game-placeholder.html';
  $('#gameRewardBox').innerHTML = `
    <strong>Reto actual:</strong><br>
    ${game.target ? `Meta de puntos: ${safe(game.target)}<br>` : 'Configura una meta de puntos en administración.<br>'}
    ${game.prize ? `Premio: ${safe(game.prize)}` : 'Configura el premio del reto.'}
  `;
  if ($('#gamePath')) $('#gamePath').value = game.path || '';
  if ($('#gameTarget')) $('#gameTarget').value = game.target || '';
  if ($('#gamePrize')) $('#gamePrize').value = game.prize || '';
}

function renderAll() {
  ensureCatalogReady();
  catalog = getCatalog();
  fillFilterOptions();
  renderCategoryIcons();
  renderMenuTable();
  renderCart();
  renderPromotions();
  renderNotice();
  renderGame();
}

function initAdmin() {
  const isAuthed = load(STORAGE_KEYS.auth, false);
  if (isAuthed) {
    $('#adminPanel').classList.remove('hidden');
    $('#adminLoginCard').classList.add('hidden');
  }

  $('#adminLogin').addEventListener('click', () => {
    const pass = $('#adminPassword').value;
    if (pass === ADMIN_PASSWORD) {
      save(STORAGE_KEYS.auth, true);
      $('#adminPanel').classList.remove('hidden');
      $('#adminLoginCard').classList.add('hidden');
    } else {
      alert('Contraseña incorrecta.');
    }
  });

  $('#catalogUpload').addEventListener('change', (e) => e.target.files[0] && parseExcelCatalog(e.target.files[0]));
  $('#restoreDefaultCatalog').addEventListener('click', () => {
    save(STORAGE_KEYS.catalog, getSeedCatalog());
    save(STORAGE_KEYS.catalogVersion, APP_CATALOG_VERSION);
    catalog = getCatalog();
    renderAll();
    alert('Se restauró el catálogo base.');
  });

  $('#promoUpload').addEventListener('change', (e) => {
    const files = [...e.target.files];
    const promos = load(STORAGE_KEYS.promotions, []);
    let processed = 0;
    if (!files.length) return;

    files.forEach(file => fileToStoredObject(file, (stored) => {
      promos.push(stored);
      processed += 1;
      if (processed === files.length) {
        save(STORAGE_KEYS.promotions, promos);
        renderPromotions();
        alert('Flyers cargados correctamente.');
      }
    }));
  });

  $('#saveNotice').addEventListener('click', () => {
    const enabled = $('#noticeEnabled').checked;
    const text = $('#noticeText').value.trim();
    const fileInput = $('#noticeUpload');
    const current = load(STORAGE_KEYS.notice, { enabled:false, text:'', file:null });

    if (fileInput.files[0]) {
      fileToStoredObject(fileInput.files[0], (stored) => {
        save(STORAGE_KEYS.notice, {
          enabled,
          text,
          file: {
            name: stored.name || fileInput.files[0].name || 'aviso',
            type: stored.type || fileInput.files[0].type || '',
            data: stored.data || ''
          }
        });
        renderNotice();
        alert('Aviso guardado.');
      });
    } else {
      save(STORAGE_KEYS.notice, {
        enabled,
        text,
        file: current.file ? {
          name: current.file.name || 'aviso',
          type: current.file.type || '',
          data: current.file.data || current.file.url || ''
        } : null
      });
      renderNotice();
      alert('Aviso guardado.');
    }
  });

  $('#saveGameSettings').addEventListener('click', () => {
    save(STORAGE_KEYS.game, {
      path: $('#gamePath').value.trim() || 'game-placeholder.html',
      target: $('#gameTarget').value.trim(),
      prize: $('#gamePrize').value.trim()
    });
    renderGame();
    alert('Configuración del juego guardada.');
  });
}

function initEvents() {
  ['#menuSearch','#filterCategoria','#filterSubcategoria','#filterTipo','#sortMenu'].forEach(sel => {
    $(sel).addEventListener('input', renderMenuTable);
    $(sel).addEventListener('change', renderMenuTable);
  });

  $('#clearFilters').addEventListener('click', () => {
    $('#menuSearch').value = '';
    $('#filterCategoria').value = '';
    $('#filterSubcategoria').value = '';
    $('#filterTipo').value = '';
    $('#sortMenu').value = 'orden';
    renderMenuTable();
  });

  $('#emptyCart').addEventListener('click', () => {
    cart = [];
    const customerName = $('#customerName');
    const customerAddress = $('#customerAddress');
    const customerNotes = $('#customerNotes');
    if (customerName) customerName.value = '';
    if (customerAddress) customerAddress.value = '';
    if (customerNotes) customerNotes.value = '';
    renderCart();
  });

  ['#customerName','#customerAddress','#customerNotes'].forEach(sel => $(sel).addEventListener('input', () => {
    $('#orderPreview').textContent = buildOrderMessage();
  }));

  $('#copyOrder').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(buildOrderMessage());
      alert('Pedido copiado al portapapeles.');
    } catch {
      alert('No fue posible copiar automáticamente.');
    }
  });

  $('#sendWhatsApp').addEventListener('click', () => {
    const msg = encodeURIComponent(buildOrderMessage());
    window.open(`https://wa.me/525547719349?text=${msg}`, '_blank', 'noopener');
  });
}

function initHeroCarousel() {
  const slides = $$('#heroCarousel .hero-slide');
  const dotsWrap = $('#heroDots');
  if (!slides.length || !dotsWrap) return;

  const activate = (index) => {
    heroIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('active', i === heroIndex));
    $$('#heroDots .hero-dot').forEach((dot, i) => dot.classList.toggle('active', i === heroIndex));
  };

  dotsWrap.innerHTML = slides.map((_, i) => `<button class="hero-dot ${i === 0 ? 'active' : ''}" data-dot="${i}" aria-label="Ir al slide ${i + 1}"></button>`).join('');
  $$('#heroDots .hero-dot').forEach(dot => dot.addEventListener('click', () => {
    activate(Number(dot.dataset.dot));
    restartHeroTimer(activate, slides.length);
  }));

  activate(0);
  restartHeroTimer(activate, slides.length);
}

function restartHeroTimer(activate, len) {
  if (heroTimer) clearInterval(heroTimer);
  heroTimer = setInterval(() => activate((heroIndex + 1) % len), 4200);
}

document.addEventListener('DOMContentLoaded', () => {
  ensureCatalogReady();
  catalog = getCatalog();
  fillFilterOptions();
  renderAll();
  initAdmin();
  initEvents();
  initHeroCarousel();
});
