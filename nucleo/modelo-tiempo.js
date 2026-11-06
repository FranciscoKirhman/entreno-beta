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

/** Modelo compartido por la sesión y el generador. Sin mediciones conserva el cálculo original. */
export function duracionEstimada(ejercicios, calentamientoMin = 8, ritmo = null) {
  let seg = calentamientoMin * 60;
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
  return Math.round(seg / 60);
}

export const factorDeRitmo = ritmo => {
  const n = Number(typeof ritmo === 'object' ? ritmo?.factor : ritmo);
  return n > 0 ? Math.max(0.9, Math.min(1.7, n)) : 1;
};
export const pesasReales = (ejercicios, ritmo = 1) => Math.round(duracionEstimada(ejercicios, 0, ritmo) * factorDeRitmo(ritmo));
