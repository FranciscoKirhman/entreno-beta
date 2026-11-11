// El lugar donde se hace una sesión. El plan trae el del día; con más de un lugar en el perfil, la persona puede decir
// a mano que hoy entrena en otro (app/hoy.js, menú de la sesión). Lo elegido vale solo para esa fecha: cambia con qué
// se comparan las máquinas, el escalón de peso y el lugar con que se guarda la sesión. No cambia el plan.
import { tieneEquipo } from './catalogo.js';

/** El lugar de una sesión: el elegido a mano para su fecha, el del día del plan, el principal o el primero. */
export function lugarDeSesion(lugares = [], dia = null, elegidos = null) {
  const elegido = dia?.fecha ? elegidos?.[dia.fecha] : null;
  return (elegido && lugares.find(x => x.nombre === elegido))
    || lugares.find(x => x.nombre === dia?.lugar) || lugares.find(x => x.principal) || lugares[0];
}

/** Se ofrece elegir solo con dos o más lugares con nombre. */
export const puedeElegirLugar = (lugares = []) => lugares.filter(x => x?.nombre).length > 1;

/**
 * Anota el lugar elegido para una fecha. Elegir el que ya trae el plan borra la elección. Devuelve el mapa nuevo, sin
 * fechas de hace más de 14 días (la sesión guardada ya lleva su lugar).
 */
export function elegirLugar(elegidos, fecha, nombre, delPlan = null) {
  const limite = new Date(new Date(`${fecha}T12:00:00Z`).getTime() - 14 * 864e5).toISOString().slice(0, 10);
  const out = Object.fromEntries(Object.entries(elegidos || {}).filter(([f]) => f >= limite && f !== fecha));
  if (nombre && nombre !== delPlan) out[fecha] = nombre;
  return out;
}

/** Los ejercicios de la sesión que piden un equipo que el lugar no tiene (para avisar, sin cambiar nada). */
export function sinEquipoEn(lugar, ejercicios = []) {
  const equipo = lugar?.equipamiento || [];
  return ejercicios.filter(ej => ej && !tieneEquipo(ej, equipo));
}
