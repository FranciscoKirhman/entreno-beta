// Sesiones pasadas sin registro: qué preguntar y qué alternativas ofrecer si no se hicieron. Lo usan el Coach (al
// abrirlo y en el chat: "no entrené ayer") y el aviso de Hoy.
//
// 1. No tener registro no prueba que la persona faltó: se pregunta. Entran las pendientes (se sabe que no hay
//    registro) y las "sin datos" (después del último registro), de los últimos 7 días. Lo registrado en la app o
//    importado de Hevy se reconoce con nucleo/registrado.js, así una sesión ya hecha no se pregunta dos veces.
// 2. "La hice" la deja como hecha sin anotar (sin inventar ejercicios ni cifras). "No la hice" ofrece alternativas
//    hechas desde el plan real: días que la persona puede, sesiones ya hechas y sin dejar dos sesiones del mismo
//    grupo en días seguidos (nucleo/agenda.js).
// 3. Nada se aplica sin aceptar. Cada alternativa lleva la firma del plan con que se calculó: si el plan cambió (o ya
//    se aceptó), aceptar otra vez no duplica el cambio.
import { estadoDelPlan, VIGENCIA } from './registrado.js';
import { sesionDe, sumarDias, diaSemana, nombreDia, moverSesion, marcarFaltada, conflictos } from './agenda.js';

const POR_REVISAR = new Set(['pendiente', 'sin_datos']);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "lunes 5": como se nombra un día en las opciones. */
export const diaCorto = f => `${nombreDia(f)} ${Number(f.slice(8))}`;
const lunesDe = f => sumarDias(f, -((diaSemana(f) + 6) % 7));

/** Firma del plan (fecha y sesión de cada día): si cambia, una alternativa calculada antes ya no vale. */
export const firma = plan => (plan?.dias || []).map(d => `${d.fecha}:${d.foco}`).sort().join('|');

/**
 * Las sesiones de los últimos 7 días que quedaron sin registro y conviene preguntar.
 * despues: { 'AAAA-MM-DD' (fecha de la sesión): 'AAAA-MM-DD' (día en que se pidió revisarla después) }; se vuelven a
 * preguntar al día siguiente.
 */
export function sesionesPorRevisar(plan, sesiones = [], { hoy, marcas = {}, despues = {} } = {}) {
  if (!plan?.dias?.length || plan.libre) return [];
  const reg = estadoDelPlan(plan, sesiones, { hoy, marcas });
  const desde = sumarDias(hoy, -VIGENCIA);
  return (plan.dias || [])
    .filter(d => d.fecha < hoy && d.fecha >= desde && d.firme !== false && d.foco !== 'Sesión libre' && POR_REVISAR.has(reg.porDia.get(d.fecha)?.t))
    .filter(d => despues[d.fecha] !== hoy)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .map(d => ({ fecha: d.fecha, foco: d.foco, estado: reg.porDia.get(d.fecha).t }));
}

/** Qué pasa con una sesión del plan según lo registrado: para no preguntar ni mover algo ya hecho. */
export function estadoDeSesion(plan, sesiones, fecha, { hoy, marcas = {} } = {}) {
  const reg = estadoDelPlan(plan, sesiones, { hoy, marcas });
  return reg.porDia.get(fecha) || null;
}

/** Fecha escrita con número: "el 2 de octubre", "2 oct" o "2/10" (del año en curso; si quedaría en el futuro, del anterior). */
export function fechaEscrita(texto, hoy) {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let dia, mes;
  const conMes = t.match(/\b(\d{1,2})\s*(?:de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\b/);
  const conBarra = t.match(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})\b/);
  if (conMes) { dia = Number(conMes[1]); mes = MESES.findIndex(m => m.startsWith(conMes[2] === 'set' ? 'sep' : conMes[2])) + 1; }
  else if (conBarra) { dia = Number(conBarra[1]); mes = Number(conBarra[2]); }
  else return null;
  if (!(mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31)) return null;
  let anio = Number(hoy.slice(0, 4));
  const armar = a => `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  if (armar(anio) > hoy) anio -= 1;
  const f = armar(anio);
  return Number.isNaN(Date.parse(f + 'T12:00:00Z')) || new Date(f + 'T12:00:00Z').getUTCDate() !== dia ? null : f;
}

/** Siguiente fecha en que se puede entrenar (no marcada como "no puedo" ni ya entrenada). */
function siguienteValida(f, { noPuedo, hechas }) {
  let x = sumarDias(f, 1);
  for (let i = 0; i < 14 && (noPuedo.includes(diaSemana(x)) || hechas.includes(x)); i++) x = sumarDias(x, 1);
  return x;
}
const valida = (f, { noPuedo, hechas }) => !noPuedo.includes(diaSemana(f)) && !hechas.includes(f);

/**
 * Pone la sesión de "fecha" en "destino". Si "destino" ya tiene una sesión, esa pasa al siguiente día en que se puede
 * entrenar, y así en cadena hasta caer en un día libre (como correr las sesiones). Nunca toca lo ya hecho.
 */
export function correr(plan, fecha, destino, { noPuedo = [], hechas = [], hasta } = {}) {
  if (hechas.includes(fecha)) return null;
  const nuevo = structuredClone(plan);
  let mover = sesionDe(nuevo, fecha), a = destino;
  if (!mover || !valida(destino, { noPuedo, hechas })) return null;
  const cambios = [];
  const limite = hasta || sumarDias(destino, 14);
  while (mover) {
    const desplazada = nuevo.dias.find(x => x.fecha === a && x !== mover);
    if (desplazada && hechas.includes(desplazada.fecha)) return null;
    cambios.push({ foco: mover.foco, de: mover.fecha, a });
    mover.fecha = a;
    mover = desplazada || null;
    if (mover) { a = siguienteValida(a, { noPuedo, hechas }); if (a > limite) return null; }
  }
  nuevo.dias.sort((x, y) => (x.fecha < y.fecha ? -1 : 1));
  const avisos = cambios.flatMap(c => conflictos(nuevo, c.a, sesionDe(nuevo, c.a).plantilla, sesionDe(nuevo, c.a)));
  return { plan: nuevo, cambios, avisos: [...new Set(avisos)] };
}

/**
 * Cómo queda la semana: desde la sesión que no se hizo (o desde hoy) hasta 7 días adelante, o hasta el último día que
 * cambia. Los días que quedan sin sesión por el cambio también aparecen, para ver de dónde salió cada una.
 */
export function semanaDe(plan, { hoy, cambios = [], marcas = {}, saltada = null } = {}) {
  const desde = [hoy, saltada, ...cambios.map(c => c.de)].filter(Boolean).sort()[0];
  const fin = [sumarDias(hoy, 6), ...cambios.map(c => c.a)].sort().at(-1);
  const movida = new Map(cambios.map(c => [c.a, c.de]));
  const dias = plan.dias.filter(d => d.fecha >= desde && d.fecha <= fin).map(d => ({
    fecha: d.fecha, foco: d.foco,
    cambio: d.fecha === saltada ? 'saltada' : movida.has(d.fecha) ? `antes el ${diaCorto(movida.get(d.fecha))}` : marcas[d.fecha] === 'saltada' ? 'saltada' : null,
  }));
  for (const c of cambios) if (!plan.dias.some(d => d.fecha === c.de)) dias.push({ fecha: c.de, foco: 'Sin sesión', cambio: `${c.foco} pasa al ${diaCorto(c.a)}`, libre: true });
  return dias.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

/** Lo que pasa con las demás sesiones, en una frase. */
function demas(cambios, fecha) {
  const otras = cambios.filter(c => c.de !== fecha);
  if (!otras.length) return 'Las demás sesiones no cambian.';
  return otras.map(c => `${c.foco} pasa del ${diaCorto(c.de)} al ${diaCorto(c.a)}`).join('; ') + '. Las demás no cambian.';
}

/**
 * Alternativas para una sesión que no se hizo. Devuelve {sesion, opciones, fechasLibres} o {error}.
 * Cada opción: {id, titulo, detalle, diferencia, avisos, cambios, plan (nuevo), saltar?}. La última siempre es saltarla.
 * ctx: { hoy, respuestas: {dias_no_puedo}, hechas: [fechas ya hechas] }.
 */
export function alternativasNoHecha(plan, fecha, ctx) {
  const { hoy } = ctx, noPuedo = ctx.respuestas?.dias_no_puedo || [], hechas = ctx.hechas || [];
  const s = sesionDe(plan, fecha);
  if (!s) return { error: `El ${diaCorto(fecha)} no tenías sesión.` };
  if (fecha > hoy) return { error: `${s.foco} del ${diaCorto(fecha)} todavía no pasa.` };
  if (hechas.includes(fecha)) return { error: `${s.foco} del ${diaCorto(fecha)} ya está registrada como hecha.` };
  const regla = { noPuedo, hechas };
  const hasta = sumarDias(hoy, 13);
  const vistas = new Set([firma(plan)]);
  const opciones = [];
  const agregar = (id, r, titulo, diferencia) => {
    if (!r) return;
    const f = firma(r.plan);
    if (vistas.has(f)) return;
    vistas.add(f);
    const destino = r.cambios.find(c => c.de === fecha)?.a;
    opciones.push({ id, titulo, detalle: demas(r.cambios, fecha), diferencia, avisos: r.avisos || [], cambios: r.cambios, plan: r.plan, destino });
  };
  // A. Hacerla hoy (si hoy se puede): las demás siguen igual, o la de hoy se corre.
  if (fecha < hoy && valida(hoy, regla)) {
    const r = correr(plan, fecha, hoy, { ...regla, hasta });
    agregar('hoy', r, `Hacer ${s.foco} hoy`, r?.cambios.length > 1 ? 'Recuperas hoy y la sesión de hoy se corre.' : 'Recuperas hoy, sin mover nada más.');
  }
  // B. Ponerla en el día de la próxima sesión y correr las siguientes.
  const proxima = plan.dias.filter(d => d.fecha > hoy && d.fecha !== fecha && !hechas.includes(d.fecha)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0];
  if (proxima && valida(proxima.fecha, regla)) {
    agregar('correr', correr(plan, fecha, proxima.fecha, { ...regla, hasta }), `Hacer ${s.foco} el ${diaCorto(proxima.fecha)}`, 'Mantienes el orden del plan: lo que venía se corre un día libre.');
  }
  // C. Ponerla en el próximo día libre, sin tocar las demás.
  const libres = fechasLibres(plan, { hoy, noPuedo, hechas, desde: sumarDias(hoy, 1), hasta });
  if (libres.length) agregar('libre', correr(plan, fecha, libres[0], { ...regla, hasta }), `Hacer ${s.foco} el ${diaCorto(libres[0])}`, 'Usas un día libre y no mueves nada más.');
  // D. La reacomodación completa de siempre ("Falté"): la sesión y las que quedan de la semana en los días libres.
  const completa = marcarFaltada(plan, fecha, { hoy, noPuedo, hechas });
  if (completa.ok && completa.cambios.length) agregar('semana', { plan: completa.plan, cambios: completa.cambios, avisos: completa.avisos }, 'Reacomodar toda la semana', 'Junta lo que queda de la semana en los días libres más próximos.');
  // Las que dejan dos sesiones del mismo grupo en días seguidos solo quedan si no hay otra forma de recuperarla.
  const sinChoque = opciones.filter(o => !o.avisos.length);
  const finales = sinChoque.length ? sinChoque : opciones;
  finales.push({ id: 'saltar', titulo: `Saltar ${s.foco}`, detalle: 'Las demás sesiones de la semana siguen igual.', diferencia: 'No recuperas esta sesión; la semana no cambia.', avisos: [], cambios: [], plan, saltar: true });
  return { sesion: { fecha, foco: s.foco }, opciones: finales, fechasLibres: libres };
}

/** Días en que se puede poner una sesión (sin sesión, sin "no puedo" y sin entrenar), para elegir otra fecha. */
export function fechasLibres(plan, { hoy, noPuedo = [], hechas = [], desde = hoy, hasta = sumarDias(hoy, 13) } = {}) {
  const out = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) if (valida(f, { noPuedo, hechas }) && !sesionDe(plan, f)) out.push(f);
  return out;
}

/** La alternativa elegida a otra fecha (la persona eligió el día). */
export function alternativaEnFecha(plan, fecha, destino, ctx) {
  const s = sesionDe(plan, fecha);
  if (!s) return { error: `El ${diaCorto(fecha)} no tenías sesión.` };
  if ((ctx.hechas || []).includes(fecha)) return { error: `${s.foco} del ${diaCorto(fecha)} ya está registrada como hecha.` };
  const r = correr(plan, fecha, destino, { noPuedo: ctx.respuestas?.dias_no_puedo || [], hechas: ctx.hechas || [], hasta: sumarDias(ctx.hoy, 20) });
  if (!r) return { error: `No puedo poner ${s.foco} el ${diaCorto(destino)}.` };
  return { id: `fecha:${destino}`, titulo: `Hacer ${s.foco} el ${diaCorto(destino)}`, detalle: demas(r.cambios, fecha), diferencia: 'La fecha la elegiste tú.', avisos: r.avisos, cambios: r.cambios, plan: r.plan, destino };
}
