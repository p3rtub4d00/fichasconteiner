/* Dashboard administrativo profissional - camada visual separada.
   Não altera as regras do PDV. Este arquivo é carregado depois do app.js
   para substituir apenas a apresentação da Visão Geral. */
(function () {
    'use strict';

    function brl(value) {
        return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function updateConnectionStatus() {
        const el = document.getElementById('connection-status');
        if (!el) return;
        const online = navigator.onLine;
        el.className = `connection-badge ${online ? 'online' : 'offline'}`;
        el.innerHTML = `<span></span><strong>${online ? 'Online' : 'Sem internet'}</strong>`;
    }

    function renderOverview() {
        if (typeof currentDayOrders === 'undefined' || typeof allProducts === 'undefined') return;

        const orders = Array.isArray(currentDayOrders) ? currentDayOrders : [];
        const products = Array.isArray(allProducts) ? allProducts : [];
        const confirmed = orders.filter(order => !String(order.paymentMethod || '').includes('Pendente'));
        const revenue = confirmed.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

        setText('overview-sales-total', brl(revenue));
        setText('overview-order-count', `${orders.length} pedido${orders.length === 1 ? '' : 's'}`);

        const recent = [...orders]
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
            .slice(0, 5);
        const recentEl = document.getElementById('recent-sales-list');
        if (recentEl) {
            recentEl.innerHTML = recent.length ? recent.map(order => {
                const number = order.orderNumber || order._id?.slice(-6) || '—';
                const time = order.date
                    ? new Date(order.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                const status = String(order.paymentMethod || '').includes('Pendente')
                    ? 'Pendente'
                    : (order.paymentMethod || 'Venda');
                return `<div class="overview-row"><span class="overview-row-icon">🧾</span><div class="overview-row-main"><strong>Pedido #${number}</strong><small>${time} · ${status}</small></div><span class="overview-row-value">${brl(order.total)}</span></div>`;
            }).join('') : '<div class="overview-empty">Nenhuma venda registrada no período.</div>';
        }

        const productMap = {};
        orders.forEach(order => (order.items || []).forEach(item => {
            const key = item.productName || 'Produto';
            if (!productMap[key]) productMap[key] = { name: key, quantity: 0, total: 0 };
            productMap[key].quantity += Number(item.quantity) || 0;
            productMap[key].total += (Number(item.price) || 0) * (Number(item.quantity) || 0);
        }));

        const topProducts = Object.values(productMap)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
        const topEl = document.getElementById('top-products-list');
        if (topEl) {
            topEl.innerHTML = topProducts.length ? topProducts.map((item, index) => {
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                return `<div class="overview-row"><span class="overview-row-icon">${medals[index]}</span><div class="overview-row-main"><strong>${item.name}</strong><small>${item.quantity} unidade${item.quantity === 1 ? '' : 's'} vendida${item.quantity === 1 ? '' : 's'}</small></div><span class="overview-row-value">${brl(item.total)}</span></div>`;
            }).join('') : '<div class="overview-empty">Ainda não há produtos vendidos no período.</div>';
        }

        const critical = products
            .filter(product => Number(product.stock) <= 5)
            .sort((a, b) => Number(a.stock) - Number(b.stock))
            .slice(0, 5);
        setText('overview-stock-count', `${critical.length} item${critical.length === 1 ? '' : 's'}`);
        const criticalEl = document.getElementById('critical-stock-list');
        if (criticalEl) {
            criticalEl.innerHTML = critical.length ? critical.map(product => {
                const stock = Number(product.stock) || 0;
                return `<div class="overview-row"><span class="overview-row-icon">⚠️</span><div class="overview-row-main"><strong>${product.name}</strong><small>Estoque atual · mínimo ${product.minStock ?? 5}</small></div><span class="overview-row-value" style="color:${stock <= 0 ? 'var(--danger)' : 'var(--primary)'}">${stock} un.</span></div>`;
            }).join('') : '<div class="overview-empty">Estoque saudável. Nenhum item crítico.</div>';
        }

        const chart = document.getElementById('sales-hour-chart');
        if (chart) {
            const hours = Array.from({ length: 10 }, (_, index) => index + 12);
            const buckets = hours.map(hour => ({
                hour,
                total: confirmed
                    .filter(order => new Date(order.date || 0).getHours() === hour)
                    .reduce((sum, order) => sum + (Number(order.total) || 0), 0)
            }));
            const max = Math.max(...buckets.map(item => item.total), 1);
            chart.innerHTML = buckets.map(item => {
                const height = Math.max(4, Math.round((item.total / max) * 100));
                return `<div class="sales-hour-bar"><span class="bar-value">${item.total ? brl(item.total) : ''}</span><div class="bar" style="height:${height}%"></div><span class="hour">${String(item.hour).padStart(2, '0')}h</span></div>`;
            }).join('');
        }

        updateConnectionStatus();
    }

    // Sobrescreve somente a navegação da Visão Geral; as páginas existentes permanecem iguais.
    window.openAdminPage = function (page) {
        const isOverview = page === 'overview';
        const summary = document.getElementById('admin-summary');
        const overview = document.getElementById('admin-overview');
        const workspace = document.querySelector('.admin-workspace');

        if (summary) summary.style.display = isOverview ? 'grid' : 'none';
        if (overview) overview.style.display = isOverview ? 'block' : 'none';
        if (workspace) workspace.style.display = isOverview ? 'none' : 'grid';

        document.querySelectorAll('[data-admin-section]').forEach(section => {
            section.style.display = section.dataset.adminSection === page ? '' : 'none';
        });
        document.querySelectorAll('.admin-nav [data-admin-page]').forEach(button => {
            button.classList.toggle('active', button.dataset.adminPage === page);
        });

        if (isOverview) renderOverview();
        document.getElementById('admin-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const originalUpdate = window.updateAdminDashboard;
    window.updateAdminDashboard = function () {
        if (typeof originalUpdate === 'function') originalUpdate();
        renderOverview();
    };

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    window.addEventListener('load', () => setTimeout(() => {
        updateConnectionStatus();
        if (document.getElementById('admin-view')?.classList.contains('active')) renderOverview();
    }, 100));
})();
