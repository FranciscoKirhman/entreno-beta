// Motor de reglas: arma un plan de 4 semanas sin IA. Es el plan del plan Gratis y la base que el coach
// Pro ajusta. Todo lo que hace está explicado en contenido/evidencia/.
import { calentamientoDeSesion, minutosCalentamiento } from './calentamiento-sesion.js';
import { conFatigaPrevia } from './fatiga-sesion.js';
import { grupos } from './superseries.js';
import { nivelAlcanza, tieneEquipo, articulacionesBloqueadas, cargaZonaBloqueada, esAsistido } from './catalogo.js';

// ── Plantillas de día ───────────────────────────────────────────────────────
// Cada hueco es [patrón, prioridad]. Prioridad 1 va primero y es lo último que se salta si falta tiempo.
export const PLANTILLAS = {
  cuerpo_a: { foco: 'Cuerpo completo A', huecos: [['sentadilla', 1], ['empuje_horizontal', 1], ['tiron_horizontal', 1], ['bisagra', 2], ['empuje_vertical', 2], ['tiron_vertical', 2], ['core_estabilidad', 3], ['biceps', 4], ['triceps', 4]] },
  cuerpo_b: { foco: 'Cuerpo completo B', huecos: [['bisagra', 1], ['tiron_vertical', 1], ['empuje_horizontal', 1], ['unilateral_pierna', 2], ['tiron_horizontal', 2], ['hombro_aislado', 3], ['core_flexion', 3], ['flexion_rodilla', 4]] },
  cuerpo_c: { foco: 'Cuerpo completo C', huecos: [['sentadilla', 1], ['empuje_vertical', 1], ['tiron_vertical', 1], ['extension_cadera', 2], ['empuje_horizontal', 2], ['tiron_horizontal', 2], ['core_antirotacion', 3], ['hombro_posterior', 4]] },
  torso_a: { foco: 'Torso A', huecos: [['empuje_horizontal', 1], ['tiron_vertical', 1], ['empuje_vertical', 2], ['tiron_horizontal', 2], ['hombro_aislado', 3], ['biceps', 3], ['triceps', 3], ['core_flexion', 4]] },
  torso_b: { foco: 'Torso B', huecos: [['tiron_horizontal', 1], ['empuje_horizontal', 1], ['tiron_vertical', 2], ['pecho_aislado', 2], ['hombro_posterior', 3], ['triceps', 3], ['biceps', 3], ['core_estabilidad', 4]] },
  pierna_a: { foco: 'Pierna A', huecos: [['sentadilla', 1], ['bisagra', 1], ['unilateral_pierna', 2], ['flexion_rodilla', 2], ['extension_rodilla', 3], ['abduccion', 3], ['core_estabilidad', 4], ['pantorrilla', 4]] },
  pierna_b: { foco: 'Pierna B', huecos: [['extension_cadera', 1], ['bisagra', 1], ['sentadilla', 2], ['flexion_rodilla', 2], ['extension_cadera', 3], ['aduccion', 3], ['core_flexion', 4], ['pantorrilla', 4]] },
  empuje_a: { foco: 'Empuje A', huecos: [['empuje_horizontal', 1], ['empuje_vertical', 1], ['pecho_aislado', 2], ['hombro_aislado', 2], ['triceps', 3], ['core_flexion', 4]] },
  empuje_b: { foco: 'Empuje B', huecos: [['empuje_vertical', 1], ['empuje_horizontal', 1], ['hombro_aislado', 2], ['pecho_aislado', 2], ['triceps', 3], ['core_estabilidad', 4]] },
  tiron_a: { foco: 'Tirón A', huecos: [['tiron_vertical', 1], ['tiron_horizontal', 1], ['hombro_posterior', 2], ['biceps', 2], ['core_antirotacion', 4]] },
  tiron_b: { foco: 'Tirón B', huecos: [['tiron_horizontal', 1], ['tiron_vertical', 1], ['biceps', 2], ['hombro_posterior', 2], ['core_flexion', 4]] },
};

export const SEMANAS = {
  2: ['cuerpo_a', 'cuerpo_b'],
  3: ['cuerpo_a', 'cuerpo_b', 'cuerpo_c'],
  4: ['torso_a', 'pierna_a', 'torso_b', 'pierna_b'],
  5: ['torso_a', 'pierna_a', 'torso_b', 'pierna_b', 'cuerpo_c'],
  6: ['empuje_a', 'tiron_a', 'pierna_a', 'empuje_b', 'tiron_b', 'pierna_b'],
};

// Ejercicio aislado que se suma cuando una zona es prioritaria.
const EXTRA_POR_MUSCULO = {
  gluteo: 'extension_cadera', cuadriceps: 'extension_rodilla', femoral: 'flexion_rodilla', aductor_abductor: 'abduccion',
  pecho: 'pecho_aislado', espalda: 'tiron_horizontal', hombro: 'hombro_aislado', biceps: 'biceps', triceps: 'triceps', core: 'core_flexion',
};

// Qué movimiento del cuestionario (pregunta técnica) corresponde a cada patrón.
const TECNICA_DE = { sentadilla: 'sentadilla', bisagra: 'bisagra', empuje_horizontal: 'press_horizontal', tiron_horizontal: 'remo', empuje_vertical: 'press_vertical', tiron_vertical: 'dominada' };

// Días preferidos según cuántos se entrena (0 = domingo). Se reemplazan por el más cercano si no se puede.
const DIAS_PREFERIDOS = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 0] };

const TIPO_ORDEN = { compuesto: 0, aislamiento: 1, core: 2, cardio: 3, movilidad: 3 };
const ISOMETRICOS = new Set(['plancha', 'plancha_rodillas', 'plancha_lateral', 'plancha_lateral_elevacion', 'colgarse']);
const DIA_MS = 864e5;
const sumarDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * DIA_MS).toISOString().slice(0, 10);
const diaSemana = iso => new Date(iso + 'T12:00:00Z').getUTCDay();

export function elegirDias(cantidad, noPuedo = []) {
  const libres = [1, 2, 3, 4, 5, 6, 0].filter(d => !noPuedo.includes(d));
  const n = Math.min(cantidad, libres.length);
  const elegidos = [];
  for (const pref of DIAS_PREFERIDOS[Math.min(7, Math.max(2, n))].slice(0, n)) {
    const opciones = libres.filter(d => !elegidos.includes(d))
      .sort((a, b) => Math.min(Math.abs(a - pref), 7 - Math.abs(a - pref)) - Math.min(Math.abs(b - pref), 7 - Math.abs(b - pref)));
    if (opciones.length) elegidos.push(opciones[0]);
  }
  const orden = d => (d === 0 ? 7 : d);
  return elegidos.sort((a, b) => orden(a) - orden(b));
}

export function incrementoPara(ej, lugar) {
  const disco = Number(lugar?.incremento_minimo_kg) || 2.5;
  if (ej.equipamiento.includes('barra_rack') || ej.equipamiento.includes('smith')) return disco * 2; // un disco por lado
  if (ej.equipamiento.includes('mancuernas')) return 2;
  if (ej.equipamiento.includes('kettlebells')) return 4;
  if (ej.equipamiento.length === 0 || ej.equipamiento.every(e => ['banco', 'barra_dominadas', 'paralelas', 'bandas'].includes(e))) return null;
  return 2.5;
}

const redondearA = (x, paso) => Math.round(x / paso) * paso;

/** Ayuda de partida en un ejercicio asistido: la menor de la última sesión en que se hizo, o null si nunca se hizo. */
export function ayudaInicial(registros) {
  const conAyuda = registros.filter(s => Number(s.carga_kg) > 0);
  if (!conAyuda.length) return null;
  const ultima = conAyuda.reduce((m, s) => ((s.fecha || '') > m ? s.fecha || '' : m), '');
  return Math.min(...conAyuda.filter(s => (s.fecha || '') === ultima).map(s => Number(s.carga_kg)));
}

const n = v => (v === null || v === undefined || v === '' ? null : Number(v));

/** Repeticiones hasta el fallo que tenía la serie: reps + reserva (de RIR o de RPE). */
const repsAlFallo = s => n(s.reps) + (n(s.rir) != null ? n(s.rir) : n(s.rpe) != null ? Math.max(0, 10 - n(s.rpe)) : 2);
export const e1rm = s => n(s.carga_kg) * (1 + repsAlFallo(s) / 30); // Epley

/** Carga para hacer `reps` dejando `rir` en reserva, según el mejor registro reciente. Nunca más de un 15% sobre
 *  lo más pesado que ya levantó: si un dato viene mal, el plan no puede mandar a levantar de más. */
export function cargaInicial(registros, reps, rir, incremento, maximo) {
  const validas = registros.filter(s => n(s.carga_kg) > 0 && n(s.reps) > 0);
  if (!validas.length || !incremento) return null;
  const mejor = Math.max(...validas.map(e1rm));
  let carga = mejor / (1 + (reps + rir) / 30);
  const masPesada = Math.max(...validas.map(s => n(s.carga_kg)));
  carga = Math.min(carga, Math.max(masPesada * 1.15, masPesada + incremento));
  carga = Math.floor(carga / incremento) * incremento;
  if (maximo) carga = Math.min(carga, maximo);
  return carga > 0 ? Number(carga.toFixed(2)) : null;
}

/** Las series de un ejercicio que sirven para estimar su carga: las de las 8 semanas antes de `fecha` o, si no hay, las
 *  de la última vez que se hizo, aunque sea hace meses. Así un récord de hace un año no manda sobre cómo viene ahora. */
export function registrosParaCarga(series, id, fecha, semanas = 8) {
  const previas = series.filter(s => s.ejercicio_id === id && s.tipo !== 'calentamiento' && (!fecha || !s.fecha || s.fecha < fecha));
  const desde = fecha ? sumarDias(fecha, -7 * semanas) : '';
  const recientes = previas.filter(s => s.fecha && s.fecha >= desde);
  if (recientes.length) return recientes;
  const ultima = previas.reduce((m, s) => ((s.fecha || '') > m ? s.fecha : m), '');
  return previas.filter(s => (s.fecha || '') === ultima);
}

/** La carga de un ejercicio que el plan no trae (recién cambiado, agregado o de un plan importado): la de su historial
 *  llevada a las repeticiones y la reserva de ese día, con la misma fórmula que las cargas iniciales del bloque. Una
 *  descarga pide más reserva, así que sale más liviana que copiar el peso de una semana normal. */
export function cargaSugerida({ e, ej, registros = [], lugar = null }) {
  if (!ej || (e.unidad && e.unidad !== 'reps') || !(e.reps_min > 0)) return null;
  if (esAsistido(ej)) return ayudaInicial(registros);
  const maxMancuerna = ej.equipamiento.includes('mancuernas') ? Number(lugar?.mancuerna_max_kg) || null : null;
  return cargaInicial(registros, Math.min(e.reps_min + 1, e.reps_max ?? Infinity), e.rir ?? 2, incrementoPara(ej, lugar), maxMancuerna);
}

export function prescripcion(ej, prioridad, d) {
  const obj = d.objetivo;
  const fuerza = obj === 'ganar_fuerza' || (obj === 'deporte' && prioridad === 1);
  const suave = obj === 'salud' || obj === 'volver' || d.nivel === 'principiante';
  const compuesto = ej.tipo === 'compuesto';
  let series = 3, reps = [8, 12];
  const porTiempo = ISOMETRICOS.has(ej.id) || ej.medida === 'seg'; // ej.medida: la de un ejercicio propio
  if (ej.tipo === 'core') reps = porTiempo ? [30, 45] : [10, 15];
  else if (fuerza && compuesto && prioridad === 1) { series = d.nivel === 'principiante' ? 3 : 4; reps = d.nivel === 'principiante' ? [5, 8] : [3, 6]; }
  else if (compuesto && prioridad === 1) reps = suave ? [8, 12] : [6, 10];
  else if (!compuesto) reps = [10, 15];
  if (suave && !compuesto) series = 2;
  const rir = Math.max(compuesto ? d.rir_objetivo.compuestos : d.rir_objetivo.aislamiento, d.rir_minimo);
  const descanso = ej.tipo === 'core' ? 60 : !compuesto ? 75 : prioridad === 1 ? (fuerza ? 180 : 150) : 120;
  // Cardio agregado a la sesión (escaladora, trotadora): una serie de 10 a 20 minutos, sin descanso después.
  if (ej.tipo === 'cardio') return { series: 1, reps_min: 10, reps_max: 20, unidad: 'reps', rir: Math.min(5, rir), descanso_seg: 0 };
  // Transporte con peso (caminata del granjero): se mide en metros, con descanso de accesorio.
  if (ej.patron === 'transporte') return { series: suave ? 2 : 3, reps_min: 20, reps_max: 40, unidad: 'm', rir: Math.min(5, rir), descanso_seg: 90 };
  return { series, reps_min: reps[0], reps_max: reps[1], unidad: porTiempo ? 'seg' : 'reps', rir: Math.min(5, rir), descanso_seg: descanso };
}

/**
 * Minutos que toma un día: calentamiento + series × (tiempo bajo tensión + descanso) + cambio de ejercicio.
 * En una superserie se descansa una vez por vuelta (el descanso más largo de sus ejercicios), no después de cada uno.
 */
export function duracionEstimada(ejercicios, calentamientoMin = 8) {
  let seg = calentamientoMin * 60;
  const g = grupos(ejercicios);
  ejercicios.forEach((e, i) => {
    // Segundos tal cual; metros a 1 metro por segundo (caminando con peso); repeticiones a 4 segundos cada una.
    const trabajo = e.unidad === 'seg' || e.unidad === 'm' ? (e.reps_min + e.reps_max) / 2 : ((e.reps_min + e.reps_max) / 2) * 4;
    seg += e.series * (trabajo + (g[i] ? 15 : e.descanso_seg)) + 60;
    if (g[i]?.pos === 1) {
      const vueltas = Math.max(...g[i].miembros.map(m => ejercicios[m].series));
      seg += vueltas * Math.max(...g[i].miembros.map(m => ejercicios[m].descanso_seg ?? 90));
    }
  });
  return Math.round(seg / 60);
}

/** Incluye calentamiento, transiciones de pesas y cardio, usando el extremo mayor de un rango. */
export function minutosCardio(texto) {
  if (!texto) return 0;
  if (/6 × 1 minuto fuerte y 1 minuto suave/.test(texto)) return 12;
  const m = texto.match(/(\d+)(?: a (\d+))? minutos?/);
  return m ? Number(m[2] || m[1]) : null;
}
export function duracionSesion(dia) {
  const cardio = minutosCardio(dia.cardio);
  return cardio === null ? null : duracionEstimada(dia.ejercicios || [], dia.calentamiento?.length ? minutosCalentamiento(dia.calentamiento) : 8) + cardio + (cardio ? 2 : 0);
}

/** Series por semana de cada músculo: 1 por serie si es principal y 0,5 si es secundario. */
export function volumenSemanal(dias, porId, semana = 1) {
  const v = {};
  for (const dia of dias.filter(x => x.semana === semana)) {
    for (const e of dia.ejercicios) {
      const ej = porId.get(e.ejercicio_id);
      if (!ej) continue;
      for (const m of ej.musculos_primarios) v[m] = (v[m] || 0) + e.series;
      for (const m of ej.musculos_secundarios) v[m] = (v[m] || 0) + e.series * 0.5;
    }
  }
  return v;
}

const CALENTAMIENTO_ZONA = {
  hombro: { name: 'Rotación externa con banda, 2 × 15', how: 'Codo pegado al cuerpo y a 90°. Gira el antebrazo hacia afuera sin mover el codo.' },
  codo: { name: 'Flexión y extensión de codo con 1 kg, 2 × 15', how: 'Lento y sin dolor. Solo para calentar la articulación.' },
  lumbar: { name: 'Dead bug 2 × 8 y bird dog 2 × 8', how: 'Espalda baja apoyada en el suelo en el dead bug; en el bird dog, sin arquear.' },
  rodilla: { name: 'Extensión terminal de rodilla con banda, 2 × 15', how: 'Banda detrás de la rodilla. Estira la pierna del todo apretando el cuádriceps.' },
  muneca: { name: 'Círculos y flexión de muñeca, 1 minuto', how: 'Apoya las palmas en el suelo y lleva el peso adelante y atrás con suavidad.' },
  cadera: { name: '90/90 de cadera, 6 cambios por lado', how: 'Sentado en el suelo, gira las dos rodillas al otro lado sin usar las manos.' },
  tobillo: { name: 'Movilidad de tobillo contra la pared, 10 por lado', how: 'Lleva la rodilla a tocar la pared sin despegar el talón.' },
  cuello: { name: 'Movilidad de cuello, 1 minuto', how: 'Giros e inclinaciones lentas, sin forzar.' },
};

/**
 * Arma el plan.
 * @param {object} p
 * @param p.derivados  resultado de derivar()
 * @param p.respuestas respuestas del cuestionario
 * @param p.indice     crearIndice(catalogo)
 * @param p.hoy        'AAAA-MM-DD'
 * @param p.historial  series efectivas recientes [{ejercicio_id, carga_kg, reps, rir?, rpe?, fecha}]
 */
/** @param anteriores ids de los ejercicios del bloque que termina: si a la persona le gusta variar, se cambian algunos. */
export function generarPlan({ derivados: d, respuestas: r, indice, hoy, historial = /** @type {Array<Record<string, any>>} */ ([]), anteriores = null }) {
  if (d.alerta === 'bloqueo') return { bloqueado: true, mensaje: d.mensaje_alerta };
  if (d.errores?.length) return { bloqueado: true, mensaje: d.errores.join(' ') };

  const lugares = r.lugares?.length ? r.lugares : [{ nombre: 'Casa', tipo: 'casa', equipamiento: [] }];
  const lugar = lugares.find(l => l.principal) || lugares[0];
  const equipo = lugar.equipamiento || [];
  const bloqueadas = articulacionesBloqueadas(r.lesiones || [], hoy);
  const prohibidos = new Set(r.prohibidos || []);
  const favoritos = new Set(r.favoritos || []);
  const usoHistorial = new Map();
  for (const s of historial) usoHistorial.set(s.ejercicio_id, (usoHistorial.get(s.ejercicio_id) || 0) + 1);

  // Semana tipo
  const nSesiones = Math.min(6, d.dias_meta);
  const dias = elegirDias(nSesiones, r.dias_no_puedo || []);
  let plantillas = SEMANAS[Math.max(2, dias.length)].slice(0, dias.length);
  // Los días que no son firmes van al final de la semana: que ahí no quede una sesión de pierna (si se salta, se pierde
  // la sentadilla, el hip thrust o el peso muerto de la semana). Se rota la semana sin cambiar el orden entre sesiones.
  if (d.dias_firmes < plantillas.length) {
    const rotada = k => [...plantillas.slice(k), ...plantillas.slice(0, k)];
    // La rotación con menos días de pierna entre los opcionales (con 4 días y 2 firmes no hay una sin ninguna).
    const piernas = k => rotada(k).slice(d.dias_firmes).filter(t => t.startsWith('pierna')).length;
    const k = plantillas.map((_, j) => j).sort((a, b) => piernas(a) - piernas(b) || a - b)[0];
    if (k > 0 && piernas(k) < piernas(0)) plantillas = rotada(k);
  }

  // Zonas prioritarias: un aislado extra en los días que ya trabajan esa zona.
  const extras = new Map();
  for (const m of d.musculos_prioridad) {
    const patron = EXTRA_POR_MUSCULO[m];
    if (!patron) continue;
    const candidatos = plantillas.filter(t => PLANTILLAS[t].huecos.some(([pat]) => pat === patron)).slice(0, 2);
    for (const t of candidatos.length ? candidatos : plantillas.slice(0, 1)) {
      extras.set(t, [...(extras.get(t) || []), [patron, 2]]);
    }
  }

  // Lo que dice el historial de cada ejercicio (series de trabajo con fecha): si el máximo estimado no subió en las
  // últimas 4 semanas respecto de las 4 anteriores, está estancado; si las dominadas salen de 12 o más sin peso en dos
  // días distintos de las últimas 6 semanas, toca sumarles lastre.
  const trabajo = historial.filter(x => x.tipo !== 'calentamiento' && x.fecha);
  const e1rm = x => (Number(x.carga_kg) > 0 && x.reps ? Number(x.carga_kg) * (1 + x.reps / 30) : 0);
  const mejor = (id, desde, hasta) => Math.max(0, ...trabajo.filter(x => x.ejercicio_id === id && x.fecha >= desde && x.fecha < hasta).map(e1rm));
  const estancado = id => { const a = mejor(id, sumarDias(hoy, -28), hoy), b = mejor(id, sumarDias(hoy, -56), sumarDias(hoy, -28)); return a > 0 && b > 0 && a <= b * 1.01; };
  const LASTRE = { dominadas: 'dominadas_lastre', dominadas_supinas: 'dominadas_supinas_lastre' };
  const pesados = new Set(); // básicos estancados que van en un rango más pesado (se cuentan en la justificación)
  const pideLastre = id => new Set(trabajo.filter(x => x.ejercicio_id === id && x.fecha >= sumarDias(hoy, -42) && !(Number(x.carga_kg) > 0) && x.reps >= 12).map(x => x.fecha)).size >= 2;

  const usadosSemana = new Map();
  const tecnica = r.tecnica || {};
  const elegir = (patron, usadosDia, prioridad = 3) => {
    const tecnicaFloja = ['no', 'mas_o_menos'].includes(tecnica[TECNICA_DE[patron]]);
    const cand = indice.ejercicios.filter(e => e.patron === patron && tieneEquipo(e, equipo)
      && nivelAlcanza(d.nivel, e.nivel_minimo) && !prohibidos.has(e.id)
      && !cargaZonaBloqueada(e, bloqueadas) && !usadosDia.has(e.id));
    if (!cand.length) return null;
    const puntaje = e => {
      let p = e.preferencia * 10;
      if (favoritos.has(e.id)) p -= 100;
      p -= Math.min(20, usoHistorial.get(e.id) || 0);
      if (tecnicaFloja && e.equipamiento.includes('barra_rack')) p += 15;
      // Variedad entre los días A y B del mismo tipo: otro remo, otro press (pesa más que la costumbre del historial).
      if (r.rotacion !== 'mismos' && usadosSemana.has(e.id) && !favoritos.has(e.id)) p += 22;
      if (LASTRE[e.id] && pideLastre(e.id)) p += 30;
      // Quien hace 12 o más dominadas sin peso no necesita la versión asistida (salía en el día B por variedad).
      if (esAsistido(e) && Object.keys(LASTRE).some(pideLastre)) p += 40;
      if (Object.entries(LASTRE).some(([base, l]) => l === e.id && pideLastre(base))) p -= 30;
      if (r.rotacion === 'variar' && usadosSemana.has(e.id)) p += 10;
      // Variedad entre bloques: con "variar" cambian los que se puede; con "algunos", solo los complementarios (los
      // principales se mantienen para comparar el progreso). Pesa más que la costumbre del historial (hasta 20).
      if (anteriores?.has(e.id) && !favoritos.has(e.id) && (r.rotacion === 'variar' || (r.rotacion === 'algunos' && prioridad > 1))) p += 25;
      return p;
    };
    return cand.sort((a, b) => puntaje(a) - puntaje(b) || a.id.localeCompare(b.id))[0];
  };

  const historialDe = id => historial.filter(s => s.ejercicio_id === id);
  const cargasRef = (r.cargas_referencia || []).map(c => ({ ejercicio_id: c.ejercicio_id, carga_kg: c.peso_kg, reps: c.repeticiones, rir: 2 }));
  /** Un ejercicio del plan con su prescripción y, si hay historial, su carga inicial. */
  const armar = (ej, prioridad, orden, principal = false) => {
    const pr = prescripcion(ej, prioridad, d);
    // El primer básico de cada día: con nivel avanzado, 4 series; si está estancado, un rango más pesado (5 a 8).
    if (principal && pr.unidad === 'reps') {
      if (d.nivel === 'avanzado') pr.series = Math.max(pr.series, 4);
      if (estancado(ej.id) && pr.reps_max > 8) { pr.reps_min = 5; pr.reps_max = 8; pesados.add(ej.nombre); }
    }
    const inc = incrementoPara(ej, lugar);
    // En los asistidos el peso es la ayuda: se parte con la de la última vez (el máximo estimado no aplica).
    const asistido = esAsistido(ej);
    const carga = cargaSugerida({ e: pr, ej, lugar,
      registros: asistido ? historialDe(ej.id) : [...historialDe(ej.id), ...cargasRef.filter(c => c.ejercicio_id === ej.id)] });
    return {
      ejercicio_id: ej.id, nombre: ej.nombre, orden, prioridad, ...pr, carga_kg: carga,
      nota: carga == null && pr.unidad === 'reps' && inc
        ? asistido
          ? `Elige la ayuda de la máquina con la que te sobren ${pr.rir} repeticiones en la última serie. Anótala y la app la ajusta desde ahí.`
          : `Elige un peso con el que te sobren ${pr.rir} repeticiones en la última serie. Anótalo y la app lo ajusta desde ahí.`
        : null,
    };
  };

  const plantillaDias = plantillas.map((t, i) => {
    const huecos = [...PLANTILLAS[t].huecos, ...(extras.get(t) || [])];
    const usadosDia = new Set();
    let ejercicios = [];
    for (const [patron, prioridad] of huecos.sort((a, b) => a[1] - b[1])) {
      const ej = elegir(patron, usadosDia, prioridad);
      if (!ej) continue;
      usadosDia.add(ej.id);
      usadosSemana.set(ej.id, (usadosSemana.get(ej.id) || 0) + 1);
      ejercicios.push({ ej, prioridad });
    }
    // Sesiones cortas (60 minutos o menos): los accesorios de músculos distintos van de a dos en superserie (bíceps
    // con tríceps, hombro con core), con un descanso por vuelta. Ocupan un solo lugar de la sesión, así un torso de
    // una hora no se queda sin brazos ni hombro. Los principales siguen en series normales, con su descanso completo.
    if (d.duracion_min <= 60) emparejarAccesorios(ejercicios);
    // Lo que no cabe en el tiempo disponible se va desde la prioridad más baja (una superserie cuenta como un lugar).
    let lugares = 0;
    ejercicios = ejercicios.filter((x, k) => {
      const compañero = x.superserie && ejercicios.findIndex((y, j) => j !== k && y.superserie === x.superserie);
      if (!(x.superserie && compañero >= 0 && compañero < k)) lugares++;
      return lugares <= d.ejercicios_por_sesion;
    });
    // Entre básicos de la misma prioridad va primero el que la persona más ha entrenado (su principal, como la banca).
    ejercicios.sort((a, b) => a.prioridad - b.prioridad || TIPO_ORDEN[a.ej.tipo] - TIPO_ORDEN[b.ej.tipo]
      || (a.prioridad === 1 ? (usoHistorial.get(b.ej.id) || 0) - (usoHistorial.get(a.ej.id) || 0) : 0));
    ejercicios = juntarSuperseries(ejercicios);
    return {
      plantilla: t, foco: PLANTILLAS[t].foco, dia_semana: dias[i], firme: i < d.dias_firmes,
      ejercicios: ejercicios.map(({ ej, prioridad, superserie }, orden) => ({ ...armar(ej, prioridad, orden, orden === 0 && prioridad === 1 && ej.tipo === 'compuesto'), ...(superserie ? { superserie } : {}) })),
    };
  });

  // Favoritos: si se pueden hacer y no quedaron en la semana (dos favoritos del mismo movimiento, o un movimiento
  // que la semana no tiene), entran en lugar de un ejercicio parecido o se suman al día que más los necesita.
  const sePuede = ej => ej && ej.tipo !== 'cardio' && tieneEquipo(ej, equipo) && nivelAlcanza(d.nivel, ej.nivel_minimo)
    && !prohibidos.has(ej.id) && !cargaZonaBloqueada(ej, bloqueadas);
  for (const id of favoritos) {
    const ej = indice.porId.get(id);
    if (!sePuede(ej) || plantillaDias.some(x => x.ejercicios.some(e => e.ejercicio_id === id))) continue;
    const parecido = (e, criterio) => !favoritos.has(e.ejercicio_id) && criterio(indice.porId.get(e.ejercicio_id));
    const reemplazo = [e2 => e2.patron === ej.patron, e2 => e2.musculos_primarios.some(m => ej.musculos_primarios.includes(m)) && e2.tipo === ej.tipo]
      .map(c => plantillaDias.flatMap(x => x.ejercicios.filter(e => parecido(e, c) && !x.ejercicios.some(y => y.ejercicio_id === id)).map(e => ({ x, e }))))
      .find(l => l.length);
    if (reemplazo) {
      const { x, e } = reemplazo.sort((a, b) => b.e.prioridad - a.e.prioridad)[0];
      x.ejercicios[x.ejercicios.indexOf(e)] = armar(ej, e.prioridad, e.orden);
    } else {
      const x = [...plantillaDias].sort((a, b) => a.ejercicios.length - b.ejercicios.length)[0];
      x.ejercicios.push(armar(ej, 2, x.ejercicios.length));
      x.ejercicios.sort((a, b) => a.prioridad - b.prioridad || TIPO_ORDEN[indice.porId.get(a.ejercicio_id).tipo] - TIPO_ORDEN[indice.porId.get(b.ejercicio_id).tipo]);
    }
  }

  // Un día que la lesión dejó sin ejercicios grandes (por ejemplo, empuje con el hombro lesionado) suma básicos de espalda
  // y pierna permitidos: antes quedaban días de 23 minutos con tríceps y core.
  const adaptados = [];
  for (const x of plantillaDias) {
    if (!bloqueadas.size || x.ejercicios.some(e => indice.porId.get(e.ejercicio_id)?.tipo === 'compuesto')) continue;
    for (const patron of ['tiron_horizontal', 'sentadilla', 'bisagra', 'tiron_vertical', 'unilateral_pierna', 'extension_cadera']) {
      if (x.ejercicios.filter(e => indice.porId.get(e.ejercicio_id)?.tipo === 'compuesto').length >= 3) break;
      const ej = elegir(patron, new Set(x.ejercicios.map(e => e.ejercicio_id)), 2);
      if (!ej || ej.tipo !== 'compuesto') continue;
      usadosSemana.set(ej.id, (usadosSemana.get(ej.id) || 0) + 1);
      x.ejercicios.push(armar(ej, 2, x.ejercicios.length));
    }
    if (x.ejercicios.some(e => indice.porId.get(e.ejercicio_id)?.tipo === 'compuesto')) {
      x.ejercicios.sort((a, b) => a.prioridad - b.prioridad || TIPO_ORDEN[indice.porId.get(a.ejercicio_id).tipo] - TIPO_ORDEN[indice.porId.get(b.ejercicio_id).tipo]);
      x.ejercicios.forEach((e, i) => { e.orden = i; });
      adaptados.push(x.foco);
    }
  }
  // El primer básico de cada día (prioridad 1 y compuesto): los recortes de volumen y de tiempo lo tocan al último, para
  // que no quede con menos series que los accesorios (y la justificación diga lo que el plan hace).
  const principalDe = new Map(plantillaDias.map(x => { const e = x.ejercicios[0]; return [x.plantilla, e && e.prioridad === 1 && indice.porId.get(e.ejercicio_id)?.tipo === 'compuesto' ? e.ejercicio_id : null]; }));
  const esPrincipal = (x, e) => principalDe.get(x.plantilla) === e.ejercicio_id;
  const esBasico = e => e.prioridad === 1 && indice.porId.get(e.ejercicio_id)?.tipo === 'compuesto';

  // Core: hasta 4 ejercicios a la semana. Cada plantilla trae un hueco de core y con 6 días sumaba más series de core
  // que de espalda; el tiempo que se libera queda para el resto. Se sacan primero los de los días con más ejercicios.
  const esCore = e => indice.porId.get(e.ejercicio_id)?.tipo === 'core' && !favoritos.has(e.ejercicio_id) && !(r.musculos_prioridad || []).includes('core');
  for (let sobran = plantillaDias.reduce((n, x) => n + x.ejercicios.filter(esCore).length, 0) - 4; sobran > 0; sobran--) {
    const x = [...plantillaDias].filter(y => y.ejercicios.some(esCore) && y.ejercicios.length > 2).sort((a, b) => b.ejercicios.length - a.ejercicios.length)[0];
    if (!x) break;
    x.ejercicios = x.ejercicios.filter(e => e !== [...x.ejercicios].reverse().find(esCore));
  }

  // Ajuste de volumen: subir a los músculos prioritarios hasta el tope del rango y no pasarse en ninguno.
  const porId = indice.porId;
  const [lo, hi] = d.series_rango;
  const conSemana = plantillaDias.map(x => ({ ...x, semana: 1 }));
  const CONTADOS = ['femoral', 'gluteo', 'cuadriceps', 'aductor_abductor', 'espalda', 'pecho', 'hombro', 'biceps', 'triceps'];
  const tope = hi + 2, duro = hi + 4; // sobre `duro` el validador rechaza el plan
  const prioritario = m => d.musculos_prioridad.includes(m);
  const aporta = (e, m) => { const ej = porId.get(e.ejercicio_id); return ej.musculos_primarios.includes(m) ? 1 : ej.musculos_secundarios.includes(m) ? 0.5 : 0; };
  const tocan = m => conSemana.flatMap(x => x.ejercicios.map(e => ({ x, e }))).filter(({ e }) => aporta(e, m) > 0);
  const trabajan = m => tocan(m).filter(({ e }) => aporta(e, m) === 1);
  const fav = ({ e }) => favoritos.has(e.ejercicio_id);
  // 1. Recortar lo que pasa el tope, también lo que llega por músculos secundarios (el hombro en cada press):
  //    primero series de lo que no es favorito, después sacar lo menos prioritario, al final series de favoritos.
  //    Si aun así queda sobre el límite duro, se baja a 1 serie y se sacan ejercicios principales repetidos.
  const atascados = new Set(); // lo que no se puede recortar más (todo es favorito): se sigue con los demás músculos
  for (let vuelta = 0; vuelta < 400; vuelta++) {
    const v = volumenSemanal(conSemana, porId);
    const m = CONTADOS.find(k => (v[k] || 0) > tope && !atascados.has(k));
    if (!m) break;
    const orden = (a, b) => aporta(b.e, m) - aporta(a.e, m) || b.e.prioridad - a.e.prioridad;
    const t = tocan(m);
    // Un básico de prioridad 1 no baja de 3 series por aquí (ni el primero del día de las suyas): antes se sacaba un
    // accesorio que también cuenta para el músculo.
    const serieNoFav = t.filter(x => !fav(x) && x.e.series > 2 && !esPrincipal(x.x, x.e) && !(esBasico(x.e) && x.e.series <= 3)).sort(orden)[0];
    const sobra = t.filter(x => !fav(x) && x.e.prioridad >= 2 && x.x.ejercicios.length > 2).sort((a, b) => b.e.prioridad - a.e.prioridad || aporta(b.e, m) - aporta(a.e, m))[0];
    const serieFav = t.filter(x => fav(x) && x.e.series > 2).sort(orden)[0];
    const duro1 = (v[m] || 0) > duro && t.filter(x => !fav(x) && x.e.series > 1).sort(orden)[0];
    const duro2 = (v[m] || 0) > duro && t.filter(x => !fav(x) && x.x.ejercicios.length > 2).sort(orden)[0];
    if (serieNoFav) serieNoFav.e.series--;
    else if (sobra) sobra.x.ejercicios = sobra.x.ejercicios.filter(e => e !== sobra.e);
    else if (serieFav) serieFav.e.series--;
    else if (duro1) duro1.e.series--;
    else if (duro2) duro2.x.ejercicios = duro2.x.ejercicios.filter(e => e !== duro2.e);
    else atascados.add(m);
  }
  const agregadas = new Map(); // ejercicios sumados por zona prioritaria: primero uno a cada una, después un segundo
  let limiteExtra = 1;
  // 2. Subir lo que falta: hasta el piso, o hasta el tope del rango si es prioritario. Una zona prioritaria puede
  //    llegar más alto que las demás; las no prioritarias no pasan el tope de su rango.
  for (let vuelta = 0; vuelta < 200; vuelta++) {
    const v = volumenSemanal(conSemana, porId);
    let cambio = false;
    for (const m of CONTADOS) {
      const meta = prioritario(m) ? hi : lo;
      if ((v[m] || 0) >= meta) continue;
      const cabe = ({ e }) => {
        const ej = porId.get(e.ejercicio_id);
        return e.series < 4 && [...ej.musculos_primarios, ...ej.musculos_secundarios]
          .every(k => !CONTADOS.includes(k) || (v[k] || 0) + (ej.musculos_primarios.includes(k) ? 1 : 0.5) <= (prioritario(k) ? tope : hi));
      };
      const c = trabajan(m).filter(cabe).sort((a, b) => a.e.prioridad - b.e.prioridad)[0];
      if (c) { c.e.series++; cambio = true; break; }
      // Una zona prioritaria sin ejercicio que pueda crecer: se suma uno para ella en el día con más tiempo libre.
      // Si no hay tiempo en ningún día, ocupa el lugar de un accesorio que no es favorito ni trabaja otra prioridad.
      if (prioritario(m) && EXTRA_POR_MUSCULO[m] && (agregadas.get(m) || 0) < limiteExtra) {
        agregadas.set(m, (agregadas.get(m) || 0) + 1);
        // Primero los días que ya trabajan esa zona (la extensión de rodilla va en un día de pierna).
        // Y no dos del mismo movimiento el mismo día.
        const yaTiene = x => (x.ejercicios.some(e => porId.get(e.ejercicio_id).patron === EXTRA_POR_MUSCULO[m]) ? 1 : 0);
        const laTrabaja = x => (x.ejercicios.some(e => aporta(e, m) > 0) ? 0 : 1);
        const dias = [...conSemana].sort((a, b) => yaTiene(a) - yaTiene(b) || laTrabaja(a) - laTrabaja(b) || duracionEstimada(a.ejercicios) - duracionEstimada(b.ejercicios));
        for (const reemplazar of [false, true]) {
          for (const x of dias) {
            const ej = elegir(EXTRA_POR_MUSCULO[m], new Set(x.ejercicios.map(e => e.ejercicio_id)));
            if (!ej || !ej.musculos_primarios.includes(m) || !cabe({ e: { ejercicio_id: ej.id, series: 2 } })) continue;
            const nuevo = { ...armar(ej, 2, x.ejercicios.length), series: 2 };
            const sale = reemplazar && x.ejercicios.filter(e => e.prioridad >= 2 && !favoritos.has(e.ejercicio_id)
              && !porId.get(e.ejercicio_id).musculos_primarios.some(prioritario)).sort((a, b) => b.prioridad - a.prioridad || b.orden - a.orden)[0];
            if (reemplazar && !sale) continue;
            const quedan = x.ejercicios.filter(e => e !== sale);
            // Sumar tiene que caber en el tiempo; reemplazar, al menos no alargar la sesión.
            const tope = reemplazar ? Math.max(duracionEstimada(x.ejercicios), d.duracion_min * 1.1) : d.duracion_min * 1.1;
            if (duracionEstimada([...quedan, nuevo]) > tope) continue;
            x.ejercicios = [...quedan, { ...nuevo, series: reemplazar ? Math.max(2, sale.series) : 2 }];
            cambio = true;
            break;
          }
          if (cambio) break;
        }
        if (cambio) break;
      }
    }
    if (!cambio && limiteExtra < 2) { limiteExtra = 2; continue; }
    if (!cambio) break;
  }

  // Si una sesión no cabe en el tiempo, se va sacando lo que menos cuesta perder, de a una serie o un ejercicio:
  // primero series de lo que no es favorito ni trabaja una zona prioritaria, después esos ejercicios, y recién
  // ahí series de lo prioritario y de los favoritos. Un ejercicio se saca antes de dejarlo en 2 series si no
  // importa, pero no el último de la semana para una zona grande o prioritaria (que no quede sin espalda).
  // Si aun así no cabe: descansos más cortos y, al final, menos ejercicios.
  const importa = e => (favoritos.has(e.ejercicio_id) ? 2 : 0) + (porId.get(e.ejercicio_id).musculos_primarios.some(prioritario) ? 1 : 0);
  const GRANDES = ['espalda', 'pecho', 'cuadriceps', 'gluteo', 'femoral', 'hombro'];
  const ultimo = e => porId.get(e.ejercicio_id).musculos_primarios.some(m => (GRANDES.includes(m) || prioritario(m))
    && conSemana.reduce((n, x) => n + x.ejercicios.filter(y => porId.get(y.ejercicio_id).musculos_primarios.includes(m)).length, 0) === 1);
  for (const x of conSemana) {
    const sobra = () => duracionEstimada(x.ejercicios) > d.duracion_min * 1.1;
    // Lo que deja un músculo bajo el piso de su rango cuesta más: así se recorta primero lo que sobra (por ejemplo, un
    // segundo remo de una prioridad que ya está en su tope) antes que los brazos o los aductores.
    const acciones = () => { const v = volumenSemanal(conSemana, porId); const bajoPiso = (e, n) => porId.get(e.ejercicio_id).musculos_primarios.some(k => CONTADOS.includes(k) && (v[k] || 0) - n < lo); return x.ejercicios.flatMap(e => [
      ...(e.series > 2 ? [{ e, costo: importa(e) + (e.series <= 3 ? 1 : 0) + (esPrincipal(x, e) && e.series > 3 && d.nivel === 'avanzado' ? 2 : esBasico(e) && e.series <= 3 ? 1 : 0) + (bajoPiso(e, 1) ? 1 : 0), hacer: () => { e.series--; } }] : []),
      ...(x.ejercicios.length > 2 ? [{ e, costo: importa(e) + 1.5 + (ultimo(e) ? 3 : 0) + (esBasico(e) ? 1.5 : 0) + (bajoPiso(e, e.series) ? 2 : 0) + (favoritos.has(e.ejercicio_id) ? 3 : 0), hacer: () => { x.ejercicios = x.ejercicios.filter(y => y !== e); } }] : []),
    ]).sort((a, b) => a.costo - b.costo || b.e.prioridad - a.e.prioridad || b.e.orden - a.e.orden); };
    while (sobra()) { const [a] = acciones(); if (!a) break; a.hacer(); }
    for (const e of x.ejercicios) if (sobra()) e.descanso_seg = Math.min(e.descanso_seg, 90);
    const menor = () => [...x.ejercicios].sort((a, b) => importa(a) - importa(b) || b.prioridad - a.prioridad || b.orden - a.orden)[0];
    while (sobra() && x.ejercicios.length > 1) x.ejercicios = x.ejercicios.filter(y => y !== menor());
  }

  // Después de recortar por tiempo, una zona prioritaria no puede quedar con menos series que el promedio de las que
  // no lo son: se le devuelven series, o un ejercicio, en los días donde todavía queda tiempo.
  const cabeTiempo = (x, extra) => duracionEstimada([...x.ejercicios, ...extra]) <= d.duracion_min * 1.1;
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    const v = volumenSemanal(conSemana, porId);
    const resto = CONTADOS.filter(k => !prioritario(k) && v[k]);
    const prom = resto.reduce((a, k) => a + v[k], 0) / (resto.length || 1);
    const m = CONTADOS.find(k => prioritario(k) && (v[k] || 0) > 0 && v[k] < prom && v[k] < tope);
    if (!m) break;
    const enTope = id => { const ej = porId.get(id); return [...ej.musculos_primarios, ...ej.musculos_secundarios]
      .some(k => CONTADOS.includes(k) && (v[k] || 0) + (ej.musculos_primarios.includes(k) ? 1 : 0.5) > (prioritario(k) ? tope : hi)); };
    const crece = trabajan(m).find(({ x, e }) => e.series < 4 && !enTope(e.ejercicio_id) && cabeTiempo(x, [{ ...e, series: 1 }]));
    if (crece) { crece.e.series++; continue; }
    let puesto = false;
    for (const x of conSemana) {
      const ej = EXTRA_POR_MUSCULO[m] && elegir(EXTRA_POR_MUSCULO[m], new Set(x.ejercicios.map(e => e.ejercicio_id)));
      if (!ej || !ej.musculos_primarios.includes(m) || enTope(ej.id)) continue;
      const nuevo = { ...armar(ej, 2, x.ejercicios.length), series: 2 };
      if (!cabeTiempo(x, [nuevo])) continue;
      x.ejercicios.push(nuevo);
      puesto = true;
      break;
    }
    if (!puesto) break;
  }
  // Sesiones cortas: un músculo que quedó bajo el piso de su rango (brazos, aductores, pecho u hombro en 4 días de 45 o
  // 60 minutos) suma un accesorio de 2 series en superserie con otro accesorio del día, si cabe con el calentamiento
  // real. Antes el remo extra de una prioridad ocupaba el lugar de bíceps y tríceps y el torso quedaba sin brazos.
  if (d.duracion_min <= 60) {
    const sinLugar = new Set();
    const tipoDe = e => porId.get(e.ejercicio_id)?.tipo;
    const comparten = (a, b) => porId.get(a.ejercicio_id).musculos_primarios.some(m => porId.get(b.ejercicio_id).musculos_primarios.includes(m));
    for (let vuelta = 0; vuelta < 24; vuelta++) {
      const v = volumenSemanal(conSemana, porId);
      const m = CONTADOS.filter(k => !prioritario(k) && !sinLugar.has(k) && EXTRA_POR_MUSCULO[k] && (v[k] || 0) < lo).sort((a, b) => (v[a] || 0) - (v[b] || 0))[0];
      if (!m) break;
      let puesto = false;
      for (const x of [...conSemana].sort((a, b) => duracionEstimada(a.ejercicios) - duracionEstimada(b.ejercicios))) {
        const ej = elegir(EXTRA_POR_MUSCULO[m], new Set(x.ejercicios.map(e => e.ejercicio_id)));
        if (!ej || ej.tipo === 'compuesto' || !ej.musculos_primarios.includes(m)) continue;
        // Sin pasar el tope de otro músculo (la abductora suma glúteo).
        if ([...ej.musculos_primarios, ...ej.musculos_secundarios].some(k => k !== m && CONTADOS.includes(k) && (v[k] || 0) + (ej.musculos_primarios.includes(k) ? 2 : 1) > (prioritario(k) ? tope : hi))) continue;
        const nuevo = { ...armar(ej, 4, x.ejercicios.length), series: 2 };
        const socio = x.ejercicios.find(e => !e.superserie && ['aislamiento', 'core'].includes(tipoDe(e)) && !comparten(e, nuevo));
        const letra = 'ABCDEFGH'.split('').find(l => !x.ejercicios.some(e => e.superserie === l));
        let lista = juntarSuperseries([...x.ejercicios.map(e => (e === socio && letra ? { ...e, superserie: letra } : e)), { ...nuevo, ...(socio && letra ? { superserie: letra } : {}) }]);
        // Si no cabe, se le quita una serie (hasta cinco) a lo que tiene de sobra: más de 2 series, no es el primer
        // básico ni un básico en 3, y sus músculos siguen sobre el piso sin esa serie.
        const sobra = l => l.filter(e => e.series > 2 && !esPrincipal(x, e) && !(esBasico(e) && e.series <= 3) && !favoritos.has(e.ejercicio_id)
          && porId.get(e.ejercicio_id).musculos_primarios.every(k => !CONTADOS.includes(k) || (v[k] || 0) - 1 >= lo))
          .sort((a, b) => b.prioridad - a.prioridad || b.orden - a.orden)[0];
        for (let n = 0; n < 5 && duracionEstimada(lista, 10) > d.duracion_min; n++) {
          const e = sobra(lista);
          if (!e) break;
          lista = lista.map(y => (y === e ? { ...y, series: y.series - 1 } : y));
        }
        if (duracionEstimada(lista, 10) > d.duracion_min) continue;
        x.ejercicios = lista;
        puesto = true;
        break;
      }
      if (!puesto) sinLugar.add(m);
    }
  }
  for (const x of conSemana) { x.ejercicios = juntarSuperseries(x.ejercicios); x.ejercicios.forEach((e, i) => { e.orden = i; }); }

  // Calendario: 4 semanas desde el próximo lunes; la cuarta es de descarga.
  const lunes = sumarDias(hoy, (8 - diaSemana(hoy)) % 7 || 0);
  const zonasCalentar = [...new Set((r.lesiones || []).filter(l => l.activa !== false && !bloqueadas.has(l.region)).map(l => l.region))];
  const cardio = cardioPara(r, indice, equipo);
  const diasPlan = [];
  for (let semana = 1; semana <= 4; semana++) {
    for (const [i, x] of conSemana.entries()) {
      const offset = (x.dia_semana === 0 ? 7 : x.dia_semana) - 1;
      const descarga = semana === 4;
      const conservadora = semana <= d.semanas_conservadoras;
      // Semana 3, la última antes de la descarga: con experiencia, una repetición menos de reserva (sin bajar de 1 en
      // los compuestos ni de 0 en los aislados, ni del mínimo del perfil). La exigencia sube dentro del bloque.
      const intensificar = semana === 3 && !conservadora && !d.conservador && d.nivel !== 'principiante';
      // El core y lo que se mide en segundos no cambian: una plancha "a 0 de reserva" no tiene sentido.
      const rirSemana = e => (intensificar && e.unidad === 'reps' && porId.get(e.ejercicio_id)?.tipo !== 'core'
        ? Math.max(e.rir - 1, d.rir_minimo, porId.get(e.ejercicio_id)?.tipo === 'compuesto' ? 1 : 0) : e.rir);
      diasPlan.push({
        fecha: sumarDias(lunes, (semana - 1) * 7 + offset), semana, plantilla: x.plantilla, foco: x.foco,
        tipo: 'entrenamiento', firme: x.firme, lugar: lugar.nombre || null,
        racional: racional(x, descarga),
        calentamiento: [
          { name: '5 minutos de cardio suave', how: 'Bicicleta, trotadora o escaladora a ritmo cómodo.' },
          { name: 'Series de aproximación del primer ejercicio', how: 'Una serie con la mitad del peso y otra con tres cuartos, pocas repeticiones.' },
          ...zonasCalentar.map(z => CALENTAMIENTO_ZONA[z]).filter(Boolean),
        ],
        cardio: cardio(x, i),
        ejercicios: x.ejercicios.map(e => (descarga ? comoDescarga(e) : { ...e, rir: Math.min(5, conservadora ? Math.max(e.rir, 3) : rirSemana(e)) })),
      });
    }
  }
  const preparar = dia => {
    dia.calentamiento = calentamientoDeSesion({ dia, porId: indice.porId, equipo, bloqueadas, minutos: d.duracion_min,
      opcionesCarga: Object.fromEntries(dia.ejercicios.map(e => { const ej = indice.porId.get(e.ejercicio_id); return [e.ejercicio_id, { incremento: ej ? incrementoPara(ej, lugar) : 2.5, barra: ej?.equipamiento.includes('barra_rack') ? 20 : 0 }]; })) });
  };
  for (const dia of diasPlan) {
    preparar(dia);
    const objetivoCardio = minutosCardio(dia.cardio) || 0;
    // Recortar accesorios para respetar el tiempo; después ajustar el cardio al espacio disponible.
    const reserva = objetivoCardio > 0 && (r.favoritos || []).some(id => indice.porId.get(id)?.tipo === 'cardio') ? 7 : 0;
    while (duracionSesion({ ...dia, cardio: null }) + reserva > d.duracion_min && dia.ejercicios.length) {
      const protegido = e => (r.favoritos || []).includes(e.ejercicio_id) || (indice.porId.get(e.ejercicio_id)?.musculos_primarios || []).some(m => (r.musculos_prioridad || []).includes(m));
      const candidatos = dia.ejercicios.filter(e => !favoritos.has(e.ejercicio_id) || e.series > 1);
      const resguardo = e => (protegido(e) || (principalDe.get(dia.plantilla) === e.ejercicio_id && e.series > 3 && d.nivel === 'avanzado') ? 1 : 0);
      const lista = candidatos.length ? candidatos : dia.ejercicios;
      let ultimo = [...lista].sort((a, b) => resguardo(a) - resguardo(b) || b.prioridad - a.prioridad || b.orden - a.orden)[0];
      // Antes de sacar un básico, se le quita una serie a otro que tenga más de 2 (el primero del día, si hace falta).
      if (ultimo.series <= 2 && esBasico(ultimo)) ultimo = [...lista].filter(e => e.series > 2).sort((a, b) => b.orden - a.orden)[0] || ultimo;
      // Antes que dejar un ejercicio en 1 serie (que casi no aporta), se saca.
      if (ultimo.series > 2) ultimo.series--;
      else dia.ejercicios.splice(dia.ejercicios.indexOf(ultimo), 1);
      dia.ejercicios = juntarSuperseries(dia.ejercicios);
      preparar(dia);
    }
    const disponible = Math.max(0, d.duracion_min - duracionSesion({ ...dia, cardio: null }) - 2);
    if (objetivoCardio > disponible) {
      dia.cardio = disponible >= 5 ? `${dia.cardio.split(/\d| en intervalos|:/)[0].trim()} ${disponible} minutos a ritmo cómodo. Reducido para respetar tu tiempo.` : null;
      dia.nota_cardio = 'La dosis de cardio original no cabe en este tiempo. Puedes dedicarle una sesión aparte.';
    }
  }
  for (const dia of diasPlan.filter(x => x.semana === 4)) {
    const base = diasPlan.find(x => x.semana === 1 && x.plantilla === dia.plantilla);
    dia.ejercicios = base.ejercicios.map(comoDescarga);
    if (dia.ejercicios.every(e => e.series === 1) && dia.ejercicios.length > 1) dia.ejercicios.pop();
    preparar(dia);
  }
  // Lo que va después de otros ejercicios del mismo músculo no rinde como fresco: su carga baja (nucleo/fatiga-sesion.js).
  for (const dia of diasPlan) dia.ejercicios = conFatigaPrevia(dia.ejercicios, porId, ej => incrementoPara(ej, lugar), esAsistido);
  diasPlan.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  // Lo que se dice del primer básico, según cómo quedó la semana 1 después de los recortes.
  const conPrincipal = diasPlan.filter(x => x.semana === 1 && principalDe.get(x.plantilla));
  const con4 = conPrincipal.filter(x => (x.ejercicios.find(e => e.ejercicio_id === principalDe.get(x.plantilla))?.series || 0) >= 4).length;
  const fraseBasico = d.nivel !== 'avanzado' || !con4 ? '' : con4 === conPrincipal.length ? 'El primer básico de cada día lleva 4 series.'
    : `El primer básico lleva 4 series en ${con4} de los ${conPrincipal.length} días; en el resto el tiempo no alcanza.`;

  return {
    bloqueado: false,
    inicio: lunes, semanas: 4, semana_descarga: 4,
    objetivo: d.objetivo, estructura: 'fija', generado_por: 'reglas',
    lugar: lugar.nombre || null,
    justificacion: [justificacion(d, dias, plantillas, bloqueadas),
      fraseBasico,
      adaptados.length ? `${[...new Set(adaptados)].join(' y ')} ${adaptados.length > 1 ? 'suman' : 'suma'} espalda y pierna, porque la lesión deja fuera sus ejercicios grandes.` : '',
      pesados.size ? `Sin subir en las últimas 4 semanas, van en un rango más pesado (5 a 8): ${[...pesados].join(', ')}.` : ''].filter(Boolean).join(' '),
    dias: diasPlan,
  };
}

/** Accesorios (no compuestos) de músculos principales distintos, de a dos, con letra de superserie. Primero bíceps con
 *  tríceps; después cualquier par que no comparta músculo. Marca cada elegido con { superserie: 'A' | 'B' ... }. */
function emparejarAccesorios(items) {
  const libres = items.filter(x => x.ej.tipo !== 'compuesto' && x.ej.tipo !== 'cardio' && !x.superserie);
  const distintos = (a, b) => !a.ej.musculos_primarios.some(m => b.ej.musculos_primarios.includes(m));
  const letras = 'ABCDEFGH';
  let n = 0;
  const unir = (a, b) => { a.superserie = b.superserie = letras[n++]; };
  const de = patron => libres.find(x => x.ej.patron === patron && !x.superserie);
  const bi = de('biceps'), tri = de('triceps');
  if (bi && tri) unir(bi, tri);
  for (const a of libres) {
    if (a.superserie) continue;
    const b = libres.find(x => x !== a && !x.superserie && distintos(a, x));
    if (b) unir(a, b);
  }
}

/** Deja cada par de superserie seguido (el segundo justo después del primero); una letra sola se quita. */
export function juntarSuperseries(lista) {
  const out = [];
  for (const x of lista) {
    if (out.includes(x)) continue;
    out.push(x);
    const otro = x.superserie && lista.find(y => y !== x && y.superserie === x.superserie);
    if (otro) out.push(otro);
  }
  for (const x of out) if (x.superserie && !out.some(y => y !== x && y.superserie === x.superserie)) delete x.superserie;
  return out;
}

export const TEXTO_DESCARGA = 'Semana de descarga: la mitad de las series y más repeticiones de reserva, con los mismos ejercicios. Sirve para llegar fresco al próximo bloque.';

/** Una semana normal pasada a descarga: la mitad de las series y 2 repeticiones más de reserva. */
export const comoDescarga = e => ({ ...e, series: Math.max(1, Math.ceil(e.series / 2)), rir: Math.min(5, e.rir + 2) });

function racional(x, descarga) {
  if (descarga) return TEXTO_DESCARGA;
  const prim = x.ejercicios.filter(e => e.prioridad === 1).map(e => e.nombre);
  return `${x.foco}. Lo principal es ${prim.join(' y ') || 'el primer ejercicio'}. Si falta tiempo, se salta desde el final.${x.firme ? '' : ' Este día es opcional: si no alcanzas, no se pierde nada importante.'}`;
}

function cardioPara(r, indice, equipo) {
  const para = r.cardio_para;
  const hace = (r.cardio_actual || []).filter(c => c !== 'ninguno');
  // Los cardios marcados como favoritos (y que se pueden hacer ahí) mandan; si son varios, se turnan entre los días.
  const favoritos = (r.favoritos || []).map(id => indice.porId.get(id)).filter(e => e?.tipo === 'cardio' && tieneEquipo(e, equipo));
  if (!favoritos.length && !hace.length && !['bajar_grasa', 'recomposicion', 'salud'].includes(r.objetivo_principal)) return () => null;
  const comun = hace.includes('escaladora') ? 'Escaladora' : hace.includes('bici') ? 'Bicicleta' : hace.includes('trote') ? 'Trote suave' : 'Caminata inclinada';
  return (x, i) => {
    const tipo = favoritos.length ? favoritos[i % favoritos.length].nombre : comun;
    if (para === 'condicion' && x.plantilla.startsWith('torso')) return `${favoritos.length ? `${tipo} en intervalos` : 'Intervalos'}: 6 × 1 minuto fuerte y 1 minuto suave. Después de las pesas.`;
    if (x.plantilla.startsWith('pierna')) return `${tipo} 10 minutos suave, solo para soltar.`;
    return `${tipo} 20 a 30 minutos a ritmo moderado: puedes hablar pero no cantar. Después de las pesas.`;
  };
}

export const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const NOMBRE_ZONA = {
  gluteo: 'glúteo', cuadriceps: 'cuádriceps', femoral: 'femoral', aductor_abductor: 'aductores y abductores', pecho: 'pecho',
  espalda: 'espalda', hombro: 'hombro', biceps: 'bíceps', triceps: 'tríceps', core: 'core',
  codo: 'codo', muneca: 'muñeca', lumbar: 'zona lumbar', cadera: 'cadera', rodilla: 'rodilla', tobillo: 'tobillo', cuello: 'cuello',
};
const nombres = ids => [...ids].map(z => NOMBRE_ZONA[z] || z).join(', ');

function justificacion(d, dias, plantillas, bloqueadas) {
  const partes = [
    `Plan de 4 semanas para ${{ ganar_musculo: 'ganar músculo', ganar_fuerza: 'ganar fuerza', bajar_grasa: 'bajar grasa sin perder músculo', recomposicion: 'bajar grasa y ganar músculo', salud: 'salud general', deporte: 'rendir en tu deporte', volver: 'volver a entrenar' }[d.objetivo] || d.objetivo}, nivel ${d.nivel}.`,
    `${dias.length} días: ${dias.map(x => NOMBRE_DIA[x]).join(', ')}${d.dias_firmes < dias.length ? `; los primeros ${d.dias_firmes} son firmes y el resto opcionales` : ''}.`,
    `Cada músculo entre ${d.series_rango[0]} y ${d.series_rango[1]} series a la semana${d.musculos_prioridad.length ? `, más en ${nombres(d.musculos_prioridad)}` : ''}.`,
    'La carga sube solo cuando completas todas las series en el tope de repeticiones. La semana 4 es de descarga.',
  ];
  if (d.semanas_conservadoras < 3 && !d.conservador && d.nivel !== 'principiante') partes.push('La semana 3 pide una repetición menos de reserva, para subir la exigencia justo antes de la descarga.');
  if (d.duracion_min <= 60) partes.push('Como la sesión es corta, el calentamiento dura unos 10 minutos y los accesorios van en superserie.');
  if (bloqueadas.size) partes.push(`Mientras dure la lesión, el plan no carga: ${nombres(bloqueadas)}.`);
  if (d.alerta === 'aviso') partes.push('Las dos primeras semanas van más suaves por lo que contestaste en salud.');
  return partes.join(' ');
}
