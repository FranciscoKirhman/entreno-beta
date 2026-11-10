// Semanas de Mi plan: cuál queda abierta al entrar. Las demás van plegadas en una fila con los nombres de sus sesiones
// en gris (forma B, elegida por Francisco el 6 de noviembre de 2026; docs/48-plan-simplificar-ui.md, B1 y B2).
import { sumarDias } from './agenda.js';

/** Lunes de la semana de una fecha AAAA-MM-DD. */
export const lunesDe = f => sumarDias(f, -((new Date(f + 'T12:00:00Z').getUTCDay() + 6) % 7));

/**
 * El lunes de la semana que parte abierta: la del destino, si se llegó buscando una sesión y esa semana tiene sesiones;
 * si no, la primera semana con sesiones desde hoy (esta semana puede no tener ninguna). null si no queda nada.
 * @param fechas   fechas de las sesiones que vienen
 * @param hoy      AAAA-MM-DD
 * @param destino  fecha de la sesión a la que se quiere llegar (opcional)
 */
export function semanaAbierta(fechas, { hoy, destino = null } = {}) {
  const lunes = [...new Set((fechas || []).filter(f => !hoy || f >= hoy).map(lunesDe))].sort();
  if (!lunes.length) return null;
  if (destino && lunes.includes(lunesDe(destino))) return lunesDe(destino);
  return lunes[0];
}

/** Qué semanas se muestran abiertas: lo que la persona abrió o cerró manda sobre la semana por defecto. */
export function estaAbierta(lunes, porDefecto, elegidas = {}) {
  return lunes in elegidas ? Boolean(elegidas[lunes]) : lunes === porDefecto;
}
