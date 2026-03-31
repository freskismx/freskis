
const APP = {
  state: {
    config: null,
    menu: [],
    freskiOptions: [],
    promos: [],
    games: [],
    cart: JSON.parse(localStorage.getItem('freskis-cart') || '[]'),
    mode: localStorage.getItem('freskis-mode') || 'Para comer aquí',
    filters: { categoria:'', subcategoria:'', presentacion:'', q:'' }
  },

  async boot(page){
    await this.loadBaseData();
    this.applyTheme();
    this.renderShell();
    if(page === 'index') this.bootIndex();
    if(page === 'promos') this.bootPromos();
    if(page === 'games') this.bootGames();
    if(page === 'admin') this.bootAdmin();
    this.bindMusic();
  },

  async loadBaseData(){
    const [config, menu, freskiOptions, promos, games] = await Promise.all([
      fetch('data/site-config.json').then(r=>r.json()),
      fetch('data/lgp-menu.json').then(r=>r.json()),
      fetch('data/freskis-menu.json').then(r=>r.json()),
      fetch('data/promos.json').then(r=>r.json()),
      fetch('data/games.json').then(r=>r.json())
    ]);
    this.state.config = config;
    this.state.menu = menu.filter(x => String(x.visible_web || '').toLowerCase() !== 'no');
    this.state.freskiOptions = freskiOptions.filter(Boolean);
    this.state.promos = promos;
    this.state.games = games;
  },

  applyTheme(){
    const t = this.state.config.theme || {};
    for(const [k,v] of Object.entries(t)){ document.documentElement.style.setProperty(`--${k}`, v); }
  },

  renderShell(){
    const cfg = this.state.config;
    document.querySelectorAll('[data-business-name]').forEach(el => el.textContent = cfg.businessName);
    document.querySelectorAll('[data-slogan]').forEach(el => el.textContent = cfg.slogan);
    document.querySelectorAll('[data-hours]').forEach(el => el.textContent = cfg.hours);
    document.querySelectorAll('[data-location]').forEach(el => el.textContent = cfg.location);
    const notice = document.getElementById('noticeChip');
    if(notice && cfg.noticeActive){
      notice.style.display = 'flex';
      notice.querySelector('[data-notice-title]').textContent = cfg.noticeTitle || 'Aviso importante';
      notice.querySelector('[data-notice-text]').textContent = cfg.noticeText || '';
      notice.querySelector('button')?.addEventListener('click', () => window.open(cfg.noticeFile, '_blank'));
    }
  },

  money(v){
    return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(Number(v || 0));
  },

  saveCart(){
    localStorage.setItem('freskis-cart', JSON.stringify(this.state.cart));
    localStorage.setItem('freskis-mode', this.state.mode);
  },

  get filteredMenu(){
    const f = this.state.filters;
    return this.state.menu.filter(item => {
      const q = `${item.nombre} ${item.variante || ''} ${item.subcategoria || ''} ${item.descripcion || ''}`.toLowerCase();
      return (!f.categoria || item.categoria === f.categoria)
        && (!f.subcategoria || item.subcategoria === f.subcategoria)
        && (!f.presentacion || item['Presentacion'] === f.presentacion || item['Presentacion '] === f.presentacion)
        && (!f.q || q.includes(f.q.toLowerCase()));
    }).sort((a,b)=>Number(a.orden||999)-Number(b.orden||999));
  },

  categories(){
    return [...new Set(this.state.menu.map(x => x.categoria).filter(Boolean))];
  },
  subcategories(){
    const cat = this.state.filters.categoria;
    return [...new Set(this.state.menu.filter(x => !cat || x.categoria===cat).map(x => x.subcategoria).filter(Boolean))];
  },
  presentations(){
    const cat = this.state.filters.categoria;
    const sub = this.state.filters.subcategoria;
    return [...new Set(this.state.menu.filter(x => (!cat || x.categoria===cat) && (!sub || x.subcategoria===sub)).map(x => x['Presentacion'] || x['Presentacion ']).filter(Boolean))];
  },

  addToCart(item){
    const existing = this.state.cart.find(x => x.uid === item.uid);
    if(existing){ existing.qty += item.qty || 1; }
    else { this.state.cart.push({...item, qty: item.qty || 1}); }
    this.saveCart();
    this.renderCart();
  },

  updateQty(uid, delta){
    const item = this.state.cart.find(x => x.uid === uid);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0){
      this.state.cart = this.state.cart.filter(x => x.uid !== uid);
    }
    this.saveCart();
    this.renderCart();
  },

  removeItem(uid){
    this.state.cart = this.state.cart.filter(x => x.uid !== uid);
    this.saveCart();
    this.renderCart();
  },

  cartTotal(){
    return this.state.cart.reduce((s,x) => s + Number(x.precio || 0) * Number(x.qty || 1), 0);
  },

  orderFolio(){
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
  },

  composeWhatsAppText(){
    const folio = this.orderFolio();
    const cfg = this.state.config;
    let txt = `*${cfg.businessName}*\n`;
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
      const nombre = (document.getElementById('deliveryName')?.value || '').trim();
      const direccion = (document.getElementById('deliveryAddress')?.value || '').trim();
      const ubicacion = (document.getElementById('deliveryLocation')?.value || '').trim();
      txt += `\n*Entrega*\nNombre: ${nombre}\nDirección: ${direccion}\nUbicación: ${ubicacion}\n`;
    }
    return txt;
  },

  openWhatsApp(number){
    if(!this.state.cart.length){ alert('Agrega al menos un producto al pedido.'); return; }
    const txt = encodeURIComponent(this.composeWhatsAppText());
    window.open(`https://wa.me/${number}?text=${txt}`, '_blank');
  },

  copyOrder(){
    navigator.clipboard.writeText(this.composeWhatsAppText());
    alert('Comanda copiada.');
  },

  clearCart(){
    this.state.cart = [];
    this.saveCart();
    const ids = ['deliveryName','deliveryAddress','deliveryLocation'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    this.renderCart();
  },

  bindMusic(){
    const audio = document.getElementById('bgMusic');
    const toggle = document.getElementById('musicToggle');
    if(!audio || !toggle) return;
    audio.src = this.state.config.musicFile || '';
    audio.loop = true;
    if(!this.state.config.musicEnabled){
      toggle.classList.add('hidden');
      return;
    }
    let playing = false;
    toggle.addEventListener('click', async () => {
      try{
        if(!playing){ await audio.play(); playing = true; toggle.textContent = 'Pausar música'; }
        else { audio.pause(); playing = false; toggle.textContent = 'Activar música'; }
      }catch(e){
        alert('Tu navegador necesita una interacción del usuario para reproducir audio.');
      }
    });
  },

  bootIndex(){
    this.renderFilters();
    this.renderMenu();
    this.renderCart();
    document.getElementById('searchInput')?.addEventListener('input', e => { this.state.filters.q = e.target.value; this.renderMenu(); });
    document.getElementById('modeButtons')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-mode]');
      if(!btn) return;
      this.state.mode = btn.dataset.mode;
      this.saveCart();
      this.renderCart();
    });
    document.getElementById('copyOrderBtn')?.addEventListener('click', () => this.copyOrder());
    document.getElementById('clearCartBtn')?.addEventListener('click', () => this.clearCart());
  },

  renderFilters(){
    const catSel = document.getElementById('filterCategoria');
    const subSel = document.getElementById('filterSubcategoria');
    const preSel = document.getElementById('filterPresentacion');
    if(!catSel) return;
    const fill = (sel, opts, placeholder) => {
      const current = sel.value;
      sel.innerHTML = `<option value="">${placeholder}</option>` + opts.map(v => `<option ${current===v?'selected':''} value="${v}">${v}</option>`).join('');
    };
    fill(catSel, this.categories(), 'Todas las categorías');
    fill(subSel, this.subcategories(), 'Todas las subcategorías');
    fill(preSel, this.presentations(), 'Todas las presentaciones');
    catSel.onchange = () => { this.state.filters.categoria = catSel.value; this.state.filters.subcategoria = ''; this.state.filters.presentacion=''; this.renderFilters(); this.renderMenu(); };
    subSel.onchange = () => { this.state.filters.subcategoria = subSel.value; this.state.filters.presentacion=''; this.renderFilters(); this.renderMenu(); };
    preSel.onchange = () => { this.state.filters.presentacion = preSel.value; this.renderMenu(); };
  },

  renderMenu(){
    const wrap = document.getElementById('menuList');
    if(!wrap) return;
    const rows = this.filteredMenu;
    if(!rows.length){
      wrap.innerHTML = `<div class="empty">No hay productos con esos filtros.</div>`;
      return;
    }
    wrap.innerHTML = rows.map(item => {
      const present = item['Presentacion'] || item['Presentacion '] || '';
      const isFreski = (item.categoria || '').toLowerCase() === 'freskis';
      return `
      <article class="card menu-item">
        <div class="thumb"><img src="${item.imagen_url}" alt="${item.nombre}"></div>
        <div>
          <h4>${item.nombre}</h4>
          <div class="meta">
            ${item.subcategoria ? `<span class="tag">${item.subcategoria}</span>` : ''}
            ${item.variante ? `<span class="tag">${item.variante}</span>` : ''}
            ${present ? `<span class="tag">${present}</span>` : ''}
          </div>
          <div class="muted">${item.descripcion || ''}</div>
        </div>
        <div class="center">
          <div class="price">${this.money(item.precio)}</div>
          <button class="btn small" data-add="${item.id}">${isFreski ? 'Armar Freski' : 'Agregar'}</button>
        </div>
      </article>`;
    }).join('');
    wrap.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
      const item = this.state.menu.find(x => x.id === btn.dataset.add);
      if(!item) return;
      if((item.categoria || '').toLowerCase() === 'freskis') this.openFreskiBuilder(item);
      else this.addToCart({
        uid: crypto.randomUUID(),
        id: item.id,
        nombre: item.nombre,
        variante: item.variante,
        presentacion: item['Presentacion'] || item['Presentacion '] || '',
        precio: Number(item.precio || 0),
        observaciones: ''
      });
    }));
  },

  renderCart(){
    const wrap = document.getElementById('cartList');
    const total = document.getElementById('cartTotal');
    const count = document.getElementById('cartCount');
    if(!wrap) return;
    count.textContent = `${this.state.cart.length} producto(s)`;
    if(!this.state.cart.length){
      wrap.innerHTML = `<div class="empty">Tu pedido está vacío.</div>`;
    }else{
      wrap.innerHTML = this.state.cart.map(it => `
      <div class="cart-item">
        <div class="cart-row"><strong>${it.nombre}</strong><strong>${this.money(Number(it.precio) * Number(it.qty))}</strong></div>
        <div class="muted">${[it.variante, it.presentacion].filter(Boolean).join(' · ')}</div>
        ${it.componentes?.length ? `<div class="muted">Armado: ${it.componentes.join(', ')}</div>` : ''}
        ${it.observaciones ? `<div class="muted">Obs: ${it.observaciones}</div>` : ''}
        <div class="qty-row">
          <button class="icon-btn" data-dec="${it.uid}">−</button>
          <strong>${it.qty}</strong>
          <button class="icon-btn" data-inc="${it.uid}">+</button>
          <button class="icon-btn" data-del="${it.uid}" title="Eliminar">×</button>
        </div>
      </div>`).join('');
      wrap.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => this.updateQty(b.dataset.dec, -1));
      wrap.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => this.updateQty(b.dataset.inc, +1));
      wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = () => this.removeItem(b.dataset.del));
    }
    total.textContent = this.money(this.cartTotal());
    const modes = [...document.querySelectorAll('[data-mode]')];
    modes.forEach(b => b.classList.toggle('active', b.dataset.mode === this.state.mode));
    const delivery = document.getElementById('deliveryFields');
    if(delivery) delivery.classList.toggle('hidden', this.state.mode !== 'Envío a domicilio');
    const waWrap = document.getElementById('waButtons');
    if(waWrap){
      waWrap.innerHTML = this.state.config.phones.map((phone, i) =>
        `<button class="btn gold small" data-wa="${phone}">${this.state.config.whatsappLabel?.[i] || 'WhatsApp'}</button>`
      ).join('');
      waWrap.querySelectorAll('[data-wa]').forEach(b => b.onclick = () => this.openWhatsApp(b.dataset.wa));
    }
  },

  openFreskiBuilder(baseItem){
    const modal = document.getElementById('freskiModal');
    modal.classList.add('show');
    const byStep = step => this.state.freskiOptions.filter(x => String(x['Pasos'] || x['Pasos '] || '').replace(/\s/g,'').toLowerCase() === step.toLowerCase());
    const sections = [
      {title:'Paso 1 · Fruta', key:'Paso1'},
      {title:'Paso 2 · Topping', key:'Paso2'},
      {title:'Paso 3 · Crema', key:'Paso3'},
      {title:'Paso 4 · Top', key:'Paso4'}
    ];
    const state = { picks: {} };
    const body = document.getElementById('freskiBody');
    body.innerHTML = sections.map(sec => {
      const opts = byStep(sec.key);
      return `<div class="card promo-card">
        <h4>${sec.title}</h4>
        <div class="choice-list">
          ${opts.map(o => `<button class="choice" data-step="${sec.key}" data-type="${o.Tipo}"><span>${o.Tipo}</span><span class="muted">${o.descripcion || ''}</span></button>`).join('')}
        </div>
      </div>`;
    }).join('');
    body.querySelectorAll('.choice').forEach(btn => btn.addEventListener('click', () => {
      const {step, type} = btn.dataset;
      state.picks[step] = type;
      [...body.querySelectorAll(`[data-step="${step}"]`)].forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
    }));
    document.getElementById('freskiTitle').textContent = `${baseItem.nombre} · ${baseItem.variante || ''}`;
    document.getElementById('freskiObs').value = '';
    document.getElementById('closeFreski').onclick = () => modal.classList.remove('show');
    document.getElementById('saveFreski').onclick = () => {
      const picks = Object.values(state.picks);
      if(picks.length < 4){ alert('Completa los 4 pasos para armar tu Freski.'); return; }
      this.addToCart({
        uid: crypto.randomUUID(),
        id: baseItem.id,
        nombre: baseItem.nombre,
        variante: baseItem.variante,
        presentacion: baseItem['Presentacion'] || baseItem['Presentacion '] || '',
        precio: Number(baseItem.precio || 0),
        observaciones: document.getElementById('freskiObs').value.trim(),
        componentes: picks
      });
      modal.classList.remove('show');
    };
  },

  bootPromos(){
    const wrap = document.getElementById('promoList');
    if(!wrap) return;
    const items = this.state.promos.filter(x => x.active !== false);
    wrap.innerHTML = items.map(p => `
      <article class="card promo-card">
        <h3>${p.title}</h3>
        ${p.type === 'pdf' ? `<iframe title="${p.title}" src="${p.file}"></iframe>` : `<img src="${p.file}" alt="${p.title}" style="border-radius:18px">`}
      </article>
    `).join('') || `<div class="empty">No hay promociones activas por el momento.</div>`;
  },

  bootGames(){
    const wrap = document.getElementById('gamesList');
    if(!wrap) return;
    wrap.innerHTML = this.state.games.map((g, i) => `
      <article class="card game-card">
        <h3>${g.title}</h3>
        <p class="muted">${g.description || ''}</p>
        <button class="btn" data-launch="${i}">Jugar ahora</button>
        <div id="gameFrame${i}" class="hidden" style="margin-top:12px">
          <iframe src="${g.file}" style="width:100%;height:560px;border:none;border-radius:18px;background:#000"></iframe>
        </div>
      </article>
    `).join('');
    wrap.querySelectorAll('[data-launch]').forEach(btn => btn.onclick = () => {
      document.getElementById(`gameFrame${btn.dataset.launch}`).classList.toggle('hidden');
      btn.textContent = btn.textContent.includes('Jugar') ? 'Ocultar juego' : 'Jugar ahora';
    });
  },

  bootAdmin(){
    const gate = document.getElementById('adminGate');
    const panel = document.getElementById('adminPanel');
    const passInput = document.getElementById('adminPassword');
    const loginBtn = document.getElementById('adminLoginBtn');
    const PASSWORD = '1A972df8$';
    sessionStorage.removeItem('freskis-admin');
    loginBtn.onclick = () => {
      if(passInput.value === PASSWORD){
        sessionStorage.setItem('freskis-admin', 'ok');
        gate.classList.add('hidden');
        panel.classList.remove('hidden');
        this.renderAdminPanel();
      }else{
        alert('Contraseña incorrecta.');
      }
    };
    window.addEventListener('beforeunload', () => sessionStorage.removeItem('freskis-admin'));
  },

  renderAdminPanel(){
    const cfg = structuredClone(this.state.config);
    document.getElementById('cfgBusinessName').value = cfg.businessName || '';
    document.getElementById('cfgSlogan').value = cfg.slogan || '';
    document.getElementById('cfgHours').value = cfg.hours || '';
    document.getElementById('cfgLocation').value = cfg.location || '';
    document.getElementById('cfgPhone1').value = cfg.phones?.[0] || '';
    document.getElementById('cfgPhone2').value = cfg.phones?.[1] || '';
    document.getElementById('cfgNoticeActive').checked = !!cfg.noticeActive;
    document.getElementById('cfgNoticeTitle').value = cfg.noticeTitle || '';
    document.getElementById('cfgNoticeText').value = cfg.noticeText || '';
    document.getElementById('cfgMusicEnabled').checked = !!cfg.musicEnabled;
    document.getElementById('adminSaveLocalBtn').onclick = () => {
      cfg.businessName = document.getElementById('cfgBusinessName').value.trim();
      cfg.slogan = document.getElementById('cfgSlogan').value.trim();
      cfg.hours = document.getElementById('cfgHours').value.trim();
      cfg.location = document.getElementById('cfgLocation').value.trim();
      cfg.phones = [
        document.getElementById('cfgPhone1').value.trim(),
        document.getElementById('cfgPhone2').value.trim()
      ].filter(Boolean);
      cfg.noticeActive = document.getElementById('cfgNoticeActive').checked;
      cfg.noticeTitle = document.getElementById('cfgNoticeTitle').value.trim();
      cfg.noticeText = document.getElementById('cfgNoticeText').value.trim();
      cfg.musicEnabled = document.getElementById('cfgMusicEnabled').checked;
      document.getElementById('jsonPreview').textContent = JSON.stringify(cfg, null, 2);
      localStorage.setItem('admin-preview-config', JSON.stringify(cfg));
      alert('Vista previa local actualizada. Para publicarla para todos, usa GitHub Sync.');
    };

    // Excel import
    document.getElementById('menuExcelInput').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if(!file) return;
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, {defval:''});
      document.getElementById('menuJsonPreview').textContent = JSON.stringify(json.slice(0,10), null, 2) + `\n\nTotal registros: ${json.length}`;
      window.__pendingMenuJson = json;
      window.__pendingMenuFile = file;
    });

    document.getElementById('freskiExcelInput').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if(!file) return;
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, {defval:''});
      document.getElementById('freskiJsonPreview').textContent = JSON.stringify(json.slice(0,10), null, 2) + `\n\nTotal registros: ${json.length}`;
      window.__pendingFreskiJson = json;
      window.__pendingFreskiFile = file;
    });

    // promo and notice files
    document.getElementById('promoFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if(!file) return;
      window.__pendingPromoFile = file;
      document.getElementById('promoStatus').textContent = `Archivo listo: ${file.name}`;
    });
    document.getElementById('noticeFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if(!file) return;
      window.__pendingNoticeFile = file;
      document.getElementById('noticeStatus').textContent = `Archivo listo: ${file.name}`;
    });
    document.getElementById('musicFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if(!file) return;
      window.__pendingMusicFile = file;
      document.getElementById('musicStatus').textContent = `Archivo listo: ${file.name}`;
    });

    document.getElementById('githubPushBtn').onclick = () => this.pushToGitHub();
  },

  async pushToGitHub(){
    const owner = document.getElementById('ghOwner').value.trim();
    const repo = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim() || 'main';
    const token = document.getElementById('ghToken').value.trim();
    if(!owner || !repo || !token){
      alert('Completa owner, repo y token para sincronizar.');
      return;
    }
    const status = document.getElementById('githubStatus');
    status.textContent = 'Subiendo cambios a GitHub...';

    const previewCfg = JSON.parse(localStorage.getItem('admin-preview-config') || JSON.stringify(this.state.config));
    const uploads = [
      {path:'data/site-config.json', content: JSON.stringify(previewCfg, null, 2), type:'text'},
    ];
    if(window.__pendingMenuJson){
      uploads.push({path:'data/lgp-menu.json', content: JSON.stringify(window.__pendingMenuJson, null, 2), type:'text'});
      uploads.push({path:'data/LGP-Menu.xlsx', file: window.__pendingMenuFile, type:'binary'});
    }
    if(window.__pendingFreskiJson){
      uploads.push({path:'data/freskis-menu.json', content: JSON.stringify(window.__pendingFreskiJson, null, 2), type:'text'});
      uploads.push({path:'data/Freskis-Menu.xlsx', file: window.__pendingFreskiFile, type:'binary'});
    }
    if(window.__pendingPromoFile){
      const promoName = window.__pendingPromoFile.name.replace(/\s+/g, '-');
      uploads.push({path:`assets/img/${promoName}`, file: window.__pendingPromoFile, type:'binary'});
      const promos = [{title:'Promoción actual', type: promoName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image', file:`assets/img/${promoName}`, active:true}];
      uploads.push({path:'data/promos.json', content: JSON.stringify(promos, null, 2), type:'text'});
    }
    if(window.__pendingNoticeFile){
      const noticeName = window.__pendingNoticeFile.name.replace(/\s+/g, '-');
      uploads.push({path:`assets/img/${noticeName}`, file: window.__pendingNoticeFile, type:'binary'});
      previewCfg.noticeFile = `assets/img/${noticeName}`;
      uploads.push({path:'data/site-config.json', content: JSON.stringify(previewCfg, null, 2), type:'text'});
    }
    if(window.__pendingMusicFile){
      const musicName = window.__pendingMusicFile.name.replace(/\s+/g, '-');
      uploads.push({path:`assets/audio/${musicName}`, file: window.__pendingMusicFile, type:'binary'});
      previewCfg.musicFile = `assets/audio/${musicName}`;
      uploads.push({path:'data/site-config.json', content: JSON.stringify(previewCfg, null, 2), type:'text'});
    }

    try{
      for(const item of uploads){
        let content, message;
        if(item.type === 'text'){
          content = btoa(unescape(encodeURIComponent(item.content)));
        } else {
          const buf = await item.file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = '';
          const chunk = 0x8000;
          for(let i=0; i<bytes.length; i += chunk){
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          content = btoa(binary);
        }

        let sha = undefined;
        const check = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${item.path}?ref=${branch}`, {
          headers: { Authorization: `Bearer ${token}`, Accept:'application/vnd.github+json' }
        });
        if(check.ok){
          const j = await check.json(); sha = j.sha;
        }

        message = `Actualiza ${item.path} desde panel admin Freskis`;
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${item.path}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept:'application/vnd.github+json',
            'Content-Type':'application/json'
          },
          body: JSON.stringify({ message, content, branch, sha })
        });
        if(!res.ok){
          const err = await res.text();
          throw new Error(`Error en ${item.path}: ${err}`);
        }
      }
      status.textContent = 'Cambios publicados correctamente en GitHub. Recarga tu GitHub Pages en unos segundos.';
    }catch(err){
      console.error(err);
      status.textContent = 'No se pudo publicar: ' + err.message;
    }
  }
};
