const SW_VERSION = 'conteiner-beer-v7-print-fix';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Injeta somente os modulos ja existentes e o ajuste isolado de impressao.
// Nao altera regras de venda, estoque, PIX ou comandas.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.endsWith('/app.js')) return;
  event.respondWith((async () => {
    const response = await fetch(event.request);
    if (!response.ok) return response;
    const moduleResponse = await fetch('/product-images.js', { cache: 'no-store' });
    const printResponse = await fetch('/print-fix.js', { cache: 'no-store' });
    const moduleSource = moduleResponse.ok ? await moduleResponse.text() : '';
    const printSource = printResponse.ok ? await printResponse.text() : '';
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/javascript; charset=utf-8');
    return new Response((await response.text()) + '\n\n' + moduleSource + '\n\n' + printSource, { status: response.status, statusText: response.statusText, headers });
  })());
});
