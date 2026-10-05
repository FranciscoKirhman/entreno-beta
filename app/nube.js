// Cuenta y sincronización con Supabase. Si el servidor no está disponible, la app sigue funcionando en este
// navegador y nube.hay() devuelve false.
import { CONFIG } from './config.js';
import { aIso } from '../nucleo/hevy-csv.js';
import { sesionDelServidor } from '../nucleo/sincronizacion.js';
import { planSinPropios, sinIdPropio } from '../nucleo/propios.js';
import { perfilPruebaActivo, claveSesionPerfilPrueba } from '../nucleo/perfiles-prueba.js';

let supa = null, sesion = null, porEnlace = false;

/** Solo el ámbito de la copia del teléfono, sin validar ni dar acceso al servidor antes de iniciar la cuenta. */
export function usuarioGuardado({ claveSesion = 'entreno-sesion' } = {}) {
  if (!CONFIG.supabaseUrl) return null;
  try {
    const id = JSON.parse(localStorage.getItem(claveSesion) || 'null')?.user?.id;
    return typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) ? id : null;
  } catch { return null; }
}

export async function iniciar({ claveSesion = null, vigente = () => true } = {}) {
  // El correo trae un código y un enlace. Si se entró tocando el enlace, la URL vuelve con ?code=… y
  // supabase-js lo canjea al iniciar (flujo PKCE: solo funciona en el navegador que pidió el correo).
  if (!CONFIG.supabaseUrl) return false; // versión de prueba: todo queda en este teléfono
  const url = new URL(location.href);
  const conCodigo = url.searchParams.has('code');
  try {
    // La autorización de IA abre una página independiente y usa el mismo botón elegido en Entreno.
    const perfil = claveSesion === null && CONFIG.modoPrueba ? perfilPruebaActivo(localStorage) : null;
    const storageKey = claveSesion ?? claveSesionPerfilPrueba(perfil?.id || null);
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    if (!vigente()) return false;
    supa = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: true, storageKey, flowType: 'pkce' } });
    const { data } = await supa.auth.getSession();
    if (!vigente()) { supa = null; sesion = null; return false; }
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
// Una operación con varios pasos conserva su cuenta: cada espera puede devolver el control a la pantalla de acceso.
function ambitoActual() {
  const cliente = supa, usuario = usuarioId();
  const comprobar = () => {
    if (!cliente || !usuario || supa !== cliente || usuarioId() !== usuario) throw new Error('La cuenta cambió durante la sincronización.');
  };
  comprobar();
  return { cliente, usuario, comprobar, async consultar(hacer) { comprobar(); const r = await hacer(); comprobar(); return r; } };
}
export async function cargarPreferencias() {
  return ok(await supa.from('perfiles').select('unidad, asistente, preferencias_actualizadas').eq('id', uid()).single());
}
export async function guardarPreferencias(p) {
  ok(await supa.from('perfiles').update({ unidad: p.unidad, asistente: p.asistente, preferencias_actualizadas: new Date().toISOString() }).eq('id', uid()));
}

export async function pedirCodigo(email, destino = location.origin + location.pathname) {
  const { error } = await supa.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: destino } });
  if (error) throw error;
}
export async function verificarCodigo(email, token) {
  const { data, error } = await supa.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  if (error) throw error;
  sesion = data.session;
}
export async function salir() { await supa.auth.signOut(); sesion = null; }

/** Entrar o crear la cuenta con Google o Apple. Sale a su página y vuelve con ?code=…, que iniciar() canjea. */
export async function entrarCon(proveedor) {
  const { error } = await supa.auth.signInWithOAuth({ provider: proveedor, options: { redirectTo: location.origin + location.pathname } });
  if (error) throw error;
}
let proveedores = null;
/** Los proveedores activados en el servidor ({ google, apple }). Un botón solo aparece si su proveedor está listo. */
export function proveedoresDisponibles() {
  if (!CONFIG.supabaseUrl) return Promise.resolve({});
  proveedores ||= fetch(`${CONFIG.supabaseUrl}/auth/v1/settings`, { headers: { apikey: CONFIG.supabaseAnonKey } })
    .then(r => (r.ok ? r.json() : {}))
    .then(d => ({ google: d.external?.google === true, apple: d.external?.apple === true }))
    .catch(() => { proveedores = null; return {}; });
  return proveedores;
}

async function funcion(nombre, { metodo = 'POST', cuerpo } = {}) {
  const ambito = ambitoActual(), token = sesion.access_token;
  const r = await ambito.consultar(() => fetch(`${CONFIG.funcionesUrl}/${nombre}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, apikey: CONFIG.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  }));
  const d = await ambito.consultar(() => r.json().catch(() => ({})));
  if (!r.ok) throw Object.assign(new Error(d.error || `El servidor respondió ${r.status}`), { datos: d, status: r.status });
  return d;
}
const ok = ({ data, error }) => { if (error) throw error; return data; };

// ── Cuestionario, lugares, lesiones y consentimientos ──────────────────────
const TIPOS_CONSENTIMIENTO = { terminos: 'terminos', privacidad: 'privacidad', consentimiento_salud: 'datos_salud', ia_transferencia: 'ia_transferencia', seguimiento_ciclo: 'ciclo_menstrual', marketing: 'marketing' };

export async function guardarCuestionario(respuestas) {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  ok(await ambito.consultar(() => cliente.from('cuestionarios').insert({ user_id: usuario, version_cuestionario: 1, respuestas })));
  ok(await ambito.consultar(() => cliente.from('lugares').delete().eq('user_id', usuario)));
  if (respuestas.lugares?.length) {
    ok(await ambito.consultar(() => cliente.from('lugares').insert(respuestas.lugares.map((l, i) => ({
      user_id: usuario, nombre: l.nombre || `Lugar ${i + 1}`, tipo: l.tipo || 'gimnasio_completo', equipamiento: l.equipamiento || [],
      mancuerna_max_kg: l.mancuerna_max_kg || null, incremento_minimo_kg: Number(l.incremento_minimo_kg) || 2.5, principal: i === 0,
    })))));
  }
  ok(await ambito.consultar(() => cliente.from('lesiones').delete().eq('user_id', usuario)));
  if (respuestas.lesiones?.length) {
    ok(await ambito.consultar(() => cliente.from('lesiones').insert(respuestas.lesiones.map(l => ({
      user_id: usuario, region: l.region, lado: l.lado || null, tipo: l.tipo || 'molestia', intensidad: l.intensidad ?? null,
      gatillantes: l.gatillantes || null, desde: l.desde || null, alta: l.alta || null, activa: true,
    })))));
  }
  const consentimientos = Object.entries(TIPOS_CONSENTIMIENTO).filter(([k]) => typeof respuestas[k] === 'boolean')
    .map(([k, tipo]) => ({ user_id: usuario, tipo, version: CONFIG.versionConsentimientos, otorgado: respuestas[k] }));
  if (consentimientos.length) ok(await ambito.consultar(() => cliente.from('consentimientos').insert(consentimientos)));
}
export async function consentir(tipo, otorgado = true) {
  ok(await supa.from('consentimientos').insert({ user_id: uid(), tipo, version: CONFIG.versionConsentimientos, otorgado }));
}
export async function consentirChat(otorgado = true) {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  ok(await ambito.consultar(() => cliente.from('consentimientos').insert({ user_id: usuario, tipo: 'ia_transferencia', version: 'chat_v2', otorgado })));
}
export async function cargarRespuestas() {
  const d = ok(await supa.from('cuestionarios').select('respuestas').order('creado', { ascending: false }).limit(1));
  return d[0]?.respuestas || null;
}

// ── Plan ────────────────────────────────────────────────────────────────────
export const generarPlan = () => funcion('generar-plan');
// Los ejercicios propios viven en el teléfono: el servidor solo conoce el catálogo (nucleo/propios.js).
export const guardarPlan = plan => funcion('guardar-plan', { cuerpo: { plan: planSinPropios(plan) } });
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
  // Solo las columnas de la tabla: los síntomas del ciclo quedan en el teléfono.
  ok(await supa.from('bienestar_diario').upsert({ user_id: uid(), fecha, ...Object.fromEntries(CAMPOS_BIENESTAR.filter(k => b[k] !== undefined).map(k => [k, b[k]])) }));
}
/**
 * Sube una sesión con el id que le dio el teléfono. Si ya estaba (un reintento, o "Guardar de nuevo"), se
 * reemplazan sus series y notas: subirla dos veces no la duplica. La llama la cola (app/cola.js).
 */
export async function registrarSesion({ id, fecha, hora, titulo, duracion_min, series = [], notas = [], origen, id_externo, comentario }) {
  if (origen === 'ejemplo') throw new Error('El historial ficticio no se sube a una cuenta.');
  const cuerpo = { sesion: { id, inicio: aIso(`${fecha}T${hora || '12:00'}`), titulo, duracion_min: duracion_min ?? null,
    origen: origen === 'hevy' ? 'hevy_csv' : origen || 'app', id_externo: id_externo || null, comentario: comentario || null }, filas: sinIdPropio(series), notas: sinIdPropio(notas) };
  const token = sesion.access_token;
  const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/guardar_sesion_completa`, { method: 'POST', headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.message || `No pude guardar la sesión (${r.status}).`), { status: r.status });
  return id;
}
export async function cargarSesiones() {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  const filas = []; let desde = 0;
  for (;;) {
    const lote = ok(await ambito.consultar(() => cliente.from('sesiones').select('*, series(*), notas_ejercicio(*)').eq('user_id', usuario).order('inicio').order('id').range(desde, desde + 499)));
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
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  let ruta = ind.archivo || null;
  if (archivo) {
    ruta = `${usuario}/${ind.id}.${EXTENSION[archivo.type] || 'bin'}`;
    ok(await ambito.consultar(() => cliente.storage.from('indicaciones').upload(ruta, archivo, { contentType: archivo.type, upsert: true })));
  }
  ok(await ambito.consultar(() => cliente.from('indicaciones').upsert({
    id: ind.id, user_id: usuario, profesional: ind.profesional || null, fecha: ind.fecha || null, hasta: ind.hasta || null,
    restricciones: ind.restricciones || {}, ejercicios: ind.ejercicios || [], notas: ind.notas || null, archivo: ruta, activa: ind.activa !== false,
  }, { onConflict: 'id' })));
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
export const chat = (mensaje, historial, archivo) => funcion('coach', { cuerpo: { mensaje, historial, ...(archivo ? { archivo } : {}) } });
export const estadoChat = () => funcion('coach', { metodo: 'GET' });
export async function cargarSuplementos() {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  const filas = ok(await ambito.consultar(() => cliente.from('suplementos').select('id, nombre, dosis, horas, dias, activo').eq('user_id', usuario)));
  return filas.map(s => ({ ...s, horas: (s.horas || []).map(h => h.slice(0, 5)) }));
}
export async function cargarTomas() {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  return ok(await ambito.consultar(() => cliente.from('suplementos_tomas').select('suplemento_id, fecha, hora').eq('user_id', usuario).order('fecha')));
}

// ── Suplementos ─────────────────────────────────────────────────────────────
export async function guardarSuplemento(s) {
  return ok(await supa.from('suplementos').upsert({ id: s.id, user_id: uid(), nombre: s.nombre, dosis: s.dosis || null, horas: s.horas || [], dias: s.dias || [], activo: s.activo !== false }).select('id').single()).id;
}
export const CAMPOS_BIENESTAR = ['sueno_horas', 'sueno_calidad', 'cansancio', 'animo', 'estres', 'dolor', 'dolor_zona', 'enfermo', 'puntaje', 'recomendacion', 'sintomas_ciclo'];

/**
 * Al entrar: sube lo anotado en este teléfono antes de tener cuenta (bienestar, suplementos y tomas) y
 * trae los suplementos de la cuenta si este teléfono no tiene. Devuelve la lista de suplementos a usar.
 */
export async function subirLocal({ bienestar = {}, suplementos = [], tomas = [], consentimientos = {} }) {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  // Consentimientos dados en este teléfono antes de entrar (fotos, cuidado de lesiones…): quedan registrados
  // con fecha y versión, una vez por tipo.
  const dados = Object.keys(consentimientos).filter(k => consentimientos[k] === true);
  if (dados.length) {
    const ya = new Set(ok(await ambito.consultar(() => cliente.from('consentimientos').select('tipo').eq('user_id', usuario).eq('otorgado', true).eq('version', CONFIG.versionConsentimientos))).map(x => x.tipo));
    for (const tipo of dados.filter(t => !ya.has(t))) await ambito.consultar(() => consentir(tipo).catch(e => console.warn('Consentimiento no registrado', tipo, e.message)));
  }
  const filas = Object.entries(bienestar).map(([fecha, b]) => ({ user_id: usuario, fecha, ...Object.fromEntries(CAMPOS_BIENESTAR.filter(k => b[k] !== undefined).map(k => [k, b[k]])) }));
  if (filas.length) ok(await ambito.consultar(() => cliente.from('bienestar_diario').upsert(filas)));
  for (const x of suplementos) await ambito.consultar(() => guardarSuplemento(x));
  if (tomas.length) {
    const ya = ok(await ambito.consultar(() => cliente.from('suplementos_tomas').select('suplemento_id, fecha, hora').eq('user_id', usuario)));
    const clave = t => `${t.suplemento_id}|${t.fecha}|${String(t.hora || '').slice(0, 5)}`;
    const hay = new Set(ya.map(clave));
    const nuevas = tomas.filter(t => !hay.has(clave(t))).map(t => ({ user_id: usuario, suplemento_id: t.suplemento_id, fecha: t.fecha, hora: t.hora || null }));
    if (nuevas.length) ok(await ambito.consultar(() => cliente.from('suplementos_tomas').insert(nuevas)));
  }
  if (suplementos.length) return suplementos;
  const enCuenta = ok(await ambito.consultar(() => cliente.from('suplementos').select('id, nombre, dosis, horas, dias, activo').eq('user_id', usuario).eq('activo', true)));
  return enCuenta.map(x => ({ ...x, horas: (x.horas || []).map(h => h.slice(0, 5)) }));
}
export async function borrarSuplemento(id) { ok(await supa.from('suplementos').delete().eq('id', id)); }
export async function registrarToma(suplemento_id, fecha, hora) { ok(await supa.from('suplementos_tomas').insert({ user_id: uid(), suplemento_id, fecha, hora })); }

// ── Fotos de progreso (bucket privado) ─────────────────────────────────────
export async function subirFoto({ fecha, angulo, archivo }) {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  const ruta = `${usuario}/${fecha}-${Date.now()}.${(archivo.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`;
  ok(await ambito.consultar(() => cliente.storage.from('fotos-progreso').upload(ruta, archivo, { contentType: archivo.type })));
  ok(await ambito.consultar(() => cliente.from('fotos_progreso').insert({ user_id: usuario, fecha, archivo: ruta, angulo })));
}
export async function listarFotos() {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  const filas = ok(await ambito.consultar(() => cliente.from('fotos_progreso').select('id, fecha, angulo, archivo').eq('user_id', usuario).order('fecha')));
  const out = [];
  for (const f of filas) {
    const { data } = await ambito.consultar(() => cliente.storage.from('fotos-progreso').createSignedUrl(f.archivo, 3600));
    out.push({ ...f, url: data?.signedUrl });
  }
  return out;
}
export async function borrarFoto(f) {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  ok(await ambito.consultar(() => cliente.storage.from('fotos-progreso').remove([f.archivo])));
  ok(await ambito.consultar(() => cliente.from('fotos_progreso').delete().eq('user_id', usuario).eq('id', f.id)));
}

// ── Cuenta ──────────────────────────────────────────────────────────────────
export const descargarDatos = () => funcion('cuenta', { metodo: 'GET' });

// ── Lo que antes quedaba solo en el teléfono (migración 20261013000000) ─────
// Ejercicios propios, medidas del cuerpo y notas fijas: un documento por tipo. Fechas de la regla: ciclo_registros.
export const cargarDatosTelefono = async () => ok(await supa.from('datos_telefono').select('clave, valor, actualizado'));
export async function guardarDatoTelefono(clave, valor) {
  ok(await supa.from('datos_telefono').upsert({ user_id: uid(), clave, valor, actualizado: new Date().toISOString() }));
}
export async function borrarDatoTelefono(clave) { ok(await supa.from('datos_telefono').delete().eq('clave', clave)); }
export const cargarIniciosRegla = async () => ok(await supa.from('ciclo_registros').select('inicio_regla')).map(x => x.inicio_regla);
/** Deja en la cuenta exactamente estas fechas de inicio de la regla. */
export async function guardarIniciosRegla(fechas) {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  const actuales = ok(await ambito.consultar(() => cliente.from('ciclo_registros').select('inicio_regla').eq('user_id', usuario))).map(x => x.inicio_regla);
  const sobran = actuales.filter(f => !fechas.includes(f)), faltan = fechas.filter(f => !actuales.includes(f));
  if (sobran.length) ok(await ambito.consultar(() => cliente.from('ciclo_registros').delete().eq('user_id', usuario).in('inicio_regla', sobran)));
  if (faltan.length) ok(await ambito.consultar(() => cliente.from('ciclo_registros').insert(faltan.map(f => ({ user_id: usuario, inicio_regla: f })))));
}
export async function borrarCuenta() {
  const ambito = ambitoActual();
  await ambito.consultar(() => funcion('cuenta', { metodo: 'DELETE' }));
  ambito.comprobar();
  await ambito.cliente.auth.signOut();
  // signOut también avisa que la sesión terminó; conserva una cuenta distinta que pudiera haber entrado mientras tanto.
  if (supa === ambito.cliente && (!sesion || usuarioId() === ambito.usuario)) sesion = null;
}

// Conexión directa: el proveedor de identidad conserva claves y tokens OAuth.
export const detallesAutorizacion = id => supa.auth.oauth.getAuthorizationDetails(id).then(ok);
export const aprobarAutorizacion = id => supa.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true }).then(ok);
export const negarAutorizacion = id => supa.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true }).then(ok);
export async function autorizarConexionIA(clientId) {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  ok(await ambito.consultar(() => cliente.from('conexiones_ia').upsert({ user_id: usuario, client_id: clientId, activa: true, version_permiso: 2, actualizado: new Date().toISOString() })));
}
export async function conexionesIA() {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  const [g, permisos] = await Promise.all([
    ambito.consultar(() => cliente.auth.oauth.listGrants()).then(ok),
    ambito.consultar(() => cliente.from('conexiones_ia').select('client_id, activa, version_permiso').eq('user_id', usuario)).then(ok),
  ]);
  const grants = g.items || g.grants || (Array.isArray(g) ? g : []);
  return grants.map(x => ({ ...x, ...permisos.find(p => p.client_id === (x.client?.id || x.client_id)) }));
}
export async function revocarConexionIA(clientId) {
  const ambito = ambitoActual(), { cliente, usuario } = ambito;
  // Primero se bloquean las herramientas; incluso un token todavía vigente deja de funcionar.
  ok(await ambito.consultar(() => cliente.from('conexiones_ia').update({ activa: false }).eq('user_id', usuario).eq('client_id', clientId)));
  ok(await ambito.consultar(() => cliente.auth.oauth.revokeGrant({ clientId })));
}
export const propuestasIA = () => funcion('propuestas-ia', { metodo: 'GET' });
export const estadoPropuestaIA = id => funcion(`propuestas-ia?id=${encodeURIComponent(id)}`, { metodo: 'GET' });
export const confirmarPropuestaIA = id => funcion('propuestas-ia', { cuerpo: { id } });
export const descartarPropuestaIA = id => funcion('propuestas-ia', { metodo: 'DELETE', cuerpo: { id } });
