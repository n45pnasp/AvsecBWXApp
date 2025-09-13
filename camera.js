export async function capturePhoto(){
  return new Promise(async (resolve, reject) => {
    try{
      await startCapture(resolve, reject);
    }catch(err){
      reject(err);
    }
  });
}

export function makePhotoName(page = null, index = 0){
  const base = page || location.pathname.split('/').pop().replace(/\.html$/, '') || 'photo';
  const d    = new Date();
  const hh   = String(d.getHours()).padStart(2, '0');
  const mm   = String(d.getMinutes()).padStart(2, '0');
  const idx  = index ? String(index) : '';
  return `${base}${idx}_${hh}${mm}.png`;
}

export function dataUrlToFile(dataUrl, fileName){
  const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length; const u8 = new Uint8Array(n);
  while(n--) u8[n] = bstr.charCodeAt(n);
  const name = fileName || makePhotoName();
  return new File([u8], name, {type:mime});
}

let camState = {stream:null, video:null, overlay:null, shutter:null, tilt:null, onStop:null};

async function startCapture(resolve, reject){
  ensureVideo(); ensureOverlay(resolve, reject);
  document.body.classList.add('scan-active');
  try{
    const stream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720}},
      audio:false
    });
    camState.stream = stream;
    camState.video.srcObject = stream;
    await camState.video.play();
  }catch(err){
    stopCapture();
    reject(err);
    return;
  }
  camState.running = true;
  updateCaptureState();
}

function ensureVideo(){
  if (camState.video) return;
  const v=document.createElement('video');
  v.id='scan-video';
  v.setAttribute('playsinline','');
  v.muted=true; v.autoplay=true;
  document.body.appendChild(v);
  camState.video=v;
}

function ensureOverlay(resolve, reject){
  if (camState.overlay) return;
  const o=document.createElement('div');
  o.id='scan-overlay';
  o.innerHTML=`<div class="scan-topbar"><button id="scan-close" class="scan-close" aria-label="Tutup">✕</button></div>
    <div class="scan-msg-portrait" role="alert" aria-live="assertive">
      <svg class="rotate-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>
      <div class="rotate-text">putar horizontal</div>
    </div>
    <button id="scan-shutter" class="scan-shutter" aria-label="Ambil gambar" title="Ambil gambar"></button>`;
  document.body.appendChild(o);
  camState.overlay=o;
  const close=o.querySelector('#scan-close');
  close.addEventListener('click',()=>{ stopCapture(); resolve(null); });
  const shutter=o.querySelector('#scan-shutter');
  camState.shutter=shutter;
  shutter.addEventListener('click', async ()=>{
    if(!isLandscape()){ alert('Perangkat masih portrait. Putar perangkat ke horizontal untuk memotret.'); return; }
    try{
      const dataUrl = await captureFrame();
      stopCapture();
      resolve(dataUrl);
    }catch(e){ console.error('Gagal capture',e); alert('Gagal mengambil gambar.'); }
  });
  const update=()=>updateCaptureState();
  camState._update=update;
  window.addEventListener('orientationchange', update);
  window.addEventListener('resize', update);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', update);
  if (window.DeviceOrientationEvent){
    const handler=(e)=>{ if(typeof e.gamma==='number') camState.tilt=e.gamma; update(); };
    camState._tiltHandler=handler;
    if (typeof DeviceOrientationEvent.requestPermission==='function'){
      DeviceOrientationEvent.requestPermission().then(p=>{ if(p==='granted') window.addEventListener('deviceorientation', handler); }).catch(()=>{});
    } else {
      window.addEventListener('deviceorientation', handler);
    }
  }
}

function stopCapture(){
  camState.running=false;
  if(camState.stream){ camState.stream.getTracks().forEach(t=>{try{t.stop();}catch(_){}}); camState.stream=null; }
  if(camState.video){ camState.video.srcObject=null; camState.video.remove(); camState.video=null; }
  if(camState.overlay){ camState.overlay.remove(); camState.overlay=null; }
  window.removeEventListener('orientationchange', camState._update);
  window.removeEventListener('resize', camState._update);
  if(screen.orientation && screen.orientation.removeEventListener) screen.orientation.removeEventListener('change', camState._update);
  if(camState._tiltHandler){ window.removeEventListener('deviceorientation', camState._tiltHandler); camState._tiltHandler=null; }
  document.body.classList.remove('scan-active');
}

function isLandscape(){
  if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) return true;
  if (typeof window.orientation==='number' && Math.abs(window.orientation)===90) return true;
  if (camState.tilt!=null) return Math.abs(camState.tilt)>=60;
  return window.innerWidth>window.innerHeight;
}

function updateCaptureState(){
  const btn=camState.shutter;
  const msg=camState.overlay?.querySelector('.scan-msg-portrait');
  const onLS=isLandscape();
  if(btn){ btn.disabled=!onLS; btn.classList.toggle('disabled',!onLS); }
  if(msg){ msg.style.display=onLS?'none':'flex'; }
}

async function captureFrame(){
  const vid=camState.video; if(!vid) throw new Error('Video belum siap');
  let w=vid.videoWidth||1280; let h=vid.videoHeight||720;
  const c=document.createElement('canvas');
  let ctx=c.getContext('2d',{willReadFrequently:true});
  if(h> w){ c.width=h; c.height=w; ctx.translate(h/2,w/2); ctx.rotate(-Math.PI/2); ctx.drawImage(vid,-w/2,-h/2,w,h); [w,h]=[h,w]; }
  else { c.width=w; c.height=h; ctx.drawImage(vid,0,0,w,h); }
  const max=Math.max(w,h); if(max>800){ const scale=800/max; const cw=Math.round(w*scale), ch=Math.round(h*scale); const c2=document.createElement('canvas'); c2.width=cw; c2.height=ch; c2.getContext('2d').drawImage(c,0,0,cw,ch); return c2.toDataURL('image/png');}
  return c.toDataURL('image/png');
}

// Inject basic styles once
(function(){
  if(document.getElementById('scan-style')) return;
  const css=`body.scan-active{background:#000;overscroll-behavior:contain}#scan-video,#scan-canvas{position:fixed;inset:0;width:100vw;height:100vh;display:none;background:#000;z-index:9998}body.scan-active #scan-video{display:block;object-fit:cover;touch-action:none}#scan-overlay{position:fixed;inset:0;display:none;z-index:10000;pointer-events:none}body.scan-active #scan-overlay{display:block}.scan-topbar{position:absolute;top:0;left:0;right:0;height:max(56px,calc(44px + env(safe-area-inset-top,0)));display:flex;align-items:flex-start;justify-content:flex-end;padding:calc(env(safe-area-inset-top,0) + 6px) 10px 8px;background:linear-gradient(to bottom,rgba(0,0,0,.5),rgba(0,0,0,0));pointer-events:none}.scan-close{pointer-events:auto;width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.25);font-size:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.35)}.scan-shutter{position:absolute;left:50%;bottom:max(24px,calc(18px + env(safe-area-inset-bottom,0)));transform:translateX(-50%);width:74px;height:74px;border-radius:999px;background:#fff;border:4px solid rgba(255,255,255,.35);box-shadow:0 6px 22px rgba(0,0,0,.45), inset 0 0 0 4px #fff;pointer-events:auto;transition:transform .06s ease,opacity .15s ease,filter .15s ease}.scan-shutter:active{transform:translateX(-50%) scale(.96)}.scan-shutter.disabled,.scan-shutter:disabled{opacity:.45;filter:grayscale(60%);pointer-events:auto}.scan-msg-portrait{position:absolute;left:50%;bottom:max(110px,calc(96px + env(safe-area-inset-bottom,0)));transform:translateX(-50%);background:rgba(0,0,0,.55);color:#fff;font-weight:600;padding:10px 14px;border-radius:12px;letter-spacing:.2px;box-shadow:0 4px 12px rgba(0,0,0,.35);display:none;flex-direction:column;align-items:center;gap:4px}.rotate-icon{width:28px;height:28px;stroke:#fff;stroke-width:2;fill:none}.rotate-text{font-size:12px}`;
  const style=document.createElement('style'); style.id='scan-style'; style.textContent=css; document.head.appendChild(style);
})();
