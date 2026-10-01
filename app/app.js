// App Entreno. Funciona sin cuenta (todo en este navegador) y con cuenta (Supabase). Usa el mismo núcleo
// que el servidor: nucleo/*.js.
//
//   node herramientas/servir.mjs  →  http://127.0.0.1:5173/app/
import { C, E, guardar, R, D, esc, $, hoy, indice } from './comun.js';
import { derivar } from '../nucleo/derivar.js';
import { generarPlan } from '../nucleo/motor-plan.js';
import { vistaHoy } from './hoy.js';
import { vistaSemana } from './semana.js';
import { vistaCoach } from './coach-ui.js';
import { vistaProgreso } from './progreso.js';
import { vistaMas } from './mas.js';
import { vistaCheckin } from './checkin.js';
import { historialReciente } from './temporada.js';
import { programarAvisos } from './avisos.js';
import { dejarPendiente, subirPendientes } from './cola.js';
import * as nube from './nube.js';
import { CONFIG } from './config.js';

const chk = cond => (cond ? ' checked' : '');

// ── Visibilidad ─────────────────────────────────────────────────────────────
function cumple(cond) {
  if (!cond) return true;
  return Object.entries(cond).every(([id, valores]) => {
    const v = R()[id];
    if (valores.includes('alguna')) return Array.isArray(v) && v.length > 0;
    if (Array.isArray(v)) return v.some(x => valores.includes(x));
    return valores.includes(v);
  });
}
const seccionesVisibles = () => C.secciones.filter(s => cumple(s.mostrar_si));
const preguntasVisibles = s => s.preguntas.filter(p => cumple(p.mostrar_si));

// ── Render de preguntas ─────────────────────────────────────────────────────
const DIAS = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];

function campo(p) {
  const v = R()[p.id];
  const id = `p-${p.id}`;
  switch (p.tipo) {
    case 'texto': return `<input type="text" id="${id}" data-p="${p.id}" value="${esc(v)}" autocomplete="off">`;
    case 'texto_largo': return `<textarea id="${id}" data-p="${p.id}">${esc(v)}</textarea>`;
    case 'numero': return `<input type="number" id="${id}" data-p="${p.id}" data-num min="${p.min ?? ''}" max="${p.max ?? ''}" step="${p.paso ?? 1}" value="${esc(v)}" inputmode="decimal"> <span class="suave pequeno">${esc(p.unidad || '')}</span>`;
    case 'fecha': return `<input type="date" id="${id}" data-p="${p.id}" value="${esc(v)}">`;
    case 'una': return `<div class="opciones" role="radiogroup">${p.opciones.map(([val, t]) => `<label><input type="radio" name="${p.id}" data-p="${p.id}" value="${esc(val)}"${chk(v === val)}>${esc(t)}</label>`).join('')}</div>`;
    case 'varias': return `<div class="chips">${p.opciones.map(([val, t]) => `<label><input type="checkbox" data-p="${p.id}" data-varias value="${esc(val)}"${chk((v || []).includes(val))}>${esc(t)}</label>`).join('')}</div>`;
    case 'si_no': return `<div class="opciones">${[[true, 'Sí'], [false, 'No']].map(([val, t]) => `<label><input type="radio" name="${p.id}" data-p="${p.id}" data-bool value="${val}"${chk(v === val)}>${t}</label>`).join('')}</div>`;
    case 'consentimiento': return `<div class="opciones"><label><input type="checkbox" data-p="${p.id}" data-consent${chk(v === true)}>${esc(p.texto)}</label></div>`;
    case 'escala': return escalaQ(p.id, p.min, p.max, v, p.extremos, `data-p="${p.id}"`);
    case 'dias': {
      const max1 = p.maximo === 1;
      return `<div class="escala">${DIAS.map(([d, t]) => `<label title="${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d]}"><input type="${max1 ? 'radio' : 'checkbox'}" name="${p.id}" data-p="${p.id}" data-dias${max1 ? ' data-uno' : ''} value="${d}"${chk(max1 ? v === d : (v || []).includes(d))}>${t}</label>`).join('')}</div>`;
    }
    case 'matriz': case 'matriz_si_no': {
      const ops = p.tipo === 'matriz' ? p.opciones : [[true, 'Sí'], [false, 'No']];
      return `<div class="matriz">${p.filas.map(([f, t]) => `<div class="fila"><span class="pequeno">${esc(t)}</span><div class="escala">${ops.map(([val, tt]) => `<label><input type="radio" name="${p.id}.${f}" data-p="${p.id}" data-fila="${f}"${p.tipo === 'matriz_si_no' ? ' data-bool' : ''} value="${val}"${chk((v || {})[f] === val)}>${esc(tt)}</label>`).join('')}</div></div>`).join('')}</div>`;
    }
    case 'mapa_corporal': return mapa(p, v);
    case 'ejercicios': return ejercicios(p, v);
    case 'lugares': return lugares(p, v);
    default: return `<p class="suave">Tipo ${esc(p.tipo)} sin interfaz todavía.</p>`;
  }
}

function escalaQ(nombre, min, max, v, extremos, attrs) {
  let s = '<div class="escala">';
  for (let i = min; i <= max; i++) s += `<label><input type="radio" name="${nombre}" ${attrs} data-num value="${i}"${chk(v === i)}>${i}</label>`;
  return s + `</div>${extremos ? `<div class="extremos"><span>${esc(extremos[0])}</span><span>${esc(extremos[1])}</span></div>` : ''}`;
}

function mapa(p, v) {
  const zonas = C.zonas[p.zonas];
  const conDetalle = Array.isArray(p.por_zona);
  const elegidas = conDetalle ? (v || []).map(x => x.region) : (v || []);
  let s = `<div class="chips">${zonas.map(([z, t]) => `<label><input type="checkbox" data-p="${p.id}" data-zona value="${z}"${chk(elegidas.includes(z))}>${esc(t)}</label>`).join('')}</div>`;
  if (conDetalle) {
    for (const x of v || []) {
      const nombre = zonas.find(z => z[0] === x.region)?.[1] || x.region;
      s += `<div class="subcampos"><strong>${esc(nombre)}</strong>${p.por_zona.map(f => {
        const val = x[f.id];
        const a = `data-p="${p.id}" data-zona-campo="${f.id}" data-region="${x.region}"`;
        if (f.tipo === 'una') return `<label>${esc(f.texto)}<select ${a}><option value="">—</option>${f.opciones.map(([o, t]) => `<option value="${o}"${val === o ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
        if (f.tipo === 'escala') return `<label>${esc(f.texto)}</label>${escalaQ(`${p.id}.${x.region}.${f.id}`, f.min, f.max, val, f.extremos, a)}`;
        if (f.tipo === 'fecha') return `<label>${esc(f.texto)}<input type="date" ${a} value="${esc(val)}"></label>`;
        return `<label>${esc(f.texto)}<textarea ${a}>${esc(val)}</textarea></label>`;
      }).join('')}</div>`;
    }
  }
  return s;
}

function ejercicios(p, v) {
  const conCampos = Array.isArray(p.campos);
  const elegidos = conCampos ? (v || []) : (v || []).map(id => ({ ejercicio_id: id }));
  let s = `<input type="text" data-buscar="${p.id}" placeholder="Busca un ejercicio: sentadilla, banca, hip thrust…" autocomplete="off"><div class="chips" id="res-${p.id}"></div>`;
  if (elegidos.length) {
    s += `<div class="subcampos">${elegidos.map(x => `<div><label><input type="checkbox" checked data-p="${p.id}" data-quitar="${x.ejercicio_id}"> ${esc(indice.porId.get(x.ejercicio_id)?.nombre)}</label>${conCampos ? ` <input type="number" data-p="${p.id}" data-ej="${x.ejercicio_id}" data-c="peso_kg" data-num placeholder="kg" value="${esc(x.peso_kg)}" style="width:90px"> × <input type="number" data-p="${p.id}" data-ej="${x.ejercicio_id}" data-c="repeticiones" data-num placeholder="reps" value="${esc(x.repeticiones)}" style="width:80px">` : ''}</div>`).join('')}</div>`;
  }
  return s;
}

function resultadosBusqueda(pid, q) {
  const caja = document.getElementById(`res-${pid}`);
  if (!caja) return;
  const n = q.trim().toLowerCase();
  if (n.length < 2) { caja.innerHTML = ''; return; }
  const lista = indice.ejercicios.filter(e => `${e.nombre} ${e.nombre_hevy}`.toLowerCase().includes(n)).slice(0, 8);
  caja.innerHTML = lista.map(e => `<label><input type="checkbox" data-p="${pid}" data-agregar="${e.id}">${esc(e.nombre)}</label>`).join('') || '<span class="suave pequeno">Sin resultados</span>';
}

function lugares(p, v) {
  const lista = v?.length ? v : [{ nombre: 'Mi gimnasio', tipo: 'gimnasio_completo', equipamiento: [], principal: true }];
  return lista.map((l, i) => `<div class="tarjeta">
    <label class="pequeno">Nombre <input type="text" data-p="${p.id}" data-lugar="${i}" data-c="nombre" value="${esc(l.nombre)}"></label>
    <label class="pequeno">Tipo <select data-p="${p.id}" data-lugar="${i}" data-c="tipo">${p.tipo_lugar.map(([t, n]) => `<option value="${t}"${l.tipo === t ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <p class="pequeno suave">Equipamiento</p>
    <div class="chips">${p.equipamiento.map(([eq, n]) => `<label><input type="checkbox" data-p="${p.id}" data-lugar="${i}" data-eq value="${eq}"${chk(l.equipamiento.includes(eq))}>${esc(n)}</label>`).join('')}</div>
    ${p.por_lugar.filter(f => l.equipamiento.includes(f.mostrar_si_equipo)).map(f => f.tipo === 'una'
      ? `<label class="pequeno">${esc(f.texto)} <select data-p="${p.id}" data-lugar="${i}" data-c="${f.id}" data-num>${f.opciones.map(([o, t]) => `<option value="${o}"${String(l[f.id]) === o ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`
      : `<label class="pequeno">${esc(f.texto)} <input type="number" data-p="${p.id}" data-lugar="${i}" data-c="${f.id}" data-num value="${esc(l[f.id])}"></label>`).join('')}
  </div>`).join('') + `<button type="button" class="boton" data-otro-lugar="${p.id}">Agregar otro lugar</button>`;
}

// ── Lectura de cambios ──────────────────────────────────────────────────────
function alCambiar(ev, estructural) {
  const el = ev.target;
  const pid = el.dataset.p;
  if (!pid) return;
  const r = R();
  const valor = el.dataset.bool !== undefined ? el.value === 'true' : el.dataset.num !== undefined ? (el.value === '' ? null : Number(el.value)) : el.value;
  let reestructura = false;
  if (el.dataset.consent !== undefined) { r[pid] = el.checked; reestructura = true; }
  else if (el.dataset.varias !== undefined) { const s = new Set(r[pid] || []); el.checked ? s.add(el.value) : s.delete(el.value); r[pid] = [...s]; reestructura = true; }
  else if (el.dataset.dias !== undefined) {
    if (el.dataset.uno !== undefined) r[pid] = Number(el.value);
    else { const s = new Set(r[pid] || []); el.checked ? s.add(Number(el.value)) : s.delete(Number(el.value)); r[pid] = [...s]; }
  } else if (el.dataset.fila) { r[pid] = { ...(r[pid] || {}), [el.dataset.fila]: valor }; }
  else if (el.dataset.zona !== undefined) {
    const p = C.secciones.flatMap(s => s.preguntas).find(q => q.id === pid);
    if (Array.isArray(p.por_zona)) {
      const lista = (r[pid] || []).filter(x => x.region !== el.value);
      r[pid] = el.checked ? [...lista, { region: el.value, activa: true }] : lista;
    } else { const s = new Set(r[pid] || []); el.checked ? s.add(el.value) : s.delete(el.value); r[pid] = [...s]; }
    reestructura = true;
  } else if (el.dataset.zonaCampo) {
    r[pid] = (r[pid] || []).map(x => (x.region === el.dataset.region ? { ...x, [el.dataset.zonaCampo]: valor } : x));
  } else if (el.dataset.agregar) {
    const p = C.secciones.flatMap(s => s.preguntas).find(q => q.id === pid);
    const lista = r[pid] || [];
    if (Array.isArray(p.campos)) { if (!lista.some(x => x.ejercicio_id === el.dataset.agregar)) r[pid] = [...lista, { ejercicio_id: el.dataset.agregar }]; }
    else if (!lista.includes(el.dataset.agregar)) r[pid] = [...lista, el.dataset.agregar];
    reestructura = true;
  } else if (el.dataset.quitar) {
    r[pid] = (r[pid] || []).filter(x => (x.ejercicio_id || x) !== el.dataset.quitar);
    reestructura = true;
  } else if (el.dataset.ej) {
    r[pid] = (r[pid] || []).map(x => (x.ejercicio_id === el.dataset.ej ? { ...x, [el.dataset.c]: valor } : x));
  } else if (el.dataset.lugar !== undefined) {
    const i = Number(el.dataset.lugar);
    const lista = r[pid]?.length ? r[pid] : [{ nombre: 'Mi gimnasio', tipo: 'gimnasio_completo', equipamiento: [], principal: true }];
    const l = { ...lista[i] };
    if (el.dataset.eq !== undefined) { const s = new Set(l.equipamiento); el.checked ? s.add(el.value) : s.delete(el.value); l.equipamiento = [...s]; reestructura = true; }
    else l[el.dataset.c] = valor;
    r[pid] = lista.map((x, j) => (j === i ? l : x));
  } else {
    r[pid] = valor;
    reestructura = el.type === 'radio';
  }
  guardar();
  if (estructural && reestructura) pintarSeccion(true);
}

function pintarSeccion(mantenerScroll = false) {
  const y = window.scrollY;
  const secs = seccionesVisibles();
  E.seccion = Math.min(E.seccion, secs.length - 1);
  const s = secs[E.seccion];
  const ps = preguntasVisibles(s);
  $('app').innerHTML = `
    <div class="progreso" aria-hidden="true"><i style="width:${Math.round(((E.seccion + 1) / secs.length) * 100)}%"></i></div>
    <p class="suave pequeno">Paso ${E.seccion + 1} de ${secs.length}</p>
    <h1>${esc(s.titulo)}</h1>
    ${s.intro ? `<div class="aviso ${s.sensible ? 'ojo' : ''}">${esc(s.intro)}</div>` : ''}
    <form id="seccion" novalidate>
      ${ps.map(p => `<div class="pregunta" id="q-${p.id}">
        ${p.tipo === 'consentimiento' ? '' : `<div class="enunciado${p.requerida ? ' requerida' : ''}">${esc(p.texto)}</div>`}
        ${p.ayuda ? `<p class="ayuda">${esc(p.ayuda)}</p>` : ''}
        ${campo(p)}
        ${p.por_que ? `<details class="extra"><summary>¿Por qué preguntamos esto?</summary><p class="por-que">${esc(p.por_que)}</p></details>` : ''}
        <div class="error" id="err-${p.id}"></div>
      </div>`).join('')}
      <div class="fila-botones">
        ${E.seccion > 0 ? '<button type="button" class="boton" id="atras">Atrás</button>' : ''}
        <button type="submit" class="boton primario">${E.seccion === secs.length - 1 ? 'Armar mi plan' : 'Siguiente'}</button>
      </div>
    </form>`;
  const f = document.getElementById('seccion');
  f.addEventListener('input', e => { if (e.target.dataset.buscar) resultadosBusqueda(e.target.dataset.buscar, e.target.value); else if (['text', 'number', 'date', 'textarea'].includes(e.target.type) || e.target.tagName === 'TEXTAREA') alCambiar(e, false); });
  f.addEventListener('change', e => { if (!e.target.dataset.buscar) alCambiar(e, true); });
  f.addEventListener('click', e => {
    const b = e.target.closest('[data-otro-lugar]');
    if (!b) return;
    const pid = b.dataset.otroLugar;
    const lista = R()[pid]?.length ? R()[pid] : [{ nombre: 'Mi gimnasio', tipo: 'gimnasio_completo', equipamiento: [], principal: true }];
    R()[pid] = [...lista, { nombre: `Lugar ${lista.length + 1}`, tipo: 'gimnasio_basico', equipamiento: [] }];
    guardar(); pintarSeccion(true);
  });
  document.getElementById('atras')?.addEventListener('click', () => { E.seccion--; guardar(); pintarSeccion(); window.scrollTo(0, 0); });
  f.addEventListener('submit', e => {
    e.preventDefault();
    if (!validarSeccion(ps)) return;
    if (E.seccion < secs.length - 1) { E.seccion++; guardar(); pintarSeccion(); window.scrollTo(0, 0); }
    else armarPlan();
  });
  if (mantenerScroll) window.scrollTo(0, y);
}

function validarSeccion(ps) {
  let ok = true;
  for (const p of ps) {
    const v = R()[p.id];
    let msg = '';
    const vacio = v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && p.filas && Object.keys(v).length < p.filas.length);
    if (p.requerida && p.tipo === 'consentimiento' && v !== true) msg = 'Necesitamos que aceptes esto para seguir.';
    else if (p.requerida && vacio && p.tipo !== 'lugares') msg = 'Falta esta respuesta.';
    if (p.id === 'fecha_nacimiento' && v) {
      const anios = derivar({ fecha_nacimiento: v }, C, hoy()).edad;
      if (anios < 18) msg = p.valida.mensaje_si_no;
    }
    if (p.id === 'dias_firmes' && v > (R().dias_meta || 7)) msg = 'No pueden ser más que los días que quieres entrenar.';
    document.getElementById(`err-${p.id}`).textContent = msg;
    if (msg && ok) document.getElementById(`q-${p.id}`).scrollIntoView({ block: 'center' });
    if (msg) ok = false;
  }
  return ok;
}


// ── Plan y cuenta ───────────────────────────────────────────────────────────
async function armarPlan() {
  const r = R();
  if (!r.lugares?.length) r.lugares = [{ nombre: 'Mi gimnasio', tipo: 'gimnasio_completo', equipamiento: [], principal: true }];
  r.lugares = r.lugares.map((l, i) => ({ ...l, principal: i === 0 }));
  E.semana = 1; E.mensaje = null;
  if (nube.conectado()) {
    try {
      await nube.guardarCuestionario(r);
      const res = await nube.generarPlan();
      E.plan = await nube.cargarPlan();
      E.mensaje = res.notas?.length ? res.notas.join(' ') : null;
      guardar();
      return ir('hoy');
    } catch (e) {
      if (e.status === 409) { E.plan = { bloqueado: true, mensaje: e.datos?.mensaje }; guardar(); return ir('hoy'); }
      E.mensaje = `El servidor no respondió (${e.message}); armé el plan en este teléfono.`;
    }
  }
  E.plan = generarPlan({ derivados: derivar(r, C, hoy()), respuestas: r, indice, hoy: hoy(), historial: historialReciente() }); // parte con los pesos ya anotados
  guardar();
  ir('hoy');
}

/** Al entrar: si la cuenta ya tiene plan, se usa ese; si no, se sube lo de este teléfono. */
async function sincronizarAlEntrar() {
  const respuestas = await nube.cargarRespuestas();
  const plan = await nube.cargarPlan();
  if (respuestas && plan) { E.respuestas = respuestas; E.plan = plan; }
  else if (Object.keys(R()).length) await armarPlan();
  try { E.suplementos = await nube.subirLocal({ bienestar: E.bienestar, suplementos: E.suplementos, tomas: E.tomas, consentimientos: E.consentimientos }); }
  catch (e) { console.warn('No se pudo subir lo anotado en este teléfono', e); }
  // Sesiones e indicaciones anotadas sin cuenta: a la cola, que las sube con su id (sin duplicar).
  for (const s of E.sesiones.filter(x => !x.enCuenta)) {
    s.id ||= crypto.randomUUID();
    const { id, enCuenta, ...datos } = s;
    dejarPendiente('sesion', id, datos);
  }
  for (const i of E.indicaciones.filter(x => !x.enCuenta)) { i.id ||= crypto.randomUUID(); dejarPendiente('indicacion', i.id, i); }
  try { for (const i of await nube.cargarIndicaciones()) if (!E.indicaciones.some(x => x.id === i.id)) E.indicaciones.push(i); }
  catch (e) { console.warn('No se pudieron traer las indicaciones de la cuenta', e); }
  guardar();
  await subirPendientes({ forzar: true });
}

function vistaBloqueada() {
  $('app').innerHTML = `<h1>Antes de armar tu plan</h1><div class="aviso alerta">${esc(E.plan.mensaje)}</div>
    <div class="fila-botones"><button type="button" class="boton primario" id="autorizado">${esc(C.reglas.alerta_medica[0].confirmacion)}</button><button type="button" class="boton" id="volver">Revisar respuestas</button></div>`;
  $('autorizado').onclick = () => { R().autorizacion_medica = true; armarPlan(); };
  $('volver').onclick = () => ir('cuestionario');
}

function vistaInicio() {
  $('app').innerHTML = `<div id="vista-inicio">
    <h1>Tu entrenador con IA</h1>
    <p>Arma tu plan, lo agenda en tu semana, lo ajusta cuando faltas, cuando una máquina está ocupada o cuando dormiste mal, y te explica por qué de cada ejercicio, con evidencia.</p>
    ${E.mensaje ? `<div class="aviso bien">${esc(E.mensaje)}</div>` : ''}
    ${nube.hay() && !nube.conectado() ? `<section class="tarjeta"><h3>Entrar con tu correo</h3><p class="pequeno">Tu plan y tus registros quedan guardados y el coach puede usar IA.</p><button type="button" class="boton primario" id="a-cuenta">Entrar</button></section>` : ''}
    ${nube.conectado() ? `<p class="pequeno suave">Entraste como ${esc(nube.correo())}.</p>` : ''}
    <div class="fila-botones">
      <button type="button" class="boton ${nube.conectado() ? 'primario' : ''}" id="empezar">${Object.keys(R()).length ? 'Seguir con el cuestionario' : 'Empezar el cuestionario'}</button>
      <button type="button" class="boton" id="ejemplo">Ver un ejemplo</button>
    </div>
    <p class="pequeno">¿Cambiaste de teléfono? <button type="button" class="enlace" id="a-respaldo">Restaurar un respaldo</button></p>
    <p class="suave pequeno" style="margin-top:24px">${esc(C.intro)}</p>
  </div>`;
  $('a-respaldo').onclick = () => ir('mas');
  $('a-cuenta')?.addEventListener('click', () => ir('mas'));
  $('empezar').onclick = () => ir('cuestionario');
  $('ejemplo').onclick = () => { E.respuestas = structuredClone(EJEMPLO); armarPlan(); };
}

// ── Navegación ──────────────────────────────────────────────────────────────
const VISTAS_CON_PLAN = ['hoy', 'semana', 'coach', 'progreso', 'checkin'];
function ir(vista, extra) {
  if (VISTAS_CON_PLAN.includes(vista) && (!E.plan)) vista = 'inicio';
  if (VISTAS_CON_PLAN.includes(vista) && E.plan?.bloqueado) { vistaBloqueada(); return; }
  E.vista = vista; guardar();
  $('nav').hidden = !E.plan || E.plan.bloqueado;
  document.querySelectorAll('#nav [data-ir]').forEach(b => b.setAttribute('aria-current', String(b.dataset.ir === (vista === 'checkin' ? 'semana' : vista))));
  $('modo').textContent = nube.conectado() ? (nube.correo() || 'Cuenta') : 'Sin cuenta';
  const vistas = {
    inicio: vistaInicio, cuestionario: () => pintarSeccion(), hoy: () => vistaHoy(ir), semana: () => vistaSemana(ir),
    coach: () => vistaCoach(ir, extra), checkin: () => vistaCheckin(ir, extra), progreso: () => vistaProgreso(ir), mas: () => vistaMas(ir, { armarPlan, sincronizarAlEntrar }),
  };
  (vistas[vista] || vistaInicio)();
  E.mensaje = null; guardar(); // los avisos se muestran una vez
  window.scrollTo(0, 0);
  programarAvisos(); // recordatorios de hoy con lo último (sesión hecha, suplemento tomado)
}
$('nav').addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) ir(b.dataset.ir); });

// Respuestas de ejemplo: una persona inventada, intermedia, con molestia de codo y prioridad en glúteo.
const EJEMPLO = {
  apodo: 'Ejemplo', fecha_nacimiento: '1995-05-05', sexo: 'femenino', objetivo_principal: 'recomposicion', prioridad_recomposicion: 'grasa',
  musculos_prioridad: ['gluteo'], tiempo_entrenando: '6_24m', constancia: '3_4',
  tecnica: { sentadilla: 'mas_o_menos', bisagra: 'mas_o_menos', press_horizontal: 'domino', remo: 'domino', press_vertical: 'mas_o_menos', dominada: 'no' },
  estilo_prescripcion: 'exacto', rotacion: 'algunos', dias_meta: 4, dias_firmes: 3, dias_no_puedo: [5], duracion_min: '60', estructura: 'fija',
  lugares: [{ nombre: 'Gimnasio', tipo: 'gimnasio_completo', principal: true, incremento_minimo_kg: 2.5, mancuerna_max_kg: 30,
    equipamiento: ['barra_rack', 'smith', 'banco', 'mancuernas', 'poleas', 'prensa', 'extension_cuadriceps', 'curl_femoral', 'hip_thrust_maquina', 'abductora', 'kickback_maquina', 'maquinas', 'jalon', 'bandas', 'escaladora'] }],
  consentimiento_salud: true, tamizaje: { corazon: false, dolor_pecho: false, mareo: false, cronica: false, medicamentos: false, osteoarticular: false, supervision: false },
  embarazo: 'no', lesiones: [{ region: 'codo', tipo: 'molestia', lado: 'izquierdo', intensidad: 2, activa: true }],
  favoritos: ['hip_thrust_barra', 'prensa'], sueno_horas: '6_7', turnos: false, estres: 3, llegas_cansado: 3,
  cardio_actual: ['escaladora'], cardio_para: 'condicion', registro: 'app', dia_checkin: 0, unidad: 'kg',
  terminos: true, privacidad: true, ia_transferencia: true,
};

// Versión de prueba en el celular: guarda la app para que abra sin señal en el gimnasio.
if (CONFIG.sinSenal && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('Sin modo sin señal', e));

await nube.iniciar();
subirPendientes(); // lo que quedó sin subir la última vez
if (nube.entroPorEnlace()) { await sincronizarAlEntrar(); E.mensaje = `Entraste como ${nube.correo()}.`; E.vista = E.plan ? 'hoy' : 'inicio'; }
ir(['cuestionario', 'hoy', 'semana', 'coach', 'progreso', 'mas', 'checkin'].includes(E.vista) ? E.vista : (E.plan ? 'hoy' : 'inicio'));
