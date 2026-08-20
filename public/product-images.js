/* Conteiner Beer - imagens automáticas dos produtos */
(() => {
  'use strict';
  const CACHE_KEY = 'conteiner-beer:auto-product-images:v1';
  const pending = new Map();
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (_) { cache = {}; }
  const style = document.createElement('style');
  style.textContent = `.cb-auto-photo{width:100%;height:108px;object-fit:contain;border-radius:11px;background:#0b1018;border:1px solid rgba(255,255,255,.06);display:block;margin:0 0 10px;padding:5px}.cb-auto-photo-wrap{width:100%;display:block}.cb-auto-photo-loading{height:108px;width:100%;border-radius:11px;background:linear-gradient(90deg,#101722,#182131,#101722);background-size:200% 100%;animation:cbPhotoPulse 1.4s infinite;margin-bottom:10px}@keyframes cbPhotoPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}@media(max-width:600px){.cb-auto-photo,.cb-auto-photo-loading{height:92px}}`;
  document.head.appendChild(style);
  function saveCache(){ try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {} }
  function cleanName(name){ return String(name||'').replace(/\b(ml|l|litro|litros|g|kg|un|unidade|unidades)\b/gi,' ').replace(/\b\d+(?:[.,]\d+)?\b/g,' ').replace(/[^a-zA-ZÀ-ÿ0-9 ]/g,' ').replace(/\s+/g,' ').trim(); }
  function keyFor(name){ return cleanName(name).toLowerCase(); }
  function similarity(a,b){ const A=keyFor(a),B=keyFor(b); if(!A||!B)return 0;if(A===B)return 1;const aw=A.split(' '),bw=B.split(' ');let hit=0;aw.forEach(w=>{if(w.length>2&&bw.some(x=>x===w||x.includes(w)||w.includes(x)))hit++;});return hit/Math.max(aw.length,1); }
  async function findImage(name){
    const key=keyFor(name); if(!key)return ''; if(Object.prototype.hasOwnProperty.call(cache,key))return cache[key]||''; if(pending.has(key))return pending.get(key);
    const promise=(async()=>{try{
      const url='https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(key)+'&search_simple=1&action=process&json=1&page_size=8&fields=product_name,image_front_url,image_url,brands';
      const r=await fetch(url,{headers:{Accept:'application/json'}}); if(!r.ok)throw new Error('OFF '+r.status); const data=await r.json();
      const products=Array.isArray(data.products)?data.products:[]; products.sort((x,y)=>similarity(name,y.product_name)-similarity(name,x.product_name));
      const best=products.find(p=>p.image_front_url||p.image_url); const image=best?.image_front_url||best?.image_url||''; cache[key]=image; saveCache(); return image;
    }catch(_){cache[key]='';saveCache();return '';}finally{pending.delete(key);}})();
    pending.set(key,promise); return promise;
  }
  function productNameFromCard(card){ return card.querySelector('strong')?.textContent?.trim()||''; }
  function addPhoto(card,src,name){ if(!src||card.querySelector('.cb-auto-photo'))return; const wrap=document.createElement('div');wrap.className='cb-auto-photo-wrap';const img=document.createElement('img');img.className='cb-auto-photo';img.src=src;img.alt=name;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>wrap.remove();wrap.appendChild(img);card.insertBefore(wrap,card.firstChild); }
  function addLoading(card){ if(card.querySelector('.cb-auto-photo,.cb-auto-photo-loading'))return;const el=document.createElement('div');el.className='cb-auto-photo-loading';card.insertBefore(el,card.firstChild); }
  async function enhanceCard(card){ if(card.dataset.cbPhotoDone==='1'||card.classList.contains('out-of-stock'))return;const name=productNameFromCard(card);if(!name)return;card.dataset.cbPhotoDone='1';const src=await findImage(name);card.querySelector('.cb-auto-photo-loading')?.remove();if(src)addPhoto(card,src,name); }
  function scan(){ document.querySelectorAll('#waiter-product-grid .grid-item').forEach(card=>{if(!card.querySelector('.cb-auto-photo')&&!card.querySelector('.cb-auto-photo-loading'))addLoading(card);enhanceCard(card);}); }
  const observer=new MutationObserver(()=>{clearTimeout(window.__cbPhotoTimer);window.__cbPhotoTimer=setTimeout(scan,80);});
  window.addEventListener('load',()=>{scan();setTimeout(scan,500);setTimeout(scan,1500);setTimeout(scan,3000);});
  observer.observe(document.body,{childList:true,subtree:true});
})();
