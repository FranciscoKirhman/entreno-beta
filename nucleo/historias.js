// Historias de la semana, el mes y el año, como las de Instagram y el resumen anual de Spotify (fase 3 del plan del 28
// de octubre de 2026). Cada historia es una lista de pantallas con una idea cada una: constancia, lo que levantaste,
// récords, músculos, cómo rendiste, tu puntería de RIR y lo que viene, narradas por el coach con frases por reglas (sin
// IA, $0). Todo sale de lo guardado en el teléfono. Los pesos van como números: la app los escribe en kilos o libras
// (app/historias.js). Lo que se comparte (compartir) nunca lleva datos de salud: ni energía, ni ánimo, ni sueño.
import { esDeTrabajoGuardada } from './registro.js';
import { recordsPorSesion } from './records.js';
import { hechasPorMusculo, planeadasPorMusculo } from './volumen-semana.js';
import { rendimientoSesiones, segunComoLlegas, textoPct } from './rendimiento-sesion.js';
import { comprobaciones } from './comprobacion-rir.js';
import { sumarDias, diaSemana } from './agenda.js';
import { e1rm } from './motor-plan.js';

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const PRIORIDAD = ['peso', 'menos_ayuda', 'e1rm', 'reps_con_peso', 'reps_con_ayuda', 'reps', 'volumen', 'duracion'];
const lunesDe = f => sumarDias(f, -((diaSemana(f) + 6) % 7));
const finDeMes = mes => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
const mesAntes = mes => (mes.slice(5, 7) === '01' ? `${Number(mes.slice(0, 4)) - 1}-12` : `${mes.slice(0, 4)}-${String(Number(mes.slice(5, 7)) - 1).padStart(2, '0')}`);
const nombreMes = mes => MESES[Number(mes.slice(5, 7)) - 1];
const diaCorto = f => `${DIAS[diaSemana(f)]} ${Number(f.slice(8))}`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const r1 = x => Math.round(x * 10) / 10;

/** "20 al 26 de octubre" o "27 de octubre al 2 de noviembre". */
export function rangoTexto(desde, hasta) {
  const mismo = desde.slice(5, 7) === hasta.slice(5, 7);
  return `${Number(desde.slice(8))}${mismo ? '' : ` de ${MESES[Number(desde.slice(5, 7)) - 1]}`} al ${Number(hasta.slice(8))} de ${MESES[Number(hasta.slice(5, 7)) - 1]}`;
}

/** "45 minutos" o "4 horas y 10 minutos". */
export function tiempoTexto(minutos) {
  const h = Math.floor(minutos / 60), m = Math.round(minutos % 60);
  if (!h) return plural(m, 'minuto', 'minutos');
  return `${plural(h, 'hora', 'horas')}${m ? ` y ${plural(m, 'minuto', 'minutos')}` : ''}`;
}

/** Lo hecho entre dos fechas: sesiones con series de trabajo, días, minutos, series, volumen y récords. */
function cifrasDe(sesiones, desde, hasta, { asistidos, records }) {
  const xs = sesiones.filter(s => s.fecha >= desde && s.fecha <= hasta && (s.series || []).some(esDeTrabajoGuardada));
  const trabajo = xs.flatMap(s => (s.series || []).filter(esDeTrabajoGuardada).map(x => ({ ...x, fecha: s.fecha, hora: s.hora })));
  return {
    sesiones: xs, trabajo,
    dias: new Set(xs.map(s => s.fecha)).size,
    minutos: xs.reduce((a, s) => a + (Number(s.duracion_min) || 0), 0),
    series: trabajo.filter(x => x.reps != null || x.carga_kg != null).length,
    volumen: Math.round(trabajo.filter(x => !asistidos.has(x.ejercicio_id)).reduce((a, x) => a + (Number(x.carga_kg) || 0) * (Number(x.reps) || 0), 0)),
    records: xs.flatMap(s => (records.get(s.id || s.fecha) || []).map(r => ({ ...r, fecha: s.fecha }))),
  };
}

/** Los mejores récords, uno por ejercicio: más peso antes que el máximo estimado, y así. */
function mejoresRecords(records, n = 3) {
  const porEj = new Map();
  for (const r of records) {
    const actual = porEj.get(r.ejercicio_id);
    if (!actual || PRIORIDAD.indexOf(r.tipo) < PRIORIDAD.indexOf(actual.tipo)) porEj.set(r.ejercicio_id, r);
  }
  return [...porEj.values()].sort((a, b) => PRIORIDAD.indexOf(a.tipo) - PRIORIDAD.indexOf(b.tipo)).slice(0, n)
    .map(({ ejercicio_id, tipo, valor, antes = null, kg = null, fecha }) => ({ ejercicio_id, tipo, valor, antes, kg, fecha }));
}

/** Rendimiento del período (nucleo/rendimiento-sesion.js): el promedio pesado por series y el mejor día. */
function rendimiento(sesiones, desde, hasta, asistidos) {
  const r = rendimientoSesiones(sesiones, { desde, hasta, asistidos });
  if (!r.length) return null;
  const series = r.reduce((a, x) => a + x.series, 0);
  return { media: r1(r.reduce((a, x) => a + x.pct * x.series, 0) / series), n: r.length, mejor: r.reduce((a, x) => (x.pct > a.pct ? x : a)) };
}

/** El mejor máximo estimado de cada día, por ejercicio con peso (sin asistidos). */
function mejoresPorDia(trabajo, asistidos) {
  const out = new Map();
  for (const s of trabajo) {
    if (!s.ejercicio_id || asistidos.has(s.ejercicio_id) || !(Number(s.carga_kg) > 0) || !(Number(s.reps) > 0)) continue;
    const e = e1rm({ carga_kg: Number(s.carga_kg), reps: Number(s.reps), rir: s.tipo === 'fallo' ? 0 : s.rir ?? null, rpe: s.rpe ?? null });
    const dias = out.get(s.ejercicio_id) || out.set(s.ejercicio_id, new Map()).get(s.ejercicio_id);
    dias.set(s.fecha, Math.max(dias.get(s.fecha) || 0, e));
  }
  return out;
}

/**
 * Cuánto subió la fuerza de los ejercicios más hechos: el máximo estimado del primer día contra el del último (o del
 * primer mes contra el último, en el año). Solo los que se hicieron al menos 2 veces.
 * @returns [{ejercicio_id, veces, desde, hasta, cambio}] cambio en %, de los 3 más hechos
 */
function fuerzaDe(trabajo, asistidos, { porMes = false } = {}) {
  const out = [];
  for (const [id, dias] of mejoresPorDia(trabajo, asistidos)) {
    const fechas = [...dias.keys()].sort();
    if (fechas.length < 2) continue;
    const grupo = f => (porMes ? f.slice(0, 7) : f);
    const primero = grupo(fechas[0]), ultimo = grupo(fechas.at(-1));
    if (primero === ultimo) continue;
    const mejorDe = g => Math.max(...fechas.filter(f => grupo(f) === g).map(f => dias.get(f)));
    const desde = mejorDe(primero), hasta = mejorDe(ultimo);
    out.push({ ejercicio_id: id, veces: fechas.length, desde: r1(desde), hasta: r1(hasta), cambio: Math.round((hasta / desde - 1) * 100) });
  }
  return out.sort((a, b) => b.veces - a.veces || b.cambio - a.cambio).slice(0, 3);
}

/** Semanas seguidas con al menos un día entrenado, la racha más larga entre esas fechas. */
function rachaMasLarga(fechas) {
  const semanas = [...new Set(fechas.map(lunesDe))].sort();
  let mejor = 0, actual = 0, antes = null;
  for (const l of semanas) { actual = antes && sumarDias(antes, 7) === l ? actual + 1 : 1; mejor = Math.max(mejor, actual); antes = l; }
  return mejor;
}

/** Músculos con lo hecho (valor) y la referencia (meta: el plan, o el período anterior), los 6 con más series. */
function barrasMusculos(hechas, meta) {
  return [...new Set([...Object.keys(meta), ...Object.keys(hechas)])]
    .map(m => ({ musculo: m, valor: r1(hechas[m] || 0), meta: r1(meta[m] || 0) }))
    .filter(x => x.valor > 0 || x.meta > 0)
    .sort((a, b) => b.valor - a.valor || b.meta - a.meta).slice(0, 6);
}

/** Cómo rendiste y lo que dicen juntos energía y rendimiento en las 8 semanas anteriores (nucleo/rendimiento-sesion.js). */
function pantallaRindes(sesiones, desde, hasta, { bienestar, asistidos, etiqueta, conMes = false }) {
  const r = rendimiento(sesiones, desde, hasta, asistidos);
  if (!r) return null;
  const lectura = rendimientoSesiones(sesiones, { desde: sumarDias(hasta, -55), hasta, asistidos });
  const dicho = segunComoLlegas(lectura, bienestar, 'energia').texto;
  const conEnergiaBaja = Number(bienestar?.[r.mejor.fecha]?.cansancio) >= 4;
  return {
    id: 'rindes', forma: 'cifra', tema: 'morado', pose: 'animo', etiqueta,
    cifra: { valor: r.media, unidad: 'pct' }, texto: 'contra lo habitual',
    detalle: `En ${plural(r.n, 'sesión medida', 'sesiones medidas')}. Tu mejor día fue el ${diaCorto(r.mejor.fecha)}${conMes ? ` de ${nombreMes(r.mejor.fecha)}` : ''}: ${textoPct(r.mejor.pct)}${conEnergiaBaja ? ', y ese día llegaste con poca energía' : ''}.`,
    nota: dicho,
    frase: r.media >= 1 ? 'Rendiste sobre lo habitual: el trabajo se está notando.' : r.media >= -1 ? 'Rendiste como siempre. Sostenerlo también es avanzar.' : 'Un poco bajo lo habitual: la fatiga también cuenta, y se recupera.',
  };
}

/** La puntería de RIR del período (nucleo/comprobacion-rir.js), si hubo serie de comprobación. */
function pantallaPunteria(sesiones) {
  const c = comprobaciones(sesiones).at(-1);
  if (!c) return null;
  const d = c.diferencia;
  return {
    id: 'punteria', forma: 'cifra', tema: 'turquesa', pose: 'pensando', etiqueta: 'Tu puntería de RIR',
    cifra: { valor: d, unidad: 'dif' }, texto: d === 0 ? 'puntería exacta' : d > 0 ? `${d === 1 ? 'repetición más' : 'repeticiones más'} de las que creías` : `${d === -1 ? 'repetición menos' : 'repeticiones menos'} de las que creías`,
    detalle: `En tu serie de comprobación creíste que salían ${c.predichas} y salieron ${c.reales}.`,
    frase: d >= 3 ? 'Te queda más de lo que anotas: por eso la app te sube el peso más rápido.' : d >= -1 ? 'Tu reserva anotada es confiable. Así el plan acierta.' : 'Llegas antes de lo que crees: deja una repetición más por si acaso.',
  };
}

/** Récords del período: en cuántos ejercicios y los 3 mejores (la app los escribe con app/resumen.js: textoRecord). */
function pantallaRecords(c, etiqueta) {
  const top = mejoresRecords(c.records);
  if (!top.length) return null;
  const n = new Set(c.records.map(r => r.ejercicio_id)).size;
  return { id: 'records', forma: 'records', tema: 'oro', pose: 'celebra', etiqueta, cifra: { valor: n, texto: n === 1 ? 'ejercicio con récord' : 'ejercicios con récord' }, records: top,
    frase: n >= 3 ? 'Eso es progreso de verdad, y quedó anotado.' : 'Cada récord es una prueba de que el plan funciona.' };
}

/** Lo que se comparte: cifras, récords y los ejercicios con más series. Sin datos de salud. */
function paraCompartir(titulo, periodo, c) {
  const series = new Map();
  for (const s of c.trabajo) if (s.ejercicio_id) series.set(s.ejercicio_id, (series.get(s.ejercicio_id) || 0) + 1);
  return {
    titulo, periodo, dias: c.dias, sesiones: c.sesiones.length, minutos: c.minutos, volumen: c.volumen, series: c.series,
    records: mejoresRecords(c.records), nRecords: new Set(c.records.map(r => r.ejercicio_id)).size,
    ejercicios: [...series.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ejercicio_id, n]) => ({ ejercicio_id, series: n })),
  };
}

/** La clave de una historia, la misma que su id: 'semana|2026-10-19', 'mes|2026-10' o 'año|2026'. */
export const idHistoria = x => `${x.tipo}|${x.lunes || x.mes || x.anio}`;

/**
 * La historia de una semana (lunes a domingo). null si no se entrenó.
 * @param o.lunes  el lunes de la semana
 * @param o.hoy    para "lo que viene": de una semana pasada, lo que queda de la actual
 * @returns {{tipo, id, titulo, desde, hasta, pantallas, compartir}}
 */
export function historiaSemana({ sesiones = [], plan = null, bienestar = {}, indice, lunes, hoy = lunes, asistidos = new Set() }) {
  const desde = lunes, hasta = sumarDias(lunes, 6);
  const records = recordsPorSesion(sesiones, { asistidos });
  const c = cifrasDe(sesiones, desde, hasta, { asistidos, records });
  if (!c.sesiones.length) return null;
  const antes = cifrasDe(sesiones, sumarDias(desde, -7), sumarDias(desde, -1), { asistidos, records });
  const delPlan = (plan?.dias || []).filter(d => d.tipo !== 'descanso' && d.ejercicios?.length);
  const planeados = new Set(delPlan.filter(d => d.fecha >= desde && d.fecha <= hasta).map(d => d.fecha));
  const hechos = new Set(c.sesiones.map(s => s.fecha));
  const descarga = Boolean(plan?.semana_descarga) && delPlan.some(d => d.fecha >= desde && d.fecha <= hasta && d.semana === plan.semana_descarga);
  const n = hechos.size, p = planeados.size;
  const pantallas = [{
    id: 'portada', forma: 'portada', tema: 'naranjo', pose: 'saludo', etiqueta: 'Tu semana', titulo: rangoTexto(desde, hasta),
    cifra: { valor: n, texto: n === 1 ? 'día entrenado' : 'días entrenados' }, detalle: p ? `de ${p} que tenía tu plan` : null,
    dias: Array.from({ length: 7 }, (_, i) => { const f = sumarDias(desde, i); return { fecha: f, letra: LETRAS[i], hecho: hechos.has(f), planeado: planeados.has(f) }; }),
    frase: !p ? `Entrenaste ${plural(n, 'día', 'días')}. Cada uno suma.` : n >= p ? 'Cumpliste todo lo que tenía tu plan.' : n === p - 1 ? 'Te faltó un día y aun así sumaste.' : 'Cada día cuenta: la próxima vamos por más.',
  }];
  const cambio = antes.volumen > 0 ? Math.round((c.volumen / antes.volumen - 1) * 100) : null;
  pantallas.push({
    id: 'volumen', forma: 'cifra', tema: 'azul', pose: 'progreso', etiqueta: 'Lo que levantaste',
    cifra: { valor: c.volumen, unidad: 'peso' }, texto: 'entre peso y repeticiones',
    detalle: c.minutos ? `${plural(c.series, 'serie', 'series')} en ${tiempoTexto(c.minutos)}` : plural(c.series, 'serie', 'series'),
    comparacion: cambio == null ? null : { valor: cambio, texto: `${cambio > 0 ? '+' : cambio < 0 ? '−' : ''}${Math.abs(cambio)}% que la semana pasada` },
    frase: descarga ? 'Semana de descarga: menos a propósito, para llegar con todo al bloque siguiente.'
      : cambio == null ? 'Tu primera semana con registro: desde aquí se mide todo.'
        : cambio >= 5 ? 'Más que la semana pasada: así se progresa.' : cambio <= -10 ? 'Menos que la semana pasada. Si fue a propósito, perfecto: también se crece descansando.' : 'Parecido a la semana pasada: constancia pura.',
  });
  const recs = pantallaRecords(c, 'Récords de la semana');
  if (recs) pantallas.push(recs);
  const barras = barrasMusculos(hechasPorMusculo(c.trabajo, indice, desde, hasta), plan ? planeadasPorMusculo(plan, indice, desde, hasta) : {});
  if (barras.length) {
    const conMeta = barras.filter(b => b.meta > 0), llegaron = conMeta.filter(b => b.valor >= b.meta - 0.5).length;
    pantallas.push({ id: 'musculos', forma: 'barras', tema: 'verde', pose: 'explica', etiqueta: 'Tus músculos', titulo: 'Series de la semana', referencia: 'plan', leyenda: conMeta.length ? 'La marca es lo que pedía tu plan.' : null, barras,
      frase: !conMeta.length ? 'Así repartiste el trabajo esta semana.' : llegaron === conMeta.length ? 'Todos llegaron a lo que pedía tu plan.' : `${llegaron} de ${conMeta.length} llegaron a lo que pedía tu plan.` });
  }
  const rindes = pantallaRindes(sesiones, desde, hasta, { bienestar, asistidos, etiqueta: 'Cómo rendiste' });
  if (rindes) pantallas.push(rindes);
  const punteria = pantallaPunteria(c.sesiones);
  if (punteria) pantallas.push(punteria);
  // Lo que viene: la semana siguiente o, si esta ya pasó, lo que queda de la actual.
  const desdeProx = [sumarDias(hasta, 1), hoy].sort().at(-1), hastaProx = sumarDias(hasta, 7);
  const prox = delPlan.filter(d => d.fecha >= desdeProx && d.fecha <= hastaProx).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (prox.length) {
    const descargaProx = prox.some(d => d.semana === plan.semana_descarga);
    pantallas.push({ id: 'viene', forma: 'lista', tema: 'grafito', pose: 'calendario', etiqueta: 'Lo que viene',
      titulo: descargaProx ? 'Semana de descarga' : hasta < hoy ? 'Lo que queda de esta semana' : 'La semana que viene',
      items: prox.map(d => ({ titulo: d.foco || 'Sesión', detalle: diaCorto(d.fecha) })),
      frase: descargaProx ? 'Menos series y más reserva: llegas con energía al bloque siguiente.' : `${plural(prox.length, 'sesión', 'sesiones')}. Vamos con todo.` });
  } else if (delPlan.length && !plan.libre && delPlan.every(d => d.fecha <= hasta)) {
    pantallas.push({ id: 'viene', forma: 'lista', tema: 'grafito', pose: 'calendario', etiqueta: 'Lo que viene', titulo: 'Tu bloque terminó', items: [],
      frase: 'Arma el siguiente desde Entrenar: parte con los pesos que de verdad levantas.' });
  }
  pantallas.push({ id: 'cierre', forma: 'cierre', tema: 'naranjo', pose: 'celebra', etiqueta: 'Tu semana', titulo: 'Esa fue tu semana',
    frase: n >= Math.max(1, p) ? 'Nos vemos el lunes. Lo hiciste muy bien.' : 'Nos vemos el lunes. Cada semana se construye sobre la anterior.' });
  return { tipo: 'semana', id: `semana|${desde}`, titulo: 'Tu semana', desde, hasta, pantallas, compartir: paraCompartir('Mi semana', rangoTexto(desde, hasta), c) };
}

/**
 * Una meta concreta para el mes siguiente, por reglas: más días por semana si quedó bajo el plan, el músculo que quedó
 * más bajo su franja (la app escribe su nombre) o seguir igual.
 * @returns {{tipo: 'dias' | 'musculo' | 'seguir', texto?, musculo?, series?}}
 */
function metaSiguiente({ c, semanasMes, plan, desde, hasta, indice, rango }) {
  const porSemana = c.dias / semanasMes;
  const delPlan = (plan?.dias || []).filter(d => d.tipo !== 'descanso' && d.ejercicios?.length && d.fecha >= desde && d.fecha <= hasta);
  const planSemana = delPlan.length / semanasMes;
  if (planSemana && porSemana < planSemana - 0.5) return { tipo: 'dias', texto: `Sumar un día por semana: vas en ${String(r1(porSemana)).replace('.', ',')} y tu plan tiene ${Math.round(planSemana)}.` };
  if (rango) {
    const hechas = hechasPorMusculo(c.trabajo, indice, desde, hasta);
    const bajo = ['gluteo', 'cuadriceps', 'femoral', 'espalda', 'pecho', 'hombro', 'biceps', 'triceps'].map(m => [m, (hechas[m] || 0) / semanasMes]).filter(([, v]) => v < rango[0]).sort((a, b) => a[1] - b[1])[0];
    if (bajo) return { tipo: 'musculo', musculo: bajo[0], series: rango[0] };
  }
  return { tipo: 'seguir', texto: 'Mantener la constancia y buscar un récord cada semana.' };
}

/**
 * La historia de un mes ('AAAA-MM'). null si no se entrenó.
 * @param o.rango [mínimo, máximo] de series por semana de su nivel (derivados.series_rango), para la meta
 */
export function historiaMes({ sesiones = [], plan = null, bienestar = {}, indice, mes, asistidos = new Set(), rango = null }) {
  const desde = `${mes}-01`, hasta = finDeMes(mes), previo = mesAntes(mes);
  const records = recordsPorSesion(sesiones, { asistidos });
  const c = cifrasDe(sesiones, desde, hasta, { asistidos, records });
  if (!c.sesiones.length) return null;
  const antes = cifrasDe(sesiones, `${previo}-01`, finDeMes(previo), { asistidos, records });
  const nombre = nombreMes(mes), largo = Number(hasta.slice(8)), semanasMes = largo / 7;
  const hechos = new Set(c.sesiones.map(s => s.fecha));
  const pantallas = [{
    id: 'portada', forma: 'portada', tema: 'naranjo', pose: 'calendario', etiqueta: `Tu ${nombre}`, titulo: mes.slice(0, 4),
    cifra: { valor: c.dias, texto: c.dias === 1 ? 'día entrenado' : 'días entrenados' },
    detalle: `${plural(c.sesiones.length, 'sesión', 'sesiones')}${c.minutos ? `, ${tiempoTexto(c.minutos)}` : ''}`,
    calendario: { primero: (diaSemana(desde) + 6) % 7, dias: Array.from({ length: largo }, (_, i) => { const f = sumarDias(desde, i); return { fecha: f, dia: i + 1, hecho: hechos.has(f) }; }) },
    frase: `Un promedio de ${String(r1(c.dias / semanasMes)).replace('.', ',')} días por semana.`,
  }];
  const cambio = antes.volumen > 0 ? Math.round((c.volumen / antes.volumen - 1) * 100) : null;
  pantallas.push({ id: 'volumen', forma: 'cifra', tema: 'azul', pose: 'progreso', etiqueta: 'Lo que levantaste',
    cifra: { valor: c.volumen, unidad: 'peso' }, texto: 'entre peso y repeticiones', detalle: plural(c.series, 'serie', 'series'),
    comparacion: cambio == null ? null : { valor: cambio, texto: `${cambio > 0 ? '+' : cambio < 0 ? '−' : ''}${Math.abs(cambio)}% que ${nombreMes(previo)}` },
    frase: cambio == null ? 'Tu primer mes con registro: desde aquí se mide todo.' : cambio >= 5 ? `Más que en ${nombreMes(previo)}: así se progresa.` : cambio <= -10 ? `Menos que en ${nombreMes(previo)}. Los meses también tienen ritmo.` : 'Parecido al mes anterior: constancia pura.' });
  const recs = pantallaRecords(c, `Récords de ${nombre}`);
  if (recs) pantallas.push(recs);
  const fuerza = fuerzaDe(c.trabajo, asistidos);
  if (fuerza.length) {
    const mejor = fuerza.reduce((a, x) => (x.cambio > a.cambio ? x : a));
    pantallas.push({ id: 'fuerza', forma: 'fuerza', tema: 'rojo', pose: 'progreso', etiqueta: 'Tu fuerza', titulo: 'Máximo estimado, del primer día al último', items: fuerza,
      destacado: mejor.cambio > 0 ? mejor.ejercicio_id : null, frase: mejor.cambio > 0 ? 'Más fuerza con el mismo esfuerzo: eso es progresar.' : 'Fuerza sostenida. Los meses de base también construyen.' });
  }
  const barras = barrasMusculos(hechasPorMusculo(c.trabajo, indice, desde, hasta), hechasPorMusculo(antes.trabajo, indice, `${previo}-01`, finDeMes(previo)));
  if (barras.length) {
    pantallas.push({ id: 'musculos', forma: 'barras', tema: 'verde', pose: 'explica', etiqueta: 'Tus músculos', titulo: `Series de ${nombre}`, referencia: 'anterior', leyenda: antes.sesiones.length ? `La marca es ${nombreMes(previo)}.` : null,
      barras: antes.sesiones.length ? barras : barras.map(b => ({ ...b, meta: 0 })), frase: 'Así repartiste el trabajo en el mes.' });
  }
  const rindes = pantallaRindes(sesiones, desde, hasta, { bienestar, asistidos, etiqueta: 'Cómo rendiste' });
  if (rindes) pantallas.push(rindes);
  const punteria = pantallaPunteria(c.sesiones);
  if (punteria) pantallas.push(punteria);
  const meta = metaSiguiente({ c, semanasMes, plan, desde, hasta, indice, rango });
  pantallas.push({ id: 'meta', forma: 'meta', tema: 'grafito', pose: 'pregunta', etiqueta: `Para ${nombreMes(sumarDias(hasta, 1).slice(0, 7))}`, titulo: 'Tu meta', meta,
    frase: 'Una sola meta, clara: así se cumple.' });
  pantallas.push({ id: 'cierre', forma: 'cierre', tema: 'naranjo', pose: 'celebra', etiqueta: `Tu ${nombre}`, titulo: `Ese fue tu ${nombre}`, frase: 'Gracias por entrenar conmigo. Vamos por el próximo.' });
  return { tipo: 'mes', id: `mes|${mes}`, titulo: `Tu ${nombre}`, desde, hasta, pantallas, compartir: paraCompartir(`Mi ${nombre}`, mes.slice(0, 4), c) };
}

// Cómo entrenas, en pocas palabras: lo que más se nota en el año. Nombres que no suponen género. Las insignias son
// app/img/historias/<id>.webp (herramientas/prompts-imagenes.mjs, HI01); mientras no estén, un ícono.
export const PERSONALIDADES = {
  constante: { nombre: 'Constante', texto: 'Casi no faltaste: semana tras semana, ahí estabas.' },
  records: { nombre: 'Récord tras récord', texto: 'Los récords no pararon: este año fueron uno tras otro.' },
  preciso: { nombre: 'Puntería fina', texto: 'Sabes cuánto te queda: tu reserva anotada acierta.' },
  madrugador: { nombre: 'De madrugada', texto: 'Entrenas antes de que el día parta.' },
  nocturno: { nombre: 'De noche', texto: 'Cuando el resto descansa, tú entrenas.' },
  incansable: { nombre: 'Incansable', texto: 'Mucho trabajo en cada sesión, y lo sostienes.' },
};

/** La personalidad del año: la señal más fuerte, de 0 a 1. */
export function personalidad({ c, records, comprobadas }) {
  const n = c.sesiones.length;
  if (!n) return null;
  const semanas = new Set(c.sesiones.map(s => lunesDe(s.fecha))).size;
  const fechas = c.sesiones.map(s => s.fecha).sort();
  const total = Math.max(1, Math.round((Date.parse(fechas.at(-1)) - Date.parse(lunesDe(fechas[0]))) / 864e5 / 7) + 1);
  const horas = c.sesiones.map(s => s.hora).filter(Boolean);
  const dif = comprobadas.length >= 2 ? Math.abs(comprobadas.slice(-3).reduce((a, x) => a + x.diferencia, 0) / Math.min(3, comprobadas.length)) : null;
  const puntos = {
    constante: semanas / total,
    records: Math.min(1, records / n),
    preciso: dif == null ? 0 : Math.max(0, 1 - dif / 3),
    madrugador: horas.length ? horas.filter(h => h < '09:00').length / horas.length : 0,
    nocturno: horas.length ? horas.filter(h => h >= '20:00').length / horas.length : 0,
    incansable: Math.min(1, c.series / n / 30),
  };
  // Con empate gana lo más distintivo: casi todos los que anotan son constantes, pocos entrenan siempre de madrugada.
  const id = ['records', 'preciso', 'madrugador', 'nocturno', 'incansable', 'constante'].reduce((a, k) => (puntos[k] > puntos[a] + 1e-9 ? k : a));
  return { id, ...PERSONALIDADES[id], puntos };
}

/** La historia de un año ("Tu año en Entreno"). null si no se entrenó. */
export function historiaAnio({ sesiones = [], bienestar = {}, indice, anio, asistidos = new Set() }) {
  const desde = `${anio}-01-01`, hasta = `${anio}-12-31`;
  const records = recordsPorSesion(sesiones, { asistidos });
  const c = cifrasDe(sesiones, desde, hasta, { asistidos, records });
  if (!c.sesiones.length) return null;
  const pantallas = [{
    id: 'portada', forma: 'portada', tema: 'naranjo', pose: 'celebra', etiqueta: `Tu ${anio} en Entreno`, titulo: 'Un año de entrenamiento',
    cifra: { valor: c.sesiones.length, texto: c.sesiones.length === 1 ? 'sesión' : 'sesiones' },
    detalle: `${plural(c.dias, 'día entrenado', 'días entrenados')}${c.minutos ? `, ${tiempoTexto(c.minutos)}` : ''}`,
    frase: 'Mira todo lo que hiciste este año.',
  }, {
    id: 'volumen', forma: 'cifra', tema: 'azul', pose: 'progreso', etiqueta: 'Lo que levantaste', cifra: { valor: c.volumen, unidad: 'peso' }, texto: 'en todo el año',
    detalle: `${plural(c.series, 'serie', 'series')}${c.records.length ? ` y récords en ${plural(new Set(c.records.map(r => r.ejercicio_id)).size, 'ejercicio', 'ejercicios')}` : ''}`,
    frase: 'Kilo a kilo, serie a serie.',
  }];
  const veces = new Map();
  for (const s of c.sesiones) for (const id of new Set((s.series || []).filter(esDeTrabajoGuardada).map(x => x.ejercicio_id).filter(Boolean))) veces.set(id, (veces.get(id) || 0) + 1);
  const top = [...veces.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ejercicio_id, n]) => ({ ejercicio_id, veces: n }));
  if (top.length) pantallas.push({ id: 'top', forma: 'ranking', tema: 'morado', pose: 'explica', etiqueta: 'Tus favoritos', titulo: 'Los 5 ejercicios que más hiciste', items: top, frase: 'Tu lista del año. ¿Los reconoces?' });
  const porMes = new Map();
  for (const s of c.sesiones) porMes.set(s.fecha.slice(0, 7), (porMes.get(s.fecha.slice(0, 7)) || 0) + 1);
  const [mesFuerte, nMes] = [...porMes.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  const racha = rachaMasLarga(c.sesiones.map(s => s.fecha));
  pantallas.push({ id: 'mes_fuerte', forma: 'cifra', tema: 'rojo', pose: 'animo', etiqueta: 'Tu mejor mes', cifra: { valor: nMes, texto: `sesiones en ${nombreMes(mesFuerte)}` },
    detalle: `Tu racha más larga: ${plural(racha, 'semana seguida', 'semanas seguidas')} entrenando.`, frase: racha >= 8 ? 'Esa racha es lo que de verdad cambia un cuerpo.' : 'El próximo año, vamos por una racha más larga.' });
  const fuerza = fuerzaDe(c.trabajo, asistidos, { porMes: true });
  if (fuerza.length) pantallas.push({ id: 'fuerza', forma: 'fuerza', tema: 'verde', pose: 'progreso', etiqueta: 'Tu fuerza', titulo: 'Máximo estimado, del primer mes al último', items: fuerza,
    destacado: fuerza.reduce((a, x) => (x.cambio > a.cambio ? x : a)).ejercicio_id, frase: 'Esto es lo que construiste.' });
  const rindes = pantallaRindes(sesiones, desde, hasta, { bienestar, asistidos, etiqueta: 'Cómo rendiste', conMes: true });
  if (rindes) pantallas.push(rindes);
  const p = personalidad({ c, records: new Set(c.records.map(r => `${r.ejercicio_id}|${r.fecha}`)).size, comprobadas: comprobaciones(c.sesiones) });
  pantallas.push({ id: 'personalidad', forma: 'personalidad', tema: 'turquesa', pose: 'celebra', etiqueta: 'Tu forma de entrenar', titulo: p.nombre, insignia: p.id, texto: p.texto, frase: 'Así entrenas. Sigue así.' });
  pantallas.push({ id: 'cierre', forma: 'cierre', tema: 'naranjo', pose: 'celebra', etiqueta: `Tu ${anio}`, titulo: `Ese fue tu ${anio}`, frase: 'Gracias por un año entrenando juntos. Lo mejor viene ahora.' });
  return { tipo: 'año', id: `año|${anio}`, titulo: `Tu ${anio}`, desde, hasta, pantallas, compartir: { ...paraCompartir(`Mi ${anio} en Entreno`, String(anio), c), personalidad: p.nombre } };
}

/**
 * Las historias que corresponden hoy: la semana (la pasada; o esta, si ya hiciste todo lo que tenía tu plan), el mes
 * pasado durante la primera semana del mes y el año desde el 15 de diciembre hasta fin de enero.
 * @returns [{tipo, lunes?, mes?, anio?}] lo necesario para armarlas
 */
export function historiasDeHoy({ sesiones: todas = [], plan = null, hoy }) {
  const sesiones = todas.filter(s => s.fecha <= hoy);
  const con = (desde, hasta) => sesiones.some(s => s.fecha >= desde && s.fecha <= hasta && (s.series || []).some(esDeTrabajoGuardada));
  const out = [];
  const lunes = lunesDe(hoy), domingo = sumarDias(lunes, 6);
  const faltan = (plan?.dias || []).some(d => d.tipo !== 'descanso' && d.ejercicios?.length && d.fecha >= lunes && d.fecha <= domingo && !sesiones.some(s => s.fecha === d.fecha));
  const planEsta = (plan?.dias || []).some(d => d.fecha >= lunes && d.fecha <= domingo && d.ejercicios?.length);
  if (planEsta && !faltan && con(lunes, domingo)) out.push({ tipo: 'semana', lunes });
  else if (con(sumarDias(lunes, -7), sumarDias(lunes, -1))) out.push({ tipo: 'semana', lunes: sumarDias(lunes, -7) });
  if (Number(hoy.slice(8)) <= 7) { const m = mesAntes(hoy.slice(0, 7)); if (con(`${m}-01`, finDeMes(m))) out.push({ tipo: 'mes', mes: m }); }
  const anio = hoy.slice(5) >= '12-15' ? Number(hoy.slice(0, 4)) : hoy.slice(5, 7) === '01' ? Number(hoy.slice(0, 4)) - 1 : null;
  if (anio && con(`${anio}-01-01`, `${anio}-12-31`)) out.push({ tipo: 'año', anio });
  return out;
}
