(() => {
  'use strict';

  // Correção isolada da impressão. Não altera vendas, estoque, comandas ou checkout.
  const style = document.createElement('style');
  style.id = 'conteiner-beer-print-fix';
  style.textContent = `
    @media print {
      @page { size: 58mm auto; margin: 0; }

      html, body {
        width: 58mm !important;
        min-width: 58mm !important;
        max-width: 58mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        overflow: visible !important;
      }

      /* Não imprime a tela do PDV. Isso inclui o botão "Imagens dos produtos". */
      body * { visibility: hidden !important; }
      #print-area, #print-area * { visibility: visible !important; }

      #print-area {
        display: block !important;
        position: fixed !important;
        left: 50% !important;
        top: 0 !important;
        transform: translateX(-50%) !important;
        width: 48mm !important;
        max-width: 48mm !important;
        min-width: 48mm !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        overflow: visible !important;
        box-sizing: border-box !important;
      }

      #print-area .ticket {
        display: block !important;
        position: relative !important;
        width: 48mm !important;
        max-width: 48mm !important;
        min-width: 48mm !important;
        height: auto !important;
        margin: 0 auto !important;
        padding: 2mm 0 4mm !important;
        box-sizing: border-box !important;
        overflow: visible !important;
        overflow-wrap: anywhere !important;
        page-break-after: auto !important;
        break-after: auto !important;
        background: #fff !important;
        color: #000 !important;
      }

      #print-area .ticket h1 { font-size: 21px !important; line-height: 1.05 !important; margin: 2px 0 !important; }
      #print-area .ticket h2 { font-size: 15px !important; line-height: 1.1 !important; margin: 2px 0 !important; }
      #print-area .ticket h3 { font-size: 11px !important; line-height: 1.1 !important; margin: 1px 0 !important; }
      #print-area .ticket p { font-size: 8px !important; line-height: 1.15 !important; margin: 1px 0 !important; }
      #print-area .ticket table { width: 100% !important; max-width: 48mm !important; min-width: 0 !important; table-layout: fixed !important; border-collapse: collapse !important; }
      #print-area .ticket td, #print-area .ticket th { font-size: 8px !important; line-height: 1.15 !important; padding: 0.5px 0 !important; word-break: break-word !important; }
      #print-area .ticket img { max-width: 100% !important; }

      /* Reforço: nenhum controle da interface deve entrar na impressão. */
      button, input, select, textarea, nav, header, footer, .modal, [role="dialog"] {
        visibility: hidden !important;
      }
    }
  `;
  document.head.appendChild(style);

  const LOCK_PREFIX = 'conteiner-beer:print-lock:';
  const LOCK_TTL = 90000;
  let cycleRunning = false;

  function getLock(id) {
    try {
      const raw = localStorage.getItem(LOCK_PREFIX + id);
      if (!raw) return false;
      const time = Number(raw);
      if (!time || Date.now() - time > LOCK_TTL) {
        localStorage.removeItem(LOCK_PREFIX + id);
        return false;
      }
      return true;
    } catch (_) { return false; }
  }

  function setLock(id) {
    try { localStorage.setItem(LOCK_PREFIX + id, String(Date.now())); } catch (_) {}
  }

  const printQueue = [];
  let queueBusy = false;

  function processQueue() {
    if (queueBusy || !printQueue.length) return;
    queueBusy = true;
    const tickets = printQueue.shift();
    let index = 0;

    const next = () => {
      if (index >= tickets.length) {
        const area = document.getElementById('print-area');
        if (area) area.innerHTML = '';
        queueBusy = false;
        processQueue();
        return;
      }

      const ticket = tickets[index++];
      const area = document.getElementById('print-area');
      if (!area) {
        queueBusy = false;
        processQueue();
        return;
      }

      area.innerHTML = ticket;
      window.print();
      setTimeout(next, 2000);
    };

    next();
  }

  window.printTicketsOneByOne = function(tickets, index = 0) {
    if (!Array.isArray(tickets) || index !== 0 || !tickets.length) return;
    printQueue.push(tickets.slice());
    processQueue();
  };

  window.checkNewOrdersForPrint = async function() {
    const adminView = document.getElementById('admin-view');
    if (!adminView || !adminView.classList.contains('active') || cycleRunning) return;
    cycleRunning = true;

    try {
      const resOrders = await fetch(`${API_URL}/orders/pending`, { cache: 'no-store' });
      const orders = await resOrders.json();

      for (const order of (Array.isArray(orders) ? orders : [])) {
        const id = order?._id;
        if (!id || getLock(id)) continue;
        setLock(id);
        try {
          printOrderAutomatically(order);
          await fetch(`${API_URL}/orders/${id}/printed`, { method: 'PUT' });
        } catch (error) {
          console.log('Erro ao imprimir pedido', error);
        }
      }

      const resTables = await fetch(`${API_URL}/tables/pending-prints`, { cache: 'no-store' });
      const tables = await resTables.json();
      for (const table of (Array.isArray(tables) ? tables : [])) {
        const id = table?._id;
        if (!id || getLock(`table:${id}`)) continue;
        setLock(`table:${id}`);
        try {
          printTableConferenceAutomatically(table);
          await fetch(`${API_URL}/tables/${id}/clear-print`, { method: 'PUT' });
        } catch (error) {
          console.log('Erro ao imprimir conferência', error);
        }
      }
    } catch (error) {
      console.log('Erro na checagem de impressao', error);
    } finally {
      cycleRunning = false;
    }
  };
})();
