// Los minutos de cada sesión a tu ritmo y los accesorios que entran cuando hay más tiempo. El ritmo sale de tus últimas
// sesiones (nucleo/tiempo-sesion.js, ritmoPersonal): si las pesas te toman 1,4 veces lo que estima el plan, una sesión
// de 90 minutos del plan se muestra como de unos 115, que es lo que de verdad dura. Sin 3 sesiones que sirvan, se usa
// el modelo del plan tal cual. Pedido de Francisco, 4 de noviembre de 2026: "mis entrenamientos están siendo más
// largos de lo que propones".
import { lugarDeSesion } from '../nucleo/lugar-sesion.js';
import { E, R, D, hoy, indice } from './comun.js';
import { duracionSesion, prescripcion, cargaSugerida, registrosParaCarga, incrementoPara, lugaresDe } from '../nucleo/motor-plan.js';
import { duracionReal, ritmoPersonal, accesoriosParaDia, TOPE_SERIES_SESION } from '../nucleo/tiempo-sesion.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { tieneEquipo, nivelAlcanza, cargaZonaBloqueada, articulacionesBloqueadas } from '../nucleo/catalogo.js';
import { tendenciaDescansos, reloj } from '../nucleo/descansos.js';

let memo = { clave: null, valor: null };
/** {factor, sesiones} de tus últimas sesiones, o null si todavía no hay suficientes. Se recalcula al guardar una sesión. */
export function ritmoHoy() {
  const s = E.sesiones || [];
  const clave = JSON.stringify([s, E.plan, E.descansosMedidos, hoy()]);
  if (memo.clave !== clave) {
    let valor = null;
    try { valor = ritmoPersonal({ sesiones: s, plan: E.plan, porId: indice.porId, descansos: E.descansosMedidos || {}, hasta: hoy() }); } catch { valor = null; }
    memo = { clave, valor };
  }
  return memo.valor;
}
export const factorRitmo = () => ritmoHoy() ?? 1;

/** Minutos del día a tu ritmo (o los del plan si no hay ritmo o el cardio no dice sus minutos). */
export const minutosDe = dia => (dia ? duracionReal(dia, factorRitmo()) ?? duracionSesion(dia) : null);

/**
 * "las pesas te toman 1,4 veces lo estimado": para explicar de dónde salen los minutos. Con descansos medidos
 * (nucleo/descansos.js), también por qué: "descansas 3:40 en los básicos y el plan pide 2:30". Vacío sin ritmo o cerca de 1.
 */
export function textoRitmo() {
  const r = ritmoHoy();
  if (!r) return '';
  if (r.descansos) return `con los descansos medidos de ${r.descansos.sesiones} sesiones y tu ritmo ajustado a ellos${r.descansos.basicos ? ` (básicos: ${reloj(r.descansos.basicos.real)})` : ''}`;
  if (Math.abs(r.factor - 1) < 0.08) return '';
  const t = tendenciaDescansos(E.descansosMedidos || {});
  const porque = t?.basicos && t.basicos.real > t.basicos.pedido + 30 ? `: descansas ${reloj(t.basicos.real)} en los básicos y el plan pide ${reloj(t.basicos.pedido)}` : '';
  return `a tu ritmo de las últimas ${r.sesiones} sesiones (las pesas te toman ${String(r.factor).replace('.', ',')} veces lo que estima el plan${porque})`;
}

/** Series de trabajo por sesión como máximo razonable, según tu nivel. */
export const topeSeriesHoy = () => TOPE_SERIES_SESION[D()?.nivel] ?? TOPE_SERIES_SESION.intermedio;

const lugarDe = dia => lugarDeSesion(lugaresDe(R()), dia, E.lugarSesion);

/**
 * Accesorios para alargar la sesión de un día cuando hay más tiempo, ya prescritos (series, repeticiones, reserva,
 * descanso y peso de tu historial), del más al menos necesario. Van como opcionales (prioridad 4): con menos tiempo o
 * un día de rendimiento bajo son lo primero que sale.
 */
export function accesoriosHoy(dia) {
  const r = R() || {}, d = D(), f = dia?.fecha || hoy();
  const lugar = lugarDe(dia), equipo = lugar?.equipamiento || [];
  const bloqueadas = articulacionesBloqueadas(r.lesiones || [], f);
  const prohibidos = new Set(r.prohibidos || []);
  const todas = seriesAnotadas(E.sesiones || [], E.registro || {});
  const ids = accesoriosParaDia({
    dia, porId: indice.porId, ejercicios: indice.ejercicios, prioridad: r.musculos_prioridad || [], conHistorial: new Set(todas.map(s => s.ejercicio_id)),
    puede: ej => ej.tipo !== 'cardio' && tieneEquipo(ej, equipo) && nivelAlcanza(d.nivel, ej.nivel_minimo) && !prohibidos.has(ej.id) && !cargaZonaBloqueada(ej, bloqueadas),
  });
  return ids.map((id, i) => {
    const ej = indice.porId.get(id), pr = prescripcion(ej, 4, d);
    pr.series = Math.min(pr.series, ej.tipo === 'core' ? 2 : 3);
    const carga = cargaSugerida({ e: pr, ej, lugar, registros: registrosParaCarga(todas, id, f) });
    const elegir = carga == null && pr.unidad === 'reps' && incrementoPara(ej, lugar);
    return { ejercicio_id: id, nombre: ej.nombre, orden: 100 + i, prioridad: 4, ...pr, carga_kg: carga,
      nota: `Opcional: entra porque hoy hay tiempo.${elegir ? ` Elige un peso con el que te sobren ${pr.rir} repeticiones.` : ''}` };
  });
}
