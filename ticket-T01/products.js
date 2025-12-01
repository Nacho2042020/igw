// products.js — carga productos desde data/products.json y renderiza el grid con talles y filtros
(function(){
  const grid = document.getElementById('product-grid');
  const filterBtns = Array.from(document.querySelectorAll('.filter-btn'));
  const modal = document.getElementById('product-modal');
  const modalImg = document.getElementById('modal-img');
  const modalOverlay = document.getElementById('modal-color-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalPrice = document.getElementById('modal-price');
  const modalSizes = document.getElementById('modal-sizes');
  const modalColors = document.getElementById('modal-colors');
  const modalAddBtn = document.getElementById('modal-add');

  let products = [];
  let current = null;
  // cart state
  let cart = [];
  const CART_KEY = 'ticketT01_cart_v1';
  const cartToggle = document.getElementById('cart-toggle');
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartClose = document.getElementById('cart-close');
  const cartItemsContainer = document.getElementById('cart-items');
  const cartCount = document.getElementById('cart-count');
  const cartTotalEl = document.getElementById('cart-total');

  function formatPrice(p){
    return '$' + Number(p).toLocaleString('es-AR');
  }

  function createSizePills(sizes){
    return sizes.map(s => `<span class="size-pill" aria-hidden="true">${s}</span>`).join('');
  }

  function render(list){
    if(!grid) return;
    grid.innerHTML = list.map(p => `
      <article class="product-card" data-cat="${p.category}" data-id="${p.id}">
        <img src="${p.image}" alt="${p.title}" />
        <img class="model-thumb" src="${getModelThumb(p)}" alt="modelo" />
        <h3 class="prod-title">${p.title}</h3>
        <p class="price">${formatPrice(p.price)}</p>
        <div class="sizes">Talles: ${createSizePills(p.sizes)}</div>
        <div class="card-actions">
          <button class="btn small" data-action="view" data-id="${p.id}">VER</button>
          <button class="btn small ghost" data-action="add" data-id="${p.id}">AÑADIR</button>
        </div>
      </article>
    `).join('\n');

    // attach event delegation for view/add
    grid.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', onActionClick));
  }

  function getModelThumb(product){
    // Build a simple search query for Unsplash Source using product title and category
    try{
      const keywords = (product.title || '').split(/\s+/).slice(0,3).map(k => k.replace(/[^a-zA-Z0-9\-]/g,'')).filter(Boolean);
      const cat = product.category || 'men';
      const terms = [];
      if(cat === 'men') terms.push('man','male','athlete');
      else if(cat === 'women') terms.push('woman','female','athlete');
      else terms.push('child','kid','athlete');
      const q = encodeURIComponent(terms.concat(keywords).join(','));
      const url = `https://source.unsplash.com/600x400/?${q}`;
      // Use remote image when online, otherwise fallback to local asset
      if(typeof navigator !== 'undefined' && !navigator.onLine){
        return cat === 'women' ? 'images/model-women.svg' : (cat === 'kids' ? 'images/model-kid.svg' : 'images/model-men.svg');
      }
      return url;
    }catch(e){
      return 'images/model-men.svg';
    }
  }

  function onActionClick(e){
    const id = e.currentTarget.dataset.id;
    const action = e.currentTarget.dataset.action;
    const product = products.find(p => p.id === id);
    if(!product) return;
    if(action === 'add'){
      // add directly to cart using default color (first color) if available
      const defaultColor = (product.colors && product.colors[0]) ? product.colors[0].hex : undefined;
      addToCart(product, 1, defaultColor);
      flashCart();
      openCart();
      return;
    }
    openModal(product, action);
  }

  function applyFilter(cat){
    if(cat === 'all') render(products);
    else render(products.filter(p => p.category === cat));
    filterBtns.forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  }

  function openModal(product, action){
    current = product;
    modalImg.src = product.image;
    modalTitle.textContent = product.title.toUpperCase();
    modalPrice.textContent = formatPrice(product.price);
    modalSizes.innerHTML = 'Talles: ' + createSizePills(product.sizes);

    // render colors
    modalColors.innerHTML = '';
    (product.colors || []).forEach((c, idx) => {
      const sw = document.createElement('button');
      sw.className = 'swatch';
      sw.title = c.name;
      sw.setAttribute('aria-label', c.name);
      sw.style.background = c.hex;
      sw.dataset.hex = c.hex;
      if(idx === 0) sw.classList.add('active');
      sw.addEventListener('click', () => selectColor(sw, c));
      modalColors.appendChild(sw);
    });

    // default color overlay
    const firstColor = (product.colors && product.colors[0]) ? product.colors[0].hex : 'transparent';
    modalOverlay.style.background = firstColor;

    // show modal
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('show');
    // modal add button action — añade al carrito usando el color seleccionado y abre el carrito
    modalAddBtn.onclick = () => {
      const active = modalColors.querySelector('.swatch.active');
      const hex = active ? active.dataset.hex : (product.colors && product.colors[0] ? product.colors[0].hex : undefined);
      addToCart(product, 1, hex);
      modalAddBtn.textContent = 'Añadido';
      flashCart();
      openCart();
      setTimeout(() => {
        closeModal();
        modalAddBtn.textContent = 'AÑADIR';
      }, 600);
    };
  }

  function selectColor(button, color){
    // mark active
    modalColors.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    button.classList.add('active');
    // set overlay color to simulate color variant
    modalOverlay.style.background = color.hex;
  }

  function closeModal(){
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('show');
    current = null;
  }

  // CART helpers
  function loadCart(){
    try{ cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }catch(e){ cart = []; }
    renderCart();
  }

  function saveCart(){
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCartCount();
    renderCart();
  }

  function renderCartCount(){
    const totalCount = cart.reduce((s,i)=>s+i.qty,0);
    if(cartCount) cartCount.textContent = totalCount;
  }

  function renderCart(){
    if(!cartItemsContainer) return;
    if(cart.length === 0){
      cartItemsContainer.innerHTML = '<p class="muted">Tu carrito está vacío.</p>';
      cartTotalEl.textContent = '$0';
      renderCartCount();
      return;
    }
    cartItemsContainer.innerHTML = cart.map(item=>{
      return `<div class="cart-item" data-id="${item.id}">
        <img src="${item.image}" alt="${item.title}" />
        <div class="meta"><h4>${item.title}</h4>
          <div class="qty">Cantidad: <button class="qty-dec" data-id="${item.id}">-</button> <span class="qty-val">${item.qty}</span> <button class="qty-inc" data-id="${item.id}">+</button></div>
          <div class="price-small">${formatPrice(item.price * item.qty)}</div>
        </div>
        <div><button class="remove-item" data-id="${item.id}">Eliminar</button></div>
      </div>`
    }).join('');

    // attach events
    cartItemsContainer.querySelectorAll('.qty-inc').forEach(b=>b.addEventListener('click', e=>{ changeQty(e.currentTarget.dataset.id, 1)}));
    cartItemsContainer.querySelectorAll('.qty-dec').forEach(b=>b.addEventListener('click', e=>{ changeQty(e.currentTarget.dataset.id, -1)}));
    cartItemsContainer.querySelectorAll('.remove-item').forEach(b=>b.addEventListener('click', e=>{ removeFromCart(e.currentTarget.dataset.id)}));

    const total = cart.reduce((s,i)=>s + (Number(i.price)||0) * i.qty,0);
    cartTotalEl.textContent = formatPrice(total);
    renderCartCount();
  }

  function changeQty(id, delta){
    const idx = cart.findIndex(i=>i.id===id); if(idx===-1) return; cart[idx].qty = Math.max(1, cart[idx].qty + delta); saveCart();
  }

  function removeFromCart(id){ cart = cart.filter(i=>i.id!==id); saveCart(); }

  function addToCart(product, qty=1, color){
    const found = cart.find(i=>i.id===product.id && i.color === (color||product.colors?.[0]?.hex));
    if(found){ found.qty += qty; }
    else{ cart.push({id: product.id, title: product.title, price: product.price, qty, image: product.image, color: color||product.colors?.[0]?.hex}); }
    saveCart();
  }

  function attachModalCloseHandlers(){
    document.querySelectorAll('[data-action="close"]').forEach(b => b.addEventListener('click', closeModal));
    document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeModal(); });
  }

  function flashCart(){
    try{
      if(!cartToggle) return;
      cartToggle.classList.add('bump');
      setTimeout(()=>cartToggle.classList.remove('bump'),260);
    }catch(e){ /* ignore */ }
  }

  function openCart(){
    if(!cartSidebar) return;
    cartSidebar.classList.add('open');
    cartSidebar.setAttribute('aria-hidden', 'false');
    cartSidebar.scrollTop = 0;
    renderCart();
    renderCartCount();
  }

  function init(){
    fetch('data/products.json')
      .then(r => r.json())
      .then(data => {
        products = data.products || [];
        render(products);
      }).catch(err => {
        console.error('No se pudo cargar products.json', err);
        grid.innerHTML = '<p class="muted">No se pudieron cargar los productos de ejemplo.</p>';
      });

    filterBtns.forEach(b => b.addEventListener('click', (e) => {
      const cat = b.dataset.cat || 'all';
      applyFilter(cat);
    }));

    attachModalCloseHandlers();
    // cart handlers
    if(cartToggle) cartToggle.addEventListener('click', ()=>{ cartSidebar.classList.toggle('open'); cartSidebar.setAttribute('aria-hidden', cartSidebar.classList.contains('open') ? 'false' : 'true'); });
    if(cartClose) cartClose.addEventListener('click', ()=>{ cartSidebar.classList.remove('open'); cartSidebar.setAttribute('aria-hidden','true'); });
    loadCart();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
