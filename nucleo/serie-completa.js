import { tipoDe } from './registro.js';

// Solo cuentan cifras realmente anotadas, nunca las sugerencias de los campos. sinCarga: peso corporal sin un peso
// sugerido (dominadas, fondos, flexiones): ahí los kilos son opcionales y basta con repeticiones y RIR.
export function serieCompleta(serie, ejercicio, { sinCarga = false } = {}) {
  const positiva = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
  if (!positiva(serie.reps) || !Number.isInteger(serie.reps)) return false;
  if (ejercicio.unidad === 'seg') return true;
  // Peso y distancia (caminata del granjero): kilos y metros, sin RIR.
  if (ejercicio.unidad === 'm') return sinCarga && serie.kg == null ? true : typeof serie.kg === 'number' && Number.isFinite(serie.kg) && serie.kg >= 0 && serie.kg < 500;
  if (!(sinCarga && serie.kg == null) && (typeof serie.kg !== 'number' || !Number.isFinite(serie.kg) || serie.kg < 0 || serie.kg >= 500)) return false;
  if (tipoDe(serie) === 'calentamiento') return true;
  // El RIR va de 0 a 5, en pasos de medio (1,5 es "salían 1 o 2 más").
  return typeof serie.rir === 'number' && Number.isInteger(serie.rir * 2) && serie.rir >= 0 && serie.rir <= 5;
}
