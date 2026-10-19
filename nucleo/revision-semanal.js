// El coach con IA ajusta el plan semana a semana: el bloque entero (unas 4 semanas) queda planificado y, cuando
// termina una semana, la IA la revisa (sesiones, cómo se sintieron, notas y check-in) y propone ajustes solo desde la
// semana que viene. Las notas de una sesión van al coach al guardarla y quedan a la vista en el chat; si una pide un
// ajuste antes (dolor, técnica rota, una máquina que no hay), el coach lo prepara sin esperar la revisión.
import { semanasDelPlan } from './semanal.js';
import { sumarDias, diaSemana } from './agenda.js';
import { resumenParaEntrenador } from './notas.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const diaLargo = f => `${DIAS[diaSemana(f)]} ${Number(f.slice(8, 10))}`;
const mes = f => MESES[Number(f.slice(5, 7)) - 1];

/**
 * La semana del plan que terminó y todavía no se revisó, o null. Se revisa durante los 6 días siguientes a su
 * domingo; el domingo siguiente ya toca revisar la otra.
 * @param revisadas {[`${plan.inicio}|${semana}`]: true}
 */
export function semanaPorRevisar(plan, hoy, revisadas = {}) {
  if (!Array.isArray(plan?.dias) || !plan.dias.length || plan.bloqueado || plan.libre) return null;
  const semanas = semanasDelPlan(plan);
  const terminadas = semanas.filter(s => s.hasta < hoy && hoy < sumarDias(s.hasta, 7));
  const s = terminadas.at(-1);
  if (!s) return null;
  const clave = `${plan.inicio}|${s.semana}`;
  if (revisadas[clave]) return null;
  const siguiente = semanas.find(x => x.semana === s.semana + 1) || null;
  // Revisada tarde (la semana siguiente ya empezó): los ajustes parten mañana, no en un lunes que ya pasó.
  const desdeSiguiente = siguiente && (siguiente.desde >= hoy ? siguiente.desde : sumarDias(hoy, 1));
  return { semana: s.semana, desde: s.desde, hasta: s.hasta, clave, siguiente: siguiente ? { semana: siguiente.semana, desde: desdeSiguiente, ...(desdeSiguiente !== siguiente.desde ? { tarde: true } : {}), ...(siguiente.semana === plan.semana_descarga ? { descarga: true } : {}) } : null, ultima: !siguiente };
}

/** El mensaje que queda en el chat (texto) y el que lee la IA (paraIA, con la fecha exacta para proponer_cambios). */
export function mensajeRevision(s) {
  const rango = mes(s.desde) === mes(s.hasta) ? `${diaLargo(s.desde)} al ${diaLargo(s.hasta)} de ${mes(s.hasta)}` : `${diaLargo(s.desde)} de ${mes(s.desde)} al ${diaLargo(s.hasta)} de ${mes(s.hasta)}`;
  const texto = s.siguiente
    ? s.siguiente.descarga
      // La que viene es de descarga: ya baja series y esfuerzo, así que solo se cambia lo que no puede esperar.
      ? `Revisión de la semana ${s.semana} (${rango}). La que viene es de descarga: cambia solo lo necesario desde ${s.siguiente.tarde ? 'mañana, ' : 'el '}${diaLargo(s.siguiente.desde)}.`
      : `Revisión de la semana ${s.semana} (${rango}). Ajusta lo que haga falta desde ${s.siguiente.tarde ? 'mañana, ' : 'el '}${diaLargo(s.siguiente.desde)}.`
    : `Revisión de la semana ${s.semana} (${rango}), la última del bloque. ¿Cómo voy y conviene armar el siguiente?`;
  return { texto, paraIA: s.siguiente ? `${texto} (desde = ${s.siguiente.desde})` : texto };
}

/**
 * Las notas de una sesión guardada, como mensaje para el coach: las notas por ejercicio (o lo que preocupa de
 * "Cómo te fue") y el comentario de la sesión. null si no hay nada que contarle.
 * @param sesion {fecha, titulo, notas: [{ejercicio_id, nombre?, respuestas, nota, para_entrenador}], comentario}
 */
export function notasDeSesionTexto(sesion, indice) {
  // Los ejercicios propios no están en el catálogo: su nombre viene con la nota.
  const propios = new Map((sesion.notas || []).filter(n => n.nombre).map(n => [n.ejercicio_id, n.nombre]));
  const conNombres = { porId: { get: id => (propios.has(id) ? { nombre: propios.get(id) } : indice?.porId.get(id)) } };
  const items = resumenParaEntrenador((sesion.notas || []).map(n => ({ ...n, fecha: sesion.fecha })), conNombres)
    .filter(it => it.nota || it.marcas.length);
  const comentario = String(sesion.comentario || '').trim();
  if (!items.length && !comentario) return null;
  const lineas = items.map(it => `- **${it.ejercicio}**: ${[it.marcas.join(', '), it.nota].filter(Boolean).join('. ')}`);
  if (comentario) lineas.push(`- **La sesión**: ${comentario}`);
  return `Notas de ${sesion.titulo || 'la sesión'} (${diaLargo(sesion.fecha)}):\n${lineas.join('\n')}`;
}

/** Huella de las notas: si se guarda de nuevo la sesión sin cambiarlas, no se vuelven a mandar. */
export const huellaNotas = texto => {
  let h = 0;
  for (const c of String(texto)) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return h.toString(36);
};
