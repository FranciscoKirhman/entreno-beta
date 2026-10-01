// Ajuste semanal de cargas: las reglas de contenido/checkin.json → semanal.reglas_de_ajuste, como código.
// Son las mismas que se venían aplicando a mano en el tablero.
import { e1rm, incrementoPara } from './motor-plan.js';
import { calidadPermiteSubir } from './notas.js';

/** Kilos con coma decimal, como se escriben en Chile. */
const kg = x => `${String(x).replace('.', ',')} kg`;
const reserva = s => (s.rir != null ? s.rir : s.rpe != null ? 10 - s.rpe : null);

/**
 * Decide la carga y las repeticiones de la próxima semana para un ejercicio.
 * @param p.objetivo   prescripción vigente {series, reps_min, reps_max, rir, carga_kg, unidad}
 * @param p.hechas     series efectivas de esta semana en ese ejercicio [{carga_kg, reps, rir?, rpe?}]
 * @param p.semanas    mejor 1RM estimado de las semanas anteriores, de la más antigua a la más nueva
 * @param p.subioRecien la carga se subió la semana pasada
 * @param p.incremento kg que se pueden sumar (null en peso corporal)
 * @param p.calidad    respuestas del desplegable del ejercicio (forma, rango, molestia, dolor), si las hay
 */
export function ajustarEjercicio({ objetivo: o, hechas, semanas = [], subioRecien = false, incremento, calidad = null }) {
  // Si el plan no indicaba carga ("elige un peso"), la referencia es la más pesada que anotó.
  const carga = o.carga_kg ?? (Math.max(0, ...hechas.map(s => Number(s.carga_kg) || 0)) || null);
  const mantener = (regla, motivo) => ({ accion: 'mantener', carga_kg: carga, reps_min: o.reps_min, reps_max: o.reps_max, regla, motivo });
  if (!hechas.length) return mantener('sin_registro', 'No hay series registradas esta semana.');
  if (o.unidad === 'seg') return mantener('isometrico', 'Los isométricos progresan en segundos dentro del rango.');
  if (!carga && incremento) return mantener('sin_carga', 'No anotaste el peso: anótalo en la próxima sesión para poder ajustarlo.');

  const completas = hechas.length >= o.series;
  const todasAlTope = completas && hechas.slice(0, o.series).every(s => s.reps >= o.reps_max);
  const conReserva = hechas.every(s => reserva(s) == null || reserva(s) >= o.rir - 0.5);
  const sobrabanMuchas = hechas.every(s => reserva(s) != null && reserva(s) >= 4);
  const bajoElRango = hechas.some(s => s.reps < o.reps_min);

  // Anclaje: si la carga nueva no salió limpia, se vuelve a la anterior una semana.
  if (subioRecien && bajoElRango && incremento) {
    return { accion: 'bajar_carga', carga_kg: carga - incremento, reps_min: o.reps_min, reps_max: o.reps_max, regla: 'anclaje',
      motivo: `Con ${kg(carga)} no salió el rango completo. Vuelves a ${kg(carga - incremento)} una semana antes de intentarlo de nuevo.` };
  }

  // Estancamiento: tres semanas sin mejorar el 1RM estimado.
  const actual = Math.max(...hechas.filter(s => s.carga_kg > 0 && s.reps > 0).map(e1rm), 0);
  const ultimas = [...semanas, actual].slice(-4);
  if (ultimas.length === 4 && Math.max(...ultimas.slice(1)) <= ultimas[0] * 1.005 && incremento && carga) {
    const nueva = Math.max(incremento, Math.round((carga * 0.925) / incremento) * incremento);
    return { accion: 'bajar_carga', carga_kg: nueva, reps_min: o.reps_min, reps_max: o.reps_max, regla: 'estancamiento',
      motivo: 'Tres semanas sin mejorar. Bajas un 7,5% y vuelves a subir; si se repite, conviene cambiar a una variante.' };
  }

  // Calidad: con técnica rota, rango parcial o dolor, no se sube aunque se hayan completado las repeticiones.
  const cal = calidadPermiteSubir(calidad || {});
  if (!cal.ok && ((todasAlTope && conReserva) || sobrabanMuchas)) return mantener('calidad', cal.motivo);

  if ((todasAlTope && conReserva) || sobrabanMuchas) {
    if (!incremento) {
      return { accion: 'subir_reps', carga_kg: carga, reps_min: o.reps_min + 2, reps_max: o.reps_max + 2, regla: 'doble_progresion',
        motivo: 'Sin peso que sumar: sube el rango de repeticiones.' };
    }
    // Incremento grande para la carga (más de 5%): primero más repeticiones.
    if (carga && incremento / carga > 0.05 && o.reps_max < 15 && !o.rango_extendido) {
      return { accion: 'subir_reps', carga_kg: carga, reps_min: o.reps_min, reps_max: o.reps_max + 2, rango_extendido: true, regla: 'incremento_grande',
        motivo: `Subir ${kg(incremento)} sobre ${kg(carga)} es más de un 5%. Primero llegas a ${o.reps_max + 2} repeticiones con el mismo peso.` };
    }
    const base = o.rango_extendido ? { reps_min: o.reps_min, reps_max: o.reps_max - 2 } : { reps_min: o.reps_min, reps_max: o.reps_max };
    return { accion: 'subir_carga', carga_kg: carga + incremento, ...base, regla: 'doble_progresion',
      motivo: sobrabanMuchas && !todasAlTope ? 'Te sobraban 4 o más repeticiones: sube la carga.' : `Todas las series en ${o.reps_max} repeticiones con reserva: sube ${kg(incremento)}.` };
  }
  if (!bajoElRango) return { ...mantener('repeticiones_primero', 'Dentro del rango: mismo peso y una repetición más por serie.'), accion: 'subir_reps_dentro' };
  return mantener('repetir', 'Algunas series quedaron bajo el rango: repite la carga.');
}

/** Semana de descarga adelantada: dos semanas de energía baja, o rendimiento cayendo en 2+ ejercicios principales. */
export function descargaAnticipada({ energias = [], caidas = 0, suenoMalo = [], estres = [] }) {
  const dos = (xs, f) => xs.length >= 2 && xs.slice(-2).every(f);
  return dos(energias, e => e <= 2) || caidas >= 2 || (dos(suenoMalo, Boolean) && dos(estres, e => e >= 5));
}

/** Adherencia de las dos últimas semanas → achicar o ampliar el plan. */
export function ajusteAdherencia(adherencias, energias = [], hayDolor = false) {
  const ult = adherencias.slice(-2);
  if (ult.length === 2 && ult.every(a => a < 0.6)) return 'achicar';
  if (adherencias.length && adherencias.at(-1) >= 1 && (energias.at(-1) ?? 0) >= 4 && !hayDolor) return 'ampliar';
  return 'igual';
}

/**
 * Aplica el ajuste a los días de la semana siguiente de un plan.
 * @param registros series efectivas de la semana: [{ejercicio_id, carga_kg, reps, rir?, rpe?, plantilla?}]. Con
 *                  plantilla, cada día usa solo sus series (un ejercicio puede ir en dos días con otra prescripción).
 * @param aceptar   claves "plantilla|ejercicio_id" que la persona confirmó; sin esto se aplica todo
 * @returns {{plan, cambios, resultados}} plan nuevo (copia), los cambios aplicados y lo propuesto para cada
 *          ejercicio (también lo que se mantiene), con lo de esta semana (antes) y lo que había en la siguiente
 */
export function ajustarSemana({ plan, semana, registros, historialSemanas = {}, subidas = new Set(), indice, lugar, calidades = {}, aceptar = null }) {
  const nuevo = structuredClone(plan);
  const cambios = [], resultados = [];
  const descarga = semana + 1 === plan.semana_descarga; // la descarga mantiene la carga
  const siguiente = nuevo.dias.filter(x => x.semana === semana + 1);
  const vistos = new Set();
  for (const dia of siguiente) {
    const previo = plan.dias.find(x => x.semana === semana && x.plantilla === dia.plantilla);
    for (const e of dia.ejercicios) {
      if (!e.ejercicio_id) continue; // lo indicado por un profesional no se progresa solo
      const ej = indice.porId.get(e.ejercicio_id);
      const clave = `${dia.plantilla}|${e.ejercicio_id}`;
      const objetivo = previo?.ejercicios.find(y => y.ejercicio_id === e.ejercicio_id) || e;
      const hechas = registros.filter(s => s.ejercicio_id === e.ejercicio_id && (!s.plantilla || s.plantilla === dia.plantilla));
      const r = ajustarEjercicio({
        objetivo, hechas, semanas: historialSemanas[e.ejercicio_id] || [], subioRecien: subidas.has(e.ejercicio_id),
        incremento: ej ? incrementoPara(ej, lugar) : null,
        calidad: calidades[e.ejercicio_id] || null,
      });
      const aplica = !descarga && (!aceptar || aceptar.has(clave));
      if (!vistos.has(clave)) {
        vistos.add(clave);
        const fila = {
          clave, plantilla: dia.plantilla, foco: dia.foco, ejercicio_id: e.ejercicio_id, nombre: ej?.nombre || e.nombre || e.ejercicio_id,
          antes: { carga_kg: objetivo.carga_kg ?? null, reps_min: objetivo.reps_min, reps_max: objetivo.reps_max },
          siguiente: { carga_kg: e.carga_kg ?? null, reps_min: e.reps_min, reps_max: e.reps_max },
          hechas, ...r,
        };
        resultados.push(fila);
        if (aplica && r.accion !== 'mantener') cambios.push(fila);
      }
      if (!aplica) continue;
      // La nota "elige un peso" sobra cuando la carga ya quedó fijada.
      if (e.carga_kg == null && r.carga_kg != null && /^Elige un peso/.test(e.nota || '')) e.nota = null;
      Object.assign(e, { carga_kg: r.carga_kg, reps_min: r.reps_min, reps_max: r.reps_max });
      if (r.rango_extendido !== undefined) e.rango_extendido = r.rango_extendido;
    }
  }
  return { plan: nuevo, cambios, resultados };
}
