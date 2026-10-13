// Rutinas propias, como en Hevy: "Nueva rutina", la carpeta "Mis rutinas" en Entrenar con "Empezar rutina", el editor
// (nombre, ejercicios, series, repeticiones y descanso) y "Guardar como rutina" desde una sesión pasada. Quedan en el
// teléfono, en el respaldo y en la cuenta (E.rutinas). Empezar una rutina deja la sesión de hoy como esa rutina, después de
// confirmar; las otras fechas del plan no cambian.
import { E, esc, $, indice, guardar, avisar, ctxNucleo, cambiarPlan } from './comun.js';
import { prepararSesionVacia } from '../nucleo/sesion-vacia.js';
import { editarSesion } from '../nucleo/editar-sesion.js';
import { sesionDe } from '../nucleo/agenda.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import { miniatura } from './imagenes.js';
import { arrastrable } from './editar-sesion-ui.js';
import { datoCambiado } from './datos-nube.js';
import * as nube from './nube.js';

const DESCANSOS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const reloj = s => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'Sin descanso');
const nombreEj = id => indice.porId.get(id)?.nombre || 'Ejercicio';
let borrador = null; // la rutina que se está editando (sigue al ir y volver del banco)
let carpetaAbierta = true;

export const rutinas = () => E.rutinas || [];

/** La carpeta "Mis rutinas" de Entrenar. */
export function misRutinasHtml() {
  const xs = rutinas();
  return `<section class="carpeta-rutinas">
    <button type="button" class="carpeta-cab" id="carpeta-mias" aria-expanded="${carpetaAbierta}">${icono('flecha', `icono carpeta-flecha${carpetaAbierta ? ' abierta' : ''}`)}<span>Mis rutinas (${xs.length})</span></button>
    ${carpetaAbierta ? (xs.length ? `<ul class="rutinas">${xs.map(r => `<li class="rutina">
        <div class="rutina-cab"><h3>${esc(r.nombre)}</h3><button type="button" class="boton-icono" data-rutina-menu="${esc(r.id)}" aria-label="${esc(`Opciones de ${r.nombre}`)}">${icono('puntos')}</button></div>
        <p class="pequeno suave rutina-ejercicios">${esc(r.ejercicios.map(e => nombreEj(e.ejercicio_id)).join(', ') || 'Sin ejercicios')}</p>
        <button type="button" class="boton primario" data-rutina-empezar="${esc(r.id)}"${r.ejercicios.length ? '' : ' disabled'}>Empezar rutina</button>
      </li>`).join('')}</ul>` : `<button type="button" class="rutina-nueva-vacia" data-rutina-nueva>${icono('mas')} Agregar una rutina</button>`) : ''}
  </section>`;
}

export function enlazarRutinas(ir, repintar) {
  $('carpeta-mias')?.addEventListener('click', () => { carpetaAbierta = !carpetaAbierta; repintar(); });
  document.querySelectorAll('[data-rutina-nueva]').forEach(b => b.onclick = () => { borrador = { id: crypto.randomUUID(), nombre: '', ejercicios: [], nueva: true }; ir('rutina'); });
  document.querySelectorAll('[data-rutina-empezar]').forEach(b => b.onclick = () => empezarRutina(rutinas().find(r => r.id === b.dataset.rutinaEmpezar), b, ir));
  document.querySelectorAll('[data-rutina-menu]').forEach(b => b.onclick = () => {
    const r = rutinas().find(x => x.id === b.dataset.rutinaMenu);
    if (!r) return;
    abrirHoja({ titulo: r.nombre, volver: b, opciones: [
      { valor: 'editar', icono: icono('lapiz'), nombre: 'Editar rutina' },
      { valor: 'duplicar', icono: icono('mas'), nombre: 'Duplicar' },
      { valor: 'borrar', icono: icono('basurero'), clase: 'quitar', nombre: 'Borrar rutina', peligro: true },
    ], alElegir: v => {
      if (v === 'editar') { borrador = structuredClone(r); ir('rutina'); }
      else if (v === 'duplicar') { E.rutinas = [...rutinas(), { ...structuredClone(r), id: crypto.randomUUID(), nombre: `${r.nombre} (copia)` }]; datoCambiado('rutinas'); repintar(); }
      else if (v === 'borrar') abrirHoja({ titulo: `¿Borrar ${r.nombre}?`, volver: b, nota: 'Lo que ya registraste con ella no se borra.',
        opciones: [{ valor: 'si', icono: icono('basurero'), clase: 'quitar', nombre: 'Sí, borrar', peligro: true }, { valor: 'no', icono: icono('flecha'), nombre: 'No' }],
        alElegir: x => { if (x === 'si') { E.rutinas = rutinas().filter(y => y.id !== r.id); datoCambiado('rutinas'); repintar(); } } });
    } });
  });
}

/** Agrega ejercicios elegidos en el banco a la rutina que se edita (app/banco.js, desde 'rutina'). */
export function agregarARutina(ids) {
  if (!borrador) return;
  for (const id of ids) if (!borrador.ejercicios.some(e => e.ejercicio_id === id)) borrador.ejercicios.push({ ejercicio_id: id, series: 3, reps_min: 8, reps_max: 12, descanso_seg: 90 });
}

/** El editor de una rutina, como "Create Routine" de Hevy. */
export function vistaRutina(ir) {
  if (!borrador) borrador = { id: crypto.randomUUID(), nombre: '', ejercicios: [], nueva: true };
  const b = borrador;
  $('app').innerHTML = `<div id="vista-rutina">
    <div class="banco-cab-sesion"><button type="button" class="enlace" id="rutina-cancelar">Cancelar</button><h1>${b.nueva ? 'Nueva rutina' : 'Editar rutina'}</h1><button type="button" class="enlace rutina-guardar" id="rutina-guardar">Guardar</button></div>
    <input type="text" id="rutina-nombre" class="rutina-nombre" maxlength="60" placeholder="Nombre de la rutina" value="${esc(b.nombre)}" aria-label="Nombre de la rutina">
    ${b.ejercicios.length ? `<ol class="rutina-editor lista-orden" id="rutina-lista">${b.ejercicios.map((e, i) => `<li data-i="${i}" class="rutina-ej">
      <span class="asa-orden" aria-hidden="true">${icono('ajustes', 'icono')}</span>
      <div class="rutina-ej-cuerpo">
        <div class="rutina-ej-cab">${miniatura(e.ejercicio_id)}<strong>${esc(nombreEj(e.ejercicio_id))}</strong><button type="button" class="boton-icono" data-quitar-ej="${i}" aria-label="${esc(`Quitar ${nombreEj(e.ejercicio_id)}`)}">${icono('cerrar')}</button></div>
        <div class="rutina-ej-campos">
          <label>Series<input type="text" inputmode="numeric" data-campo="series" data-i="${i}" value="${e.series}"></label>
          <label>Reps<span><input type="text" inputmode="numeric" data-campo="reps_min" data-i="${i}" value="${e.reps_min}"> a <input type="text" inputmode="numeric" data-campo="reps_max" data-i="${i}" value="${e.reps_max}"></span></label>
          <label>Descanso<select data-campo="descanso_seg" data-i="${i}">${DESCANSOS.map(x => `<option value="${x}"${x === e.descanso_seg ? ' selected' : ''}>${reloj(x)}</option>`).join('')}</select></label>
        </div>
      </div>
    </li>`).join('')}</ol>` : '<div class="sesion-vacia-estado">' + icono('pesa') + '<h2>Comienza</h2><p class="suave">Agrega ejercicios a tu rutina</p></div>'}
    <button type="button" class="boton agregar-ejercicio fin-rutina" id="rutina-agregar">${icono('mas')} Agregar ejercicio</button>
  </div>`;
  document.body.classList.add('en-sesion');
  $('rutina-nombre').oninput = ev => { b.nombre = ev.target.value; };
  if (!b.nombre) $('rutina-nombre').focus();
  $('vista-rutina').addEventListener('input', ev => {
    const t = ev.target, i = Number(t.dataset.i);
    if (!t.dataset.campo || !b.ejercicios[i]) return;
    const v = Math.round(Number(t.value));
    if (Number.isFinite(v) && v >= 0) b.ejercicios[i][t.dataset.campo] = v;
  });
  $('vista-rutina').addEventListener('change', ev => { const t = ev.target; if (t.tagName === 'SELECT') b.ejercicios[Number(t.dataset.i)].descanso_seg = Number(t.value); });
  document.querySelectorAll('[data-quitar-ej]').forEach(x => x.onclick = () => { b.ejercicios.splice(Number(x.dataset.quitarEj), 1); vistaRutina(ir); });
  if ($('rutina-lista')) arrastrable($('rutina-lista'), indices => { b.ejercicios = indices.map(i => b.ejercicios[i]); vistaRutina(ir); });
  $('rutina-agregar').onclick = () => ir('banco', { desde: 'rutina' });
  $('rutina-cancelar').onclick = () => { borrador = null; ir('entrenar'); };
  $('rutina-guardar').onclick = () => {
    const nombre = b.nombre.trim();
    if (!nombre) { avisar('Ponle un nombre a la rutina.'); $('rutina-nombre').focus(); return; }
    if (!b.ejercicios.length) { avisar('Agrega al menos un ejercicio.'); return; }
    const malo = b.ejercicios.find(e => !(e.series >= 1 && e.series <= 10) || !(e.reps_min >= 1) || e.reps_max < e.reps_min || e.reps_max > 100);
    if (malo) { avisar(`${nombreEj(malo.ejercicio_id)}: revisa las series (1 a 10) y las repeticiones (la menor primero).`); return; }
    const { nueva, ...limpia } = b;
    limpia.nombre = nombre;
    E.rutinas = [...rutinas().filter(r => r.id !== b.id), limpia];
    borrador = null;
    datoCambiado('rutinas');
    avisar(`Rutina "${nombre}" guardada.`);
    ir('entrenar');
  };
}

/** Una rutina desde una sesión guardada: sus ejercicios con las series de trabajo y el rango de repeticiones que hiciste. */
export function guardarComoRutina(sesion, ir) {
  const porEj = new Map();
  for (const x of sesion.series || []) {
    if (!x.ejercicio_id || !indice.porId.get(x.ejercicio_id) || x.tipo === 'calentamiento') continue;
    const g = porEj.get(x.ejercicio_id) || { ejercicio_id: x.ejercicio_id, series: 0, reps: [] };
    g.series++; if (x.reps) g.reps.push(Number(x.reps));
    porEj.set(x.ejercicio_id, g);
  }
  if (!porEj.size) { avisar('Esta sesión no tiene ejercicios del banco para guardar como rutina.'); return; }
  borrador = { id: crypto.randomUUID(), nueva: true, nombre: sesion.titulo || 'Mi rutina', ejercicios: [...porEj.values()].map(g => ({
    ejercicio_id: g.ejercicio_id, series: Math.min(10, g.series), reps_min: g.reps.length ? Math.min(...g.reps) : 8, reps_max: g.reps.length ? Math.max(...g.reps) : 12, descanso_seg: 90 })) };
  ir('rutina');
}

const contexto = () => ({ ...ctxNucleo(), registro: E.registro, sesiones: E.sesiones, cardioHecho: E.cardioHecho });

/** Empezar una rutina: hoy queda como esa rutina (después de confirmar). Lo ya hecho hoy se conserva. */
function empezarRutina(r, volver, ir) {
  if (!r) return;
  const ctx = contexto(), f = ctx.hoy, hoyPlan = E.plan ? sesionDe(E.plan, f) : null;
  if (E.inicioSesion?.[f] && !E.sesiones.some(s => s.fecha === f && !s.origen)) { avisar('Hay una sesión en curso: termínala o descártala antes de empezar otra.'); return; }
  abrirHoja({
    titulo: `Empezar ${r.nombre}`, volver,
    nota: `${hoyPlan && !hoyPlan.libre ? `Hoy tocaba ${hoyPlan.foco}: queda reemplazada por esta rutina. ` : ''}Las otras fechas de tu plan no cambian. Lo que ya hiciste hoy se conserva.`,
    opciones: [{ valor: 'si', icono: icono('visto'), clase: 'confirmar', nombre: 'Empezar rutina' }, { valor: 'no', icono: icono('flecha'), nombre: 'Dejar como está' }],
    alElegir: async v => {
      if (v !== 'si') return;
      const base = prepararSesionVacia(contexto());
      if (base.error) { avisar(base.error.replace(/[–—]/g, ' a ')); return; }
      let plan = base.plan;
      const fuera = [];
      for (const e of r.ejercicios) {
        const x = editarSesion({ tipo: 'agregar', ejercicio: e.ejercicio_id, alcance: 'hoy' }, { ...contexto(), plan });
        if (x.error) { fuera.push(nombreEj(e.ejercicio_id)); continue; }
        plan = x.plan;
        const ej = sesionDe(plan, f).ejercicios.find(y => y.ejercicio_id === e.ejercicio_id);
        Object.assign(ej, { series: e.series, reps_min: e.reps_min, reps_max: e.reps_max, descanso_seg: e.descanso_seg, nota: `De tu rutina ${r.nombre}.` });
      }
      const dia = sesionDe(plan, f);
      dia.foco = r.nombre; dia.rutina = r.id; dia.racional = `Tu rutina ${r.nombre}.`;
      Object.assign((E.retirados ||= {})[f] ||= {}, base.conservar);
      for (const [id, entrada] of Object.entries(base.conservar)) {
        if (entrada.ejercicio.ejercicio_id !== id || E.registro[f]?.[id]) continue;
        ((E.registro[f] ||= {})[id]) = entrada.series.map(s => ({ hecho: true, tipo: s.tipo === 'efectiva' ? 'normal' : s.tipo, kg: s.carga_kg, reps: s.reps ?? s.distancia_m ?? s.duracion_seg, rir: s.rir, rpe: s.rpe }));
      }
      const aviso = await cambiarPlan(plan, `Hoy: ${r.nombre}.${fuera.length ? ` No agregué ${fuera.join(', ')} (no calza con tu equipo o tus restricciones).` : ''}`, nube);
      if (aviso) avisar(aviso);
      (E.inicioSesion ||= {})[f] = Date.now();
      guardar();
      ir('hoy', { sesion: true });
    },
  });
}
