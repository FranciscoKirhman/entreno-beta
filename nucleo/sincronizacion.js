// Conversión y unión del historial. La copia pendiente del teléfono prevalece hasta que se confirma su subida.
import { claveDesdeInstante } from './hevy-csv.js';
export const esUuid = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '');
export function prepararSesion(s, nuevoId = () => crypto.randomUUID()) {
  if (s.origen === 'ejemplo') throw new Error('El historial ficticio no se sube a una cuenta.');
  return { ...s, id: esUuid(s.id) ? s.id : nuevoId(), notas: s.notas || [], series: s.series || [] };
}
export function sesionDelServidor(s) {
  const clave = claveDesdeInstante(s.inicio, s.titulo);
  const [fecha, hora] = clave.split('|');
  const [hm, am] = hora.split(' '), [h, m] = hm.split(':');
  const hh = Number(h) % 12 + (am === 'PM' ? 12 : 0);
  return { id: s.id, fecha, hora: `${String(hh).padStart(2, '0')}:${m}`, titulo: s.titulo,
    duracion_min: s.duracion_min, comentario: s.comentario, id_externo: s.id_externo, clave,
    ...(s.origen === 'app' ? {} : { origen: s.origen.startsWith('hevy') ? 'hevy' : s.origen }),
    enCuenta: true, series: (s.series || []).sort((a, b) => a.orden - b.orden).map(({ id, user_id, sesion_id, ...x }) => x),
    notas: (s.notas_ejercicio || []).map(({ id, user_id, sesion_id, creado, ...x }) => x) };
}
export function unirSesiones(locales, remotas, pendientes = []) {
  const porId = new Map(locales.filter(s => s.origen !== 'ejemplo').map(s => [s.id, s]));
  const falta = new Set(pendientes.filter(p => p.tipo === 'sesion').map(p => p.clave));
  for (const s of remotas) if (!falta.has(s.id) && (!porId.has(s.id) || porId.get(s.id)?.enCuenta)) porId.set(s.id, s);
  return [...porId.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''));
}
