// Descansos reales: cuánto se descansó de verdad entre series, contra lo que pedía el plan. Sale de la hora en que se
// marcó cada serie (r.t en el registro del día), que la app ya guardaba. Explica de dónde salen los minutos de más de
// una sesión: descansos más largos que los pedidos y cambios de ejercicio más lentos que el minuto del modelo
// (nucleo/motor-plan.js, duracionEstimada). Pedido de Francisco, 4 de noviembre de 2026, después de ver que sus sesiones
// de 90 minutos duraban 112 a 115.
//
// Entre dos series marcadas pasa el descanso más la serie siguiente: el descanso es ese intervalo menos lo que dura la
// serie (4 segundos por repetición, como el modelo). No cuentan los intervalos de menos de 15 segundos (series marcadas
// juntas, al final) ni los de más de 8 minutos (una pausa, una interrupción o una serie que se marcó tarde): esos se
// cuentan aparte. En una superserie, el descanso es el de cada vuelta (de la última serie de la vuelta a la primera de
// la siguiente); el paso de un ejercicio a otro dentro de la vuelta no es descanso.

export const DESCANSOS = { minimo: 15, maximo: 480, cambioModelo: 60, segPorRep: 4, minimoMedidos: 4 };

const mediana = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), k = s.length >> 1; return Math.round(s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2); };
const TRABAJO = new Set(['normal', 'fallo']);

/** Segundos que dura una serie: repeticiones a 4 segundos, segundos tal cual y metros a 1 por segundo. */
function duracionSerie(e, fila) {
  const n = Number(fila?.reps) || ((Number(e.reps_min) || 0) + (Number(e.reps_max) || 0)) / 2 || 10;
  return e.unidad === 'seg' || e.unidad === 'm' ? n : n * DESCANSOS.segPorRep;
}

/**
 * Los descansos de una sesión, desde la hora de cada serie marcada.
 * @param ejercicios los del día, en orden: {ejercicio_id, descanso_seg, superserie, reps_min, reps_max, unidad}
 * @param filas      las filas del registro de cada ejercicio, en el mismo orden: [{hecho, t, reps, ...}]
 * @param tipoDe     (fila) => 'normal' | 'fallo' | 'calentamiento' | 'drop' (nucleo/registro.js)
 * @param porId      catálogo por id: separa básicos (compuestos) de accesorios
 * @returns {null | {basicos, accesorios, cambios, porEjercicio, extraMin, largas, medidos}}
 *   basicos y accesorios: {real, pedido, n} (medianas en segundos); cambios: {real, n} (de un ejercicio al siguiente);
 *   extraMin: minutos sobre el modelo (descansos más largos y cambios más lentos); largas: intervalos de más de 8 minutos
 */
export function descansosDeSesion({ ejercicios = [], filas = [], tipoDe, porId }) {
  // Las series de trabajo marcadas, con su hora, en el orden en que se hicieron.
  const hechas = [];
  ejercicios.forEach((e, k) => {
    for (const fila of filas[k] || []) {
      const t = Number(fila?.t);
      if (fila?.hecho && Number.isFinite(t) && t > 0 && TRABAJO.has(tipoDe(fila))) hechas.push({ k, e, fila, t });
    }
  });
  hechas.sort((a, b) => a.t - b.t);
  const grupo = e => (e.superserie ? ejercicios.filter(x => x.superserie === e.superserie) : null);
  const esBasico = e => porId.get(e.ejercicio_id)?.tipo === 'compuesto';
  const medidas = { basicos: [], accesorios: [], pedidoBasicos: [], pedidoAccesorios: [], cambios: [] };
  const porEj = new Map();
  let extra = 0, largas = 0;
  for (let i = 1; i < hechas.length; i++) {
    const a = hechas[i - 1], b = hechas[i];
    const intervalo = (b.t - a.t) / 1000;
    if (intervalo < DESCANSOS.minimo) continue;
    if (intervalo > DESCANSOS.maximo) { largas++; continue; }
    const real = Math.max(0, intervalo - duracionSerie(b.e, b.fila));
    const g = grupo(b.e), mismoGrupo = g && a.e.superserie === b.e.superserie;
    let pedido;
    if (a.k === b.k) pedido = Number(a.e.descanso_seg) || 90;
    else if (mismoGrupo) {
      // Superserie: descanso solo al volver al primero de la vuelta; el resto es pasar de un ejercicio al otro.
      if (b.k !== Math.min(...g.map(x => ejercicios.indexOf(x)))) continue;
      pedido = Math.max(...g.map(x => Number(x.descanso_seg) || 90));
    } else {
      // Cambio de ejercicio: el modelo da el descanso del anterior y un minuto para cambiar.
      const permitido = (Number(a.e.descanso_seg) || 90) + DESCANSOS.cambioModelo;
      medidas.cambios.push(real);
      extra += Math.max(0, real - permitido);
      continue;
    }
    const basico = esBasico(b.e);
    medidas[basico ? 'basicos' : 'accesorios'].push(real);
    medidas[basico ? 'pedidoBasicos' : 'pedidoAccesorios'].push(pedido);
    extra += Math.max(0, real - pedido);
    const p = porEj.get(b.e.ejercicio_id) || { ejercicio_id: b.e.ejercicio_id, reales: [], pedido };
    p.reales.push(real);
    porEj.set(b.e.ejercicio_id, p);
  }
  const medidos = medidas.basicos.length + medidas.accesorios.length;
  if (medidos < DESCANSOS.minimoMedidos) return null;
  const resumen = (reales, pedidos) => (reales.length ? { real: mediana(reales), pedido: mediana(pedidos), n: reales.length } : null);
  return {
    basicos: resumen(medidas.basicos, medidas.pedidoBasicos),
    accesorios: resumen(medidas.accesorios, medidas.pedidoAccesorios),
    cambios: medidas.cambios.length ? { real: mediana(medidas.cambios), n: medidas.cambios.length } : null,
    porEjercicio: [...porEj.values()].map(p => ({ ejercicio_id: p.ejercicio_id, real: mediana(p.reales), pedido: p.pedido, n: p.reales.length })),
    extraMin: Math.round(extra / 60),
    largas,
    medidos,
  };
}

/** "3:40": segundos como se leen en un reloj. */
export const reloj = seg => `${Math.floor(Math.round(seg) / 60)}:${String(Math.round(seg) % 60).padStart(2, '0')}`;

/**
 * La tendencia de las últimas sesiones con descansos medidos: medianas de las medianas, para decir "en tus últimas 5
 * sesiones descansaste 3:35 en los básicos (el plan pide 2:30)". null con menos de 2 sesiones.
 * @param porSesion {[id]: {fecha, basicos, accesorios, cambios, extraMin}} (E.descansosMedidos)
 */
export function tendenciaDescansos(porSesion = {}, { ultimas = 5 } = {}) {
  const xs = Object.values(porSesion).filter(x => x?.fecha && x.medidos).sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, ultimas);
  if (xs.length < 2) return null;
  const de = (campo, k) => mediana(xs.map(x => x[campo]?.[k]).filter(v => v != null));
  return {
    sesiones: xs.length,
    basicos: de('basicos', 'real') != null ? { real: de('basicos', 'real'), pedido: de('basicos', 'pedido') } : null,
    accesorios: de('accesorios', 'real') != null ? { real: de('accesorios', 'real'), pedido: de('accesorios', 'pedido') } : null,
    cambios: de('cambios', 'real') != null ? { real: de('cambios', 'real') } : null,
    extraMin: mediana(xs.map(x => x.extraMin || 0)),
  };
}

/** Lo que se guarda por sesión (E.descansosMedidos[id]): sin el detalle por ejercicio más que lo necesario, para que pese poco. */
export function paraGuardar(d, fecha) {
  if (!d) return null;
  return { fecha, basicos: d.basicos, accesorios: d.accesorios, cambios: d.cambios, extraMin: d.extraMin, largas: d.largas, medidos: d.medidos,
    porEjercicio: d.porEjercicio.filter(p => p.n >= 2).map(({ ejercicio_id, real, pedido }) => ({ ejercicio_id, real, pedido })) };
}
