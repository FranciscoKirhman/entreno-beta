import { unir, deshacer } from './superseries.js';
import { pesasReales } from './modelo-tiempo.js';
import { tendenciaDescansos } from './descansos.js';
// La sesión de hoy armada para el tiempo que la persona tiene, elegido con la rueda de "Ajustar el tiempo" (como Down
// Dog) o, al empezar, con el tiempo de su perfil. Siempre se parte de la sesión del plan tal como venía, así se puede
// achicar y volver a agrandar sin perder nada. Antes de empezar, los minutos son de la sesión completa; ya empezada,
// son los que le quedan, y lo hecho no se toca.
// El plan es una planificación grande que se prioriza: con menos tiempo sale lo de menor prioridad (el core se acorta,
// no sale); con más, entran series y accesorios, hasta un máximo razonable por músculo y por sesión, aunque se elijan
// tres horas (Francisco, 4 de noviembre de 2026). Los minutos van a tu ritmo: el de tus últimas sesiones completas.
import { duracionEstimada, minutosCardio } from './motor-plan.js';
import { minutosCalentamiento } from './calentamiento-sesion.js';
import { SERIES_SESION } from './fatiga-sesion.js';
import { tipoDe } from './registro.js';

export const RUEDA = { min: 15, max: 150, paso: 5 };
const MAX_SERIES = 5, CARDIO_MIN = 10, CARDIO_EXTRA = 15, CARDIO_TOPE = 45;
// Al alargar se alterna variedad y volumen: un accesorio para lo que menos lleva, una serie más en lo principal, otro
// accesorio, más cardio... En el modo sin límite se suma un poco más que la sesión del plan, no todo lo que cabría.
const PASOS_EXTRA = ['accesorio', [1, 1], 'accesorio', ['cardio'], [2, 1], 'accesorio', [3, 1], [1, 2]];
/** Series de trabajo por sesión, como máximo razonable, según el nivel. */
export const TOPE_SERIES_SESION = { principiante: 20, intermedio: 26, avanzado: 30 };
/**
 * Más de un cuarto de las series es demasiado para recortar sin que la persona lo pida. En la beta (9 de noviembre de
 * 2026) el ritmo topado en 1,7 dejaba casi toda sesión normal de 17 a 20 series en 10, aunque sus sesiones reales cabían
 * en su tiempo. Con un recorte así no hay aviso: la fila de Ajustar tiempo sigue a la vista con los minutos.
 */
export const RECORTE_MAX = 0.25;
export function recorteGrande(antes = [], despues = []) {
  const series = xs => xs.reduce((a, e) => a + (Number(e.series) || 0), 0), a = series(antes);
  return a > 0 && (a - series(despues)) / a > RECORTE_MAX;
}
/** Ritmo personal: mediana de las últimas sesiones, entre estos límites, con un mínimo de sesiones que sirvan. */
export const RITMO = { min: 0.9, max: 1.7, sesiones: 8, minimo: 3 };

/** El texto del cardio con otros minutos ("Escaladora 20 a 25 minutos..." a "Escaladora 15 minutos..."); 0 lo quita. */
export function conMinutosCardio(texto, minutos) {
  if (!texto || minutosCardio(texto) === null) return texto;
  if (minutos <= 0) return null;
  return texto.replace(/(\d+)(?: a (\d+))? minutos?/, `${minutos} minutos`);
}

const minutosCal = dia => (dia.calentamiento?.length ? minutosCalentamiento(dia.calentamiento) : 8);

/**
 * Minutos de una sesión a tu ritmo: el calentamiento y el cardio como vienen, y las pesas por el ritmo de tus últimas
 * sesiones (ritmoPersonal). Con ritmo 1 es lo mismo que duracionSesion. null si el cardio no dice sus minutos.
 */
export function duracionReal(dia, ritmo = 1) {
  const cardio = minutosCardio(dia.cardio);
  if (cardio === null) return null;
  return minutosCal(dia) + pesasReales(dia.ejercicios || [], ritmo) + cardio + (cardio ? 2 : 0);
}

const mediana = xs => { const s = [...xs].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

/**
 * Cuánto más (o menos) tarda la persona en las pesas que lo que estima el plan, según sus últimas sesiones: los minutos
 * reales sin el calentamiento ni el cardio anotado, contra lo que el modelo del plan estima para las series que hizo
 * (con las repeticiones y el descanso del plan de ese día, y un minuto por serie de aproximación). La mediana de las
 * últimas 8, entre 0,9 y 1,7. Nace de la beta (4 de noviembre de 2026): las pesas tomaban 1,3 a 1,7 veces lo estimado
 * y las sesiones de 90 minutos duraban 112 a 115.
 * @param sesiones [{fecha, duracion_min, series: [{ejercicio_id, tipo, duracion_seg}]}]
 * @param plan     el plan, para la prescripción de cada día (si no está, valores típicos por tipo de ejercicio)
 * @returns {{factor: number, sesiones: number} | null} null con menos de 3 sesiones que sirvan
 */
export function ritmoPersonal({ sesiones = [], plan = null, porId, descansos = {}, hasta = '9999-12-31' }) {
  const porFecha = new Map((plan?.dias || []).map(d => [d.fecha, d]));
  const ratios = [];
  // Solo mediciones ligadas a sesiones válidas, recientes y con duración conocida.
  const candidatas = new Set(sesiones.filter(s => s.fecha <= hasta && Number(s.duracion_min) >= 20
    && (s.series || []).filter(x => porId.has(x.ejercicio_id) && !['cardio', 'movilidad'].includes(porId.get(x.ejercicio_id).tipo) && !['calentamiento', 'aproximacion'].includes(x.tipo)).length >= 6)
    .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, RITMO.sesiones).map(s => s.id));
  const medidas = Object.fromEntries(Object.entries(descansos).filter(([id, d]) => candidatas.has(id) && d?.medidos >= 4 && d.fecha <= hasta));
  const tendencia = Object.keys(medidas).length >= 3 ? tendenciaDescansos(medidas, { ultimas: RITMO.sesiones }) : null;
  const modeloPersonal = tendencia ? { descansos: tendencia, tipos: Object.fromEntries([...porId].map(([id, ej]) => [id, ej.tipo])) } : null;
  const recientes = sesiones.filter(s => s.fecha <= hasta && Number(s.duracion_min) >= 20).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  for (const s of recientes) {
    if (ratios.length >= RITMO.sesiones) break;
    const dia = porFecha.get(s.fecha);
    let cardioSeg = 0, aprox = 0;
    const porEj = new Map();
    for (const x of s.series || []) {
      const ej = porId.get(x.ejercicio_id);
      if (!ej || ej.tipo === 'movilidad') continue;
      if (ej.tipo === 'cardio') { cardioSeg += Number(x.duracion_seg) || 0; continue; }
      if (['calentamiento', 'aproximacion'].includes(x.tipo)) { aprox++; continue; }
      porEj.set(x.ejercicio_id, (porEj.get(x.ejercicio_id) || 0) + 1);
    }
    if ([...porEj.values()].reduce((a, b) => a + b, 0) < 6) continue;
    const hecho = [...porEj].map(([id, n], i) => {
      const e = dia?.ejercicios?.find(y => y.ejercicio_id === id), ej = porId.get(id);
      const tipico = ej.tipo === 'compuesto' ? [8, 12, 120] : ej.tipo === 'core' ? [10, 15, 60] : [10, 15, 75];
      return { ejercicio_id: id, orden: i, series: n, reps_min: e?.reps_min ?? tipico[0], reps_max: e?.reps_max ?? tipico[1], unidad: e?.unidad ?? 'reps', descanso_seg: e?.descanso_seg ?? tipico[2], superserie: e?.superserie ?? null };
    });
    const modelo = duracionEstimada(hecho, 0, modeloPersonal) + aprox;
    const real = Number(s.duracion_min) - (dia ? minutosCal(dia) : 8) - cardioSeg / 60 - (cardioSeg ? 2 : 0);
    if (modelo > 0 && real > 0) ratios.push(real / modelo);
  }
  if (ratios.length < RITMO.minimo) return null;
  return { factor: Math.round(Math.min(RITMO.max, Math.max(RITMO.min, mediana(ratios))) * 100) / 100, sesiones: ratios.length, ...(modeloPersonal || {}) };
}

/**
 * Lo que ya se hizo de cada ejercicio hoy, desde el registro: series de trabajo hechas y si se empezó (cualquier fila).
 * @param registro {[id]: filas} del día (E.registro[fecha])
 * @returns {{[id]: {trabajo: number, empezado: boolean}}}
 */
export function hechasDelDia(registro = {}) {
  return Object.fromEntries(Object.entries(registro).map(([id, filas]) => {
    const hechas = (filas || []).filter(x => x?.hecho);
    return [id, { trabajo: hechas.filter(x => ['normal', 'fallo'].includes(tipoDe(x))).length, empezado: hechas.length > 0 }];
  }));
}

/** Minutos que le quedan a una sesión ya empezada: las series que faltan, sus descansos (a tu ritmo) y el cardio si falta. */
export function minutosRestantes({ ejercicios, cardio }, hechas = {}, cardioHecho = false, ritmo = 1) {
  const pendientes = deshacer(ejercicios, new Set(ejercicios.filter(e => hechas[e.ejercicio_id]?.empezado).map(e => e.ejercicio_id)));
  const faltan = pendientes.map(e => ({ ...e, series: Math.max(0, e.series - (hechas[e.ejercicio_id]?.trabajo || 0)) }))
    .filter(e => e.series > 0);
  const min = faltan.length ? pesasReales(faltan, ritmo) : 0;
  const c = cardioHecho ? 0 : minutosCardio(cardio) || 0;
  return min + c + (c ? 2 : 0);
}

/**
 * Arma la sesión para los minutos elegidos.
 * @param base        la sesión del plan sin ajustar: {ejercicios, cardio, calentamiento}
 * @param minutos     número, o null para "tiempo indefinido" (la versión más larga razonable)
 * @param hechas      hechasDelDia(registro): con algo hecho, los minutos son los que quedan
 * @param cardioHecho el cardio ya se marcó: no se toca
 * @param ritmo       factor de tus últimas sesiones (ritmoPersonal); 1 es el modelo del plan
 * @param accesorios  ejercicios que pueden sumarse si sobra tiempo, del más al menos necesario, ya prescritos
 * @param porId       catálogo por id: con él rigen los topes (series por músculo y por sesión) y el core no sale
 * @param topeSeries  series de trabajo por sesión como máximo (TOPE_SERIES_SESION según el nivel)
 * @returns {{ejercicios, cardio, minutos, quitados: string[], agregados: string[], enCurso: boolean, tope: boolean}}
 *   tope: la sesión no crece más aunque haya tiempo (ya tiene lo razonable para hoy)
 */
export function ajustarTiempo(base, { minutos = null, hechas = {}, cardioHecho = false, ritmo = 1, accesorios = [], porId = null, topeSeries = TOPE_SERIES_SESION.avanzado } = {}) {
  const enCurso = Object.values(hechas).some(h => h.empezado);
  let lista = structuredClone(base.ejercicios || []).sort((a, b) => a.orden - b.orden);
  let cardio = base.cardio ?? null;
  const cardioBase = minutosCardio(cardio);
  const tocaCardio = !cardioHecho && cardioBase !== null && cardioBase > 0;
  const hecho = e => hechas[e.ejercicio_id] || { trabajo: 0, empezado: false };
  const minimo = e => Math.max(hecho(e).trabajo, 1);
  const estimar = () => (enCurso ? minutosRestantes({ ejercicios: lista, cardio }, hechas, cardioHecho, ritmo)
    : duracionReal({ ejercicios: lista, cardio, calentamiento: base.calentamiento }, ritmo) ?? 8 + pesasReales(lista, ritmo));
  const quitados = [], agregados = [], superseries = [];
  const quitar = e => {
    lista = lista.filter(x => x !== e);
    quitados.push(e.ejercicio_id);
    // Su pareja de superserie queda como serie normal: sola no es superserie.
    if (e.superserie && lista.filter(x => x.superserie === e.superserie).length < 2) lista.forEach(x => { if (x.superserie === e.superserie) x.superserie = null; });
  };
  const sobra = () => minutos != null && estimar() > minutos;
  // El core va en todas las sesiones: con poco tiempo se acorta a 2 series, pero el último no sale antes que lo demás.
  const esCore = e => porId?.get(e.ejercicio_id)?.tipo === 'core';
  const ultimoCore = e => esCore(e) && lista.filter(esCore).length === 1;
  const menosImportante = (protegerCore = true) => [...lista].filter(e => !hecho(e).empezado && !(protegerCore && ultimoCore(e)))
    .sort((a, b) => b.prioridad - a.prioridad || b.orden - a.orden)[0];
  const cardioA = n => { cardio = conMinutosCardio(base.cardio, n); };
  let tope = false;

  if (minutos != null && estimar() > minutos) {
    // 1. El cardio baja hasta 10 minutos: es lo más fácil de achicar sin perder el estímulo de las pesas.
    if (tocaCardio) for (let n = cardioBase - 5; n >= CARDIO_MIN && sobra(); n -= 5) cardioA(n);
    // Una pareja nueva solo se ofrece si basta para que quepa, antes de quitar ejercicios o series.
    if (sobra() && porId) {
      const original = lista;
      const apto = e => !e.superserie && !hecho(e).empezado && ['aislamiento', 'core'].includes(porId.get(e.ejercicio_id)?.tipo);
      for (let i = 0; i < original.length && !superseries.length; i++) for (let j = i + 1; j < original.length && !superseries.length; j++) {
        const a = original[i], b = original[j];
        if (!apto(a) || !apto(b)) continue;
        const ea = porId.get(a.ejercicio_id), eb = porId.get(b.ejercicio_id);
        const ms = e => [...(e.musculos_primarios || []), ...(e.musculos_secundarios || [])];
        if (!ms(ea).length || !ms(eb).length || ms(ea).some(m => ms(eb).includes(m))) continue;
        lista = unir(original, i, j);
        if (!sobra()) superseries.push([a.ejercicio_id, b.ejercicio_id]); else lista = original;
      }
    }
    // 2. Fuera los accesorios (prioridad 3 o más) que no se han empezado, dejando al menos 3 ejercicios (y el core).
    const accesorio = () => { const e = menosImportante(); return e && e.prioridad >= 3 ? e : null; };
    while (sobra() && lista.length > 3 && accesorio()) quitar(accesorio());
    // 3. Dos series por ejercicio, desde lo menos importante: antes que sacar un básico o un secundario entero.
    for (const e of [...lista].sort((a, b) => b.prioridad - a.prioridad || b.orden - a.orden)) { if (!sobra()) break; e.series = Math.max(minimo(e), Math.min(e.series, 2)); }
    // 3b. Recién ahí, fuera lo demás de menor prioridad, con el mismo piso de 3 ejercicios.
    while (sobra() && lista.length > 3 && menosImportante()) quitar(menosImportante());
    // 4. Descansos de 90 segundos como máximo.
    for (const e of lista) { if (!sobra()) break; e.descanso_seg = Math.min(e.descanso_seg ?? 90, 90); }
    // 5. Sin cardio, y recién ahí más ejercicios fuera (el core también, si no queda otra).
    if (tocaCardio && sobra()) cardioA(0);
    while (sobra() && lista.length > 1 && menosImportante(false)) quitar(menosImportante(false));
  } else if (minutos == null || estimar() < minutos) {
    // Más tiempo que el plan. Cada paso entra solo si cabe en los minutos elegidos y en los topes; sin límite, entran
    // todos los que caben en los topes.
    const cabe = () => minutos == null || estimar() <= minutos;
    const extra = new Map(lista.map(e => [e, 0]));
    const cuenta = ej => ej && !['core', 'cardio', 'movilidad'].includes(ej.tipo);
    const seriesDe = m => lista.reduce((a, e) => { const ej = porId.get(e.ejercicio_id); return a + (cuenta(ej) && ej.musculos_primarios.includes(m) ? e.series : 0); }, 0);
    const total = () => lista.reduce((a, e) => a + (['cardio', 'movilidad'].includes(porId.get(e.ejercicio_id)?.tipo) ? 0 : e.series), 0);
    // Topes por sesión: más de 12 series de un músculo o de 20 a 30 en total rinden poco y suman cansancio.
    const pasaTope = (id, n) => {
      if (!porId) return false;
      if (total() + n > topeSeries) return true;
      const ej = porId.get(id);
      return cuenta(ej) && ej.musculos_primarios.some(m => seriesDe(m) + n > SERIES_SESION.aviso);
    };
    const pool = accesorios.filter(a => a && !lista.some(e => e.ejercicio_id === a.ejercicio_id));
    const sumarAccesorio = () => {
      while (pool.length) {
        const a = pool.shift();
        if (lista.some(e => e.ejercicio_id === a.ejercicio_id)) continue;
        if (pasaTope(a.ejercicio_id, a.series)) { tope = true; continue; }
        lista.push({ ...structuredClone(a), prioridad: 4, orden: lista.length });
        if (!cabe()) { lista.pop(); pool.unshift(a); return false; }
        agregados.push(a.ejercicio_id);
        return true;
      }
      return false;
    };
    for (const paso of PASOS_EXTRA) {
      if (paso === 'accesorio') { sumarAccesorio(); continue; }
      if (paso[0] === 'cardio') {
        if (!tocaCardio) continue;
        for (let n = cardioBase + 5; n <= Math.min(cardioBase + CARDIO_EXTRA, CARDIO_TOPE); n += 5) {
          const antes = cardio; cardioA(n);
          if (minutos != null && estimar() > minutos) { cardio = antes; break; }
        }
        continue;
      }
      const [prioridad, hasta] = paso;
      for (const e of lista.filter(x => x.prioridad === prioridad)) {
        // Lo que ya se terminó hoy no suma series: se sigue con lo que falta.
        if (e.series >= MAX_SERIES || (extra.get(e) || 0) >= hasta || (enCurso && hecho(e).trabajo >= e.series)) continue;
        if (pasaTope(e.ejercicio_id, 1)) { tope = true; continue; }
        e.series++; extra.set(e, (extra.get(e) || 0) + 1);
        if (minutos != null && estimar() > minutos) { e.series--; extra.set(e, extra.get(e) - 1); }
      }
    }
    // Con tiempo de sobra, el resto de los accesorios mientras quepan.
    while (pool.length && sumarAccesorio()) { /* sigue */ }
    // Pidió más de lo que la sesión puede crecer: ya tiene lo razonable para hoy.
    if (porId && (minutos == null || estimar() < minutos - 10) && (tope || !pool.length)) tope = true;
  }
  return { ejercicios: lista.map((e, i) => ({ ...e, orden: i })), cardio, minutos: estimar(), quitados, agregados, superseries, enCurso, tope };
}

/**
 * Accesorios para alargar una sesión con más tiempo: ejercicios aislados o de core que el día no trae, para lo que
 * menos lleva. Primero el core si el día no tiene, después las zonas prioritarias que el día trabaja y lo típico del
 * tipo de día (hombro, bíceps y tríceps en un torso; aductores, pantorrilla y espalda baja en una pierna). Nada para un
 * músculo que ya va cerca del tope por sesión. Se prefiere lo que la persona ya hizo (su peso se conoce).
 * @param dia        el día del plan
 * @param ejercicios el catálogo (indice.ejercicios)
 * @param puede      (ej) => si se puede hacer en este lugar y con sus lesiones
 * @param conHistorial ids que la persona ya anotó alguna vez
 * @returns ids de ejercicios del catálogo, del más al menos necesario
 */
export function accesoriosParaDia({ dia, porId, ejercicios, puede = () => true, prioridad = [], conHistorial = new Set(), maximo = 4 }) {
  const enDia = new Set((dia?.ejercicios || []).map(e => e.ejercicio_id));
  const series = new Map();
  for (const e of dia?.ejercicios || []) {
    const ej = porId.get(e.ejercicio_id);
    if (ej && ej.tipo !== 'cardio') for (const m of ej.musculos_primarios) series.set(m, (series.get(m) || 0) + (Number(e.series) || 0));
  }
  const tieneCore = (dia?.ejercicios || []).some(e => porId.get(e.ejercicio_id)?.tipo === 'core');
  const torso = ['pecho', 'espalda', 'hombro'].some(m => series.has(m)), pierna = ['cuadriceps', 'gluteo', 'femoral'].some(m => series.has(m));
  const objetivos = [
    ...(tieneCore ? [] : ['core']),
    ...prioridad.filter(m => series.has(m) || m === 'core'),
    ...(torso ? ['hombro', 'hombro_posterior', 'biceps', 'triceps'] : []),
    ...(pierna ? ['aductor_abductor', 'pantorrilla', 'erectores'] : []),
    'core',
  ];
  const elegidos = [];
  const usados = new Set(enDia);
  for (const objetivo of objetivos) {
    if (elegidos.length >= maximo) break;
    const musculo = objetivo === 'hombro_posterior' ? 'hombro' : objetivo;
    if ((series.get(musculo) || 0) >= SERIES_SESION.aviso - 3 && musculo !== 'core') continue;
    const patron = objetivo === 'hombro_posterior' ? 'hombro_posterior' : objetivo === 'hombro' ? 'hombro_aislado' : null;
    // El core rota: si ya hay uno del día o elegido, otro tipo (flexión, estabilidad, antirrotación).
    const tiposCore = new Set([...usados].map(id => porId.get(id)).filter(ej => ej?.tipo === 'core').map(ej => ej.patron));
    const c = ejercicios.filter(ej => !usados.has(ej.id) && !ej.propio && !ej.extra && puede(ej)
      && (musculo === 'core' ? ej.tipo === 'core' && !tiposCore.has(ej.patron) : ej.tipo === 'aislamiento' && ej.musculos_primarios[0] === musculo)
      && (!patron || ej.patron === patron) && ej.medida !== 'seg')
      .sort((a, b) => (conHistorial.has(b.id) - conHistorial.has(a.id)) || a.preferencia - b.preferencia || a.id.localeCompare(b.id))[0];
    if (!c) continue;
    elegidos.push(c.id);
    usados.add(c.id);
  }
  return elegidos;
}

/** "5 ejercicios, 21 series, cardio de 10 min, unos 90 min": cómo queda una sesión, para mostrar el antes y el después. */
export function resumenSesion({ ejercicios, cardio, minutos }) {
  const series = ejercicios.reduce((a, e) => a + (Number(e.series) || 0), 0), c = minutosCardio(cardio);
  return `${ejercicios.length} ejercicio${ejercicios.length === 1 ? '' : 's'}, ${series} serie${series === 1 ? '' : 's'}${c ? `, cardio de ${c} min` : ''}, unos ${minutos} min`;
}

/**
 * Las filas de un ejercicio después de cambiar sus series: las de calentamiento y las que ya tienen algo (hechas o
 * escritas) se quedan; sobran o faltan filas vacías del final.
 * @param lista  filas del registro de hoy (puede no existir)
 * @returns {{lista, filas}} la lista recortada y cuántas filas mostrar
 */
export function filasTrasAjuste(lista = [], series) {
  const cal = lista.filter(x => tipoDe(x) === 'calentamiento').length;
  const trabajo = lista.filter(x => tipoDe(x) !== 'calentamiento');
  const ultimaConDatos = trabajo.reduce((u, x, i) => (x?.hecho || x?.kg != null || x?.reps != null ? i + 1 : u), 0);
  const n = Math.max(series, ultimaConDatos);
  const nueva = [...lista];
  while (nueva.length > cal + n) nueva.pop();
  return { lista: nueva, filas: cal + n };
}
