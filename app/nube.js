// Cuenta y sincronización con Supabase. Si el servidor no está disponible, la app sigue funcionando en este
// navegador y nube.hay() devuelve false.
import { CONFIG } from './config.js';
import { aIso } from '../nucleo/hevy-csv.js';
import { sesionDelServidor } from '../nucleo/sincronizacion.js';

let supa = null, sesion = null, porEnlace = false;

export async function iniciar() {
  // El correo trae un código y un enlace. Si se entró tocando el enlace, la URL vuelve con ?code=… y
  // supabase-js lo canjea al iniciar (flujo PKCE: solo funciona en el navegador que pidió el correo).
  if (!CONFIG.supabaseUrl) return false; // versión de prueba: todo queda en este teléfono
  const url = new URL(location.href);
  const conCodigo = url.searchParams.has('code');
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supa = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: true, storageKey: 'entreno-sesion', flowType: 'pkce' } });
    const { data } = await supa.auth.getSession();
    sesion = data.session;
    supa.auth.onAuthStateChange((_e, s) => { sesion = s; });
    porEnlace = conCodigo && Boolean(sesion);
    return true;
  } catch { supa = null; return false; }
  finally {
    if (conCodigo) { url.searchParams.delete('code'); history.replaceState(null, '', url.pathname + url.search + url.hash); }
  }
}
/** true si en esta carga se entró con el enlace del correo. */
export const entroPorEnlace = () => porEnlace;
export const hay = () => Boolean(supa);
export const conectado = () => Boolean(sesion);
export const correo = () => sesion?.user?.email || null;
export const usuarioId = () => sesion?.user?.id || null;
const uid = () => sesion.user.id;
export async function cargarPreferencias() {
  return ok(await supa.from('perfiles').select('unidad, asistente, preferencias_actualizadas').eq('id', uid()).single());
}
export async function guardarPreferencias(p) {
  ok(await supa.from('perfiles').update({ unidad: p.unidad, asistente: p.asistente, preferencias_actualizadas: new Date().toISOString() }).eq('id', uid()));
}

export async function pedirCodigo(email) {
  const { error } = await supa.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}
export async function verificarCodigo(email, token) {
  const { data, error } = await supa.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  if (error) throw error;
  sesion = data.session;
}
export async function salir() { await supa.auth.signOut(); sesion = null; }

async function funcion(nombre, { metodo = 'POST', cuerpo } = {}) {
  const r = await fetch(`${CONFIG.funcionesUrl}/${nombre}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${sesion.access_token}`, apikey: CONFIG.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || `El servidor respondió ${r.status}`), { datos: d, status: r.status });
  return d;
}
const ok = ({ data, error }) => { if (error) throw error; return data; };

// ── Cuestionario, lugares, lesiones y consentimientos ──────────────────────
const TIPOS_CONSENTIMIENTO = { terminos: 'terminos', privacidad: 'privacidad', consentimiento_salud: 'datos_salud', ia_transferencia: 'ia_transferencia', seguimiento_ciclo: 'ciclo_menstrual', marketing: 'marketing' };

export async function guardarCuestionario(respuestas) {
  ok(await supa.from('cuestionarios').insert({ user_id: uid(), version_cuestionario: 1, respuestas }));
  ok(await supa.from('lugares').delete().eq('user_id', uid()));
  if (respuestas.lugares?.length) {
    ok(await supa.from('lugares').insert(respuestas.lugares.map((l, i) => ({
      user_id: uid(), nombre: l.nombre || `Lugar ${i + 1}`, tipo: l.tipo || 'gimnasio_completo', equipamiento: l.equipamiento || [],
      mancuerna_max_kg: l.mancuerna_max_kg || null, incremento_minimo_kg: Number(l.incremento_minimo_kg) || 2.5, principal: i === 0,
    }))));
  }
  ok(await supa.from('lesiones').delete().eq('user_id', uid()));
  if (respuestas.lesiones?.length) {
    ok(await supa.from('lesiones').insert(respuestas.lesiones.map(l => ({
      user_id: uid(), region: l.region, lado: l.lado || null, tipo: l.tipo || 'molestia', intensidad: l.intensidad ?? null,
      gatillantes: l.gatillantes || null, desde: l.desde || null, alta: l.alta || null, activa: true,
    }))));
  }
  const consentimientos = Object.entries(TIPOS_CONSENTIMIENTO).filter(([k]) => typeof respuestas[k] === 'boolean')
    .map(([k, tipo]) => ({ user_id: uid(), tipo, version: CONFIG.versionConsentimientos, otorgado: respuestas[k] }));
  if (consentimientos.length) ok(await supa.from('consentimientos').insert(consentimientos));
}
export async function consentir(tipo, otorgado = true) {
  ok(await supa.from('consentimientos').insert({ user_id: uid(), tipo, version: CONFIG.versionConsentimientos, otorgado }));
}
export async function cargarRespuestas() {
  const d = ok(await supa.from('cuestionarios').select('respuestas').order('creado', { ascending: false }).limit(1));
  return d[0]?.respuestas || null;
}

// ── Plan ────────────────────────────────────────────────────────────────────
export const generarPlan = () => funcion('generar-plan');
export const guardarPlan = plan => funcion('guardar-plan', { cuerpo: { plan } });
export async function cargarPlan() {
  const p = ok(await supa.from('planes').select('*, plan_dias(*, plan_ejercicios(*), lugares(nombre))').eq('estado', 'activo').maybeSingle());
  if (!p) return null;
  return {
    id: p.id, inicio: p.inicio, semanas: p.semanas, semana_descarga: p.semana_descarga, objetivo: p.objetivo,
    estructura: p.estructura, generado_por: p.generado_por, justificacion: p.justificacion,
    dias: p.plan_dias.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map(d => ({
      fecha: d.fecha, semana: d.semana, plantilla: d.plantilla, foco: d.foco, tipo: d.tipo, firme: d.firme, hora: d.hora?.slice(0, 5) || null,
      lugar: d.lugares?.nombre || null, racional: d.racional, calentamiento: d.calentamiento, cardio: d.cardio,
      ejercicios: d.plan_ejercicios.sort((a, b) => a.orden - b.orden).map(e => ({
        ejercicio_id: e.ejercicio_id, orden: e.orden, prioridad: e.prioridad, series: e.series, reps_min: e.reps_min, reps_max: e.reps_max,
        unidad: e.unidad, rir: e.rir, descanso_seg: e.descanso_seg, carga_kg: e.carga_kg == null ? null : Number(e.carga_kg), nota: e.nota,
        rango_extendido: e.rango_extendido, ...(e.superserie ? { superserie: e.superserie } : {}),
      })),
    })),
  };
}

// ── Día a día ───────────────────────────────────────────────────────────────
export async function guardarBienestar(fecha, b) {
  ok(await supa.from('bienestar_diario').upsert({ user_id: uid(), fecha, ...b }));
}
/**
 * Sube una sesión con el id que le dio el teléfono. Si ya estaba (un reintento, o "Guardar de nuevo"), se
 * reemplazan sus series y notas: subirla dos veces no la duplica. La llama la cola (app/cola.js).
 */
export async function registrarSesion({ id, fecha, hora, titulo, duracion_min, series = [], notas = [], origen, id_externo, comentario }) {
  if (origen === 'ejemplo') throw new Error('El historial ficticio no se sube a una cuenta.');
  const cuerpo = { sesion: { id, inicio: aIso(`${fecha}T${hora || '12:00'}`), titulo, duracion_min: duracion_min ?? null,
    origen: origen === 'hevy' ? 'hevy_csv' : origen || 'app', id_externo: id_externo || null, comentario: comentario || null }, filas: series, notas };
  const token = sesion.access_token;
  const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/guardar_sesion_completa`, { method: 'POST', headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.message || `No pude guardar la sesión (${r.status}).`), { status: r.status });
  return id;
}
export async function cargarSesiones() {
  const filas = []; let desde = 0;
  for (;;) {
    const lote = ok(await supa.from('sesiones').select('*, series(*), notas_ejercicio(*)').order('inicio').order('id').range(desde, desde + 499));
    filas.push(...lote); if (lote.length < 500) break; desde += 500;
  }
  return filas.map(sesionDelServidor);
}
export async function cargarBienestar() {
  const filas = ok(await supa.from('bienestar_diario').select('*').order('fecha'));
  return Object.fromEntries(filas.map(({ user_id, fecha, creado, actualizado, ...b }) => [fecha, { ...b, enCuenta: true }]));
}

// ── Indicaciones de tu médico o kinesiólogo (tabla y bucket privado "indicaciones") ─
const EXTENSION = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp' };

/** Sube la indicación con el id del teléfono (reintentar no la duplica) y, si viene, su foto o PDF. */
export async function guardarIndicacion(ind, archivo = null) {
  const usuario = uid();
  let ruta = ind.archivo || null;
  if (archivo) {
    ruta = `${usuario}/${ind.id}.${EXTENSION[archivo.type] || 'bin'}`;
    ok(await supa.storage.from('indicaciones').upload(ruta, archivo, { contentType: archivo.type, upsert: true }));
  }
  ok(await supa.from('indicaciones').upsert({
    id: ind.id, user_id: usuario, profesional: ind.profesional || null, fecha: ind.fecha || null, hasta: ind.hasta || null,
    restricciones: ind.restricciones || {}, ejercicios: ind.ejercicios || [], notas: ind.notas || null, archivo: ruta, activa: ind.activa !== false,
  }, { onConflict: 'id' }));
  return ruta;
}
export async function cargarIndicaciones() {
  const filas = ok(await supa.from('indicaciones').select('id, profesional, fecha, hasta, restricciones, ejercicios, notas, archivo').eq('activa', true).order('creado'));
  return filas.map(f => ({ ...f, enCuenta: true }));
}
/** Enlace temporal (1 hora) para ver el archivo de una indicación. */
export async function verArchivoIndicacion(ruta) {
  const { data, error } = await supa.storage.from('indicaciones').createSignedUrl(ruta, 3600);
  if (error) throw error;
  return data.signedUrl;
}
/** Check-in semanal: lo propuesto y lo que la persona aceptó (tabla checkins). */
export async function guardarCheckin({ semana, plan_inicio, banderas, series, sesiones, cambios }) {
  ok(await supa.from('checkins').insert({ user_id: uid(), tipo: 'semanal', respuestas: { semana, plan_inicio },
    resumen_automatico: { series, sesiones }, banderas_rojas: banderas, cambios_aplicados: cambios }));
}
export const chat = (mensaje, historial) => funcion('coach', { cuerpo: { mensaje, historial } });

// ── Suplementos ─────────────────────────────────────────────────────────────
export async function guardarSuplemento(s) {
  return ok(await supa.from('suplementos').upsert({ id: s.id, user_id: uid(), nombre: s.nombre, dosis: s.dosis || null, horas: s.horas || [], dias: s.dias || [], activo: s.activo !== false }).select('id').single()).id;
}
const CAMPOS_BIENESTAR = ['sueno_horas', 'sueno_calidad', 'cansancio', 'animo', 'estres', 'dolor', 'dolor_zona', 'enfermo', 'puntaje', 'recomendacion'];

/**
 * Al entrar: sube lo anotado en este teléfono antes de tener cuenta (bienestar, suplementos y tomas) y
 * trae los suplementos de la cuenta si este teléfono no tiene. Devuelve la lista de suplementos a usar.
 */
export async function subirLocal({ bienestar = {}, suplementos = [], tomas = [], consentimientos = {} }) {
  // Consentimientos dados en este teléfono antes de entrar (fotos, cuidado de lesiones…): quedan registrados
  // con fecha y versión, una vez por tipo.
  const dados = Object.keys(consentimientos).filter(k => consentimientos[k] === true);
  if (dados.length) {
    const ya = new Set(ok(await supa.from('consentimientos').select('tipo').eq('otorgado', true).eq('version', CONFIG.versionConsentimientos)).map(x => x.tipo));
    for (const tipo of dados.filter(t => !ya.has(t))) await consentir(tipo).catch(e => console.warn('Consentimiento no registrado', tipo, e.message));
  }
  const filas = Object.entries(bienestar).map(([fecha, b]) => ({ user_id: uid(), fecha, ...Object.fromEntries(CAMPOS_BIENESTAR.filter(k => b[k] !== undefined).map(k => [k, b[k]])) }));
  if (filas.length) ok(await supa.from('bienestar_diario').upsert(filas));
  for (const x of suplementos) await guardarSuplemento(x);
  if (tomas.length) {
    const ya = ok(await supa.from('suplementos_tomas').select('suplemento_id, fecha, hora'));
    const clave = t => `${t.suplemento_id}|${t.fecha}|${String(t.hora || '').slice(0, 5)}`;
    const hay = new Set(ya.map(clave));
    const nuevas = tomas.filter(t => !hay.has(clave(t))).map(t => ({ user_id: uid(), suplemento_id: t.suplemento_id, fecha: t.fecha, hora: t.hora || null }));
    if (nuevas.length) ok(await supa.from('suplementos_tomas').insert(nuevas));
  }
  if (suplementos.length) return suplementos;
  const enCuenta = ok(await supa.from('suplementos').select('id, nombre, dosis, horas, dias, activo').eq('activo', true));
  return enCuenta.map(x => ({ ...x, horas: (x.horas || []).map(h => h.slice(0, 5)) }));
}
export async function borrarSuplemento(id) { ok(await supa.from('suplementos').delete().eq('id', id)); }
export async function registrarToma(suplemento_id, fecha, hora) { ok(await supa.from('suplementos_tomas').insert({ user_id: uid(), suplemento_id, fecha, hora })); }

// ── Fotos de progreso (bucket privado) ─────────────────────────────────────
export async function subirFoto({ fecha, angulo, archivo }) {
  const ruta = `${uid()}/${fecha}-${Date.now()}.${(archivo.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`;
  ok(await supa.storage.from('fotos-progreso').upload(ruta, archivo, { contentType: archivo.type }));
  ok(await supa.from('fotos_progreso').insert({ user_id: uid(), fecha, archivo: ruta, angulo }));
}
export async function listarFotos() {
  const filas = ok(await supa.from('fotos_progreso').select('id, fecha, angulo, archivo').order('fecha'));
  const out = [];
  for (const f of filas) {
    const { data } = await supa.storage.from('fotos-progreso').createSignedUrl(f.archivo, 3600);
    out.push({ ...f, url: data?.signedUrl });
  }
  return out;
}
export async function borrarFoto(f) {
  ok(await supa.storage.from('fotos-progreso').remove([f.archivo]));
  ok(await supa.from('fotos_progreso').delete().eq('id', f.id));
}

// ── Cuenta ──────────────────────────────────────────────────────────────────
export const descargarDatos = () => funcion('cuenta', { metodo: 'GET' });
export async function borrarCuenta() { await funcion('cuenta', { metodo: 'DELETE' }); await supa.auth.signOut(); sesion = null; }
