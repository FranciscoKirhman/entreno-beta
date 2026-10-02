const objeto = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fecha = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(x + 'T12:00:00Z').toISOString().slice(0, 10) === x;
const numero = (x, min = 0, max = 100000) => Number.isFinite(x) && x >= min && x <= max;
const exigir = (ok, texto) => { if (!ok) throw new Error('Ese archivo contiene ' + texto + '. No cambié tus datos.'); };
export function validarRespaldo(r, ids = null) {
  exigir(objeto(r) && r.app === 'entreno', 'un formato ajeno a Entreno');
  exigir([1, 2].includes(r.version), 'una versión de respaldo no compatible');
  exigir(typeof r.creado === 'string' && Number.isFinite(Date.parse(r.creado)), 'una fecha de creación inválida');
  exigir(objeto(r.estado) && objeto(r.estado.respuestas), 'un perfil inválido');
  const recorrer = (x, profundidad = 0) => {
    exigir(profundidad < 40, 'una estructura demasiado profunda');
    if (typeof x === 'number') exigir(Number.isFinite(x), 'un número inválido');
    if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) {
      exigir(!['__proto__', 'constructor', 'prototype'].includes(k), 'una propiedad insegura'); recorrer(v, profundidad + 1);
    }
  };
  recorrer(r);
  for (const k of ['bienestar', 'registro', 'notas', 'consentimientos', 'checkins', 'filas', 'descansos', 'descargaNo']) exigir(r.estado[k] === undefined || objeto(r.estado[k]), `un campo ${k} inválido`);
  for (const k of ['sesiones', 'chat', 'suplementos', 'tomas', 'indicaciones']) exigir(r.estado[k] === undefined || Array.isArray(r.estado[k]), `un campo ${k} inválido`);
  const ejercicio = e => {
    exigir(objeto(e) && numero(e.series, 1, 100) && numero(e.reps_min, 0, 3600) && numero(e.reps_max, e.reps_min, 3600) && numero(e.descanso_seg, 0, 3600), 'una prescripción inválida');
    exigir(e.ejercicio_id === null && e.indicacion === true || typeof e.ejercicio_id === 'string' && (!ids || ids.has(e.ejercicio_id)), 'un ejercicio desconocido');
    exigir(e.carga_kg == null || numero(e.carga_kg, 0, 1000), 'una carga inválida');
  };
  const p = r.estado.plan;
  if (p != null) {
    exigir(objeto(p), 'un plan inválido');
    if (!p.bloqueado) {
      exigir(Array.isArray(p.dias) && p.dias.length <= 366 && numero(p.semanas, 1, 52), 'un calendario inválido');
      for (const d of p.dias) { exigir(objeto(d) && fecha(d.fecha) && numero(d.semana, 1, p.semanas) && Array.isArray(d.ejercicios), 'una sesión de plan inválida'); d.ejercicios.forEach(ejercicio); }
    }
  }
  for (const [f, ejercicios] of Object.entries(r.estado.registro || {})) {
    exigir(fecha(f) && objeto(ejercicios), 'una fecha de registro inválida');
    for (const filas of Object.values(ejercicios)) {
      exigir(Array.isArray(filas), 'series inválidas');
      for (const s of filas.filter(Boolean)) exigir(objeto(s) && (s.reps == null || numero(Number(s.reps), 0, 3600)) && (s.carga_kg == null || numero(Number(s.carga_kg), 0, 1000)) && (s.hecho === undefined || typeof s.hecho === 'boolean'), 'una serie inválida');
    }
  }
  for (const s of r.estado.sesiones || []) exigir(objeto(s) && fecha(s.fecha) && Array.isArray(s.series), 'una sesión guardada inválida');
  exigir(r.fotos === undefined || Array.isArray(r.fotos), 'fotos inválidas');
  const vistos = new Set();
  for (const f of r.fotos || []) {
    exigir(objeto(f) && typeof f.id === 'string' && f.id.length > 0 && !vistos.has(f.id) && fecha(f.fecha) && [null, 'frente', 'perfil', 'espalda', 'otro'].includes(f.angulo ?? null), 'metadatos de foto inválidos');
    exigir(typeof f.datos === 'string' && /^data:image\/(jpeg|png|webp|heic|heif|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(f.datos) && f.datos.length <= 30000000, 'una imagen inválida');
    vistos.add(f.id);
  }
  return r;
}
