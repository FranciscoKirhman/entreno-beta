// La conversación con el coach también vive en la cuenta (Francisco, 10 de noviembre de 2026: "la conversación debe estar
// en la nube"). Antes quedaba solo en el teléfono: al cambiar de teléfono o borrar los datos del navegador se perdía, y
// para revisar una falla del coach había que adivinar qué se le había preguntado.
// Va como un documento de datos_telefono (clave chat_coach): los últimos mensajes, sin el plan completo de cada
// propuesta (ese ya está en la cuenta, en propuestas_chat), y la hora del último borrado para que borrar la
// conversación en un teléfono la borre en todos.
export const MAX_MENSAJES = 200;

const base = m => `${m?.rol}|${String(m?.texto || '').slice(0, 200)}`;
const clave = m => m?.id || base(m);
/** Huella corta y estable de un texto (FNV-1a): el mismo mensaje da el mismo id en cualquier teléfono. */
function huella(t) { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }

/**
 * Le pone id y hora a cada mensaje que no los tenga. El id sale del autor y el texto (más un número si se repite), no
 * del azar: así los mensajes de antes de este cambio, que están iguales en dos teléfonos, no se duplican al juntarse.
 * Devuelve true si cambió algo.
 */
export function sellarChat(chat, ahora = Date.now()) {
  let cambio = false;
  const usados = new Set((chat || []).map(m => m?.id).filter(Boolean));
  (chat || []).forEach((m, i) => {
    if (!m || typeof m !== 'object') return;
    if (!m.id) {
      const h = huella(base(m));
      let n = 0; while (usados.has(`h${h}-${n}`)) n++;
      m.id = `h${h}-${n}`; usados.add(m.id); cambio = true;
    }
    // Los antiguos quedan en su orden, justo antes de ahora.
    if (!m.t) { m.t = ahora - (chat.length - i); cambio = true; }
  });
  return cambio;
}

/** Lo que sube: sin lo que está a medio enviar ni el paquete de las propuestas. */
export function chatParaNube(chat, borrado = 0) {
  const mensajes = (chat || []).filter(m => m && !m.pendiente && !m.porEnviar).slice(-MAX_MENSAJES).map(m => {
    const c = structuredClone(m);
    if (c.propuesta && typeof c.propuesta === 'object') delete c.propuesta.paquete;
    return c;
  });
  return { mensajes, ...(borrado ? { borrado } : {}) };
}

/**
 * Junta la conversación del teléfono con la de la cuenta. Un mensaje es el mismo si tiene el mismo id (o, entre los de
 * antes de este cambio, el mismo autor y texto). Del que está en los dos lados vale el del teléfono, que conserva el
 * paquete de una propuesta por aceptar, salvo que la cuenta ya sepa cómo terminó esa propuesta. Lo anterior al último
 * borrado, de cualquiera de los dos lados, no vuelve.
 * @returns {{chat: any[], borrado: number}}
 */
export function unirChats(local = [], remoto = {}, borradoLocal = 0) {
  const borrado = Math.max(Number(borradoLocal) || 0, Number(remoto?.borrado) || 0);
  const vivos = xs => (xs || []).filter(m => m && typeof m === 'object' && !((m.t || 0) <= borrado && borrado));
  const porClave = new Map(), porTexto = new Map();
  for (const m of vivos(remoto?.mensajes)) { porClave.set(clave(m), m); if (!porTexto.has(base(m))) porTexto.set(base(m), m); }
  // Un mensaje de este teléfono que todavía no tiene id y está igual en la cuenta es el mismo: toma su id y su hora.
  for (const m of local || []) if (m && !m.id && !m.pendiente && porTexto.get(base(m))?.id) { const r = porTexto.get(base(m)); if (![...(local || [])].some(x => x.id === r.id)) { m.id = r.id; m.t = r.t; } }
  sellarChat(local);
  for (const m of vivos(local)) {
    const r = porClave.get(clave(m));
    if (r && r.estadoPropuesta && !m.estadoPropuesta && m.propuesta) { m.estadoPropuesta = r.estadoPropuesta; m.opciones = null; delete m.propuesta.paquete; }
    porClave.set(clave(m), m);
  }
  // Lo que está a medio enviar en este teléfono va siempre al final, en su orden.
  const enCurso = m => m.pendiente || m.porEnviar;
  const todos = [...porClave.values()];
  const orden = new Map(todos.map((m, i) => [m, i]));
  const chat = todos.filter(m => !enCurso(m)).sort((a, b) => (a.t || 0) - (b.t || 0) || orden.get(a) - orden.get(b)).concat(todos.filter(enCurso));
  return { chat, borrado };
}

/** Una huella barata de lo que subiría, para saber si la conversación cambió desde la última vez. */
export function huellaChat(chat, borrado = 0) {
  const xs = (chat || []).filter(m => m && !m.pendiente && !m.porEnviar);
  return `${xs.length}|${borrado}|${xs.reduce((a, m) => a + String(m.texto || '').length + (m.estadoPropuesta ? 7 : 0) + (m.opciones ? 3 : 0), 0)}|${String(xs.at(-1)?.texto || '').slice(-24)}`;
}
