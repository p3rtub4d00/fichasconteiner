self.addEventListener('install', (event) => {
    console.log('Service Worker Instalado - Pronto para virar App!');
});

self.addEventListener('fetch', (event) => {
    // Mantém as requisições normais online
});