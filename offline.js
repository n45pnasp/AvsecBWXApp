// offline.js - injects offline notice bottom sheet and registers handlers
export function initOfflineSheet(){
  ensureStyle();
  ensureSheet();
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}

function ensureStyle(){
  if (document.getElementById('offline-style')) return;
  const style = document.createElement('style');
  style.id = 'offline-style';
  style.textContent = `
label{user-select:none;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none}
.offline-sheet{position:fixed;left:0;right:0;bottom:0;display:flex;align-items:center;gap:8px;padding:14px 16px;background:#c62828;border-top-left-radius:var(--radius,12px);border-top-right-radius:var(--radius,12px);transform:translateY(100%);transition:transform .3s ease;z-index:200;}
.offline-sheet.show{transform:translateY(0);}
.offline-icon{width:32px;height:32px;flex:0 0 auto;display:grid;place-items:center;}
.offline-icon svg{width:24px;height:24px;color:#fff;}
.offline-msg{font-size:14px;color:#fff;}
`;
  document.head.appendChild(style);
}

function ensureSheet(){
  if (document.getElementById('offlineSheet')) return;
  const sheet = document.createElement('div');
  sheet.id = 'offlineSheet';
  sheet.className = 'offline-sheet';
  sheet.setAttribute('role','alert');
  sheet.setAttribute('aria-live','assertive');
  sheet.innerHTML = `
    <div class="offline-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M2 8.82A15.91 15.91 0 0 1 12 4a15.91 15.91 0 0 1 10 4.82" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 12.55A11.86 11.86 0 0 1 12 9a11.86 11.86 0 0 1 7 3.55" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8.5 16.1A7.42 7.42 0 0 1 12 14a7.42 7.42 0 0 1 3.5 2.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2"/></svg>
    </div>
    <div class="offline-msg">Koneksi terputus</div>`;
  document.body.appendChild(sheet);
}

function update(){
  const sheet = document.getElementById('offlineSheet');
  if (!sheet) return;
  if (navigator.onLine) sheet.classList.remove('show');
  else sheet.classList.add('show');
}

// auto init on module load
document.addEventListener('DOMContentLoaded', initOfflineSheet);
