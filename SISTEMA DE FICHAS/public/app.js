const API_URL = '/api';

// Controle de Telas (Navegação SPA)
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function login() {
    const pin = document.getElementById('pin-input').value;
    if (pin === 'admin123') {
        switchView('admin-view');
        loadAdminData();
    } else if (pin === 'garcom123') {
        switchView('waiter-view');
        loadWaiterData();
    } else {
        alert('Senha incorreta!');
    }
    document.getElementById('pin-input').value = '';
}

function logout() {
    switchView('login-view');
}

// Lógica do Admin
async function loadAdminData() {
    loadProducts('admin');
    const res = await fetch(`${API_URL}/orders/today`);
    const orders = await res.json();
    const total = orders.reduce((sum, order) => sum + order.price, 0);
    document.getElementById('total-revenue').innerText = `R$ ${total.toFixed(2)}`;
}

async function addProduct() {
    const name = document.getElementById('prod-name').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    if (!name || !price) return alert('Preencha os campos!');

    await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price, category: 'Geral' })
    });
    
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-price').value = '';
    loadAdminData();
}

async function deleteProduct(id) {
    if(confirm('Tem certeza?')) {
        await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
        loadAdminData();
    }
}

async function clearRevenue() {
    if(confirm('Deseja realmente zerar o faturamento de hoje? Isso não pode ser desfeito.')) {
        await fetch(`${API_URL}/orders/clear-today`, { method: 'DELETE' });
        loadAdminData();
    }
}

// Lógica do Garçom e Impressão
async function loadWaiterData() {
    loadProducts('waiter');
}

async function loadProducts(role) {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    
    if (role === 'admin') {
        const list = document.getElementById('admin-product-list');
        list.innerHTML = products.map(p => `
            <li>${p.name} - R$ ${p.price.toFixed(2)} 
            <button onclick="deleteProduct('${p._id}')">X</button></li>
        `).join('');
    } else {
        const grid = document.getElementById('waiter-product-grid');
        grid.innerHTML = products.map(p => `
            <div class="grid-item" onclick="issueTicket('${p.name}', ${p.price})">
                ${p.name}<br><small>R$ ${p.price.toFixed(2)}</small>
            </div>
        `).join('');
    }
}

async function issueTicket(name, price) {
    // 1. Salva no banco (Registra a venda)
    await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: name, price, waiter: 'Garçom 1' })
    });

    // 2. Prepara a ficha para impressão
    document.getElementById('print-prod-name').innerText = name.toUpperCase();
    document.getElementById('print-prod-price').innerText = `R$ ${price.toFixed(2)}`;
    document.getElementById('print-date').innerText = new Date().toLocaleString();

    // 3. Aciona o diálogo de impressão do sistema
    window.print();
}