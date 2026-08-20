/* Conteiner Beer - carregamento automatico de imagens dos produtos */
(() => {
  'use strict';

  const CACHE_KEY = 'conteiner-beer:auto-product-images:v3';
  const pending = new Map();
  let cache = {};

  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (_) { cache = {}; }

  const style = document.createElement('style');
  style.textContent = `
    .cb-auto-photo-wrap{width:100%;display:block;margin:0 0 10px}
    .cb-auto-photo{width:100%;height:110px;object-fit:contain;border-radius:11px;background:#0b1018;border:1px solid rgba(255,255,255,.06);display:block;padding:5px}
    .cb-auto-photo-loading{height:110px;width:100%;border-radius:11px;background:linear-gradient(90deg,#101722,#182131,#101722);background-size:200% 100%;animation:cbPhotoPulse 1.4s infinite;margin:0 0 10px}
    .cb-auto-photo-empty{height:110px;width:100%;border-radius:11px;background:#0b1018;border:1px dashed rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px;margin:0 0 10px}
    @keyframes cbPhotoPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}
    @media(max-width:600px){.cb-auto-photo,.cb-auto-photo-loading,.cb-auto-photo-empty{height:92px}}
  `;
  document.head.appendChild(style);

  function saveCache(){ try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {} }

  function normalize(value){
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  }

  function variants(name){
    const original = String(name || '').trim();
    const normalized = normalize(original);
    const withoutSize = normalized.replace(/\b\d+(?:[.,]\d+)?\s*(ml|l|g|kg|un|unidade|unidades|litro|litros)\b/g,' ').replace(/\s+/g,' ').trim();
    const withoutGeneric = withoutSize.replace(/\b(lata|latinha|garrafa|pet|long neck|litrao|litrao)\b/g,' ').replace(/\s+/g,' ').trim();
    return [...new Set([original, normalized, withoutSize, withoutGeneric].filter(Boolean))];
  }

  function similarity(a,b){
    const A=normalize(a), B=normalize(b);
    if(!A||!B)return 0;
    if(A===B)return 1;
    const aw=A.split(' ').filter(w=>w.length>2);
    const bw=B.split(' ').filter(w=>w.length>2);
    let hit=0;
    aw.forEach(w=>{if(bw.some(x=>x===w||x.includes(w)||w.includes(x)))hit++;});
    return hit/Math.max(aw.length,1);
  }

  async function searchOpenFoodFacts(query){
    const urls = [
      'https://world.openfoodfacts.org/api/v2/search?search_terms='+encodeURIComponent(query)+'&page_size=12&fields=product_name,image_front_url,image_url,brands',
      'https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(query)+'&search_simple=1&action=process&json=1&page_size=12&fields=product_name,image_front_url,image_url,brands'
    ];

    for(const url of urls){
      try{
        const response = await fetch(url,{headers:{Accept:'application/json'}});
        if(!response.ok)continue;
        const data = await response.json();
        const products = Array.isArray(data.products) ? data.products : [];
        products.sort((a,b)=>similarity(query,b.product_name)-similarity(query,a.product_name));
        const best = products.find(p=>p.image_front_url || p.image_url);
        if(best) return best.image_front_url || best.image_url || '';
      }catch(_){ }
    }
    return '';
  }

  async function findImage(name){
    const key = normalize(name);
    if(!key)return '';
    if(Object.prototype.hasOwnProperty.call(cache,key))return cache[key] || '';
    if(pending.has(key))return pending.get(key);

    const promise = (async()=>{
      try{
        for(const query of variants(name)){
          const image = await searchOpenFoodFacts(query);
          if(image){ cache[key]=image; saveCache(); return image; }
        }
        cache[key]=''; saveCache(); return '';
      }finally{ pending.delete(key); }
    })();

    pending.set(key,promise);
    return promise;
  }

  function extractProductName(card){
    const selectors = [
      '[data-product-name]', '.product-name', '.product-title', '.name',
      'h1','h2','h3','h4','strong','b'
    ];
    for(const selector of selectors){
      const el = card.querySelector(selector);
      const text = el?.textContent?.trim();
      if(text && text.length >= 2 && text.length <= 120) return text;
    }

    const text = card.textContent?.replace(/\s+/g,' ').trim() || '';
    const match = text.match(/^(.+?)(?:R\$|Estoque|ACABANDO|ESGOTADO)/i);
    return match?.[1]?.trim() || '';
  }

  function addPhoto(card,src,name){
    if(!src || card.querySelector('.cb-auto-photo'))return;
    const wrap=document.createElement('div');
    wrap.className='cb-auto-photo-wrap';
    const img=document.createElement('img');
    img.className='cb-auto-photo';
    img.src=src;
    img.alt=name;
    img.loading='lazy';
    img.referrerPolicy='no-referrer';
    img.onerror=()=>{
      wrap.remove();
      addEmpty(card);
    };
    wrap.appendChild(img);
    card.insertBefore(wrap,card.firstChild);
  }

  function addLoading(card){
    if(card.querySelector('.cb-auto-photo,.cb-auto-photo-loading,.cb-auto-photo-empty'))return;
    const el=document.createElement('div');
    el.className='cb-auto-photo-loading';
    card.insertBefore(el,card.firstChild);
  }

  function addEmpty(card){
    if(card.querySelector('.cb-auto-photo,.cb-auto-photo-empty'))return;
    const el=document.createElement('div');
    el.className='cb-auto-photo-empty';
    el.textContent='Imagem não encontrada';
    card.insertBefore(el,card.firstChild);
  }

  async function enhanceCard(card){
    if(card.dataset.cbPhotoDone==='1')return;
    if(card.classList.contains('out-of-stock'))return;

    const name=extractProductName(card);
    if(!name)return;

    card.dataset.cbPhotoDone='1';
    const src=await findImage(name);
    card.querySelector('.cb-auto-photo-loading')?.remove();
    if(src)addPhoto(card,src,name); else addEmpty(card);
  }

  function getCards(){
    const root=document.getElementById('waiter-product-grid');
    if(!root)return [];
    return [...root.children].filter(el=>el.nodeType===1);
  }

  function scan(){
    getCards().forEach(card=>{
      if(!card.querySelector('.cb-auto-photo,.cb-auto-photo-loading,.cb-auto-photo-empty'))addLoading(card);
      enhanceCard(card);
    });
  }

  const observer=new MutationObserver(()=>{
    clearTimeout(window.__cbPhotoTimer);
    window.__cbPhotoTimer=setTimeout(scan,120);
  });

  function start(){
    scan();
    [500,1200,2500,5000].forEach(delay=>setTimeout(scan,delay));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
  else start();
  observer.observe(document.body,{childList:true,subtree:true});
})();
