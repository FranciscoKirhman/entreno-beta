// La nota de un ejercicio, enviada al coach en el momento (app/hoy.js): el botón Enviar la manda por la misma cola del
// chat y la respuesta se muestra bajo la nota, sin salir de la sesión. Sin señal o sin cuenta queda en la cola del
// chat ("por enviar") y sale sola cuando se puede.

const n = x => String(Math.round(Number(x) * 10) / 10).replace('.', ',');

/**
 * Lo que se ve en el chat (texto) y lo que recibe la IA (paraIA): la nota con lo que pide el plan y lo hecho hoy en
 * ese ejercicio, para que responda sobre esta sesión y no en general.
 * @param e      ejercicio del plan {series, reps_min, reps_max, rir, carga_kg, unidad}
 * @param hechas filas hechas hoy [{kg, reps, rir, tipo}]
 */
export function mensajeNotaEjercicio({ nombre, foco, nota, e = {}, hechas = [] }) {
  const limpia = String(nota || '').trim().replace(/\s+/g, ' ').slice(0, 500);
  if (!limpia) return null;
  const unidad = e.unidad === 'seg' ? ' s' : e.unidad === 'm' ? ' m' : '';
  const pide = e.series ? `${e.series} × ${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${unidad}${e.rir != null ? `, ${e.rir} en reserva` : ''}${e.carga_kg != null ? `, ${n(e.carga_kg)} kg` : ''}` : null;
  const hecho = hechas.filter(x => x && (x.reps != null || x.kg != null)).map(x => `${x.kg != null ? `${n(x.kg)} kg × ` : ''}${x.reps ?? '?'}${x.rir != null ? ` (${n(x.rir)} en reserva)` : ''}${x.tipo && x.tipo !== 'normal' ? ` [${x.tipo}]` : ''}`);
  return {
    texto: `${nombre}: ${limpia}`,
    paraIA: [`Estoy entrenando ahora${foco ? ` (${foco})` : ''} y todavía no termino la sesión. Nota en ${nombre}: "${limpia}".`,
      pide ? `El plan pide ${pide}.` : '',
      hecho.length ? `Hoy llevo en este ejercicio: ${hecho.join('; ')}.` : 'Todavía no hago ninguna serie de este ejercicio hoy.',
      'Respóndeme ahora, en dos o tres frases, para leer entre series: qué hago con lo que queda de este ejercicio.'].filter(Boolean).join(' '),
  };
}

/**
 * En qué va la nota enviada de un ejercicio en una fecha, mirando el chat: la última enviada manda.
 * indice es la respuesta del coach en el chat; seguimiento, la última respuesta a un botón tocado bajo esa nota
 * (lo que agrega decidir con deNota), para mostrar su vista previa y sus botones ahí mismo.
 * @returns {{estado: 'sin' | 'cola' | 'pensando' | 'respondida', texto?: string, conPropuesta?: boolean, nota?: string,
 *   indice?: number, seguimiento?: number}}
 */
export function respuestaDeNota(chat = [], { fecha, id }) {
  let i = -1;
  chat.forEach((m, k) => { if (m.rol === 'persona' && m.notaEj?.fecha === fecha && m.notaEj?.id === id) i = k; });
  if (i < 0) return { estado: 'sin' };
  const persona = chat[i], nota = persona.notaEj.nota;
  if (persona.porEnviar) return { estado: 'cola', nota };
  const r = chat[i + 1];
  if (!r || r.rol !== 'coach') return { estado: 'pensando', nota };
  if (r.pendiente) return { estado: 'pensando', nota };
  let seguimiento = -1;
  for (let k = i + 2; k < chat.length; k++) if (chat[k].rol === 'coach' && chat[k].deNota?.fecha === fecha && chat[k].deNota?.id === id) seguimiento = k;
  return { estado: 'respondida', nota, texto: r.texto || '', conPropuesta: Boolean(r.propuesta || r.opciones?.length), indice: i + 1,
    ...(seguimiento > 0 ? { seguimiento } : {}) };
}

/**
 * Bajo qué ejercicio se ve una nota enviada: el suyo y, si un ajuste en vivo lo puso en lugar de otro
 * (nucleo/sesion-viva.js: "la máquina está ocupada" lo reemplaza), también el que reemplazó. Sin esto, la nota enviada y
 * la respuesta del coach desaparecían de la sesión justo cuando la nota provocaba el cambio. El texto de la nota no se
 * mueve: en el ejercicio nuevo, "ocupada" volvería a reemplazarlo.
 * @param vivaHecho los ajustes en vivo aceptados de la fecha, por su id (`nota-ocupada:<ejercicio de antes>:<firma>`)
 */
export function idsConNota(id, vivaHecho = {}) {
  const desde = Object.entries(vivaHecho || {})
    .filter(([, h]) => h?.tipo === 'reemplazar' && h.ejercicio_id === id)
    .map(([clave]) => clave.split(':')[1]).filter(x => x && x !== id);
  return [id, ...desde];
}
