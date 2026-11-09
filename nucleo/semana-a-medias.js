// Una semana del bloque que quedó a medias (pedido de Francisco, 2 de noviembre de 2026, después de una semana con 2 de
// 5 sesiones firmes). Al cerrar la semana, el coach ofrece la mejor opción según los datos de la persona y deja las otras
// a mano; cada una muestra cómo quedaría el plan y nada cambia sin confirmar (regla 10 de AGENTS.md):
//   - Seguir igual: faltó poco o fue algo puntual.
//   - Repetir la semana: faltó mucho por algo pasajero; el resto del bloque, descarga incluida, se corre 7 días.
//   - Primero lo que faltó: faltó un grupo y otro quedó cubierto; la semana parte por lo que faltó, sin sumar sesiones.
//   - Pasar a menos días: el plan creció más de lo que cupo o es la segunda semana a medias; las sesiones que menos
//     aportan quedan opcionales hasta el final del bloque.
//   - Adelantar la descarga: faltó por cansancio, enfermedad, poco sueño o dolor.
// Principios: una semana a medias no hace perder fuerza ni músculo (eso toma varias semanas sin entrenar), lo que faltó no
// se suma a lo nuevo (más de 10 a 12 series duras por músculo en una sesión rinde poco y cansa más) y lo que no se hizo no
// sube de peso (nucleo/progresion.js solo ajusta lo hecho).
import { estadoDelPlan } from './registrado.js';
import { sumarDias, diaSemana, nombreDia, conflictos } from './agenda.js';
import { adelantarDescarga } from './ciclos.js';
import { esDeTrabajoGuardada } from './registro.js';

const A_MEDIAS = 0.75;           // menos de esto de las series firmes hechas: la semana quedó a medias
const MUCHO = 0.6;               // menos de esto: repetir la semana entera tiene sentido
const FALTO = 0.5, CUBIERTO = 0.8; // por grupo: qué faltó y qué quedó cubierto
const CRECIO = 1.25;             // series firmes un cuarto o más sobre la semana anterior, que salió completa
const META = 10;                 // series duras por músculo a la semana: lo primero que se busca cubrir
const MAX_SEMANAS = 12;          // la tabla planes acepta de 1 a 12
const GRUPO = { cuadriceps: 'piernas', gluteo: 'piernas', femoral: 'piernas', aductor_abductor: 'piernas', pantorrilla: 'piernas', erectores: 'piernas', pecho: 'torso', espalda: 'torso', trapecio: 'torso', hombro: 'brazos', biceps: 'brazos', triceps: 'brazos', antebrazo: 'brazos', core: 'core' };
const NOMBRE_GRUPO = { piernas: 'piernas y glúteos', torso: 'pecho y espalda', brazos: 'brazos y hombros', core: 'core' };

const lunesDe = f => sumarDias(f, -((diaSemana(f) + 6) % 7));
const diaCorto = f => `${nombreDia(f)} ${Number(f.slice(8))}`;
const coma = x => String(Math.round(x * 10) / 10).replace('.', ',');
const lista = xs => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);
// "Torso A: pecho y espalda" en una frase con comas se lee enredado: en el texto va el nombre corto.
const corto = foco => String(foco || '').split(':')[0].trim();
const entrena = d => Boolean(d?.ejercicios?.length) && d.foco !== 'Sesión libre';
const esFirme = d => entrena(d) && d.firme !== false;
const seriesDe = d => (d?.ejercicios || []).reduce((a, e) => a + (Number(e.series) || 0), 0);
const musculos = (id, indice) => [...new Set(indice?.porId?.get(id)?.musculos_primarios || [])];
const grupos = (id, indice) => [...new Set(musculos(id, indice).map(m => GRUPO[m] || 'core'))];
/** Semana del bloque de una fecha, contada desde el inicio del plan (la misma cuenta de nucleo/ciclos.js). */
const semanaDeFecha = (plan, f) => Math.floor((Date.parse(f + 'T12:00:00Z') - Date.parse(plan.inicio + 'T12:00:00Z')) / 864e5 / 7) + 1;
/** Una huella corta del plan (fecha, sesión y si es firme): si cambió, la propuesta calculada antes ya no vale. */
export function firmaPlan(plan) {
  let h = 5381;
  for (const c of (plan?.dias || []).map(d => `${d.fecha}:${d.foco}:${d.firme !== false}`).sort().join('|')) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
// Series de trabajo de una sesión guardada, como [ejercicio, series].
const trabajo = sesion => {
  const m = new Map();
  for (const s of sesion?.series || []) if (s.ejercicio_id && esDeTrabajoGuardada(s)) m.set(s.ejercicio_id, (m.get(s.ejercicio_id) || 0) + 1);
  return [...m];
};
const sumarPorGrupo = (acc, pares, indice) => { for (const [id, n] of pares) for (const g of grupos(id, indice)) acc[g] = (acc[g] || 0) + n; return acc; };
const pares = d => (d.ejercicios || []).map(e => [e.ejercicio_id, Number(e.series) || 0]);

/** Lo planificado y lo hecho en la semana `n` del bloque: sesiones firmes, series y series por grupo. */
export function cumplimiento(plan, sesiones, n, { hoy, marcas = {}, indice } = {}) {
  const dias = (plan?.dias || []).filter(d => d.semana === n && esFirme(d)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (!dias.length) return null;
  const reg = estadoDelPlan(plan, sesiones, { hoy, marcas });
  const plan_ = {}, hecho = {}, pendientes = [];
  let seriesPlan = 0, seriesHechas = 0, parte = 0, completas = 0, aMedias = 0;
  for (const d of dias) {
    const p = seriesDe(d), e = reg.porDia.get(d.fecha) || {};
    seriesPlan += p;
    sumarPorGrupo(plan_, pares(d), indice);
    let h = 0;
    if (e.sesion) { const t = trabajo(e.sesion); h = t.reduce((a, [, k]) => a + k, 0); sumarPorGrupo(hecho, t, indice); }
    else if (e.t === 'hecha_sin_registro') { h = p; sumarPorGrupo(hecho, pares(d), indice); }
    // 'reemplazada': la misma sesión vuelve a tocar (o se hizo otro día, y ahí cuenta en ese día): esta no se hizo, y la
    // app no pregunta por ella.
    else if (e.t === 'pendiente' || e.t === 'sin_datos') pendientes.push(d.fecha);
    seriesHechas += Math.min(h, p);
    const fr = p ? Math.min(1, h / p) : 0;
    parte += fr;
    if (fr >= 0.9) completas += 1; else if (fr > 0) aMedias += 1;
  }
  const desde = lunesDe(dias[0].fecha);
  return {
    semana: n, desde, hasta: sumarDias(desde, 6), pendientes,
    sesiones: { plan: dias.length, completas, aMedias, parte },
    series: { plan: seriesPlan, hechas: seriesHechas },
    grupos: Object.keys(plan_).map(g => ({ grupo: g, plan: plan_[g], hechas: Math.min(plan_[g], hecho[g] || 0) })),
  };
}

/** Lo que anotó en "¿Cómo estás hoy?" esa semana que explica faltar por cansancio (vacío si no hay nada). */
function senalesCansancio(bienestar = {}, desde, hasta) {
  const dias = Object.entries(bienestar).filter(([f]) => f >= desde && f <= hasta).map(([, v]) => v || {});
  const prom = k => { const xs = dias.map(v => Number(v[k])).filter(x => Number.isFinite(x) && x > 0); return xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null; };
  const cansancio = prom('cansancio'), sueno = prom('sueno_horas');
  return [
    cansancio != null && cansancio >= 4 && `anotaste cansancio de ${coma(cansancio)} de 5`,
    sueno != null && sueno < 6 && `dormiste ${coma(sueno)} horas en promedio`,
    dias.some(v => v.enfermo && v.enfermo !== 'no') && 'anotaste que estabas enfermo',
    dias.some(v => Number(v.dolor) > 0) && 'anotaste dolor',
  ].filter(Boolean);
}

/**
 * Elige `k` sesiones de `candidatas` por lo que aportan: series por músculo hasta cubrir la meta semanal, con más peso
 * para lo que faltó y lo prioritario. `ya`: series por músculo que la semana ya tiene (sesiones hechas).
 */
function elegirSesiones(candidatas, k, { indice, faltan = [], prioridad = [], ya = {} }) {
  const peso = m => (faltan.includes(GRUPO[m] || 'core') ? 1.5 : 1) * (prioridad.includes(m) ? 1.5 : 1);
  const cubierto = { ...ya }, elegidas = [], restantes = [...candidatas];
  const aporte = d => (d.ejercicios || []).reduce((v, e) => v + musculos(e.ejercicio_id, indice)
    .reduce((w, m) => w + (Number(e.series) || 0) * peso(m) * ((cubierto[m] || 0) < META ? 1 : 0.3), 0), 0);
  while (elegidas.length < k && restantes.length) {
    let mejor = restantes[0], mv = -1;
    for (const d of restantes) { const v = aporte(d); if (v > mv + 1e-9) { mejor = d; mv = v; } } // empate: la más temprana
    elegidas.push(mejor); restantes.splice(restantes.indexOf(mejor), 1);
    for (const e of mejor.ejercicios || []) for (const m of musculos(e.ejercicio_id, indice)) cubierto[m] = (cubierto[m] || 0) + (Number(e.series) || 0);
  }
  return elegidas;
}
const seriesPorMusculo = (dias, indice) => {
  const m = {};
  for (const d of dias) for (const e of d.ejercicios || []) for (const x of musculos(e.ejercicio_id, indice)) m[x] = (m[x] || 0) + (Number(e.series) || 0);
  return m;
};

/**
 * Pasar a `dias` sesiones firmes por semana desde la semana `semana` hasta el final del bloque: se quedan las que más
 * aportan (esta semana, con más peso para lo que faltó) y las otras pasan a opcionales. Nada se borra.
 * @returns {{plan, semana, opcionales, firmes}} o {error}
 */
export function pasarADias(plan, { semana, dias, faltan = [], prioridad = [], hechas = [], hoy, indice }) {
  const nuevo = structuredClone(plan), hechasSet = new Set(hechas);
  const ultima = Math.max(...nuevo.dias.map(d => d.semana || 0));
  let cambios = 0, opcionales = [], firmes = [];
  for (let w = semana; w <= ultima; w++) {
    const semanaDias = nuevo.dias.filter(d => d.semana === w && esFirme(d));
    const hechasW = semanaDias.filter(d => hechasSet.has(d.fecha));
    const cand = semanaDias.filter(d => !hechasSet.has(d.fecha) && d.fecha >= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const k = Math.max(0, dias - hechasW.length);
    if (cand.length <= k) continue;
    const quedan = new Set(elegirSesiones(cand, k, { indice, faltan: w === semana ? faltan : [], prioridad, ya: seriesPorMusculo(hechasW, indice) }));
    for (const d of cand) if (!quedan.has(d)) { d.firme = false; cambios += 1; }
    if (w === semana) { opcionales = cand.filter(d => !quedan.has(d)).map(d => corto(d.foco)); firmes = [...hechasW, ...cand.filter(d => quedan.has(d))].map(d => corto(d.foco)); }
  }
  if (!cambios) return { error: `Tu plan ya tiene ${dias} sesiones firmes por semana o menos.` };
  const vista = nuevo.dias.filter(d => d.semana === semana && entrena(d)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .map(d => ({ fecha: d.fecha, foco: d.foco, cambio: d.firme === false ? (sesionFirme(plan, d.fecha) ? 'Pasa a opcional' : 'Opcional') : '' }));
  return { plan: nuevo, semana: vista, opcionales, firmes };
}
const sesionFirme = (plan, fecha) => esFirme(plan.dias.find(d => d.fecha === fecha));

/**
 * Esta semana parte por lo que faltó: las sesiones firmes que quedan se reordenan en sus mismos días, primero las que
 * más trabajan los grupos que faltaron, sin dejar dos del mismo grupo en días seguidos si se puede. No suma sesiones:
 * si no alcanza a todo, lo que queda fuera es lo que ya se hizo la semana pasada.
 */
export function primeroLoQueFalto(plan, { semana, faltan = [], hechas = [], hoy, indice }) {
  const hechasSet = new Set(hechas);
  const mover = plan.dias.filter(d => d.semana === semana && esFirme(d) && d.fecha >= hoy && !hechasSet.has(d.fecha))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (mover.length < 2) return { error: 'Esta semana ya no quedan sesiones para reordenar.' };
  const valor = d => pares(d).reduce((v, [id, n]) => v + (grupos(id, indice).some(g => faltan.includes(g)) ? n : 0), 0);
  const dominante = d => { const g = sumarPorGrupo({}, pares(d), indice); return Object.keys(g).sort((a, b) => g[b] - g[a])[0] || 'otro'; };
  const fechas = mover.map(d => d.fecha), fijas = new Map(plan.dias.filter(d => entrena(d) && !mover.includes(d)).map(d => [d.fecha, dominante(d)]));
  const restantes = [...mover].sort((a, b) => valor(b) - valor(a) || (a.fecha < b.fecha ? -1 : 1));
  const asignadas = new Map();
  for (const f of fechas) {
    const antes = asignadas.get(sumarDias(f, -1)) ? dominante(asignadas.get(sumarDias(f, -1))) : fijas.get(sumarDias(f, -1));
    const despues = fijas.get(sumarDias(f, 1));
    const d = restantes.find(x => dominante(x) !== antes && dominante(x) !== despues) || restantes[0];
    asignadas.set(f, d); restantes.splice(restantes.indexOf(d), 1);
  }
  if ([...asignadas].every(([f, d]) => d.fecha === f)) return { error: 'Esta semana ya parte por lo que faltó.' };
  const nuevo = structuredClone(plan), porFecha = new Map(plan.dias.map((d, i) => [d, i]));
  for (const [f, d] of asignadas) nuevo.dias[porFecha.get(d)].fecha = f;
  nuevo.dias.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const avisos = [...new Set([...asignadas].filter(([f, d]) => d.fecha !== f)
    .flatMap(([f]) => conflictos(nuevo, f, nuevo.dias.find(x => x.fecha === f)?.plantilla, nuevo.dias.find(x => x.fecha === f))))];
  const vista = nuevo.dias.filter(d => d.semana === semana && entrena(d))
    .map(d => { const de = [...asignadas].find(([f]) => f === d.fecha)?.[1]; return { fecha: d.fecha, foco: d.foco, cambio: de && de.fecha !== d.fecha ? `antes el ${diaCorto(de.fecha)}` : '' }; });
  return { plan: nuevo, semana: vista, avisos };
}

/**
 * Repite la semana `n` en la semana siguiente (mismos días, ejercicios y series; cada peso, el que el plan ya tenía al
 * día para la próxima vez) y corre 7 días todo lo que seguía, descarga incluida. Solo si esa semana no empezó.
 */
export function repetirSemana(plan, { semana: n, hechas = [], hoy }) {
  const sig = n + 1, deSig = plan.dias.filter(d => d.semana === sig && entrena(d));
  if (!plan.dias.some(d => d.semana === n && entrena(d)) || !deSig.length) return { error: 'Tu plan cambió desde esa propuesta.' };
  if (deSig.some(d => d.fecha < hoy || hechas.includes(d.fecha))) return { error: 'Esta semana ya empezó: repetir la anterior correría lo que ya hiciste.' };
  if ((plan.semanas || 0) >= MAX_SEMANAS) return { error: `El bloque ya tiene ${MAX_SEMANAS} semanas, el máximo.` };
  const nuevo = structuredClone(plan);
  for (const d of nuevo.dias) if (d.semana >= sig) { d.semana += 1; d.fecha = sumarDias(d.fecha, 7); }
  const copia = structuredClone(plan.dias.filter(d => d.semana === n)).map(d => ({ ...d, semana: sig, fecha: sumarDias(d.fecha, 7) }));
  for (const d of copia) for (const e of d.ejercicios || []) {
    const proxima = nuevo.dias.filter(x => x.fecha > d.fecha).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .flatMap(x => x.ejercicios || []).find(x => x.ejercicio_id === e.ejercicio_id);
    if (proxima?.carga_kg != null) e.carga_kg = proxima.carga_kg;
  }
  nuevo.dias = [...nuevo.dias, ...copia].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  if (nuevo.semana_descarga >= sig) nuevo.semana_descarga += 1;
  nuevo.semanas = (plan.semanas || 0) + 1;
  if (nuevo.justificacion) {
    nuevo.justificacion = nuevo.justificacion.replace(/^Plan de \d+ semanas/, `Plan de ${nuevo.semanas} semanas`)
      .replace(/La semana \d+ es de descarga[^.]*\./, `La semana ${nuevo.semana_descarga} es de descarga: se corrió porque la semana ${n} quedó a medias.`);
  }
  const desde = lunesDe(copia.find(entrena)?.fecha || sumarDias(plan.inicio, n * 7));
  const descarga = nuevo.dias.filter(d => d.semana === nuevo.semana_descarga).map(d => d.fecha).sort()[0] || null;
  return { plan: nuevo, desde, descarga, semana: copia.filter(entrena).map(d => ({ fecha: d.fecha, foco: d.foco, cambio: d.firme === false ? 'Opcional' : '' })) };
}

/** Esta semana pasa a ser la descarga (nucleo/ciclos.js: adelantarDescarga): mismos ejercicios y pesos, menos series. */
export function descargaEstaSemana(plan, { semana, porque }) {
  if (!plan.semana_descarga || semana >= plan.semana_descarga || !plan.dias.some(d => d.semana === semana && entrena(d))) return { error: 'Tu plan cambió desde esa propuesta: esta semana ya no puede ser la descarga.' };
  const nuevo = adelantarDescarga(plan, semana, porque);
  const antes = new Map(plan.dias.filter(d => d.semana === semana).map(d => [d.fecha, d]));
  const vista = nuevo.dias.filter(d => d.semana === semana && entrena(d)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .map(d => ({ fecha: d.fecha, foco: d.foco, cambio: `${seriesDe(d)} series en vez de ${seriesDe(antes.get(d.fecha))}, con 2 más de reserva` }));
  return { plan: nuevo, semana: vista };
}

/** Los cambios que el coach ofrece por una semana a medias (nucleo/coach.js los delega aquí). */
export const CAMBIOS_SEMANA_A_MEDIAS = new Set(['menos_dias', 'primero_lo_que_falto', 'repetir_semana', 'descarga_esta_semana']);
/** El botón que confirma cada uno en la vista previa. */
export const confirmarSemanaAMedias = accion => ({ menos_dias: `Sí, pasar a ${accion.dias} días`, primero_lo_que_falto: 'Sí, reordenar la semana', repetir_semana: 'Sí, repetir la semana', descarga_esta_semana: 'Sí, descarga esta semana' })[accion.tipo];

/**
 * El cambio sobre una copia del plan, con lo que se pregunta (propone) y lo que se dice al aplicarlo (hecho), como
 * nucleo/coach.js: calcularCambio. Lleva la firma del plan con que se calculó la propuesta: si cambió, no se aplica.
 */
export function cambioSemanaAMedias(accion, { plan, hoy, indice, respuestas = {}, hechas = [] }) {
  if (accion.firma && accion.firma !== firmaPlan(plan)) return { error: 'Tu plan cambió desde esa propuesta: si todavía la quieres, pídemela de nuevo en el chat.' };
  const semana = Number(accion.semana);
  // Un botón de una semana que ya pasó: mostraba "desde esta semana" con fechas de la semana anterior.
  if (accion.tipo !== 'repetir_semana' && semana < semanaDeFecha(plan, hoy)) return { error: 'Esa propuesta era para una semana que ya pasó. Si quieres cambiar algo, dímelo ahora.' };
  if (accion.tipo === 'menos_dias') {
    const r = pasarADias(plan, { semana, dias: Number(accion.dias), faltan: accion.faltan || [], prioridad: respuestas.musculos_prioridad || [], hechas, hoy, indice });
    if (r.error) return r;
    const pasa = r.opcionales.length === 1 ? 'pasa' : 'pasan';
    return {
      plan: r.plan, ir: 'semana', semana: r.semana,
      propone: `Desde esta semana irías con ${accion.dias} sesiones firmes: ${lista(r.firmes)}. ${lista(r.opcionales)} ${pasa} a opcional hasta el final del bloque: si te sobra un día, la haces.`,
      hecho: `Listo: desde esta semana vas con ${accion.dias} sesiones firmes, y ${lista(r.opcionales)} ${r.opcionales.length === 1 ? 'queda' : 'quedan'} como opcional.`,
    };
  }
  if (accion.tipo === 'primero_lo_que_falto') {
    const r = primeroLoQueFalto(plan, { semana, faltan: accion.faltan || [], hechas, hoy, indice });
    if (r.error) return r;
    return {
      plan: r.plan, ir: 'semana', semana: r.semana,
      propone: `Esta semana partirías por lo que faltó, en los mismos días y sin sumar sesiones: si no alcanzas a todo, lo que queda fuera es lo que ya hiciste la semana pasada.${r.avisos.length ? ` Ojo: ${r.avisos.join(' ')}` : ''}`,
      hecho: 'Listo: esta semana partes por lo que faltó.',
    };
  }
  if (accion.tipo === 'repetir_semana') {
    const r = repetirSemana(plan, { semana, hechas, hoy });
    if (r.error) return r;
    const descarga = r.descarga ? `: la descarga pasa a la semana del ${diaCorto(lunesDe(r.descarga))}` : '';
    return {
      plan: r.plan, ir: 'semana', semana: r.semana,
      propone: `Esta semana repetirías la semana ${semana}, con los pesos al día, y el resto del bloque se corre 7 días${descarga}.`,
      hecho: `Listo: esta semana repites la semana ${semana}${descarga}.`,
    };
  }
  if (accion.tipo === 'descarga_esta_semana') {
    const r = descargaEstaSemana(plan, { semana, porque: 'la semana anterior quedó a medias y venías cansado' });
    if (r.error) return r;
    const fin = r.semana.at(-1)?.fecha;
    return {
      plan: r.plan, ir: 'semana', semana: r.semana,
      propone: `Esta semana sería de descarga: los mismos ejercicios y pesos, la mitad de las series y 2 repeticiones más de reserva. El bloque terminaría ${fin ? `el ${diaCorto(fin)}` : 'esta semana'} y después armas el siguiente.`,
      hecho: `Listo: esta semana es de descarga${fin ? ` y el bloque termina el ${diaCorto(fin)}` : ''}.`,
    };
  }
  return { error: 'No sé hacer ese cambio.' };
}

/**
 * La semana del bloque que terminó, si quedó a medias: qué faltó, por qué y qué conviene. null si salió bien, si la
 * persona ya dijo "Seguir igual", si es la descarga o si el plan no va por bloques.
 * @param o.hechas fechas del plan ya hechas (para no mover ni repetir lo de esta semana que ya se hizo)
 * @param o.descartadas {clave: true} lo que dejó pasar
 * @returns {{semana, clave, ofrecer, pendientes, recomendada, texto, opciones}} ofrecer: false mientras falte decir
 *   qué pasó con alguna sesión de esa semana (la pregunta de sesiones sin registro va primero)
 */
export function semanaAMedias({ plan, sesiones = [], bienestar = {}, marcas = {}, hoy, indice, respuestas = {}, hechas = [], descartadas = {} }) {
  if (!Array.isArray(plan?.dias) || !plan.dias.length || !plan.semana_descarga || !plan.inicio || plan.libre || plan.bloqueado || plan.objetivo === 'importado') return null;
  const actual = semanaDeFecha(plan, hoy), n = actual - 1;
  if (!(n >= 1) || n >= plan.semana_descarga || !plan.dias.some(d => d.semana === actual && entrena(d))) return null;
  const clave = `medias|${plan.inicio}|${n}`;
  if (descartadas[clave]) return null;
  const act = cumplimiento(plan, sesiones, n, { hoy, marcas, indice });
  if (!act || !act.series.plan || act.series.hechas / act.series.plan >= A_MEDIAS) return null;
  const parte = act.series.hechas / act.series.plan;
  const prev = n > 1 ? cumplimiento(plan, sesiones, n - 1, { hoy, marcas, indice }) : null;
  const parteAntes = prev?.series.plan ? prev.series.hechas / prev.series.plan : null;
  const cansancio = senalesCansancio(bienestar, act.desde, act.hasta);
  const patron = parteAntes != null && parteAntes < A_MEDIAS;
  const crecio = parteAntes != null && parteAntes >= 0.9 && (act.series.plan >= prev.series.plan * CRECIO || act.sesiones.plan > prev.sesiones.plan);
  const faltan = act.grupos.filter(g => g.plan >= 6 && g.hechas / g.plan < FALTO).sort((a, b) => b.plan - a.plan);
  const cubiertos = act.grupos.filter(g => g.plan >= 6 && g.hechas / g.plan >= CUBIERTO);
  const desparejo = faltan.length > 0 && cubiertos.length > 0;

  // Lo que se puede hacer con esta semana.
  const estaSemana = plan.dias.filter(d => d.semana === actual && esFirme(d));
  const dias = Math.max(2, Math.min(estaSemana.length - 1, Math.max(crecio ? prev.sesiones.plan : 0, Math.round(act.sesiones.parte)) || estaSemana.length - 1));
  const firma = firmaPlan(plan), prioridad = respuestas.musculos_prioridad || [];
  const opciones = {
    menos_dias: dias < estaSemana.length && !pasarADias(plan, { semana: actual, dias, faltan: faltan.map(g => g.grupo), prioridad, hechas, hoy, indice }).error
      && { etiqueta: `Pasar a ${dias} días`, accion: { tipo: 'menos_dias', semana: actual, dias, faltan: faltan.map(g => g.grupo), firma } },
    primero: faltan.length > 0 && !primeroLoQueFalto(plan, { semana: actual, faltan: faltan.map(g => g.grupo), hechas, hoy, indice }).error
      && { etiqueta: 'Primero lo que faltó', accion: { tipo: 'primero_lo_que_falto', semana: actual, faltan: faltan.map(g => g.grupo), firma } },
    repetir: !repetirSemana(plan, { semana: n, hechas, hoy }).error
      && { etiqueta: 'Repetir la semana', accion: { tipo: 'repetir_semana', semana: n, firma } },
    descarga: cansancio.length > 0 && !descargaEstaSemana(plan, { semana: actual }).error
      && { etiqueta: 'Descarga esta semana', accion: { tipo: 'descarga_esta_semana', semana: actual, firma } },
  };
  const recomendada = (cansancio.length && opciones.descarga) ? 'descarga'
    : ((crecio || patron) && opciones.menos_dias) ? 'menos_dias'
      : (desparejo && opciones.primero) ? 'primero'
        : (parte < MUCHO && opciones.repetir) ? 'repetir'
          : opciones.primero ? 'primero' : 'seguir';

  // El porqué, con sus cifras.
  const hizo = act.sesiones.completas + (act.sesiones.aMedias ? ` de ${act.sesiones.plan} sesiones firmes y ${act.sesiones.aMedias === 1 ? 'una' : act.sesiones.aMedias} a medias` : ` de ${act.sesiones.plan} sesiones firmes`);
  const grupoTexto = g => `${NOMBRE_GRUPO[g.grupo]} (${g.hechas} de ${g.plan} series)`;
  const sueno = (() => { const xs = Object.entries(bienestar).filter(([f]) => f >= act.desde && f <= act.hasta).map(([, v]) => Number(v?.sueno_horas)).filter(x => x > 0); return xs.length ? Math.min(...xs) === Math.max(...xs) ? `${coma(xs[0])} horas` : `${coma(Math.min(...xs))} a ${coma(Math.max(...xs))} horas` : null; })();
  const porque = cansancio.length ? `Esa semana ${lista(cansancio)}: el cuerpo pide descansar antes de seguir subiendo.`
    : crecio ? `No parece cansancio${sueno ? ` (dormiste ${sueno})` : ''}: el plan pasó de ${prev.sesiones.plan} a ${act.sesiones.plan} sesiones firmes y de ${prev.series.plan} a ${act.series.plan} series, más de lo que te cupo.`
      : patron ? 'Es la segunda semana seguida a medias: el plan pide más días de los que tienes.' : '';
  const propuesta = {
    menos_dias: opciones.menos_dias && (() => {
      const r = pasarADias(plan, { semana: actual, dias, faltan: faltan.map(g => g.grupo), prioridad, hechas, hoy, indice });
      return `Te propongo pasar a ${dias} días: ${lista(r.firmes)} quedan firmes, y ${lista(r.opcionales)} ${r.opcionales.length === 1 ? 'pasa' : 'pasan'} a opcional hasta el final del bloque (si te sobra un día, la haces).`;
    })(),
    primero: 'Te propongo partir esta semana por lo que faltó, sin sumar sesiones: si no alcanzas a todo, lo que queda fuera es lo que ya hiciste la semana pasada.',
    repetir: opciones.repetir && (() => {
      const r = repetirSemana(plan, { semana: n, hechas, hoy });
      return `Te propongo repetir la semana ${n} con los pesos al día y correr 7 días el resto del bloque${r.descarga ? `: la descarga pasa a la semana del ${diaCorto(lunesDe(r.descarga))}` : ''}.`;
    })(),
    descarga: 'Te propongo que esta semana sea de descarga: los mismos ejercicios y pesos, la mitad de las series y 2 repeticiones más de reserva.',
    seguir: 'Te propongo seguir con el plan tal cual.',
  }[recomendada];
  const texto = [
    `La semana ${n} quedó a medias: hiciste ${hizo} (${act.series.hechas} de ${act.series.plan} series).${faltan.length ? ` Lo que más faltó: ${lista(faltan.map(grupoTexto))}${cubiertos.length ? `; ${lista(cubiertos.map(g => NOMBRE_GRUPO[g.grupo]))} ${cubiertos.length === 1 ? 'quedó cubierto' : 'quedaron cubiertos'}` : ''}.` : ''}`,
    porque,
    propuesta,
    'Una semana a medias no te hace perder fuerza ni músculo: no sumes lo que faltó a esta semana, y lo que no hiciste mantiene su peso.',
  ].filter(Boolean).join('\n\n');
  const orden = [recomendada, 'menos_dias', 'primero', 'repetir', 'descarga'].filter((k, i, a) => a.indexOf(k) === i && opciones[k]);
  return {
    semana: n, clave, recomendada, texto, ofrecer: act.pendientes.length === 0, pendientes: act.pendientes,
    opciones: [...orden.slice(0, 3).map(k => opciones[k]), { etiqueta: 'Seguir igual', accion: { tipo: 'semana_a_medias_no', clave } }],
  };
}
