import { fechaSesionActiva } from './sesion-activa.js';

// Solo navegación de esta copia del perfil, sin credenciales ni cambios del plan.
const VISTAS = new Set(['inicio', 'cuestionario', 'hoy', 'semana', 'coach', 'progreso', 'mas', 'checkin', 'plan', 'perfil', 'seccion', 'tablero-original', 'ejercicio', 'banco', 'pasado', 'resumen']);
export function pantallaGuardada(vista, extra, y, fecha) {
  if (!VISTAS.has(vista)) return null;
  const datos = {};
  for (const k of ['id', 'desde', 'ej']) if (typeof extra?.[k] === 'string' && extra[k].length <= 120) datos[k] = extra[k];
  return { vista, extra: datos, y: Number.isFinite(y) ? Math.max(0, y) : 0, fecha };
}
export function retornoGuardado(pantalla, estado, fecha) {
  if (!pantalla || pantalla.vista !== estado.vista || !VISTAS.has(pantalla.vista)) return null;
  // Hoy conserva la posición de una sesión que cruzó medianoche; una sesión nueva empieza desde arriba.
  if (pantalla.vista === 'hoy' && pantalla.fecha !== fechaSesionActiva(estado, fecha)) return null;
  if (['ejercicio', 'resumen'].includes(pantalla.vista) && !pantalla.extra?.id) return null;
  return pantallaGuardada(pantalla.vista, pantalla.extra, pantalla.y, pantalla.fecha);
}
