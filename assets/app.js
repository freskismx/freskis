const APP = {
  state: {
    config: null,
    menu: [],
    freskiOptions: [],
    promos: [],
    games: [],
    cart: JSON.parse(localStorage.getItem('freskis-cart') || '[]'),
    mode: localStorage.getItem('freskis-mode') || 'Para comer aquí',
    filters: { categoria:'', subcategoria:'', presentacion:'', q:'' },
    editingCommentUid: null,
    commentDraft: '',
    lastError: ''
  },

  // ===================== helpers =====================
  el(id){ return document.getElementById(id); },
  uid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  },
  escapeHtml(value){
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  safeText(value, fallback=''){
    const txt = String(value ?? '').trim();
    return txt || fallback;
  },
  safeImage(src){
    const s = String(src || '').trim();
    return s || 'assets/img/Freskis.jpeg';
  },
  normalizePresentation(item){
    return item?.Presentacion || item?.['Presentacion '] || item?.presentacion || '';
  },
  normalizeStep(value){
    return String(value || '').replace(/\s/g, '').toLowerCase();
  },
  normalizeWhatsappLabels(labels){
    const defaults = ['Solicita en Sucursal', 'Solicita a Domicilio'];
    if (!Array.isArray(labels)) return defaults;
    const cleaned = labels.map(x => String(x ?? '').trim()).filter(Boolean);
    return [cleaned[0] || defaults[0], cleaned[1] || defaults[1]];
  },
  money(v){
    return new Intl.NumberFormat('es-MX', {
      style:'currency', currency:'MXN', maximumFractionDigits:0
    }).format(Number(v || 0));
  },

  saveCart(){
    localStorage.setItem('freskis-cart', JSON.stringify(this.state.cart));
    localStorage.setItem('freskis-mode', this.state.mode);
  },

  // ===================== boot =====================
  async boot(page){
    try{
      await this.loadBaseData();
      this.applyLocalPreviewOverrides();
      this.applyTheme();
      this.renderShell();

      if(page === 'index') this.bootIndex();
      if(page === 'promos') this.bootPromos();
      if(page === 'games') this.bootGames();
      if(page === 'admin') this.bootAdmin();

      this.bindMusic();
    }catch(err){
      console.error(err);
      this.showFatalError(err);
    }
  },

  async fetchJson(path){
    const response = await fetch(path, { cache: 'no-store' });
    if(!response.ok){
      throw new Error(`No se pudo cargar ${path} (${response.status})`);
    }
    return response.json();
  },

  async loadBaseData(){
    const [config, menu, freskiOptions, promos, games] = await Promise.all([
      this.fetchJson('data/site-config.json'),
      this.fetchJson('data/lgp-menu.json'),
      this.fetchJson('data/freskis-menu.json'),
      this.fetchJson('data/promos.json'),
      this.fetchJson('data/games.json')
    ]);

    this.state.config = config || {};
    this.state.config.whatsappLabel = this.normalizeWhatsappLabels(this.state.config.whatsappLabel);
    this.state.menu = Array.isArray(menu)
      ? menu.filter(x => String(x.visible_web || '').toLowerCase() !== 'no')
      : [];
    this.state.freskiOptions = Array.isArray(freskiOptions) ? freskiOptions.filter(Boolean) : [];
    this.state.promos = Array.isArray(promos) ? promos : [];
    this.state.games = Array.isArray(games) ? games : [];
  },

  applyLocalPreviewOverrides(){
    const preview = localStorage.getItem('admin-preview-config');
    if(!preview || !this.state.config) return;
    try{
      const parsed = JSON.parse(preview);
      this.state.config = { ...this.state.config, ...parsed };
      this.state.config.whatsappLabel = this.normalizeWhatsappLabels(this.state.config.whatsappLabel);
    }catch(err){
      console.warn('No se pudo aplicar vista previa local.', err);
    }
  },

  applyTheme(){
    const t = this.state.config?.theme || {};
    for(const [k, v] of Object.entries(t)){
      document.documentElement.style.setProperty(`--${k}`, v);
    }
  },

  renderShell(){
    const cfg = this.state.config || {};
    document.querySelectorAll('[data-business-name]').forEach(el => el.textContent = cfg.businessName || 'Freskis + La Gran Pantalla');
    document.querySelectorAll('[data-slogan]').forEach(el => el.textContent = cfg.slogan || 'Antojo, frescura y diversión en cada pedido.');
    document.querySelectorAll('[data-hours]').forEach(el => el.textContent = cfg.hours || 'Horario no disponible');
    document.querySelectorAll('[data-location]').forEach(el => el.textContent = cfg.location || 'Ubicación no disponible');

    const notice = this.el('noticeChip');
    if(notice && cfg.noticeActive){
      notice.style.display = 'flex';
      const title = notice.querySelector('[data-notice-title]');
      const text = notice.querySelector('[data-notice-text]');
      if(title) title.textContent = cfg.noticeTitle || 'Aviso importante';
      if(text) text.textContent = cfg.noticeText || '';
      const btn = notice.querySelector('button');
      if(btn){
        btn.onclick = () => {
          if(cfg.noticeFile) window.open(cfg.noticeFile, '_blank');
        };
      }
    }
  },

  showFatalError(err){
    const message = err?.message || 'Ocurrió un error al iniciar la aplicación.';
    this.state.lastError = message;
    const target = document.querySelector('main') || document.body;
    if(target){
      target.innerHTML = `
        <section class="container" style="padding:24px 0 40px;">
          <div class="card admin-block">
            <h2 style="margin-top:0">No se pudo cargar la página</h2>
            <p class="muted">Revisa que GitHub Pages esté publicando la raíz del repositorio y que los archivos JSON existan en <strong>data/</strong>.</p>
            <pre class="codebox">${this.escapeHtml(message)}</pre>
          </div>
        </section>`;
    }
  },

  // ===================== filtros =====================
  get filteredMenu(){
    const f = this.state.filters;
    return this.state.menu
      .filter(item => {
        const q = `${item.nombre || ''} ${item.variante || ''} ${item.subcategoria || ''} ${item.descripcion || ''}`.toLowerCase();
        return (!f.categoria || item.categoria === f.categoria)
          && (!f.subcategoria || item.subcategoria === f.subcategoria)
          && (!f.presentacion || this.normalizePresentation(item) === f.presentacion)
          && (!f.q || q.includes(f.q.toLowerCase()));
      })
      .sort((a, b) => Number(a.orden || 9999) - Number(b.orden || 9999));
  },

  categories(){
    return [...new Set(this.state.menu.map(x => x.categoria).filter(Boolean))];
  },

  subcategories(){
    const cat = this.state.filters.categoria;
    return [...new Set(
      this.state.menu
        .filter(x => !cat || x.categoria === cat)
        .map(x => x.subcategoria)
        .filter(Boolean)
    )];
  },

  presentations(){
    const cat = this.state.filters.categoria;
    const sub = this.state.filters.subcategoria;
    return [...new Set(
      this.state.menu
        .filter(x => (!cat || x.categoria === cat) && (!sub || x.subcategoria === sub))
        .map(x => this.normalizePresentation(x))
        .filter(Boolean)
    )];
  },

  renderFilters(){
    const catSel = this.el('filterCategoria');
    const subSel = this.el('filterSubcategoria');
    const preSel = this.el('filterPresentacion');
    if(!catSel || !subSel || !preSel) return;

    const fill = (sel, opts, placeholder) => {
      const current = sel.value;
      sel.innerHTML = `<option value="">${this.escapeHtml(placeholder)}</option>` +
        opts.map(v => `<option value="${this.escapeHtml(v)}" ${current === v ? 'selected' : ''}>${this.escapeHtml(v)}</option>`).join('');
    };

    fill(catSel, this.categories(), 'Todas las categorías');
    fill(subSel, this.subcategories(), 'Todas las subcategorías');
    fill(preSel, this.presentations(), 'Todas las presentaciones');

    catSel.onchange = () => {
      this.state.filters.categoria = catSel.value;
      this.state.filters.subcategoria = '';
      this.state.filters.presentacion = '';
      this.renderFilters();
      this.renderMenu();
    };

    subSel.onchange = () => {
      this.state.filters.subcategoria = subSel.value;
      this.state.filters.presentacion = '';
      this.renderFilters();
      this.renderMenu();
    };

    preSel.onchange = () => {
      this.state.filters.presentacion = preSel.value;
      this.renderMenu();
    };
  },

  // ===================== menú =====================
  bootIndex(){
    this.renderFilters();
    this.renderMenu();
    this.renderCart();
    this.ensureMobileCartBar();
    this.renderMobileCartBar();

    const searchInput = this.el('searchInput');
    if(searchInput){
      searchInput.addEventListener('input', e => {
        this.state.filters.q = e.target.value;
        this.renderMenu();
      });
    }

    const modeButtons = this.el('modeButtons');
    if(modeButtons){
      modeButtons.addEventListener('click', e => {
        const btn = e.target.closest('[data-mode]');
        if(!btn) return;
        this.state.mode = btn.dataset.mode;
        this.saveCart();
        this.renderCart();
      });
    }

    this.el('copyOrderBtn')?.addEventListener('click', () => this.copyOrder());
    this.el('clearCartBtn')?.addEventListener('click', () => this.clearCart());

    const startOrderBtn = this.el('startOrderBtn') || document.querySelector('a[href="#pedido"]');
    startOrderBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.goToPedidoWithOffset();
    });
  },

  renderMenu(){
    const wrap = this.el('menuList');
    if(!wrap) return;

    const rows = this.filteredMenu;
    if(!rows.length){
      wrap.innerHTML = `<div class="empty">No hay productos con esos filtros.</div>`;
      return;
    }

    wrap.innerHTML = rows.map(item => {
      const present = this.normalizePresentation(item);
      const isFreski = String(item.categoria || '').toLowerCase() === 'freskis';
      const image = this.safeImage(item.imagen_url);
      return `
        <article class="card menu-item">
          <div class="thumb">
            <img src="${this.escapeHtml(image)}" alt="${this.escapeHtml(item.nombre || 'Producto')}" onerror="this.src='assets/img/Freskis.jpeg'">
          </div>
          <div>
            <h4>${this.escapeHtml(item.nombre || 'Producto')}</h4>
            <div class="meta">
              ${item.categoria ? `<span class="tag">${this.escapeHtml(item.categoria)}</span>` : ''}
              ${item.subcategoria ? `<span class="tag">${this.escapeHtml(item.subcategoria)}</span>` : ''}
              ${item.variante ? `<span class="tag">${this.escapeHtml(item.variante)}</span>` : ''}
              ${present ? `<span class="tag">${this.escapeHtml(present)}</span>` : ''}
            </div>
            <div class="muted">${this.escapeHtml(item.descripcion || '')}</div>
          </div>
          <div class="center menu-item-side">
            <div class="price">${this.money(item.precio)}</div>
            <button class="btn small" data-add="${this.escapeHtml(item.id)}">${isFreski ? 'Armar Freski' : 'Agregar'}</button>
          </div>
        </article>`;
    }).join('');

    wrap.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = this.state.menu.find(x => String(x.id) === String(btn.dataset.add));
        if(!item) return;
        if(String(item.categoria || '').toLowerCase() === 'freskis'){
          this.openFreskiBuilder(item);
        }else{
          this.addToCart({
            uid: this.uid(),
            id: item.id,
            nombre: item.nombre,
            variante: item.variante,
            presentacion: this.normalizePresentation(item),
            precio: Number(item.precio || 0),
            observaciones: ''
          });
        }
      });
    });
  },

  // ===================== carrito =====================
  addToCart(item){
    const existing = this.state.cart.find(x => x.uid === item.uid);
    if(existing) existing.qty += item.qty || 1;
    else this.state.cart.push({ ...item, qty: item.qty || 1 });
    this.saveCart();
    this.renderCart();
    const name = this.safeText(item?.nombre, 'Producto');
    this.showToast(`${name} agregado`);
  },

  updateQty(uid, delta){
    const item = this.state.cart.find(x => x.uid === uid);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0){
      this.state.cart = this.state.cart.filter(x => x.uid !== uid);
      if(this.state.editingCommentUid === uid) this.cancelEditComment(false);
    }
    this.saveCart();
    this.renderCart();
  },

  removeItem(uid){
    this.state.cart = this.state.cart.filter(x => x.uid !== uid);
    if(this.state.editingCommentUid === uid) this.cancelEditComment(false);
    this.saveCart();
    this.renderCart();
  },

  cartTotal(){
    return this.state.cart.reduce((s, x) => s + Number(x.precio || 0) * Number(x.qty || 1), 0);
  },

  startEditComment(uid){
    const item = this.state.cart.find(x => x.uid === uid);
    if(!item) return;
    this.state.editingCommentUid = uid;
    this.state.commentDraft = item.observaciones || '';
    this.renderCart();
    setTimeout(() => {
      const input = document.querySelector(`[data-comment-input="${CSS.escape(uid)}"]`);
      if(input) input.focus();
    }, 0);
  },

  cancelEditComment(shouldRender = true){
    this.state.editingCommentUid = null;
    this.state.commentDraft = '';
    if(shouldRender) this.renderCart();
  },

  updateCommentDraft(value){
    this.state.commentDraft = value;
  },

  saveItemComment(uid){
    const item = this.state.cart.find(x => x.uid === uid);
    if(!item) return;
    item.observaciones = (this.state.commentDraft || '').trim();
    this.state.editingCommentUid = null;
    this.state.commentDraft = '';
    this.saveCart();
    this.renderCart();
  },

  clearItemComment(uid){
    const item = this.state.cart.find(x => x.uid === uid);
    if(!item) return;
    item.observaciones = '';
    this.state.editingCommentUid = null;
    this.state.commentDraft = '';
    this.saveCart();
    this.renderCart();
  },

  renderCart(){
    const wrap = this.el('cartList');
    const total = this.el('cartTotal');
    const count = this.el('cartCount');
    if(!wrap) return;

    const totalQty = this.state.cart.reduce((acc, it) => acc + Number(it.qty || 0), 0);
    if(count) count.textContent = `${totalQty} producto(s)`;

    if(!this.state.cart.length){
      wrap.innerHTML = `<div class="empty">Tu pedido está vacío.</div>`;
    }else{
      wrap.innerHTML = this.state.cart.map(it => {
        const isEditing = this.state.editingCommentUid === it.uid;
        const comentario = it.observaciones ? this.escapeHtml(it.observaciones) : 'Sin comentario';
        const baseInfo = [it.variante, it.presentacion].filter(Boolean).join(' · ');
        return `
          <div class="cart-item">
            <div class="cart-top">
              <div>
                <strong>${this.escapeHtml(it.nombre || 'Producto')}</strong>
                ${baseInfo ? `<div class="muted">${this.escapeHtml(baseInfo)}</div>` : ''}
              </div>
              <strong>${this.money(Number(it.precio) * Number(it.qty))}</strong>
            </div>

            ${it.componentes?.length ? `
              <div class="cart-meta">
                <small><strong>Armado:</strong> ${this.escapeHtml(it.componentes.join(', '))}</small>
              </div>` : ''}

            <div class="cart-meta">
              <small><strong>Comentario:</strong> ${comentario}</small>
            </div>

            ${isEditing ? `
              <div class="comment-editor">
                <textarea class="comment-textarea" data-comment-input="${this.escapeHtml(it.uid)}" placeholder="Escribe aquí un comentario adicional para este producto...">${this.escapeHtml(this.state.commentDraft || '')}</textarea>
                <div class="comment-actions">
                  <button data-savecomment="${this.escapeHtml(it.uid)}" class="btn small">Guardar</button>
                  <button data-cancelcomment="${this.escapeHtml(it.uid)}" class="btn small secondary">Cancelar</button>
                  <button data-clearcomment="${this.escapeHtml(it.uid)}" class="btn small danger-soft">Quitar comentario</button>
                </div>
              </div>` : ''}

            <div class="cart-actions">
              <button class="icon-btn" data-dec="${this.escapeHtml(it.uid)}" title="Restar">−</button>
              <span class="qty-pill">${this.escapeHtml(it.qty)}</span>
              <button class="icon-btn" data-inc="${this.escapeHtml(it.uid)}" title="Sumar">+</button>
              ${!isEditing ? `
                <button data-editcomment="${this.escapeHtml(it.uid)}" class="btn small secondary">
                  ${it.observaciones ? 'Editar comentario' : 'Agregar comentario'}
                </button>` : ''}
              <button class="icon-btn danger" data-del="${this.escapeHtml(it.uid)}" title="Eliminar">×</button>
            </div>
          </div>`;
      }).join('');

      wrap.querySelectorAll('[data-dec]').forEach(b => {
        b.onclick = () => this.updateQty(b.dataset.dec, -1);
      });
      wrap.querySelectorAll('[data-inc]').forEach(b => {
        b.onclick = () => this.updateQty(b.dataset.inc, +1);
      });
      wrap.querySelectorAll('[data-del]').forEach(b => {
        b.onclick = () => this.removeItem(b.dataset.del);
      });
      wrap.querySelectorAll('[data-editcomment]').forEach(b => {
        b.onclick = () => this.startEditComment(b.dataset.editcomment);
      });
      wrap.querySelectorAll('[data-cancelcomment]').forEach(b => {
        b.onclick = () => this.cancelEditComment();
      });
      wrap.querySelectorAll('[data-savecomment]').forEach(b => {
        b.onclick = () => this.saveItemComment(b.dataset.savecomment);
      });
      wrap.querySelectorAll('[data-clearcomment]').forEach(b => {
        b.onclick = () => this.clearItemComment(b.dataset.clearcomment);
      });
      wrap.querySelectorAll('[data-comment-input]').forEach(t => {
        t.oninput = () => this.updateCommentDraft(t.value);
        t.onkeydown = (e) => {
          if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
            const uid = t.dataset.commentInput;
            this.saveItemComment(uid);
          }
        };
      });
    }

    if(total) total.textContent = this.money(this.cartTotal());
    this.renderMobileCartBar();

    document.querySelectorAll('[data-mode]').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === this.state.mode);
    });

    const delivery = this.el('deliveryFields');
    if(delivery) delivery.classList.toggle('hidden', this.state.mode !== 'Envío a domicilio');

    const waWrap = this.el('waButtons');
    if(waWrap){
      const phones = Array.isArray(this.state.config?.phones) ? this.state.config.phones.filter(Boolean) : [];
      waWrap.innerHTML = phones.map((phone, i) =>
        `<button class="btn gold small" data-wa="${this.escapeHtml(phone)}">${this.escapeHtml(this.state.config?.whatsappLabel?.[i] || `WhatsApp ${i+1}`)}</button>`
      ).join('');
      waWrap.querySelectorAll('[data-wa]').forEach(b => {
        b.onclick = () => this.openWhatsApp(b.dataset.wa);
      });
    }
  },


  ensureMobileCartBar(){
    if(this.el('mobileCartBar')) return;
    const bar = document.createElement('div');
    bar.id = 'mobileCartBar';
    bar.className = 'mobile-cart-bar hidden';
    bar.innerHTML = `
      <div class="mobile-cart-summary">
        <div class="mobile-cart-kicker">Tu comanda</div>
        <strong id="mobileCartCount">0 producto(s)</strong>
        <div id="mobileCartTotal" class="mobile-cart-total">$0</div>
      </div>
      <div class="mobile-cart-buttons">
        <button type="button" class="btn small secondary" id="mobileCartViewBtn">Ver comanda</button>
        <button type="button" class="btn small gold" id="mobileCartContinueBtn">Continuar pedido</button>
      </div>`;
    document.body.appendChild(bar);
    this.el('mobileCartViewBtn')?.addEventListener('click', () => {
      this.goToCartWithOffset();
    });
    this.el('mobileCartContinueBtn')?.addEventListener('click', () => {
      this.goToPedidoWithOffset();
    });
  },

  goToCartWithOffset(){
    const cart = document.querySelector('.cart');
    if(!cart) return;

    const header = document.querySelector('header, .site-header, .topbar, .header');
    const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 76;
    const extraGap = 16;
    const targetY = cart.getBoundingClientRect().top + window.pageYOffset - headerH - extraGap;

    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth'
    });
  },

  goToPedidoWithOffset(){
    const section = this.el('pedido');
    if(!section) return;

    const header = document.querySelector('header, .site-header, .topbar, .header');
    const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 76;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const extraGap = isMobile ? 18 : 12;
    const targetY = section.getBoundingClientRect().top + window.pageYOffset - headerH - extraGap;

    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth'
    });
  },

  renderMobileCartBar(){
    const bar = this.el('mobileCartBar');
    if(!bar) return;
    const totalQty = this.state.cart.reduce((acc, it) => acc + Number(it.qty || 0), 0);
    const totalAmount = this.money(this.cartTotal());
    const countEl = this.el('mobileCartCount');
    const totalEl = this.el('mobileCartTotal');
    if(countEl) countEl.textContent = `${totalQty} producto(s)`;
    if(totalEl) totalEl.textContent = totalAmount;
    bar.classList.toggle('hidden', totalQty <= 0);
    document.body.classList.toggle('mobile-cart-visible', totalQty > 0);
  },

  showToast(message){
    let toast = this.el('appToast');
    if(!toast){
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message || 'Producto agregado';
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 1900);
  },

  // ===================== pedido / whatsapp =====================
  orderFolio(){
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
  },

  composeWhatsAppText(){
    const folio = this.orderFolio();
    const cfg = this.state.config || {};
    let txt = `*${cfg.businessName || 'Freskis + La Gran Pantalla'}*\n`;
    txt += `Folio: ${folio}\n`;
    txt += `Modo de consumo: ${this.state.mode}\n\n`;
    txt += `*Pedido*\n`;

    this.state.cart.forEach((it, idx) => {
      txt += `${idx+1}. ${it.nombre}`;
      if(it.variante) txt += ` · ${it.variante}`;
      if(it.presentacion) txt += ` · ${it.presentacion}`;
      txt += ` x${it.qty}\n`;
      if(it.componentes?.length) txt += `   Armado: ${it.componentes.join(', ')}\n`;
      if(it.observaciones) txt += `   Obs: ${it.observaciones}\n`;
      txt += `   Importe: ${this.money(Number(it.precio) * Number(it.qty))}\n`;
    });

    txt += `\n*Total:* ${this.money(this.cartTotal())}\n`;

    if(this.state.mode === 'Envío a domicilio'){
      const nombre = (this.el('deliveryName')?.value || '').trim();
      const direccion = (this.el('deliveryAddress')?.value || '').trim();
      const ubicacion = (this.el('deliveryLocation')?.value || '').trim();
      txt += `\n*Entrega*\nNombre: ${nombre}\nDirección: ${direccion}\nUbicación: ${ubicacion}\n`;
    }
    return txt;
  },

  openWhatsApp(number){
    if(!this.state.cart.length){
      alert('Agrega al menos un producto al pedido.');
      return;
    }
    const txt = encodeURIComponent(this.composeWhatsAppText());
    window.open(`https://wa.me/${number}?text=${txt}`, '_blank');
  },

  async copyOrder(){
    try{
      await navigator.clipboard.writeText(this.composeWhatsAppText());
      alert('Comanda copiada.');
    }catch(err){
      alert('No se pudo copiar automáticamente.');
    }
  },

  clearCart(){
    this.state.cart = [];
    this.state.editingCommentUid = null;
    this.state.commentDraft = '';
    this.saveCart();
    ['deliveryName','deliveryAddress','deliveryLocation'].forEach(id => {
      const el = this.el(id);
      if(el) el.value = '';
    });
    this.renderCart();
  },

  // ===================== música =====================
  bindMusic(){
    const audio = this.el('bgMusic');
    const toggle = this.el('musicToggle');
    if(!audio || !toggle) return;

    audio.src = this.state.config?.musicFile || '';
    audio.loop = true;

    if(!this.state.config?.musicEnabled){
      toggle.classList.add('hidden');
      return;
    }

    let playing = false;
    toggle.addEventListener('click', async () => {
      try{
        if(!playing){
          await audio.play();
          playing = true;
          toggle.textContent = 'Pausar música';
        }else{
          audio.pause();
          playing = false;
          toggle.textContent = 'Activar música';
        }
      }catch(err){
        alert('Tu navegador requiere interacción del usuario para reproducir audio.');
      }
    });
  },

  // ===================== freski =====================
  openFreskiBuilder(baseItem){
    const modal = this.el('freskiModal');
    const body = this.el('freskiBody');
    if(!modal || !body) return;

    modal.classList.add('show');
    const byStep = step => this.state.freskiOptions.filter(x => this.normalizeStep(x['Pasos'] || x['Pasos ']) === step.toLowerCase());
    const sections = [
      { title:'Paso 1 · Fruta', key:'paso1' },
      { title:'Paso 2 · Topping', key:'paso2' },
      { title:'Paso 3 · Crema', key:'paso3' },
      { title:'Paso 4 · Top', key:'paso4' }
    ];
    const local = { picks:{} };

    body.innerHTML = sections.map(sec => {
      const opts = byStep(sec.key);
      return `
        <div class="card promo-card">
          <h4>${this.escapeHtml(sec.title)}</h4>
          <div class="choice-list">
            ${opts.map(o => `
              <button class="choice" data-step="${this.escapeHtml(sec.key)}" data-type="${this.escapeHtml(o.Tipo || '')}">
                <span>${this.escapeHtml(o.Tipo || '')}</span>
                <span class="muted">${this.escapeHtml(o.descripcion || '')}</span>
              </button>`).join('')}
          </div>
        </div>`;
    }).join('');

    body.querySelectorAll('.choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const { step, type } = btn.dataset;
        local.picks[step] = type;
        body.querySelectorAll(`[data-step="${step}"]`).forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const title = this.el('freskiTitle');
    const obs = this.el('freskiObs');
    const close = this.el('closeFreski');
    const save = this.el('saveFreski');

    if(title) title.textContent = `${baseItem.nombre} · ${baseItem.variante || ''}`;
    if(obs) obs.value = '';
    if(close) close.onclick = () => modal.classList.remove('show');
    if(save){
      save.onclick = () => {
        const picks = sections.map(x => local.picks[x.key]).filter(Boolean);
        if(picks.length < 4){
          alert('Completa los 4 pasos para armar tu Freski.');
          return;
        }
        this.addToCart({
          uid: this.uid(),
          id: baseItem.id,
          nombre: baseItem.nombre,
          variante: baseItem.variante,
          presentacion: this.normalizePresentation(baseItem),
          precio: Number(baseItem.precio || 0),
          observaciones: (obs?.value || '').trim(),
          componentes: picks
        });
        modal.classList.remove('show');
      };
    }
  },

  // ===================== promociones =====================
  bootPromos(){
    const wrap = this.el('promoList');
    if(!wrap) return;
    const items = this.state.promos.filter(x => x.active !== false);
    wrap.innerHTML = items.map(p => `
      <article class="card promo-card">
        <h3>${this.escapeHtml(p.title || 'Promoción')}</h3>
        ${p.type === 'pdf'
          ? `<iframe title="${this.escapeHtml(p.title || 'Promoción')}" src="${this.escapeHtml(p.file || '')}"></iframe>`
          : `<img src="${this.escapeHtml(p.file || '')}" alt="${this.escapeHtml(p.title || 'Promoción')}" style="border-radius:18px" onerror="this.style.display='none'">`
        }
      </article>`).join('') || `<div class="empty">No hay promociones activas por el momento.</div>`;
  },

  // ===================== videojuegos =====================
  bootGames(){
    const wrap = this.el('gamesList');
    if(!wrap) return;
    wrap.innerHTML = this.state.games.map((g, i) => `
      <article class="card game-card">
        <h3>${this.escapeHtml(g.title || 'Juego')}</h3>
        <p class="muted">${this.escapeHtml(g.description || '')}</p>
        <button class="btn" data-launch="${i}">Jugar ahora</button>
        <div id="gameFrame${i}" class="hidden" style="margin-top:12px">
          <iframe src="${this.escapeHtml(g.file || '')}" style="width:100%;height:560px;border:none;border-radius:18px;background:#000"></iframe>
        </div>
      </article>`).join('');

    wrap.querySelectorAll('[data-launch]').forEach(btn => {
      btn.onclick = () => {
        const frame = this.el(`gameFrame${btn.dataset.launch}`);
        if(!frame) return;
        frame.classList.toggle('hidden');
        btn.textContent = frame.classList.contains('hidden') ? 'Jugar ahora' : 'Ocultar juego';
      };
    });
  },


  // ===================== admin =====================
  bootAdmin(){
    const gate = this.el('adminGate');
    const panel = this.el('adminPanel');
    const passInput = this.el('adminPassword');
    const loginBtn = this.el('adminLoginBtn');
    const PASSWORD = '1A972df8$';

    sessionStorage.removeItem('freskis-admin');
    if(loginBtn){
      loginBtn.onclick = () => {
        if((passInput?.value || '') === PASSWORD){
          sessionStorage.setItem('freskis-admin', 'ok');
          gate?.classList.add('hidden');
          panel?.classList.remove('hidden');
          this.renderAdminPanel();
        }else{
          alert('Contraseña incorrecta.');
        }
      };
    }

    window.addEventListener('beforeunload', () => sessionStorage.removeItem('freskis-admin'));
  },

  renderAdminPanel(){
    const cfg = structuredClone(this.state.config || {});
    this.el('cfgBusinessName').value = cfg.businessName || '';
    this.el('cfgSlogan').value = cfg.slogan || '';
    this.el('cfgHours').value = cfg.hours || '';
    this.el('cfgLocation').value = cfg.location || '';
    this.el('cfgPhone1').value = cfg.phones?.[0] || '';
    this.el('cfgPhone2').value = cfg.phones?.[1] || '';
    this.el('cfgNoticeActive').checked = !!cfg.noticeActive;
    this.el('cfgNoticeTitle').value = cfg.noticeTitle || '';
    this.el('cfgNoticeText').value = cfg.noticeText || '';
    this.el('cfgMusicEnabled').checked = !!cfg.musicEnabled;

    this.bindAdminStorage();
    this.restoreGitHubForm();
    this.renderSyncQueueStatus();

    this.el('adminSaveLocalBtn').onclick = () => {
      const nextCfg = this.collectAdminConfig();
      this.el('jsonPreview').textContent = JSON.stringify(nextCfg, null, 2);
      localStorage.setItem('admin-preview-config', JSON.stringify(nextCfg));
      this.state.config = nextCfg;
      this.renderSyncQueueStatus();
      alert('Vista previa local actualizada. Para publicarla para todos, usa GitHub Sync.');
    };

    this.el('adminClearPreviewBtn')?.addEventListener('click', () => {
      localStorage.removeItem('admin-preview-config');
      alert('Vista previa local eliminada. Recarga la página para volver a la configuración publicada.');
    });

    this.el('menuExcelInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if(!file) return;
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval:'' });
      this.el('menuJsonPreview').textContent = JSON.stringify(json.slice(0, 10), null, 2) + `\n\nTotal registros: ${json.length}`;
      window.__pendingMenuJson = json;
      window.__pendingMenuFile = file;
      this.setAdminStatus('menuStatus', `Catálogo listo: ${file.name} (${json.length} registros)`);
      this.renderSyncQueueStatus();
    });

    this.el('freskiExcelInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if(!file) return;
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval:'' });
      this.el('freskiJsonPreview').textContent = JSON.stringify(json.slice(0, 10), null, 2) + `\n\nTotal registros: ${json.length}`;
      window.__pendingFreskiJson = json;
      window.__pendingFreskiFile = file;
      this.setAdminStatus('freskiStatus', `Catálogo listo: ${file.name} (${json.length} registros)`);
      this.renderSyncQueueStatus();
    });

    this.el('promoFileInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if(!file) return;
      window.__pendingPromoFile = file;
      this.setAdminStatus('promoStatus', `Flyer listo: ${file.name}`);
      this.renderSyncQueueStatus();
    });

    this.el('noticeFileInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if(!file) return;
      window.__pendingNoticeFile = file;
      this.setAdminStatus('noticeStatus', `Aviso listo: ${file.name}`);
      this.renderSyncQueueStatus();
    });

    this.el('musicFileInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if(!file) return;
      window.__pendingMusicFile = file;
      this.setAdminStatus('musicStatus', `Audio listo: ${file.name}`);
      this.renderSyncQueueStatus();
    });

    this.el('gameFileInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if(!file) return;
      window.__pendingGameFile = file;
      this.setAdminStatus('gameStatus', `Juego listo: ${file.name}`);
      this.renderSyncQueueStatus();
    });

    this.el('gameTitleInput')?.addEventListener('input', () => this.renderSyncQueueStatus());
    this.el('gameDescInput')?.addEventListener('input', () => this.renderSyncQueueStatus());

    this.el('ghOwner').value ||= 'freskismx';
    this.el('ghRepo').value ||= 'freskis';
    this.el('ghBranch').value ||= 'main';

    this.el('ghRemember').checked = localStorage.getItem('gh-remember') === '1';
    this.el('ghSaveSettingsBtn')?.addEventListener('click', () => this.saveGitHubForm());
    this.el('ghTestBtn')?.addEventListener('click', () => this.testGitHubConnection());

    this.el('syncConfigBtn')?.addEventListener('click', () => this.pushConfigToGitHub());
    this.el('syncMenuBtn')?.addEventListener('click', () => this.pushMenuToGitHub());
    this.el('syncFreskiBtn')?.addEventListener('click', () => this.pushFreskiToGitHub());
    this.el('syncPromoBtn')?.addEventListener('click', () => this.pushPromoToGitHub());
    this.el('syncNoticeBtn')?.addEventListener('click', () => this.pushNoticeToGitHub());
    this.el('syncMusicBtn')?.addEventListener('click', () => this.pushMusicToGitHub());
    this.el('syncGameBtn')?.addEventListener('click', () => this.pushGameToGitHub());
    this.el('syncAllBtn')?.addEventListener('click', () => this.pushAllToGitHub());

    this.el('jsonPreview').textContent = JSON.stringify(cfg, null, 2);
  },

  bindAdminStorage(){
    ['ghOwner','ghRepo','ghBranch','ghToken'].forEach(id => {
      this.el(id)?.addEventListener('input', () => this.saveGitHubForm(false));
    });
    this.el('ghRemember')?.addEventListener('change', () => this.saveGitHubForm());
  },

  restoreGitHubForm(){
    this.el('ghOwner').value = localStorage.getItem('gh-owner') || this.el('ghOwner').value || '';
    this.el('ghRepo').value = localStorage.getItem('gh-repo') || this.el('ghRepo').value || '';
    this.el('ghBranch').value = localStorage.getItem('gh-branch') || this.el('ghBranch').value || 'main';
    const remember = localStorage.getItem('gh-remember') === '1';
    if(remember){
      this.el('ghToken').value = localStorage.getItem('gh-token') || '';
    }
  },

  saveGitHubForm(showAlert = true){
    localStorage.setItem('gh-owner', this.el('ghOwner').value.trim());
    localStorage.setItem('gh-repo', this.el('ghRepo').value.trim());
    localStorage.setItem('gh-branch', this.el('ghBranch').value.trim() || 'main');
    const remember = this.el('ghRemember').checked;
    localStorage.setItem('gh-remember', remember ? '1' : '0');
    if(remember){
      localStorage.setItem('gh-token', this.el('ghToken').value.trim());
    }else{
      localStorage.removeItem('gh-token');
    }
    if(showAlert) alert('Datos de GitHub guardados en este navegador.');
  },

  collectGitHubSettings(){
    const owner = this.el('ghOwner').value.trim();
    const repo = this.el('ghRepo').value.trim();
    const branch = this.el('ghBranch').value.trim() || 'main';
    const token = this.el('ghToken').value.trim();
    if(!owner || !repo || !token){
      throw new Error('Completa owner, repo y token.');
    }
    return { owner, repo, branch, token };
  },

  collectAdminConfig(){
    const cfg = structuredClone(this.state.config || {});
    cfg.businessName = this.el('cfgBusinessName').value.trim();
    cfg.slogan = this.el('cfgSlogan').value.trim();
    cfg.hours = this.el('cfgHours').value.trim();
    cfg.location = this.el('cfgLocation').value.trim();
    cfg.phones = [this.el('cfgPhone1').value.trim(), this.el('cfgPhone2').value.trim()].filter(Boolean);
    cfg.noticeActive = this.el('cfgNoticeActive').checked;
    cfg.noticeTitle = this.el('cfgNoticeTitle').value.trim();
    cfg.noticeText = this.el('cfgNoticeText').value.trim();
    cfg.musicEnabled = this.el('cfgMusicEnabled').checked;

    if(window.__pendingNoticeFile){
      const noticeName = this.slugFileName(window.__pendingNoticeFile.name);
      cfg.noticeFile = this.noticeTargetPath(noticeName);
    }
    if(window.__pendingMusicFile){
      const musicName = this.slugFileName(window.__pendingMusicFile.name);
      cfg.musicFile = this.musicTargetPath(musicName);
    }
    return cfg;
  },

  setAdminStatus(id, text, isError = false){
    const el = this.el(id);
    if(!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#b42318' : '';
  },

  renderSyncQueueStatus(){
    const lines = [];
    if(localStorage.getItem('admin-preview-config')) lines.push('• Configuración general lista para publicar');
    if(window.__pendingMenuJson) lines.push('• Menú principal listo');
    if(window.__pendingFreskiJson) lines.push('• Menú Freskis listo');
    if(window.__pendingPromoFile) lines.push('• Flyer/promoción listo');
    if(window.__pendingNoticeFile) lines.push('• Aviso importante listo');
    if(window.__pendingMusicFile) lines.push('• Música lista');
    if(window.__pendingGameFile) lines.push('• Juego listo');
    const title = (this.el('gameTitleInput')?.value || '').trim();
    if(title && !window.__pendingGameFile) lines.push('• Título de juego capturado (falta archivo HTML)');
    const box = this.el('syncQueueStatus');
    if(box) box.textContent = lines.length ? lines.join('\n') : 'No hay cambios pendientes todavía.';
  },

  slugFileName(name){
    return String(name || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-');
  },

  promoTargetPath(fileName){
    const lower = fileName.toLowerCase();
    if(lower.endsWith('.pdf')) return `assets/docs/${fileName}`;
    return `assets/img/${fileName}`;
  },

  noticeTargetPath(fileName){
    const lower = fileName.toLowerCase();
    if(lower.endsWith('.pdf')) return `assets/docs/${fileName}`;
    return `assets/img/${fileName}`;
  },

  musicTargetPath(fileName){
    return `assets/audio/${fileName}`;
  },

  gameTargetPath(fileName){
    return `games/${fileName}`;
  },

  async fileToBase64(file){
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for(let i = 0; i < bytes.length; i += chunk){
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  },

  textToBase64(content){
    return btoa(unescape(encodeURIComponent(content)));
  },

  async getGitHubSha(owner, repo, branch, path, token){
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
      headers: { Authorization: `Bearer ${token}`, Accept:'application/vnd.github+json' }
    });
    if(response.ok){
      const json = await response.json();
      return json.sha;
    }
    if(response.status === 404) return undefined;
    const err = await response.text();
    throw new Error(`No se pudo consultar ${path}: ${err}`);
  },

  async putGitHubFile(owner, repo, branch, path, content, token, message){
    const sha = await this.getGitHubSha(owner, repo, branch, path, token);
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:'application/vnd.github+json',
        'Content-Type':'application/json'
      },
      body: JSON.stringify({
        message: message || `Actualiza ${path} desde panel admin Freskis`,
        content,
        branch,
        ...(sha ? { sha } : {})
      })
    });
    if(!res.ok){
      const errText = await res.text();
      throw new Error(`Error en ${path}: ${errText}`);
    }
    return res.json();
  },

  async writeGitHubText(path, content, message){
    const { owner, repo, branch, token } = this.collectGitHubSettings();
    return this.putGitHubFile(owner, repo, branch, path, this.textToBase64(content), token, message);
  },

  async writeGitHubBinary(path, file, message){
    const { owner, repo, branch, token } = this.collectGitHubSettings();
    return this.putGitHubFile(owner, repo, branch, path, await this.fileToBase64(file), token, message);
  },

  setGitHubStatus(text, isError = false){
    const el = this.el('githubStatus');
    if(!el) return;
    el.textContent = text;
    el.style.color = isError ? '#b42318' : '';
  },

  async testGitHubConnection(){
    try{
      const { owner, repo, branch, token } = this.collectGitHubSettings();
      this.setGitHubStatus('Probando conexión con GitHub...');
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json' }
      });
      if(!res.ok){
        throw new Error(await res.text());
      }
      const repoInfo = await res.json();
      this.setGitHubStatus(`Conexión OK. Repo: ${repoInfo.full_name}. Branch objetivo: ${branch}.`);
    }catch(err){
      console.error(err);
      this.setGitHubStatus(`No se pudo validar GitHub: ${err.message}`, true);
    }
  },

  async pushConfigToGitHub(){
    try{
      const nextCfg = this.collectAdminConfig();
      this.setGitHubStatus('Publicando configuración general...');
      await this.writeGitHubText('data/site-config.json', JSON.stringify(nextCfg, null, 2), 'Actualizar configuración general');
      localStorage.setItem('admin-preview-config', JSON.stringify(nextCfg));
      this.state.config = nextCfg;
      this.setGitHubStatus('Configuración general publicada correctamente.');
    }catch(err){
      console.error(err);
      this.setGitHubStatus(`Error al publicar configuración: ${err.message}`, true);
    }
  },

  async pushMenuToGitHub(){
    try{
      if(!window.__pendingMenuJson || !window.__pendingMenuFile){
        throw new Error('Primero selecciona el archivo LGP-Menu.xlsx.');
      }
      this.setGitHubStatus('Publicando menú principal...');
      await this.writeGitHubText('data/lgp-menu.json', JSON.stringify(window.__pendingMenuJson, null, 2), 'Actualizar menú principal JSON');
      await this.writeGitHubBinary('data/LGP-Menu.xlsx', window.__pendingMenuFile, 'Actualizar archivo LGP-Menu.xlsx');
      this.setGitHubStatus('Menú principal publicado correctamente.');
    }catch(err){
      console.error(err);
      this.setGitHubStatus(`Error al publicar menú principal: ${err.message}`, true);
    }
  },

  async pushFreskiToGitHub(){
    try{
      if(!window.__pendingFreskiJson || !window.__pendingFreskiFile){
        throw new Error('Primero selecciona el archivo Freskis-Menu.xlsx.');
      }
      this.setGitHubStatus('Publicando menú Freskis...');
      await this.writeGitHubText('data/freskis-menu.json', JSON.stringify(window.__pendingFreskiJson, null, 2), 'Actualizar menú Freskis JSON');
      await this.writeGitHubBinary('data/Freskis-Menu.xlsx', window.__pendingFreskiFile, 'Actualizar archivo Freskis-Menu.xlsx');
      this.setGitHubStatus('Menú Freskis publicado correctamente.');
    }catch(err){
      console.error(err);
      this.setGitHubStatus(`Error al publicar menú Freskis: ${err.message}`, true);
    }
  },

  async pushPromoToGitHub(){
    try{
      if(!window.__pendingPromoFile){
        throw new Error('Primero selecciona un flyer de promoción.');
      }
      const safeName = this.slugFileName(window.__pendingPromoFile.name);
      const targetPath = this.promoTargetPath(safeName);
      const promoTitle = (this.el('promoTitleInput')?.value || '').trim() || 'Promoción actual';
      const promoType = safeName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
      const promosJson = [{
        title: promoTitle,
        type: promoType,
        file: targetPath,
        active: true
      }];
      this.setGitHubStatus('Publicando flyer/promoción...');
      await this.writeGitHubBinary(targetPath, window.__pendingPromoFile, `Actualizar flyer ${safeName}`);
      await this.writeGitHubText('data/promos.json', JSON.stringify(promosJson, null, 2), 'Actualizar promociones activas');
      this.setGitHubStatus('Flyer/promoción publicado correctamente.');
    }catch(err){
      console.error(err);
      this.setGitHubStatus(`Error al publicar flyer/promoción: ${err.message}`, true);
    }
  },

  async pushNoticeToGitHub(){
    try{
      if(!window.__pendingNoticeFile){
        throw new Error('Primero selecciona un archivo de aviso.');
      }
      const safeName = this.slugFileName(window.__pendingNoticeFile.name);
      const targetPath = this.noticeTargetPath(safeName);
      const cfg = this.collectAdminConfig();
      cfg.noticeFile = targetPath;
      this.setGitHubStatus('Publicando aviso importante...');
      await this.writeGitHubBinary(targetPath, window.__pendingNoticeFile, `Actualizar aviso ${safeName}`);
      await this.writeGitHubText('data/site-config.json', JSON.stringify(cfg, null, 2), 'Actualizar aviso en configuración');
      localStorage.setItem('admin-preview-config', JSON.stringify(cfg));
      this.state.config = cfg;
      this.setGitHubStatus('Aviso importante publicado correctamente.');
    }catch(err){
      console.error(err);
      this.setGitHubStatus(`Error al publicar aviso: ${err.message}`, true);
    }
  },

  async pushMusicToGitHub(){
    try{
      if(!window.__pendingMusicFile){
        throw new Error('Primero selecciona un archivo MP3.');
      }
      const safeName = this.slugFileName(window.__pendingMusicFile.name);
      const targetPath = this.musicTargetPath(safeName);
      const cfg = this.collectAdminConfig();
      cfg.musicFile = targetPath;
      this.setGitHubStatus('Publicando música...');
      await this.writeGitHubBinary(targetPath, window.__pendingMusicFile, `Actualizar audio ${safeName}`);
      await this.writeGitHubText('data/site-config.json', JSON.stringify(cfg, null, 2), 'Actualizar música en configuración');
      localStorage.setItem('admin-preview-config', JSON.stringify(cfg));
      this.state.config = cfg;
      this.setGitHubStatus('Música publicada correctamente.');
    }catch(err){
      console.error(err);
      this.setGitHubStatus(`Error al publicar música: ${err.message}`, true);
    }
  },

  async pushGameToGitHub(){
    try{
      if(!window.__pendingGameFile){
        throw new Error('Primero selecciona un archivo HTML de juego.');
      }
      const safeName = this.slugFileName(window.__pendingGameFile.name);
      const targetPath = this.gameTargetPath(safeName);
      const title = (this.el('gameTitleInput')?.value || '').trim() || safeName.replace(/\.html?$/i, '');
      const description = (this.el('gameDescInput')?.value || '').trim() || 'Juego interactivo disponible en la página.';
      const existingGames = Array.isArray(this.state.games) ? structuredClone(this.state.games) : [];
      const updatedGames = [{ title, description, file: targetPath }, ...existingGames.filter(g => g.file !== targetPath)];
      this.setGitHubStatus('Publicando juego HTML...');
      await this.writeGitHubBinary(targetPath, window.__pendingGameFile, `Actualizar juego ${safeName}`);
      await this.writeGitHubText('data/games.json', JSON.stringify(updatedGames, null, 2), 'Actualizar listado de juegos');
      this.state.games = updatedGames;
      this.setGitHubStatus('Juego publicado correctamente.');
    }catch(err){
      console.error(err);
      this.setGitHubStatus(`Error al publicar juego: ${err.message}`, true);
    }
  },

  async pushAllToGitHub(){
    try{
      this.setGitHubStatus('Sincronizando todos los cambios pendientes...');
      await this.pushConfigToGitHub();
      if(window.__pendingMenuJson) await this.pushMenuToGitHub();
      if(window.__pendingFreskiJson) await this.pushFreskiToGitHub();
      if(window.__pendingPromoFile) await this.pushPromoToGitHub();
      if(window.__pendingNoticeFile) await this.pushNoticeToGitHub();
      if(window.__pendingMusicFile) await this.pushMusicToGitHub();
      if(window.__pendingGameFile) await this.pushGameToGitHub();
      this.setGitHubStatus('Sincronización completa terminada. Recarga GitHub Pages en 30 a 60 segundos.');
    }catch(err){
      console.error(err);
      this.setGitHubStatus(`No se pudo completar la sincronización: ${err.message}`, true);
    }
  }
};
