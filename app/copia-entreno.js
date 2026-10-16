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

// ── Sin espacio en el almacenamiento principal ─────────────────────────────────────────────────────────────
// Safari da unos 5 MB por sitio a localStorage, y ahí conviven copias completas: la activa, otras cuentas o
// perfiles de prueba, el ejemplo y las copias de seguridad de una recuperación. Cuando el guardado de la activa no
// cabe, las demás se pasan a IndexedDB (que tiene mucho más espacio) y se quitan del principal. Al volver a abrir
// otra cuenta o perfil, comun.js la recupera desde su copia de IndexedDB (nucleo/copia-segura.js).
const guardadoEnDe = texto => { try { return Number(JSON.parse(texto)?.guardadoEn) || 0; } catch { return 0; } };

/** Pasa a IndexedDB las claves completas que se pueden mover (sePuedeMover) y las quita del principal. Cada una
 *  queda en la tabla de copias con su misma clave, como su segunda copia de siempre. Devuelve los bytes liberados. */
export async function liberarEspacio(sePuedeMover) {
  let liberados = 0;
  const claves = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && sePuedeMover(k)) claves.push(k); }
  for (const k of claves) {
    const texto = localStorage.getItem(k);
    if (!texto || texto.length < 20000) continue; // ajustes chicos (tema, acento, enlaces): se quedan
    try {
      const copia = await pedir('readonly', s => s.get(k));
      // Se escribe la copia si no hay o si la del principal es más nueva; recién después se quita del principal.
      if (!copia || (Number(copia.guardadoEn) || 0) < guardadoEnDe(texto)) {
        await pedir('readwrite', s => s.put({ guardadoEn: guardadoEnDe(texto) || Date.now(), texto }, k));
      }
      const escrita = await pedir('readonly', s => s.get(k));
      if (escrita?.texto === texto || (Number(escrita?.guardadoEn) || 0) >= guardadoEnDe(texto)) { localStorage.removeItem(k); leidas.delete(k); liberados += texto.length; }
    } catch { /* sin IndexedDB: esa clave se queda en el principal */ }
  }
  return liberados;
}

/** Cuánto ocupa cada clave del principal (para Perfil, Mis datos, y para avisar sin espacio). */
export function usoAlmacenamiento() {
  const claves = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); claves.push({ clave: k, bytes: (localStorage.getItem(k) || '').length * 2 }); } } catch { /* sin acceso */ }
  return { total: claves.reduce((a, c) => a + c.bytes, 0), claves: claves.sort((a, b) => b.bytes - a.bytes) };
}

/** Guarda una copia de seguridad aparte (por ejemplo, la anterior a una recuperación de cuenta) en IndexedDB, que tiene
 *  más espacio que el principal. */
export const guardarAparte = (clave, texto) => pedir('readwrite', s => s.put({ guardadoEn: Date.now(), texto }, clave));
