// Quien se pasa: entrena con más peso y más cerca del fallo de lo que pide el plan, y lo paga con fuerza que no sube,
// repeticiones que se caen, poca energía o molestias. El coach le propone adelantar la descarga, con la vista previa y su
// sí (regla 10 de AGENTS.md). Fase 2 del plan del 28 de octubre de 2026 (docs/05-pendientes.md): antes esa descarga solo
// salía de la energía de "¿Cómo estás hoy?", que casi nadie responde, y en la simulación el plan bajaba a 75, 70 y 65 kg
// mientras la persona seguía con 90 en la barra.
import { esDeTrabajoGuardada } from './registro.js';
import { rendimientoSesiones, textoPct } from './rendimiento-sesion.js';
import { semanaDe } from './ciclos.js';
import { sumarDias, nombreDia } from './agenda.js';

const VENTANA = 14;
const reservaDe = s => (s.tipo === 'fallo' ? 0 : s.rir != null ? Number(s.rir) : s.rpe != null ? 10 - Number(s.rpe) : null);
const fechaCorta = f => `${nombreDia(f)} ${Number(f.slice(8))}`;
const dias = (a, b) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 864e5;

/** Lo que pedía el plan para ese ejercicio ese día o, si se entrenó otro día, el día del plan más cercano (hasta 3). */
function prescripcion(plan, id, fecha) {
  let mejor = null, distancia = Infinity;
  for (const d of plan?.dias || []) {
    const e = d.ejercicios?.find(x => x.ejercicio_id === id);
    const n = e ? dias(d.fecha, fecha) : Infinity;
    if (n <= 3 && n < distancia) { mejor = e; distancia = n; }
  }
  return mejor;
}

/** Sin la serie de comprobación de la reserva (nucleo/comprobacion-rir.js): va al fallo a propósito. */
function sinComprobacion(series) {
  const i = series.map(s => s.tipo).lastIndexOf('fallo');
  return i < 0 ? series : series.filter((_, j) => j !== i);
}

/**
 * Las señales de las últimas dos semanas del bloque (o desde que empezó, si lleva menos).
 * @param o.sesiones  sesiones guardadas [{fecha, series: [{ejercicio_id, orden, tipo, carga_kg, reps, rir, rpe}], notas}]
 * @param o.bienestar {fecha: {cansancio, sueno_horas}} de "¿Cómo estás hoy?"
 * @param o.asistidos ids donde el peso es ayuda: usar más no es pasarse
 * @returns {{desde, sesiones, senales: [{id, tipo, texto}], sePasa}} sePasa: alguna señal de esfuerzo (al fallo o sobre
 *          el plan) y alguna de costo (fuerza, repeticiones que se caen, energía o molestias), con 3 sesiones o más
 */
export function senalesSobrecarga({ plan, sesiones = [], bienestar = {}, hoy, asistidos = new Set() }) {
  const desde = [sumarDias(hoy, -(VENTANA - 1)), plan?.inicio || ''].sort().at(-1);
  const recientes = sesiones.filter(s => s.fecha >= desde && s.fecha <= hoy && (s.series || []).some(x => x.ejercicio_id && esDeTrabajoGuardada(x)));
  const fallo = { k: 0, n: 0, rir: new Set() }, sobre = { k: 0, n: 0 }, caen = { k: 0, n: 0 };
  let molestias = 0, preocupa = false;
  for (const ses of recientes) {
    const comprobadas = new Set((ses.notas || []).filter(n => n.respuestas?.comprobacion).map(n => n.ejercicio_id));
    for (const n of ses.notas || []) {
      if (['leve', 'me_preocupa'].includes(n.respuestas?.molestia)) molestias++;
      if (n.respuestas?.molestia === 'me_preocupa') preocupa = true;
    }
    const porEj = new Map();
    for (const s of [...(ses.series || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))) {
      if (!s.ejercicio_id || !esDeTrabajoGuardada(s) || s.duracion_seg != null || s.distancia_m != null) continue;
      if (!porEj.has(s.ejercicio_id)) porEj.set(s.ejercicio_id, []);
      porEj.get(s.ejercicio_id).push(s);
    }
    for (const [id, todas] of porEj) {
      const e = prescripcion(plan, id, ses.fecha);
      if (['seg', 'm'].includes(e?.unidad)) continue;
      const series = comprobadas.has(id) ? sinComprobacion(todas) : todas;
      if (!series.length) continue;
      // Al fallo o casi (RPE 9,5 o 10) cuando el plan pedía dejar 2 o más.
      if (e && Number(e.rir) >= 2) {
        for (const r of series.map(reservaDe).filter(x => x != null && Number.isFinite(x))) { fallo.n++; if (r <= 0.5) fallo.k++; }
        fallo.rir.add(Number(e.rir));
      }
      const tope = Math.max(...series.map(s => Number(s.carga_kg) || 0));
      if (e && Number(e.carga_kg) > 0 && tope > 0 && !asistidos.has(id)) {
        sobre.n++;
        if (tope > Number(e.carga_kg) * 1.025 + 1e-9) sobre.k++;
      }
      const conTope = series.filter(s => Number(s.carga_kg) === tope && Number(s.reps) > 0);
      if (tope > 0 && conTope.length >= 2) {
        caen.n++;
        if (Number(conTope.at(-1).reps) <= Number(conTope[0].reps) * 0.8) caen.k++;
      }
    }
  }
  const senales = [];
  const minimo = Math.min(...fallo.rir);
  if (fallo.n >= 8 && fallo.k >= 0.4 * fallo.n) senales.push({ id: 'al_fallo', tipo: 'esfuerzo', texto: `${fallo.k} de ${fallo.n} series al fallo o casi, cuando el plan pedía dejar ${fallo.rir.size > 1 ? `${minimo} o más` : minimo} en reserva.` });
  if (sobre.n >= 4 && sobre.k * 2 >= sobre.n) senales.push({ id: 'sobre_plan', tipo: 'esfuerzo', texto: `En ${sobre.k} de ${sobre.n} ejercicios usaste más peso que el del plan.` });
  if (caen.n >= 4 && caen.k >= 0.4 * caen.n) senales.push({ id: 'caen_reps', tipo: 'costo', texto: `En ${caen.k} de ${caen.n} ejercicios las repeticiones cayeron un 20% o más de la primera serie a la última.` });
  const rinde = rendimientoSesiones(sesiones, { desde, hasta: hoy, asistidos });
  if (rinde.length >= 3) {
    const media = rinde.reduce((a, r) => a + r.pct, 0) / rinde.length;
    if (media <= 0.5) senales.push({ id: 'fuerza', tipo: 'costo', texto: media < -0.5 ? `Tu rendimiento bajó: ${textoPct(media)} contra lo habitual.` : `Tu rendimiento no subió (${textoPct(media)} contra lo habitual).` });
  }
  const respondidos = Object.entries(bienestar || {}).filter(([f, b]) => f >= desde && f <= hoy && b && (b.cansancio != null || b.sueno_horas != null));
  const bajos = respondidos.filter(([, b]) => Number(b.cansancio) >= 4 || (b.sueno_horas != null && Number(b.sueno_horas) < 6)).length;
  if (bajos >= 2 && bajos * 3 >= respondidos.length) senales.push({ id: 'energia', tipo: 'costo', texto: `${bajos} días con poca energía o menos de 6 horas de sueño.` });
  if (molestias >= 2 || preocupa) senales.push({ id: 'molestias', tipo: 'costo', texto: molestias === 1 ? 'Anotaste una molestia que te preocupa.' : `Anotaste molestias en ${molestias} ejercicios.` });
  const esfuerzo = senales.some(s => s.tipo === 'esfuerzo'), costo = senales.some(s => s.tipo === 'costo');
  return { desde, sesiones: recientes.length, senales, sePasa: recientes.length >= 3 && esfuerzo && costo };
}

/**
 * Lo que el coach le propone a quien se pasa: adelantar la descarga a la semana que viene, con los mismos ejercicios.
 * Desde la segunda semana del bloque (recién salido de una descarga no se propone otra). null si no se pasa, si la
 * descarga ya es la semana que viene, si el plan no va por bloques (libre o importado) o si esta semana dijo "Ahora no".
 * @param o.descartadas {clave: true} lo que la persona dejó pasar
 * @returns {{semana, desde, clave, texto, opciones}} opciones: los botones del chat (nucleo/coach.js: aplicarOpcion)
 */
export function propuestaSobrecarga({ plan, hoy, senales, descartadas = {} }) {
  if (!senales?.sePasa || !Array.isArray(plan?.dias) || !plan.semana_descarga || plan.libre || plan.bloqueado || plan.objetivo === 'importado') return null;
  const actual = semanaDe(plan, hoy);
  if (!actual || actual < 2) return null;
  const nueva = actual + 1;
  if (nueva >= plan.semana_descarga || !plan.dias.some(d => d.semana === nueva)) return null;
  const clave = `${plan.inicio}|${actual}`;
  if (descartadas[clave]) return null;
  const desde = sumarDias(plan.inicio, (nueva - 1) * 7);
  const cuando = senales.desde > sumarDias(hoy, -(VENTANA - 1)) ? 'Desde que empezó el bloque' : 'Estas dos semanas';
  const texto = [
    `${cuando} entrenaste más duro de lo que pide el plan:`,
    ...senales.senales.map(s => `- ${s.texto}`),
    '',
    `Así la fatiga se acumula y la fuerza deja de subir. Te propongo adelantar la descarga a la semana del ${fechaCorta(desde)}: los mismos ejercicios, la mitad de las series y 2 repeticiones más de reserva. El bloque termina ahí y el siguiente parte con los pesos que de verdad levantas.`,
    '',
    'Mientras tanto, para cada serie cuando te queden las repeticiones que pide el plan: la última tiene que salir igual de limpia que la primera.',
  ].join('\n');
  return {
    semana: nueva, desde, clave, texto,
    opciones: [
      { etiqueta: 'Ver cómo quedaría', accion: { tipo: 'descarga_temprana', semana: nueva } },
      { etiqueta: 'Ahora no', accion: { tipo: 'sobrecarga_no', clave } },
    ],
  };
}
