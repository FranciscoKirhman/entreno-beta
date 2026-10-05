// Lo que antes quedaba solo en el teléfono ahora también va a la cuenta (si la persona entró): ejercicios propios,
// medidas del cuerpo, notas fijas y las fechas de la regla. Cada cambio se sube al tiro; si no hay señal, queda
// pendiente y se sube al sincronizar. Al entrar en otro teléfono, se baja lo de la cuenta. Las medidas y el ciclo
// son datos de salud: solo se suben con su permiso.
import { E, R, guardar, modoEjemplo, ambitoDatos, alinearPropios } from './comun.js';
import { unirInicios } from '../nucleo/ciclo-menstrual.js';
import * as nube from './nube.js';

// clave en la cuenta → [campo en E, valor vacío]
const LOCAL = { ejercicios_propios: ['ejerciciosPropios', []], medidas_cuerpo: ['medidas', []], notas_fijas: ['notasFijas', {}] };
const permitido = clave => clave !== 'medidas_cuerpo' || E.consentimientos?.medidas_cuerpo === true;
const valorLocal = clave => E[LOCAL[clave][0]] ?? LOCAL[clave][1];
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

/** Llamar después de cambiar ejercicios propios, medidas o notas fijas. */
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
    if (E.nubeDatos?.[clave]?.pendiente || (!fila && tieneDatos(clave))) {
      await guardarDato(clave, contexto);
      contexto.comprobar();
    } else if (fila && revisionDe(clave) === alLeer[clave]) E[LOCAL[clave][0]] = fila.valor;
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
