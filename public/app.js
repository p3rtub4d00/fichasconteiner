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
let activeModalType = 'fiado'; // 'fiado' ou 'clube'

window.onload = () => {
    applySavedTheme();
    const savedRole = localStorage.getItem('userRole');
    if (savedRole === 'admin') { switchView('admin-view'); loadAdminData(); } 
    else if (savedRole === 'garcom') { switchView('waiter-view'); loadWaiterData(); }
    
    setInterval(checkNewOrdersForPrint, 5000);
};

// ================= NAVEGAÇÃO DO GARÇOM (O NOVO MENU) =================
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

// ================= LÓGICA DE VENDA AVULSA =================
async function processAvulsa(method) {
    const valorInput = document.getElementById('avulsa-valor').value;
    const total = parseFloat(valorInput);
    if (!total || total <= 0) return alert('Por favor, digite um valor válido maior que zero.');

    const avulsaItem = { 
        id: null, 
        productName: 'Venda Avulsa', 
        price: total, 
        quantity: 1, 
        ticketCount: 1, 
        isWholesale: false 
    };

    if (method === 'Pix') {
        document.getElementById('pix-modal').classList.add('active');
        document.getElementById('pix-qr-container').innerHTML = '<p>Gerando...</p>';
        try {
            const res = await fetch(`${API_URL}/pix`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total }) });
            const pixData = await res.json();
            document.getElementById('pix-qr-container').innerHTML = `<img src="data:image/jpeg;base64,${pixData.qr_code_base64}" style="width:100%; max-width:250px; border-radius:8px;">`;
            pixInterval = setInterval(async () => {
                const check = await fetch(`${API_URL}/pix/${pixData.id}`); const st = await check.json();
                if (st.status === 'approved') { 
                    clearInterval(pixInterval); 
                    document.getElementById('pix-status-text').innerText = '✅ PAGO!'; 
                    setTimeout(() => finalizeAvulsa([avulsaItem], total, 'Pix'), 1500); 
                }
            }, 3000);
        } catch (e) { alert('Erro PIX'); cancelPix(); }
    } else {
        finalizeAvulsa([avulsaItem], total, method);
    }
}

async function finalizeAvulsa(items, total, method) {
    try {
        await fetch(`${API_URL}/orders`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ items, total, paymentMethod: method, waiter: 'Garçom' }) 
        });
        document.getElementById('pix-modal').classList.remove('active');
        document.getElementById('avulsa-valor').value = '';
        showToast('✅ Venda Avulsa registrada!');
        openWaiterMenu('home'); 
    } catch (e) {
        alert('Erro ao registrar venda avulsa.');
    }
}


// ================= IMPRESSÃO AUTOMÁTICA (COM CORTE POR FICHA) =================
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
    } catch (e) { console.log('Erro na checagem de impressao', e); }
}

function printOrderAutomatically(order) {
    let printHTML = ''; 
    const dateStr = new Date(order.date).toLocaleDateString('pt-BR') + ' ' + new Date(order.date).toLocaleTimeString('pt-BR');
    
    const retailItems = order.items ? order.items.filter(i => !i.isWholesale) : []; 
    const wholesaleItems = order.items ? order.items.filter(i => i.isWholesale) : [];
    
    retailItems.forEach(item => { 
        const tCount = item.ticketCount || 1; 
        for (let i = 0; i < item.quantity; i++) { 
            if (tCount === 1) { 
                printHTML += gerarFichaHtml(item.productName, item.price, dateStr, ""); 
            } else { 
                for (let f = 1; f <= tCount; f++) { 
                    printHTML += gerarFichaHtml(item.productName, item.price, dateStr, `<div style="background-color:black; color:white; margin:10px 0; padding:5px; border-radius:4px;">FRAÇÃO ${f}/${tCount}</div>`); 
                } 
            } 
        } 
    });

    if (wholesaleItems.length > 0) {
        let cupomTotal = wholesaleItems.reduce((s, i) => s + (i.price * i.quantity), 0);
        // Adicionado page-break-after para cortar o cupom de atacado
        printHTML += `<div class="ticket" style="text-align: left; font-family: monospace; font-size: 11px; width: 58mm; padding: 5px; color: black; background: white; page-break-after: always; break-after: page; margin-bottom: 0;"><div style="text-align: center;"><h3>Conteiner Beer</h3><p>ATACADO</p></div><div style="border-bottom: 1px dashed #000; margin-bottom: 6px;"></div><table style="width: 100%;">`;
        wholesaleItems.forEach(item => { printHTML += `<tr><td>${item.quantity}x</td><td>${item.productName}</td><td style="text-align:right;">R$ ${(item.price * item.quantity).toFixed(2)}</td></tr>`; });
        printHTML += `</table><div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div><div style="text-align: right;"><strong>TOTAL: R$ ${cupomTotal.toFixed(2)}</strong></div><p>Pagamento: ${order.paymentMethod}</p></div>`;
    }

    document.getElementById('print-area').innerHTML = printHTML;
    window.print();
}

function printTableConferenceAutomatically(table) {
    let subtotal = table.items.reduce((s, i) => s + (i.price * i.quantity), 0);
    const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');
    // Adicionado page-break-after para cortar o fechamento de mesa
    let printHTML = `<div class="ticket" style="text-align: left; font-family: monospace; font-size: 11px; width: 58mm; padding: 5px; color: black; background: white; margin-bottom: 0; page-break-after: always; break-after: page;"><div style="text-align: center;"><h3 style="font-size: 14px; margin-bottom: 2px;">Conteiner Beer</h3><p style="font-size: 11px; margin: 0; font-weight:bold;">-- CONFERÊNCIA DE MESA --</p><h2 style="font-size: 18px; margin: 4px 0;">${table.name}</h2></div><div style="border-bottom: 1px dashed #000; margin-bottom: 6px;"></div><table style="width: 100%; font-size: 11px; margin-bottom: 5px; border-collapse: collapse;"><tr><th style="text-align:left; border-bottom: 1px solid #000;">Qtd</th><th style="text-align:left; border-bottom: 1px solid #000;">Produto</th><th style="text-align:right; border-bottom: 1px solid #000;">Total</th></tr>`;
    table.items.forEach(item => { printHTML += `<tr><td>${item.quantity}x</td><td>${item.productName}</td><td style="text-align:right;">R$ ${(item.price * item.quantity).toFixed(2)}</td></tr>`; });
    printHTML += `</table><div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div><div style="text-align: right; font-size: 14px; font-weight: bold;">Subtotal: R$ ${subtotal.toFixed(2)}</div><div style="text-align: right; font-size: 11px; margin-top: 4px;">Serviço (10%): R$ ${(subtotal*0.1).toFixed(2)}</div><div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div><div style="font-size: 10px; text-align:center;"><p>${dateStr}</p></div></div>`;
    
    document.getElementById('print-area').innerHTML = printHTML;
    window.print();
}

// FORMATADOR HTML DAS FICHAS COM O COMANDO DE CORTE (page-break-after: always)
function gerarFichaHtml(nome, preco, data, extraHtml) { 
    return `<div class="ticket" style="page-break-after: always; break-after: page; margin-bottom: 0;"><h3>Conteiner Beer</h3><h2>${nome}</h2>${extraHtml}<h1>R$ ${preco.toFixed(2)}</h1><div class="ticket-id">${generateUniqueId()}</div><p>${data}</p><p style="font-size: 9px; margin-top: 4px; text-align: center; border-top: 1px dotted #000; padding-top: 2px;">Válida somente para o dia.<br>Não fazemos devoluções.</p></div>`; 
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}
function applySavedTheme() {
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');
}

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

function showToast(message) {
    const toast = document.createElement('div'); toast.className = 'toast-msg';
    toast.innerText = message; document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 2000);
}

function handleFloatingClick() { activeTableId ? openTableManageModal(activeTableId) : openCartModal(); }

// ================= ADMIN & CLIENTES =================
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
        if (document.getElementById('admin-view').classList.contains('active')) {
            renderAdminCustomers();
        }
    } catch (error) { console.error("Erro ao carregar clientes", error); }
}

async function addClient() {
    const name = document.getElementById('client-name').value;
    const phone = document.getElementById('client-phone').value;
    if(!name) return alert('Digite o nome do cliente!');
    try {
        await fetch(`${API_URL}/customers`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone })
        });
        document.getElementById('client-name').value = ''; document.getElementById('client-phone').value = '';
        showToast('✅ Cliente Cadastrado!');
        await loadCustomers();
    } catch (error) { alert('Erro ao salvar cliente!'); }
}

async function deleteClient(id) { 
    if(confirm('Remover cliente?')) { 
        try {
            await fetch(`${API_URL}/customers/${id}`, { method: 'DELETE' });
            await loadCustomers();
        } catch (error) { alert('Erro ao excluir cliente!'); }
    } 
}

function renderAdminCustomers() {
    document.getElementById('admin-client-list').innerHTML = allCustomers.map(c => `<li>
        <span>
            <strong>${c.name}</strong> 
            <small style="display:block; color:var(--primary);">Plano: ${c.clubPlan || 'Nenhum'} | Saldo: R$ ${(c.clubBalance || 0).toFixed(2)}</small>
        </span>
        <div style="display: flex; gap: 4px;">
            <button class="btn-pay" style="background: #10b981; color: white; padding: 4px 6px; font-size: 11px;" onclick="openCustomerClubModal('${c._id}')">⭐ Clube</button>
            <button class="btn-pay" style="background: #3b82f6; color: white; padding: 4px 6px; font-size: 11px;" onclick="openClientDebtModal('${c.name}')">Fiado 📋</button>
            <button class="btn-danger" style="padding: 4px 6px; font-size: 11px;" onclick="deleteClient('${c._id}')">X</button>
        </div>
    </li>`).join('');
}

// ================= GESTÃO DO CLUBE DO CLIENTE & EXTRATO =================
async function openCustomerClubModal(id) {
    const customer = allCustomers.find(c => c._id === id);
    if (!customer) return;
    
    document.getElementById('club-modal-name').innerText = `Clube: ${customer.name}`;
    document.getElementById('modal-club-plan').value = customer.clubPlan || 'Nenhum';
    document.getElementById('modal-club-balance').value = customer.clubBalance || 0;
    document.getElementById('modal-club-customer-id').value = customer._id;
    document.getElementById('club-history-list').innerHTML = '<p style="text-align:center; color:var(--text-muted);">Carregando extrato...</p>';
    
    document.getElementById('customer-club-modal').classList.add('active');

    try {
        const res = await fetch(`${API_URL}/customers/club-extrato/${encodeURIComponent(customer.name)}`);
        const data = await res.json();
        const history = data.clubHistory || [];

        if (history.length === 0) {
            document.getElementById('club-history-list').innerHTML = '<p style="text-align:center; color:var(--text-muted); font-style:italic; padding:10px;">Nenhum consumo registrado no clube ainda.</p>';
            return;
        }

        let html = '';
        history.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(h => {
            const dataHora = new Date(h.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            let itemsText = h.items ? h.items.map(i => `${i.quantity}x ${i.productName}`).join(', ') : 'Itens diversos';
            html += `<li style="flex-direction: column; align-items: flex-start; padding: 8px 10px; margin-bottom: 6px; border-left: 4px solid #10b981;">
                <div style="width: 100%; display: flex; justify-content: space-between; font-size: 13px;">
                    <span style="color: var(--text-muted);">${dataHora}</span>
                    <strong style="color: var(--success);">- R$ ${h.total.toFixed(2)}</strong>
                </div>
                <div style="font-size: 13px; margin-top: 3px; font-weight: 500;">${itemsText}</div>
            </li>`;
        });
        document.getElementById('club-history-list').innerHTML = html;
    } catch (e) {
        document.getElementById('club-history-list').innerHTML = '<p style="text-align:center; color:var(--danger);">Erro ao carregar histórico.</p>';
    }
}

function closeCustomerClubModal() { document.getElementById('customer-club-modal').classList.remove('active'); }

async function saveCustomerClub() {
    const id = document.getElementById('modal-club-customer-id').value;
    const clubPlan = document.getElementById('modal-club-plan').value;
    const clubBalance = parseFloat(document.getElementById('modal-club-balance').value) || 0;

    try {
        const res = await fetch(`${API_URL}/customers/${id}/club`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clubPlan, clubBalance }) });
        if (!res.ok) throw new Error('Erro');
        showToast('⭐ Clube atualizado com sucesso!'); closeCustomerClubModal(); loadAdminData();
    } catch (e) { alert('Erro ao salvar dados do clube.'); }
}

// ================= EXTRATO DE FIADO COM ABATIMENTO =================
async function openClientDebtModal(clientName) {
    document.getElementById('debt-modal-title').innerText = `Fiado: ${clientName}`;
    document.getElementById('debt-modal-subtitle').innerText = 'Histórico de compras e pagamentos.';
    document.getElementById('debt-items-list').innerHTML = '<p style="text-align:center; color:var(--text-muted);">Carregando...</p>';
    document.getElementById('debt-total-amount').innerText = 'R$ 0,00';
    document.getElementById('customer-debt-modal').classList.add('active');

    try {
        const res = await fetch(`${API_URL}/customers/debt/${encodeURIComponent(clientName)}`);
        const data = await res.json();
        const orders = data.orders || [];
        const payments = data.payments || [];
        
        let totalPurchases = orders.reduce((sum, o) => sum + o.total, 0);
        let totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        let currentDebt = totalPurchases - totalPaid;

        if (currentDebt <= 0 && orders.length === 0) {
            document.getElementById('debt-items-list').innerHTML = '<p style="text-align:center; color:var(--success); font-style:italic; padding:10px;">Nenhum débito pendente! Conta zerada. 🎉</p>';
            document.getElementById('btn-settle-debt').style.display = 'none';
            document.getElementById('debt-total-amount').innerText = 'R$ 0,00';
            return;
        }

        document.getElementById('btn-settle-debt').style.display = 'block';
        document.getElementById('btn-settle-debt').setAttribute('onclick', `settleClientDebt('${clientName}')`);

        let history = [];
        orders.forEach(o => history.push({ type: 'compra', date: new Date(o.date), total: o.total, items: o.items }));
        payments.forEach(p => history.push({ type: 'pagamento', date: new Date(p.date), total: p.amount }));
        history.sort((a, b) => b.date - a.date); 

        let html = `
            <div style="display: flex; gap: 5px; margin-bottom: 15px; background: var(--bg-card); padding: 10px; border-radius: 8px;">
                <input type="number" id="partial-pay-amount" placeholder="Valor a abater (R$)" style="flex:1; padding: 8px; border-radius: 4px; border: 1px solid var(--border);">
                <button class="btn-pay" style="padding: 8px 15px; margin: 0;" onclick="payPartialDebt('${clientName}')">Abater</button>
            </div>
            <hr style="border: 0; border-top: 1px solid var(--border); margin-bottom: 15px;">
        `;

        history.forEach((h) => {
            const dataHora = h.date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            if (h.type === 'pagamento') {
                html += `<li style="flex-direction: column; align-items: flex-start; padding: 8px 10px; margin-bottom: 6px; border-left: 4px solid var(--success);"><div style="width: 100%; display: flex; justify-content: space-between; font-size: 13px;"><span style="color: var(--text-muted);">${dataHora}</span><strong style="color: var(--success);">- R$ ${h.total.toFixed(2)} (Abatimento)</strong></div></li>`;
            } else {
                let itemsText = h.items ? h.items.map(i => `${i.quantity}x ${i.productName}`).join(', ') : 'Itens diversos';
                html += `<li style="flex-direction: column; align-items: flex-start; padding: 8px 10px; margin-bottom: 6px; border-left: 4px solid var(--danger);"><div style="width: 100%; display: flex; justify-content: space-between; font-size: 13px;"><span style="color: var(--text-muted);">${dataHora}</span><strong style="color: var(--danger);">R$ ${h.total.toFixed(2)}</strong></div><div style="font-size: 13px; margin-top: 3px; font-weight: 500;">${itemsText}</div></li>`;
            }
        });

        document.getElementById('debt-items-list').innerHTML = html;
        document.getElementById('debt-total-amount').innerText = `R$ ${currentDebt.toFixed(2)}`;
    } catch (e) { alert('Erro ao carregar o extrato do cliente.'); }
}

async function payPartialDebt(clientName) {
    const amountInput = document.getElementById('partial-pay-amount');
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) return alert('Digite um valor válido para abater!');
    if (!confirm(`Confirmar abatimento de R$ ${amount.toFixed(2)} para ${clientName}?`)) return;

    try {
        const res = await fetch(`${API_URL}/customers/debt/${encodeURIComponent(clientName)}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
        if (!res.ok) throw new Error('Erro');
        showToast(`✅ R$ ${amount.toFixed(2)} abatidos com sucesso!`);
        openClientDebtModal(clientName); 
    } catch(e) { alert('Erro ao processar abatimento.'); }
}

function closeCustomerDebtModal() { document.getElementById('customer-debt-modal').classList.remove('active'); }

async function settleClientDebt(clientName) {
    if (!confirm(`Deseja quitar todo o saldo restante de ${clientName}?`)) return;
    try {
        const res = await fetch(`${API_URL}/customers/debt/${encodeURIComponent(clientName)}/settle`, { method: 'POST' });
        if (!res.ok) throw new Error('Erro ao quitar conta');
        showToast(`✅ Dívida de ${clientName} quitada com sucesso!`);
        closeCustomerDebtModal(); loadAdminData();
    } catch (e) { alert('Erro ao processar a quitação.'); }
}

async function fetchCategories() {
    const res = await fetch(`${API_URL}/categories`); allCategories = await res.json();
    document.getElementById('admin-category-list').innerHTML = allCategories.map(c => `<li><span>${c.name}</span> <button class="btn-danger" onclick="deleteCategory('${c._id}')">X</button></li>`).join('');
    document.getElementById('prod-category').innerHTML = `<option value="">Categoria</option>` + allCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}
async function addCategory() {
    const name = document.getElementById('cat-name').value;
    if (name) { await fetch(`${API_URL}/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); document.getElementById('cat-name').value = ''; loadAdminData(); }
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
async function deleteTable(id) { if(confirm('Excluir mesa?')) { await fetch(`${API_URL}/tables/${id}`, { method: 'DELETE' }); fetchTablesAdmin(); } }

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
    if (!name || !price || !category) return alert('Preencha os campos!');
    await fetch(`${API_URL}/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, stock, category, ticketCount, isWholesale }) });
    closeEditProdModal(); loadAdminData();
}
async function deleteProduct(id) { if(confirm('Excluir produto?')) { await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' }); loadAdminData(); } }

async function fetchHistory() {
    const dateInput = document.getElementById('history-date'); 
    let start = new Date(); let end = new Date();
    if (dateInput.value) { 
        const [y, m, d] = dateInput.value.split('-'); 
        start = new Date(y, m-1, d, 0, 0, 0); 
        end = new Date(y, m-1, d, 23, 59, 59, 999); 
    } else { 
        start.setHours(0,0,0,0); 
        end.setHours(23,59,59,999); 
        const tzOffset = start.getTimezoneOffset() * 60000; 
        dateInput.value = (new Date(start - tzOffset)).toISOString().slice(0, 10); 
    }
    try {
        const res = await fetch(`${API_URL}/orders?start=${start.toISOString()}&end=${end.toISOString()}`); 
        const data = await res.json();
        currentDayOrders = Array.isArray(data) ? data : [];
    } catch (e) {
        currentDayOrders = [];
    }
    
    let totalRev = 0;
    document.getElementById('admin-history-list').innerHTML = currentDayOrders.map(order => {
        totalRev += order.total; const hora = new Date(order.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        let itemsHTML = order.items ? order.items.map(i => `<div style="margin-bottom: 2px;">• ${i.quantity}x ${i.productName}</div>`).join('') : 'Venda antiga';
        return `<li style="flex-direction: column; align-items: flex-start; gap: 8px;"><div style="width: 100%; display: flex; justify-content: space-between;"><div style="font-size: 14px;">${itemsHTML}</div><span style="font-weight:bold; color:var(--success); font-size: 16px;">R$ ${order.total.toFixed(2)}</span></div><div style="width: 100%; border-top: 1px solid var(--border); padding-top: 6px;"><small style="color: var(--text-muted);">${hora} - <strong>${order.paymentMethod || 'Dinheiro'}</strong></small></div></li>`;
    }).join('') || '<p style="text-align:center; color:var(--text-muted); padding:10px;">Nenhuma venda registrada hoje.</p>';
    document.getElementById('total-revenue').innerText = `R$ ${totalRev.toFixed(2)}`;
}

function printDailyReport() {
    if (!currentDayOrders || currentDayOrders.length === 0) return alert('Sem vendas!');
    let totalRev = 0; let reportHTML = `<div class="ticket" style="text-align: left; font-family: monospace; font-size: 11px; width: 58mm; padding: 5px; color: black; background: white; page-break-after: always; break-after: page; margin-bottom: 0;"><div style="text-align: center;"><h3>Conteiner Beer</h3><p>--- FECHAMENTO ---</p></div><div style="border-bottom: 1px dashed #000; margin-bottom: 6px;"></div>`;
    currentDayOrders.forEach((order, index) => {
        totalRev += order.total; const hora = new Date(order.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        reportHTML += `<div style="margin-bottom: 5px;"><strong>#${index + 1} (${hora}) - ${order.paymentMethod}</strong><br>`;
        if (order.items) order.items.forEach(i => { reportHTML += `&nbsp;• ${i.quantity}x ${i.productName}<br>`; });
        reportHTML += `<div style="text-align: right; font-weight: bold;">R$ ${order.total.toFixed(2)}</div></div><div style="border-bottom: 1px dotted #666; margin: 3px 0;"></div>`;
    });
    reportHTML += `<h2 style="font-size: 15px; text-align:center; margin: 4px 0;">TOTAL: R$ ${totalRev.toFixed(2)}</h2></div>`;
    document.getElementById('print-area').innerHTML = reportHTML; setTimeout(() => window.print(), 200);
}

// ================= GARÇOM =================
async function loadWaiterData() {
    const resCat = await fetch(`${API_URL}/categories`); allCategories = await resCat.json();
    document.getElementById('category-tabs').innerHTML = `<button class="tab active" onclick="filterProducts('Todas', this)">Todas</button>` + allCategories.map(c => `<button class="tab" onclick="filterProducts('${c.name}', this)">${c.name}</button>`).join('');
    
    await loadCustomers(); 
    await fetchProducts('waiter'); 
    await fetchTablesWaiter();
    openWaiterMenu('home'); 
}

async function fetchProducts(role) {
    const res = await fetch(`${API_URL}/products`); allProducts = await res.json();
    
    if (role === 'admin') {
        const totalEstoque = allProducts.reduce((acc, p) => acc + (p.price * p.stock), 0);
        let htmlProdutos = `<li style="background: var(--primary); color: white; justify-content: center; font-weight: bold; border-radius: 6px; margin-bottom: 10px;">Valor em Estoque: R$ ${totalEstoque.toFixed(2)}</li>`;
        htmlProdutos += allProducts.map(p => {
            return `<li><div><strong>${p.name}</strong> ${p.isWholesale?'<span class="badge-atacado">ATACADO</span>':''}<br><small>Estoque: ${p.stock}</small></div><div style="display:flex; gap:5px; align-items:center;"><span>R$ ${p.price.toFixed(2)}</span><button class="btn-pay" style="margin:0; padding:4px 8px; font-size:12px; background:var(--primary);" onclick="openEditProdModal('${p._id}')">✏️</button><button class="btn-danger" style="margin:0; padding:4px 8px;" onclick="deleteProduct('${p._id}')">X</button></div></li>`;
        }).join('');
        document.getElementById('admin-product-list').innerHTML = htmlProdutos;
    } else { 
        applyWaiterFilters(); 
    }
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
    try {
        await fetch(`${API_URL}/tables/${currentTableData._id}/request-print`, { method: 'PUT' });
        showToast('🖨️ Conferência enviada para a impressora!');
        closeTableManageModal();
    } catch (e) { alert('Erro ao solicitar impressão da mesa.'); }
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
        const res = await fetch(`${API_URL}/tables/${currentTableData._id}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentMethod: data.method, total: data.total, items: data.items, waiter: 'Garçom' }) });
        if (!res.ok) throw new Error('Erro');
        document.getElementById('pix-modal').classList.remove('active'); 
        closeTableCheckoutModal();
        currentTableData = null; 
        await fetchProducts('waiter'); 
        await fetchTablesWaiter(); 
        openWaiterMenu('mesas'); 
    } catch (e) { alert('Erro ao registrar fechamento.'); }
}

function openCustomerModal(source, type = 'fiado') {
    pendingCheckoutSource = source; 
    activeModalType = type;
    if (source === 'mesa') closeTableCheckoutModal(); else closeCartModal();
    
    if (allCustomers.length === 0) { alert("Nenhum cliente cadastrado! Cadastre no Painel Admin."); source === 'mesa' ? openTableCheckout() : openCartModal(); return; }

    if (activeModalType === 'clube') {
        document.getElementById('customer-select-title').innerText = 'Abater do Clube';
        document.getElementById('customer-select-subtitle').innerText = 'O valor será debitado do saldo de créditos do cliente.';
        document.getElementById('customer-select-list').innerHTML = allCustomers.map(c => `<li style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="confirmCustomerAction('${c.name}')"><div><strong>${c.name}</strong><br><small style="color:var(--primary);">Saldo: R$ ${(c.clubBalance || 0).toFixed(2)}</small></div><button class="btn-pay" style="padding: 4px 10px; font-size:12px; background:var(--success);">Debitar</button></li>`).join('');
    } else {
        document.getElementById('customer-select-title').innerText = 'Selecione o Cliente';
        document.getElementById('customer-select-subtitle').innerText = 'A conta ficará pendurada (Fiado) para esta pessoa.';
        document.getElementById('customer-select-list').innerHTML = allCustomers.map(c => `<li style="cursor: pointer;" onclick="confirmCustomerAction('${c.name}')"><strong>${c.name}</strong><button class="btn-pay" style="padding: 4px 10px; font-size:12px;">Selecionar</button></li>`).join('');
    }
    document.getElementById('customer-select-modal').classList.add('active');
}

function closeCustomerModal() { document.getElementById('customer-select-modal').classList.remove('active'); if (pendingCheckoutSource === 'mesa') openTableCheckout(); else if (pendingCheckoutSource === 'caixa') openCartModal(); }

function confirmCustomerAction(clientName) {
    document.getElementById('customer-select-modal').classList.remove('active');
    let paymentMethod = '';
    if (activeModalType === 'clube') paymentMethod = `Clube - ${clientName}`;
    else paymentMethod = `Fiado - ${clientName}`;

    if (pendingCheckoutSource === 'mesa') { processTableCheckout(paymentMethod); } 
    else { processCheckout(paymentMethod); }
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
        const isOutOfStock = p.stock <= 0; const isLowStock = p.stock > 0 && p.stock <= 5;
        let classes = 'grid-item';
        if (isOutOfStock) classes += ' out-of-stock'; else if (isLowStock) classes += ' low-stock';
        return `<div class="${classes}" onclick="${isOutOfStock ? '' : `addToCart('${p._id}')`}"><strong>${p.name}</strong><br><span>R$ ${p.price.toFixed(2)}</span><small>Estoque: ${p.stock}</small></div>`;
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
    if (item.quantity + amount > product.stock) return alert('Estoque limite atingido!');
    item.quantity += amount; if (item.quantity <= 0) cart = cart.filter(i => i.id !== id); updateCartUI();
}

function updateCartUI() {
    if (activeTableId) return;
    const homeActive = document.getElementById('waiter-home-section').style.display !== 'none';
    const avulsaActive = document.getElementById('avulsa-section').style.display !== 'none';
    const floatingBtn = document.getElementById('cart-floating-btn');

    if (homeActive || avulsaActive) { floatingBtn.style.display = 'none'; floatingBtn.classList.remove('active'); return; }

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
        } catch (e) { alert('Erro PIX'); cancelPix(); }
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
    } catch (e) { alert('Erro ao finalizar pedido.'); }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registrado com sucesso!', reg))
            .catch(err => console.error('Erro ao registrar Service Worker:', err));
    });
}
