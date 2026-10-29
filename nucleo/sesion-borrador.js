// La sesión en curso también en la cuenta (app/sesion-nube.js): si el teléfono se pierde o se apaga a mitad de sesión,
// lo anotado (series, notas, pasos, pausas) ya está en el servidor y otro teléfono sigue desde ahí. Lo de una sesión
// vive en E[clave][fecha]; el borrador es eso mismo para la fecha de la sesión empezada y sin guardar.
import { fechaSesionActiva } from './sesion-activa.js';
import { sumarDias } from './agenda.js';

export const CLAVES_SESION = ['inicioSesion', 'pausas', 'registro', 'filas', 'aproxPuestas', 'notas', 'pasos', 'pasosClaves', 'pasosSaltados',
  'pasosMedidas', 'pasosOmitidos', 'cardioHecho', 'retirados', 'vivaHecho', 'vivaNo', 'tiempoHoy'];

const guardada = (estado, fecha) => (estado.sesiones || []).some(s => s.fecha === fecha && !s.origen);
const empezada = (estado, fecha) => {
  const inicio = estado.inicioSesion?.[fecha];
  return (Number.isFinite(inicio) && inicio > 0) || Object.values(estado.registro?.[fecha] || {}).some(filas => Array.isArray(filas) && filas.some(s => s?.hecho));
};

/** La sesión empezada y sin guardar, como {fecha, datos: {clave: lo de esa fecha}}; null si no hay. No cambia `estado`. */
export function borradorSesion(estado, hoy) {
  const fecha = fechaSesionActiva(estado, hoy);
  if (!fecha || guardada(estado, fecha) || !empezada(estado, fecha)) return null;
  const datos = {};
  for (const k of CLAVES_SESION) if (estado[k]?.[fecha] != null) datos[k] = estado[k][fecha];
  return { fecha, datos };
}

/**
 * Pone en `estado` la sesión que llegó de la cuenta, si sirve: de hoy o de ayer, de un día que este teléfono puede
 * abrir (hoy o uno del plan), sin guardar aquí y sin ninguna sesión empezada en este teléfono (lo de aquí manda).
 * Cambia `estado`; devuelve si la puso.
 */
export function reponerBorrador(estado, borrador, hoy) {
  const fecha = borrador?.fecha;
  if (!fecha || !borrador.datos || typeof borrador.datos !== 'object' || fecha > hoy || fecha < sumarDias(hoy, -1)) return false;
  if (fecha !== hoy && !(estado.plan?.dias || []).some(d => d.fecha === fecha)) return false;
  if (guardada(estado, fecha) || empezada(estado, fecha) || borradorSesion(estado, hoy)) return false;
  const datos = borrador.datos;
  if (!empezada({ inicioSesion: { [fecha]: datos.inicioSesion }, registro: { [fecha]: datos.registro } }, fecha)) return false; // vacío: nada que seguir
  for (const k of CLAVES_SESION) if (datos[k] != null) (estado[k] ||= {})[fecha] = structuredClone(datos[k]);
  return true;
}
