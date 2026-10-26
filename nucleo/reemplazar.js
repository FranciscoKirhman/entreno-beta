// Reemplazar un ejercicio buscando en todo el banco, como Hevy, pero destacando los que trabajan los mismos músculos:
// primero las alternativas de siempre (nucleo/checkin.js), después el mismo patrón y los que comparten más músculos.
// Solo se ofrecen los que se miden igual, porque el reemplazo conserva las series y repeticiones del que sale.
import { medidaDe } from './motor-plan.js';

/** Los músculos principales que comparte con el que se reemplaza, en el orden de ese ejercicio. */
export const musculosEnComun = (base, e) => base.musculos_primarios.filter(m => e.musculos_primarios.includes(m));

// Primero cuántos músculos principales comparte; con los mismos, el mismo patrón (sentadilla, bisagra, empuje: casi el
// mismo movimiento) y lo revisado antes que el banco ampliado. Recién después cuenta que un principal de uno sea
// secundario del otro: antes eso ponía "sin revisión" sobre el hip thrust al buscar "hip" para cambiar la prensa.
const mismoPatron = (base, e) => Boolean(e.patron && e.patron !== 'otro' && e.patron === base.patron);
const cruzados = (base, e) => e.musculos_primarios.filter(m => base.musculos_secundarios.includes(m)).length
  + e.musculos_secundarios.filter(m => base.musculos_primarios.includes(m)).length;

/**
 * Separa los candidatos para reemplazar a base:
 *   mismos: los que comparten algún músculo principal, del más parecido al menos, con esos músculos (comunes);
 *   otros:  el resto que se mide igual, en el orden recibido.
 * sugeridos: ids que van primero (las alternativas de siempre). disponible(e): los que se pueden usar van antes.
 */
export function paraReemplazar(base, candidatos, { sugeridos = [], disponible = () => true } = {}) {
  const medida = medidaDe(base), mismos = [], otros = [];
  for (const e of candidatos) {
    if (e.id === base.id || medidaDe(e) !== medida) continue;
    (musculosEnComun(base, e).length ? mismos : otros).push(e);
  }
  const primero = id => { const i = sugeridos.indexOf(id); return i < 0 ? Infinity : i; };
  mismos.sort((a, b) => Number(!disponible(a)) - Number(!disponible(b)) || primero(a.id) - primero(b.id)
    || musculosEnComun(base, b).length - musculosEnComun(base, a).length || Number(mismoPatron(base, b)) - Number(mismoPatron(base, a))
    || Number(Boolean(a.extra)) - Number(Boolean(b.extra)) || cruzados(base, b) - cruzados(base, a)
    || (a.preferencia ?? 9) - (b.preferencia ?? 9) || a.nombre.localeCompare(b.nombre, 'es'));
  return { mismos: mismos.map(e => ({ ejercicio: e, comunes: musculosEnComun(base, e) })), otros };
}
