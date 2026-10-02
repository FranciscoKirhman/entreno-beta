// Imágenes de los ejercicios: el dibujo de cómo se hace (cuando llega de ChatGPT) o, mientras tanto, el ícono de su
// máquina; si no usa máquina, la imagen del músculo que más trabaja. Nunca se pide una imagen que no existe.
import { IMAGENES, indice, esc } from './comun.js';
import { imagenMusculo } from './musculos.js';
import { icono } from './iconos.js';

// La máquina que mejor representa el ejercicio va primero (la prensa dice más que "banco").
const ORDEN_EQUIPO = ['prensa', 'extension_cuadriceps', 'curl_femoral', 'hip_thrust_maquina', 'abductora', 'kickback_maquina', 'jalon', 'smith',
  'poleas', 'maquinas', 'barra_dominadas', 'paralelas', 'barra_rack', 'kettlebells', 'mancuernas', 'bandas', 'escaladora', 'trotadora', 'bicicleta', 'remoergometro', 'banco'];

export const hayImagen = ruta => IMAGENES.has(ruta);
export const dibujoEjercicio = id => (hayImagen(`img/ejercicios/${id}.webp`) ? `img/ejercicios/${id}.webp` : null);

/** Ícono de la máquina principal de un ejercicio, o null si no usa ninguna. */
export function maquinaDe(ej) {
  const eq = ORDEN_EQUIPO.find(q => ej.equipamiento.includes(q) && hayImagen(`img/equipos/${q}.webp`));
  return eq ? { id: eq, src: `img/equipos/${eq}.webp` } : null;
}

/** La imagen chica de un ejercicio (su dibujo o su máquina), o null: para las hojas de opciones. */
export function srcMiniatura(id) {
  const ej = indice.porId.get(id);
  if (!ej) return null;
  return hayImagen(`img/ejercicios/mini/${id}.webp`) ? `img/ejercicios/mini/${id}.webp` : maquinaDe(ej)?.src || null;
}

/** Miniatura cuadrada de un ejercicio, para las listas (Hoy, Semana, Tu plan, la ficha). */
export function miniatura(id, clase = 'miniatura') {
  const ej = indice.porId.get(id);
  if (!ej) return `<span class="${clase} vacia" aria-hidden="true"></span>`;
  const mini = `img/ejercicios/mini/${id}.webp`;
  if (hayImagen(mini)) return `<img class="${clase}" src="${mini}" alt="" width="96" height="96" decoding="async">`;
  const m = maquinaDe(ej);
  if (m) return `<img class="${clase} maquina" src="${m.src}" alt="" width="96" height="96" decoding="async">`;
  const mu = imagenMusculo(ej.musculos_primarios[0]);
  if (mu) return `<img class="${clase} maquina" src="${mu}" alt="" width="96" height="96" decoding="async">`;
  return `<span class="${clase} sin-imagen" aria-hidden="true">${icono('pesa')}</span>`;
}
