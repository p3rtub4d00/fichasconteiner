const API_URL = '/api';

let allProducts = [];
let allCategories = [];
let cart = []; // Estado do Carrinho de Compras
let pixInterval = null; // Controlador do loop do PIX

// ================= STARTUP E LOGIN =================
window.onload = () => {
    const savedRole = localStorage.getItem('userRole');
    if (savedRole === 'admin') { switchView('admin-view'); loadAdminData(); } 
    else if (savedRole === 'garcom') { switchView('waiter-view'); loadWaiterData(); }
};

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function login() {
    const pin = document.getElementById('pin-input').value;
    if (pin === 'admin123') { localStorage.setItem('userRole', 'admin'); switchView('admin-view'); loadAdminData(); } 
    else if (pin === 'garcom123') { localStorage.setItem('userRole', 'garcom'); switchView('waiter-view'); loadWaiterData(); } 
    else { alert('Senha incorreta!'); }
    document.getElementById('pin-input').value = '';
}
function logout() { localStorage.removeItem('userRole'); switchView('login-view'); }

// ================= ADMIN =================
async function loadAdminData() { await fetchCategories(); await fetchProducts('admin'); await fetchHistory(); }

async function fetchCategories() {
    const res = await fetch(`${API_URL}/categories`);
    allCategories = await res.json();
    document.getElementById('admin-category-list').innerHTML = allCategories.map(c => `<li><span>${c.name}</span> <button class="btn-danger" onclick="deleteCategory('${c._id}')">X</button></li>`).join('');
    document.getElementById('prod-category').innerHTML = `<option value="">Categoria</option>` + allCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}
async function addCategory() {
    const name = document.getElementById('cat-name').value;
    if (name) { await fetch(`${API_URL}/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); document.getElementById('cat-name').value = ''; loadAdminData(); }
}
async function deleteCategory(id) { if(confirm('Excluir?')) { await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' }); loadAdminData(); } }

async function addProduct() {
    const name = document.getElementById('prod-name').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const category = document.getElementById('prod-category').value;
    if (!name || !price || !category) return alert('Preencha os campos obrigatórios!');
    await fetch(`${API_URL}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, category, stock }) });
    document.getElementById('prod-name').value = ''; document.getElementById('prod-price').value = ''; document.getElementById('prod-stock').value = ''; loadAdminData();
}
async function deleteProduct(id) { if(confirm('Excluir produto?')) { await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' }); loadAdminData(); } }

async function fetchHistory() {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const res = await fetch(`${API_URL}/orders?start=${start.toISOString()}&end=${end.toISOString()}`);
    const orders = await res.json();
    
    let totalRev = 0;
    let listHTML = '';
    
    orders.forEach(order => {
        totalRev += order.total;
        const hora = new Date(order.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        // Formata os itens do pedido
        const itemsStr = order.items ? order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ') : 'Venda antiga';
        
        listHTML += `<li>
            <div style="flex:1"><strong>${itemsStr}</strong> <br><small>${hora} - ${order.paymentMethod || 'Dinheiro'}</small></div>
            <span style="font-weight:bold; color:var(--success);">R$ ${order.total.toFixed(2)}</span>
        </li>`;
    });
    
    document.getElementById('admin-history-list').innerHTML = listHTML;
    document.getElementById('total-revenue').innerText = `R$ ${totalRev.toFixed(2)}`;
}
async function clearRevenue() {
    if(confirm('Zerar faturamento de HOJE?')) {
        const start = new Date(); start.setHours(0,0,0,0); const end = new Date(); end.setHours(23,59,59,999);
        await fetch(`${API_URL}/orders?start=${start.toISOString()}&end=${end.toISOString()}`, { method: 'DELETE' }); loadAdminData();
    }
}

// ================= GARÇOM E CARRINHO =================
async function loadWaiterData() {
    const resCat = await fetch(`${API_URL}/categories`);
    allCategories = await resCat.json();
    document.getElementById('category-tabs').innerHTML = `<button class="tab active" onclick="filterProducts('Todas', this)">Todas</button>` + 
        allCategories.map(c => `<button class="tab" onclick="filterProducts('${c.name}', this)">${c.name}</button>`).join('');
    await fetchProducts('waiter');
    updateCartUI();
}

async function fetchProducts(role) {
    const res = await fetch(`${API_URL}/products`);
    allProducts = await res.json();
    if (role === 'admin') {
        document.getElementById('admin-product-list').innerHTML = allProducts.map(p => `
            <li><div><strong>${p.name}</strong> <small>Estoque: ${p.stock}</small></div><div>R$ ${p.price.toFixed(2)} <button class="btn-danger" onclick="deleteProduct('${p._id}')">X</button></div></li>
        `).join('');
    } else { renderWaiterGrid(allProducts); }
}

function renderWaiterGrid(products) {
    document.getElementById('waiter-product-grid').innerHTML = products.map(p => {
        const isOutOfStock = p.stock <= 0;
        return `<div class="grid-item ${isOutOfStock ? 'out-of-stock' : ''}" onclick="${isOutOfStock ? '' : `addToCart('${p._id}')`}">
            <strong>${p.name}</strong><br><span>R$ ${p.price.toFixed(2)}</span>
            <small>Estoque: ${p.stock}</small>
        </div>`;
    }).join('');
}
function filterProducts(cat, btn) { document.querySelectorAll('.tab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderWaiterGrid(cat === 'Todas' ? allProducts : allProducts.filter(p => p.category === cat)); }
function searchProducts() { const termo = document.getElementById('search-input').value.toLowerCase(); renderWaiterGrid(allProducts.filter(p => p.name.toLowerCase().includes(termo))); }

// LÓGICA DO CARRINHO
function addToCart(productId) {
    const product = allProducts.find(p => p._id === productId);
    const existing = cart.find(item => item.id === productId);
    
    // Verifica limite de estoque na hora de adicionar ao carrinho
    const currentQtd = existing ? existing.quantity : 0;
    if (currentQtd + 1 > product.stock) {
        return alert(`Estoque insuficiente! Restam apenas ${product.stock} unidades.`);
    }

    if (existing) { existing.quantity++; } 
    else { cart.push({ id: product._id, productName: product.name, price: product.price, quantity: 1 }); }
    updateCartUI();
}

function changeCartQtd(productId, amount) {
    const item = cart.find(i => i.id === productId);
    const product = allProducts.find(p => p._id === productId);
    
    if (item.quantity + amount > product.stock) return alert('Estoque limite atingido!');
    
    item.quantity += amount;
    if (item.quantity <= 0) cart = cart.filter(i => i.id !== productId);
    updateCartUI();
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const floatingBtn = document.getElementById('cart-floating-btn');
    if (totalItems > 0) {
        floatingBtn.classList.add('active');
        document.getElementById('cart-count').innerText = `${totalItems} itens`;
        document.getElementById('cart-total').innerText = `R$ ${totalPrice.toFixed(2)}`;
    } else {
        floatingBtn.classList.remove('active');
        closeCartModal();
    }

    // Atualiza Modal do Carrinho
    document.getElementById('cart-items-list').innerHTML = cart.map(item => `
        <li>
            <div>${item.productName}<br><small>R$ ${item.price.toFixed(2)}</small></div>
            <div class="cart-item-controls">
                <button onclick="changeCartQtd('${item.id}', -1)">-</button>
                <span>${item.quantity}</span>
                <button onclick="changeCartQtd('${item.id}', 1)">+</button>
            </div>
        </li>
    `).join('');
    document.getElementById('checkout-total').innerText = `R$ ${totalPrice.toFixed(2)}`;
}

function openCartModal() { document.getElementById('cart-modal').classList.add('active'); }
function closeCartModal() { document.getElementById('cart-modal').classList.remove('active'); }

// ================= CHECKOUT E PIX =================
async function processCheckout(method) {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (method === 'Pix') {
        closeCartModal();
        document.getElementById('pix-modal').classList.add('active');
        document.getElementById('pix-qr-container').innerHTML = '<p>Gerando PIX...</p>';
        document.getElementById('pix-status-text').innerText = 'Aguardando Pagamento... ⏳';
        
        try {
            // 1. Solicita PIX ao Back-End
            const res = await fetch(`${API_URL}/pix`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total })
            });
            const pixData = await res.json();
            
            // 2. Exibe QR Code (Base64)
            document.getElementById('pix-qr-container').innerHTML = `<img src="data:image/jpeg;base64,${pixData.qr_code_base64}" style="width: 100%; max-width: 250px; border-radius: 8px;">`;
            
            // 3. Inicia o loop para checar o status de 3 em 3 segundos
            pixInterval = setInterval(async () => {
                const check = await fetch(`${API_URL}/pix/${pixData.id}`);
                const statusData = await check.json();
                
                if (statusData.status === 'approved') {
                    clearInterval(pixInterval);
                    document.getElementById('pix-status-text').innerText = '✅ PAGO COM SUCESSO!';
                    document.getElementById('pix-status-text').style.color = 'var(--success)';
                    
                    // Conclui pedido
                    setTimeout(() => finalizeOrder('Pix'), 1500);
                }
            }, 3000);

        } catch (e) {
            alert('Erro ao conectar com Mercado Pago.');
            cancelPix();
        }
    } else {
        // Dinheiro ou Cartão
        finalizeOrder(method);
    }
}

function cancelPix() {
    clearInterval(pixInterval);
    document.getElementById('pix-modal').classList.remove('active');
    openCartModal(); // Volta pro carrinho
}

// ================= FINALIZAR E IMPRIMIR =================
function generateUniqueId() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

async function finalizeOrder(paymentMethod) {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // 1. Salvar no Banco (Isso já vai abater o estoque automaticamente no back-end)
    await fetch(`${API_URL}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, total: total, paymentMethod: paymentMethod, waiter: 'Garçom' })
    });

    // 2. Gerar HTML de Impressão (Múltiplas Fichas para todos os itens)
    let printHTML = '';
    const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    
    cart.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
            printHTML += `
                <div class="ticket">
                    <h3>Conteiner Beer</h3>
                    <p>--- FICHA INDIVIDUAL ---</p>
                    <h2>${item.productName}</h2>
                    <h1>R$ ${item.price.toFixed(2)}</h1>
                    <p>CÓDIGO DE AUTENTICAÇÃO:</p>
                    <div class="ticket-id">${generateUniqueId()}</div>
                    <p>${dateStr}</p>
                </div>`;
        }
    });

    document.getElementById('print-area').innerHTML = printHTML;
    
    // 3. Limpar Tudo e Imprimir
    cart = [];
    updateCartUI();
    document.getElementById('pix-modal').classList.remove('active');
    closeCartModal();
    
    // Atualiza a tela de fundo para refletir o novo estoque
    fetchProducts('waiter');

    setTimeout(() => { window.print(); }, 200);
}