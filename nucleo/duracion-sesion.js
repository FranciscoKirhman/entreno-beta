// Cuánto dura una sesión: desde "Empezar" hasta ahora, sin las pausas. Al guardar, si pasó mucho desde la última
// serie marcada (la guardaste al llegar a la casa o al otro día), la sesión termina poco después de esa serie: así una
// sesión del lunes guardada el martes no queda de 24 horas.

export const MARGEN_ULTIMA_SERIE_MS = 15 * 60e3; // más que esto sin marcar nada: ya habías terminado
export const ENFRIAR_MS = 2 * 60e3; // lo que se suma después de la última serie

/** Milisegundos de pausa hasta `ahora`. pausa: { total, desde } (desde: cuándo empezó la pausa en curso, o null). */
export const msPausa = (pausa, ahora) => (pausa?.total || 0) + (pausa?.desde ? Math.max(0, ahora - pausa.desde) : 0);

/** Tiempo activo de la sesión en milisegundos. */
export function msActivos({ inicio, pausa = null, ahora }) {
  if (!inicio) return 0;
  return Math.max(0, ahora - inicio - msPausa(pausa, ahora));
}

/**
 * Minutos a guardar. ultimaSerie: cuándo se marcó la última serie (o null).
 * @returns número de minutos (1 o más) o null sin inicio
 */
export function minutosAlGuardar({ inicio, pausa = null, ultimaSerie = null, ahora }) {
  if (!inicio) return null;
  let fin = pausa?.desde || ahora; // en pausa, la sesión se detuvo ahí
  if (ultimaSerie && fin - ultimaSerie > MARGEN_ULTIMA_SERIE_MS) fin = ultimaSerie + ENFRIAR_MS;
  const pausas = Math.min(msPausa(pausa, fin), Math.max(0, fin - inicio));
  return Math.max(1, Math.round((fin - inicio - pausas) / 6e4));
}

/** Pausar o reanudar: devuelve la pausa nueva. */
export function alternarPausa(pausa, ahora) {
  const p = { total: pausa?.total || 0, desde: pausa?.desde || null };
  return p.desde ? { total: p.total + Math.max(0, ahora - p.desde), desde: null } : { total: p.total, desde: ahora };
}
