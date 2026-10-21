// La sesión de hoy armada para el tiempo que la persona tiene, elegido con la rueda de "Ajustar el tiempo" (como Down
// Dog). Siempre se parte de la sesión del plan tal como venía, así se puede achicar y volver a agrandar sin perder nada.
// Antes de empezar, los minutos son de la sesión completa; ya empezada, son los que le quedan, y lo hecho no se toca.
import { duracionEstimada, duracionSesion, minutosCardio } from './motor-plan.js';
import { tipoDe } from './registro.js';

export const RUEDA = { min: 15, max: 150, paso: 5 };
const MAX_SERIES = 5, CARDIO_MIN = 10, CARDIO_EXTRA = 15, CARDIO_TOPE = 45;
// En el modo sin límite se suma un poco más que la sesión del plan, no todo lo que cabría en un día.
const PASOS_EXTRA = [[1, 1], [2, 1], ['cardio'], [3, 1], [1, 2]];

/** El texto del cardio con otros minutos ("Escaladora 20 a 25 minutos..." a "Escaladora 15 minutos..."); 0 lo quita. */
export function conMinutosCardio(texto, minutos) {
  if (!texto || minutosCardio(texto) === null) return texto;
  if (minutos <= 0) return null;
  return texto.replace(/(\d+)(?: a (\d+))? minutos?/, `${minutos} minutos`);
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

/** Minutos que le quedan a una sesión ya empezada: las series que faltan, sus descansos y el cardio si falta. */
export function minutosRestantes({ ejercicios, cardio }, hechas = {}, cardioHecho = false) {
  const faltan = ejercicios.map(e => ({ ...e, series: Math.max(0, e.series - (hechas[e.ejercicio_id]?.trabajo || 0)), superserie: null }))
    .filter(e => e.series > 0);
  const min = faltan.length ? duracionEstimada(faltan, 0) : 0;
  const c = cardioHecho ? 0 : minutosCardio(cardio) || 0;
  return min + c + (c ? 2 : 0);
}

/**
 * Arma la sesión para los minutos elegidos.
 * @param base     la sesión del plan sin ajustar: {ejercicios, cardio, calentamiento}
 * @param minutos  número, o null para "tiempo indefinido" (la versión más larga razonable)
 * @param hechas   hechasDelDia(registro): con algo hecho, los minutos son los que quedan
 * @param cardioHecho el cardio ya se marcó: no se toca
 * @returns {{ejercicios, cardio, minutos, quitados: string[], enCurso: boolean}}
 */
export function ajustarTiempo(base, { minutos = null, hechas = {}, cardioHecho = false } = {}) {
  const enCurso = Object.values(hechas).some(h => h.empezado);
  let lista = structuredClone(base.ejercicios || []).sort((a, b) => a.orden - b.orden);
  let cardio = base.cardio ?? null;
  const cardioBase = minutosCardio(cardio);
  const tocaCardio = !cardioHecho && cardioBase !== null && cardioBase > 0;
  const hecho = e => hechas[e.ejercicio_id] || { trabajo: 0, empezado: false };
  const minimo = e => Math.max(hecho(e).trabajo, 1);
  const estimar = () => (enCurso ? minutosRestantes({ ejercicios: lista, cardio }, hechas, cardioHecho)
    : duracionSesion({ ejercicios: lista, cardio, calentamiento: base.calentamiento }) ?? duracionEstimada(lista));
  const quitados = [];
  const quitar = e => {
    lista = lista.filter(x => x !== e);
    quitados.push(e.ejercicio_id);
    // Su pareja de superserie queda como serie normal: sola no es superserie.
    if (e.superserie && lista.filter(x => x.superserie === e.superserie).length < 2) lista.forEach(x => { if (x.superserie === e.superserie) x.superserie = null; });
  };
  const sobra = () => minutos != null && estimar() > minutos;
  const menosImportante = () => [...lista].filter(e => !hecho(e).empezado).sort((a, b) => b.prioridad - a.prioridad || b.orden - a.orden)[0];
  const cardioA = n => { cardio = conMinutosCardio(base.cardio, n); };

  if (minutos != null && estimar() > minutos) {
    // 1. El cardio baja hasta 10 minutos: es lo más fácil de achicar sin perder el estímulo de las pesas.
    if (tocaCardio) for (let n = cardioBase - 5; n >= CARDIO_MIN && sobra(); n -= 5) cardioA(n);
    // 2. Fuera lo de menor prioridad que no se ha empezado, dejando al menos 3 ejercicios.
    while (sobra() && lista.length > 3 && menosImportante()) quitar(menosImportante());
    // 3. Dos series por ejercicio, desde lo menos importante.
    for (const e of [...lista].sort((a, b) => b.prioridad - a.prioridad || b.orden - a.orden)) { if (!sobra()) break; e.series = Math.max(minimo(e), Math.min(e.series, 2)); }
    // 4. Descansos de 90 segundos como máximo.
    for (const e of lista) { if (!sobra()) break; e.descanso_seg = Math.min(e.descanso_seg ?? 90, 90); }
    // 5. Sin cardio, y recién ahí más ejercicios fuera.
    if (tocaCardio && sobra()) cardioA(0);
    while (sobra() && lista.length > 1 && menosImportante()) quitar(menosImportante());
  } else if (minutos == null || estimar() < minutos) {
    // Más tiempo que el plan: una serie más en lo principal, más cardio y después en lo demás. Cada paso entra
    // solo si cabe en los minutos elegidos; sin límite, entran todos.
    const extra = new Map(lista.map(e => [e, 0]));
    for (const paso of PASOS_EXTRA) {
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
        if (e.series >= MAX_SERIES || extra.get(e) >= hasta || (enCurso && hecho(e).trabajo >= e.series)) continue;
        e.series++; extra.set(e, extra.get(e) + 1);
        if (minutos != null && estimar() > minutos) { e.series--; extra.set(e, extra.get(e) - 1); }
      }
    }
  }
  return { ejercicios: lista.map((e, i) => ({ ...e, orden: i })), cardio, minutos: estimar(), quitados, enCurso };
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
