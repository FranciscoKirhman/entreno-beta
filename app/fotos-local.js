// Fotos de progreso sin cuenta: quedan en este navegador (IndexedDB) y no salen del teléfono. También guarda,
// mientras esperan subir a la cuenta, los archivos de las indicaciones médicas (app/cola.js).
const BASE = 'entreno-fotos', TABLA = 'fotos', ARCHIVOS = 'archivos';

function abrir() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BASE, 2);
    r.onupgradeneeded = () => {
      for (const t of [TABLA, ARCHIVOS]) if (!r.result.objectStoreNames.contains(t)) r.result.createObjectStore(t, { keyPath: 'id' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function tx(modo, fn, tabla = TABLA) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const t = db.transaction(tabla, modo);
    const res = fn(t.objectStore(tabla));
    t.oncomplete = () => ok(res?.result ?? res);
    t.onerror = () => mal(t.error);
  });
}
export const guardarFotoLocal = ({ id, fecha, angulo, archivo }) =>
  tx('readwrite', s => s.put({ id: id || `${fecha}-${Date.now()}`, fecha, angulo, blob: archivo }));
export async function listarFotosLocales() {
  const filas = await tx('readonly', s => s.getAll());
  return filas.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map(f => ({ ...f, url: URL.createObjectURL(f.blob) }));
}
export const borrarFotoLocal = id => tx('readwrite', s => s.delete(id));

// Archivos que esperan subir a la cuenta.
export const guardarArchivoLocal = (id, archivo) => tx('readwrite', s => s.put({ id, archivo }), ARCHIVOS);
export const leerArchivoLocal = async id => (await tx('readonly', s => s.get(id), ARCHIVOS))?.archivo || null;
export const borrarArchivoLocal = id => tx('readwrite', s => s.delete(id), ARCHIVOS);

/** Fotos y estado: abortar IndexedDB conserva las fotos anteriores; el llamador recupera el estado. */
export async function restaurarFotosAtomicas(fotos, confirmarEstado) {
  const db = await abrir();
  try {
    await new Promise((ok, mal) => {
      const t = db.transaction(TABLA, 'readwrite');
      t.oncomplete = () => ok();
      t.onabort = t.onerror = () => mal(t.error || new Error('La restauración se canceló'));
      try {
        const tabla = t.objectStore(TABLA);
        for (const f of fotos) tabla.put(f);
        confirmarEstado();
      } catch (e) { t.abort(); mal(e); }
    });
  } finally { db.close(); }
}
