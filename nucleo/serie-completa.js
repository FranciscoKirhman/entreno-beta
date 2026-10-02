import { tipoDe } from './registro.js';

// Solo cuentan cifras realmente anotadas, nunca las sugerencias de los campos.
export function serieCompleta(serie, ejercicio) {
  const positiva = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
  if (!positiva(serie.reps) || !Number.isInteger(serie.reps)) return false;
  if (ejercicio.unidad === 'seg') return true;
  if (typeof serie.kg !== 'number' || !Number.isFinite(serie.kg) || serie.kg < 0 || serie.kg >= 500) return false;
  if (tipoDe(serie) === 'calentamiento') return true;
  return typeof serie.rir === 'number' && Number.isInteger(serie.rir) && serie.rir >= 0 && serie.rir <= 5;
}
