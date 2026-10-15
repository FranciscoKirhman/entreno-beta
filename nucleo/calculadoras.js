// Calculadoras del gimnasio para la hoja ＋ del Coach (app/herramientas-coach.js). Funcionan sin señal ni IA.
// Máximo estimado con Epley (la misma fórmula del motor del plan) y cargas por porcentaje, redondeadas a lo que se
// puede armar con los discos del gimnasio. Las series de calentamiento son las de nucleo/calentamiento.js.
import { e1rm } from './motor-plan.js';

const r2 = x => Math.round(x * 100) / 100;
/** Al múltiplo de `paso` más cercano (paso = dos veces el disco más chico, porque va uno a cada lado). */
export const redondear = (kg, paso = 2.5) => r2(Math.round(kg / paso) * paso);

/** Máximo estimado de una serie: peso, repeticiones y las que quedaban en reserva (RIR, 0 si fue al fallo). */
export function maximoEstimado(kg, reps, rir = 0) {
  kg = Number(kg); reps = Number(reps); rir = Number(rir) || 0;
  if (!(kg > 0) || !(reps > 0) || reps > 30) return null;
  return r2(e1rm({ carga_kg: kg, reps, rir }));
}

/** Repeticiones al fallo que salen con un porcentaje del máximo (Epley al revés). */
const repsCon = pct => Math.max(1, Math.round(30 * (100 / pct - 1)));

/** Tabla de cargas: 95 % a 50 % del máximo, cada una con cuántas repeticiones salen al fallo, sin pesos repetidos. */
export function cargasPorPorcentaje(maximo, { paso = 2.5 } = {}) {
  if (!(Number(maximo) > 0)) return [];
  // Con discos grandes dos porcentajes pueden quedar en el mismo peso: se muestra una sola vez.
  return [95, 90, 85, 80, 75, 70, 65, 60, 50].map(pct => ({ pct, kg: redondear(maximo * pct / 100, paso), reps: repsCon(pct) }))
    .filter((x, i, xs) => i === 0 || x.kg !== xs[i - 1].kg);
}
