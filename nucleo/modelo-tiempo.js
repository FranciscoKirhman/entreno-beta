import { grupos } from './superseries.js';

// El dato medido ajusta la prescripción, sin igualar descansos de ejercicios ni fases distintas.
export const ESCALA_DESCANSO = { min: 0.5, max: 3, segundosMax: 480 };
export function descansoEstimado(e, ritmo = null) {
  const pedido = e.descanso_seg ?? 90, tipo = ritmo?.tipos?.[e.ejercicio_id];
  const dato = tipo === 'compuesto' ? ritmo?.descansos?.basicos : tipo ? ritmo?.descansos?.accesorios : null;
  if (!Number.isFinite(dato?.real) || !Number.isFinite(dato?.pedido) || dato.real <= 0 || dato.pedido <= 0) return pedido;
  const factor = Math.min(ESCALA_DESCANSO.max, Math.max(ESCALA_DESCANSO.min, dato.real / dato.pedido));
  return Math.min(ESCALA_DESCANSO.segundosMax, pedido * factor);
}

// Los ejercicios de cardio del catálogo (escaladora, trotadora, bicicleta puestos como ejercicio de la sesión): sus
// "repeticiones" son minutos, salvo que vengan en segundos. Los anota crearIndice (nucleo/catalogo.js). Antes una
// escaladora de 10 a 20 minutos contaba como 15 repeticiones, un minuto: el tiempo de la sesión y su ajuste no la
// veían (Francisco, 11 de noviembre de 2026).
const CARDIO = new Set();
export function anotarCardio(ids = []) { for (const id of ids) CARDIO.add(id); }
export const esCardio = e => CARDIO.has(e?.ejercicio_id);
/** Segundos de un ejercicio de cardio: sus minutos (o segundos) por sus series, sin descansos. */
export const segundosCardio = e => (Number(e.series) || 1) * ((Number(e.reps_min) + Number(e.reps_max)) / 2) * (e.unidad === 'seg' ? 1 : 60);

/** Modelo compartido por la sesión y el generador. Sin mediciones conserva el cálculo original. */
export function duracionEstimada(ejercicios, calentamientoMin = 8, ritmo = null) {
  return Math.round((calentamientoMin * 60 + segundosPesas(ejercicios, ritmo) + ejercicios.filter(esCardio).reduce((a, e) => a + segundosCardio(e) + 60, 0)) / 60);
}

/** Los segundos de las pesas (sin el cardio puesto como ejercicio, que no depende del ritmo personal). */
function segundosPesas(todos, ritmo = null) {
  const ejercicios = todos.filter(e => !esCardio(e));
  let seg = 0;
  const g = grupos(ejercicios), medidos = ritmo?.descansos;
  const descanso = e => descansoEstimado(e, ritmo);
  ejercicios.forEach((e, i) => {
    const trabajo = (e.reps_min + e.reps_max) / 2 * (['seg', 'm'].includes(e.unidad) ? 1 : 4);
    seg += e.series * (trabajo + (g[i] ? 15 : descanso(e)));
    if (g[i]?.pos === 1) seg += Math.max(...g[i].miembros.map(m => ejercicios[m].series)) * Math.max(...g[i].miembros.map(m => descanso(ejercicios[m])));
    // cambios.real ya incluye el descanso al salir del ejercicio anterior. Sustituye ese descanso más la
    // transición, nunca se suma encima. La preparación inicial conserva su minuto y las parejas su preparación.
    const previo = ejercicios[i - 1];
    if (i && medidos?.cambios?.real > 0 && !(e.superserie && e.superserie === previo.superserie)) {
      const anterior = g[i - 1] ? Math.max(...g[i - 1].miembros.map(m => descanso(ejercicios[m]))) : descanso(previo);
      seg += medidos.cambios.real - anterior;
    } else seg += 60;
  });
  return seg;
}

export const factorDeRitmo = ritmo => {
  const n = Number(typeof ritmo === 'object' ? ritmo?.factor : ritmo);
  return n > 0 ? Math.max(0.9, Math.min(1.7, n)) : 1;
};
// El ritmo personal alarga las pesas (descansos, cambios), no el cardio: 15 minutos de escaladora son 15 minutos.
export const pesasReales = (ejercicios, ritmo = 1) => Math.round(Math.round(segundosPesas(ejercicios, ritmo) / 60) * factorDeRitmo(ritmo))
  + Math.round(ejercicios.filter(esCardio).reduce((a, e) => a + segundosCardio(e) + 60, 0) / 60);
