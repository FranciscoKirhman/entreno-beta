// Red de seguridad del peso en gris (docs/51-pesos-y-reserva.md, sección 5, paso 3).
// Un plan puede traer un peso mal escrito: a mano, importado de otra app o propuesto por la IA. Las reglas de progresión
// lo corrigen después de sufrirlo; esta red lo detiene antes. Si el plan pide bastante más que lo que la persona levantó
// hace poco en ese mismo ejercicio, el gris parte con lo calculado desde su historial y dice por qué, con el peso del
// plan a la vista. No toca el plan guardado: solo lo que hoy se muestra y se propone.
import { cargaInicial, incrementoPara, deMaquina, registrosParaCarga } from './motor-plan.js';
import { esAsistido } from './catalogo.js';

/** Cuánto más que lo calculado puede pedir el plan sin que salte la red. En la revisión de la beta (16 sesiones, 73
 *  ejercicios con peso), 15% sobre lo real fue el corte de los casos en que hubo que bajar el peso en plena serie; entre
 *  7 y 15% se terminó la serie con menos reserva, que es lo que ya corrigen el consejo y Para la próxima. */
export const MARGEN_RED = 0.15;
/** Una sesión cuenta como liviana (descarga, día suave) si su serie más pesada no llega a esta parte de lo más pesado
 *  de las sesiones recientes. No sirve de referencia: después de una descarga, el peso normal no es "de más". */
const LIVIANA = 0.9;

const n = v => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** Las dos últimas sesiones normales del ejercicio (sin las livianas), con sus series de trabajo. */
export function sesionesDeReferencia(registros = []) {
  const validas = registros.filter(s => !s.antiguo && n(s.carga_kg) > 0 && n(s.reps) > 0 && s.fecha);
  if (!validas.length) return [];
  const porFecha = new Map();
  for (const s of validas) { if (!porFecha.has(s.fecha)) porFecha.set(s.fecha, []); porFecha.get(s.fecha).push(s); }
  const tope = f => Math.max(...porFecha.get(f).map(s => n(s.carga_kg)));
  const maximo = Math.max(...[...porFecha.keys()].map(tope));
  return [...porFecha.keys()].filter(f => tope(f) >= maximo * LIVIANA).sort().slice(-2).flatMap(f => porFecha.get(f));
}

/**
 * @param e         prescripción del plan {carga_kg, reps_min, reps_max, rir, unidad}
 * @param ej        ejercicio del catálogo
 * @param registros series de trabajo anteriores (registrosParaCarga: las de 8 semanas, o las antiguas marcadas)
 * @param lugar     lugar del día, para el escalón de peso
 * @returns {{kg, plan, masPesado, fecha} | null} null si el peso del plan se deja como está
 */
export function redDePeso({ e, ej, registros = [], lugar = null }) {
  const plan = n(e?.carga_kg);
  if (!(plan > 0) || !ej || (e.unidad && e.unidad !== 'reps') || !(e.reps_min > 0)) return null;
  if (esAsistido(ej)) return null; // ahí el número es la ayuda: más kilos es más fácil
  const ref = sesionesDeReferencia(registros);
  if (!ref.length) return null; // sin historial reciente de este ejercicio no hay con qué comparar
  const inc = incrementoPara(ej, lugar) || 2.5;
  const calculado = cargaInicial(ref, Math.min(e.reps_min + 1, e.reps_max ?? Infinity), e.rir ?? 2, inc, null);
  if (!(calculado > 0)) return null;
  const masPesado = Math.max(...ref.map(s => n(s.carga_kg)));
  // Salta solo si el plan pide más de 15% sobre lo calculado y, además, más de un escalón sobre lo calculado y sobre lo
  // más pesado que ya levantó: subir un escalón es progresar, no un error (con mancuernas chicas un escalón es mucho).
  if (plan <= calculado * (1 + MARGEN_RED) || plan <= calculado + inc + 1e-9 || plan <= masPesado + inc + 1e-9) return null;
  const fecha = ref.map(s => s.fecha).sort().at(-1);
  return { kg: calculado, plan, masPesado, fecha, maquina: deMaquina(ej) };
}

/**
 * La misma red para un plan que propone la IA o que llega importado: los pesos nuevos o cambiados de hoy en adelante
 * que piden mucho más que lo levantado hace poco bajan a lo calculado, y se devuelve la lista para decirlo. El bloque
 * del 19 de octubre de 2026 lo armó la IA con cargas sobre el historial y se aceptó así. Lo que el plan ya traía no se
 * toca: eso lo muestra la sesión al empezar (app/hoy.js).
 * @param nuevo     plan propuesto (se modifica una copia)
 * @param anterior  plan vigente, o null
 * @param ctx       { series: [{ejercicio_id, fecha, carga_kg, reps, rir?, rpe?, tipo?}], indice, hoy, lugares }
 * @returns {{plan, ajustadas: {ejercicio, fecha, pedido, queda, mas_pesado}[]}}
 */
export function caparCargas(nuevo, anterior, { series = [], indice, hoy, lugares = [] }) {
  const plan = structuredClone(nuevo), ajustadas = [];
  // "Ya lo traía": ese ejercicio con ese mismo peso estaba en el plan vigente, en cualquier fecha (mover o intercambiar
  // sesiones cambia la fecha, no el peso).
  const antes = new Set((anterior?.dias || []).flatMap(d => (d.ejercicios || []).map(e => `${e.ejercicio_id}|${e.carga_kg}`)));
  const lugarDe = nombre => lugares.find(l => l.nombre === nombre) || lugares.find(l => l.principal) || lugares[0] || null;
  for (const d of plan.dias || []) {
    if (d.fecha < hoy) continue;
    for (const e of d.ejercicios || []) {
      if (e.carga_kg == null || e.indicacion || antes.has(`${e.ejercicio_id}|${e.carga_kg}`)) continue;
      const ej = indice.porId.get(e.ejercicio_id);
      const red = redDePeso({ e, ej, lugar: lugarDe(d.lugar), registros: registrosParaCarga(series, e.ejercicio_id, d.fecha < hoy ? d.fecha : hoy) });
      if (!red) continue;
      ajustadas.push({ ejercicio: ej?.nombre || e.ejercicio_id, fecha: d.fecha, pedido: e.carga_kg, queda: red.kg, mas_pesado: red.masPesado });
      e.carga_kg = red.kg;
    }
  }
  return { plan, ajustadas };
}

/** Lo que se le dice a la IA para que lo cuente: un renglón por ejercicio, sin repetir fechas. */
export function textoCargasAjustadas(ajustadas) {
  const porEj = new Map();
  for (const a of ajustadas) if (!porEj.has(a.ejercicio)) porEj.set(a.ejercicio, a);
  return [...porEj.values()].map(a => `${a.ejercicio}: pedías ${a.pedido} kg y lo más pesado de sus últimas sesiones fue ${a.mas_pesado} kg; quedó en ${a.queda} kg.`);
}
