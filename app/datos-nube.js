import { unirDescansosMedidos, esDescansoMedido } from '../nucleo/descansos-guardados.js';
// Lo que antes quedaba solo en el teléfono ahora también va a la cuenta (si la persona entró): ejercicios propios,
// medidas del cuerpo, notas fijas, rutinas, ¿cómo se sintió?, meta de peso, ajustes de la sesión y las fechas de la
// regla. Cada cambio se sube al tiro; si no hay señal, queda pendiente y se sube al sincronizar. Al entrar en otro teléfono, se baja lo de la cuenta. Las medidas y el ciclo
// son datos de salud: solo se suben con su permiso.
import { E, R, guardar, modoEjemplo, ambitoDatos, alinearPropios, asegurarExtras, alCambiarPlan, alGuardar } from './comun.js';
import { sellarChat, chatParaNube, unirChats, huellaChat } from '../nucleo/chat-nube.js';
import { propiosDelPlan, conPropiosGuardados } from '../nucleo/propios.js';
import { unirInicios } from '../nucleo/ciclo-menstrual.js';
import * as nube from './nube.js';

import { migrarProgresion, unirProgresion, limpiarProgresion } from '../nucleo/registro-progresion.js';

const PREFERENCIAS = ['escala_esfuerzo', 'mancuernas'];
// clave en la cuenta → cómo leerla y ponerla en E. "Aviso con la pantalla bloqueada" es de cada teléfono (su
// suscripción de avisos), así que no viaja con los ajustes de la sesión.
const campo = (nombre, vacio) => ({ leer: () => E[nombre] ?? vacio, poner: v => { E[nombre] = v; } });
const LOCAL = {
  ejercicios_propios: campo('ejerciciosPropios', []), medidas_cuerpo: campo('medidas', []), notas_fijas: campo('notasFijas', {}),
  calendario_asistencia: campo('marcasPlan', {}), rutinas: campo('rutinas', []), sensaciones: campo('sensaciones', {}),
  // Los descansos reales de cada sesión (nucleo/descansos.js): la hora de cada serie no se guarda en la tabla series.
  descansos: {
    leer: () => unirDescansosMedidos(E.descansosMedidos),
    poner: (v, editadoDuranteLectura = false) => {
      const local = E.descansosMedidos || {};
      E.descansosMedidos = editadoDuranteLectura || E.nubeDatos?.descansos?.pendiente ? unirDescansosMedidos(v, local) : unirDescansosMedidos(local, v);
      // También reparamos copias mezcladas subidas por una versión anterior, sin importar sus números al teléfono.
      if (Object.values(v || {}).some(d => !esDescansoMedido(d))) (E.nubeDatos ||= {}).descansos = { pendiente: true };
    },
  },
  seguimiento_molestias: { leer: () => E.saludFeed || {}, poner: v => { E.saludFeed = { respuestas: unirProgresion(E.saludFeed?.respuestas, v?.respuestas) }; } },
  // La conversación con el coach (nucleo/chat-nube.js): se junta con la de la cuenta, nunca se reemplaza a ciegas.
  chat_coach: {
    leer: () => { sellarChat(E.chat); return chatParaNube(E.chat, E.chatBorrado || 0); },
    poner: v => {
      const r = unirChats(E.chat || [], v || {}, E.chatBorrado || 0);
      E.chat = r.chat; if (r.borrado) E.chatBorrado = r.borrado;
      huellaSubida = huellaChat(E.chat, E.chatBorrado || 0);
      // Si este teléfono traía algo que la cuenta no tenía, sube lo junto.
      if (JSON.stringify(chatParaNube(E.chat, E.chatBorrado || 0)) !== JSON.stringify({ mensajes: v?.mensajes || [], ...(v?.borrado ? { borrado: v.borrado } : {}) })) (E.nubeDatos ||= {}).chat_coach = { pendiente: true };
    },
  },
  feed_vistas: { leer: () => E.feedVistas || {}, poner: v => { E.feedVistas = unirProgresion(E.feedVistas, v); } },
  // Con los ajustes de la sesión viajan dos preferencias de cómo se anota, que viven en las respuestas: RPE o RIR y
  // las mancuernas de a una o el par. Una cuenta que aún no las tiene recibe las de este teléfono (falta).
  ajustes_sesion: {
    leer: () => {
      const { avisoCerrada, ...resto } = E.ajustesSesion || {};
      for (const k of PREFERENCIAS) if (R()?.[k]) resto[k] = R()[k];
      return resto;
    },
    poner: v => {
      const aviso = E.ajustesSesion?.avisoCerrada, ajustes = { ...v };
      for (const k of PREFERENCIAS) { if (v?.[k] && R()) R()[k] = v[k]; delete ajustes[k]; }
      E.ajustesSesion = { ...ajustes, ...(aviso ? { avisoCerrada: aviso } : {}) };
      migrarProgresion(E);
    },
    falta: v => PREFERENCIAS.some(k => R()?.[k] && !v?.[k]),
  },
  progresion_sesion: { leer: () => E.progresionSesion || {}, poner: v => { E.progresionSesion = unirProgresion(E.progresionSesion, v); } },
  meta_peso: { leer: () => (E.metaPeso ? { kg: E.metaPeso } : {}), poner: v => { if (v?.kg) E.metaPeso = v.kg; else delete E.metaPeso; } },
  // El plan de la cuenta solo guarda ejercicios del catálogo: los propios y los del banco ampliado van aparte, con su
  // día y posición, y se reponen en el plan de otro teléfono.
  plan_propios: {
    leer: () => (E.plan?.libre ? {} : propiosDelPlan(E.plan)),
    poner: v => {
      if (E.plan?.dias?.length) E.plan = conPropiosGuardados(E.plan, v);
      if (JSON.stringify(v || {}).includes('"extra_')) asegurarExtras();
    },
  },
};
// Las medidas y la meta de peso son datos del cuerpo: solo con el permiso de las medidas.
const permitido = clave => ['seguimiento_molestias', 'chat_coach'].includes(clave) ? R()?.consentimiento_salud === true && E.consentimientos?.datos_salud !== false : !['medidas_cuerpo', 'meta_peso'].includes(clave) || E.consentimientos?.medidas_cuerpo === true;
const valorLocal = clave => LOCAL[clave].leer();
const tieneDatos = clave => { const v = valorLocal(clave); return Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0; };
const enLinea = () => !modoEjemplo && nube.hay() && nube.conectado() && ambitoDatos === nube.usuarioId();

// Una subida confirmada quita el pendiente, pero no vuelve vigente una lectura iniciada antes de la edición.
const revisiones = new WeakMap();
const revisionDe = clave => revisiones.get(E)?.[clave] || 0;
function revisarEdicion(clave) {
  const actuales = revisiones.get(E) || {};
  actuales[clave] = (actuales[clave] || 0) + 1;
  revisiones.set(E, actuales);
}

function contextoActual() {
  const estado = E, usuario = nube.usuarioId();
  const comprobar = () => {
    if (!enLinea() || E !== estado || nube.usuarioId() !== usuario) throw new Error('La cuenta cambió durante la sincronización de los datos del teléfono.');
  };
  return { usuario, comprobar, async consultar(fn) { comprobar(); const r = await fn(); comprobar(); return r; } };
}

// Dos ediciones de la misma clave salen en orden: una respuesta vieja no borra el pendiente de una nueva.
const subidas = new Map();
async function guardarDato(clave, contexto) {
  const llave = `${contexto.usuario}:${clave}`, anterior = subidas.get(llave) || Promise.resolve();
  const operacion = anterior.catch(() => {}).then(async () => {
    contexto.comprobar();
    if (!permitido(clave)) return;
    const pendiente = E.nubeDatos?.[clave];
    await contexto.consultar(() => nube.guardarDatoTelefono(clave, structuredClone(valorLocal(clave))));
    if (E.nubeDatos?.[clave] === pendiente) (E.nubeDatos ||= {})[clave] = { pendiente: false };
    guardar();
  });
  subidas.set(llave, operacion);
  try { await operacion; }
  finally { if (subidas.get(llave) === operacion) subidas.delete(llave); }
}

async function subir(clave) {
  if (!enLinea() || !permitido(clave)) return;
  try {
    await guardarDato(clave, contextoActual());
  } catch { /* queda pendiente: se sube al sincronizar */ }
}

// Un plan nuevo o editado con otros ejercicios propios: se suben al tiro.
alCambiarPlan.add((anterior, nuevo) => {
  if (!nuevo?.libre && JSON.stringify(propiosDelPlan(anterior)) !== JSON.stringify(propiosDelPlan(nuevo))) datoCambiado('plan_propios');
});

// La conversación cambia en muchos lugares (cada mensaje, cada propuesta que se acepta): en vez de avisar desde cada
// uno, se mira al guardar si lo que subiría es distinto de lo último que subió.
let huellaSubida = null;
alGuardar.add(() => {
  if (!enLinea() || !permitido('chat_coach')) return;
  const h = huellaChat(E.chat, E.chatBorrado || 0);
  if (huellaSubida === null) { huellaSubida = h; return; } // el primer guardado solo toma la referencia
  if (h === huellaSubida) return;
  huellaSubida = h;
  revisarEdicion('chat_coach');
  (E.nubeDatos ||= {}).chat_coach = { pendiente: true };
  subir('chat_coach');
});

/** Llamar después de cambiar cualquiera de las claves de LOCAL. */
export function datoCambiado(clave) {
  revisarEdicion(clave);
  (E.nubeDatos ||= {})[clave] = { pendiente: true };
  guardar();
  subir(clave);
}

/** Las fechas de la regla cambiaron (Me llegó). Solo con el seguimiento del ciclo activado. */
export async function cicloCambiado() {
  if (!enLinea() || R().seguimiento_ciclo !== true) return;
  try { await contextoActual().consultar(() => nube.guardarIniciosRegla(iniciosLocales())); } catch { /* al sincronizar se juntan */ }
}
const iniciosLocales = () => unirInicios([R().ultima_regla, ...(R().inicios_regla || [])]);

/** Al entrar o sincronizar: lo pendiente del teléfono sube; si no, manda lo de la cuenta. El ciclo se junta. */
export async function sincronizarDatosTelefono() {
  if (!enLinea()) return;
  const contexto = contextoActual();
  const alLeer = Object.fromEntries(Object.keys(LOCAL).map(clave => [clave, revisionDe(clave)]));
  const filas = await contexto.consultar(() => nube.cargarDatosTelefono());
  for (const clave of Object.keys(LOCAL)) {
    if (!permitido(clave)) continue;
    const fila = filas.find(f => f.clave === clave);
    if (['progresion_sesion', 'feed_vistas', 'seguimiento_molestias', 'descansos', 'chat_coach'].includes(clave) && fila) LOCAL[clave].poner(fila.valor, revisionDe(clave) !== alLeer[clave]);
    if (E.nubeDatos?.[clave]?.pendiente || (!fila && tieneDatos(clave))) {
      await guardarDato(clave, contexto);
      contexto.comprobar();
    } else if (fila && revisionDe(clave) === alLeer[clave]) {
      const falta = LOCAL[clave].falta?.(fila.valor);
      LOCAL[clave].poner(fila.valor);
      if (falta || E.nubeDatos?.[clave]?.pendiente) { (E.nubeDatos ||= {})[clave] = { pendiente: true }; await guardarDato(clave, contexto); contexto.comprobar(); }
    }
  }
  if (R().seguimiento_ciclo === true) {
    const remotos = await contexto.consultar(() => nube.cargarIniciosRegla());
    const juntos = unirInicios([...iniciosLocales(), ...remotos]);
    if (juntos.length) { R().inicios_regla = juntos.slice(-12); R().ultima_regla = juntos.at(-1); }
    if (juntos.join() !== [...remotos].sort().join()) await contexto.consultar(() => nube.guardarIniciosRegla(juntos.slice(-12)));
  }
  contexto.comprobar();
  alinearPropios();
  guardar();
}

/** Las ausentes solo se eliminan cuando el llamador ya recibió el historial completo de la cuenta. */
export function limpiarProgresionSesion(sesiones = null) {
  const limpia = limpiarProgresion(E.progresionSesion, { sesiones });
  if (JSON.stringify(limpia) === JSON.stringify(E.progresionSesion || {})) return false;
  E.progresionSesion = limpia;
  datoCambiado('progresion_sesion');
  return true;
}
