// Figura del cuerpo de frente y de espalda con los músculos coloreados, como Hevy y OpenGym: en la cabecera de la
// sesión, al terminar y en Progreso como mapa de calor. Los trazos son de MuscleMap (MIT, app/cuerpo-trazos.js) y se
// cargan solo cuando hay una figura en pantalla. Las figuras se dejan como <div data-cuerpo> y pintarCuerpos las dibuja.
import { R, esc, indice } from './comun.js';
import { NOMBRE_MUSCULO, mayuscula } from './musculos.js';

// Cada músculo de Entreno y las partes de MuscleMap que lo dibujan.
export const PARTES = {
  pecho: ['chest'], espalda: ['upperBack', 'rotatorCuff'], hombro: ['deltoids'], biceps: ['biceps'], triceps: ['triceps'],
  core: ['abs', 'obliques'], erectores: ['lowerBack'], cuadriceps: ['quadriceps'], femoral: ['hamstring'], gluteo: ['gluteal'],
  aductor_abductor: ['adductors'], pantorrilla: ['calves'], trapecio: ['trapezius'], antebrazo: ['forearm'],
};
const MUSCULO_DE = Object.fromEntries(Object.entries(PARTES).flatMap(([m, ps]) => ps.map(p => [p, m])));
const COSMETICAS = new Set(['hair', 'head']);

let trazos = null, cargando = null;
const cargar = () => (trazos ? Promise.resolve(trazos) : (cargando ||= import('./cuerpo-trazos.js').then(m => (trazos = m.TRAZOS))));

/** Series por músculo (la principal cuenta 1 y la secundaria media) → intensidad de 0 a 1, contra el máximo. */
export function intensidades(series) {
  const n = {};
  for (const s of series) {
    const ej = indice.porId.get(s.ejercicio_id);
    if (!ej) continue;
    for (const m of ej.musculos_primarios) n[m] = (n[m] || 0) + 1;
    for (const m of ej.musculos_secundarios) n[m] = (n[m] || 0) + 0.5;
  }
  const max = Math.max(0, ...Object.values(n));
  return { porMusculo: n, intensidad: Object.fromEntries(Object.entries(n).map(([m, v]) => [m, max ? v / max : 0])) };
}
/** Los músculos que trabajan unos ejercicios (principal 1, secundario 0,5), para ver una rutina antes de hacerla. */
export const intensidadEjercicios = ids => intensidades(ids.map(ejercicio_id => ({ ejercicio_id }))).intensidad;

/** Un lugar para la figura. tamano: 'mini' (cabecera), 'mediano' o 'grande'. */
export const cuerpoHtml = (intensidad, { tamano = 'mediano', etiqueta = 'Músculos trabajados' } = {}) =>
  `<div class="cuerpo cuerpo-${tamano}" data-cuerpo="${esc(JSON.stringify(intensidad))}" role="img" aria-label="${esc(`${etiqueta}: ${Object.entries(intensidad).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([m]) => NOMBRE_MUSCULO[m] || m).join(', ') || 'ninguno todavía'}`)}"></div>`;

/** Los músculos de Entreno que no aparecen en la intensidad (para "no entrenaste"). */
export const sinTrabajar = intensidad => Object.keys(PARTES).filter(m => !(intensidad[m] > 0)).map(m => mayuscula(NOMBRE_MUSCULO[m] || m));

function svg(vista, intensidad) {
  const paths = Object.entries(vista.partes).map(([parte, d]) => {
    const m = MUSCULO_DE[parte], v = m ? intensidad[m] || 0 : 0;
    const clase = COSMETICAS.has(parte) ? 'cuerpo-cosmetica' : m ? (v > 0 ? 'cuerpo-activo' : 'cuerpo-musculo') : 'cuerpo-base';
    return d.map(x => `<path class="${clase}" d="${x}"${v > 0 ? ` style="--nivel:${Math.round(25 + v * 75)}%"` : ''}/>`).join('');
  }).join('');
  return `<svg viewBox="${vista.caja}" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/** Dibuja las figuras pendientes dentro de raiz (hombre o mujer según el perfil). */
export async function pintarCuerpos(raiz = document) {
  const cajas = [...raiz.querySelectorAll('[data-cuerpo]:not([data-pintado])')];
  if (!cajas.length) return;
  const t = await cargar();
  const figura = t[R()?.sexo === 'femenino' ? 'mujer' : 'hombre'];
  for (const c of cajas) {
    if (!c.isConnected) continue;
    let intensidad = {};
    try { intensidad = JSON.parse(c.dataset.cuerpo); } catch { /* sin datos: figura gris */ }
    c.innerHTML = svg(figura.frente, intensidad) + svg(figura.espalda, intensidad);
    c.dataset.pintado = '1';
  }
}

/** Dibuja solas las figuras que aparecen en la página (al cambiar de pantalla o al repintar una). */
export function observarCuerpos() {
  let pendiente = false;
  new MutationObserver(() => {
    if (pendiente || !document.querySelector('[data-cuerpo]:not([data-pintado])')) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; pintarCuerpos(); });
  }).observe(document.body, { childList: true, subtree: true });
  pintarCuerpos();
}
