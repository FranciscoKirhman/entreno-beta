import { estadoDelPlan } from './registrado.js';
import { sumarDias } from './agenda.js';

const HECHAS = new Set(['hecha', 'recuperada', 'adelantada', 'hecha_sin_registro']);
/** El color representa asistencia, no el cumplimiento de cada serie. */
export function estadoAsistencia(fecha, { hoy, dia, registrado, marca }) {
  if (HECHAS.has(registrado?.t)) return { color: 'verde', etiqueta: registrado.t === 'hecha_sin_registro' ? 'Confirmado por vos, sin series anotadas' : 'Entrenamiento registrado', confirmado: true };
  if (marca === 'saltada') return { color: 'gris', etiqueta: fecha < hoy ? 'Falta confirmada' : 'No voy a ir', confirmado: false };
  if (!dia) return { color: 'gris', etiqueta: 'Sin entrenamiento planificado', confirmado: false };
  if (fecha === hoy) return { color: 'azul', etiqueta: 'Hoy te toca entrenar', confirmado: false };
  if (fecha > hoy) return { color: 'naranjo', etiqueta: 'Voy a ir', confirmado: false };
  return { color: 'rojo', etiqueta: 'Pendiente de confirmar', confirmado: false };
}

export function calendarioAsistencia(plan, sesiones, { hoy, mes = hoy.slice(0, 7), marcas = {} } = {}) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Mes inválido');
  const primero = `${mes}-01`, siguiente = new Date(`${primero}T12:00:00Z`);
  siguiente.setUTCMonth(siguiente.getUTCMonth() + 1);
  const fin = sumarDias(siguiente.toISOString().slice(0, 10), -1);
  const reg = estadoDelPlan(plan, sesiones, { hoy, marcas });
  const dias = new Map((plan?.dias || []).map(d => [d.fecha, d]));
  const porFecha = new Map(sesiones.filter(s => s.series?.some(x => x.tipo !== 'calentamiento')).map(s => [s.fecha, s]));
  return { mes, espacios: (new Date(`${primero}T12:00:00Z`).getUTCDay() + 6) % 7,
    dias: Array.from({ length: Number(fin.slice(8)) }, (_, i) => {
      const fecha = sumarDias(primero, i), dia = dias.get(fecha);
      const registrado = porFecha.has(fecha) ? { t: 'hecha', sesion: porFecha.get(fecha) } : reg.porDia.get(fecha);
      return { fecha, dia, registrado, ...estadoAsistencia(fecha, { hoy, dia, registrado, marca: marcas[fecha] }) };
    }) };
}

/** Solo cambia la declaración de asistencia de esta fecha. El plan y las series se conservan. */
export function cambiarAsistencia(marcas, fecha, accion, { hoy, confirmado = false, tienePlan = true } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !tienePlan) return { error: 'Ese día no tiene entrenamiento planificado.' };
  if (confirmado) return { error: 'Ese entrenamiento ya está confirmado. Sus registros se conservan.' };
  if (!['voy', 'no_voy', 'hice', 'falte', 'pendiente'].includes(accion)) return { error: 'Acción inválida.' };
  if (fecha > hoy && ['hice', 'falte'].includes(accion)) return { error: 'Ese día todavía no llega.' };
  if (fecha < hoy && ['voy', 'no_voy'].includes(accion)) return { error: 'Confirma si entrenaste o faltaste ese día.' };
  const nuevas = { ...marcas };
  if (['voy', 'pendiente'].includes(accion)) delete nuevas[fecha];
  else nuevas[fecha] = accion === 'hice' ? 'hecha' : 'saltada';
  return { marcas: nuevas };
}
