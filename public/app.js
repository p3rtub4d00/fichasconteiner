const API_URL = '/api';

let allProducts = [];
let allCategories = [];
let cart = []; 
let pixInterval = null; 
let currentDayOrders = []; 
let allCustomers = [];

let allTables = [];
let activeTableId = null; 
let currentTableData = null; 
let salesMode = 'retail'; 
let currentCategory = 'Todas';
let pendingCheckoutSource = null; 
let activeModalType = 'fiado';

window.onload = () => {
    applySavedTheme();
    const savedRole = localStorage.getItem('userRole');
    if (savedRole === 'admin') { switchView('admin-view'); loadAdminData(); } 
    else if (savedRole === 'garcom') { switchView('waiter-view'); loadWaiterData(); }
    
    setInterval(checkNewOrdersForPrint, 5000);
};

function openWaiterMenu(menuType) {
    document.getElementById('waiter-home-section').style.display = 'none';
    document.getElementById('caixa-section').style.display = 'none';
    document.getElementById('mesas-section').style.display = 'none';
    document.getElementById('avulsa-section').style.display = 'none';
    
    const btnBack = document.getElementById('btn-waiter-back');
    const headerTitle = document.getElementById('waiter-header-title');

    if (menuType === 'home') {
        document.getElementById('waiter-home-section').style.display = 'grid';
        btnBack.style.display = 'none';
        headerTitle.innerText = 'Atendimento';
        activeTableId = null; 
        updateCartUI(); 
    } else {
        btnBack.style.display = 'block';
        if (menuType === 'fichas') {
            salesMode = 'retail';
            headerTitle.innerText = 'Venda Ficha';
            document.getElementById('caixa-section').style.display = 'block';
            applyWaiterFilters();
        } else if (menuType === 'atacado') {
            salesMode = 'wholesale';
            headerTitle.innerText = 'Venda Atacado';
            document.getElementById('caixa-section').style.display = 'block';
            applyWaiterFilters();
        } else if (menuType === 'mesas') {
            headerTitle.innerText = 'Comandas';
            document.getElementById('mesas-section').style.display = 'block';
            fetchTablesWaiter();
        } else if (menuType === 'avulsa') {
            headerTitle.innerText = 'Venda Avulsa';
            document.getElementById('avulsa-section').style.display = 'block';
            document.getElementById('avulsa-valor').value = ''; 
        }
        updateCartUI(); 
    }
}

async function processAvulsa(method) {
    const valorInput = document.getElementById('avulsa-valor').value;
    const total = parseFloat(valorInput);
    if (!total || total <= 0) return alert('Por favor, digite um valor válido maior que zero.');

    const avulsaItem = { id: null, productName: 'Venda Avulsa', price: total, quantity: 1, ticketCount: 1, isWholesale: false };

    if (method === 'Pix') {
        document.getElementById('pix-modal').classList.add('active');
        document.getElementById('pix-qr-container').innerHTML = '<p>Gerando...</p>';
        try {
            const res = await fetch(`${API_URL}/pix`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total }) });
            const pixData = await res.json();
            document.getElementById('pix-qr-container').innerHTML = `<img src="data:image/jpeg;base64,${pixData.qr_code_base64}" style="width:100%; max-width:250px; border-radius:8px;">`;
            pixInterval = setInterval(async () => {
                const check = await fetch(`${API_URL}/pix/${pixData.id}`); const st = await check.json();
                if (st.status === 'approved') { clearInterval(pixInterval); document.getElementById('pix-status-text').innerText = '✅ PAGO!'; setTimeout(() => finalizeAvulsa([avulsaItem], total, 'Pix'), 1500); }
            }, 3000);
        } catch (e) { alert('Erro PIX'); cancelPix(); }
    } else {
        finalizeAvulsa([avulsaItem], total, method);
    }
}

async function finalizeAvulsa(items, total, method) {
    try {
        await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, total, paymentMethod: method, waiter: 'Garçom' }) });
        document.getElementById('pix-modal').classList.remove('active');
        document.getElementById('avulsa-valor').value = '';
        showToast('✅ Venda Avulsa registrada!');
        openWaiterMenu('home'); 
    } catch (e) { alert('Erro ao registrar venda avulsa.'); }
}

async function deleteOrder(orderId) {
    const senha = prompt("Digite a senha de administrador para excluir esta venda:");
    if (senha === null) return;
    if (senha !== 'rafaelRAMOS28') return alert('Senha incorreta!');
    if (!confirm('Deseja realmente excluir esta venda? O estoque dos produtos será estornado.')) return;

    try {
        await fetch(`${API_URL}/orders/${orderId}`, { method: 'DELETE' });
        showToast('🗑️ Venda excluída!');
        fetchHistory();
        fetchProducts('admin');
    } catch (e) { alert('Erro'); }
}

async function confirmDeliveryPayment(orderId) {
    const method = prompt("Como o cliente pagou? (Ex: Pix, Dinheiro, Cartão)");
    if (!method) return;
    try {
        await fetch(`${API_URL}/orders/${orderId}/confirm-payment`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method }) });
        showToast('✅ Pagamento confirmado e somado ao faturamento!');
        fetchHistory();
    } catch (e) { alert('Erro'); }
}

function printDeliveryTicket(orderId) {
    const order = currentDayOrders.find(o => o._id === orderId);
    if (!order) return;
    const orderCode = order.orderNumber || 'ONLINE';
    const cName = order.customerName || 'Cliente Online';
    const cPhone = order.customerPhone || 'Não informado';
    const dateStr = new Date(order.date).toLocaleDateString('pt-BR') + ' ' + new Date(order.date).toLocaleTimeString('pt-BR');
    
    let printHTML = `<div class="ticket" style="text-align: left; font-family: monospace; font-size: 11px; width: 58mm; padding: 5px; color: black; background: white;">
        <div style="text-align: center;">
            <h3 style="font-size: 14px; margin-bottom: 2px;">Conteiner Beer</h3>
            <p style="font-size: 12px; margin: 0; font-weight:bold;">-- PEDIDO #${orderCode} --</p>
        </div>
        <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
        <div style="font-size: 11px; margin-bottom: 6px;">
            <strong>Cliente:</strong> ${cName}<br>
            <strong>Tel:</strong> ${cPhone}
        </div>
        <div style="border-bottom: 1px dashed #000; margin-bottom: 6px;"></div>
        <table style="width: 100%; font-size: 11px; margin-bottom: 5px;">
            <tr><th style="text-align:left;">Qtd</th><th style="text-align:left;">Produto</th></tr>`;
            
    if (order.items) order.items.forEach(i => { printHTML += `<tr><td>${i.quantity}x</td><td>${i.productName}</td></tr>`; });
    
    printHTML += `</table>
        <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
        <div style="text-align: right; font-size: 14px; font-weight: bold;">TOTAL: R$ ${order.total.toFixed(2)}</div>
        <p style="font-size:10px; text-align:center; margin-top:6px;">${dateStr}</p>
    </div>`;
    
    document.getElementById('print-area').innerHTML = printHTML;
    window.print();
}

async function checkNewOrdersForPrint() {
    if (!document.getElementById('admin-view').classList.contains('active')) return;
    try {
        const resOrders = await fetch(`${API_URL}/orders/pending`);
        const orders = await resOrders.json();
        for (const order of orders) {
            printOrderAutomatically(order);
            await fetch(`${API_URL}/orders/${order._id}/printed`, { method: 'PUT' });
        }
        const resTables = await fetch(`${API_URL}/tables/pending-prints`);
        const tablesToPrint = await resTables.json();
        for (const table of tablesToPrint) {
            printTableConferenceAutomatically(table);
            await fetch(`${API_URL}/tables/${table._id}/clear-print`, { method: 'PUT' });
        }
    } catch (e) { console.log(e); }
}

function printOrderAutomatically(order) {
    const dateStr = new Date(order.date).toLocaleDateString('pt-BR') + ' ' + new Date(order.date).toLocaleTimeString('pt-BR');
    const retailItems = order.items ? order.items.filter(i => !i.isWholesale) : []; 
    const wholesaleItems = order.items ? order.items.filter(i => i.isWholesale) : [];
    let ticketsToPrint = [];

    retailItems.forEach(item => { 
        const tCount = item.ticketCount || 1; 
        for (let i = 0; i < item.quantity; i++) { 
            if (tCount === 1) { 
                ticketsToPrint.push(gerarFichaHtml(item.productName, item.price, dateStr, "")); 
            } else { 
                for (let f = 1; f <= tCount; f++) { 
                    ticketsToPrint.push(gerarFichaHtml(item.productName, item.price, dateStr, `<div style="background-color:black; color:white; margin:10px 0; padding:5px; border-radius:4px;">FRAÇÃO ${f}/${tCount}</div>`)); 
                } 
            } 
        } 
    });

    if (wholesaleItems.length > 0) {
        let cupomTotal = wholesaleItems.reduce((s, i) => s + (i.price * i.quantity), 0);
        let atacadoHTML = `<div class="ticket" style="text-align: left; font-family: monospace; font-size: 11px; width: 58mm; padding: 5px; color: black; background: white;"><div style="text-align: center;"><h3>Conteiner Beer</h3><p>ATACADO</p></div><div style="border-bottom: 1px dashed #000; margin-bottom: 6px;"></div><table style="width: 100%;">`;
        wholesaleItems.forEach(item => { atacadoHTML += `<tr><td>${item.quantity}x</td><td>${item.productName}</td><td style="text-align:right;">R$ ${(item.price * item.quantity).toFixed(2)}</td></tr>`; });
        atacadoHTML += `</table><div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div><div style="text-align: right;"><strong>TOTAL: R$ ${cupomTotal.toFixed(2)}</strong></div><p>Pagamento: ${order.paymentMethod}</p></div>`;
        ticketsToPrint.push(atacadoHTML);
    }

    if (ticketsToPrint.length > 0) printTicketsOneByOne(ticketsToPrint, 0);
}

function printTicketsOneByOne(tickets, index) {
    if (index >= tickets.length) { document.getElementById('print-area').innerHTML = ''; return; }
    document.getElementById('print-area').innerHTML = tickets[index];
    window.print();
    setTimeout(() => { printTicketsOneByOne(tickets, index + 1); }, 2000);
}

function printTableConferenceAutomatically(table) {
    let subtotal = table.items.reduce((s, i) => s + (i.price * i.quantity), 0);
    let taxaServico = subtotal * 0.10;
    let totalComTaxa = subtotal + taxaServico;
    const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');
    
    let printHTML = `<div class="ticket" style="text-align: left; font-family: monospace; font-size: 11px; width: 58mm; padding: 5px; color: black; background: white;">
        <div style="text-align: center;"><h3 style="font-size: 14px; margin-bottom: 2px;">Conteiner Beer</h3><p style="font-size: 11px; margin: 0; font-weight:bold;">-- CONFERÊNCIA DE MESA --</p><h2 style="font-size: 18px; margin: 4px 0;">${table.name}</h2></div>
        <div style="border-bottom: 1px dashed #000; margin-bottom: 6px;"></div>
        <table style="width: 100%; font-size: 11px; margin-bottom: 5px;"><tr><th style="text-align:left;">Qtd</th><th style="text-align:left;">Produto</th><th style="text-align:right;">Total</th></tr>`;
    table.items.forEach(i => { printHTML += `<tr><td>${i.quantity}x</td><td>${i.productName}</td><td style="text-align:right;">R$ ${(i.price * i.quantity).toFixed(2)}</td></tr>`; });
    printHTML += `</table><div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div><strong>TOTAL GERAL: R$ ${totalComTaxa.toFixed(2)}</strong><p>${dateStr}</p></div>`;
    
    document.getElementById('print-area').innerHTML = printHTML;
    window.print();
}

function gerarFichaHtml(nome, preco, data, extraHtml) { 
    return `<div class="ticket" style="page-break-after: always; break-after: page; margin-bottom: 0;"><h3>Conteiner Beer</h3><h2>${nome}</h2>${extraHtml}<h1>R$ ${preco.toFixed(2)}</h1><div class="ticket-id">${generateUniqueId()}</div><p>${data}</p></div>`; 
}

function toggleTheme() { const isLight = document.body.classList.toggle('light-mode'); localStorage.setItem('theme', isLight ? 'light' : 'dark'); }
function applySavedTheme() { if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode'); }
function switchView(viewId) { document.querySelectorAll('.view').forEach(el => el.classList.remove('active')); document.getElementById(viewId).classList.add('active'); }

function login() {
    const pin = document.getElementById('pin-input').value;
    if (pin === 'admin123') { localStorage.setItem('userRole', 'admin'); switchView('admin-view'); loadAdminData(); } 
    else if (pin === 'garcom123') { localStorage.setItem('userRole', 'garcom'); switchView('waiter-view'); loadWaiterData(); } 
    else { alert('Senha incorreta!'); }
    document.getElementById('pin-input').value = '';
}
function logout() { localStorage.removeItem('userRole'); switchView('login-view'); }
function showToast(message) {
    const toast = document.createElement('div'); toast.className = 'toast-msg';
    toast.innerText = message; document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 2000);
}

async function loadAdminData() { 
    await fetchCategories(); 
    await fetchProducts('admin'); 
    await fetchHistory(); 
    await fetchTablesAdmin(); 
    await loadCustomers(); 
}

async function loadCustomers() {
    try {
        const res = await fetch(`${API_URL}/customers`);
        allCustomers = await res.json();
        if (document.getElementById('admin-view').classList.contains('active')) renderAdminCustomers();
    } catch (e) { console.error(e); }
}

async function addClient() {
    const name = document.getElementById('client-name').value;
    const phone = document.getElementById('client-phone').value;
    if(!name) return alert('Digite o nome!');
    try {
        await fetch(`${API_URL}/customers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone }) });
        document.getElementById('client-name').value = ''; document.getElementById('client-phone').value = '';
        showToast('✅ Cliente Cadastrado!');
        await loadCustomers();
    } catch (e) { alert('Erro'); }
}

async function deleteClient(id) { 
    if(confirm('Remover?')) { await fetch(`${API_URL}/customers/${id}`, { method: 'DELETE' }); await loadCustomers(); } 
}

function renderAdminCustomers() {
    document.getElementById('admin-client-list').innerHTML = allCustomers.map(c => `<li><span><strong>${c.name}</strong> <small style="display:block; color:var(--primary);">Saldo: R$ ${(c.clubBalance || 0).toFixed(2)}</small></span><div style="display: flex; gap: 4px;"><button class="btn-pay" style="background: #10b981; color: white; padding: 4px 6px; font-size: 11px;" onclick="openCustomerClubModal('${c._id}')">⭐ Clube</button><button class="btn-danger" style="padding: 4px 6px; font-size: 11px;" onclick="deleteClient('${c._id}')">X</button></div></li>`).join('');
}

async function openCustomerClubModal(id) {
    const customer = allCustomers.find(c => c._id === id);
    if (!customer) return;
    document.getElementById('club-modal-name').innerText = `Clube: ${customer.name}`;
    document.getElementById('modal-club-plan').value = customer.clubPlan || 'Nenhum';
    document.getElementById('modal-club-balance').value = customer.clubBalance || 0;
    document.getElementById('modal-club-customer-id').value = customer._id;
    document.getElementById('customer-club-modal').classList.add('active');
}
function closeCustomerClubModal() { document.getElementById('customer-club-modal').classList.remove('active'); }

async function saveCustomerClub() {
    const id = document.getElementById('modal-club-customer-id').value;
    const clubPlan = document.getElementById('modal-club-plan').value;
    const clubBalance = parseFloat(document.getElementById('modal-club-balance').value) || 0;
    try {
        await fetch(`${API_URL}/customers/${id}/club`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clubPlan, clubBalance }) });
        showToast('⭐ Clube atualizado!'); closeCustomerClubModal(); loadAdminData();
    } catch (e) { alert('Erro'); }
}

async function fetchCategories() {
    const res = await fetch(`${API_URL}/categories`); 
    allCategories = await res.json();
    
    document.getElementById('admin-category-list').innerHTML = allCategories.map(c => `
        <li style="display:flex; justify-content:space-between; align-items:center;">
            <span><strong>${c.name}</strong> <small style="color:${c.showOnline !== false ? 'var(--success)' : 'var(--danger)'};">${c.showOnline !== false ? '🌐 No Site' : '🔒 Só no Bar'}</small></span>
            <div style="display:flex; gap:5px;">
                <button class="btn-pay" style="margin:0; padding:4px 6px; font-size:11px; background:${c.showOnline !== false ? '#f59e0b' : '#10b981'}; color:white;" onclick="toggleCategoryOnline('${c._id}', ${c.showOnline !== false})">${c.showOnline !== false ? 'Ocultar Site' : 'Mostrar Site'}</button>
                <button class="btn-danger" style="margin:0; padding:4px 6px;" onclick="deleteCategory('${c._id}')">X</button>
            </div>
        </li>`).join('');
        
    document.getElementById('prod-category').innerHTML = `<option value="">Categoria</option>` + allCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

async function addCategory() {
    const name = document.getElementById('cat-name').value;
    if (name) { 
        await fetch(`${API_URL}/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, showOnline: true }) }); 
        document.getElementById('cat-name').value = ''; 
        loadAdminData(); 
    }
}

async function toggleCategoryOnline(id, currentState) {
    await fetch(`${API_URL}/categories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ showOnline: !currentState }) });
    loadAdminData();
}

async function deleteCategory(id) { if(confirm('Excluir?')) { await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' }); loadAdminData(); } }

async function fetchTablesAdmin() {
    const res = await fetch(`${API_URL}/tables`); allTables = await res.json();
    document.getElementById('admin-table-list').innerHTML = allTables.map(t => `<li><span>${t.name}</span> <button class="btn-danger" onclick="deleteTable('${t._id}')">X</button></li>`).join('');
}
async function addTable() {
    const name = document.getElementById('table-name').value;
    if (name) { await fetch(`${API_URL}/tables`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); document.getElementById('table-name').value = ''; fetchTablesAdmin(); }
}
async function deleteTable(id) { if(confirm('Excluir?')) { await fetch(`${API_URL}/tables/${id}`, { method: 'DELETE' }); fetchTablesAdmin(); } }

async function addProduct() {
    const name = document.getElementById('prod-name').value; const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value) || 0; const ticketCount = parseInt(document.getElementById('prod-tickets').value) || 1; 
    const category = document.getElementById('prod-category').value; const isWholesale = document.getElementById('prod-wholesale').checked;
    if (!name || !price || !category) return alert('Preencha os campos!');
    await fetch(`${API_URL}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, category, stock, ticketCount, isWholesale }) });
    document.getElementById('prod-name').value = ''; document.getElementById('prod-price').value = ''; document.getElementById('prod-stock').value = '';
    loadAdminData();
}

function openEditProdModal(id) {
    const p = allProducts.find(x => x._id === id); if (!p) return;
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
    if (!name || !price || !category) return alert('Preencha!');
    await fetch(`${API_URL}/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, stock, category, ticketCount, isWholesale }) });
    closeEditProdModal(); loadAdminData();
}
async function deleteProduct(id) { if(confirm('Excluir?')) { await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' }); loadAdminData(); } }

async function fetchHistory() {
    const dateInput = document.getElementById('history-date'); 
    let start = new Date(); let end = new Date();
    if (dateInput.value) { 
        const [y, m, d] = dateInput.value.split('-'); 
        start = new Date(y, m-1, d, 0, 0, 0); 
        end = new Date(y, m-1, d, 23, 59, 59, 999); 
    } else { 
        start.setHours(0,0,0,0); end.setHours(23,59,59,999); 
        const tzOffset = start.getTimezoneOffset() * 60000; 
        dateInput.value = (new Date(start - tzOffset)).toISOString().slice(0, 10); 
    }
    try {
        const res = await fetch(`${API_URL}/orders?start=${start.toISOString()}&end=${end.toISOString()}`); 
        const data = await res.json();
        currentDayOrders = Array.isArray(data) ? data : [];
    } catch (e) { currentDayOrders = []; }
    
    let totalRev = 0;
    document.getElementById('admin-history-list').innerHTML = currentDayOrders.map(order => {
        const isPending = order.paymentMethod && order.paymentMethod.includes('Pendente');
        if (!isPending) totalRev += order.total;

        const orderCode = order.orderNumber || 'GERAL';
        const hora = new Date(order.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        let itemsHTML = order.items ? order.items.map(i => `<div style="margin-bottom: 2px;">• ${i.quantity}x ${i.productName}</div>`).join('') : '';
        
        let actionButtons = ``;
        if (order.paymentMethod && order.paymentMethod.includes('Pedido Online')) {
            actionButtons += `<button class="btn-pay" style="background: #3b82f6; color: white; padding: 4px 8px; font-size: 11px; margin-right: 5px; width:auto;" onclick="printDeliveryTicket('${order._id}')">🖨️ Imprimir</button>`;
        }
        if (isPending) {
            actionButtons += `<button class="btn-pay" style="background: var(--success); color: white; padding: 4px 8px; font-size: 11px; margin-right: 5px; width:auto;" onclick="confirmDeliveryPayment('${order._id}')">✅ Receber</button>`;
        }
        actionButtons += `<button class="btn-danger" style="padding: 4px 8px; font-size: 11px; width:auto;" onclick="deleteOrder('${order._id}')">🗑️ Excluir</button>`;

        return `<li style="flex-direction: column; align-items: flex-start; gap: 8px; ${isPending ? 'border-left: 4px solid var(--primary);' : ''}">
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 14px;">
                    <span style="background:var(--primary); color:#000; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px; margin-bottom:4px; display:inline-block;">Pedido #${orderCode}</span>
                    ${order.customerName ? `<br><strong>Cliente:</strong> ${order.customerName} (${order.customerPhone || 'Sem tel'})` : ''}
                    ${itemsHTML}
                </div>
                <div style="display: flex; align-items: center;">
                    <span style="font-weight:bold; color:${isPending ? 'var(--primary)' : 'var(--success)'}; font-size: 16px; margin-right: 10px;">R$ ${order.total.toFixed(2)}</span>
                    ${actionButtons}
                </div>
            </div>
            <div style="width: 100%; border-top: 1px solid var(--border); padding-top: 6px;"><small style="color: var(--text-muted);">${hora} - <strong>${order.paymentMethod || 'Dinheiro'}</strong> ${isPending ? '<span style="color:var(--primary); font-weight:bold;"> (AGUARDANDO CONFIRMAÇÃO)</span>' : ''}</small></div>
        </li>`;
    }).join('') || '<p style="text-align:center; color:var(--text-muted); padding:10px;">Nenhuma venda hoje.</p>';
    document.getElementById('total-revenue').innerText = `R$ ${totalRev.toFixed(2)}`;
}

function printDailyReport() {
    if (!currentDayOrders || currentDayOrders.length === 0) return alert('Sem vendas!');
    let totalRev = 0; let reportHTML = `<div class="ticket" style="font-family: monospace; font-size: 11px; width: 58mm; padding: 5px;"><h3>Conteiner Beer</h3><p>--- FECHAMENTO ---</p>`;
    currentDayOrders.forEach((order, index) => {
        if(order.paymentMethod && order.paymentMethod.includes('Pendente')) return;
        totalRev += order.total; const hora = new Date(order.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        reportHTML += `<div><strong>#${index + 1} (${hora})</strong><br>`;
        if (order.items) order.items.forEach(i => { reportHTML += `&nbsp;• ${i.quantity}x ${i.productName}<br>`; });
        reportHTML += `R$ ${order.total.toFixed(2)}</div><hr>`;
    });
    reportHTML += `<h2>TOTAL: R$ ${totalRev.toFixed(2)}</h2></div>`;
    document.getElementById('print-area').innerHTML = reportHTML; setTimeout(() => window.print(), 200);
}

async function loadWaiterData() {
    const resCat = await fetch(`${API_URL}/categories`); allCategories = await resCat.json();
    document.getElementById('category-tabs').innerHTML = `<button class="tab active" onclick="filterProducts('Todas', this)">Todas</button>` + allCategories.map(c => `<button class="tab" onclick="filterProducts('${c.name}', this)">${c.name}</button>`).join('');
    await loadCustomers(); await fetchProducts('waiter'); await fetchTablesWaiter();
    openWaiterMenu('home'); 
}

async function fetchProducts(role) {
    const res = await fetch(`${API_URL}/products`); allProducts = await res.json();
    if (role === 'admin') {
        const totalEstoque = allProducts.reduce((acc, p) => acc + (p.price * p.stock), 0);
        let htmlProdutos = `<li style="background: var(--primary); color: white; justify-content: center; font-weight: bold; border-radius: 6px; margin-bottom: 10px;">Valor em Estoque: R$ ${totalEstoque.toFixed(2)}</li>`;
        htmlProdutos += allProducts.map(p => `<li><div><strong>${p.name}</strong><br><small>Estoque: ${p.stock}</small></div><div style="display:flex; gap:5px; align-items:center;"><span>R$ ${p.price.toFixed(2)}</span><button class="btn-pay" style="margin:0; padding:4px 8px; font-size:12px; background:var(--primary); color:white;" onclick="openEditProdModal('${p._id}')">✏️</button><button class="btn-danger" style="margin:0; padding:4px 8px;" onclick="deleteProduct('${p._id}')">X</button></div></li>`).join('');
        document.getElementById('admin-product-list').innerHTML = htmlProdutos;
    } else { applyWaiterFilters(); }
}

async function fetchTablesWaiter() {
    const res = await fetch(`${API_URL}/tables`); allTables = await res.json();
    document.getElementById('waiter-tables-grid').innerHTML = allTables.map(t => {
        const isLivre = t.status === 'livre'; const total = t.items ? t.items.reduce((s, i) => s + (i.price * i.quantity), 0) : 0;
        return `<div class="table-item ${t.status}" onclick="openTableManageModal('${t._id}')"><strong>${t.name}</strong><small>${isLivre ? 'LIVRE' : 'OCUPADA'}</small>${!isLivre ? `<div style="margin-top:5px; font-size: 14px;">R$ ${total.toFixed(2)}</div>` : ''}</div>`;
    }).join('');
}

function openTableManageModal(tableId) {
    const table = allTables.find(t => t._id === tableId); currentTableData = table;
    document.getElementById('tm-title').innerText = table.name;
    let subtotal = 0; let html = '';
    table.items.forEach(item => { subtotal += item.price * item.quantity; html += `<li style="padding: 10px 5px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;"><span>${item.quantity}x ${item.productName}</span><div style="display:flex; gap: 10px; align-items:center;"><strong>R$ ${(item.price * item.quantity).toFixed(2)}</strong><button style="background:var(--danger); padding:4px 10px; border-radius:4px;" onclick="removeTableItem('${table._id}', '${item.id}')">X</button></div></li>`; });
    document.getElementById('tm-items').innerHTML = html || '<p style="color:var(--text-muted); font-style:italic;">Mesa vazia.</p>';
    document.getElementById('tm-subtotal').innerText = `Subtotal: R$ ${subtotal.toFixed(2)}`;
    const hasItems = table.items.length > 0;
    document.getElementById('tm-pay-btn').style.display = hasItems ? 'block' : 'none'; document.getElementById('tm-print-btn').style.display = hasItems ? 'block' : 'none';
    document.getElementById('table-manage-modal').classList.add('active');
}
function closeTableManageModal() { document.getElementById('table-manage-modal').classList.remove('active'); }
async function removeTableItem(tableId, productId) { await fetch(`${API_URL}/tables/${tableId}/remove`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({productId}) }); await fetchTablesWaiter(); openTableManageModal(tableId); }

function startTableMode() {
    activeTableId = currentTableData._id; closeTableManageModal();
    openWaiterMenu('fichas'); 
    document.getElementById('active-table-banner').style.display = 'flex'; document.getElementById('banner-table-text').innerText = `Comanda: ${currentTableData.name}`;
    const floatingBtn = document.getElementById('cart-floating-btn'); floatingBtn.classList.add('table-mode', 'active'); floatingBtn.style.display = 'flex';
    document.getElementById('cart-action-text').innerText = 'Ver Comanda 📋'; updateActiveTableFloatingBtn();
}

function closeTableMode() {
    activeTableId = null; document.getElementById('active-table-banner').style.display = 'none';
    const floatingBtn = document.getElementById('cart-floating-btn'); floatingBtn.classList.remove('table-mode');
    document.getElementById('cart-action-text').innerText = 'Ver Carrinho 🛒'; updateCartUI(); 
    openWaiterMenu('mesas');
}

function updateActiveTableFloatingBtn() {
    if (!activeTableId || !currentTableData) return;
    document.getElementById('cart-count').innerText = `${currentTableData.items.reduce((s, i) => s + i.quantity, 0)} itens na mesa`;
    document.getElementById('cart-total').innerText = `R$ ${currentTableData.items.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2)}`;
}

async function printPartialTable() {
    if (!currentTableData || currentTableData.items.length === 0) return;
    try { await fetch(`${API_URL}/tables/${currentTableData._id}/request-print`, { method: 'PUT' }); showToast('🖨️ Conferência enviada!'); closeTableManageModal(); } catch (e) { alert('Erro'); }
}

function openTableCheckout() {
    closeTableManageModal(); document.getElementById('tc-title').innerText = currentTableData.name;
    document.getElementById('tc-split').value = 1; document.getElementById('tc-tax').checked = true;
    updateTableTotal(); document.getElementById('table-checkout-modal').classList.add('active');
}
function closeTableCheckoutModal() { document.getElementById('table-checkout-modal').classList.remove('active'); }

function updateTableTotal() {
    const subtotal = currentTableData.items.reduce((s, i) => s + (i.price * i.quantity), 0);
    const taxVal = document.getElementById('tc-tax').checked ? subtotal * 0.10 : 0; const total = subtotal + taxVal;
    let splitCount = parseInt(document.getElementById('tc-split').value) || 1; if (splitCount < 1) splitCount = 1;
    document.getElementById('tc-total').innerText = `Total: R$ ${total.toFixed(2)}`;
    if (splitCount > 1) { document.getElementById('tc-per-person-container').style.display = 'block'; document.getElementById('tc-per-person').innerText = `R$ ${(total/splitCount).toFixed(2)}`; } 
    else { document.getElementById('tc-per-person-container').style.display = 'none'; }
}

async function processTableCheckout(method) {
    if (!currentTableData) return;
    const subtotal = currentTableData.items.reduce((s, i) => s + (i.price * i.quantity), 0);
    const taxVal = document.getElementById('tc-tax').checked ? subtotal * 0.10 : 0; const total = subtotal + taxVal;
    const split = parseInt(document.getElementById('tc-split').value) || 1;
    const finalData = { method, subtotal, tax: taxVal, total, split, perPerson: total / split, items: currentTableData.items, tableName: currentTableData.name };

    if (method === 'Pix') {
        closeTableCheckoutModal(); document.getElementById('pix-modal').classList.add('active'); document.getElementById('pix-qr-container').innerHTML = '<p>Gerando...</p>';
        try {
            const res = await fetch(`${API_URL}/pix`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total }) });
            const pixData = await res.json();
            document.getElementById('pix-qr-container').innerHTML = `<img src="data:image/jpeg;base64,${pixData.qr_code_base64}" style="width:100%; max-width:250px; border-radius:8px;">`;
            pixInterval = setInterval(async () => {
                const check = await fetch(`${API_URL}/pix/${pixData.id}`); const st = await check.json();
                if (st.status === 'approved') { clearInterval(pixInterval); document.getElementById('pix-status-text').innerText = '✅ PAGO!'; setTimeout(() => finalizeTableOrder(finalData), 1500); }
            }, 3000);
        } catch (e) { alert('Erro PIX'); cancelPix(); }
    } else { finalizeTableOrder(finalData); }
}

async function finalizeTableOrder(data) {
    try {
        await fetch(`${API_URL}/tables/${currentTableData._id}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentMethod: data.method, total: data.total, items: data.items, waiter: 'Garçom' }) });
        document.getElementById('pix-modal').classList.remove('active'); closeTableCheckoutModal(); currentTableData = null; 
        await fetchProducts('waiter'); await fetchTablesWaiter(); openWaiterMenu('mesas'); 
    } catch (e) { alert('Erro'); }
}

function openCustomerModal(source, type = 'fiado') {
    pendingCheckoutSource = source; activeModalType = type;
    if (source === 'mesa') closeTableCheckoutModal(); else closeCartModal();
    if (allCustomers.length === 0) { alert("Nenhum cliente!"); source === 'mesa' ? openTableCheckout() : openCartModal(); return; }
    document.getElementById('customer-select-title').innerText = 'Selecione o Cliente';
    document.getElementById('customer-select-list').innerHTML = allCustomers.map(c => `<li style="cursor: pointer;" onclick="confirmCustomerAction('${c.name}')"><strong>${c.name}</strong></li>`).join('');
    document.getElementById('customer-select-modal').classList.add('active');
}
function closeCustomerModal() { document.getElementById('customer-select-modal').classList.remove('active'); if (pendingCheckoutSource === 'mesa') openTableCheckout(); else openCartModal(); }
function confirmCustomerAction(clientName) {
    document.getElementById('customer-select-modal').classList.remove('active');
    let paymentMethod = `Fiado - ${clientName}`;
    if (pendingCheckoutSource === 'mesa') processTableCheckout(paymentMethod); else processCheckout(paymentMethod);
}

function filterProducts(cat, btn) { document.querySelectorAll('.tab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); currentCategory = cat; applyWaiterFilters(); }
function searchProducts() { applyWaiterFilters(); }
function applyWaiterFilters() {
    const termo = document.getElementById('search-input').value.toLowerCase();
    const filtered = allProducts.filter(p => {
        const matchMode = (salesMode === 'wholesale') ? p.isWholesale : !p.isWholesale;
        const matchCat = (currentCategory === 'Todas') || (p.category === currentCategory);
        return matchMode && matchCat && p.name.toLowerCase().includes(termo);
    });
    renderWaiterGrid(filtered);
}
function renderWaiterGrid(products) {
    if (products.length === 0) { document.getElementById('waiter-product-grid').innerHTML = `<p style="grid-column: 1/-1; text-align: center;">Nenhum produto.</p>`; return; }
    document.getElementById('waiter-product-grid').innerHTML = products.map(p => {
        const isOutOfStock = p.stock <= 0;
        return `<div class="grid-item ${isOutOfStock ? 'out-of-stock' : ''}" onclick="${isOutOfStock ? '' : `addToCart('${p._id}')`}"><strong>${p.name}</strong><br><span>R$ ${p.price.toFixed(2)}</span><small>Estoque: ${p.stock}</small></div>`;
    }).join('');
}

async function addToCart(productId) {
    const product = allProducts.find(p => p._id === productId);
    if (activeTableId) {
        showToast(`✅ ${product.name} adicionado!`);
        const res = await fetch(`${API_URL}/tables/${activeTableId}/add`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product }) });
        currentTableData = await res.json(); fetchTablesWaiter(); updateActiveTableFloatingBtn(); return;
    }
    const existing = cart.find(item => item.id === productId);
    if ((existing ? existing.quantity : 0) + 1 > product.stock) return alert(`Estoque insuficiente!`);
    existing ? existing.quantity++ : cart.push({ id: product._id, productName: product.name, price: product.price, quantity: 1, ticketCount: product.ticketCount || 1, isWholesale: product.isWholesale || false });
    updateCartUI();
}
function changeCartQtd(id, amount) {
    const item = cart.find(i => i.id === id); const product = allProducts.find(p => p._id === id);
    if (item.quantity + amount > product.stock) return alert('Estoque limite!');
    item.quantity += amount; if (item.quantity <= 0) cart = cart.filter(i => i.id !== id); updateCartUI();
}
function updateCartUI() {
    if (activeTableId) return;
    const floatingBtn = document.getElementById('cart-floating-btn');
    const totalItems = cart.reduce((s, i) => s + i.quantity, 0); const totalPrice = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    if (totalItems > 0) { floatingBtn.classList.add('active'); floatingBtn.style.display = 'flex'; document.getElementById('cart-count').innerText = `${totalItems} itens`; document.getElementById('cart-total').innerText = `R$ ${totalPrice.toFixed(2)}`; } 
    else { floatingBtn.classList.remove('active'); floatingBtn.style.display = 'none'; closeCartModal(); }
    document.getElementById('cart-items-list').innerHTML = cart.map(item => `<li><div>${item.productName}<br><small>R$ ${item.price.toFixed(2)}</small></div><div class="cart-item-controls"><button onclick="changeCartQtd('${item.id}', -1)">-</button><span>${item.quantity}</span><button onclick="changeCartQtd('${item.id}', 1)">+</button></div></li>`).join('');
    document.getElementById('checkout-total').innerText = `R$ ${totalPrice.toFixed(2)}`;
}
function openCartModal() { document.getElementById('cart-modal').classList.add('active'); }
function closeCartModal() { document.getElementById('cart-modal').classList.remove('active'); }

async function processCheckout(method) {
    if (cart.length === 0) return;
    const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    if (method === 'Pix') {
        closeCartModal(); document.getElementById('pix-modal').classList.add('active'); document.getElementById('pix-qr-container').innerHTML = '<p>Gerando...</p>';
        try {
            const res = await fetch(`${API_URL}/pix`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total }) });
            const pixData = await res.json(); document.getElementById('pix-qr-container').innerHTML = `<img src="data:image/jpeg;base64,${pixData.qr_code_base64}" style="width:100%; max-width:250px; border-radius:8px;">`;
            pixInterval = setInterval(async () => {
                const check = await fetch(`${API_URL}/pix/${pixData.id}`); const st = await check.json();
                if (st.status === 'approved') { clearInterval(pixInterval); document.getElementById('pix-status-text').innerText = '✅ PAGO!'; setTimeout(() => finalizeOrder('Pix'), 1500); }
            }, 3000);
        } catch (e) { alert('Erro'); cancelPix(); }
    } else { finalizeOrder(method); }
}

function cancelPix() { clearInterval(pixInterval); document.getElementById('pix-modal').classList.remove('active'); openCartModal(); }
function generateUniqueId() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

async function finalizeOrder(paymentMethod) {
    try {
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        const res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart, total: total, paymentMethod: paymentMethod, waiter: 'Garçom' }) });
        if (!res.ok) throw new Error('Erro');
        cart = []; updateCartUI(); closeCartModal(); fetchProducts('waiter');
    } catch (e) { alert('Erro'); }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(err => console.error(err)); });
}