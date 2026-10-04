// Pantalla encendida mientras entrenas, como en Hevy: con una sesión en curso (empezada o con alguna serie marcada hoy, y
// todavía sin guardar), el teléfono no se apaga solo. Usa la API Wake Lock del navegador; si el teléfono no la
// tiene, no pasa nada. El navegador la suelta al salir de la app, por eso se vuelve a pedir al volver.
import { E, hoy } from './comun.js';

let bloqueo = null;
let querer = false;

export const encendidaDisponible = () => 'wakeLock' in navigator;

/** Hay una sesión en curso hoy: se tocó "Empezar entrenamiento" o hay alguna serie marcada, y todavía no se guardó. */
export function sesionEnCurso() {
  const f = hoy();
  const marcada = Object.values(E.registro[f] || {}).some(filas => (filas || []).some(x => x?.hecho));
  return (marcada || Boolean(E.inicioSesion?.[f])) && !E.sesiones.some(s => s.fecha === f && !s.origen);
}

async function pedir() {
  if (!querer || bloqueo || document.visibilityState !== 'visible' || !encendidaDisponible()) return;
  try {
    const b = await navigator.wakeLock.request('screen');
    if (!querer) { b.release().catch(() => {}); return; }
    bloqueo = b;
    b.addEventListener('release', () => { if (bloqueo === b) bloqueo = null; });
  } catch { bloqueo = null; } // sin batería, sin permiso o no soportada: se sigue sin ella
}

/** Pide o suelta la pantalla encendida según la preferencia (Más → Pantalla) y si hay una sesión en curso. */
export function actualizarPantalla() {
  querer = E.pantallaEncendida !== false && sesionEnCurso();
  if (querer) pedir();
  else if (bloqueo) { const b = bloqueo; bloqueo = null; b.release().catch(() => {}); }
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pedir(); });
