// Guardado sin señal y versiones nuevas en el teléfono (solo la versión de prueba, CONFIG.sinSenal; el service worker
// es herramientas/beta/sw.js).
// Una versión nueva se instala sola en segundo plano y queda esperando: se aplica cuando la app pasa al fondo sin
// sesión en curso (se recarga oculta, y vuelve a la misma pantalla con app/atras.js y la pantalla guardada), o al
// cerrarla del todo. Nunca a mitad de un entrenamiento. Después, la campana avisa qué versión quedó.
import { CONFIG } from './config.js';
import { E, IMAGENES, indice } from './comun.js';
import { sesionEnCurso } from './pantalla.js';
import { anotarSinc } from './campana.js';
import { dibujoEjercicio, srcMiniatura, maquinaDe } from './imagenes.js';
import { imagenMusculo } from './musculos.js';

const CLAVE_VERSION = 'entreno-version-aplicada';
const REVISAR_CADA_MS = 30 * 60 * 1000;
let registro = null, ultimaRevision = 0;

export function instalarActualizacion() {
  if (!CONFIG.sinSenal || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  const habiaControl = Boolean(sw.controller);
  sw.register('sw.js').then(r => { registro = r; ultimaRevision = Date.now(); }).catch(e => console.warn('Sin modo sin señal', e));
  // Solo una versión nueva que reemplaza a otra recarga la app; la primera instalación no.
  let recargando = false;
  sw.addEventListener('controllerchange', () => {
    if (!habiaControl || recargando) return;
    recargando = true;
    location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (!registro) return;
    if (document.visibilityState === 'hidden') {
      if (registro.waiting && !sesionEnCurso()) registro.waiting.postMessage({ tipo: 'aplicar' });
    } else if (Date.now() - ultimaRevision > REVISAR_CADA_MS) {
      // La app puede quedar días abierta en el fondo sin volver a cargarse: revisar de vez en cuando si hay versión.
      ultimaRevision = Date.now();
      registro.update().catch(() => {});
    }
  });
  avisarVersionAplicada();
}

// Una imagen que todavía no está guardada y no llega (sin señal) queda como espacio vacío, no como imagen rota.
document.addEventListener('error', e => { if (e.target instanceof HTMLImageElement) e.target.style.visibility = 'hidden'; }, true);
document.addEventListener('load', e => { if (e.target instanceof HTMLImageElement && e.target.style.visibility === 'hidden') e.target.style.visibility = ''; }, true);

function avisarVersionAplicada() {
  let anterior = null;
  try { anterior = localStorage.getItem(CLAVE_VERSION); localStorage.setItem(CLAVE_VERSION, CONFIG.version); } catch { return; }
  if (!anterior || anterior === CONFIG.version) return;
  const [fecha, hora] = String(CONFIG.version).split(' ');
  const dia = fecha ? new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : '';
  anotarSinc(`Se aplicó la versión nueva de la app${dia ? ` (${dia}${hora ? `, ${hora}` : ''})` : ''}.`);
}

/**
 * Pide al service worker que guarde las imágenes que se van a necesitar sin señal: las de los ejercicios del plan y de
 * las rutinas, el coach elegido y el calentamiento. Las demás se guardan al verlas.
 */
let esperaImagenes = 0;
export function guardarImagenesDelPlan() { if (CONFIG.sinSenal) { clearTimeout(esperaImagenes); esperaImagenes = setTimeout(pedirImagenes, 2000); } }
function pedirImagenes() {
  if (!CONFIG.sinSenal || !navigator.serviceWorker?.controller || navigator.connection?.saveData) return;
  const ids = new Set();
  for (const d of E.plan?.dias || []) for (const x of d.ejercicios || []) if (x?.ejercicio_id) ids.add(x.ejercicio_id);
  for (const r of E.rutinas || []) for (const x of r.ejercicios || []) if (x?.ejercicio_id || x?.id) ids.add(x.ejercicio_id || x.id);
  const rutas = new Set();
  for (const id of ids) {
    const ej = indice.porId.get(id);
    if (!ej) continue;
    for (const r of [srcMiniatura(id), dibujoEjercicio(id), maquinaDe(ej)?.src, imagenMusculo(ej.musculos_primarios?.[0])]) if (r) rutas.add(r);
  }
  const coach = `img/asistentes/${E.asistente || 'entrenadora'}`;
  for (const r of IMAGENES) if (r.startsWith(`${coach}/`) || r === `${coach}.webp` || r.startsWith('img/calentamiento/')) rutas.add(r);
  if (rutas.size) navigator.serviceWorker.controller.postMessage({ tipo: 'guardar-imagenes', rutas: [...rutas] });
}
