const API_URL = '/api';

let catalog = [];
let cart = [];
let allCategories = [];
let currentCategory = 'Todas';
let pixInterval = null;

window.onload = async () => {
    await fetchCategories();
    await fetchCatalog();
};

async function fetchCategories() {
    try {
        const res = await fetch(`${API_URL}/categories`);
        allCategories = await res.json();
        const tabs = document.getElementById('category-tabs');
        
        const onlineCategories = allCategories.filter(c => c.showOnline !== false);
        
        let html = `<button class="tab active" onclick="filterCatalog('Todas', this)">Todas</button>`;
        onlineCategories.forEach(c => {
            html += `<button class="tab" onclick="filterCatalog('${c.name}', this)">${c.name}</button>`;
        });
        tabs.innerHTML = html;
    } catch (e) {
        console.error("Erro ao carregar categorias", e);
    }
}

async function fetchCatalog() {
    try {
        const res = await fetch(`${API_URL}/products`);
        const allProducts = await res.json();
        
        const onlineCatNames = allCategories.filter(c => c.showOnline !== false).map(c => c.name);
        
        catalog = allProducts.filter(p => p.stock > 0 && onlineCatNames.includes(p.category));
        renderCatalog();
    } catch (e) {
        document.getElementById('catalog-grid').innerHTML = '<p style="color:red; text-align:center; width:100%;">Erro ao carregar produtos. Tente novamente.</p>';
    }
}

function filterCatalog(cat, btn) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = cat;
    renderCatalog();
}

function renderCatalog() {
    const grid = document.getElementById('catalog-grid');
    const filtered = catalog.filter(p => currentCategory === 'Todas' || p.category === currentCategory);

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; color:var(--text-muted);">Nenhum produto disponÃ­vel nesta categoria.</p>';
        return;
    }

    grid.innerHTML = filtered.map(p => {
        return `
        <div class="card">
            <h3>${p.name}</h3>
            <div class="price">R$ ${p.price.toFixed(2)}</div>
            <div class="stock">DisponÃ­vel: ${p.stock}</div>
            <button onclick="addToCart('${p._id}')">Adicionar</button>
        </div>`;
    }).join('');
}

function addToCart(productId) {
    const product = catalog.find(p => p._id === productId);
    const existing = cart.find(item => item.id === productId);
    
    if ((existing ? existing.quantity : 0) + 1 > product.stock) {
        return alert(`Estoque limite atingido! Temos apenas ${product.stock} unidades.`);
    }

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ 
            id: product._id, 
            productName: product.name, 
            price: product.price, 
            quantity: 1, 
            ticketCount: product.ticketCount || 1, 
            isWholesale: true 
        });
    }
    updateCartUI();
}

function changeCartQtd(id, amount) {
    const item = cart.find(i => i.id === id); 
    const product = catalog.find(p => p._id === id);
    
    if (item.quantity + amount > product.stock) {
        return alert(`Estoque limite atingido!`);
    }
    
    item.quantity += amount; 
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== id);
    }
    updateCartUI();
}

function updateCartUI() {
    const floatBtn = document.getElementById('cart-floating-btn');
    const totalItems = cart.reduce((s, i) => s + i.quantity, 0); 
    const totalPrice = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    
    if (totalItems > 0) {
        floatBtn.classList.add('active');
        document.getElementById('cart-qty').innerText = `${totalItems} itens`;
        document.getElementById('cart-total-float').innerText = `R$ ${totalPrice.toFixed(2)}`;
    } else {
        floatBtn.classList.remove('active');
        closeModal('cart-modal');
    }

    document.getElementById('cart-items').innerHTML = cart.map(item => `
        <li>
            <div>
                <strong>${item.productName}</strong><br>
                <small style="color:var(--primary);">R$ ${item.price.toFixed(2)} un</small>
            </div>
            <div class="qty-controls">
                <button onclick="changeCartQtd('${item.id}', -1)">-</button>
                <span>${item.quantity}</span>
                <button onclick="changeCartQtd('${item.id}', 1)">+</button>
            </div>
        </li>
    `).join('');
    
    document.getElementById('cart-modal-total').innerText = `R$ ${totalPrice.toFixed(2)}`;
}

function openCart() { document.getElementById('cart-modal').classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function openCheckout() {
    if (cart.length === 0) return;
    closeModal('cart-modal');
    document.getElementById('checkout-modal').classList.add('active');
    updateCheckoutTotals();
}

function updateCheckoutTotals() {
    const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    document.getElementById('chk-subtotal').innerText = `R$ ${total.toFixed(2)}`;
    document.getElementById('chk-total').innerText = `R$ ${total.toFixed(2)}`;
    window.currentCheckoutTotal = total;
}

async function processPayment(metodo) {
    const clientName = document.getElementById('checkout-name') ? document.getElementById('checkout-name').value.trim() : '';
    const clientPhone = document.getElementById('checkout-phone') ? document.getElementById('checkout-phone').value.trim() : '';
    
    if (!clientName) {
        return alert('Por favor, preencha o seu nome para continuar!');
    }
    
    window.currentCustomerName = clientName;
    window.currentCustomerPhone = clientPhone || 'NÃ£o informado';

    let paymentString = `Pedido Online: ${metodo} | Pendente (Aguardando ConfirmaÃ§Ã£o)`;

    if (metodo === 'Pix') {
        closeModal('checkout-modal');
        document.getElementById('pix-modal').classList.add('active');
        try {
            const res = await fetch(`${API_URL}/pix`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ total: window.currentCheckoutTotal }) 
            });
            const pixData = await res.json();
            
            document.getElementById('pix-container').innerHTML = `<img src="data:image/jpeg;base64,${pixData.qr_code_base64}">`;
            
            pixInterval = setInterval(async () => {
                const check = await fetch(`${API_URL}/pix/${pixData.id}`); 
                const st = await check.json();
                if (st.status === 'approved') { 
                    clearInterval(pixInterval); 
                    document.getElementById('pix-status').innerText = 'âœ… PAGO!'; 
                    setTimeout(() => finalizeOrder(paymentString), 1500); 
                }
            }, 3000);
        } catch (e) {
            alert('Erro ao gerar PIX. Escolha pagar na retirada/entrega.');
            cancelPix();
        }
    } else {
        finalizeOrder(paymentString);
    }
}

function cancelPix() {
    clearInterval(pixInterval);
    closeModal('pix-modal');
    openCheckout();
}

async function finalizeOrder(paymentMethodString) {
    try {
        const res = await fetch(`${API_URL}/orders`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                items: cart, 
                total: window.currentCheckoutTotal, 
                paymentMethod: paymentMethodString, 
                waiter: 'Pedido Online (Site)',
                customerName: window.currentCustomerName,
                customerPhone: window.currentCustomerPhone
            }) 
        });
        
        if (!res.ok) throw new Error('Erro');
        const data = await res.json();
        const orderCode = data.order ? data.order.orderNumber : 'ONLINE';
        
        if(document.getElementById('success-order-id')) {
            document.getElementById('success-order-id').innerText = `Pedido #${orderCode}`;
        }
        
        setupWhatsAppButton(paymentMethodString, orderCode);

        cart = [];
        updateCartUI();
        closeModal('checkout-modal');
        closeModal('pix-modal');
        document.getElementById('success-modal').classList.add('active');
        
    } catch (e) {
        alert('Erro ao registrar o pedido. Por favor, contate o balcÃ£o.');
    }
}

function setupWhatsAppButton(info, orderCode) {
    const numeroLoja = "556999695779";
    
    let texto = `*OlÃ¡, acabei de fazer o Pedido #${orderCode} e gostaria de confirmar!*\n\n`;
    texto += `ðŸ‘¤ *Cliente:* ${window.currentCustomerName}\n`;
    texto += `ðŸ“ž *Telefone:* ${window.currentCustomerPhone}\n\n`;
    
    cart.forEach(item => {
        texto += `â–ªï¸ ${item.quantity}x ${item.productName} (R$ ${(item.price * item.quantity).toFixed(2)})\n`;
    });
    
    texto += `\n*Pagamento:* ${info}`;
    texto += `\n*Total dos Produtos:* R$ ${window.currentCheckoutTotal.toFixed(2)}`;
    
    const url = `https://wa.me/${numeroLoja}?text=${encodeURIComponent(texto)}`;
    
    document.getElementById('btn-whatsapp').onclick = () => {
        window.open(url, '_blank');
    };
}