// Ajuste semanal de cargas: las reglas de contenido/checkin.json → semanal.reglas_de_ajuste, como código.
// Son las mismas que se venían aplicando a mano en el tablero.
import { e1rm, incrementoPara } from './motor-plan.js';
import { esAsistido } from './catalogo.js';
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
 * @param p.asistido   el peso es la ayuda de la máquina: progresar es bajarla (y el máximo estimado no aplica)
 */
export function ajustarEjercicio({ objetivo: o, hechas, semanas = [], subioRecien = false, incremento, calidad = null, asistido = false }) {
  if (asistido) return ajustarAsistido({ objetivo: o, hechas, subioRecien, incremento, calidad });
  // Si el plan no indicaba carga ("elige un peso"), la referencia es la más pesada que anotó.
  const carga = o.carga_kg ?? (Math.max(0, ...hechas.map(s => Number(s.carga_kg) || 0)) || null);
  const mantener = (regla, motivo) => ({ accion: 'mantener', carga_kg: carga, reps_min: o.reps_min, reps_max: o.reps_max, regla, motivo });
  if (!hechas.length) return mantener('sin_registro', 'No hay series registradas esta semana.');
  if (o.unidad === 'seg') return mantener('isometrico', 'Los isométricos progresan en segundos dentro del rango.');
  // Transporte (metros): con todas las series en el tope de metros se sube el peso; si no, más metros con el mismo.
  if (o.unidad === 'm') {
    const alTope = hechas.length >= o.series && hechas.slice(0, o.series).every(s => s.reps >= o.reps_max);
    if (alTope && incremento && carga) return { accion: 'subir_carga', carga_kg: carga + incremento, reps_min: o.reps_min, reps_max: o.reps_max, regla: 'doble_progresion', motivo: `Todas las series en ${o.reps_max} metros: sube ${kg(incremento)}.` };
    return mantener('metros_primero', 'Mismo peso y unos metros más hasta completar el tope en todas las series.');
  }
  if (!carga && incremento) return mantener('sin_carga', 'No anotaste el peso: anótalo en la próxima sesión para poder ajustarlo.');

  const completas = hechas.length >= o.series;
  const todasAlTope = completas && hechas.slice(0, o.series).every(s => s.reps >= o.reps_max);
  const conReserva = hechas.every(s => reserva(s) != null && Number.isFinite(reserva(s)) && reserva(s) >= o.rir - 0.5);
  const sobrabanMuchas = hechas.every(s => reserva(s) != null && reserva(s) >= 4);
  const bajoElRango = hechas.some(s => s.reps < o.reps_min);

  // Anclaje: si la carga nueva no salió limpia, se vuelve a la anterior una semana.
  if (subioRecien && bajoElRango && incremento) {
    return { accion: 'bajar_carga', carga_kg: carga - incremento, reps_min: o.reps_min, reps_max: o.reps_max, regla: 'anclaje',
      motivo: `Con ${kg(carga)} no salió el rango completo. Vuelves a ${kg(carga - incremento)} una semana antes de intentarlo de nuevo.` };
  }

  // Pesado: con la carga pedida, la mitad o más de las series quedó bajo el rango con 1 de reserva o menos (o se bajó el
  // peso para terminar después de una así), y el máximo estimado de la sesión no da para el rango con la reserva pedida.
  // Baja lo que haga falta: al menos un escalón y como mucho un 15%. Si el máximo sí da (la caída fue por cansancio o por
  // poco descanso), se mantiene. Antes un peso que no salía se repetía igual la vez siguiente (en la beta, un rumano con
  // 40 que salió 10 y 6 a RPE 9,5, y la tercera con 30).
  if (incremento && carga) {
    const aCarga = hechas.filter(s => Number(s.carga_kg) === Number(carga));
    const bajoDuro = aCarga.filter(s => s.reps < o.reps_min && reserva(s) != null && reserva(s) <= 1);
    const bajoElPeso = hechas.some(s => Number(s.carga_kg) > 0 && Number(s.carga_kg) < Number(carga));
    if (bajoDuro.length && (bajoDuro.length * 2 >= aCarga.length || bajoElPeso)) {
      const mejor = Math.max(...hechas.filter(s => Number(s.carga_kg) > 0 && Number(s.reps) > 0).map(e1rm));
      const alcanza = mejor / (1 + (o.reps_min + 1 + (o.rir ?? 2)) / 30);
      if (alcanza < carga) {
        const nueva = Math.max(Math.ceil((carga * 0.85) / incremento - 1e-9) * incremento, Math.min(carga - incremento, Math.floor(alcanza / incremento + 1e-9) * incremento));
        return { accion: 'bajar_carga', carga_kg: Number(nueva.toFixed(2)), reps_min: o.reps_min, reps_max: o.reps_max, regla: 'pesado',
          motivo: `Con ${kg(carga)} las series quedaron bajo ${o.reps_min} casi al fallo. Bajas a ${kg(Number(nueva.toFixed(2)))} para hacer el rango con la reserva pedida.` };
      }
    }
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
  if (hechas.some(s => reserva(s) == null || !Number.isFinite(reserva(s)))) return mantener('sin_esfuerzo', 'Falta el esfuerzo de alguna serie: confirma RPE o RIR antes de aumentar carga o repeticiones.');
  if (!completas) return mantener('series_incompletas', 'Faltan series del plan: completa la sesión antes de aumentar carga o repeticiones.');
  if (o.carga_kg > 0 && hechas.some(s => s.carga_kg == null || (asistido ? s.carga_kg > o.carga_kg : s.carga_kg < o.carga_kg))) return mantener('carga_no_consolidada', 'La carga pedida no se completó en todas las series: consolídala antes de aumentar.');
  if (!conReserva) return mantener('esfuerzo_alto', 'Las series salieron más difíciles que la reserva pedida: consolida el mismo peso y las mismas repeticiones.');
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

/**
 * Lo mismo para un ejercicio asistido: el peso es la ayuda de la máquina, así que progresar es bajarla y costar más es
 * subirla. Sin máximo estimado (con ayuda no se puede calcular) ni la regla del 5% (la ayuda no es la carga real).
 */
function ajustarAsistido({ objetivo: o, hechas, subioRecien, incremento, calidad }) {
  const anotadas = hechas.map(s => Number(s.carga_kg)).filter(x => x > 0);
  // Si el plan no indicaba ayuda, la referencia es la menor con la que entrenó.
  const ayuda = o.carga_kg ?? (anotadas.length ? Math.min(...anotadas) : null);
  const mantener = (regla, motivo) => ({ accion: 'mantener', carga_kg: ayuda, reps_min: o.reps_min, reps_max: o.reps_max, regla, motivo });
  if (!hechas.length) return mantener('sin_registro', 'No hay series registradas esta semana.');
  if (!ayuda) return mantener('sin_carga', 'No anotaste la ayuda de la máquina: anótala en la próxima sesión para poder ajustarla.');
  const completas = hechas.length >= o.series;
  const todasAlTope = completas && hechas.slice(0, o.series).every(s => s.reps >= o.reps_max);
  const conReserva = hechas.every(s => reserva(s) != null && Number.isFinite(reserva(s)) && reserva(s) >= o.rir - 0.5);
  const sobrabanMuchas = hechas.every(s => reserva(s) != null && reserva(s) >= 4);
  const bajoElRango = hechas.some(s => s.reps < o.reps_min);
  if (subioRecien && bajoElRango && incremento) {
    return { accion: 'bajar_carga', carga_kg: ayuda + incremento, reps_min: o.reps_min, reps_max: o.reps_max, regla: 'anclaje',
      motivo: `Con ${kg(ayuda)} de ayuda no salió el rango completo. Vuelves a ${kg(ayuda + incremento)} de ayuda una semana antes de intentarlo de nuevo.` };
  }
  if (hechas.some(s => reserva(s) == null || !Number.isFinite(reserva(s)))) return mantener('sin_esfuerzo', 'Falta el esfuerzo de alguna serie: confirma RPE o RIR antes de aumentar carga o repeticiones.');
  if (!completas) return mantener('series_incompletas', 'Faltan series del plan: completa la sesión antes de aumentar carga o repeticiones.');
  if (o.carga_kg > 0 && hechas.some(s => s.carga_kg == null || s.carga_kg > o.carga_kg)) return mantener('carga_no_consolidada', 'Necesitaste más ayuda que la indicada: consolida la sesión antes de bajar la ayuda.');
  if (!conReserva) return mantener('esfuerzo_alto', 'Las series salieron más difíciles que la reserva pedida: consolida el mismo peso y las mismas repeticiones.');
  const cal = calidadPermiteSubir(calidad || {});
  if (!cal.ok && ((todasAlTope && conReserva) || sobrabanMuchas)) return mantener('calidad', cal.motivo);
  if ((todasAlTope && conReserva) || sobrabanMuchas) {
    if (!incremento || ayuda - incremento <= 0) {
      return { accion: 'subir_reps', carga_kg: ayuda, reps_min: o.reps_min + 2, reps_max: o.reps_max + 2, regla: 'doble_progresion',
        motivo: 'Ya estás con la ayuda mínima: sube las repeticiones, o prueba la versión sin ayuda.' };
    }
    return { accion: 'subir_carga', carga_kg: ayuda - incremento, reps_min: o.reps_min, reps_max: o.reps_max, regla: 'doble_progresion',
      motivo: sobrabanMuchas && !todasAlTope ? 'Te sobraban 4 o más repeticiones: baja la ayuda.' : `Todas las series en ${o.reps_max} repeticiones con reserva: baja la ayuda ${kg(incremento)}.` };
  }
  if (!bajoElRango) return { ...mantener('repeticiones_primero', 'Dentro del rango: misma ayuda y una repetición más por serie.'), accion: 'subir_reps_dentro' };
  return mantener('repetir', 'Algunas series quedaron bajo el rango: repite la misma ayuda.');
}

/** La carga con que se hicieron las series de trabajo: la más repetida; con empate, la de la primera serie. */
function cargaUsada(hechas) {
  const cuenta = new Map();
  for (const s of hechas) { const c = Number(s.carga_kg); if (c > 0) cuenta.set(c, (cuenta.get(c) || 0) + 1); }
  if (!cuenta.size) return null;
  const max = Math.max(...cuenta.values());
  return hechas.map(s => Number(s.carga_kg)).find(c => cuenta.get(c) === max);
}

const valores = e => ({ carga_kg: e.carga_kg == null ? null : Number(e.carga_kg), reps_min: Number(e.reps_min), reps_max: Number(e.reps_max), rango_extendido: Boolean(e.rango_extendido) });
const iguales = (a, b) => a.carga_kg === b.carga_kg && a.reps_min === b.reps_min && a.reps_max === b.reps_max && Boolean(a.rango_extendido) === Boolean(b.rango_extendido);

/**
 * Lo que la sesión de hoy pide cambiar en las próximas: para cada ejercicio hecho, las próximas veces que vuelve en el
 * plan con la misma carga y el mismo rango que pedía hoy toman lo que sale de lo hecho, con las reglas del check-in
 * semanal (ajustarEjercicio), sin esperar a que alguien lo haga. Si la carga usada no fue la del plan (medio escalón o
 * más de diferencia), manda lo hecho: el ajuste parte de esa carga. Antes el plan seguía con la suya y la sesión
 * siguiente volvía a mostrar un peso que ya no servía (en la beta, una búlgara hecha con 40 seguía en 20 el jueves
 * siguiente, y otro plan seguía con los pesos de un mes antes).
 * Una serie sin esfuerzo anotado toma el más duro anotado en ese ejercicio ese día (casi siempre se deja en blanco la
 * primera, la más fácil); sin ninguno, no se sube nada. Cuentan las series que pedía el plan, no las de más. La
 * descarga no sube por progresión: solo toma la carga nueva si es menor o si corrige un peso que estaba mal. Lo que ya
 * pasó, lo que alguien cambió aparte en un día y lo indicado por un profesional no se tocan. No aplica nada: devuelve
 * el plan como quedaría, para mostrarlo y pedir el sí (regla 10 de AGENTS.md).
 * @param plan             plan vigente {dias: [{fecha, semana, plantilla, ejercicios}], semana_descarga}
 * @param fecha            día de la sesión 'AAAA-MM-DD'
 * @param series           series de trabajo de la sesión [{ejercicio_id, carga_kg, reps, rir?, rpe?}]
 * @param historialSemanas mejor 1RM estimado por semana antes de la sesión (semanal.js: historialPorSemana)
 * @param calidades        respuestas del desplegable de cada ejercicio (forma, rango, molestia, dolor)
 * @returns {{plan, cambios}} plan nuevo (copia) y un cambio por ejercicio: {ejercicio_id, nombre, accion, regla,
 *          motivo, reanclado, desde, antes, despues, dias: [{fecha, descarga, antes, despues}]}
 */
export function ajustarTrasSesion({ plan, fecha, series, indice, lugar = null, historialSemanas = {}, calidades = {} }) {
  const nuevo = structuredClone(plan);
  const cambios = [];
  if (!Array.isArray(nuevo?.dias)) return { plan: nuevo, cambios };
  const delDia = nuevo.dias.find(d => d.fecha === fecha) || null;
  const porEj = new Map();
  for (const s of series || []) if (s.ejercicio_id) { if (!porEj.has(s.ejercicio_id)) porEj.set(s.ejercicio_id, []); porEj.get(s.ejercicio_id).push(s); }
  const descarga = d => d.semana != null && d.semana === nuevo.semana_descarga;
  for (const [id, todas] of porEj) {
    const ej = indice.porId.get(id);
    if (!ej) continue;
    const conEj = nuevo.dias.filter(d => d.fecha > fecha && d.tipo !== 'descanso' && d.ejercicios?.some(e => e.ejercicio_id === id)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    if (!conEj.length) continue;
    // Lo que pedía hoy el plan; si el ejercicio no estaba (se agregó o se cambió), lo que pide la próxima vez.
    const deHoy = delDia?.ejercicios?.find(e => e.ejercicio_id === id) || null;
    const base = deHoy || conEj[0].ejercicios.find(e => e.ejercicio_id === id);
    const pedido = valores(base);
    const destino = conEj.filter(d => d.ejercicios.some(e => e.ejercicio_id === id && (e.unidad || 'reps') === (base.unidad || 'reps')
      && valores(e).carga_kg === pedido.carga_kg && valores(e).reps_min === pedido.reps_min && valores(e).reps_max === pedido.reps_max));
    if (!destino.length) continue;
    const incremento = incrementoPara(ej, lugar);
    const asistido = esAsistido(ej);
    const usada = asistido ? null : cargaUsada(todas);
    const planeada = pedido.carga_kg;
    const reanclado = usada != null && planeada != null && Math.abs(usada - planeada) >= (incremento || 2.5) / 2 - 1e-9;
    const conCarga = reanclado ? todas.filter(s => Number(s.carga_kg) === usada) : todas;
    const cuentan = conCarga.slice(0, Math.max(1, Number(base.series) || conCarga.length));
    const anotadas = cuentan.map(reserva).filter(x => x != null && Number.isFinite(x));
    const peor = anotadas.length ? Math.min(...anotadas) : null;
    const hechas = cuentan.map(s => (reserva(s) == null && peor != null ? { ...s, rir: peor, rpe: null } : s));
    // La regla de anclaje mira si la carga de hoy subió respecto de la vez anterior de esta misma sesión del plan.
    const previo = delDia?.plantilla && deHoy ? nuevo.dias.filter(d => d.fecha < fecha && d.plantilla === delDia.plantilla).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]?.ejercicios.find(e => e.ejercicio_id === id) : null;
    const subioRecien = !reanclado && previo?.carga_kg != null && planeada != null && planeada > Number(previo.carga_kg);
    const r = ajustarEjercicio({
      objetivo: reanclado ? { ...base, carga_kg: usada } : base, hechas, semanas: historialSemanas[id] || [], subioRecien,
      incremento, calidad: calidades[id] || null, asistido,
    });
    if (r.accion === 'mantener' && !reanclado) continue;
    const dias = [];
    for (const d of destino) {
      for (const e of d.ejercicios.filter(x => x.ejercicio_id === id)) {
        const antes = valores(e);
        if (antes.carga_kg !== pedido.carga_kg || antes.reps_min !== pedido.reps_min || antes.reps_max !== pedido.reps_max) continue;
        // En la descarga, una carga corregida (reanclada) se usa tal cual; una subida, no.
        const despues = descarga(d)
          ? { ...antes, carga_kg: r.carga_kg != null && antes.carga_kg != null && (reanclado || r.carga_kg < antes.carga_kg) ? r.carga_kg : antes.carga_kg }
          : { carga_kg: r.carga_kg ?? antes.carga_kg, reps_min: r.reps_min, reps_max: r.reps_max, rango_extendido: r.rango_extendido ?? antes.rango_extendido };
        if (iguales(antes, despues)) continue;
        // La nota "elige un peso" sobra cuando la carga ya quedó fijada.
        if (e.carga_kg == null && despues.carga_kg != null && /^Elige (un peso|la ayuda)/.test(e.nota || '')) e.nota = null;
        Object.assign(e, despues);
        dias.push({ fecha: d.fecha, descarga: descarga(d), antes, despues });
      }
    }
    if (!dias.length) continue;
    const primero = dias.find(x => !x.descarga) || dias[0];
    const motivoReanclado = reanclado ? `Hiciste las series con ${kg(usada)} y el plan decía ${kg(planeada)}: lo que hiciste manda. ` : '';
    cambios.push({ ejercicio_id: id, nombre: ej.nombre || id, accion: r.accion, regla: reanclado ? 'reanclado' : r.regla, motivo: `${motivoReanclado}${r.motivo}`,
      reanclado, desde: primero.fecha, antes: primero.antes, despues: primero.despues, dias });
  }
  return { plan: nuevo, cambios };
}

/** Vuelve atrás los ajustes de una sesión (ajustarTrasSesion), solo donde el plan sigue como ellos lo dejaron: si
 *  después la persona o el coach cambió ese ejercicio, se respeta ese cambio. */
export function deshacerAjustes(plan, cambios = []) {
  const nuevo = structuredClone(plan);
  for (const c of cambios) {
    for (const { fecha, antes, despues } of c.dias || []) {
      const d = nuevo.dias?.find(x => x.fecha === fecha);
      for (const e of d?.ejercicios?.filter(x => x.ejercicio_id === c.ejercicio_id) || []) {
        if (iguales(valores(e), despues)) Object.assign(e, antes);
      }
    }
  }
  return nuevo;
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
        calidad: calidades[e.ejercicio_id] || null, asistido: esAsistido(ej),
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
      if (e.carga_kg == null && r.carga_kg != null && /^Elige (un peso|la ayuda)/.test(e.nota || '')) e.nota = null;
      Object.assign(e, { carga_kg: r.carga_kg, reps_min: r.reps_min, reps_max: r.reps_max });
      if (r.rango_extendido !== undefined) e.rango_extendido = r.rango_extendido;
    }
  }
  return { plan: nuevo, cambios, resultados };
}
