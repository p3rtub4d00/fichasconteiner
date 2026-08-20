const SW_VERSION = 'conteiner-beer-v2';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('Conteiner Beer Service Worker instalado:', SW_VERSION);
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Mantém o app.js original intacto e injeta apenas a camada visual/gerenciamento
// de fotos. Assim as regras de venda, estoque, comandas e pagamentos continuam
// no app.js original.
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || !url.pathname.endsWith('/app.js')) return;

    event.respondWith((async () => {
        const response = await fetch(event.request);
        if (!response.ok) return response;
        const source = await response.text();
        const enhancement = `
(function () {
    if (window.__conteinerBeerProductImages) return;
    window.__conteinerBeerProductImages = true;

    const IMAGE_KEY = 'conteiner-beer:product-images:v1';
    let editImageState = undefined;

    function readImages() {
        try { return JSON.parse(localStorage.getItem(IMAGE_KEY) || '{}'); }
        catch (_) { return {}; }
    }

    function writeImages(images) {
        try {
            const json = JSON.stringify(images);
            if (json.length > 4500000) {
                alert('O armazenamento de fotos deste dispositivo está quase cheio. Remova algumas fotos antes de adicionar novas.');
                return false;
            }
            localStorage.setItem(IMAGE_KEY, json);
            return true;
        } catch (_) {
            alert('Não foi possível salvar a foto neste dispositivo.');
            return false;
        }
    }

    function imageFor(product) {
        const images = readImages();
        return images[product?._id] || images['name:' + String(product?.name || '').toLowerCase()] || '';
    }

    function escapeText(value) {
        return String(value ?? '').replace(/[&<>\"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#039;' }[char]));
    }

    function productImage(product, size) {
        const src = imageFor(product);
        if (!src) return '<div class="cb-product-placeholder" aria-label="Produto sem foto">🍺</div>';
        return '<img class="cb-product-image" src="' + src + '" alt="' + escapeText(product.name) + '" loading="lazy">';
    }

    function compress(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) return reject(new Error('Selecione uma imagem.'));
            if (file.size > 12 * 1024 * 1024) return reject(new Error('A imagem deve ter no máximo 12 MB.'));
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('Imagem inválida.'));
                img.onload = () => {
                    const max = 600;
                    const scale = Math.min(1, max / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(img.width * scale));
                    canvas.height = Math.max(1, Math.round(img.height * scale));
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.72));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function ensureStyles() {
        if (document.getElementById('cb-product-image-styles')) return;
        const style = document.createElement('style');
        style.id = 'cb-product-image-styles';
        style.textContent = `
            .cb-product-image,.cb-product-placeholder{width:100%;height:110px;object-fit:cover;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--bg-card);border:1px solid var(--border);font-size:36px;margin-bottom:10px}
            .cb-admin-product-image{width:52px;height:52px;object-fit:cover;border-radius:9px;border:1px solid var(--border);background:var(--bg-card);flex:none}
            .cb-image-box{margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--list-bg)}
            .cb-image-preview{width:86px;height:86px;object-fit:cover;border-radius:10px;border:1px solid var(--border);background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:26px}
            .cb-image-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
            .cb-image-label{display:inline-flex;align-items:center;gap:6px;padding:9px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--bg-card);color:var(--text-main);font-weight:700;font-size:12px}
            .cb-image-help{display:block;margin-top:7px;color:var(--text-muted);font-size:10px}
            @media (max-width:600px){.cb-product-image,.cb-product-placeholder{height:92px}.cb-image-box{padding:10px}}
        `;
        document.head.appendChild(style);
    }

    function setupNewProductImage() {
        const host = document.getElementById('prod-wholesale')?.closest('.form-group-stack');
        if (!host || document.getElementById('cb-new-image-box')) return;
        const box = document.createElement('div');
        box.id = 'cb-new-image-box';
        box.className = 'cb-image-box';
        box.innerHTML = '<strong style="font-size:12px;color:var(--text-muted)">Foto do produto</strong>' +
            '<div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">' +
            '<div id="cb-new-preview" class="cb-image-preview">🍺</div>' +
            '<div><label class="cb-image-label" for="cb-new-image">📷 Escolher foto</label><button type="button" id="cb-new-clear" class="btn-danger" style="padding:9px 12px;margin-left:6px">Remover</button><input id="cb-new-image" type="file" accept="image/jpeg,image/png,image/webp" style="display:none"></div>' +
            '</div><small class="cb-image-help">A imagem é otimizada automaticamente e fica disponível para o garçom neste dispositivo.</small>';
        const button = host.querySelector('button[onclick="addProduct()"]');
        host.insertBefore(box, button || null);
        document.getElementById('cb-new-image').addEventListener('change', async (event) => {
            try {
                const data = await compress(event.target.files?.[0]);
                box.dataset.image = data;
                document.getElementById('cb-new-preview').innerHTML = '<img class="cb-image-preview" src="' + data + '" alt="Prévia">';
            } catch (error) { event.target.value = ''; alert(error.message); }
        });
        document.getElementById('cb-new-clear').addEventListener('click', () => {
            delete box.dataset.image;
            document.getElementById('cb-new-image').value = '';
            document.getElementById('cb-new-preview').innerHTML = '🍺';
        });
    }

    function setupEditProductImage() {
        const modal = document.getElementById('edit-prod-modal');
        if (!modal || document.getElementById('cb-edit-image-box')) return;
        const box = document.createElement('div');
        box.id = 'cb-edit-image-box';
        box.className = 'cb-image-box';
        box.innerHTML = '<strong style="font-size:12px;color:var(--text-muted)">Foto do produto</strong>' +
            '<div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">' +
            '<div id="cb-edit-preview" class="cb-image-preview">🍺</div>' +
            '<div><label class="cb-image-label" for="cb-edit-image">📷 Trocar foto</label><button type="button" id="cb-edit-clear" class="btn-danger" style="padding:9px 12px;margin-left:6px">Remover</button><input id="cb-edit-image" type="file" accept="image/jpeg,image/png,image/webp" style="display:none"></div>' +
            '</div><small class="cb-image-help">A foto é mantida ao editar os demais dados, salvo se você trocar ou remover.</small>';
        const actions = modal.querySelector('.modal-actions');
        modal.querySelector('.modal-box')?.insertBefore(box, actions || null);
        document.getElementById('cb-edit-image').addEventListener('change', async (event) => {
            try {
                editImageState = await compress(event.target.files?.[0]);
                document.getElementById('cb-edit-preview').innerHTML = '<img class="cb-image-preview" src="' + editImageState + '" alt="Prévia">';
            } catch (error) { event.target.value = ''; editImageState = undefined; alert(error.message); }
        });
        document.getElementById('cb-edit-clear').addEventListener('click', () => {
            editImageState = null;
            document.getElementById('cb-edit-image').value = '';
            document.getElementById('cb-edit-preview').innerHTML = '🍺';
        });
    }

    function renderWaiterWithImages(products) {
        const grid = document.getElementById('waiter-product-grid');
        if (!grid) return;
        if (!products.length) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center">Nenhum produto.</p>'; return; }
        grid.innerHTML = products.map((p) => {
            const out = p.stock <= 0;
            const low = p.stock > 0 && p.stock <= 5;
            let classes = 'grid-item' + (out ? ' out-of-stock' : low ? ' low-stock' : '');
            return '<div class="' + classes + ' cb-product-card" onclick="' + (out ? '' : 'addToCart(\\'' + p._id + '\\')') + '">' + productImage(p) + '<strong>' + escapeText(p.name) + '</strong><br><span>R$ ' + Number(p.price || 0).toFixed(2) + '</span><small>Estoque: ' + p.stock + '</small></div>';
        }).join('');
    }

    function renderAdminWithImages(products) {
        const list = document.getElementById('admin-product-list');
        if (!list) return;
        const total = products.reduce((acc,p) => acc + ((Number(p.price)||0)*(Number(p.stock)||0)), 0);
        let html = '<li style="background:var(--primary);color:white;justify-content:center;font-weight:bold;border-radius:6px;margin-bottom:10px">Valor em Estoque: R$ ' + total.toFixed(2) + '</li>';
        html += products.map(p => '<li><div style="display:flex;align-items:center;gap:10px">' + (imageFor(p) ? '<img class="cb-admin-product-image" src="' + imageFor(p) + '" alt="">' : '<div class="cb-admin-product-image" style="display:flex;align-items:center;justify-content:center;font-size:22px">🍺</div>') + '<div><strong>' + escapeText(p.name) + '</strong> ' + (p.isWholesale ? '<span class="badge-atacado">ATACADO</span>' : '') + '<br><small>Estoque: ' + p.stock + '</small></div></div><div style="display:flex;gap:5px;align-items:center"><span>R$ ' + Number(p.price||0).toFixed(2) + '</span><button class="btn-pay" style="margin:0;padding:4px 8px;font-size:12px;background:var(--primary)" onclick="openEditProdModal(\\'' + p._id + '\\')">✏️</button><button class="btn-danger" style="margin:0;padding:4px 8px" onclick="deleteProduct(\\'' + p._id + '\\')">X</button></div></li>').join('');
        list.innerHTML = html;
    }

    function saveImageForProduct(product, image) {
        const images = readImages();
        const key = product?._id || ('name:' + String(product?.name || '').toLowerCase());
        if (image === null || image === '') delete images[key];
        else if (image) images[key] = image;
        writeImages(images);
    }

    function patchFunctions() {
        if (typeof window.renderWaiterGrid === 'function' && !window.renderWaiterGrid.__cbWrapped) {
            const original = window.renderWaiterGrid;
            const wrapped = function(products) { return renderWaiterWithImages(products); };
            wrapped.__cbWrapped = true;
            window.renderWaiterGrid = wrapped;
        }
        if (typeof window.renderAdminProducts === 'function' && !window.renderAdminProducts.__cbWrapped) {
            const original = window.renderAdminProducts;
            const wrapped = function(products) { return renderAdminWithImages(products); };
            wrapped.__cbWrapped = true;
            window.renderAdminProducts = wrapped;
        }
        if (typeof window.addProduct === 'function' && !window.addProduct.__cbWrapped) {
            const original = window.addProduct;
            const wrapped = async function() {
                const box = document.getElementById('cb-new-image-box');
                const image = box?.dataset.image || '';
                const name = document.getElementById('prod-name')?.value?.trim();
                const price = Number(document.getElementById('prod-price')?.value || 0);
                await original();
                if (image && name) {
                    try {
                        const products = await (await fetch('/api/products')).json();
                        const product = [...products].reverse().find(p => p.name === name && Number(p.price) === price) || [...products].reverse().find(p => p.name === name);
                        if (product) saveImageForProduct(product, image);
                    } catch (_) {}
                }
                if (box) { delete box.dataset.image; const input=document.getElementById('cb-new-image'); if(input) input.value=''; const preview=document.getElementById('cb-new-preview'); if(preview) preview.innerHTML='🍺'; }
            };
            wrapped.__cbWrapped = true;
            window.addProduct = wrapped;
        }
        if (typeof window.openEditProdModal === 'function' && !window.openEditProdModal.__cbWrapped) {
            const original = window.openEditProdModal;
            const wrapped = function(id) {
                editImageState = undefined;
                original(id);
                const p = (window.allProducts || []).find(x => x._id === id);
                const src = p ? imageFor(p) : '';
                const preview = document.getElementById('cb-edit-preview');
                if (preview) preview.innerHTML = src ? '<img class="cb-image-preview" src="' + src + '" alt="Foto atual">' : '🍺';
            };
            wrapped.__cbWrapped = true;
            window.openEditProdModal = wrapped;
        }
        if (typeof window.saveEditProduct === 'function' && !window.saveEditProduct.__cbWrapped) {
            const original = window.saveEditProduct;
            const wrapped = async function() {
                const id = document.getElementById('edit-prod-id')?.value;
                await original();
                if (id && editImageState !== undefined) {
                    const p = (window.allProducts || []).find(x => x._id === id) || { _id: id };
                    saveImageForProduct(p, editImageState);
                }
                editImageState = undefined;
            };
            wrapped.__cbWrapped = true;
            window.saveEditProduct = wrapped;
        }
    }

    function init() {
        ensureStyles();
        setupNewProductImage();
        setupEditProductImage();
        patchFunctions();
    }

    window.addEventListener('load', () => {
        init();
        setTimeout(init, 500);
        setTimeout(init, 1500);
    });
    const observer = new MutationObserver(() => { if (!window.__cbImageMutationBusy) { window.__cbImageMutationBusy = true; setTimeout(() => { init(); window.__cbImageMutationBusy = false; }, 50); } });
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
`;
        return new Response(source + '\n' + enhancement, { status: response.status, statusText: response.statusText, headers: response.headers });
    })());
});