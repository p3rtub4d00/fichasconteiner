const SW_VERSION = 'conteiner-beer-v6-images';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Injeta somente o modulo visual de imagens no app.js.
// Nao altera regras de venda, estoque, PIX ou comandas.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.endsWith('/app.js')) return;
  event.respondWith((async () => {
    const response = await fetch(event.request);
    if (!response.ok) return response;
    const moduleResponse = await fetch('/product-images.js', { cache: 'no-store' });
    const moduleSource = moduleResponse.ok ? await moduleResponse.text() : '';
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/javascript; charset=utf-8');
    return new Response((await response.text()) + '\n\n' + moduleSource, { status: response.status, statusText: response.statusText, headers });
  })());
});
