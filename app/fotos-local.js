// Fotos de progreso sin cuenta: quedan en este navegador (IndexedDB) y no salen del teléfono.
const BASE = 'entreno-fotos', TABLA = 'fotos';

function abrir() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TABLA, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function tx(modo, fn) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const t = db.transaction(TABLA, modo);
    const res = fn(t.objectStore(TABLA));
    t.oncomplete = () => ok(res?.result ?? res);
    t.onerror = () => mal(t.error);
  });
}
export const guardarFotoLocal = ({ fecha, angulo, archivo }) =>
  tx('readwrite', s => s.put({ id: `${fecha}-${Date.now()}`, fecha, angulo, blob: archivo }));
export async function listarFotosLocales() {
  const filas = await tx('readonly', s => s.getAll());
  return filas.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map(f => ({ ...f, url: URL.createObjectURL(f.blob) }));
}
export const borrarFotoLocal = id => tx('readwrite', s => s.delete(id));
