// El bloque siguiente se arma durante la última semana del actual (no recién al terminarlo), así el mes que viene
// queda planificado antes de que se acabe el plan. Parte el lunes después de que termina el bloque, y las sesiones que
// quedan del actual se conservan (como semana 0, fuera del volumen del bloque nuevo).
import { sumarDias } from './agenda.js';

const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

/**
 * Si ya se puede armar el bloque siguiente: desde 6 días antes del último día del plan (o después de terminado).
 * @returns {{fin, quedan, desde}|null} desde: el día que se le pasa al motor (parte el lunes desde ese día)
 */
export function bloqueSiguienteDisponible(plan, hoy) {
  if (!Array.isArray(plan?.dias) || !plan.dias.length || plan.bloqueado || plan.libre) return null;
  const fin = plan.dias.map(d => d.fecha).sort().at(-1);
  const quedan = dias(hoy, fin);
  if (quedan > 6) return null;
  return { fin, quedan: Math.max(0, quedan), desde: fin >= hoy ? sumarDias(fin, 1) : hoy };
}

/** El plan nuevo con las sesiones que quedan del actual (desde hoy y antes de que parta el nuevo). */
export function conDiasQueQuedan(actual, nuevo, hoy) {
  const previos = (actual?.dias || []).filter(d => d.fecha >= hoy && d.fecha < nuevo.inicio).map(d => ({ ...structuredClone(d), semana: 0 }));
  return previos.length ? { ...nuevo, dias: [...previos, ...nuevo.dias] } : nuevo;
}
