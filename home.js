const $ = (s,el=document)=>el.querySelector(s);
const params = new URLSearchParams(location.search);

function getGreetingID(d=new Date()){
  const h = d.getHours();
  if (h >= 4 && h < 11)  return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 18) return "Selamat sore";
  return "Selamat malam";
}

function updateGreeting(){
  $("#greet").textContent = getGreetingID();
  const t = {
    pagi:"Fokus & semangat produktif ☕",
    siang:"Jeda sejenak, tarik napas 🌤️",
    sore:"Akhiri dengan manis 🌇",
    malam:"Santai, recharge energi 🌙"
  };
  const g = $("#greet").textContent.split(" ")[1];
  $("#taglineText").textContent = t[g] || "Siap bantu aktivitasmu hari ini ✨";
}

function applyProfile({name, photo}){
  if (name){
    $("#name").textContent = name;
    localStorage.setItem('tinydb_name', name);
  }
  if (photo){
    $("#avatar").src = photo;
    localStorage.setItem('tinydb_photo', photo);
    extractAccentFromImage(photo).then(colors=>{
      if(colors){ setAccent(colors.primary, colors.secondary); }
    }).catch(()=>{});
  }else{
    const n = (name || 'P U').trim();
    const initials = n.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
    const c = document.createElement('canvas'); c.width=256; c.height=256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,256,256);
    g.addColorStop(0,'#1b2238'); g.addColorStop(1,'#151b2e');
    x.fillStyle=g; x.fillRect(0,0,256,256);
    x.fillStyle='#7c9bff'; x.font='bold 120px ui-sans-serif';
    x.textAlign='center'; x.textBaseline='middle';
    x.fillText(initials,128,140);
    $("#avatar").src = c.toDataURL('image/png');
  }
}

function loadInitialData(){
  const nameFromURL = (params.get('name') || '').trim();
  const photoFromURL = (params.get('photo') || '').trim();
  const nameFromLS = localStorage.getItem('tinydb_name') || '';
  const photoFromLS = localStorage.getItem('tinydb_photo') || '';
  const name = nameFromURL || nameFromLS || 'Pengguna';
  const photo = photoFromURL || photoFromLS || '';
  applyProfile({name, photo});
  if(params.get('accent')) setAccent(params.get('accent'));
  if(params.get('accent2')) setAccent(undefined, params.get('accent2'));
}

window.setTinyData = function(obj){
  try{
    if (typeof obj === 'string') obj = JSON.parse(obj);
    const {name, photo} = obj || {};
    applyProfile({name, photo});
  }catch(e){ console.warn('TinyData parse error:', e); }
};

window.addEventListener('message', (ev)=>{
  try{
    const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
    if (data && (data.type==='tinydb' || data.type==='profile')){
      applyProfile({name:data.name, photo:data.photo});
    }
  }catch(e){}
});

async function extractAccentFromImage(src){
  return new Promise((resolve,reject)=>{
    const img = new Image(); img.crossOrigin='anonymous'; img.decoding='async';
    img.onload = ()=>{
      try{
        const w = 80, h = 80;
        const c = document.createElement('canvas'); c.width=w; c.height=h;
        const x = c.getContext('2d', { willReadFrequently:true });
        x.drawImage(img,0,0,w,h);
        const {data} = x.getImageData(0,0,w,h);
        const bins = {};
        for(let i=0;i<data.length;i+=16){
          const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
          if(a<128) continue;
          const key = [(r/24|0),(g/24|0),(b/24|0)].join(',');
         
