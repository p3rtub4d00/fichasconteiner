const SW_VERSION = 'conteiner-beer-v5-auto-images';

const PHOTO_LAYER = '\n' +
"(function () {\n" +
"  var CACHE_KEY = 'conteiner-beer-product-images-v3';\n" +
"  var cache = {};\n" +
"  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) {}\n" +
"  function saveCache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {} }\n" +
"  function cleanName(name) { return String(name || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\\s+/g, ' ').trim(); }\n" +
"  function fallbackImage(product) {\n" +
"    var category = cleanName(product && product.category || 'bebida').toLowerCase();\n" +
"    var query = category.indexOf('cerve') >= 0 ? 'beer bottle' : (category.indexOf('drink') >= 0 || category.indexOf('bebida') >= 0 ? 'soft drink beverage' : 'food drink restaurant');\n" +
"    var raw = String(product && (product._id || product.name) || '');\n" +
"    var hash = Math.abs(raw.split('').reduce(function(a,c){ return ((a << 5) - a) + c.charCodeAt(0) | 0; }, 0));\n" +
"    return 'https://loremflickr.com/640/640/' + encodeURIComponent(query) + '?lock=' + hash;\n" +
"  }\n" +
"  async function findImage(product) {\n" +
"    var key = product && (product._id || cleanName(product.name));\n" +
"    if (!key || cache[key]) return cache[key] || null;\n" +
"    var term = cleanName(product && product.name);\n" +
"    if (!term) return null;\n" +
"    try {\n" +
"      var url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(term) + '&search_simple=1&action=process&json=1&page_size=1&fields=product_name,image_front_small_url,image_url';\n" +
"      var response = await fetch(url, { headers: { Accept: 'application/json' } });\n" +
"      if (response.ok) {\n" +
"        var data = await response.json();\n" +
"        var item = Array.isArray(data.products) ? data.products[0] : null;\n" +
"        var image = item && (item.image_front_small_url || item.image_url);\n" +
"        if (image) { cache[key] = image; saveCache(); return image; }\n" +
"      }\n" +
"    } catch (error) { console.warn('Imagem automática indisponível:', term, error); }\n" +
"    var fallback = fallbackImage(product); cache[key] = fallback; saveCache(); return fallback;\n" +
"  }\n" +
"  function renderImage(product) {\n" +
"    var key = product && (product._id || cleanName(product.name));\n" +
"    var src = product && product.imageUrl || cache[key] || fallbackImage(product);\n" +
"    var fallback = fallbackImage(product);\n" +
"    return '<div class=\"cb-product-image-wrap\"><img class=\"cb-product-image\" src=\"' + src + '\" alt=\"' + cleanName(product && product.name) + '\" loading=\"lazy\" referrerpolicy=\"no-referrer\" onerror=\"this.onerror=null;this.src=\\\'' + fallback + '\\'\"></div>';\n" +
"  }\n" +
"  function ensureStyles() {\n" +
"    if (document.getElementById('cb-auto-image-styles')) return;\n" +
"    var style = document.createElement('style'); style.id = 'cb-auto-image-styles';\n" +
"    style.textContent = '.cb-product-image-wrap{width:100%;height:118px;border-radius:13px;overflow:hidden;background:linear-gradient(145deg,var(--bg-card),var(--input-bg));border:1px solid var(--border);margin-bottom:10px;display:flex;align-items:center;justify-content:center}.cb-product-image{width:100%;height:100%;object-fit:contain;display:block}.cb-product-card{padding:10px 10px 14px!important;justify-content:flex-start!important}.cb-product-card strong{min-height:36px;display:flex;align-items:center;justify-content:center}@media(max-width:600px){.cb-product-image-wrap{height:100px}.cb-product-card strong{font-size:13px}}';\n" +
"    document.head.appendChild(style);\n" +
"  }\n" +
"  var originalRenderWaiterGrid = renderWaiterGrid;\n" +
"  renderWaiterGrid = function(products) {\n" +
"    if (!Array.isArray(products)) return originalRenderWaiterGrid(products);\n" +
"    var grid = document.getElementById('waiter-product-grid'); if (!grid) return originalRenderWaiterGrid(products);\n" +
"    if (!products.length) { grid.innerHTML = '<p style=\"grid-column:1/-1;text-align:center;\">Nenhum produto.</p>'; return; }\n" +
"    grid.innerHTML = products.map(function(p) {\n" +
"      var out = Number(p.stock) <= 0; var low = Number(p.stock) > 0 && Number(p.stock) <= 5;\n" +
"      var classes = 'grid-item cb-product-card' + (out ? ' out-of-stock' : low ? ' low-stock' : '');\n" +
"      var click = out ? '' : \"addToCart('\" + p._id + \"')\";\n" +
"      return '<div class=\"' + classes + '\" onclick=\"' + click + '\">' + renderImage(p) + '<strong>' + String(p.name || '') + '</strong><span>R$ ' + Number(p.price || 0).toFixed(2) + '</span><small>Estoque: ' + p.stock + '</small></div>';\n" +
"    }).join('');\n" +
"  };\n" +
"  var originalFetchProducts = fetchProducts;\n" +
"  fetchProducts = async function(role) {\n" +
"    await originalFetchProducts(role);\n" +
"    if (!Array.isArray(allProducts)) return;\n" +
"    var products = allProducts.slice();\n" +
"    applyWaiterFilters();\n" +
"    for (var i = 0; i < products.length; i++) {\n" +
"      var product = products[i]; var key = product._id || cleanName(product.name);\n" +
"      if (!product.imageUrl && !cache[key]) { await findImage(product); applyWaiterFilters(); }\n" +
"    }\n" +
"  };\n" +
"  ensureStyles();\n" +
"})();\n";

self.addEventListener('install', function(event) { self.skipWaiting(); });
self.addEventListener('activate', function(event) { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.endsWith('/app.js')) return;
  event.respondWith((async function() {
    var response = await fetch(event.request);
    if (!response.ok) return response;
    var source = await response.text();
    var headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/javascript; charset=utf-8');
    return new Response(source + '\\n\\n' + PHOTO_LAYER, { status: response.status, statusText: response.statusText, headers: headers });
  })());
});
