// Versión de prueba: guarda la app en el teléfono para que abra sin señal en el gimnasio.
// Red primero, con límite de tiempo, y la copia guardada como respaldo (igual que el tablero).
// herramientas/beta.mjs reemplaza VERSION y ARCHIVOS al armar.
const VERSION = "2026-10-02 10:08 · d7dc701";
const ARCHIVOS = [
 "./",
 "app.js",
 "avisos.js",
 "cambios-ui.js",
 "checkin.js",
 "coach-ui.js",
 "cola.js",
 "comun.js",
 "config.js",
 "cuestionario.js",
 "descanso.js",
 "estilos.css",
 "ficha.js",
 "fotos-local.js",
 "hoja.js",
 "hoy.js",
 "iconos/icono-180.png",
 "iconos/icono-192.png",
 "iconos/icono-512.png",
 "iconos/icono.svg",
 "iconos.js",
 "imagenes.js",
 "img/asistentes/coach/animo.webp",
 "img/asistentes/coach/calendario.webp",
 "img/asistentes/coach/celebra.webp",
 "img/asistentes/coach/cronometro.webp",
 "img/asistentes/coach/cuidado.webp",
 "img/asistentes/coach/descanso.webp",
 "img/asistentes/coach/explica.webp",
 "img/asistentes/coach/pensando.webp",
 "img/asistentes/coach/pregunta.webp",
 "img/asistentes/coach/progreso.webp",
 "img/asistentes/coach/saludo.webp",
 "img/asistentes/coach/sin_senal.webp",
 "img/asistentes/coach.webp",
 "img/asistentes/entrenador/animo.webp",
 "img/asistentes/entrenador/calendario.webp",
 "img/asistentes/entrenador/celebra.webp",
 "img/asistentes/entrenador/cronometro.webp",
 "img/asistentes/entrenador/cuidado.webp",
 "img/asistentes/entrenador/descanso.webp",
 "img/asistentes/entrenador/explica.webp",
 "img/asistentes/entrenador/pensando.webp",
 "img/asistentes/entrenador/pregunta.webp",
 "img/asistentes/entrenador/progreso.webp",
 "img/asistentes/entrenador/saludo.webp",
 "img/asistentes/entrenador/sin_senal.webp",
 "img/asistentes/entrenador.webp",
 "img/asistentes/entrenadora/animo.webp",
 "img/asistentes/entrenadora/calendario.webp",
 "img/asistentes/entrenadora/celebra.webp",
 "img/asistentes/entrenadora/cronometro.webp",
 "img/asistentes/entrenadora/cuidado.webp",
 "img/asistentes/entrenadora/descanso.webp",
 "img/asistentes/entrenadora/explica.webp",
 "img/asistentes/entrenadora/pensando.webp",
 "img/asistentes/entrenadora/pregunta.webp",
 "img/asistentes/entrenadora/progreso.webp",
 "img/asistentes/entrenadora/saludo.webp",
 "img/asistentes/entrenadora/sin_senal.webp",
 "img/asistentes/entrenadora.webp",
 "img/asistentes/mancuerna/animo.webp",
 "img/asistentes/mancuerna/calendario.webp",
 "img/asistentes/mancuerna/celebra.webp",
 "img/asistentes/mancuerna/cronometro.webp",
 "img/asistentes/mancuerna/cuidado.webp",
 "img/asistentes/mancuerna/descanso.webp",
 "img/asistentes/mancuerna/explica.webp",
 "img/asistentes/mancuerna/pensando.webp",
 "img/asistentes/mancuerna/pregunta.webp",
 "img/asistentes/mancuerna/progreso.webp",
 "img/asistentes/mancuerna/saludo.webp",
 "img/asistentes/mancuerna/sin_senal.webp",
 "img/asistentes/mancuerna.webp",
 "img/asistentes/pesa/animo.webp",
 "img/asistentes/pesa/calendario.webp",
 "img/asistentes/pesa/celebra.webp",
 "img/asistentes/pesa/cronometro.webp",
 "img/asistentes/pesa/cuidado.webp",
 "img/asistentes/pesa/descanso.webp",
 "img/asistentes/pesa/explica.webp",
 "img/asistentes/pesa/pensando.webp",
 "img/asistentes/pesa/pregunta.webp",
 "img/asistentes/pesa/progreso.webp",
 "img/asistentes/pesa/saludo.webp",
 "img/asistentes/pesa/sin_senal.webp",
 "img/asistentes/pesa.webp",
 "img/asistentes/profe/animo.webp",
 "img/asistentes/profe/calendario.webp",
 "img/asistentes/profe/celebra.webp",
 "img/asistentes/profe/cronometro.webp",
 "img/asistentes/profe/cuidado.webp",
 "img/asistentes/profe/descanso.webp",
 "img/asistentes/profe/explica.webp",
 "img/asistentes/profe/pensando.webp",
 "img/asistentes/profe/pregunta.webp",
 "img/asistentes/profe/progreso.webp",
 "img/asistentes/profe/saludo.webp",
 "img/asistentes/profe/sin_senal.webp",
 "img/asistentes/profe.webp",
 "img/asistentes/quiltro/animo.webp",
 "img/asistentes/quiltro/calendario.webp",
 "img/asistentes/quiltro/celebra.webp",
 "img/asistentes/quiltro/cronometro.webp",
 "img/asistentes/quiltro/cuidado.webp",
 "img/asistentes/quiltro/descanso.webp",
 "img/asistentes/quiltro/explica.webp",
 "img/asistentes/quiltro/pensando.webp",
 "img/asistentes/quiltro/pregunta.webp",
 "img/asistentes/quiltro/progreso.webp",
 "img/asistentes/quiltro/saludo.webp",
 "img/asistentes/quiltro/sin_senal.webp",
 "img/asistentes/quiltro.webp",
 "img/asistentes/robot/animo.webp",
 "img/asistentes/robot/calendario.webp",
 "img/asistentes/robot/celebra.webp",
 "img/asistentes/robot/cronometro.webp",
 "img/asistentes/robot/cuidado.webp",
 "img/asistentes/robot/descanso.webp",
 "img/asistentes/robot/explica.webp",
 "img/asistentes/robot/pensando.webp",
 "img/asistentes/robot/pregunta.webp",
 "img/asistentes/robot/progreso.webp",
 "img/asistentes/robot/saludo.webp",
 "img/asistentes/robot/sin_senal.webp",
 "img/asistentes/robot.webp",
 "img/disponibles.json",
 "img/equipos/abductora.webp",
 "img/equipos/banco.webp",
 "img/equipos/bandas.webp",
 "img/equipos/barra_dominadas.webp",
 "img/equipos/barra_rack.webp",
 "img/equipos/bicicleta.webp",
 "img/equipos/curl_femoral.webp",
 "img/equipos/escaladora.webp",
 "img/equipos/extension_cuadriceps.webp",
 "img/equipos/hip_thrust_maquina.webp",
 "img/equipos/jalon.webp",
 "img/equipos/kettlebells.webp",
 "img/equipos/kickback_maquina.webp",
 "img/equipos/mancuernas.webp",
 "img/equipos/maquinas.webp",
 "img/equipos/paralelas.webp",
 "img/equipos/poleas.webp",
 "img/equipos/prensa.webp",
 "img/equipos/remoergometro.webp",
 "img/equipos/smith.webp",
 "img/equipos/trotadora.webp",
 "img/lugares/casa_mancuernas.webp",
 "img/lugares/casa_sin_equipo.webp",
 "img/lugares/gimnasio_basico.webp",
 "img/lugares/gimnasio_completo.webp",
 "img/niveles/avanzado.webp",
 "img/niveles/intermedio.webp",
 "img/niveles/principiante.webp",
 "img/objetivos/bajar_grasa.webp",
 "img/objetivos/deporte.webp",
 "img/objetivos/ganar_fuerza.webp",
 "img/objetivos/ganar_musculo.webp",
 "img/objetivos/recomposicion.webp",
 "img/objetivos/salud.webp",
 "img/objetivos/volver.webp",
 "index.html",
 "manifest.webmanifest",
 "mas.js",
 "musculos.js",
 "nube.js",
 "plan.js",
 "progreso.js",
 "semana.js",
 "temporada.js",
 "../contenido/checkin.json",
 "../contenido/cuestionario.json",
 "../contenido/ejercicios.json",
 "../contenido/evidencia.json",
 "../contenido/planes.json",
 "../contenido/tecnica.json",
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
 "../nucleo/ficha.js",
 "../nucleo/hevy-csv.js",
 "../nucleo/historial-ejemplo.js",
 "../nucleo/ics.js",
 "../nucleo/importar-plan.js",
 "../nucleo/mcp.js",
 "../nucleo/motor-plan.js",
 "../nucleo/nivel.js",
 "../nucleo/notas.js",
 "../nucleo/progresion.js",
 "../nucleo/recordatorios.js",
 "../nucleo/registro.js",
 "../nucleo/resumen-plan.js",
 "../nucleo/semanal.js",
 "../nucleo/series.js",
 "../nucleo/superseries.js",
 "../nucleo/suplementos.js",
 "../nucleo/validador.js",
 "../nucleo/volumen-semana.js"
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
