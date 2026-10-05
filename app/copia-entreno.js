// Segunda copia de todo lo anotado, en IndexedDB, aparte del almacenamiento principal (localStorage). El principal
// se guarda en cada tecla (app/comun.js: guardar); esta copia se escribe un instante después de escribir y de
// inmediato cuando la app pasa al fondo o se cierra. Si al abrir el principal quedó atrás (el teléfono lo borró o una
// escritura falló), comun.js la recupera (nucleo/copia-segura.js decide cuál usar). No guarda nada fuera del teléfono.

const BASE = 'entreno-copia', TABLA = 'copias', ESPERA_MS = 400;
let base = null;
const abrir = () => (base ||= new Promise((ok, mal) => {
  if (typeof indexedDB === 'undefined') return mal(new Error('Sin IndexedDB'));
  const r = indexedDB.open(BASE, 1);
  r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TABLA)) r.result.createObjectStore(TABLA); };
  r.onsuccess = () => ok(r.result);
  r.onerror = () => mal(r.error);
}));
const pedir = (modo, hacer) => abrir().then(db => new Promise((ok, mal) => {
  const tx = db.transaction(TABLA, modo), r = hacer(tx.objectStore(TABLA));
  tx.oncomplete = () => ok(r?.result);
  tx.onerror = () => mal(tx.error);
  tx.onabort = () => mal(tx.error);
}));

// Antes de escribir una copia hay que haberla leído: si el principal se perdió, la copia anterior es lo que se recupera.
const leidas = new Map();
/** Lee la copia de una clave; al volver a ese ámbito se pide una lectura nueva antes de escribir. */
export function leerCopia(clave, { renovar = false } = {}) {
  if (renovar || !leidas.has(clave)) leidas.set(clave, pedir('readonly', s => s.get(clave)).then(x => x || null).catch(() => null));
  return leidas.get(clave);
}

let pendiente = null, temporizador = 0;
/** Programa la copia del estado ya convertido a texto (la última gana). */
export function escribirCopia(clave, texto, guardadoEn) {
  pendiente = { clave, texto, guardadoEn };
  if (!temporizador) temporizador = setTimeout(vaciarCopia, ESPERA_MS);
}
/** Escribe ahora la copia pendiente (al pasar al fondo o cerrar la app). */
export async function vaciarCopia() {
  clearTimeout(temporizador); temporizador = 0;
  const p = pendiente; pendiente = null;
  if (!p) return;
  await leerCopia(p.clave);
  try { await pedir('readwrite', s => s.put({ guardadoEn: p.guardadoEn, texto: p.texto }, p.clave)); }
  catch { /* sin IndexedDB: queda el almacenamiento principal */ }
}

// Al pasar al fondo (cambiar de app, bloquear el teléfono) o cerrar, la copia se escribe de inmediato.
if (typeof document !== 'undefined') {
  // comun.js guarda la memoria en otro listener: se espera a que terminen todos antes de vaciar la copia.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') queueMicrotask(vaciarCopia); });
  addEventListener('pagehide', () => { queueMicrotask(vaciarCopia); });
}
// Pide al teléfono que no borre solo el almacenamiento de la app (si lo permite; si no, no pasa nada).
try { if (navigator.storage?.persist && navigator.storage.persisted) navigator.storage.persisted().then(si => si || navigator.storage.persist()).catch(() => {}); } catch { /* sin permiso */ }
