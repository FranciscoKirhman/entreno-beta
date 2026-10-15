// Calculadoras del gimnasio para la hoja ＋ del Coach (app/herramientas-coach.js). Funcionan sin señal ni IA.
// Máximo estimado con Epley (la misma fórmula del motor del plan), cargas por porcentaje y series de calentamiento
// hacia el peso de trabajo, redondeadas a lo que se puede armar con la barra y los discos del gimnasio.
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

/** Tabla de cargas: 95 % a 50 % del máximo, cada una con cuántas repeticiones salen al fallo. */
export function cargasPorPorcentaje(maximo, { paso = 2.5 } = {}) {
  if (!(Number(maximo) > 0)) return [];
  return [95, 90, 85, 80, 75, 70, 65, 60, 50].map(pct => ({ pct, kg: redondear(maximo * pct / 100, paso), reps: repsCon(pct) }));
}

/**
 * Series de calentamiento hacia el peso de trabajo, como las de un entrenador: la barra sola y luego subir de a poco
 * con menos repeticiones (50 % × 5, 70 % × 3, 85 % × 1 si el peso es alto). Sin cargas repetidas ni bajo la barra.
 * @returns [{ kg, reps }]
 */
export function seriesCalentamiento(trabajo, { barra = 20, paso = 2.5 } = {}) {
  trabajo = Number(trabajo);
  if (!(trabajo > 0)) return [];
  if (trabajo <= barra) return [];
  const series = [{ kg: barra, reps: 10 }];
  const pasos = trabajo >= 2 * barra + 20 ? [[50, 5], [70, 3], [85, 1]] : [[60, 5], [80, 2]];
  for (const [pct, reps] of pasos) {
    const kg = redondear(trabajo * pct / 100, paso);
    if (kg > series.at(-1).kg && kg < trabajo) series.push({ kg, reps });
  }
  return series;
}
