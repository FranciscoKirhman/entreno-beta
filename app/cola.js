// Lo que tiene que subir a la cuenta y no pudo (nucleo/cola.js): sesiones e indicaciones médicas. Se reintenta
// solo al abrir la app, al volver la señal, al volver a la app y después de una espera que va creciendo.
import { E, guardar, ambitoDatos, modoEjemplo } from './comun.js';
import { encolar, procesarCola, juntarCola, proximoIntento, detenidos } from '../nucleo/cola.js';
import { leerArchivoLocal, borrarArchivoLocal } from './fotos-local.js';
import * as nube from './nube.js';

let enCurso = null, reloj = null;
const sinRed = e => Object.assign(e instanceof Error ? e : new Error(e?.message || String(e)),
  { sinRed: !navigator.onLine || /fetch|network|load failed|conexi/i.test(e?.message || '') });

async function subir({ tipo, clave, datos }) {
  const estado = E;
  try {
    if (tipo === 'sesion') await nube.registrarSesion({ id: clave, ...datos });
    else if (tipo === 'bienestar') await nube.guardarBienestar(clave, datos);
    else if (tipo === 'indicacion') {
      const archivo = datos.archivoPendiente ? await leerArchivoLocal(clave) : null;
      const ruta = await nube.guardarIndicacion({ ...datos, id: clave }, archivo);
      if (E !== estado) return;
      if (archivo) await borrarArchivoLocal(clave);
      const ind = E.indicaciones.find(i => i.id === clave);
      if (ind) { ind.archivo = ruta; delete ind.archivoPendiente; }
    }
    else throw new Error('Tipo de dato pendiente desconocido; no se ha borrado de la cola.');
  } catch (e) { throw sinRed(e); }
}

function marcarSubido({ tipo, clave }) {
  if ((E.pendientes || []).some(x => x.tipo === tipo && x.clave === clave)) return;
  if (tipo === 'bienestar') { if (E.bienestar[clave]) E.bienestar[clave].enCuenta = true; return; }
  const lista = tipo === 'sesion' ? E.sesiones : tipo === 'indicacion' ? E.indicaciones : [];
  const x = lista.find(y => y.id === clave);
  if (x) x.enCuenta = true;
}

/** Deja algo para subir, sin intentarlo todavía. */
export function dejarPendiente(tipo, clave, datos) { E.pendientes = encolar(E.pendientes || [], { tipo, clave, datos }); guardar(); }

/** Deja algo para subir y lo intenta de inmediato. Devuelve true si quedó en la cuenta. */
export async function subirACuenta(tipo, clave, datos) {
  E.pendientes = encolar(E.pendientes || [], { tipo, clave, datos });
  guardar();
  await subirPendientes();
  return !(E.pendientes || []).some(x => x.tipo === tipo && x.clave === clave);
}

/** Intenta lo que toca. `forzar`: todo, aunque esté esperando o se haya detenido. Si ya hay una vuelta
 *  corriendo, espera a que termine y hace otra (así lo recién anotado no se queda afuera). */
export async function subirPendientes({ forzar = false } = {}) {
  while (enCurso) await enCurso.catch(() => {});
  if (modoEjemplo || !nube.conectado() || ambitoDatos !== nube.usuarioId() || !E.pendientes?.length) return null;
  const estado = E, usuario = nube.usuarioId();
  enCurso = (async () => {
    const antes = E.pendientes;
    const r = await procesarCola(antes, x => {
      if (E !== estado || nube.usuarioId() !== usuario) throw Object.assign(new Error('La cuenta cambió; el elemento sigue pendiente en su cuenta original.'), { sinRed: true });
      return subir(x);
    }, { forzar });
    if (E !== estado || nube.usuarioId() !== usuario) return r;
    E.pendientes = juntarCola(r.cola, antes, E.pendientes || []);
    r.subidos.forEach(marcarSubido);
    guardar();
    return r;
  })();
  try { return await enCurso; }
  finally {
    enCurso = null;
    clearTimeout(reloj);
    const t = proximoIntento(E.pendientes || []);
    if (t != null && nube.conectado()) reloj = setTimeout(() => subirPendientes(), Math.max(5000, t - Date.now()));
  }
}

/** Resumen para mostrar: cuántos esperan y el último error. */
export function estadoCola() {
  const c = E.pendientes || [];
  return { total: c.length, sesiones: c.filter(x => x.tipo === 'sesion').length, indicaciones: c.filter(x => x.tipo === 'indicacion').length, bienestar: c.filter(x => x.tipo === 'bienestar').length,
    detenidos: detenidos(c).length, error: c.find(x => x.error)?.error || null };
}

addEventListener('online', () => subirPendientes({ forzar: true }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') subirPendientes(); });
