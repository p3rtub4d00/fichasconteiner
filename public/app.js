const API_URL = '/api';

let allProducts = [];
let allCategories = [];
let cart = []; 
let pixInterval = null; 
let currentDayOrders = []; 

// Comandas e Filtros
let allTables = [];
let activeTableId = null; // ID da mesa recebendo itens
let currentTableData = null; // Mesa sendo fechada
let salesMode = 'retail'; 
let currentCategory = 'Todas';

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

// ================= UTILIDADES VISUAIS (TOAST) =================
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 2000);
}

// Lida com o clique no botão flutuante (Carrinho vs. Comanda)
function handleFloatingClick() {
    if (activeTableId) {
        openTableManageModal(activeTableId);
    } else {
        openCartModal();
    }
}

// ================= ADMIN =================
async function loadAdminData() { await fetchCategories(); await fetchProducts('admin'); await fetchHistory(); await fetchTablesAdmin(); }

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

async function fetchTablesAdmin() {
    const res = await fetch(`${API_URL}/tables`);
    allTables = await res.json();
    document.getElementById('admin-table-list').innerHTML = allTables.map(t => `<li><span>${t.name}</span> <button class="btn-danger" onclick="deleteTable('${t._id}')">X</button></li>`).join('');
}
async function addTable() {
    const name = document.getElementById('table-name').value;
    if (name) { await fetch(`${API_URL}/tables`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); document.getElementById('table-name').value = ''; fetchTablesAdmin(); }
}
async function deleteTable(id) { if(confirm('Excluir mesa?')) { await fetch(`${API_URL}/tables/${id}`, { method: 'DELETE' }); fetchTablesAdmin(); } }

async function addProduct() {
    const name = document.getElementById('prod-name').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const ticketCount = parseInt(document.getElementById('prod-tickets').value) || 1; 
    const category = document.getElementById('prod-category').value;
    const isWholesale = document.getElementById('prod-wholesale').checked;
    
    if (!name || !price || !category) return alert('Preencha os campos obrigatórios!');
    await fetch(`${API_URL}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, category, stock, ticketCount, isWholesale }) });
    document.getElementById('prod-name').value = ''; document.getElementById('prod-price').value = ''; 
    document.getElementById('prod-stock').value = ''; document.getElementById('prod-tickets').value = '1'; document.getElementById('prod-wholesale').checked = false;
    loadAdminData();
}

function openEditProdModal(id) {
    const p = allProducts.find(x => x._id === id);
    if (!p) return;
    document.getElementById('edit-prod-id').value = p._id; document.getElementById('edit-prod-name').value = p.name;
    document.getElementById('edit-prod-price').value = p.price; document.getElementById('edit-prod-stock').value = p.stock;
    document.getElementById('edit-prod-tickets').value = p.ticketCount || 1; document.getElementById('edit-prod-wholesale').checked = p.isWholesale || false;
    document.getElementById('edit-prod-category').innerHTML = `<option value="">Categoria</option>` + allCategories.map(c => `<option value="${c.name}" ${p.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('');
    document.getElementById('edit-prod-modal').classList.add('active');
}
function closeEditProdModal() { document.getElementById('edit-prod-modal').classList.remove('active'); }

async function saveEditProduct() {
    const id = document.getElementById('edit-prod-id').value; const name = document.getElementById('edit-prod-name').value;
    const price = parseFloat(document.getElementById('edit-prod-price').value); const stock = parseInt(document.getElementById('edit-prod-stock').value) || 0;
    const ticketCount = parseInt(document.getElementById('edit-prod-tickets').value) || 1; const category = document.getElementById('edit-prod-category').value;
    const isWholesale = document.getElementById('edit-prod-wholesale').checked;
    if (!name || !price || !category) return alert('Preencha nome, preço e categoria!');
    await fetch(`${API_URL}/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, stock, category, ticketCount, isWholesale }) });
    closeEditProdModal(); loadAdminData();
}
async function deleteProduct(id) { if(confirm('Excluir produto?')) { await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' }); loadAdminData(); } }

async function fetchHistory() {
    const dateInput = document.getElementById('history-date');
    let start = new Date(); let end = new Date();
    if (dateInput.value) {
        const [year, month, day] = dateInput.value.split('-');
        start = new Date(year, month - 1, day, 0, 0, 0); end = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else {
        start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
        const tzOffset = start.getTimezoneOffset() * 60000;
        dateInput.value = (new Date(start - tzOffset)).toISOString().slice(0, 10);
    }
    const res = await fetch(`${API_URL}/orders?start=${start.toISOString()}&end=${end.toISOString()}`);
    currentDayOrders = await res.json();
    let totalRev = 0; let listHTML = '';
    currentDayOrders.forEach(order => {
        totalRev += order.total;
        const dataVenda = new Date(order.date);
        const hora = dataVenda.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        let itemsHTML = order.items && order.items.length > 0 ? order.items.map(i => `<div style="margin-bottom: 2px;">• ${i.quantity}x ${i.productName}</div>`).join('') : '<div>Venda antiga</div>';
        listHTML += `<li style="flex-direction: column; align-items: flex-start; gap: 8px;">
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; flex-direction: column; font-size: 14px; color: var(--text-main);">${itemsHTML}</div>
                <span style="font-weight:bold; color:var(--success); font-size: 16px; white-space: nowrap; margin-left: 10px;">R$ ${order.total.toFixed(2)}</span>
            </div>
            <div style="width: 100%; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">
                <small style="color: var(--text-muted);">${dataVenda.toLocaleDateString('pt-BR')} às ${hora} - Pagamento: <strong>${order.paymentMethod || 'Dinheiro'}</strong></small>
            </div>
        </li>`;
    });
    document.getElementById('admin-history-list').innerHTML = listHTML; document.getElementById('total-revenue').innerText = `R$ ${totalRev.toFixed(2)}`;
}

function printDailyReport() {
    if (!currentDayOrders || currentDayOrders.length === 0) return alert('Não há vendas registradas!');
    const [y, m, d] = document.getElementById('history-date').value.split('-');
    let totalRev = 0;
    let reportHTML = `<div class="ticket" style="text-align: left; font-family: monospace; font-size: 11px; width: 58mm; padding: 5px; color: black; background: white;"><div style="text-align: center;"><h3 style="font-size: 13px; margin-bottom: 2px;">Conteiner Beer</h3><p style="font-size: 10px; margin: 0;">--- FECHAMENTO CAIXA ---</p><p style="font-size: 10px; margin: 2px 0 6px 0;">Data: ${d}/${m}/${y}</p></div><div style="border-bottom: 1px dashed #000; margin-bottom: 6px;"></div>`;
    currentDayOrders.forEach((order, index) => {
        totalRev += order.total;
        const hora = new Date(order.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        reportHTML += `<div style="margin-bottom: 5px;"><strong>#${index + 1} (${hora}) - ${order.paymentMethod || 'Dinheiro'}</strong><br>`;
        if (order.items) order.items.forEach(i => { reportHTML += `&nbsp;• ${i.quantity}x ${i.productName} (R$ ${(i.price * i.quantity).toFixed(2)})<br>`; });
        reportHTML += `<div style="text-align: right; font-weight: bold;">Subtotal: R$ ${order.total.toFixed(2)}</div></div><div style="border-bottom: 1px dotted #666; margin: 3px 0;"></div>`;
    });
    reportHTML += `<div style="text-align: center; margin-top: 10px;"><h2 style="font-size: 15px; margin: 4px 0;">TOTAL: R$ ${totalRev.toFixed(2)}</h2><p style="font-size: 9px; margin: 4px 0;">--------------------------------</p></div></div>`;
    document.getElementById('print-area').innerHTML = reportHTML; setTimeout(() => { window.print(); }, 200);
}

// ================= GARÇOM: FLUXO PRINCIPAL =================
async function loadWaiterData() {
    const resCat = await fetch(`${API_URL}/categories`);
    allCategories = await resCat.json();
    document.getElementById('category-tabs').innerHTML = `<button class="tab active" onclick="filterProducts('Todas', this)">Todas</button>` + 
        allCategories.map(c => `<button class="tab" onclick="filterProducts('${c.name}', this)">${c.name}</button>`).join('');
    
    salesMode = 'retail'; currentCategory = 'Todas';
    document.getElementById('mode-retail').classList.add('active'); document.getElementById('mode-wholesale').classList.remove('active');
    document.getElementById('search-input').value = '';
    
    await fetchProducts('waiter');
    await fetchTablesWaiter();
    updateCartUI();
    switchWaiterTab('caixa');
}

async function fetchProducts(role) {
    const res = await fetch(`${API_URL}/products`);
    allProducts = await res.json();
    if (role === 'admin') {
        document.getElementById('admin-product-list').innerHTML = allProducts.map(p => {
            const badge = p.isWholesale ? '<span class="badge-atacado">ATACADO</span>' : '';
            return `<li><div><strong>${p.name}</strong> ${badge}<br><small>Estoque: ${p.stock} | Fichas: ${p.ticketCount || 1}</small></div>
            <div style="display: flex; gap: 5px; align-items: center;"><span style="margin-right: 10px;">R$ ${p.price.toFixed(2)}</span>
            <button style="background: #3b82f6; width: auto; padding: 6px 12px; margin: 0; font-size: 14px;" onclick="openEditProdModal('${p._id}')">✏️</button>
            <button class="btn-danger" style="width: auto; padding: 6px 12px; margin: 0;" onclick="deleteProduct('${p._id}')">X</button></div></li>`;
        }).join('');
    } else { applyWaiterFilters(); }
}

// ================= NAVEGAÇÃO GARÇOM (CAIXA vs MESAS) =================
function switchWaiterTab(tab) {
    document.getElementById('nav-caixa').classList.toggle('active', tab === 'caixa');
    document.getElementById('nav-mesas').classList.toggle('active', tab === 'mesas');
    
    if (tab === 'caixa') {
        document.getElementById('caixa-section').style.display = 'block';
        document.getElementById('mesas-section').style.display = 'none';
        
        // Se estivermos numa mesa, o botão fica azul. Se não, mostra carrinho (se não vazio)
        if (activeTableId) {
            document.getElementById('cart-floating-btn').style.display = 'flex';
        } else {
            document.getElementById('cart-floating-btn').style.display = cart.length > 0 ? 'flex' : 'none';
        }
    } else {
        document.getElementById('caixa-section').style.display = 'none';
        document.getElementById('mesas-section').style.display = 'block';
        document.getElementById('cart-floating-btn').style.display = 'none';
        closeTableMode(); 
        fetchTablesWaiter();
    }
}

// ================= GARÇOM: COMANDAS / MESAS =================
async function fetchTablesWaiter() {
    const res = await fetch(`${API_URL}/tables`);
    allTables = await res.json();
    document.getElementById('waiter-tables-grid').innerHTML = allTables.map(t => {
        const isLivre = t.status === 'livre';
        const total = t.items ? t.items.reduce((s, i) => s + (i.price * i.quantity), 0) : 0;
        return `<div class="table-item ${t.status}" onclick="openTableManageModal('${t._id}')">
            <strong>${t.name}</strong>
            <small>${isLivre ? 'LIVRE' : 'OCUPADA'}</small>
            ${!isLivre ? `<div style="margin-top:5px; font-size: 14px;">R$ ${total.toFixed(2)}</div>` : ''}
        </div>`;
    }).join('');
}

function openTableManageModal(tableId) {
    const table = allTables.find(t => t._id === tableId);
    currentTableData = table;
    document.getElementById('tm-title').innerText = table.name;
    
    let subtotal = 0; let html = '';
    table.items.forEach(item => {
        subtotal += item.price * item.quantity;
        html += `<li style="padding: 10px 5px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 15px;">${item.quantity}x ${item.productName}</span>
            <div style="display:flex; gap: 10px; align-items:center;">
                <span style="font-weight: bold;">R$ ${(item.price * item.quantity).toFixed(2)}</span>
                <button style="background:var(--danger); padding:4px 10px; border-radius: 4px; font-size: 14px;" onclick="removeTableItem('${table._id}', '${item.id}')">X</button>
            </div>
        </li>`;
    });
    
    document.getElementById('tm-items').innerHTML = html || '<p style="color:var(--text-muted); font-style:italic;">Mesa vazia no momento.</p>';
    document.getElementById('tm-subtotal').innerText = `Subtotal: R$ ${subtotal.toFixed(2)}`;
    
    // Controla quais botões aparecem dependendo se a mesa tá vazia
    const hasItems = table.items.length > 0;
    document.getElementById('tm-pay-btn').style.display = hasItems ? 'block' : 'none';
    document.getElementById('tm-print-btn').style.display = hasItems ? 'block' : 'none';
    
    document.getElementById('table-manage-modal').classList.add('active');
}

function closeTableManageModal() { document.getElementById('table-manage-modal').classList.remove('active'); }

async function removeTableItem(tableId, productId) {
    await fetch(`${API_URL}/tables/${tableId}/remove`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({productId}) });
    await fetchTablesWaiter();
    openTableManageModal(tableId);
}

// Inicia modo de adição rápida na mesa
function startTableMode() {
    activeTableId = currentTableData._id;
    closeTableManageModal();
    switchWaiterTab('caixa');
    document.getElementById('active-table-banner').style.display = 'flex';
    document.getElementById('banner-table-text').innerText = `Comanda: ${currentTableData.name}`;
    
    // Altera o botão flutuante para Azul (Modo Mesa)
    const floatingBtn = document.getElementById('cart-floating-btn');
    floatingBtn.classList.add('table-mode');
    floatingBtn.classList.add('active');
    floatingBtn.style.display = 'flex';
    document.getElementById('cart-action-text').innerText = 'Ver Comanda 📋';
    updateActiveTableFloatingBtn();
}

function closeTableMode() {
    activeTableId = null;
    document.getElementById('active-table-banner').style.display = 'none';
    
    // Restaura o botão flutuante para Verde (Modo Carrinho)
    const floatingBtn = document.getElementById('cart-floating-btn');
    floatingBtn.classList.remove('table-mode');
    document.getElementById('cart-action-text').innerText = 'Ver Carrinho 🛒';
    updateCartUI(); // Esconde se o carrinho de balcão estiver vazio
    
    switchWaiterTab('mesas');
}

function updateActiveTableFloatingBtn() {
    if (!activeTableId || !currentTableData) return;
    const totalItems = currentTableData.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = currentTableData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    document.getElementById('cart-count').innerText = `${totalItems} itens na mesa`;
    document.getElementById('cart-total').innerText = `R$ ${totalPrice.toFixed(2)}`;
}

// ================= IMPRIMIR PARCIAL DA MESA (NÃO FISCAL) =================
function printPartialTable() {
    if (!currentTableData || currentTableData.items.length === 0) return alert('Mesa vazia!');
    
    let subtotal = currentTableData.items.reduce((s, i) => s + (i.price * i.quantity), 0);
    const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    
    let printHTML = `
        <div class="ticket" style="text-align: left; font-family: monospace; font-size: 11px; width: 58mm; padding: 5px; color: black; background: white; margin-bottom: 0;">
            <div style="text-align: center;">
                <h3 style="font-size: 14px; margin-bottom: 2px;">Conteiner Beer</h3>
                <p style="font-size: 11px; margin: 0; font-weight:bold;">-- CONFERÊNCIA DE MESA --</p>
                <p style="font-size: 9px; margin: 2px 0 6px 0;">NÃO É DOCUMENTO FISCAL</p>
                <h2 style="font-size: 18px; margin: 4px 0;">${currentTableData.name}</h2>
            </div>
            <div style="border-bottom: 1px dashed #000; margin-bottom: 6px;"></div>
            
            <table style="width: 100%; font-size: 11px; margin-bottom: 5px; border-collapse: collapse;">
                <tr>
                    <th style="text-align:left; border-bottom: 1px solid #000; padding-bottom: 2px;">Qtd</th>
                    <th style="text-align:left; border-bottom: 1px solid #000; padding-bottom: 2px;">Produto</th>
                    <th style="text-align:right; border-bottom: 1px solid #000; padding-bottom: 2px;">Total</th>
                </tr>`;
    
    currentTableData.items.forEach(item => {
        printHTML += `
                <tr>
                    <td style="padding-top: 4px; vertical-align: top;">${item.quantity}x</td>
                    <td style="padding-top: 4px; vertical-align: top;">${item.productName}</td>
                    <td style="text-align:right; padding-top: 4px; vertical-align: top;">R$ ${(item.price * item.quantity).toFixed(2)}</td>
                </tr>`;
    });

    printHTML += `
            </table>
            <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
            
            <div style="text-align: right; font-size: 14px; font-weight: bold;">Subtotal: R$ ${subtotal.toFixed(2)}</div>
            <div style="text-align: right; font-size: 11px; color: #333; margin-top: 4px;">Serviço (10% opcional): R$ ${(subtotal*0.1).toFixed(2)}</div>
            
            <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
            <div style="font-size: 10px; text-align:center;">
                <p style="margin: 2px 0;">Impresso em: ${dateStr}</p>
            </div>
        </div>`;
    
    document.getElementById('print-area').innerHTML = printHTML;
    setTimeout(() => { window.print(); }, 200);
}

// ================= FECHAMENTO DE MESA (SPLIT + 10%) =================
function openTableCheckout() {
    closeTableManageModal();
    const table = currentTableData;
    document.getElementById('tc-title').innerText = table.name;
    document.getElementById('tc-split').value = 1;
    document.getElementById('tc-tax').checked = true;
    updateTableTotal();
    document.getElementById('table-checkout-modal').classList.add('active');
}

function closeTableCheckoutModal() { document.getElementById('table-checkout-modal').classList.remove('active'); }

function updateTableTotal() {
    const subtotal = currentTableData.items.reduce((s, i) => s + (i.price * i.quantity), 0);
    const includeTax = document.getElementById('tc-tax').checked;
    const taxVal = includeTax ? subtotal * 0.10 : 0;
    const total = subtotal + taxVal;
    
    let splitCount = parseInt(document.getElementById('tc-split').value) || 1;
    if (splitCount < 1) { splitCount = 1; document.getElementById('tc-split').value = 1; }
    const perPerson = total / splitCount;

    document.getElementById('tc-subtotal-text').innerText = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('tc-tax-text').innerHTML = `Serviço (10%): <span>R$ ${taxVal.toFixed(2)}</span>`;
    document.getElementById('tc-total').innerText = `Total: R$ ${total.toFixed(2)}`;
    
    const perPersonContainer = document.getElementById('tc-per-person-container');
    if (splitCount > 1) {
        perPersonContainer.style.display = 'block';
        document.getElementById('tc-per-person').innerText = `R$ ${perPerson.toFixed(2)}`;
    } else {
        perPersonContainer.style.display = 'none';
    }
}

async function processTableCheckout(method) {
    if (!currentTableData || currentTableData.items.length === 0) return;

    const subtotal = currentTableData.items.reduce((s, i) => s + (i.price * i.quantity), 0);
    const taxVal = document.getElementById('tc-tax').checked ? subtotal * 0.10 : 0;
    const total = subtotal + taxVal;
    const splitCount = parseInt(document.getElementById('tc-split').value) || 1;

    const finalData = {
        method: method, subtotal: subtotal, tax: taxVal, total: total, split: splitCount,
        perPerson: total / splitCount, items: currentTableData.items, tableName: currentTableData.name
    };

    if (method === 'Pix') {
        closeTableCheckoutModal();
        document.getElementById('pix-modal').classList.add('active');
        document.getElementById('pix-qr-container').innerHTML = '<p>Gerando PIX...</p>';
        document.getElementById('pix-status-text').innerText = 'Aguardando Pagamento... ⏳';
        try {
            const res = await fetch(`${API_URL}/pix`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total }) });
            const pixData = await res.json();
            document.getElementById('pix-qr-container').innerHTML = `<img src="data:image/jpeg;base64,${pixData.qr_code_base64}" style="width: 100%; max-width: 250px; border-radius: 8px;">`;
            
            pixInterval = setInterval(async () => {
                const check = await fetch(`${API_URL}/pix/${pixData.id}`);
                const statusData = await check.json();
                if (statusData.status === 'approved') {
                    clearInterval(pixInterval);
                    document.getElementById('pix-status-text').innerText = '✅ PAGO COM SUCESSO!';
                    document.getElementById('pix-status-text').style.color = 'var(--success)';
                    setTimeout(() => finalizeTableOrder(finalData), 1500);
                }
            }, 3000);
        } catch (e) { alert('Erro PIX'); cancelPix(); }
    } else {
        finalizeTableOrder(finalData);
    }
}

async function finalizeTableOrder(data) {
    await fetch(`${API_URL}/tables/${currentTableData._id}/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: data.method, total: data.total, items: data.items, waiter: 'Garçom' })
    });
    
    const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    let printHTML = `<div class="ticket" style="text-align: left; font-family: monospace; font-size: 12px; width: 58mm; padding: 5px; color: black; background: white; margin-bottom: 0;">
        <div style="text-align: center;"><h3 style="font-size: 14px; margin-bottom: 2px;">Conteiner Beer</h3><p style="font-size: 11px; margin: 0;">--- FECHAMENTO DE MESA ---</p><h2 style="font-size: 16px; margin: 4px 0;">${data.tableName}</h2></div>
        <div style="border-bottom: 1px dashed #000; margin-bottom: 6px;"></div><table style="width: 100%; font-size: 11px; margin-bottom: 5px; border-collapse: collapse;"><tr><th style="text-align:left; border-bottom: 1px solid #000; padding-bottom: 2px;">Qtd</th><th style="text-align:left; border-bottom: 1px solid #000; padding-bottom: 2px;">Produto</th><th style="text-align:right; border-bottom: 1px solid #000; padding-bottom: 2px;">Total</th></tr>`;
    data.items.forEach(item => { printHTML += `<tr><td style="padding-top: 4px;">${item.quantity}x</td><td style="padding-top: 4px;">${item.productName}</td><td style="text-align:right; padding-top: 4px;">R$ ${(item.price * item.quantity).toFixed(2)}</td></tr>`; });
    printHTML += `</table><div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div><div style="text-align: right; font-size: 12px;"><p style="margin: 2px 0;">Subtotal: R$ ${data.subtotal.toFixed(2)}</p>`;
    if (data.tax > 0) printHTML += `<p style="margin: 2px 0;">Taxa Serviço (10%): R$ ${data.tax.toFixed(2)}</p>`;
    printHTML += `<h2 style="margin: 6px 0 0 0; font-size: 15px;">TOTAL: R$ ${data.total.toFixed(2)}</h2></div><div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div><div style="font-size: 11px;"><p style="margin: 2px 0;">Pagamento: <strong>${data.method}</strong></p>`;
    if (data.split > 1) printHTML += `<p style="margin: 4px 0; font-weight: bold; color: #000;">Dividido p/ ${data.split} = R$ ${data.perPerson.toFixed(2)} por pessoa</p>`;
    printHTML += `<p style="margin: 2px 0;">Data: ${dateStr}</p><p style="margin: 2px 0;">ID: ${generateUniqueId()}</p></div><div style="text-align: center; margin-top: 10px; font-size: 10px;"><p>Obrigado pela preferência!</p></div></div>`;
    
    document.getElementById('print-area').innerHTML = printHTML;
    
    document.getElementById('pix-modal').classList.remove('active');
    closeTableCheckoutModal();
    currentTableData = null;
    await fetchProducts('waiter'); 
    await fetchTablesWaiter();
    switchWaiterTab('mesas'); 
    setTimeout(() => { window.print(); }, 200);
}

// ================= FILTROS E BUSCA =================
function setSalesMode(mode) {
    salesMode = mode;
    document.getElementById('mode-retail').classList.toggle('active', mode === 'retail');
    document.getElementById('mode-wholesale').classList.toggle('active', mode === 'wholesale');
    applyWaiterFilters();
}
function filterProducts(cat, btn) { 
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active')); 
    btn.classList.add('active'); currentCategory = cat; applyWaiterFilters();
}
function searchProducts() { applyWaiterFilters(); }
function applyWaiterFilters() {
    const termo = document.getElementById('search-input').value.toLowerCase();
    const filteredProducts = allProducts.filter(p => {
        const isAtacado = p.isWholesale || false;
        const matchMode = (salesMode === 'wholesale') ? isAtacado : !isAtacado;
        const matchCategory = (currentCategory === 'Todas') || (p.category === currentCategory);
        const matchSearch = p.name.toLowerCase().includes(termo);
        return matchMode && matchCategory && matchSearch;
    });
    renderWaiterGrid(filteredProducts);
}
function renderWaiterGrid(products) {
    if (products.length === 0) { document.getElementById('waiter-product-grid').innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Nenhum produto.</p>`; return; }
    document.getElementById('waiter-product-grid').innerHTML = products.map(p => {
        const isOutOfStock = p.stock <= 0;
        return `<div class="grid-item ${isOutOfStock ? 'out-of-stock' : ''}" onclick="${isOutOfStock ? '' : `addToCart('${p._id}')`}">
            <strong>${p.name}</strong><br><span>R$ ${p.price.toFixed(2)}</span><small>Estoque: ${p.stock}</small>
        </div>`;
    }).join('');
}

// ================= ADD ITEM (CAIXA vs MESA) =================
async function addToCart(productId) {
    const product = allProducts.find(p => p._id === productId);
    
    if (activeTableId) {
        // Feedback visual imediato na tela (Toast)
        showToast(`✅ ${product.name} adicionado à ${currentTableData.name}!`);
        
        const res = await fetch(`${API_URL}/tables/${activeTableId}/add`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product }) });
        currentTableData = await res.json();
        
        fetchTablesWaiter(); // Atualiza painel de mesas por trás
        updateActiveTableFloatingBtn(); // Atualiza barra azul
        return;
    }

    const existing = cart.find(item => item.id === productId);
    const currentQtd = existing ? existing.quantity : 0;
    if (currentQtd + 1 > product.stock) return alert(`Estoque insuficiente!`);
    if (existing) { existing.quantity++; } 
    else { cart.push({ id: product._id, productName: product.name, price: product.price, quantity: 1, ticketCount: product.ticketCount || 1, isWholesale: product.isWholesale || false }); }
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
    if (activeTableId) return; // Se estiver no modo mesa, não interfere com o UI do carrinho
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const floatingBtn = document.getElementById('cart-floating-btn');
    if (totalItems > 0) {
        floatingBtn.classList.add('active'); floatingBtn.style.display = 'flex';
        document.getElementById('cart-count').innerText = `${totalItems} itens`;
        document.getElementById('cart-total').innerText = `R$ ${totalPrice.toFixed(2)}`;
    } else {
        floatingBtn.classList.remove('active'); floatingBtn.style.display = 'none'; closeCartModal();
    }
    document.getElementById('cart-items-list').innerHTML = cart.map(item => `<li><div>${item.productName}<br><small>R$ ${item.price.toFixed(2)}</small></div><div class="cart-item-controls"><button onclick="changeCartQtd('${item.id}', -1)">-</button><span>${item.quantity}</span><button onclick="changeCartQtd('${item.id}', 1)">+</button></div></li>`).join('');
    document.getElementById('checkout-total').innerText = `R$ ${totalPrice.toFixed(2)}`;
}

function openCartModal() { document.getElementById('cart-modal').classList.add('active'); }
function closeCartModal() { document.getElementById('cart-modal').classList.remove('active'); }

// ================= CHECKOUT CAIXA RÁPIDO =================
async function processCheckout(method) {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (method === 'Pix') {
        closeCartModal(); document.getElementById('pix-modal').classList.add('active');
        document.getElementById('pix-qr-container').innerHTML = '<p>Gerando PIX...</p>';
        document.getElementById('pix-status-text').innerText = 'Aguardando Pagamento... ⏳';
        try {
            const res = await fetch(`${API_URL}/pix`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total }) });
            const pixData = await res.json();
            document.getElementById('pix-qr-container').innerHTML = `<img src="data:image/jpeg;base64,${pixData.qr_code_base64}" style="width: 100%; max-width: 250px; border-radius: 8px;">`;
            pixInterval = setInterval(async () => {
                const check = await fetch(`${API_URL}/pix/${pixData.id}`); const statusData = await check.json();
                if (statusData.status === 'approved') {
                    clearInterval(pixInterval);
                    document.getElementById('pix-status-text').innerText = '✅ PAGO COM SUCESSO!'; document.getElementById('pix-status-text').style.color = 'var(--success)';
                    setTimeout(() => finalizeOrder('Pix'), 1500);
                }
            }, 3000);
        } catch (e) { alert('Erro PIX'); cancelPix(); }
    } else { finalizeOrder(method); }
}

function cancelPix() { clearInterval(pixInterval); document.getElementById('pix-modal').classList.remove('active'); openCartModal(); }

function generateUniqueId() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

async function finalizeOrder(paymentMethod) {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart, total: total, paymentMethod: paymentMethod, waiter: 'Garçom' }) });
    let printHTML = ''; const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const retailItems = cart.filter(item => !item.isWholesale); const wholesaleItems = cart.filter(item => item.isWholesale);

    retailItems.forEach(item => {
        const tCount = item.ticketCount || 1; 
        for (let i = 0; i < item.quantity; i++) { 
            if (tCount === 1) { printHTML += gerarFichaHtml(item.productName, item.price, dateStr, ""); } else {
                for (let f = 1; f <= tCount; f++) { const tarja = `<div style="background-color: black; color: white; margin: 10px 0; padding: 5px; border-radius: 4px; font-size: 16px;">FRAÇÃO ${f}/${tCount}</div>`; printHTML += gerarFichaHtml(item.productName, item.price, dateStr, tarja); }
            }
        }
    });

    if (wholesaleItems.length > 0) {
        let cupomTotal = wholesaleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        printHTML += `<div class="ticket" style="text-align: left; font-family: monospace; font-size: 12px; width: 58mm; padding: 5px; color: black; background: white; margin-bottom: 0;"><div style="text-align: center;"><h3 style="font-size: 14px; margin-bottom: 2px;">Conteiner Beer</h3><p style="font-size: 11px; margin: 0;">--- CUPOM NÃO FISCAL ---</p><p style="font-size: 11px; margin: 2px 0 6px 0; font-weight: bold;">ATACADO</p></div><div style="border-bottom: 1px dashed #000; margin-bottom: 6px;"></div><table style="width: 100%; font-size: 11px; margin-bottom: 5px; border-collapse: collapse;"><tr><th style="text-align:left; border-bottom: 1px solid #000; padding-bottom: 2px;">Qtd</th><th style="text-align:left; border-bottom: 1px solid #000; padding-bottom: 2px;">Produto</th><th style="text-align:right; border-bottom: 1px solid #000; padding-bottom: 2px;">Total</th></tr>`;
        wholesaleItems.forEach(item => { printHTML += `<tr><td style="padding-top: 4px;">${item.quantity}x</td><td style="padding-top: 4px;">${item.productName}</td><td style="text-align:right; padding-top: 4px;">R$ ${(item.price * item.quantity).toFixed(2)}</td></tr>`; });
        printHTML += `</table><div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div><div style="text-align: right; font-size: 14px; font-weight: bold; margin-bottom: 6px;">TOTAL: R$ ${cupomTotal.toFixed(2)}</div><div style="font-size: 11px;"><p style="margin: 2px 0;">Pagamento: <strong>${paymentMethod}</strong></p><p style="margin: 2px 0;">Data: ${dateStr}</p><p style="margin: 2px 0;">ID: ${generateUniqueId()}</p></div><div style="text-align: center; margin-top: 10px; font-size: 10px;"><p>Obrigado pela preferência!</p></div></div>`;
    }
    document.getElementById('print-area').innerHTML = printHTML;
    cart = []; updateCartUI(); document.getElementById('pix-modal').classList.remove('active'); closeCartModal(); fetchProducts('waiter');
    setTimeout(() => { window.print(); }, 200);
}

function gerarFichaHtml(nome, preco, data, extraHtml) {
    return `<div class="ticket"><h3>Conteiner Beer</h3><p>--- FICHA INDIVIDUAL ---</p><h2>${nome}</h2>${extraHtml}<h1>R$ ${preco.toFixed(2)}</h1><p>CÓDIGO DE AUTENTICAÇÃO:</p><div class="ticket-id">${generateUniqueId()}</div><p>${data}</p></div>`;
}