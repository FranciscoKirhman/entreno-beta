import { sufijo } from '../nucleo/unidades.js';
import { validarRespaldo } from '../nucleo/respaldo.js';
// Estado y utilidades que comparten las vistas de la app. Todo funciona sin cuenta (en este navegador);
// con cuenta, nube.js sincroniza con Supabase.
import { crearIndice, normalizar } from '../nucleo/catalogo.js';
import { derivar } from '../nucleo/derivar.js';
import { estadoDelPlan } from '../nucleo/registrado.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { perfilPruebaActivo, clavePerfilPrueba, claveSesionPerfilPrueba, seleccionarPerfilPrueba } from '../nucleo/perfiles-prueba.js';
import { perfilDelRetornoCuenta } from '../nucleo/retorno-cuenta.js';
import { CONFIG } from './config.js';
import { leerCopia, escribirCopia, vaciarCopia, liberarEspacio, usoAlmacenamiento } from './copia-entreno.js';
import { medirGuardado, anotarApertura } from './medicion.js';
import { estadoDeCopia } from '../nucleo/copia-segura.js';
import { revisarTrasladoCuenta } from '../nucleo/consentimiento-nube.js';
import { corregirHistorial } from '../nucleo/corregir-historial.js';
import { compactarChat } from '../nucleo/compactar-chat.js';
import { retiradosAlCambiar } from '../nucleo/series-retiradas.js';

// La portada de la versión de prueba ya pidió estos archivos (herramientas/beta.mjs, precargas): se usa esa respuesta.
const pedir = u => { const p = globalThis.entrenoPrecarga?.[u]; if (p) delete globalThis.entrenoPrecarga[u]; return p || fetch(u); };
const cargar = u => pedir(u).then(r => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
// Imágenes que hay en app/img (las genera herramientas/imagenes.mjs): así no se piden las que todavía no existen.
// Va en el mismo grupo que el contenido para no esperar una vuelta más al abrir.
const disponibles = pedir('img/disponibles.json').then(r => (r.ok ? r.json() : [])).catch(() => []);
export const [C, catalogo, K, EVIDENCIA, PLANES, TECNICA] = await Promise.all(
  ['cuestionario', 'ejercicios', 'checkin', 'evidencia', 'planes', 'tecnica'].map(n => cargar(`../contenido/${n}.json`)));
anotarApertura('contenido');
// Banco ampliado (contenido/ejercicios-extra.json, datos MIT de hasaneyldrm/exercises-dataset, sin imágenes): se
// pueden buscar, agregar a mano y reconocer al importar, pero no tienen revisión profesional ni entran al plan
// automático (su patrón es 'otro', que el motor no usa) ni a las recomendaciones.
// Se carga aparte (asegurarExtras), no al abrir la app: pesa 200 KB. Al abrir solo si ya usaste alguno.
export const EXTRAS = [];
export const indice = crearIndice(catalogo);
let cargaExtras = null;
/** Carga el banco ampliado una vez y lo suma al índice (sin pisar nombres del catálogo revisado). */
export function asegurarExtras() {
  return (cargaExtras ||= cargar('../contenido/ejercicios-extra.json').then(d => {
    for (const x of d?.ejercicios || []) {
      if (indice.porId.has(x.id)) continue;
      const e = { id: x.id, nombre: x.n, nombre_hevy: null, alias: [x.en], patron: 'otro', musculos_primarios: x.p, musculos_secundarios: x.s,
        equipamiento: x.q, carga_articular: [], nivel_minimo: 'principiante', tipo: x.t, preferencia: 9, extra: true };
      EXTRAS.push(e); indice.ejercicios.push(e); indice.porId.set(e.id, e);
      for (const n of [e.nombre, ...e.alias]) { const k = normalizar(n); if (!indice.porNombre.has(k)) indice.porNombre.set(k, e); }
    }
    return EXTRAS;
  }).catch(() => { cargaExtras = null; return EXTRAS; }));
}
/** Si lo guardado usa ejercicios del banco ampliado, hay que tenerlos antes de dibujar. */
export const usaExtras = e => /"extra_\d/.test(JSON.stringify([e?.sesiones, e?.plan, e?.rutinas, e?.registro]));
export const IMAGENES = new Set(await disponibles);

export const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
export const ahora = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).replace(' ', 'T').slice(0, 16);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = id => document.getElementById(id);
export const fechaCorta = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export const presc = e => `${e.series} × ${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${sufijo(e)}${e.unidad === 'm' ? '' : ` · RIR ${e.rir}`}${e.carga_kg ? ` · ${peso(e.carga_kg)}` : ''}`;

// ── Unidad de peso: se guarda siempre en kilos; se muestra y se escribe en la unidad de la persona ─
const LB = 0.45359237;
export const unidadPeso = () => (E.respuestas?.unidad === 'lb' ? 'lb' : 'kg');
/** Kilos guardados → número en la unidad de la persona (las libras, redondeadas a media). */
export const enUnidad = kg => (kg == null || kg === '' ? null : unidadPeso() === 'lb' ? Math.round((kg / LB) * 2) / 2 : Number(kg));
/** Número escrito en la unidad de la persona → kilos para guardar. */
export const aKilos = v => (v == null ? null : unidadPeso() === 'lb' ? Math.round(v * LB * 100) / 100 : v);
/** "42,5 kg" o "93,5 lb". */
export const peso = kg => (kg == null || kg === '' ? '' : `${String(enUnidad(kg)).replace('.', ',')} ${unidadPeso()}`);
/** "40 kg × 10, 10 · 42,5 kg × 8": series agrupadas por peso, en la unidad de la persona. */
export function seriesTexto(series) {
  const partes = [];
  for (const s of series) {
    if (!partes.length || partes.at(-1).carga !== s.carga_kg) partes.push({ carga: s.carga_kg, reps: [] });
    partes.at(-1).reps.push(s.reps ?? '?');
  }
  return partes.map(p => `${p.carga ? `${peso(p.carga)} × ` : ''}${p.reps.join(', ')}`).join(' · ');
}
/** Volumen grande con separador de miles: "1.240 kg". */
export const volumenTexto = kg => `${Math.round(enUnidad(kg) || 0).toLocaleString('es-CL')} ${unidadPeso()}`;

// ── Estado guardado en este navegador ───────────────────────────────────────
const CLAVE_ORIGINAL = 'entreno-v2';
let errorPerfilPrueba = null;
export let errorRetornoCuenta = null;
// El acceso vuelve al perfil que lo pidió, antes de elegir sus claves de datos y sesión.
// Un retorno inválido conserva la selección actual; nunca se interpreta como una copia local dañada.
if (CONFIG.modoPrueba && typeof location !== 'undefined') {
  try {
    const retorno = perfilDelRetornoCuenta(location.href, localStorage);
    if (retorno) seleccionarPerfilPrueba(localStorage, retorno.perfilId);
  } catch (e) { errorRetornoCuenta = e.message; }
}
export const perfilDePrueba = (() => {
  try { return CONFIG.modoPrueba ? perfilPruebaActivo(localStorage) : null; }
  catch (e) { errorPerfilPrueba = e.message; return null; }
})();
const CLAVE_PERSONAL = perfilDePrueba ? clavePerfilPrueba(perfilDePrueba.id) : CLAVE_ORIGINAL;
const AMBITO_LOCAL = perfilDePrueba ? `prueba:${perfilDePrueba.id}` : 'local';
/** La sesión del correo también es independiente para cada botón de prueba. */
export const claveSesionCuenta = () => claveSesionPerfilPrueba(perfilDePrueba?.id || null);
let CLAVE = CLAVE_PERSONAL;
export let ambitoDatos = AMBITO_LOCAL;
export let modoEjemplo = false;
/** Avisos de cada guardado, sin argumentos (app/sesion-nube.js sube la sesión en curso). Nunca impiden guardar. */
export const alGuardar = new Set();
export let errorGuardado = errorPerfilPrueba;
let lecturaFallida = Boolean(errorPerfilPrueba);
const VACIO = () => ({
  vista: 'inicio', seccion: 0, respuestas: {}, plan: null, semana: 1,
  bienestar: {}, registro: {}, notas: {}, sesiones: [], chat: [], consentimientos: {},
  suplementos: [], tomas: [], indicaciones: [], checkins: {}, macro: null, descargaNo: {}, filas: {}, descansos: {}, pedido: '', mensaje: null,
  marcasPlan: {},
});
export let E = VACIO();
try {
  if (errorPerfilPrueba) throw new Error(errorPerfilPrueba);
  const guardado = localStorage.getItem(CLAVE);
  if (perfilDePrueba && guardado == null) throw new Error('Falta la copia de ese perfil');
  const viejo = CLAVE_PERSONAL === CLAVE_ORIGINAL ? JSON.parse(localStorage.getItem('entreno-demo-v1') || 'null') : null;
  E = { ...E, ...(viejo ? { respuestas: viejo.respuestas, plan: viejo.plan } : {}), ...JSON.parse(guardado || '{}') };
  corregirHistorial(E.sesiones, indice); // solo en memoria: se guarda con el próximo cambio
  compactarChat(E.chat, { protegida: E.chatPorTraer?.id }); // propuestas viejas: sin su plan completo, igual en memoria
} catch { lecturaFallida = true; errorGuardado = errorPerfilPrueba || 'No pude leer tus datos guardados. Descarga un respaldo de esta sesión antes de cerrar.'; }
// La segunda copia (IndexedDB) se lee al cargar cada ámbito (al abrir y al entrar a una cuenta), antes de escribirla de
// nuevo: si el almacenamiento principal quedó atrás, recuperarCopia() la usa. alCargar guarda la hora del estado
// principal tal como estaba al cargarlo.
let revisionLocal = 0;
let alCargar = { clave: CLAVE, guardadoEn: lecturaFallida ? 0 : Number(E.guardadoEn) || 0, lectura: leerCopia(CLAVE), consumida: false, revisionInicial: revisionLocal };
// Los ejercicios que crea la persona (nucleo/propios.js) se suman al catálogo del teléfono: así el banco, Hoy, el
// validador y el historial los tratan como cualquier otro. Se rehace en cada guardado (cambia con la cuenta o el ejemplo).
export function alinearPropios() {
  if (!Array.isArray(indice.ejercicios)) return;
  const propios = Array.isArray(E.ejerciciosPropios) ? E.ejerciciosPropios : [];
  for (const [id, e] of indice.porId) if (e.propio) indice.porId.delete(id);
  for (let i = indice.ejercicios.length - 1; i >= 0; i--) if (indice.ejercicios[i].propio) indice.ejercicios.splice(i, 1);
  for (const e of propios) if (e?.id && !indice.porId.has(e.id)) { const ej = { ...e, propio: true }; indice.ejercicios.push(ej); indice.porId.set(ej.id, ej); }
}
export function guardar() {
  const reloj = () => globalThis.performance?.now?.() ?? Date.now();
  const inicio = reloj();
  if (esperaPronto) { clearTimeout(esperaPronto); esperaPronto = 0; } // lo escrito hasta ahora entra en este guardado
  revisionLocal += 1;
  alinearPropios();
  for (const fn of alGuardar) try { fn(); } catch { /* un aviso nunca impide guardar */ }
  try {
    if (lecturaFallida) throw new Error('Los datos anteriores no se pudieron leer');
    if (ambitoDatos !== AMBITO_LOCAL && !modoEjemplo && E.firmaPreferenciasCuenta) {
      const p = { unidad: E.respuestas?.unidad || 'kg', asistente: E.asistente || 'entrenadora' };
      if (JSON.stringify(p) !== E.firmaPreferenciasCuenta) E.preferenciasPendientes = p;
    }
    E.guardadoEn = Date.now();
    const texto = JSON.stringify(E);
    // La segunda copia se programa antes de escribir el principal: si este falla (sin espacio), la copia queda igual.
    escribirCopia(CLAVE, texto, E.guardadoEn);
    localStorage.setItem(CLAVE, texto);
    if (localStorage.getItem(CLAVE) !== texto) throw new Error('La copia guardada no coincide');
    try { medirGuardado(Math.round((reloj() - inicio) * 10) / 10, texto.length); } catch { /* medir nunca impide guardar */ }
    errorGuardado = null; sinEspacio = false;
    document.getElementById('error-guardado')?.remove();
    return true;
  } catch (e) {
    // Sin espacio (Safari da unos 5 MB y ahí conviven varias copias completas): se mueven las otras a IndexedDB y
    // se vuelve a guardar, una sola vez por ejecución (al cerrar se guarda varias veces seguidas).
    sinEspacio = !lecturaFallida && (e?.name === 'QuotaExceededError' || e?.code === 22 || /quota/i.test(e?.message || ''));
    errorGuardado = sinEspacio ? 'Este teléfono se quedó sin espacio para guardar Entreno.' : 'No se guardaron los últimos cambios en este teléfono. Descarga un respaldo antes de cerrar o recargar.';
    if (sinEspacio && !liberacion) liberacion = liberarEspacio(MOVIBLE).then(() => guardar()).catch(() => false);
    // El estado interno conserva el fallo; no se interrumpe el entrenamiento con un aviso persistente.
    document.getElementById('error-guardado')?.remove();
    return false;
  }
}
// Las copias completas que se pueden pasar a IndexedDB sin perder nada: otras cuentas (se recuperan desde su copia al
// volver a ellas), el ejemplo y las copias de seguridad de una recuperación. La copia personal, los perfiles de prueba
// y la migración antigua se leen directo del principal, así que se quedan.
const MOVIBLE = k => k !== CLAVE && /^entreno-(cuenta-|anterior-|antes-separar-demo$|ejemplo-v1$)/.test(k);
let sinEspacio = false, liberacion = null;
// Mientras se escribe en un campo, cada tecla no reescribe todo: se guarda 300 ms después de la última (guardarPronto).
// Marcar una serie, cambiar de pantalla, pasar al fondo o cualquier guardar() incluyen lo escrito hasta ese momento.
let esperaPronto = 0;
let personal = E;
export function guardarPronto() {
  revisionLocal += 1; // ya hay un cambio, aunque todavía no esté escrito (recuperarCopia no debe pisarlo)
  clearTimeout(esperaPronto);
  esperaPronto = setTimeout(guardar, 300);
}
/** Antes de quedarse sin espacio (app/actualizacion.js, al abrir): pasa a IndexedDB las copias que no son la activa. */
export const liberarOtrasCopias = () => liberarEspacio(MOVIBLE);
/** Guarda y, si falló por espacio, espera a que se libere y reintenta. Para lo que no puede seguir sin guardar. */
export async function guardarConEspacio() {
  if (guardar()) return true;
  if (!sinEspacio) return false;
  liberacion ||= liberarEspacio(MOVIBLE).then(() => guardar()).catch(() => false);
  await liberacion;
  return guardar();
}
/** Para el aviso: cuánto ocupa el almacenamiento principal y si falta espacio. */
export const estadoAlmacenamiento = () => ({ sinEspacio, ...usoAlmacenamiento() });
let claveAntesEjemplo = CLAVE_PERSONAL;
alinearPropios();
export function entrarEjemplo() {
  if (!modoEjemplo) { guardar(); personal = E; claveAntesEjemplo = CLAVE; }
  modoEjemplo = true; CLAVE = 'entreno-ejemplo-v1'; E = VACIO();
}
export function salirEjemplo() {
  modoEjemplo = false; CLAVE = claveAntesEjemplo; E = personal; guardar();
}
/** Una copia distinta por cuenta. Lo local solo se transfiere por elección explícita. */
export function activarCuenta(id = null) {
  if (modoEjemplo) salirEjemplo();
  const nueva = id ? `entreno-cuenta-${id}${perfilDePrueba ? '-prueba-' + perfilDePrueba.id : ''}` : CLAVE_PERSONAL;
  if (CLAVE === nueva) return;
  const sinCambiosDesdeCarga = !lecturaFallida && !alCargar.consumida && alCargar.clave === CLAVE && revisionLocal === alCargar.revisionInicial;
  if (!sinCambiosDesdeCarga && !guardar()) throw new Error('Respalda los cambios pendientes antes de cambiar de cuenta.');
  let datos;
  try { datos = JSON.parse(localStorage.getItem(nueva) || '{}'); }
  catch { throw new Error('No pude leer la copia de esa cuenta. Tus datos actuales se conservan.'); }
  E = { ...VACIO(), ...datos }; CLAVE = nueva; ambitoDatos = id || AMBITO_LOCAL; personal = E;
  corregirHistorial(E.sesiones, indice);
  compactarChat(E.chat, { protegida: E.chatPorTraer?.id });
  alCargar = { clave: nueva, guardadoEn: Number(datos.guardadoEn) || 0, lectura: leerCopia(nueva, { renovar: true }), consumida: false, revisionInicial: revisionLocal };
  // La copia nueva se recupera antes de guardar: no dar una hora nueva a un estado vacío todavía.
  lecturaFallida = false; alinearPropios();
}
export function resumenLocal() {
  const d = JSON.parse(localStorage.getItem(CLAVE_PERSONAL) || '{}');
  return { perfil: Boolean(Object.keys(d.respuestas || {}).length), sesiones: (d.sesiones || []).filter(s => s.origen !== 'ejemplo').length };
}
export function revisionTrasladoLocal() {
  return revisarTrasladoCuenta(JSON.parse(localStorage.getItem(CLAVE_PERSONAL) || '{}'), hoy());
}
// La recuperación se acredita solo en esta ejecución y para esta copia de la cuenta.
let cuentaLeida = null;
export function marcarCuentaRecuperada(usuario = null) { cuentaLeida = usuario ? { usuario, estado: E } : null; }
export function cuentaRecuperada(usuario) { return Boolean(usuario && cuentaLeida?.usuario === usuario && cuentaLeida.estado === E); }
export function cuentaVaciaParaTraslado() {
  return !E.plan && !E.planPendiente && !Object.keys(E.respuestas || {}).some(k => k !== 'unidad') && !E.sesiones.length
    && !E.indicaciones.length && !E.suplementos.length && !E.tomas.length && !Object.keys(E.bienestar).length
    && !Object.keys(E.notasFijas || {}).length && !E.ejerciciosPropios?.length && !E.medidas?.length;
}
export function traerPerfilLocal(usuario) {
  if (!cuentaRecuperada(usuario)) throw new Error('Recupera primero los datos de esta cuenta con Sincronizar ahora.');
  if (CLAVE === CLAVE_PERSONAL || !cuentaVaciaParaTraslado()) throw new Error('La cuenta debe estar vacía para copiar el perfil local.');
  const d = JSON.parse(localStorage.getItem(CLAVE_PERSONAL) || '{}');
  const revision = revisarTrasladoCuenta(d, hoy());
  if (!revision.ok) throw new Error(revision.mensaje);
  E = { ...VACIO(), ...structuredClone(d), pendientes: [], chat: [] };
  E.sesiones = E.sesiones.filter(s => s.origen !== 'ejemplo').map(s => ({ ...s, enCuenta: false }));
  E.bienestar = Object.fromEntries(Object.entries(E.bienestar).map(([f, b]) => [f, { ...b, enCuenta: false }]));
  E.indicaciones = E.indicaciones.map(i => ({ ...i, enCuenta: false, archivo: null, archivoPendiente: false }));
  // Las fotos y documentos no se transfieren automáticamente entre ámbitos.
  if (!guardar()) throw new Error('No pude guardar la copia en este teléfono.');
}
// El historial ficticio antiguo se conserva aparte y se excluye del perfil personal.
if (E.sesiones.some(s => s.origen === 'ejemplo')) {
  try { localStorage.setItem('entreno-antes-separar-demo', JSON.stringify(E)); }
  catch { errorGuardado = 'No pude guardar la copia previa de tus datos. Descarga un respaldo antes de continuar.'; }
  if (!errorGuardado) { E.sesiones = E.sesiones.filter(s => s.origen !== 'ejemplo'); guardar(); }
}

export const reiniciar = () => { lecturaFallida = false; E = VACIO(); guardar(); };
/**
 * Al abrir: si la segunda copia es más reciente que el almacenamiento principal (el teléfono lo borró o una escritura
 * falló), vuelve a lo último que se escribió. Devuelve true si recuperó algo.
 */
export async function recuperarCopia() {
  const carga = alCargar, { clave, guardadoEn } = carga, revision = revisionLocal;
  if (carga.consumida || modoEjemplo || CLAVE !== clave) return false;
  const copia = await carga.lectura;
  if (carga !== alCargar || CLAVE !== clave || modoEjemplo || carga.consumida) return false;
  carga.consumida = true;
  // Si la persona guardó algo mientras se leía la copia, conserva esos cambios actuales.
  if (revision !== revisionLocal) return false;
  const estado = estadoDeCopia(guardadoEn, copia);
  if (!estado) return false;
  E = { ...VACIO(), ...estado };
  corregirHistorial(E.sesiones, indice);
  personal = E;
  lecturaFallida = false; errorGuardado = null;
  guardar();
  return true;
}
/** La navegación automática nunca debe convertir una copia todavía sin recuperar en una escritura nueva. */
export function guardarRetorno(pantalla) {
  if (!modoEjemplo && !alCargar.consumida) return false;
  E.pantallaGuardada = pantalla;
  return guardar();
}
// Al pasar al fondo o cerrar se guarda una sola vez: primero se anota lo que pidan las vistas (la pantalla para volver,
// app/app.js), después se guarda y la segunda copia se escribe de inmediato. Un pagehide justo después de pasar al
// fondo, sin cambios entre medio, no vuelve a escribir.
const antesDeOcultar = [];
export const alOcultar = fn => { antesDeOcultar.push(fn); };
let revisionOculta = null;
function guardarAlOcultar() {
  if (lecturaFallida || !(modoEjemplo || alCargar.consumida)) return;
  if (revisionOculta === revisionLocal && !esperaPronto) return;
  for (const fn of antesDeOcultar) { try { fn(); } catch { /* la pantalla de retorno es opcional */ } }
  guardar();
  revisionOculta = revisionLocal;
  vaciarCopia();
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarAlOcultar(); });
  globalThis.addEventListener?.('pagehide', guardarAlOcultar);
}
/** Versión de prueba: borra el cuestionario y el plan para volver a probarlos, y deja lo anotado (historial,
 *  series, notas, suplementos e indicaciones). */
export function empezarDeNuevo() {
  E.vista = 'cuestionario'; E.paso = 0; E.seccion = 0;
  E.mensaje = 'Puedes revisar tus respuestas. Tus registros y tu perfil se conservan.';
  guardar();
}

/** Respaldo de todo lo anotado en este teléfono. Desde la versión 2 incluye las fotos de progreso: [{id, fecha, angulo, datos}]. */
export const respaldo = (fotos = []) => ({ app: 'entreno', version: 2, creado: new Date().toISOString(), estado: E, fotos });
export function restaurar(r) {
  validarRespaldo(r, new Set([...[...indice.porId.values()].filter(e => !e.propio).map(e => e.id), ...(r.estado?.ejerciciosPropios || []).map(e => e?.id)]));
  const antes = E, bloqueoAnterior = lecturaFallida;
  lecturaFallida = false;
  E = { ...VACIO(), ...structuredClone(r.estado), vista: 'hoy', mensaje: null };
  corregirHistorial(E.sesiones, indice);
  if (!modoEjemplo) E.sesiones = E.sesiones.filter(s => s.origen !== 'ejemplo');
  if (!guardar()) { E = antes; lecturaFallida = bloqueoAnterior; throw new Error('No pude guardar el respaldo. Tus datos anteriores se conservan.'); }
}
/** Muestra esa semana del plan la próxima vez que se abra Semana (si no, se abre la semana en curso). */
export const sesionVista = { semanaElegida: false };
export function mostrarSemana(n) { E.semana = n; sesionVista.semanaElegida = true; }
export const R = () => E.respuestas;
export const D = () => derivar(R(), C, hoy());

/** Contexto que esperan las funciones del núcleo (coach, agenda, explicar). */
/** Fechas del plan ya hechas (en la app o en Hevy): al reacomodar la semana, esas no se mueven. */
function hechasDelPlan() {
  if (!E.plan?.dias?.length) return [];
  const r = estadoDelPlan(E.plan, E.sesiones, { hoy: hoy(), marcas: E.marcasPlan || {} });
  return [...r.porDia].filter(([, e]) => ['hecha', 'recuperada', 'adelantada', 'hecha_sin_registro'].includes(e.t)).map(([f]) => f);
}
export const ctxNucleo = () => ({
  plan: E.plan, hoy: hoy(), respuestas: R(), derivados: D(), indice, evidencia: EVIDENCIA, consentimientos: E.consentimientos, indicaciones: E.indicaciones,
  hechas: hechasDelPlan(),
  // Series anotadas con fecha, para calcular el peso de un ejercicio cambiado (se arma solo si se usa).
  get historial() { return seriesAnotadas(E.sesiones, E.registro); },
});

/** Cambia el plan local y, con cuenta, lo guarda en el servidor (que lo valida). */
/** Cambia el plan aquí y, con cuenta, en el servidor. Devuelve el aviso si el servidor no lo aceptó (o null). */
/** Avisos de cambio del plan (app/datos-nube.js sube aparte sus ejercicios propios). Se llaman con (anterior, nuevo). */
export const alCambiarPlan = new Set();
export async function cambiarPlan(plan, mensaje, nube) {
  const estado = E, usuario = nube?.usuarioId?.();
  if (E.chatPorTraer) {
    const aviso = 'Sincroniza los cambios del chat antes de modificar el plan.';
    E.mensaje = aviso; guardar(); return aviso;
  }
  const remoto = nube?.conectado() && !plan.libre;
  // La copia pendiente también impide confirmar otra propuesta mientras esta
  // escritura sigue en curso, y permite recuperarla si se cierra la app.
  if (remoto) E.planPendiente = structuredClone(plan);
  else if (plan.libre) delete E.planPendiente;
  // Antes de cambiar, una copia del plan anterior para poder deshacerlo (como los cambios del Coach de OpenGym). Solo las
  // últimas tres: un plan pesa, y el teléfono tiene poco espacio. Lo registrado nunca está en la copia ni se toca.
  if (E.plan && !E.plan.libre && plan !== E.plan && JSON.stringify(E.plan) !== JSON.stringify(plan)) {
    E.cambiosPlan = [{ cuando: new Date().toISOString(), mensaje: mensaje || 'Cambio del plan', plan: structuredClone(E.plan) }, ...(E.cambiosPlan || [])].slice(0, 3);
  }
  const anterior = E.plan;
  // Un ejercicio que sale de la sesión en curso (reemplazado, ajustado) conserva sus series hechas para guardarlas.
  if (Object.keys(E.registro || {}).length) E.retirados = retiradosAlCambiar(anterior, plan, { registro: E.registro, sesiones: E.sesiones, retirados: E.retirados || {} });
  E.plan = plan; E.mensaje = mensaje || null; guardar();
  for (const fn of alCambiarPlan) fn(anterior, plan);
  // El plan libre (entrenar sin plan) queda en el teléfono; las sesiones sí se sincronizan.
  if (!remoto) return null;
  const firma = JSON.stringify(plan);
  const vigente = () => E === estado && nube?.usuarioId?.() === usuario && E.plan === plan && JSON.stringify(E.plan) === firma && !E.chatPorTraer;
  const cambioDeAmbito = 'La cuenta o el plan cambió mientras se guardaba. Revisa el estado actual antes de continuar.';
  try {
    const r = await nube.guardarPlan(plan);
    if (!vigente()) return cambioDeAmbito;
    E.plan.id = r.id; delete E.planPendiente; guardar(); return null;
  }
  catch (e) {
    if (!vigente()) return cambioDeAmbito;
    const aviso = `Se cambió en este teléfono, pero el servidor no lo aceptó: ${e.datos?.errores?.map(x => x.mensaje).join(' ') || e.message}`;
    E.mensaje = aviso; guardar();
    E.planPendiente = structuredClone(plan); guardar();
    return aviso;
  }
}

/** Número escrito por la persona: acepta coma o punto ("42,5"). Vacío o inválido → null. */
export function numero(v) {
  const t = String(v ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
/** Número para mostrar en un campo, con coma decimal. */
export const coma = x => (x == null || x === '' ? '' : String(x).replace('.', ','));

// ── Avisos flotantes ────────────────────────────────────────────────────────
let relojAviso = null;
/** Aviso sobre el menú inferior: se ve aunque estés al final de la página. Se cierra solo o al tocarlo. */
export function avisar(texto, tipo = /no se pudo|no pude|no se activ|bloquead|todavía no|marca al menos/i.test(texto) ? 'ojo' : 'bien') {
  let el = document.getElementById('aviso-flotante');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aviso-flotante';
    el.setAttribute('role', 'status');
    el.addEventListener('click', () => el.classList.remove('visible'));
    document.body.append(el);
  }
  el.className = `aviso ${tipo}`;
  el.textContent = texto;
  requestAnimationFrame(() => el.classList.add('visible'));
  clearTimeout(relojAviso);
  relojAviso = setTimeout(() => el.classList.remove('visible'), Math.min(10000, 3500 + texto.length * 45));
}
/** Muestra una sola vez el mensaje que dejó la última acción (E.mensaje). */
export function mostrarMensaje() {
  if (!E.mensaje) return;
  avisar(E.mensaje);
  E.mensaje = null;
  guardar();
}

// Formularios pequeños que se repiten.
export const chk = c => (c ? ' checked' : '');
export function escala(nombre, min, max, v, extremos, attrs = '') {
  let s = '<div class="escala">';
  for (let i = min; i <= max; i++) s += `<label><input type="radio" name="${nombre}" ${attrs} value="${i}"${chk(Number(v) === i)}>${i}</label>`;
  return s + `</div>${extremos ? `<div class="extremos"><span>${esc(extremos[0])}</span><span>${esc(extremos[1])}</span></div>` : ''}`;
}
export function opcionesRadio(nombre, opciones, v, attrs = '') {
  return `<div class="chips">${opciones.map(([val, t]) => `<label><input type="radio" name="${nombre}" ${attrs} value="${esc(val)}"${chk(String(v) === String(val))}>${esc(t)}</label>`).join('')}</div>`;
}
