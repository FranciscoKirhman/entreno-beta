// Versión de prueba: guarda la app en el teléfono para que abra sin señal en el gimnasio.
// Red primero, con límite de tiempo, y la copia guardada como respaldo (igual que el tablero).
// herramientas/beta.mjs reemplaza VERSION y ARCHIVOS al armar.
const VERSION = "2026-10-01 18:29 · 48f1398";
const ARCHIVOS = [
 "./",
 "app.js",
 "avisos.js",
 "checkin.js",
 "coach-ui.js",
 "cola.js",
 "comun.js",
 "config.js",
 "descanso.js",
 "estilos.css",
 "fotos-local.js",
 "hoja.js",
 "hoy.js",
 "iconos/icono-180.png",
 "iconos/icono-192.png",
 "iconos/icono-512.png",
 "iconos/icono.svg",
 "index.html",
 "manifest.webmanifest",
 "mas.js",
 "nube.js",
 "progreso.js",
 "semana.js",
 "temporada.js",
 "../contenido/checkin.json",
 "../contenido/cuestionario.json",
 "../contenido/ejercicios.json",
 "../contenido/evidencia.json",
 "../contenido/planes.json",
 "../nucleo/agenda.js",
 "../nucleo/bienestar.js",
 "../nucleo/cambios.js",
 "../nucleo/catalogo.js",
 "../nucleo/checkin.js",
 "../nucleo/ciclos.js",
 "../nucleo/coach.js",
 "../nucleo/cola.js",
 "../nucleo/cuidado.js",
 "../nucleo/derivar.js",
 "../nucleo/explicar.js",
 "../nucleo/hevy-csv.js",
 "../nucleo/ics.js",
 "../nucleo/importar-plan.js",
 "../nucleo/mcp.js",
 "../nucleo/motor-plan.js",
 "../nucleo/notas.js",
 "../nucleo/progresion.js",
 "../nucleo/recordatorios.js",
 "../nucleo/registro.js",
 "../nucleo/semanal.js",
 "../nucleo/series.js",
 "../nucleo/suplementos.js",
 "../nucleo/validador.js"
];
const CACHE = `entreno-b-${VERSION}`;
const FUENTES = 'entreno-b-fuentes';
const LIMITE_MS = 3000; // con señal que existe pero no llega, no esperar más que esto

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FUENTES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') { e.respondWith(fuente(req)); return; }
  if (url.origin !== location.origin) return; // lo externo pasa sin tocar
  e.respondWith(redPrimero(req, url));
});

/** La copia guardada; para abrir una página, la portada de la app. */
async function guardada(req, clave) {
  const c = await caches.open(CACHE);
  return (await c.match(clave)) || (req.mode === 'navigate' ? c.match('index.html') : undefined);
}

function redPrimero(req, url) {
  const clave = url.origin + url.pathname; // sin ?parámetros: es el mismo archivo
  return new Promise(resolve => {
    let listo = false;
    const dar = r => { if (r && !listo) { listo = true; resolve(r); } };
    // GitHub Pages manda cache-control de 10 minutos: 'reload' obliga a ir a la red de verdad.
    const red = fetch(new Request(url.href, { cache: 'reload', credentials: 'same-origin' })).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(clave, copia)); }
      return r;
    });
    const reloj = setTimeout(() => guardada(req, clave).then(dar), LIMITE_MS);
    red.then(r => { clearTimeout(reloj); dar(r); })
      .catch(() => { clearTimeout(reloj); guardada(req, clave).then(r => dar(r || Response.error())); });
  });
}

/** Las tipografías no cambian: primero la copia guardada. */
async function fuente(req) {
  const c = await caches.open(FUENTES);
  const hay = await c.match(req);
  if (hay) return hay;
  try {
    const r = await fetch(req);
    if (r.ok || r.type === 'opaque') c.put(req, r.clone());
    return r;
  } catch { return Response.error(); }
}

// Tocar un recordatorio abre la app (o la trae al frente si ya estaba abierta).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(ventanas => (ventanas.length ? ventanas[0].focus() : self.clients.openWindow('./'))));
});
