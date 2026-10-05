// Lo que antes quedaba solo en el teléfono ahora también va a la cuenta (si la persona entró): ejercicios propios,
// medidas del cuerpo, notas fijas y las fechas de la regla. Cada cambio se sube al tiro; si no hay señal, queda
// pendiente y se sube al sincronizar. Al entrar en otro teléfono, se baja lo de la cuenta. Las medidas y el ciclo
// son datos de salud: solo se suben con su permiso.
import { E, R, guardar, modoEjemplo, alinearPropios } from './comun.js';
import { unirInicios } from '../nucleo/ciclo-menstrual.js';
import * as nube from './nube.js';

// clave en la cuenta → [campo en E, valor vacío]
const LOCAL = { ejercicios_propios: ['ejerciciosPropios', []], medidas_cuerpo: ['medidas', []], notas_fijas: ['notasFijas', {}] };
const permitido = clave => clave !== 'medidas_cuerpo' || E.consentimientos?.medidas_cuerpo === true;
const valorLocal = clave => E[LOCAL[clave][0]] ?? LOCAL[clave][1];
const tieneDatos = clave => { const v = valorLocal(clave); return Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0; };
const enLinea = () => !modoEjemplo && nube.hay() && nube.conectado();

async function subir(clave) {
  if (!enLinea() || !permitido(clave)) return;
  const estado = E;
  try {
    await nube.guardarDatoTelefono(clave, valorLocal(clave));
    if (E === estado) { (E.nubeDatos ||= {})[clave] = { pendiente: false }; guardar(); }
  } catch { /* queda pendiente: se sube al sincronizar */ }
}

/** Llamar después de cambiar ejercicios propios, medidas o notas fijas. */
export function datoCambiado(clave) {
  (E.nubeDatos ||= {})[clave] = { pendiente: true };
  guardar();
  subir(clave);
}

/** Las fechas de la regla cambiaron (Me llegó). Solo con el seguimiento del ciclo activado. */
export async function cicloCambiado() {
  if (!enLinea() || R().seguimiento_ciclo !== true) return;
  try { await nube.guardarIniciosRegla(iniciosLocales()); } catch { /* al sincronizar se juntan */ }
}
const iniciosLocales = () => unirInicios([R().ultima_regla, ...(R().inicios_regla || [])]);

/** Al entrar o sincronizar: lo pendiente del teléfono sube; si no, manda lo de la cuenta. El ciclo se junta. */
export async function sincronizarDatosTelefono() {
  if (!enLinea()) return;
  const filas = await nube.cargarDatosTelefono();
  for (const clave of Object.keys(LOCAL)) {
    if (!permitido(clave)) continue;
    const fila = filas.find(f => f.clave === clave);
    if (E.nubeDatos?.[clave]?.pendiente || (!fila && tieneDatos(clave))) {
      await nube.guardarDatoTelefono(clave, valorLocal(clave));
      (E.nubeDatos ||= {})[clave] = { pendiente: false };
    } else if (fila) E[LOCAL[clave][0]] = fila.valor;
  }
  if (R().seguimiento_ciclo === true) {
    const remotos = await nube.cargarIniciosRegla();
    const juntos = unirInicios([...iniciosLocales(), ...remotos]);
    if (juntos.length) { R().inicios_regla = juntos.slice(-12); R().ultima_regla = juntos.at(-1); }
    if (juntos.join() !== [...remotos].sort().join()) await nube.guardarIniciosRegla(juntos.slice(-12));
  }
  alinearPropios();
  guardar();
}
