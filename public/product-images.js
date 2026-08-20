/* Conteiner Beer - sistema profissional de imagens de produtos */
(() => {
  'use strict';

  const CACHE_KEY = 'conteiner-beer:auto-product-images:v4';
  const pending = new Map();
  let cache = {};
  let products = [];

  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (_) { cache = {}; }

  const style = document.createElement('style');
  style.textContent = `
    .cb-auto-photo-wrap{width:100%;display:block;margin:0 0 10px}
    .cb-auto-photo{width:100%;height:110px;object-fit:contain;border-radius:11px;background:#0b1018;border:1px solid rgba(255,255,255,.06);display:block;padding:5px}
    .cb-auto-photo-loading{height:110px;width:100%;border-radius:11px;background:linear-gradient(90deg,#101722,#182131,#101722);background-size:200% 100%;animation:cbPhotoPulse 1.4s infinite;margin:0 0 10px}
    .cb-auto-photo-empty{height:110px;width:100%;border-radius:11px;background:#0b1018;border:1px dashed rgba(255,255,255,.10);display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px;margin:0 0 10px}
    .cb-image-manager-button{position:fixed;right:18px;bottom:18px;z-index:9997;border:0;border-radius:999px;padding:12px 16px;background:#f59e0b;color:#111827;font-weight:800;box-shadow:0 8px 28px rgba(0,0,0,.35);cursor:pointer}
    .cb-image-modal{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9998;display:none;align-items:center;justify-content:center;padding:18px}
    .cb-image-modal.active{display:flex}
    .cb-image-panel{width:min(980px,100%);max-height:92vh;overflow:auto;background:#111827;color:#f8fafc;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:20px;box-shadow:0 20px 70px rgba(0,0,0,.45)}
    .cb-image-panel h2{margin:0 0 6px}.cb-image-help{color:#94a3b8;font-size:13px;margin:0 0 16px}
    .cb-image-row{display:grid;grid-template-columns:86px minmax(180px,1fr) minmax(180px,1.2fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07)}
    .cb-image-thumb{width:72px;height:72px;border-radius:10px;background:#0b1018;border:1px solid rgba(255,255,255,.08);object-fit:contain;padding:4px}
    .cb-image-name{font-weight:800;font-size:14px}.cb-image-meta{font-size:11px;color:#94a3b8;margin-top:3px}
    .cb-image-input{width:100%;box-sizing:border-box;background:#0b1018;color:#f8fafc;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px;font-size:12px}
    .cb-image-actions{display:flex;gap:6px;flex-wrap:wrap}.cb-image-actions button{border:0;border-radius:8px;padding:9px 10px;font-weight:700;cursor:pointer}
    .cb-image-save{background:#22c55e;color:#052e16}.cb-image-auto{background:#334155;color:#f8fafc}.cb-image-close{background:#475569;color:#fff}
    .cb-image-status{font-size:11px;color:#94a3b8;margin-top:4px;min-height:14px}
    .cb-image-top{display:flex;gap:10px;justify-content:space-between;align-items:center;position:sticky;top:-20px;background:#111827;padding:4px 0 14px;z-index:2}
    .cb-image-search{width:min(360px,55%);background:#0b1018;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:10px}
    @keyframes cbPhotoPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}
    @media(max-width:720px){.cb-image-row{grid-template-columns:64px 1fr}.cb-image-row .cb-image-url{grid-column:1/-1}.cb-image-row .cb-image-actions{grid-column:1/-1}.cb-image-thumb{width:56px;height:56px}.cb-image-search{width:48%}}
    @media(max-width:600px){.cb-auto-photo,.cb-auto-photo-loading,.cb-auto-photo-empty{height:92px}.cb-image-panel{padding:14px}.cb-image-top{top:-14px}}
  `;
  document.head.appendChild(style);

  function saveCache(){ try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {} }
  function normalize(value){
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  }
  function variants(name){
    const original=String(name||'').trim();
    const normalized=normalize(original);
    const withoutSize=normalized.replace(/\b\d+(?:[.,]\d+)?\s*(ml|l|g|kg|un|unidade|unidades|litro|litros)\b/g,' ').replace(/\s+/g,' ').trim();
    const withoutGeneric=withoutSize.replace(/\b(lata|latinha|garrafa|pet|long neck|litrao)\b/g,' ').replace(/\s+/g,' ').trim();
    return [...new Set([original,normalized,withoutSize,withoutGeneric].filter(Boolean))];
  }
  function similarity(a,b){
    const A=normalize(a),B=normalize(b); if(!A||!B)return 0; if(A===B)return 1;
    const aw=A.split(' ').filter(w=>w.length>2),bw=B.split(' ').filter(w=>w.length>2); let hit=0;
    aw.forEach(w=>{if(bw.some(x=>x===w||x.includes(w)||w.includes(x)))hit++;});
    return hit/Math.max(aw.length,1);
  }

  function productByName(name){
    const key=normalize(name);
    let best=products.find(p=>normalize(p.name)===key);
    if(best)return best;
    best=products.find(p=>similarity(name,p.name)>=0.75);
    return best || null;
  }

  async function loadProducts(){
    try{
      const response=await fetch('/api/products');
      if(!response.ok)throw new Error('products '+response.status);
      const data=await response.json();
      products=Array.isArray(data)?data:[];
      scan();
      if(document.getElementById('cb-image-modal')?.classList.contains('active')) renderManager();
    }catch(_){ products=[]; }
  }

  async function searchOpenFoodFacts(query){
    const urls=[
      'https://world.openfoodfacts.org/api/v2/search?search_terms='+encodeURIComponent(query)+'&page_size=12&fields=product_name,image_front_url,image_url,brands',
      'https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(query)+'&search_simple=1&action=process&json=1&page_size=12&fields=product_name,image_front_url,image_url,brands'
    ];
    for(const url of urls){
      try{
        const response=await fetch(url,{headers:{Accept:'application/json'}});
        if(!response.ok)continue;
        const data=await response.json();
        const list=Array.isArray(data.products)?data.products:[];
        list.sort((a,b)=>similarity(query,b.product_name)-similarity(query,a.product_name));
        const best=list.find(p=>p.image_front_url||p.image_url);
        if(best)return best.image_front_url||best.image_url||'';
      }catch(_){ }
    }
    return '';
  }

  async function findImage(name){
    const key=normalize(name); if(!key)return '';
    if(Object.prototype.hasOwnProperty.call(cache,key))return cache[key]||'';
    if(pending.has(key))return pending.get(key);
    const promise=(async()=>{
      try{
        for(const query of variants(name)){
          const image=await searchOpenFoodFacts(query);
          if(image){cache[key]=image;saveCache();return image;}
        }
        cache[key]='';saveCache();return '';
      }finally{pending.delete(key);}
    })();
    pending.set(key,promise); return promise;
  }

  function extractProductName(card){
    const selectors=['[data-product-name]','.product-name','.product-title','.name','h1','h2','h3','h4','strong','b'];
    for(const selector of selectors){
      const el=card.querySelector(selector); const text=el?.textContent?.trim();
      if(text&&text.length>=2&&text.length<=120)return text;
    }
    const text=card.textContent?.replace(/\s+/g,' ').trim()||'';
    return text.match(/^(.+?)(?:R\$|Estoque|ACABANDO|ESGOTADO)/i)?.[1]?.trim()||'';
  }

  function addPhoto(card,src,name){
    if(!src||card.querySelector('.cb-auto-photo'))return;
    const wrap=document.createElement('div');wrap.className='cb-auto-photo-wrap';
    const img=document.createElement('img');img.className='cb-auto-photo';img.src=src;img.alt=name;img.loading='lazy';img.referrerPolicy='no-referrer';
    img.onerror=()=>{wrap.remove();addEmpty(card);};wrap.appendChild(img);card.insertBefore(wrap,card.firstChild);
  }
  function addLoading(card){
    if(card.querySelector('.cb-auto-photo,.cb-auto-photo-loading,.cb-auto-photo-empty'))return;
    const el=document.createElement('div');el.className='cb-auto-photo-loading';card.insertBefore(el,card.firstChild);
  }
  function addEmpty(card){
    if(card.querySelector('.cb-auto-photo,.cb-auto-photo-empty'))return;
    const el=document.createElement('div');el.className='cb-auto-photo-empty';el.textContent='Imagem não encontrada';card.insertBefore(el,card.firstChild);
  }

  async function enhanceCard(card){
    if(card.dataset.cbPhotoDone==='1'||card.classList.contains('out-of-stock'))return;
    const name=extractProductName(card);if(!name)return;
    card.dataset.cbPhotoDone='1';
    const product=productByName(name);
    const custom=product?.imageUrl?.trim();
    const src=custom||await findImage(name);
    card.querySelector('.cb-auto-photo-loading')?.remove();
    if(src)addPhoto(card,src,name);else addEmpty(card);
  }
  function scan(){
    const root=document.getElementById('waiter-product-grid');if(!root)return;
    [...root.children].filter(el=>el.nodeType===1).forEach(card=>{
      if(!card.querySelector('.cb-auto-photo,.cb-auto-photo-loading,.cb-auto-photo-empty'))addLoading(card);
      enhanceCard(card);
    });
  }

  async function saveProductImage(productId,imageUrl){
    const token=localStorage.getItem('authToken');
    const response=await fetch('/api/products/'+encodeURIComponent(productId),{
      method:'PUT',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({imageUrl})
    });
    if(!response.ok){let msg='Não foi possível salvar a imagem.';try{const d=await response.json();msg=d.error||msg;}catch(_){}throw new Error(msg);}
    const product=products.find(p=>String(p._id)===String(productId));if(product)product.imageUrl=imageUrl;
    cache[normalize(product?.name||productId)]=imageUrl;saveCache();scan();
  }

  function escapeHtml(value){return String(value||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

  function renderManager(){
    const box=document.getElementById('cb-image-list');if(!box)return;
    const term=normalize(document.getElementById('cb-image-search')?.value||'');
    const filtered=products.filter(p=>!term||normalize(p.name).includes(term)||normalize(p.category).includes(term));
    if(!filtered.length){box.innerHTML='<p style="color:#94a3b8">Nenhum produto encontrado.</p>';return;}
    box.innerHTML=filtered.map(p=>{
      const image=p.imageUrl||cache[normalize(p.name)]||'';
      return `<div class="cb-image-row" data-product-id="${escapeHtml(p._id)}">
        <img class="cb-image-thumb" src="${escapeHtml(image||'')}" onerror="this.removeAttribute('src');this.style.opacity='.25'" alt="">
        <div><div class="cb-image-name">${escapeHtml(p.name)}</div><div class="cb-image-meta">${escapeHtml(p.category||'Sem categoria')} · Estoque ${Number(p.stock||0)}</div><div class="cb-image-status" data-status></div></div>
        <div class="cb-image-url"><input class="cb-image-input" data-url placeholder="URL da imagem ou use Selecionar arquivo" value="${escapeHtml(p.imageUrl||'')}"><input type="file" accept="image/*" data-file style="display:none"></div>
        <div class="cb-image-actions"><button class="cb-image-auto" data-auto>🔎 Automática</button><button class="cb-image-save" data-save>💾 Salvar</button><button class="cb-image-auto" data-filebtn>📁 Arquivo</button></div>
      </div>`;
    }).join('');
  }

  function openManager(){
    if(!document.getElementById('cb-image-modal'))createManager();
    document.getElementById('cb-image-modal').classList.add('active');
    loadProducts();renderManager();
  }
  function closeManager(){document.getElementById('cb-image-modal')?.classList.remove('active');}

  function createManager(){
    const button=document.createElement('button');button.className='cb-image-manager-button';button.textContent='🖼️ Imagens dos produtos';button.onclick=openManager;
    document.body.appendChild(button);

    const modal=document.createElement('div');modal.id='cb-image-modal';modal.className='cb-image-modal';
    modal.innerHTML=`<div class="cb-image-panel"><div class="cb-image-top"><div><h2>Imagens dos produtos</h2><p class="cb-image-help">A imagem personalizada fica salva no produto e passa a ser usada nas telas de venda. Se não houver imagem personalizada, o sistema tenta buscar automaticamente.</p></div><button class="cb-image-close" id="cb-image-close">Fechar</button></div><input id="cb-image-search" class="cb-image-search" placeholder="Buscar produto..." style="margin-bottom:12px"><div id="cb-image-list"></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('cb-image-close').onclick=closeManager;
    document.getElementById('cb-image-search').oninput=renderManager;
    modal.addEventListener('click',e=>{if(e.target===modal)closeManager();});

    document.getElementById('cb-image-list').addEventListener('click',async e=>{
      const row=e.target.closest('.cb-image-row');if(!row)return;
      const id=row.dataset.productId;const product=products.find(p=>String(p._id)===String(id));if(!product)return;
      const status=row.querySelector('[data-status]');
      if(e.target.closest('[data-filebtn]')){row.querySelector('[data-file]').click();return;}
      if(e.target.closest('[data-auto]')){
        status.textContent='Buscando imagem...';
        const image=await findImage(product.name);
        row.querySelector('[data-url]').value=image||'';
        row.querySelector('.cb-image-thumb').src=image||'';
        status.textContent=image?'Imagem encontrada. Clique em Salvar.':'Não encontrei uma imagem automática.';
        return;
      }
      if(e.target.closest('[data-save]')){
        try{status.textContent='Salvando...';await saveProductImage(id,row.querySelector('[data-url]').value.trim());status.textContent='✓ Imagem salva no produto.';row.querySelector('.cb-image-thumb').src=row.querySelector('[data-url]').value.trim()||'';}
        catch(err){status.textContent=err.message;}
      }
    });

    document.getElementById('cb-image-list').addEventListener('change',async e=>{
      if(!e.target.matches('[data-file]'))return;
      const file=e.target.files?.[0];if(!file)return;
      const row=e.target.closest('.cb-image-row');const status=row.querySelector('[data-status]');
      try{
        status.textContent='Processando imagem...';
        const dataUrl=await resizeImage(file,800,800,0.82);
        row.querySelector('[data-url]').value=dataUrl;
        row.querySelector('.cb-image-thumb').src=dataUrl;
        status.textContent='Arquivo pronto. Clique em Salvar.';
      }catch(err){status.textContent=err.message;}
      e.target.value='';
    });
  }

  function resizeImage(file,maxW,maxH,quality){
    return new Promise((resolve,reject)=>{
      if(!file.type.startsWith('image/'))return reject(new Error('Selecione uma imagem válida.'));
      if(file.size>8*1024*1024)return reject(new Error('A imagem original deve ter no máximo 8 MB.'));
      const reader=new FileReader();reader.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));
      reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Imagem inválida.'));img.onload=()=>{
        const scale=Math.min(1,maxW/img.width,maxH/img.height);const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
        const data=canvas.toDataURL('image/jpeg',quality);
        if(data.length>1.8*1024*1024)return reject(new Error('Imagem ainda ficou grande demais. Escolha uma imagem menor.'));
        resolve(data);
      };img.src=reader.result;};reader.readAsDataURL(file);
    });
  }

  function start(){
    loadProducts();
    setTimeout(()=>{if(localStorage.getItem('userRole')==='admin')createManager();},800);
    scan();[500,1200,2500,5000].forEach(d=>setTimeout(scan,d));
  }

  const observer=new MutationObserver(()=>{clearTimeout(window.__cbPhotoTimer);window.__cbPhotoTimer=setTimeout(scan,150);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  observer.observe(document.body,{childList:true,subtree:true});
  window.cbProductImages={loadProducts,findImage,openManager,saveProductImage};
})();
