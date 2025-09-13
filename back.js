// back.js - global subpath guard & safe back button
(function stayInSubpath(){
  function base(){ const p=location.pathname.split("/").filter(Boolean); return p.length?`/${p[0]}/`:"/"; }
  const b = base();
  if (location.hostname.endsWith("github.io") && !location.pathname.startsWith(b)) {
    location.replace(location.origin + b);
  }
  window.addEventListener("popstate", () => {
    if (location.hostname.endsWith("github.io") && !location.pathname.startsWith(b)) {
      location.replace(location.origin + b);
    }
  });
})();

function getBasePrefix(){ const parts=location.pathname.split("/").filter(Boolean); return parts.length?`/${parts[0]}/`:"/"; }
function toAbsolute(pathLike){
  const base = location.origin + getBasePrefix();
  if (!pathLike) pathLike = "index.html";
  if (pathLike.startsWith("/")) return new URL(pathLike, location.origin).href;
  return new URL(pathLike.replace(/^\/+/ , ""), base).href;
}
function safeBackTo(fallback="index.html"){
  try{
    const want = location.origin + getBasePrefix();
    const ref  = document.referrer || "";
    if (ref.startsWith(want)) {
      history.back();
      setTimeout(()=>{ if (document.visibilityState === "visible") location.replace(toAbsolute(fallback)); }, 400);
    } else {
      location.replace(toAbsolute(fallback));
    }
  } catch {
    location.replace(toAbsolute(fallback));
  }
}
