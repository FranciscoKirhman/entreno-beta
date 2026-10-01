// Estado y utilidades que comparten las vistas de la app. Todo funciona sin cuenta (en este navegador);
// con cuenta, nube.js sincroniza con Supabase.
import { crearIndice } from '../nucleo/catalogo.js';
import { derivar } from '../nucleo/derivar.js';

const cargar = u => fetch(u).then(r => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
export const [C, catalogo, K, EVIDENCIA, PLANES] = await Promise.all(
  ['cuestionario', 'ejercicios', 'checkin', 'evidencia', 'planes'].map(n => cargar(`../contenido/${n}.json`)));
export const indice = crearIndice(catalogo);

export const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
export const ahora = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).replace(' ', 'T').slice(0, 16);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = id => document.getElementById(id);
export const fechaCorta = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export const presc = e => `${e.series} × ${e.reps_min}${e.reps_max !== e.reps_min ? `–${e.reps_max}` : ''}${e.unidad === 'seg' ? ' s' : ''} · RIR ${e.rir}${e.carga_kg ? ` · ${String(e.carga_kg).replace('.', ',')} kg` : ''}`;

// ── Estado guardado en este navegador ───────────────────────────────────────
const CLAVE = 'entreno-v2';
const VACIO = () => ({
  vista: 'inicio', seccion: 0, respuestas: {}, plan: null, semana: 1,
  bienestar: {}, registro: {}, notas: {}, sesiones: [], chat: [], consentimientos: {},
  suplementos: [], tomas: [], indicaciones: [], checkins: {}, macro: null, descargaNo: {}, pedido: '', mensaje: null,
});
export let E = VACIO();
try {
  const viejo = JSON.parse(localStorage.getItem('entreno-demo-v1') || 'null');
  E = { ...E, ...(viejo ? { respuestas: viejo.respuestas, plan: viejo.plan } : {}), ...JSON.parse(localStorage.getItem(CLAVE) || '{}') };
} catch { /* sin almacenamiento: se parte de cero */ }
export const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(E)); } catch { /* modo privado */ } };
export const reiniciar = () => { E = VACIO(); guardar(); };

/** Respaldo de todo lo anotado en este teléfono. Desde la versión 2 incluye las fotos de progreso: [{id, fecha, angulo, datos}]. */
export const respaldo = (fotos = []) => ({ app: 'entreno', version: 2, creado: new Date().toISOString(), estado: E, fotos });
export function restaurar(r) {
  if (r?.app !== 'entreno' || !r.estado || typeof r.estado !== 'object' || Array.isArray(r.estado)) throw new Error('Ese archivo no es un respaldo de Entreno.');
  E = { ...VACIO(), ...r.estado, vista: 'hoy', mensaje: null }; guardar();
}
export const R = () => E.respuestas;
export const D = () => derivar(R(), C, hoy());

/** Contexto que esperan las funciones del núcleo (coach, agenda, explicar). */
export const ctxNucleo = () => ({
  plan: E.plan, hoy: hoy(), respuestas: R(), derivados: D(), indice, evidencia: EVIDENCIA, consentimientos: E.consentimientos,
});

/** Cambia el plan local y, con cuenta, lo guarda en el servidor (que lo valida). */
/** Cambia el plan aquí y, con cuenta, en el servidor. Devuelve el aviso si el servidor no lo aceptó (o null). */
export async function cambiarPlan(plan, mensaje, nube) {
  E.plan = plan; E.mensaje = mensaje || null; guardar();
  if (!nube?.conectado()) return null;
  try { await nube.guardarPlan(plan); return null; }
  catch (e) {
    const aviso = `Se cambió en este teléfono, pero el servidor no lo aceptó: ${e.datos?.errores?.map(x => x.mensaje).join(' ') || e.message}`;
    E.mensaje = aviso; guardar();
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
