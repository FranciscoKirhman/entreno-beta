// Port de src/hevy_csv.py del tablero: lee la exportación CSV de Hevy (workout_data.csv).
// En la app el archivo se lee en el teléfono y solo suben las sesiones nuevas.
//
// En Hevy: Perfil → Ajustes → Exportar e importar datos → Exportar entrenamientos.
import { buscar } from './catalogo.js';

const MESES = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7,
  aug: 8, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12,
};

/** CSV según RFC 4180: comillas, comas y saltos de línea dentro de comillas. Devuelve objetos por fila. */
export function parsearCsv(texto) {
  const t = texto.replace(/^﻿/, '');
  const filas = [];
  let fila = [], campo = '', comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  const [cabecera, ...resto] = filas;
  return resto.filter(f => f.length > 1 || f[0] !== '')
    .map(f => Object.fromEntries(cabecera.map((k, j) => [k, f[j] ?? ''])));
}

export const esExportacionHevy = texto => {
  const primera = texto.replace(/^﻿/, '').split(/\r?\n/, 1)[0];
  return primera.includes('exercise_title') && primera.includes('start_time');
};

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** '28 May 2026, 18:05', 'Sep 20, 2026 at 2:51 PM', '20 sept 2026, 14:51' o ISO → hora local sin zona,
 *  como 'AAAA-MM-DDTHH:MM'. */
export function parsearFecha(s) {
  s = String(s || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4] || '00'}:${iso[5] || '00'}`;
  const m = s.match(/(\d{1,2})\s+([A-Za-zé]{3,})\.?\s+(\d{4})/) || s.match(/([A-Za-zé]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  const h = m && s.slice(m.index + m[0].length).match(/(\d{1,2}):(\d{2})\s*([ap]\.?\s*m\.?)?/i);
  if (!m || !h) throw new Error(`fecha que no reconozco: ${JSON.stringify(s)}`);
  const [a, b, anio] = m.slice(1);
  const [d, mes] = /^\d+$/.test(a) ? [a, b] : [b, a];
  let hora = +h[1];
  const ampm = (h[3] || '').toLowerCase();
  if (ampm.startsWith('p') && hora < 12) hora += 12;
  if (ampm.startsWith('a') && hora === 12) hora = 0;
  const numMes = MESES[mes.slice(0, 3).toLowerCase()];
  if (!numMes) throw new Error(`mes que no reconozco: ${mes}`);
  return `${anio}-${pad(numMes)}-${pad(+d)}T${pad(hora)}:${pad(+h[2])}`;
}

const num = x => {
  const s = String(x ?? '').trim().replace(',', '.');
  return s === '' ? null : parseFloat(s);
};

/** Desfase de una zona horaria en un instante, en minutos (ej. -180 para Chile en invierno). */
function desfase(ms, zona) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms) / 6e4;
}

/** 'AAAA-MM-DDTHH:MM' en hora local de la zona → ISO con desfase, como datetime.isoformat() de Python. */
export function aIso(local, zona = 'America/Santiago') {
  const [f, h] = local.split('T');
  const comoUtc = Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10), +h.slice(0, 2), +h.slice(3, 5));
  let off = desfase(comoUtc, zona);
  off = desfase(comoUtc - off * 6e4, zona);
  const signo = off < 0 ? '-' : '+', a = Math.abs(off);
  return `${local}:00${signo}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** Filas del CSV → sesiones con la misma forma que entrega la API de Hevy. */
export function leerSesiones(texto, zona = 'America/Santiago') {
  const ses = new Map();
  for (const r of parsearCsv(texto)) {
    const ini = parsearFecha(r.start_time);
    const titulo = (r.title || '').trim();
    const clave = `${ini}|${titulo}`;
    if (!ses.has(clave)) {
      ses.set(clave, {
        id: `csv-${ini.replace(/[-T:]/g, '')}`,
        title: titulo || 'Entrenamiento',
        start_time: aIso(ini, zona),
        end_time: aIso(r.end_time ? parsearFecha(r.end_time) : ini, zona),
        description: r.description || '',
        exercises: [],
      });
    }
    const w = ses.get(clave);
    const ej = (r.exercise_title || '').trim();
    const exs = w.exercises;
    if (!exs.length || exs[exs.length - 1].title !== ej) { // el mismo ejercicio puede volver más tarde
      exs.push({ title: ej, index: exs.length, notes: r.exercise_notes || '', sets: [] });
    }
    const actual = exs[exs.length - 1];
    let kgs = num(r.weight_kg);
    if (kgs == null && num(r.weight_lbs) != null) kgs = num(r.weight_lbs) * 0.45359237;
    const km = num(r.distance_km), reps = num(r.reps), seg = num(r.duration_seconds);
    const idx = num(r.set_index);
    actual.sets.push({
      index: idx ? Math.trunc(idx) : actual.sets.length,
      weight_kg: kgs,
      reps: reps != null ? Math.trunc(reps) : null,
      duration_seconds: seg ? Math.trunc(seg) : null,
      distance_meters: km ? km * 1000 : null,
      rpe: num(r.rpe),
      set_type: r.set_type || null,
    });
  }
  return [...ses.values()];
}

/** (fecha, hora '2:51 PM', título): la misma sesión puede llegar por la API, el CSV o la web con ids distintos. */
export function claveSesion(w) {
  const local = w.start_time.slice(0, 16);
  let h = +local.slice(11, 13);
  const sufijo = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${local.slice(0, 10)}|${h}:${local.slice(14, 16)} ${sufijo}|${w.title.trim()}`;
}

/** Misma clave para un instante con zona (API de Hevy, base de datos): se pasa a la hora local de Chile. */
export function claveDesdeInstante(instante, titulo, zona = 'America/Santiago') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(instante)).map(x => [x.type, x.value]));
  return claveSesion({ start_time: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`, title: titulo || '' });
}

/** Las que todavía no están: ni su id de Hevy ni su fecha, hora y título. */
export function sesionesNuevas(ws, existentes) {
  const ids = new Set(existentes.map(e => e.id_externo).filter(Boolean));
  const claves = new Set(existentes.map(e => e.clave).filter(Boolean));
  return ws.filter(w => !ids.has(w.id) && !claves.has(claveSesion(w)))
    .sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
}

const TIPO_SERIE = { warmup: 'calentamiento', failure: 'fallo', dropset: 'drop', normal: 'efectiva' };

/** Una sesión de Hevy → filas para las tablas sesiones y series. */
export function aFilas(w, indice, origen = 'hevy_csv') {
  const ini = Date.parse(w.start_time), fin = Date.parse(w.end_time);
  const series = [];
  let orden = 0;
  for (const e of [...w.exercises].sort((a, b) => a.index - b.index)) {
    const del = indice ? buscar(indice, e.title) : null;
    for (const s of [...e.sets].sort((a, b) => a.index - b.index)) {
      series.push({
        orden: orden++,
        ejercicio_id: del?.id ?? null,
        ejercicio_nombre: e.title,
        tipo: TIPO_SERIE[s.set_type] || 'efectiva',
        carga_kg: s.weight_kg,
        reps: s.reps,
        rpe: s.rpe,
        distancia_m: s.distance_meters,
        duracion_seg: s.duration_seconds,
      });
    }
  }
  return {
    sesion: {
      inicio: w.start_time,
      duracion_min: Math.round((fin - ini) / 6e4),
      titulo: w.title,
      comentario: w.description || null,
      origen,
      id_externo: w.id,
    },
    series,
  };
}
