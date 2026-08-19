/* Dashboard administrativo profissional - camada visual isolada.
   Não altera regras do PDV. Cria apenas a Visão Geral e seus indicadores. */
(function () {
    'use strict';

    const dashboardStyle = `
        #admin-overview{display:none;margin:0 0 16px}
        .overview-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:4px 2px 18px;margin-bottom:14px;border-bottom:1px solid var(--border)}
        .overview-eyebrow{display:block;color:var(--primary);font-size:10px;font-weight:800;letter-spacing:1.4px;margin-bottom:6px}
        .overview-top h2{font-size:22px;letter-spacing:-.6px;margin:0 0 5px;color:var(--text-main)}
        .overview-top p{font-size:11px;color:var(--text-muted);line-height:1.5}
        .connection-badge{display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:999px;border:1px solid rgba(36,200,138,.22);background:rgba(36,200,138,.07);color:var(--success);font-size:10px;white-space:nowrap}
        .connection-badge span{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px rgba(36,200,138,.09)}
        .connection-badge.offline{color:var(--danger);border-color:rgba(239,91,99,.25);background:rgba(239,91,99,.07)}
        .overview-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.85fr);gap:14px}
        .overview-card{min-width:0;padding:18px;background:linear-gradient(145deg,rgba(20,27,39,.98),rgba(14,19,28,.98));border:1px solid var(--border);border-radius:16px;box-shadow:0 10px 28px rgba(0,0,0,.09)}
        .overview-chart-card{grid-row:span 2}
        .overview-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:15px}
        .overview-label{display:block;color:var(--text-soft);font-size:9px;font-weight:800;letter-spacing:1px;margin-bottom:4px}
        .overview-card h3{font-size:13px;color:var(--text-main);margin:0}
        .overview-total{font-size:16px;font-weight:800;color:var(--success)}
        .overview-mini-badge{padding:5px 8px;border-radius:999px;background:rgba(77,163,255,.09);color:var(--info);font-size:9px;font-weight:800;white-space:nowrap}
        .overview-mini-badge.warning{background:rgba(247,181,27,.1);color:var(--primary)}
        .sales-hour-chart{height:190px;display:flex;align-items:flex-end;gap:8px;padding:8px 2px 0}
        .sales-hour-bar{flex:1;min-width:18px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px}
        .sales-hour-bar .bar-value{font-size:8px;color:var(--text-soft);min-height:10px;white-space:nowrap}
        .sales-hour-bar .bar{width:100%;max-width:32px;min-height:4px;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,var(--primary),rgba(247,181,27,.25));transition:height .35s ease}
        .sales-hour-bar .hour{font-size:8px;color:var(--text-muted)}
        .overview-list{display:flex;flex-direction:column;gap:7px;max-height:184px;overflow:auto}
        .overview-row{display:flex;align-items:center;gap:9px;padding:9px 10px;border:1px solid transparent;border-radius:10px;background:rgba(255,255,255,.03)}
        .overview-row:hover{border-color:var(--border)}
        .overview-row-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:var(--primary-soft);font-size:13px;flex:0 0 auto}
        .overview-row-main{min-width:0;flex:1}
        .overview-row-main strong{display:block;color:var(--text-main);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .overview-row-main small{display:block;color:var(--text-muted);font-size:9px;margin-top:2px}
        .overview-row-value{font-size:10px;font-weight:800;color:var(--text-main);white-space:nowrap}
        .overview-empty{padding:22px 10px;text-align:center;color:var(--text-muted);font-size:10px;border:1px dashed var(--border);border-radius:10px}
        .overview-quick-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}
        .overview-quick-actions button{display:grid;grid-template-columns:34px 1fr 14px;align-items:center;gap:9px;text-align:left;padding:11px;background:rgba(255,255,255,.035);border:1px solid var(--border);color:var(--text-main);box-shadow:none}
        .overview-quick-actions button:hover{border-color:rgba(247,181,27,.45);background:rgba(247,181,27,.05)}
        .overview-quick-actions button>span{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:var(--primary-soft);font-size:15px}
        .overview-quick-actions button div{min-width:0}.overview-quick-actions strong,.overview-quick-actions small{display:block}.overview-quick-actions strong{font-size:10px}.overview-quick-actions small{font-size:8px;color:var(--text-muted);margin-top:3px}.overview-quick-actions b{color:var(--primary);font-size:15px}
        @media(max-width:1050px){.overview-grid{grid-template-columns:1fr}.overview-chart-card{grid-row:auto}.overview-quick-actions{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:760px){.overview-top{flex-direction:column}.overview-quick-actions{grid-template-columns:1fr}.sales-hour-chart{gap:4px}.sales-hour-bar .hour{font-size:7px}.overview-card{padding:14px}}
    `;

    const dashboardHtml = `
        <section id="admin-overview" class="admin-overview" aria-label="Visão geral do negócio">
            <div class="overview-top">
                <div><span class="overview-eyebrow">CENTRAL DE OPERAÇÃO</span><h2>Visão geral do negócio</h2><p>Acompanhe o movimento do dia e acesse rapidamente as áreas mais importantes.</p></div>
                <div id="connection-status" class="connection-badge online"><span></span><strong>Online</strong></div>
            </div>
            <div class="overview-grid">
                <section class="overview-card overview-chart-card"><div class="overview-card-head"><div><span class="overview-label">MOVIMENTO DO DIA</span><h3>Vendas por horário</h3></div><span id="overview-sales-total" class="overview-total">R$ 0,00</span></div><div id="sales-hour-chart" class="sales-hour-chart"></div></section>
                <section class="overview-card"><div class="overview-card-head"><div><span class="overview-label">ATIVIDADE</span><h3>Vendas recentes</h3></div><span id="overview-order-count" class="overview-mini-badge">0 pedidos</span></div><div id="recent-sales-list" class="overview-list"></div></section>
                <section class="overview-card"><div class="overview-card-head"><div><span class="overview-label">DESEMPENHO</span><h3>Produtos mais vendidos</h3></div></div><div id="top-products-list" class="overview-list"></div></section>
                <section class="overview-card"><div class="overview-card-head"><div><span class="overview-label">ATENÇÃO</span><h3>Estoque crítico</h3></div><span id="overview-stock-count" class="overview-mini-badge warning">0 itens</span></div><div id="critical-stock-list" class="overview-list"></div></section>
            </div>
            <div class="overview-quick-actions">
                <button onclick="openAdminPage('sales')"><span>💰</span><div><strong>Vendas & Caixa</strong><small>Faturamento e movimentações</small></div><b>→</b></button>
                <button onclick="openAdminPage('products')"><span>📦</span><div><strong>Produtos & Estoque</strong><small>Produtos e reposição</small></div><b>→</b></button>
                <button onclick="openAdminPage('customers')"><span>👥</span><div><strong>Clientes & Clube</strong><small>Crédito, fiado e clientes</small></div><b>→</b></button>
                <button onclick="openAdminPage('tables')"><span>🪑</span><div><strong>Mesas & Comandas</strong><small>Acompanhar atendimento</small></div><b>→</b></button>
            </div>
        </section>`;

    function brl(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
    function updateConnectionStatus() { const el = document.getElementById('connection-status'); if (!el) return; const online = navigator.onLine; el.className = `connection-badge ${online ? 'online' : 'offline'}`; el.innerHTML = `<span></span><strong>${online ? 'Online' : 'Sem internet'}</strong>`; }

    function mountDashboard() {
        if (document.getElementById('admin-overview')) return true;
        const admin = document.getElementById('admin-view');
        const summary = document.getElementById('admin-summary');
        if (!admin || !summary) return false;
        const style = document.createElement('style'); style.id = 'dashboard-professional-style'; style.textContent = dashboardStyle; document.head.appendChild(style);
        summary.insertAdjacentHTML('afterend', dashboardHtml);
        return true;
    }

    function renderOverview() {
        if (!mountDashboard() || typeof currentDayOrders === 'undefined' || typeof allProducts === 'undefined') return;
        const orders = Array.isArray(currentDayOrders) ? currentDayOrders : [];
        const products = Array.isArray(allProducts) ? allProducts : [];
        const confirmed = orders.filter(order => !String(order.paymentMethod || '').includes('Pendente'));
        const revenue = confirmed.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
        setText('overview-sales-total', brl(revenue)); setText('overview-order-count', `${orders.length} pedido${orders.length === 1 ? '' : 's'}`);
        const recent = [...orders].sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).slice(0,5);
        const recentEl=document.getElementById('recent-sales-list');
        if(recentEl) recentEl.innerHTML=recent.length?recent.map(order=>{const number=order.orderNumber||order._id?.slice(-6)||'—';const time=order.date?new Date(order.date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'--:--';const status=String(order.paymentMethod||'').includes('Pendente')?'Pendente':(order.paymentMethod||'Venda');return `<div class="overview-row"><span class="overview-row-icon">🧾</span><div class="overview-row-main"><strong>Pedido #${number}</strong><small>${time} · ${status}</small></div><span class="overview-row-value">${brl(order.total)}</span></div>`;}).join(''):'<div class="overview-empty">Nenhuma venda registrada no período.</div>';
        const productMap={}; orders.forEach(order=>(order.items||[]).forEach(item=>{const key=item.productName||'Produto';if(!productMap[key])productMap[key]={name:key,quantity:0,total:0};productMap[key].quantity+=Number(item.quantity)||0;productMap[key].total+=(Number(item.price)||0)*(Number(item.quantity)||0);}));
        const topProducts=Object.values(productMap).sort((a,b)=>b.quantity-a.quantity).slice(0,5);const topEl=document.getElementById('top-products-list');
        if(topEl)topEl.innerHTML=topProducts.length?topProducts.map((item,index)=>`<div class="overview-row"><span class="overview-row-icon">${['🥇','🥈','🥉','4️⃣','5️⃣'][index]}</span><div class="overview-row-main"><strong>${item.name}</strong><small>${item.quantity} unidade${item.quantity===1?'':'s'} vendida${item.quantity===1?'':'s'}</small></div><span class="overview-row-value">${brl(item.total)}</span></div>`).join(''):'<div class="overview-empty">Ainda não há produtos vendidos no período.</div>';
        const critical=[...products].filter(product=>Number(product.stock)<=5).sort((a,b)=>Number(a.stock)-Number(b.stock)).slice(0,5);setText('overview-stock-count',`${critical.length} item${critical.length===1?'':'s'}`);const criticalEl=document.getElementById('critical-stock-list');
        if(criticalEl)criticalEl.innerHTML=critical.length?critical.map(product=>{const stock=Number(product.stock)||0;return `<div class="overview-row"><span class="overview-row-icon">⚠️</span><div class="overview-row-main"><strong>${product.name}</strong><small>Estoque atual · mínimo ${product.minStock??5}</small></div><span class="overview-row-value" style="color:${stock<=0?'var(--danger)':'var(--primary)'}">${stock} un.</span></div>`;}).join(''):'<div class="overview-empty">Estoque saudável. Nenhum item crítico.</div>';
        const chart=document.getElementById('sales-hour-chart');if(chart){const hours=Array.from({length:10},(_,i)=>i+12);const buckets=hours.map(hour=>({hour,total:confirmed.filter(order=>new Date(order.date||0).getHours()===hour).reduce((sum,order)=>sum+(Number(order.total)||0),0)}));const max=Math.max(...buckets.map(item=>item.total),1);chart.innerHTML=buckets.map(item=>{const height=Math.max(4,Math.round((item.total/max)*100));return `<div class="sales-hour-bar"><span class="bar-value">${item.total?brl(item.total):''}</span><div class="bar" style="height:${height}%"></div><span class="hour">${String(item.hour).padStart(2,'0')}h</span></div>`;}).join('');}
        updateConnectionStatus();
    }

    const originalOpen = window.openAdminPage;
    window.openAdminPage = function(page) {
        if (!mountDashboard()) return typeof originalOpen === 'function' ? originalOpen(page) : undefined;
        const isOverview=page==='overview';const summary=document.getElementById('admin-summary');const overview=document.getElementById('admin-overview');const workspace=document.querySelector('.admin-workspace');
        if(summary)summary.style.display=isOverview?'grid':'none';if(overview)overview.style.display=isOverview?'block':'none';if(workspace)workspace.style.display=isOverview?'none':'grid';
        document.querySelectorAll('[data-admin-section]').forEach(section=>{section.style.display=section.dataset.adminSection===page?'':'none';});document.querySelectorAll('.admin-nav [data-admin-page]').forEach(button=>button.classList.toggle('active',button.dataset.adminPage===page));
        if(isOverview)renderOverview();document.getElementById('admin-view')?.scrollIntoView({behavior:'smooth',block:'start'});
    };

    const originalUpdate=window.updateAdminDashboard;
    window.updateAdminDashboard=function(){if(typeof originalUpdate==='function')originalUpdate();renderOverview();};
    window.addEventListener('online',updateConnectionStatus);window.addEventListener('offline',updateConnectionStatus);
    window.addEventListener('load',()=>setTimeout(()=>{mountDashboard();updateConnectionStatus();if(document.getElementById('admin-view')?.classList.contains('active'))renderOverview();},100));
})();
