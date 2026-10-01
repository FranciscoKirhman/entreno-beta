// Check-in diario de bienestar ("¿cómo estás hoy?") y su efecto en la sesión del día y en los ciclos.
// Ver contenido/evidencia/08-sueno-y-cansancio.md.

/**
 * @param b { sueno_horas, sueno_calidad (1-5), cansancio (1-5, 5 = agotado), animo (1-5), estres (1-5),
 *            dolor (0-10), enfermo: 'no' | 'resfrio' | 'fiebre_o_cuerpo' }
 * @returns {{puntaje: number, recomendacion: 'normal'|'liviana'|'corta'|'descanso_activo', motivos: string[]}}
 */
export function evaluarDia(b) {
  const motivos = [];
  let p = 100;
  const h = Number(b.sueno_horas);
  if (h && h < 5) { p -= 30; motivos.push('dormiste menos de 5 horas'); }
  else if (h && h < 6) { p -= 15; motivos.push('dormiste menos de 6 horas'); }
  else if (h && h < 7) p -= 6;
  if (b.sueno_calidad) p -= (5 - b.sueno_calidad) * 4;
  if (b.cansancio) { p -= (b.cansancio - 1) * 7; if (b.cansancio >= 4) motivos.push('mucho cansancio'); }
  if (b.animo) p -= (5 - b.animo) * 2;
  if (b.estres) { p -= (b.estres - 1) * 2; if (b.estres >= 5) motivos.push('mucho estrés'); }
  if (b.dolor >= 4) { p -= 15; motivos.push(`dolor de ${b.dolor}/10`); }
  p = Math.max(0, Math.min(100, Math.round(p)));
  let recomendacion = p >= 70 ? 'normal' : p >= 50 ? 'liviana' : p >= 35 ? 'corta' : 'descanso_activo';
  if (b.enfermo === 'fiebre_o_cuerpo') { recomendacion = 'descanso_activo'; motivos.push('síntomas bajo el cuello o fiebre: hoy no se entrena'); }
  else if (b.enfermo === 'resfrio' && recomendacion === 'normal') { recomendacion = 'liviana'; motivos.push('resfrío leve'); }
  return { puntaje: p, recomendacion, motivos };
}

export const TEXTO_RECOMENDACION = {
  normal: 'Sesión normal.',
  liviana: 'Sesión liviana: mismos ejercicios y series, con 2 repeticiones más de reserva.',
  corta: 'Sesión corta: solo lo principal, con una repetición más de reserva.',
  descanso_activo: 'Descanso activo: 20 a 30 minutos de caminata o bicicleta suave y movilidad. La sesión se mueve.',
};

/** Aplica la recomendación a los ejercicios de la sesión de hoy. */
export function ajustarSesion(ejercicios, recomendacion) {
  if (recomendacion === 'liviana') return ejercicios.map(e => ({ ...e, rir: Math.min(5, e.rir + 2) }));
  if (recomendacion === 'corta') return ejercicios.filter(e => e.prioridad === 1).map(e => ({ ...e, rir: Math.min(5, e.rir + 1) }));
  if (recomendacion === 'descanso_activo') return [];
  return ejercicios;
}

/**
 * Tendencia de los últimos registros (más antiguo primero) → qué hacer con el mesociclo.
 * - 'adelantar_descarga': dos semanas con promedio bajo 55, o 5 días bajo 50 en los últimos 7.
 * - 'puede_extender': tres semanas sobre 80 y buena adherencia: el bloque puede durar una semana más.
 */
export function tendencia(registros, { adherencia = null } = {}) {
  const puntajes = registros.map(r => r.puntaje).filter(x => x != null);
  const prom = xs => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const ult7 = puntajes.slice(-7), ult14 = puntajes.slice(-14), ult21 = puntajes.slice(-21);
  if ((ult14.length >= 10 && prom(ult14) < 55) || ult7.filter(p => p < 50).length >= 5) {
    return { accion: 'adelantar_descarga', motivo: 'Vienes con poca energía hace dos semanas: la descarga se adelanta.' };
  }
  if (ult21.length >= 15 && prom(ult21) >= 80 && (adherencia == null || adherencia >= 0.9)) {
    return { accion: 'puede_extender', motivo: 'Tres semanas recuperándote muy bien: el bloque puede durar una semana más antes de descargar.' };
  }
  return { accion: 'seguir', motivo: null };
}
