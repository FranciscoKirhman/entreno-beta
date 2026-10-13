// Traer el historial de Strong y FitNotes (sus exportaciones CSV), como permite OpenGym: cada archivo se pasa a la
// misma forma que la exportación de Hevy y sigue su camino (aFilas, sin repetir por fecha, hora y título). Los nombres
// que no calzan con el catálogo quedan con su nombre y sin id, igual que en Hevy.
//
// Strong: Perfil → Ajustes → Exportar datos (strong.csv). FitNotes: Ajustes → Copia de seguridad → Exportar CSV.
import { aIso, parsearFecha, sesionesNuevas, aFilas, claveSesion } from './hevy-csv.js';

const LB = 0.45359237, MILLA = 1609.344;

/** CSV con comillas (RFC 4180) y el separador que traiga el archivo (Strong en algunos idiomas usa punto y coma). */
export function leerCsv(texto) {
  const t = texto.replace(/^﻿/, '');
  const primera = t.split(/\r?\n/, 1)[0];
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ',';
  const filas = [];
  let fila = [], campo = '', comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  const [cabecera = [], ...resto] = filas;
  return resto.filter(f => f.length > 1 || f[0] !== '').map(f => Object.fromEntries(cabecera.map((k, j) => [k.trim(), (f[j] ?? '').trim()])));
}

const num = x => {
  const s = String(x ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
/** La columna cuyo nombre empieza con alguno de estos (sin importar mayúsculas): "Weight", "Weight (kg)"… */
const columna = (r, ...nombres) => Object.keys(r).find(k => nombres.some(n => k.toLowerCase().startsWith(n.toLowerCase())));

/** Qué app exportó el archivo, por su primera línea: 'hevy', 'strong', 'fitnotes' o null. */
export function detectarApp(texto) {
  const p = texto.replace(/^﻿/, '').split(/\r?\n/, 1)[0].toLowerCase();
  if (p.includes('exercise_title') && p.includes('start_time')) return 'hevy';
  if (p.includes('workout name') && p.includes('exercise name')) return 'strong';
  if (p.includes('exercise') && p.includes('category') && p.includes('date')) return 'fitnotes';
  return null;
}

/** "1h 5m", "65m", "45 min", "3900" (segundos) → minutos. */
function minutosDe(s) {
  const t = String(s || '').toLowerCase();
  const h = t.match(/(\d+)\s*h/), m = t.match(/(\d+)\s*m/);
  if (h || m) return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
  const n = num(t);
  return n == null ? 0 : n > 300 ? Math.round(n / 60) : n;
}
/** "0:01:30", "1:30" o "90" → segundos. */
function segundosDe(s) {
  const t = String(s || '').trim();
  if (!t) return null;
  if (t.includes(':')) return t.split(':').map(Number).reduce((a, x) => a * 60 + (x || 0), 0) || null;
  return num(t);
}
const sumarMinutos = (local, min) => {
  const d = new Date(`${local}:00Z`); d.setUTCMinutes(d.getUTCMinutes() + min);
  return d.toISOString().slice(0, 16);
};

/** Agrega una serie al entrenamiento w, al ejercicio en curso o a uno nuevo si cambió. */
function agregarSerie(w, titulo, notas, serie) {
  const exs = w.exercises;
  if (!exs.length || exs.at(-1).title !== titulo) exs.push({ title: titulo, index: exs.length, notes: notas || '', sets: [] });
  const e = exs.at(-1);
  e.sets.push({ index: e.sets.length, ...serie });
}

/** Strong: una fila por serie; la sesión es la fecha con hora más el nombre del entrenamiento. */
export function sesionesDeStrong(texto, { unidad = 'kg', zona = 'America/Santiago' } = {}) {
  const ses = new Map();
  for (const r of leerCsv(texto)) {
    const fecha = r[columna(r, 'date')], ejercicio = r[columna(r, 'exercise name')];
    if (!fecha || !ejercicio) continue;
    const orden = String(r[columna(r, 'set order')] ?? '').trim().toUpperCase();
    if (orden && !/^(\d+|W|D|F)$/.test(orden)) continue; // filas de temporizador u otras que no son series
    const ini = parsearFecha(fecha), titulo = r[columna(r, 'workout name')] || 'Entrenamiento';
    const clave = `${ini}|${titulo}`;
    if (!ses.has(clave)) {
      ses.set(clave, { id: `strong-${ini.replace(/[-T:]/g, '')}`, title: titulo, start_time: aIso(ini, zona),
        end_time: aIso(sumarMinutos(ini, minutosDe(r[columna(r, 'duration')])), zona), description: r[columna(r, 'workout notes')] || '', exercises: [] });
    }
    const colPeso = columna(r, 'weight'), enLibras = /lb/i.test(colPeso || '') || (!/kg/i.test(colPeso || '') && unidad === 'lb');
    const peso = num(r[colPeso]), colDist = columna(r, 'distance'), dist = num(r[colDist]);
    agregarSerie(ses.get(clave), ejercicio, r[columna(r, 'notes')], {
      weight_kg: peso ? (enLibras ? peso * LB : peso) : null,
      reps: num(r[columna(r, 'reps')]) != null ? Math.trunc(num(r[columna(r, 'reps')])) : null,
      duration_seconds: num(r[columna(r, 'seconds')]) || null,
      distance_meters: dist ? dist * (/mi/i.test(colDist) ? MILLA : /km/i.test(colDist) || !/m\b|\(m\)/i.test(colDist) ? 1000 : 1) : null,
      rpe: num(r[columna(r, 'rpe')]),
      set_type: { W: 'warmup', D: 'dropset', F: 'failure' }[orden] || 'normal',
    });
  }
  return [...ses.values()];
}

/** FitNotes: una fila por serie y sin hora; cada día es una sesión. */
export function sesionesDeFitNotes(texto, { zona = 'America/Santiago' } = {}) {
  const ses = new Map();
  for (const r of leerCsv(texto)) {
    const fecha = r[columna(r, 'date')], ejercicio = r[columna(r, 'exercise')];
    if (!fecha || !ejercicio) continue;
    const ini = `${parsearFecha(fecha).slice(0, 10)}T12:00`;
    if (!ses.has(ini)) ses.set(ini, { id: `fitnotes-${ini.slice(0, 10).replace(/-/g, '')}`, title: 'Entrenamiento', start_time: aIso(ini, zona), end_time: aIso(ini, zona), description: '', exercises: [], categorias: new Set() });
    const w = ses.get(ini);
    if (r[columna(r, 'category')]) w.categorias.add(r[columna(r, 'category')]);
    const colPeso = columna(r, 'weight'), unidadPeso = r[columna(r, 'weight unit')] || colPeso || '';
    const peso = num(r[colPeso]), dist = num(r[columna(r, 'distance')]), uDist = r[columna(r, 'distance unit')] || '';
    agregarSerie(w, ejercicio, r[columna(r, 'comment')], {
      weight_kg: peso ? (/lb/i.test(unidadPeso) ? peso * LB : peso) : null,
      reps: num(r[columna(r, 'reps')]) != null ? Math.trunc(num(r[columna(r, 'reps')])) : null,
      duration_seconds: segundosDe(r[columna(r, 'time')]),
      distance_meters: dist ? dist * (/mi/i.test(uDist) ? MILLA : /km/i.test(uDist) ? 1000 : 1) : null,
      rpe: null, set_type: 'normal',
    });
  }
  return [...ses.values()].map(({ categorias, ...w }) => ({ ...w, title: categorias.size ? [...categorias].slice(0, 3).join(', ') : w.title }));
}

const NOMBRE_APP = { strong: 'Strong', fitnotes: 'FitNotes' };

/**
 * Strong o FitNotes → sesiones del teléfono, sin repetir las que ya se trajeron de esa app.
 * @returns {{app, nombre, nuevas, total, sinCatalogo: string[]}}
 */
export function importarOtraApp(texto, indice, existentes = [], { unidad = 'kg' } = {}) {
  const app = detectarApp(texto);
  if (app !== 'strong' && app !== 'fitnotes') throw new Error('Ese archivo no es una exportación de Strong ni de FitNotes.');
  const ws = app === 'strong' ? sesionesDeStrong(texto, { unidad }) : sesionesDeFitNotes(texto);
  const ya = existentes.filter(s => s.origen === app).map(s => ({ id_externo: s.id_externo, clave: s.clave }));
  const sinCatalogo = new Set();
  const nuevas = sesionesNuevas(ws, ya).map(w => {
    const { sesion, series } = aFilas(w, indice, app);
    series.filter(s => !s.ejercicio_id).forEach(s => sinCatalogo.add(s.ejercicio_nombre));
    return {
      id: `${app}-${w.id}`, origen: app, id_externo: w.id, clave: claveSesion(w), fecha: w.start_time.slice(0, 10), hora: app === 'fitnotes' ? null : w.start_time.slice(11, 16),
      titulo: sesion.titulo, duracion_min: sesion.duracion_min || null, comentario: sesion.comentario, notas: [],
      series: series.map(s => ({ ...s, rir: s.tipo === 'fallo' ? 0 : s.rpe != null ? Math.max(0, 10 - s.rpe) : null })),
    };
  });
  return { app, nombre: NOMBRE_APP[app], nuevas, total: ws.length, sinCatalogo: [...sinCatalogo] };
}
