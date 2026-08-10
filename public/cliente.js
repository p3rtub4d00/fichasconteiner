const API_URL = '/api';

// Tabela de fretes para Porto Velho (pode alterar os valores e nomes livremente)
const taxasDeEntrega = {
    "Centro": 5.00,
    "Olaria / Arigolândia / Caiari": 7.00,
    "Zona Sul (Jatuarana, Castanheira, etc)": 15.00,
    "Zona Leste (Av. Amazonas, Socialista, etc)": 18.00,
    "Zona Norte (Nacional, Rio Madeira)": 12.00,
    "Outras Regiões (Consultar)": 20.00
};

let catalog = [];
let cart = [];
let pixInterval = null;

window.onload = async () => {
    loadDeliveryZones();
    await fetchCatalog();
};

async function fetchCatalog() {
    try {
        const res = await fetch(`${API_URL}/products`);
        const allProducts = await res.json();
        
        // Filtra apenas produtos de atacado que tenham estoque
        catalog = allProducts.filter(p => p.isWholesale === true && p.stock > 0);
        renderCatalog();
    } catch (e) {
        document.getElementById('catalog-grid').innerHTML = '<p style="color:red; text-align:center; width:100%;">Erro ao carregar produtos. Tente novamente.</p>';
    }
}

function renderCatalog() {
    const grid = document.getElementById('catalog-grid');
    if (catalog.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; color:var(--text-muted);">Nenhum produto de atacado disponível no momento.</p>';
        return;
    }

    grid.innerHTML = catalog.map(p => {
        return `
        <div class="card">
            <h3>${p.name}</h3>
            <div class="price">R$ ${p.price.toFixed(2)}</div>
            <div class="stock">Disponível: ${p.stock}</div>
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
        // Formato exato que o backend e a impressora (app.js) precisam
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
        document.getElementById('cart-total').innerText = `R$ ${totalPrice.toFixed(2)}`;
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
}

function loadDeliveryZones() {
    const select = document.getElementById('delivery-zone');
    select.innerHTML = Object.keys(taxasDeEntrega).map(zone => 
        `<option value="${zone}">${zone} - R$ ${taxasDeEntrega[zone].toFixed(2)}</option>`
    ).join('');
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
    const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const isDelivery = document.getElementById('delivery-type').value === 'entrega';
    
    document.getElementById('address-section').style.display = isDelivery ? 'block' : 'none';
    
    let frete = 0;
    if (isDelivery) {
        const zone = document.getElementById('delivery-zone').value;
        frete = taxasDeEntrega[zone] || 0;
    }
    
    const total = subtotal + frete;
    
    document.getElementById('chk-subtotal').innerText = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('chk-frete').innerText = `R$ ${frete.toFixed(2)}`;
    document.getElementById('chk-total').innerText = `R$ ${total.toFixed(2)}`;
    
    // Guarda o valor total na janela para a função de pagamento usar
    window.currentCheckoutTotal = total;
    window.currentFrete = frete;
}

async function processPayment(metodo) {
    const isDelivery = document.getElementById('delivery-type').value === 'entrega';
    const zone = document.getElementById('delivery-zone').value;
    const address = document.getElementById('delivery-address').value;
    
    if (isDelivery && address.trim() === '') {
        return alert('Por favor, informe o endereço de entrega completo.');
    }

    // Prepara a informação do método de pagamento que vai ser impressa no balcão!
    let paymentString = '';
    if (isDelivery) {
        paymentString = `${metodo} | ENTREGA: ${zone} (${address}) - Frete: R$${window.currentFrete.toFixed(2)}`;
    } else {
        paymentString = `${metodo} | RETIRAR NO BALCÃO`;
    }

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
                    document.getElementById('pix-status').innerText = '✅ PAGO!'; 
                    setTimeout(() => finalizeOrder(paymentString), 1500); 
                }
            }, 3000);
        } catch (e) {
            alert('Erro ao gerar PIX. Tente pagar na entrega.');
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
                waiter: 'Pedido Online (Site)' // Identifica no painel de onde veio
            }) 
        });
        
        if (!res.ok) throw new Error('Erro');
        
        // Setup WhatsApp Message
        setupWhatsAppButton(paymentMethodString);

        // Limpa carrinho e mostra sucesso
        cart = [];
        updateCartUI();
        closeModal('checkout-modal');
        closeModal('pix-modal');
        document.getElementById('success-modal').classList.add('active');
        
    } catch (e) {
        alert('Erro ao registrar o pedido. Por favor, contate o balcão.');
    }
}

function setupWhatsAppButton(info) {
    const numeroLoja = "5569999999999"; // COLOQUE O SEU NÚMERO DO WHATSAPP AQUI (DDD + Numero sem espaço)
    
    let texto = `*Novo Pedido Online!*\n\n`;
    let sub = 0;
    cart.forEach(item => {
        texto += `${item.quantity}x ${item.productName} (R$ ${(item.price * item.quantity).toFixed(2)})\n`;
        sub += (item.price * item.quantity);
    });
    
    texto += `\n*Detalhes:* ${info}`;
    texto += `\n*Total a pagar:* R$ ${window.currentCheckoutTotal.toFixed(2)}`;
    
    const url = `https://wa.me/${numeroLoja}?text=${encodeURIComponent(texto)}`;
    
    document.getElementById('btn-whatsapp').onclick = () => {
        window.open(url, '_blank');
    };
}
