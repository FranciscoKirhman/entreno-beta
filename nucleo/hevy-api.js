// Hevy entra solo, como en el tablero: con la clave de la API de Hevy Pro, la app trae los entrenamientos nuevos sin
// exportar el archivo. La API acepta llamadas desde el navegador, así que no hace falta servidor. Las sesiones quedan
// igual que las importadas del CSV (misma clave de fecha, hora y título), así nunca se duplican.
import { buscar } from './catalogo.js';
import { aFilas, claveSesion } from './hevy-csv.js';

export const API_HEVY = 'https://api.hevyapp.com/v1';

/** Instante con zona (API de Hevy) → hora local de Chile, 'AAAA-MM-DDTHH:MM' (como el CSV). */
export function horaLocal(instante, zona = 'America/Santiago') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(instante)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const yaEsta = (existentes) => {
  const ids = new Set(existentes.map(e => e.id_externo).filter(Boolean));
  const claves = new Set(existentes.map(e => e.clave).filter(Boolean));
  return w => ids.has(w.id) || claves.has(claveSesion({ ...w, start_time: horaLocal(w.start_time) }));
};

/**
 * Entrenamientos de la API → sesiones del teléfono, sin las que ya estaban.
 * @param nombresIngles Map de exercise_template_id → nombre en inglés (para los que llegan con nombre en español)
 * @returns {{nuevas, sinCatalogo: string[]}}
 */
export function sesionesDesdeApi(ws, indice, existentes = [], nombresIngles = new Map()) {
  const esta = yaEsta(existentes);
  const sinCatalogo = new Set();
  const nuevas = ws.filter(w => !esta(w)).map(w0 => {
    const w = { ...w0, start_time: horaLocal(w0.start_time), end_time: horaLocal(w0.end_time) };
    const { sesion, series } = aFilas(w, indice, 'hevy_api');
    w.exercises.forEach(e => {
      if (buscar(indice, e.title)) return;
      const id = buscar(indice, nombresIngles.get(e.exercise_template_id) || '')?.id;
      for (const x of series) if (x.ejercicio_nombre === e.title && !x.ejercicio_id) x.ejercicio_id = id ?? null;
    });
    series.filter(x => !x.ejercicio_id).forEach(x => sinCatalogo.add(x.ejercicio_nombre));
    return {
      id: `hevy-${w0.id}`, origen: 'hevy', id_externo: w0.id, clave: claveSesion(w), fecha: w.start_time.slice(0, 10), hora: w.start_time.slice(11, 16),
      titulo: sesion.titulo, duracion_min: sesion.duracion_min, comentario: sesion.comentario, notas: [],
      series: series.map(s => ({ ...s, rir: s.tipo === 'fallo' ? 0 : s.rpe != null ? Math.max(0, 10 - s.rpe) : null })),
    };
  }).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return { nuevas, sinCatalogo: [...sinCatalogo] };
}

/**
 * Trae de la API los entrenamientos que faltan. Vienen del más nuevo al más antiguo: se para en la primera página
 * en que ya estaban todos (o al llegar al final).
 * @param pedir (url, opciones) => Promise<Response>, para probar sin red
 */
export async function traerDeHevy(clave, existentes, indice, { pedir = fetch, maxPaginas = 60 } = {}) {
  const cabeza = { headers: { 'api-key': clave, accept: 'application/json' } };
  const esta = yaEsta(existentes);
  const ws = [];
  for (let n = 1; n <= maxPaginas; n++) {
    const r = await pedir(`${API_HEVY}/workouts?page=${n}&pageSize=10`, cabeza);
    if (r.status === 401 || r.status === 403) throw new Error('Hevy no aceptó la clave. Revísala en Hevy: Ajustes, Desarrollador.');
    if (r.status === 404) break;
    if (!r.ok) throw new Error(`Hevy no respondió bien (${r.status}). Intenta de nuevo más rato.`);
    const j = await r.json();
    const pagina = j.workouts || [];
    ws.push(...pagina);
    if (!pagina.length || pagina.every(esta) || n >= (j.page_count || n)) break;
  }
  // Las sesiones antiguas pueden venir con nombres en español: la plantilla de Hevy da el nombre en inglés.
  const nombresIngles = new Map();
  for (const w of ws.filter(x => !esta(x))) for (const e of w.exercises) {
    if (buscar(indice, e.title) || nombresIngles.has(e.exercise_template_id)) continue;
    const r = await pedir(`${API_HEVY}/exercise_templates/${e.exercise_template_id}`, cabeza);
    nombresIngles.set(e.exercise_template_id, r.ok ? (await r.json()).title : null);
  }
  return { total: ws.length, ...sesionesDesdeApi(ws, indice, existentes, nombresIngles) };
}
