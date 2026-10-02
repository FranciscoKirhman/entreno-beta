// Músculos: su nombre para leer y su imagen, una figura con ese músculo pintado hecha con ChatGPT (MU01 a MU03 en
// docs/09-banco-de-imagenes.md). Mientras una imagen no llega, se muestra solo el nombre.
import { IMAGENES, esc } from './comun.js';
import { NOMBRE_ZONA } from '../nucleo/motor-plan.js';

/** Nombre de cada músculo para leer ("glúteo", "zona lumbar"), una lista con "y" al final y la primera en mayúscula. */
export const NOMBRE_MUSCULO = { ...NOMBRE_ZONA, erectores: 'zona lumbar', pantorrilla: 'pantorrilla', trapecio: 'trapecio', antebrazo: 'antebrazo' };
export const lista = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);
export const mayuscula = x => (x ? x[0].toUpperCase() + x.slice(1) : x);
export const nombresMusculos = xs => lista(xs.map(m => NOMBRE_MUSCULO[m] || m));

export const imagenMusculo = m => (IMAGENES.has(`img/musculos/${m}.webp`) ? `img/musculos/${m}.webp` : null);

/** Las imágenes de esos músculos que ya están en la app, en una fila; '' si no hay ninguna. */
export function imagenesMusculos(musculos, clase = 'img-musculo') {
  const xs = musculos.map(m => [m, imagenMusculo(m)]).filter(([, src]) => src);
  return xs.length ? `<div class="fila-musculos">${xs.map(([m, src]) => `<img class="${clase}" src="${src}" alt="${esc(mayuscula(NOMBRE_MUSCULO[m] || m))}" width="160" height="160" decoding="async">`).join('')}</div>` : '';
}
