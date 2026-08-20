const SW_VERSION = 'conteiner-beer-v4-auto-images';

const PHOTO_LAYER = `
(() => {
  const CACHE_KEY = 'conteiner-beer-product-images-v2';
  const cache = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; } })();
  const saveCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {} };
  const cleanName = (name) => String(name || '')
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\\s+/g, ' ').trim();
  const fallbackImage = (product) => {
    const category = cleanName(product?.category || 'bebida').toLowerCase();
    const query = category.includes('cerve') ? 'beer bottle' : category.includes('drink') || category.includes('bebida') ? 'soft drink beverage' : 'food drink restaurant';
    const hash = Math.abs(String(product?._id || product?.name || '').split('').reduce((a,c) => ((a << 5) - a) + c.charCodeAt(0) | 0, 0));
    return `https://loremflickr.com/640/640/${encodeURIComponent(query)}?lock=${hash}`;
  };
  async function findImage(product) {
    const key = product?._id || cleanName(product?.name);
    if (!key) return null;
    if (cache[key]) return cache[key];
    const term = cleanName(product?.name);
    if (!term) return null;
    try {
      const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(term) + '&search_simple=1&action=process&json=1&page_size=1&fields=product_name,image_front_small_url,image_url';
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        const item = Array.isArray(data.products) ? data.products[0] : null;
        const image = item?.image_front_small_url || item?.image_url || null;
        if (image) { cache[key] = image; saveCache(); return image; }
      }
    } catch (error) { console.warn('Imagem automática indisponível:', term, error); }
    const fallback = fallbackImage(product);
    cache[key] = fallback; saveCache(); return fallback;
  }
  const renderImage = (product) => {
    const key = product?._id || cleanName(product?.name);
    const src = product?.imageUrl || cache[key] || fallbackImage(product);
    const fallback = fallbackImage(product);
    return `<div class="cb-product-image-wrap"><img class="cb-product-image" src="${src}" alt="${cleanName(product?.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}';"></div>`;
  };
  function ensureStyles() {
    if (document.getElementById('cb-auto-image-styles')) return;
    const style = document.createElement('style');
    style.id = 'cb-auto-image-styles';
    style.textContent = `
      .cb-product-image-wrap{width:100%;height:118px;border-radius:13px;overflow:hidden;background:linear-gradient(145deg,var(--bg-card),var(--input-bg));border:1px solid var(--border);margin-bottom:10px;display:flex;align-items:center;justify-content:center}
      .cb-product-image{width:100%;height:100%;object-fit:contain;display:block}
      .cb-product-card{padding:10px 10px 14px!important;justify-content:flex-start!important}
      .cb-product-card strong{min-height:36px;display:flex;align-items:center;justify-content:center}
      @media(max-width:600px){.cb-product-image-wrap{height:100px}.cb-product-card strong{font-size:13px}}
    `;
    document.head.appendChild(style);
  }
  const originalRenderWaiterGrid = renderWaiterGrid;
  renderWaiterGrid = function(products) {
    if (!Array.isArray(products)) return originalRenderWaiterGrid(products);
    const grid = document.getElementById('waiter-product-grid');
    if (!grid) return originalRenderWaiterGrid(products);
    if (!products.length) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;">Nenhum produto.</p>'; return; }
    grid.innerHTML = products.map(p => {
      const out = Number(p.stock) <= 0;
      const low = Number(p.stock) > 0 && Number(p.stock) <= 5;
      const classes = 'grid-item cb-product-card' + (out ? ' out-of-stock' : low ? ' low-stock' : '');
      return `<div class="${classes}" onclick="${out ? '' : `addToCart('${p._id}')`}">${renderImage(p)}<strong>${String(p.name || '')}</strong><span>R$ ${Number(p.price || 0).toFixed(2)}</span><small>Estoque: ${p.stock}</small></div>`;
    }).join('');
  };
  const originalFetchProducts = fetchProducts;
  fetchProducts = async function(role) {
    await originalFetchProducts(role);
    if (!Array.isArray(allProducts)) return;
    const products = allProducts.slice();
    applyWaiterFilters();
    for (const product of products) {
      const key = product._id || cleanName(product.name);
      if (!product.imageUrl && !cache[key]) {
        await findImage(product);
        applyWaiterFilters();
      }
    }
  };
  ensureStyles();
})();
`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('Conteiner Beer Service Worker instalado:', SW_VERSION);
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.endsWith('/app.js')) return;
  event.respondWith((async () => {
    const response = await fetch(event.request);
    if (!response.ok) return response;
    const source = await response.text();
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/javascript; charset=utf-8');
    return new Response(source + '\n\n' + PHOTO_LAYER, { status: response.status, statusText: response.statusText, headers });
  })());
});
