const API_URL = '/api';

let allProducts = [];
let allCategories = [];
let cart = []; 
let pixInterval = null; 
let currentDayOrders = []; // Armazena os pedidos da data atual para impressão do relatório

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
    const ticketCount = parseInt(document.getElementById('prod-tickets').value) || 1; 
    const category = document.getElementById('prod-category').value;
    
    if (!name || !price || !category) return alert('Preencha os campos obrigatórios!');
    await fetch(`${API_URL}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, category, stock, ticketCount }) });
    
    document.getElementById('prod-name').value = ''; document.getElementById('prod-price').value = ''; 
    document.getElementById('prod-stock').value = ''; document.getElementById('prod-tickets').value = '1'; 
    loadAdminData();
}

// === FUNÇÕES DE EDIÇÃO DE PRODUTO ===
function openEditProdModal(id) {
    const p = allProducts.find(x => x._id === id);
    if (!p) return;
    
    document.getElementById('edit-prod-id').value = p._id;
    document.getElementById('edit-prod-name').value = p.name;
    document.getElementById('edit-prod-price').value = p.price;
    document.getElementById('edit-prod-stock').value = p.stock;
    document.getElementById('edit-prod-tickets').value = p.ticketCount || 1;
    
    document.getElementById('edit-prod-category').innerHTML = `<option value="">Categoria</option>` + 
        allCategories.map(c => `<option value="${c.name}" ${p.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('');
    
    document.getElementById('edit-prod-modal').classList.add('active');
}

function closeEditProdModal() { document.getElementById('edit-prod-modal').classList.remove('active'); }

async function saveEditProduct() {
    const id = document.getElementById('edit-prod-id').value;
    const name = document.getElementById('edit-prod-name').value;
    const price = parseFloat(document.getElementById('edit-prod-price').value);
    const stock = parseInt(document.getElementById('edit-prod-stock').value) || 0;
    const ticketCount = parseInt(document.getElementById('edit-prod-tickets').value) || 1;
    const category = document.getElementById('edit-prod-category').value;
    
    if (!name || !price || !category) return alert('Preencha nome, preço e categoria!');
    
    await fetch(`${API_URL}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price, stock, category, ticketCount })
    });
    
    closeEditProdModal();
    loadAdminData();
}

async function deleteProduct(id) { if(confirm('Excluir produto?')) { await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' }); loadAdminData(); } }

// === SISTEMA DE HISTÓRICO COM ITENS EM LISTA VERTICAL ===
async function fetchHistory() {
    const dateInput = document.getElementById('history-date');
    let start = new Date();
    let end = new Date();

    if (dateInput.value) {
        const [year, month, day] = dateInput.value.split('-');
        start = new Date(year, month - 1, day, 0, 0, 0);
        end = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        const tzOffset = start.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(start - tzOffset)).toISOString().slice(0, 10);
        dateInput.value = localISOTime;
    }

    const res = await fetch(`${API_URL}/orders?start=${start.toISOString()}&end=${end.toISOString()}`);
    currentDayOrders = await res.json(); // Salva na variável global para impressão
    
    let totalRev = 0;
    let listHTML = '';
    
    currentDayOrders.forEach(order => {
        totalRev += order.total;
        const dataVenda = new Date(order.date);
        const hora = dataVenda.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        const dataFormatada = dataVenda.toLocaleDateString('pt-BR');
        
        let itemsHTML = '';
        if (order.items && order.items.length > 0) {
            itemsHTML = order.items.map(i => `<div style="margin-bottom: 2px;">• ${i.quantity}x ${i.productName}</div>`).join('');
        } else {
            itemsHTML = '<div>Venda antiga</div>';
        }
        
        listHTML += `<li style="flex-direction: column; align-items: flex-start; gap: 8px;">
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; flex-direction: column; font-size: 14px; color: var(--text-main);">
                    ${itemsHTML}
                </div>
                <span style="font-weight:bold; color:var(--success); font-size: 16px; white-space: nowrap; margin-left: 10px;">R$ ${order.total.toFixed(2)}</span>
            </div>
            <div style="width: 100%; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">
                <small style="color: var(--text-muted);">${dataFormatada} às ${hora} - Pagamento: <strong>${order.paymentMethod || 'Dinheiro'}</strong></small>
            </div>
        </li>`;
    });
    
    document.getElementById('admin-history-list').innerHTML = listHTML;
    document.getElementById('total-revenue').innerText = `R$ ${totalRev.toFixed(2)}`;
}

// === IMPRESSÃO DO RELATÓRIO DE FECHAMENTO ===
function printDailyReport() {
    if (!currentDayOrders || currentDayOrders.length === 0) {
        return alert('Não há vendas registradas na data selecionada para imprimir!');
    }

    const dateInputVal = document.getElementById('history-date').value;
    const [y, m, d] = dateInputVal.split('-');
    const dateFormatted = `${d}/${m}/${y}`;

    let totalRev = 0;
    let reportHTML = `
        <div class="ticket" style="text-align: left; font-family: monospace; font-size: 12px; width: 58mm; padding: 5px; color: black; background: white;">
            <div style="text-align: center;">
                <h3 style="font-size: 14px; margin-bottom: 2px;">Conteiner Beer</h3>
                <p style="font-size: 11px; margin: 0;">--- FECHAMENTO DE CAIXA ---</p>
                <p style="font-size: 11px; margin: 2px 0 8px 0;">Data: ${dateFormatted}</p>
            </div>
            <div style="border-bottom: 1px dashed #000; margin-bottom: 8px;"></div>
    `;

    currentDayOrders.forEach((order, index) => {
        totalRev += order.total;
        const hora = new Date(order.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        
        reportHTML += `<div style="margin-bottom: 6px; font-size: 11px;">`;
        reportHTML += `<strong>#${index + 1} (${hora}) - ${order.paymentMethod || 'Dinheiro'}</strong><br>`;
        
        if (order.items) {
            order.items.forEach(i => {
                reportHTML += `&nbsp;&nbsp;• ${i.quantity}x ${i.productName} (R$ ${(i.price * i.quantity).toFixed(2)})<br>`;
            });
        }
        reportHTML += `<div style="text-align: right; font-weight: bold;">Subtotal: R$ ${order.total.toFixed(2)}</div>`;
        reportHTML += `</div><div style="border-bottom: 1px dotted #666; margin: 4px 0;"></div>`;
    });

    reportHTML += `
            <div style="text-align: center; margin-top: 12px;">
                <h2 style="font-size: 16px; margin: 4px 0;">TOTAL: R$ ${totalRev.toFixed(2)}</h2>
                <p style="font-size: 10px; margin: 4px 0;">--------------------------------</p>
                <p style="font-size: 10px; margin: 0;">Fim do Relatório Diário</p>
            </div>
        </div>
    `;

    document.getElementById('print-area').innerHTML = reportHTML;
    setTimeout(() => { window.print(); }, 200);
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
            <li>
                <div><strong>${p.name}</strong> <small>Estoque: ${p.stock} | Fichas: ${p.ticketCount || 1}</small></div>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <span style="margin-right: 10px;">R$ ${p.price.toFixed(2)}</span>
                    <button style="background: #3b82f6; width: auto; padding: 6px 12px; margin: 0; font-size: 14px;" onclick="openEditProdModal('${p._id}')">✏️ Editar</button>
                    <button class="btn-danger" style="width: auto; padding: 6px 12px; margin: 0;" onclick="deleteProduct('${p._id}')">X</button>
                </div>
            </li>
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
    
    const currentQtd = existing ? existing.quantity : 0;
    if (currentQtd + 1 > product.stock) {
        return alert(`Estoque insuficiente! Restam apenas ${product.stock} unidades de ${product.name}.`);
    }

    if (existing) { existing.quantity++; } 
    else { cart.push({ id: product._id, productName: product.name, price: product.price, quantity: 1, ticketCount: product.ticketCount || 1 }); }
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
            const res = await fetch(`${API_URL}/pix`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total })
            });
            const pixData = await res.json();
            
            document.getElementById('pix-qr-container').innerHTML = `<img src="data:image/jpeg;base64,${pixData.qr_code_base64}" style="width: 100%; max-width: 250px; border-radius: 8px;">`;
            
            pixInterval = setInterval(async () => {
                const check = await fetch(`${API_URL}/pix/${pixData.id}`);
                const statusData = await check.json();
                
                if (statusData.status === 'approved') {
                    clearInterval(pixInterval);
                    document.getElementById('pix-status-text').innerText = '✅ PAGO COM SUCESSO!';
                    document.getElementById('pix-status-text').style.color = 'var(--success)';
                    
                    setTimeout(() => finalizeOrder('Pix'), 1500);
                }
            }, 3000);

        } catch (e) {
            alert('Erro ao conectar com Mercado Pago.');
            cancelPix();
        }
    } else {
        finalizeOrder(method);
    }
}

function cancelPix() {
    clearInterval(pixInterval);
    document.getElementById('pix-modal').classList.remove('active');
    openCartModal(); 
}

// ================= FINALIZAR E IMPRIMIR =================
function generateUniqueId() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

async function finalizeOrder(paymentMethod) {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    await fetch(`${API_URL}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, total: total, paymentMethod: paymentMethod, waiter: 'Garçom' })
    });

    let printHTML = '';
    const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    
    cart.forEach(item => {
        const tCount = item.ticketCount || 1; 
        
        for (let i = 0; i < item.quantity; i++) { 
            if (tCount === 1) {
                printHTML += gerarFichaHtml(item.productName, item.price, dateStr, "");
            } else {
                for (let f = 1; f <= tCount; f++) {
                    const tarja = `<div style="background-color: black; color: white; margin: 10px 0; padding: 5px; border-radius: 4px; font-size: 16px;">FRACÃO ${f}/${tCount}</div>`;
                    printHTML += gerarFichaHtml(item.productName, item.price, dateStr, tarja);
                }
            }
        }
    });

    document.getElementById('print-area').innerHTML = printHTML;
    
    pathCartReset();
    
    fetchProducts('waiter');

    setTimeout(() => { window.print(); }, 200);
}

function pathCartReset() {
    cart = [];
    updateCartUI();
    document.getElementById('pix-modal').classList.remove('active');
    closeCartModal();
}

function gerarFichaHtml(nome, preco, data, extraHtml) {
    return `
        <div class="ticket">
            <h3>Conteiner Beer</h3>
            <p>--- FICHA INDIVIDUAL ---</p>
            <h2>${nome}</h2>
            ${extraHtml}
            <h1>R$ ${preco.toFixed(2)}</h1>
            <p>CÓDIGO DE AUTENTICAÇÃO:</p>
            <div class="ticket-id">${generateUniqueId()}</div>
            <p>${data}</p>
        </div>`;
}
