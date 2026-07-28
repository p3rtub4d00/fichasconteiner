const API_URL = '/api';

// Variáveis Globais (Estado do App)
let allProducts = [];
let allCategories = [];
let orderState = { name: '', price: 0, quantity: 1 };

// Controle de Telas
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function login() {
    const pin = document.getElementById('pin-input').value;
    if (pin === 'admin123') { switchView('admin-view'); loadAdminData(); } 
    else if (pin === 'garcom123') { switchView('waiter-view'); loadWaiterData(); } 
    else { alert('Senha incorreta!'); }
    document.getElementById('pin-input').value = '';
}

function logout() { switchView('login-view'); }

// ================= ADMIN LOGIC =================
async function loadAdminData() {
    await fetchCategories();
    await fetchProducts('admin');
    await fetchHistory();
}

async function fetchCategories() {
    const res = await fetch(`${API_URL}/categories`);
    allCategories = await res.json();
    
    document.getElementById('admin-category-list').innerHTML = allCategories.map(c => `
        <li><span>${c.name}</span> <button class="btn-danger" onclick="deleteCategory('${c._id}')">X</button></li>
    `).join('');

    document.getElementById('prod-category').innerHTML = `
        <option value="">Selecione a Categoria</option>
        ${allCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
    `;
}

async function addCategory() {
    const name = document.getElementById('cat-name').value;
    if (!name) return;
    await fetch(`${API_URL}/categories`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    });
    document.getElementById('cat-name').value = '';
    loadAdminData();
}

async function deleteCategory(id) {
    if(confirm('Excluir categoria?')) {
        await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' });
        loadAdminData();
    }
}

async function addProduct() {
    const name = document.getElementById('prod-name').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const category = document.getElementById('prod-category').value;
    
    if (!name || !price || !category) return alert('Preencha nome, preço e categoria!');

    await fetch(`${API_URL}/products`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, category })
    });
    
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-price').value = '';
    loadAdminData();
}

async function deleteProduct(id) {
    if(confirm('Excluir produto?')) {
        await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
        loadAdminData();
    }
}

async function fetchHistory() {
    const res = await fetch(`${API_URL}/orders/today`);
    const orders = await res.json();
    
    let total = 0;
    document.getElementById('admin-history-list').innerHTML = orders.map(o => {
        total += o.total;
        const hora = new Date(o.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `<li>
            <div><strong>${o.quantity}x ${o.productName}</strong> <small>${hora}</small></div>
            <span>R$ ${o.total.toFixed(2)}</span>
        </li>`;
    }).join('');
    
    document.getElementById('total-revenue').innerText = `R$ ${total.toFixed(2)}`;
}

async function clearRevenue() {
    if(confirm('Zerar faturamento de HOJE?')) {
        await fetch(`${API_URL}/orders/clear-today`, { method: 'DELETE' });
        loadAdminData();
    }
}

// ================= WAITER LOGIC =================
async function loadWaiterData() {
    const resCat = await fetch(`${API_URL}/categories`);
    allCategories = await resCat.json();
    
    document.getElementById('category-tabs').innerHTML = `
        <button class="tab active" onclick="filterProducts('Todas', this)">Todas</button>
        ${allCategories.map(c => `<button class="tab" onclick="filterProducts('${c.name}', this)">${c.name}</button>`).join('')}
    `;

    await fetchProducts('waiter');
}

async function fetchProducts(role) {
    const res = await fetch(`${API_URL}/products`);
    allProducts = await res.json();
    
    if (role === 'admin') {
        document.getElementById('admin-product-list').innerHTML = allProducts.map(p => `
            <li>
                <div><strong>${p.name}</strong> <small>${p.category}</small></div>
                <div>R$ ${p.price.toFixed(2)} <button class="btn-danger" onclick="deleteProduct('${p._id}')">X</button></div>
            </li>
        `).join('');
    } else {
        renderWaiterGrid(allProducts);
    }
}

function renderWaiterGrid(products) {
    const grid = document.getElementById('waiter-product-grid');
    grid.innerHTML = products.map(p => `
        <div class="grid-item" onclick="openModal('${p.name}', ${p.price})">
            <strong>${p.name}</strong><br>
            <span>R$ ${p.price.toFixed(2)}</span>
        </div>
    `).join('');
}

function filterProducts(category, btnElement) {
    document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    if (category === 'Todas') {
        renderWaiterGrid(allProducts);
    } else {
        const filtrados = allProducts.filter(p => p.category === category);
        renderWaiterGrid(filtrados);
    }
}

function searchProducts() {
    const termo = document.getElementById('search-input').value.toLowerCase();
    const filtrados = allProducts.filter(p => p.name.toLowerCase().includes(termo));
    renderWaiterGrid(filtrados);
}

// ================= MODAL & IMPRESSÃO =================
function openModal(name, price) {
    orderState = { name, price, quantity: 1 };
    updateModalUI();
    document.getElementById('qtd-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('qtd-modal').classList.remove('active');
}

function changeQtd(amount) {
    if (orderState.quantity + amount >= 1) {
        orderState.quantity += amount;
        updateModalUI();
    }
}

function updateModalUI() {
    document.getElementById('modal-prod-name').innerText = orderState.name;
    document.getElementById('modal-prod-price').innerText = `R$ ${orderState.price.toFixed(2)}`;
    document.getElementById('modal-qtd').innerText = orderState.quantity;
    
    const total = orderState.quantity * orderState.price;
    document.getElementById('modal-total-price').innerText = `R$ ${total.toFixed(2)}`;
}

// Gera um ID alfanumérico aleatório de 6 caracteres para segurança
function generateUniqueId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function confirmOrder() {
    const total = orderState.quantity * orderState.price;

    // 1. Salvar venda no banco
    await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            productName: orderState.name, 
            price: orderState.price, 
            quantity: orderState.quantity,
            total: total,
            waiter: 'Garçom 1' 
        })
    });

    // 2. Gerar HTML de impressão
    let printHTML = '';
    const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    
    // O loop cria uma ficha separada para CADA unidade comprada
    for (let i = 0; i < orderState.quantity; i++) {
        const securityCode = generateUniqueId(); // Gera um código novo para cada ficha
        
        printHTML += `
            <div class="ticket">
                <h3>Conteiner Beer</h3>
                <p>--- FICHA INDIVIDUAL ---</p>
                <h2>${orderState.name}</h2>
                <h1>R$ ${orderState.price.toFixed(2)}</h1>
                <p>CÓDIGO DE AUTENTICAÇÃO:</p>
                <div class="ticket-id">${securityCode}</div>
                <p>${dateStr}</p>
            </div>
        `;
    }

    document.getElementById('print-area').innerHTML = printHTML;
    
    // 3. Aguardar renderização no DOM e chamar impressão
    setTimeout(() => {
        window.print();
        closeModal();
        
        document.getElementById('search-input').value = '';
        renderWaiterGrid(allProducts);
    }, 100); // Um pequeno delay garante que o HTML foi inserido antes de abrir a janela de impressão
}