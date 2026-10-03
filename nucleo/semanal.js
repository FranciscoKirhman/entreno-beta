// Check-in semanal (contenido/checkin.json → semanal): junta las series y las notas de una semana del plan,
// propone subir, mantener o bajar cada carga (nucleo/progresion.js → ajustarSemana) y, cuando la persona
// confirma, lo aplica a la semana siguiente. Funciona igual sin cuenta y con cuenta.
import { ajustarSemana } from './progresion.js';
import { e1rm } from './motor-plan.js';
import { conReservaReportada, doloresDeNotas } from './notas.js';
import { detectarBanderas } from './checkin.js';
import { sumarDias, diaSemana } from './agenda.js';
import { esDeTrabajo, esDeTrabajoGuardada, tipoDe as tipoSerie } from './registro.js';
import { POR_DISTANCIA } from './unidades.js';

const lunesDe = iso => sumarDias(iso, -((diaSemana(iso) + 6) % 7));
const ZONA = { hombro: 'el hombro', codo: 'el codo', muneca: 'la muñeca', lumbar: 'la zona lumbar', cadera: 'la cadera', rodilla: 'la rodilla', tobillo: 'el tobillo', cuello: 'el cuello' };

/** Cada semana del plan con su lunes (desde), su domingo o la última sesión si se movió más allá (hasta). */
export function semanasDelPlan(plan) {
  const m = new Map();
  for (const d of plan?.dias || []) {
    if (!d.semana) continue;
    const s = m.get(d.semana) || { semana: d.semana, primera: d.fecha, ultima: d.fecha };
    if (d.fecha < s.primera) s.primera = d.fecha;
    if (d.fecha > s.ultima) s.ultima = d.fecha;
    m.set(d.semana, s);
  }
  return [...m.values()].sort((a, b) => a.semana - b.semana).map(s => {
    const desde = lunesDe(s.primera), domingo = sumarDias(desde, 6);
    return { ...s, desde, hasta: s.ultima > domingo ? s.ultima : domingo };
  });
}

/**
 * Qué semana toca revisar: la que está en curso (su check-in ajusta la siguiente). Si la anterior quedó sin revisar
 * y en la actual todavía no se entrena, se ofrece esa: así se puede hacer el lunes, antes de la primera sesión.
 * @param hechos     semanas ya revisadas { [semana]: true }
 * @param entrenadas fechas con series anotadas
 * @returns {{semana, desde, hasta, ultima, toca, atrasado, hecho} | null} null si no empezó el plan o es su última semana
 */
export function semanaParaCheckin(plan, hoy, { hechos = {}, entrenadas = new Set() } = {}) {
  const semanas = semanasDelPlan(plan);
  const empezadas = semanas.filter(s => s.desde <= hoy);
  if (!empezadas.length) return null;
  const actual = empezadas.at(-1), anterior = empezadas.at(-2);
  const tieneSiguiente = s => semanas.some(x => x.semana === s.semana + 1);
  const seEntreno = s => plan.dias.some(d => d.semana === s.semana && entrenadas.has(d.fecha));
  if (anterior && !hechos[anterior.semana] && tieneSiguiente(anterior) && !seEntreno(actual)) {
    return { ...anterior, toca: true, atrasado: true, hecho: false };
  }
  if (!tieneSiguiente(actual)) return null;
  return { ...actual, toca: hoy > actual.ultima || entrenadas.has(actual.ultima), atrasado: false, hecho: Boolean(hechos[actual.semana]) };
}

/**
 * Series y notas de una semana del plan. Por día, lo guardado con "Terminar sesión"; si no se terminó, las series
 * marcadas como hechas. La reserva real que se contó en el desplegable pasa a la última serie de ese ejercicio.
 * @param sesiones [{fecha, series: [{ejercicio_id, carga_kg, reps, rir, rpe, tipo}], notas}]
 * @param registro { fecha: { ejercicio_id: [{kg, reps, rpe, fallo, hecho}] } }
 * @param notas    { fecha: { ejercicio_id: {forma, rango, reserva_real, molestia, dolor, dolor_zona, nota} } }
 */
export function datosDeLaSemana({ plan, semana, sesiones = [], registro = {}, notas = {} }) {
  const registros = [], notasSemana = [], dias = [];
  for (const dia of plan.dias.filter(d => d.semana === semana)) {
    // La sesión de la app manda; si ese día solo hay una importada (Hevy), se usa esa.
    const ses = sesiones.find(s => s.fecha === dia.fecha && !s.origen) || sesiones.find(s => s.fecha === dia.fecha);
    let series = [];
    if (ses) {
      series = (ses.series || []).filter(s => s.ejercicio_id && esDeTrabajoGuardada(s))
        .map(s => ({ ejercicio_id: s.ejercicio_id, carga_kg: s.carga_kg ?? null, reps: s.reps ?? s.distancia_m ?? null, rir: s.tipo === 'fallo' ? 0 : s.rir ?? null, rpe: s.rpe ?? null }));
    } else {
      for (const e of dia.ejercicios.filter(x => x.ejercicio_id)) {
        for (const x of (registro[dia.fecha]?.[e.ejercicio_id] || []).filter(y => y?.hecho && esDeTrabajo(y))) {
          series.push({ ejercicio_id: e.ejercicio_id, carga_kg: e.unidad === 'seg' ? null : x.kg ?? null, reps: x.reps ?? null,
            rpe: x.rpe ?? null, rir: tipoSerie(x) === 'fallo' ? 0 : x.rpe != null ? 10 - x.rpe : null });
        }
      }
    }
    const delDia = notas[dia.fecha]
      ? Object.entries(notas[dia.fecha]).map(([id, n]) => { const { nota, para_entrenador, ...respuestas } = n; return { fecha: dia.fecha, ejercicio_id: id, respuestas, nota: nota || null }; })
      : (ses?.notas || []);
    for (const n of delDia) {
      const idx = series.flatMap((s, i) => (s.ejercicio_id === n.ejercicio_id ? [i] : []));
      const con = conReservaReportada(idx.map(i => series[i]), n.respuestas);
      idx.forEach((i, j) => { series[i] = con[j]; });
    }
    registros.push(...series.map(s => ({ ...s, plantilla: dia.plantilla })));
    notasSemana.push(...delDia);
    dias.push({ fecha: dia.fecha, plantilla: dia.plantilla, foco: dia.foco, firme: dia.firme, series: series.length });
  }
  return { registros, notas: notasSemana, dias };
}

/**
 * Todas las series anotadas, de cualquier plan: las de "Terminar sesión" y, en los días sin sesión terminada, las
 * marcadas como hechas. Es el historial que usa el motor para partir el bloque siguiente con los pesos reales.
 * @param desde 'AAAA-MM-DD' opcional: solo desde esa fecha
 */
export function seriesAnotadas(sesiones = [], registro = {}, desde = '') {
  const out = [];
  const conSesion = new Set(sesiones.map(s => s.fecha));
  for (const ses of sesiones) {
    if (ses.fecha < desde) continue;
    for (const s of ses.series || []) if (s.ejercicio_id && esDeTrabajoGuardada(s)) out.push({ fecha: ses.fecha, ejercicio_id: s.ejercicio_id, carga_kg: s.carga_kg ?? null, reps: s.reps ?? null, duracion_seg: s.duracion_seg ?? null, distancia_m: s.distancia_m ?? null, rir: s.tipo === 'fallo' ? 0 : s.rir ?? null, rpe: s.rpe ?? null });
  }
  for (const [fecha, porEj] of Object.entries(registro)) {
    if (fecha < desde || conSesion.has(fecha)) continue;
    for (const [id, lista] of Object.entries(porEj || {})) {
      if (/^i\d+$/.test(id)) continue; // ejercicio indicado por un profesional, sin id del catálogo
      for (const x of (lista || []).filter(y => y?.hecho && esDeTrabajo(y))) out.push({ fecha, ejercicio_id: id, carga_kg: x.kg ?? null, ...(POR_DISTANCIA.has(id) ? { reps: null, distancia_m: x.reps ?? null } : { reps: x.reps ?? null }), rpe: x.rpe ?? null, rir: tipoSerie(x) === 'fallo' ? 0 : x.rpe != null ? 10 - x.rpe : null });
    }
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

// Lo peor de la semana en cada ejercicio manda: si una vez se rompió la técnica, no sube.
const PEOR = { forma: ['limpias', 'algunas_feas', 'rota'], rango: ['completo', 'casi', 'parcial'], molestia: ['no', 'leve', 'me_preocupa'] };
function juntar(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, orden] of Object.entries(PEOR)) if (b[k] != null && (out[k] == null || orden.indexOf(b[k]) > orden.indexOf(out[k]))) out[k] = b[k];
  if (b.dolor != null) out.dolor = Math.max(out.dolor ?? 0, Number(b.dolor));
  return out;
}

/** Mejor 1RM estimado de cada ejercicio en las semanas anteriores (para detectar estancamiento), de la más antigua a la más nueva. */
export function historialPorSemana(sesiones, antesDe, cuantas = 3) {
  const porSemana = new Map();
  for (const ses of sesiones) {
    if (ses.fecha >= antesDe) continue;
    const l = lunesDe(ses.fecha);
    const m = porSemana.get(l) || new Map();
    for (const s of ses.series || []) {
      if (s.ejercicio_id && esDeTrabajoGuardada(s) && Number(s.carga_kg) > 0 && Number(s.reps) > 0) m.set(s.ejercicio_id, Math.max(m.get(s.ejercicio_id) || 0, e1rm(s)));
    }
    porSemana.set(l, m);
  }
  const out = {};
  for (const l of [...porSemana.keys()].sort().slice(-cuantas)) for (const [id, v] of porSemana.get(l)) (out[id] ||= []).push(v);
  return out;
}

/** Ejercicios cuya carga subió de la semana anterior a esta (para la regla de anclaje). */
export function subidasDelPlan(plan, semana) {
  const out = new Set();
  for (const d of plan.dias.filter(x => x.semana === semana)) {
    const previo = plan.dias.find(x => x.semana === semana - 1 && x.plantilla === d.plantilla);
    for (const e of d.ejercicios) {
      const p = previo?.ejercicios.find(y => y.ejercicio_id === e.ejercicio_id);
      if (p?.carga_kg != null && e.carga_kg != null && e.carga_kg > p.carga_kg) out.add(e.ejercicio_id);
    }
  }
  return out;
}

export const tipoDe = accion => (accion === 'subir_carga' || accion === 'subir_reps' ? 'subir' : accion === 'bajar_carga' ? 'bajar' : 'mantener');

function entrada({ plan, semana, sesiones = [], registro = {}, notas = {}, indice, lugar, checkin = null }) {
  const datos = datosDeLaSemana({ plan, semana, sesiones, registro, notas });
  const calidades = {};
  for (const n of datos.notas) calidades[n.ejercicio_id] = juntar(calidades[n.ejercicio_id], n.respuestas);
  // Dolor en una zona: tampoco sube lo demás que la carga.
  const zonas = new Set(datos.notas.filter(n => n.respuestas?.dolor_zona && (n.respuestas.molestia === 'me_preocupa' || (n.respuestas.dolor ?? 0) >= 4)).map(n => n.respuestas.dolor_zona));
  if (zonas.size) {
    for (const d of plan.dias.filter(x => x.semana === semana + 1)) {
      for (const e of d.ejercicios) {
        const zona = (indice.porId.get(e.ejercicio_id)?.carga_articular || []).find(z => zonas.has(z));
        if (zona) calidades[e.ejercicio_id] = { ...calidades[e.ejercicio_id], zona_con_dolor: ZONA[zona] || zona };
      }
    }
  }
  const desde = semanasDelPlan(plan).find(s => s.semana === semana)?.desde || plan.inicio;
  return {
    datos,
    banderas: checkin ? detectarBanderas({ dolores: doloresDeNotas(datos.notas) }, checkin) : [],
    args: { plan, semana, registros: datos.registros, historialSemanas: historialPorSemana(sesiones, desde), subidas: subidasDelPlan(plan, semana), indice, lugar, calidades },
  };
}

/**
 * Lo que se propone para cada ejercicio de la semana siguiente. No cambia nada.
 * @returns {{semana, siguiente, descarga, dias, series, banderas, items}} items: un ejercicio por día, con
 *          tipo ('subir' | 'mantener' | 'bajar') y cambia (si aplicarlo cambia lo que hoy dice la semana siguiente)
 */
export function proponerCheckin(p) {
  const { datos, banderas, args } = entrada(p);
  const { resultados } = ajustarSemana(args);
  const items = resultados.map(r => ({
    ...r, tipo: tipoDe(r.accion),
    cambia: r.carga_kg !== r.siguiente.carga_kg || r.reps_min !== r.siguiente.reps_min || r.reps_max !== r.siguiente.reps_max,
  }));
  return { semana: p.semana, siguiente: p.semana + 1, descarga: p.semana + 1 === p.plan.semana_descarga, dias: datos.dias, series: datos.registros.length, banderas, items };
}

/**
 * Aplica lo que la persona aceptó a la semana siguiente y lo arrastra a las que vienen después (menos a la
 * descarga), para que si un domingo no se hace el check-in, la semana que sigue no vuelva a las cargas viejas.
 * @param aceptar claves "plantilla|ejercicio_id" confirmadas
 */
export function aplicarCheckin(p, aceptar) {
  const { args } = entrada(p);
  const { plan, cambios } = ajustarSemana({ ...args, aceptar: new Set(aceptar) });
  const sig = p.semana + 1;
  if (sig !== plan.semana_descarga) {
    for (const d of plan.dias.filter(x => x.semana > sig && x.semana !== plan.semana_descarga)) {
      const ref = plan.dias.find(x => x.semana === sig && x.plantilla === d.plantilla);
      for (const e of d.ejercicios) {
        const r = e.ejercicio_id && aceptar.includes(`${d.plantilla}|${e.ejercicio_id}`) && ref?.ejercicios.find(y => y.ejercicio_id === e.ejercicio_id);
        if (!r) continue;
        if (e.carga_kg == null && r.carga_kg != null && /^Elige (un peso|la ayuda)/.test(e.nota || '')) e.nota = null;
        Object.assign(e, { carga_kg: r.carga_kg, reps_min: r.reps_min, reps_max: r.reps_max });
        if (r.rango_extendido !== undefined) e.rango_extendido = r.rango_extendido;
      }
    }
  }
  return { plan, cambios };
}
