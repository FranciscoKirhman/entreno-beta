// Semana arrastrable: en el calendario de Mover o faltar, mantener apretada una sesión por hacer y soltarla en otro día.
// Aquí solo se decide qué pasaría (mover a un día libre o intercambiar con la sesión que haya), con los mismos avisos
// que el botón Mover (dos del mismo grupo seguidas). La app lo muestra y pide el sí antes de cambiar el plan.
import { moverSesion, intercambiar, sesionDe, nombreDia } from './agenda.js';

const corta = f => `${nombreDia(f)} ${Number(f.slice(8))}`;

/** Se puede levantar: una sesión del plan de hoy en adelante que no está hecha ni avisada como falta. */
export function sePuedeArrastrar(x, hoy) {
  return Boolean(x?.dia) && x.fecha >= hoy && !x.confirmado && ['naranjo', 'azul'].includes(x.color);
}

/**
 * Qué pasa al soltar la sesión del día `de` sobre el día `a`. No cambia nada: devuelve el plan como quedaría.
 * @param hechas fechas con sesión ya registrada (no se intercambia con una hecha)
 * @returns {{ok: true, plan, texto, avisos: string[], tipo: 'mover' | 'intercambiar'} | {ok: false, error}}
 */
export function soltarSesion(plan, de, a, { hoy, noPuedo = [], hechas = new Set() } = {}) {
  if (!de || !a || de === a) return { ok: false, error: '' };
  const origen = sesionDe(plan, de);
  if (!origen) return { ok: false, error: 'Ese día no tiene sesión para mover.' };
  if (a < hoy) return { ok: false, error: 'Ese día ya pasó: elige de hoy en adelante.' };
  if (hechas.has(a)) return { ok: false, error: 'Ese día ya tiene una sesión hecha.' };
  const destino = sesionDe(plan, a);
  const r = destino ? intercambiar(plan, de, a) : moverSesion(plan, de, a, { noPuedo });
  if (!r.ok) return { ok: false, error: r.error };
  const texto = destino
    ? `${origen.foco} pasa al ${corta(a)} y ${destino.foco} al ${corta(de)}.`
    : `${origen.foco} pasa del ${corta(de)} al ${corta(a)}.`;
  return { ok: true, plan: r.plan, texto, avisos: r.avisos || [], tipo: destino ? 'intercambiar' : 'mover' };
}
