// Ciclo menstrual, solo si la persona lo activa (dato de salud aparte): en qué día y fase va, cuándo viene la próxima
// regla y si hoy es uno de los días que marcó como difíciles. No programa el entrenamiento por fases: la evidencia no
// lo respalda (contenido/evidencia/05-ciclo-menstrual.md). En los días difíciles el check-in pregunta cómo está y, si
// hay poca energía o síntomas, ofrece la versión liviana (nucleo/bienestar.js).
// Con anticonceptivo hormonal no hay fases: solo se registran síntomas. Si el ciclo no es regular, no se predice:
// solo se sabe la regla, desde que la persona marca que empezó.
import { sumarDias } from './agenda.js';

export const NOMBRE_FASE = { regla: 'regla', folicular: 'fase folicular', ovulacion: 'mitad del ciclo', lutea: 'fase lútea', antes: 'días antes de la regla' };
export const SINTOMAS = [['cansancio', 'Cansancio'], ['dolor', 'Dolor abdominal'], ['animo', 'Ánimo bajo'], ['hinchazon', 'Hinchazón']];
const DIAS_REGLA = 5;
const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const esFecha = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export const cicloActivo = r => r?.seguimiento_ciclo === true;
const inicios = r => [...new Set([r.ultima_regla, ...(r.inicios_regla || [])].filter(esFecha))].sort();

/** Largo del ciclo: la mediana de los últimos que marcaste (si hay al menos uno completo), lo que dijiste o 28. */
export function largoEstimado(r) {
  const xs = inicios(r);
  const largos = xs.slice(1).map((f, i) => dias(xs[i], f)).filter(d => d >= 20 && d <= 45).slice(-6).sort((a, b) => a - b);
  if (largos.length) return largos[Math.floor((largos.length - 1) / 2)];
  const dicho = Number(r.largo_ciclo);
  return dicho >= 20 && dicho <= 45 ? Math.round(dicho) : 28;
}

/**
 * @returns {{dia, largo, fase, proxima, faltan, atraso, dificil, hormonal, predice} | null}
 *   null si no está activado o no hay fecha de inicio. dia: 1 es el primer día de la regla. fase: null con
 *   anticonceptivo hormonal, o fuera de la regla si el ciclo no es regular. atraso: días pasados de la fecha estimada.
 */
export function estadoCiclo(r, hoy) {
  if (!cicloActivo(r)) return null;
  const ultima = inicios(r).filter(f => f <= hoy).at(-1);
  if (!ultima) return null;
  const hormonal = r.anticonceptivo_hormonal === 'si';
  const predice = !hormonal && r.regular !== false;
  const largo = largoEstimado(r);
  const dia = dias(ultima, hoy) + 1;
  const ovulacion = largo - 14;
  let fase = null;
  if (!hormonal && dia <= DIAS_REGLA) fase = 'regla';
  else if (predice) fase = dia >= largo - 4 ? 'antes' : Math.abs(dia - ovulacion) <= 1 ? 'ovulacion' : dia < ovulacion ? 'folicular' : 'lutea';
  const proxima = predice ? sumarDias(ultima, largo) : null;
  return {
    dia, largo, fase, hormonal, predice, proxima,
    faltan: proxima ? dias(hoy, proxima) : null,
    atraso: proxima && hoy > proxima ? dias(proxima, hoy) : 0,
    dificil: Boolean(fase && (r.fases_dificiles || []).includes(fase)),
  };
}

/** "Me llegó": guarda el inicio de la regla (hoy u otro día pasado) y deja los últimos 12 para estimar el largo. */
export function registrarInicio(r, fecha, hoy) {
  if (!esFecha(fecha) || fecha > hoy) return { error: 'Elige un día de hoy hacia atrás.' };
  // Una marca a menos de 10 días de otra es la misma regla: manda la última que marcaste (corrige la anterior).
  const xs = [...inicios(r).filter(f => Math.abs(dias(f, fecha)) >= 10), fecha].sort();
  return { respuestas: { ...r, ultima_regla: xs.at(-1), inicios_regla: xs.slice(-12) } };
}

/** Junta fechas de inicio de dos lugares (el teléfono y la cuenta): sin repetir, en orden, y dos a menos de 10 días
 *  son la misma regla (queda la primera). */
export function unirInicios(fechas) {
  const out = [];
  for (const f of [...new Set(fechas.filter(esFecha))].sort()) if (!out.length || dias(out.at(-1), f) >= 10) out.push(f);
  return out;
}
