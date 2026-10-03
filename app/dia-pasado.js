// Anotar un día pasado o corregir una sesión ya guardada, como en Hevy. Se entra desde Progreso → Historial. El
// borrador queda guardado mientras se escribe (E.borradorPasado), así no se pierde si se cambia de pantalla. Para
// hoy se usa Hoy: aquí solo se anotan días anteriores.
import { E, D, guardar, esc, $, indice, hoy, fechaCorta, coma, enUnidad, aKilos, unidadPeso, avisar, numero } from './comun.js';
import { prescripcion } from '../nucleo/motor-plan.js';
import { sesionDe, sumarDias } from '../nucleo/agenda.js';
import { buscarEjercicios } from '../nucleo/editar-sesion.js';
import { borradorNuevo, borradorDeSesion, nuevaSerie, problemaBorrador, sesionDelBorrador } from '../nucleo/dia-pasado.js';
import { subirACuenta } from './cola.js';
import { miniatura } from './imagenes.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';

const RIR = [0, 1, 2, 3, 4, 5];
const TIPO = { efectiva: '', calentamiento: 'C', fallo: 'F', drop: 'D' };
const SIGUIENTE_TIPO = { efectiva: 'calentamiento', calentamiento: 'fallo', fallo: 'efectiva', drop: 'efectiva' };
let buscar = '';

export function vistaDiaPasado(ir, { id = null } = {}) {
  const ayer = sumarDias(hoy(), -1);
  // Corregir: si el borrador guardado es de otra sesión, se parte de la sesión pedida.
  if (id && E.borradorPasado?.id !== id) {
    const s = E.sesiones.find(x => x.id === id);
    if (!s) return ir('progreso');
    E.borradorPasado = borradorDeSesion(s, indice);
  }
  if (!id && (!E.borradorPasado || E.borradorPasado.id)) E.borradorPasado = borradorNuevo(ayer, E.plan && sesionDe(E.plan, ayer));
  const b = E.borradorPasado;
  guardar();
  const corrigiendo = Boolean(b.id);
  const u = unidadPeso();
  const planDia = E.plan && sesionDe(E.plan, b.fecha);
  const n = x => coma(enUnidad(x));

  const tarjeta = (e, k) => {
    const seg = e.unidad === 'seg';
    const p = e.plan;
    const pista = p ? `Plan: ${p.series} × ${p.reps_min}${p.reps_max !== p.reps_min ? ` a ${p.reps_max}` : ''}${seg ? ' s' : ''}${p.carga_kg ? ` · ${n(p.carga_kg)} ${u}` : ''}` : '';
    return `<section class="tarjeta ej-pasado">
      <div class="cab-pasado">${e.ejercicio_id ? miniatura(e.ejercicio_id) : '<span class="miniatura vacia"></span>'}<div><strong>${esc(e.nombre)}</strong>${pista ? `<span class="pequeno suave">${esc(pista)}</span>` : ''}</div>
        <button type="button" class="boton-icono" data-quitar-ej="${k}" aria-label="Quitar ${esc(e.nombre)}">${icono('cerrar')}</button></div>
      <div class="filas-pasado${seg ? ' seg' : ''}">
        <span class="cab">Serie</span>${seg ? '' : `<span class="cab">${u}</span>`}<span class="cab">${seg ? 'Seg' : 'Reps'}</span>${seg ? '' : '<span class="cab">RIR</span>'}<span></span>
        ${e.series.map((s, i) => `<button type="button" class="tipo-serie tipo-${s.tipo === 'efectiva' ? 'normal' : s.tipo}" data-tipo="${k}.${i}" aria-label="Serie ${i + 1}, tocar para cambiar el tipo">${TIPO[s.tipo] || i + 1}</button>
          ${seg ? '' : `<input type="text" inputmode="decimal" autocomplete="off" data-c="kg" data-k="${k}" data-i="${i}" value="${esc(n(s.kg))}" placeholder="${esc(n(p?.carga_kg))}" aria-label="${u === 'lb' ? 'Libras' : 'Kilos'}, serie ${i + 1}">`}
          <input type="text" inputmode="numeric" autocomplete="off" data-c="reps" data-k="${k}" data-i="${i}" value="${esc(s.reps ?? '')}" placeholder="${esc(seg ? p?.reps_min ?? '' : p?.reps_max ?? '')}" aria-label="${seg ? 'Segundos' : 'Repeticiones'}, serie ${i + 1}">
          ${seg ? '' : `<select data-c="rir" data-k="${k}" data-i="${i}" aria-label="RIR, serie ${i + 1}"><option value="">·</option>${RIR.map(r => `<option value="${r}"${s.rir === r ? ' selected' : ''}>${r}</option>`).join('')}</select>`}
          <button type="button" class="boton-icono" data-quitar-serie="${k}.${i}" aria-label="Quitar la serie ${i + 1}">${icono('cerrar', 'icono icono-chico')}</button>`).join('')}
      </div>
      <button type="button" class="boton agregar-serie" data-mas-serie="${k}">+ Serie</button>
    </section>`;
  };

  $('app').innerHTML = `<div id="vista-pasado">
    <button type="button" class="volver" id="volver">${icono('flecha', 'icono flecha-atras')} Progreso</button>
    <h1>${corrigiendo ? 'Corregir la sesión' : 'Anotar un día pasado'}</h1>
    <p class="pequeno suave">${corrigiendo ? 'Cambia lo que haga falta y guarda: reemplaza la sesión anterior, también en tu cuenta.' : 'Para la sesión que no alcanzaste a anotar. Para hoy, usa Hoy.'}</p>
    <section class="tarjeta campos-pasado">
      <label class="pequeno">Fecha <input type="date" id="p-fecha" max="${ayer}" value="${esc(b.fecha)}"></label>
      <label class="pequeno">Nombre de la sesión <input type="text" id="p-titulo" value="${esc(b.titulo)}" maxlength="60"></label>
      <label class="pequeno">Minutos (opcional) <input type="text" inputmode="numeric" id="p-minutos" value="${esc(b.duracion_min ?? '')}" placeholder="60"></label>
      ${planDia?.ejercicios?.length && !b.ejercicios.length ? `<button type="button" class="boton" id="usar-plan">Usar la sesión del plan de ese día: ${esc(planDia.foco)}</button>` : ''}
    </section>
    ${b.ejercicios.map(tarjeta).join('')}
    <section class="tarjeta">
      <h3>Agregar ejercicio</h3>
      <input type="search" id="p-buscar" placeholder="Buscar por nombre, músculo o equipo" value="${esc(buscar)}" autocomplete="off" aria-label="Buscar ejercicio">
      <ul class="lista-ejercicios" id="p-resultados"></ul>
    </section>
    <section class="tarjeta"><label class="pequeno">Comentario (opcional)<textarea id="p-comentario" rows="2" maxlength="500">${esc(b.comentario || '')}</textarea></label></section>
    <div class="fila-botones"><button type="button" class="boton primario grande" id="p-guardar">${corrigiendo ? 'Guardar los cambios' : 'Guardar sesión'}</button></div>
    <div class="fila-botones"><button type="button" class="enlace" id="p-descartar">${corrigiendo ? 'Descartar los cambios' : 'Descartar este borrador'}</button></div>
  </div>`;

  const repintar = () => { const y = scrollY; vistaDiaPasado(ir, { id: b.id || null }); scrollTo(0, y); };
  const serie = el => { const [k, i] = el.split('.').map(Number); return b.ejercicios[k]?.series[i]; };
  $('volver').onclick = () => ir('progreso');
  $('p-titulo').oninput = ev => { b.titulo = ev.target.value; guardar(); };
  $('p-minutos').oninput = ev => { b.duracion_min = numero(ev.target.value); guardar(); };
  $('p-comentario').oninput = ev => { b.comentario = ev.target.value; guardar(); };
  $('p-fecha').onchange = ev => {
    const f = ev.target.value;
    if (!f || f > ayer) { avisar('Elige un día anterior a hoy. Para hoy, usa Hoy.'); ev.target.value = b.fecha; return; }
    b.fecha = f;
    // Si ese día ya hay una sesión anotada en la app y el borrador está vacío, se abre esa para corregirla.
    const otra = E.sesiones.find(s => s.fecha === f && !s.origen && s.id !== b.id);
    if (otra && !b.ejercicios.some(e => e.series.some(s => s.reps != null))) { E.borradorPasado = borradorDeSesion(otra, indice); guardar(); avisar('Ese día ya tenía una sesión anotada: la abrí para corregirla.'); return vistaDiaPasado(ir, { id: otra.id }); }
    const p = E.plan && sesionDe(E.plan, f);
    if (!corrigiendo && p && !b.ejercicios.length) b.titulo = p.foco;
    guardar(); repintar();
  };
  $('usar-plan')?.addEventListener('click', () => { const nuevo = borradorNuevo(b.fecha, planDia); Object.assign(b, { ejercicios: nuevo.ejercicios, titulo: b.titulo === 'Sesión' ? nuevo.titulo : b.titulo }); guardar(); repintar(); });
  const raiz = $('vista-pasado');
  raiz.addEventListener('input', ev => {
    const t = ev.target;
    if (!t.dataset.c || t.tagName === 'SELECT') return;
    const s = b.ejercicios[Number(t.dataset.k)]?.series[Number(t.dataset.i)];
    if (!s) return;
    const v = numero(t.value);
    s[t.dataset.c] = t.dataset.c === 'kg' ? aKilos(v) : v == null ? null : Math.round(v);
    guardar();
  });
  raiz.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.c !== 'rir') return;
    const s = b.ejercicios[Number(t.dataset.k)]?.series[Number(t.dataset.i)];
    if (s) { s.rir = t.value === '' ? null : Number(t.value); guardar(); }
  });
  raiz.querySelectorAll('[data-tipo]').forEach(x => x.onclick = () => { const s = serie(x.dataset.tipo); s.tipo = SIGUIENTE_TIPO[s.tipo] || 'efectiva'; guardar(); repintar(); });
  raiz.querySelectorAll('[data-quitar-serie]').forEach(x => x.onclick = () => { const [k, i] = x.dataset.quitarSerie.split('.').map(Number); b.ejercicios[k].series.splice(i, 1); if (!b.ejercicios[k].series.length) b.ejercicios.splice(k, 1); guardar(); repintar(); });
  raiz.querySelectorAll('[data-quitar-ej]').forEach(x => x.onclick = () => { b.ejercicios.splice(Number(x.dataset.quitarEj), 1); guardar(); repintar(); });
  raiz.querySelectorAll('[data-mas-serie]').forEach(x => x.onclick = () => {
    const e = b.ejercicios[Number(x.dataset.masSerie)], ultima = e.series.at(-1);
    e.series.push({ ...nuevaSerie(), kg: ultima?.kg ?? null }); guardar(); repintar();
  });
  // Buscador: los ejercicios del banco, sin los que ya están.
  const resultados = () => {
    const ya = new Set(b.ejercicios.map(e => e.ejercicio_id));
    const xs = buscar.trim() ? buscarEjercicios(indice, { texto: buscar }).filter(e => !ya.has(e.id)).slice(0, 8) : [];
    $('p-resultados').innerHTML = xs.map(e => `<li><button type="button" class="fila-ejercicio" data-agregar-ej="${e.id}">${miniatura(e.id)}<span><span class="nombre">${esc(e.nombre)}</span></span>${icono('mas', 'icono chevron')}</button></li>`).join('');
    $('p-resultados').querySelectorAll('[data-agregar-ej]').forEach(x => x.onclick = () => {
      const ej = indice.porId.get(x.dataset.agregarEj);
      const seg = ej.tipo === 'cardio' || ej.tipo === 'movilidad' || prescripcion(ej, 2, D()).unidad === 'seg';
      b.ejercicios.push({ ejercicio_id: ej.id, nombre: ej.nombre, unidad: seg ? 'seg' : 'reps', series: [nuevaSerie(), nuevaSerie(), nuevaSerie()] });
      buscar = ''; guardar(); repintar();
    });
  };
  $('p-buscar').oninput = ev => { buscar = ev.target.value; resultados(); };
  resultados();
  $('p-descartar').onclick = () => { E.borradorPasado = null; buscar = ''; guardar(); ir('progreso'); };
  $('p-guardar').onclick = async () => {
    const problema = problemaBorrador(b, hoy());
    if (problema) return avisar(problema);
    const otra = E.sesiones.find(s => s.fecha === b.fecha && !s.origen && s.id !== b.id);
    if (otra) return avisar(`El ${fechaCorta(b.fecha)} ya tiene una sesión anotada: ábrela desde el historial para corregirla.`);
    const ses = sesionDelBorrador(b, crypto.randomUUID());
    E.sesiones = [...E.sesiones.filter(s => s.id !== ses.id), ses];
    E.borradorPasado = null; buscar = '';
    E.mensaje = corrigiendo ? 'Sesión corregida.' : `Sesión del ${fechaCorta(ses.fecha)} anotada: ${ses.series.length} serie${ses.series.length === 1 ? '' : 's'}.`;
    guardar();
    if (nube.conectado()) {
      const { id: idSesion, ...datos } = ses;
      const subio = await subirACuenta('sesion', idSesion, datos);
      E.mensaje += subio ? ' También quedó en tu cuenta.' : ' Todavía no se pudo subir a tu cuenta: se sube sola cuando vuelva la señal.';
      guardar();
    }
    ir('resumen', { id: ses.id, desde: 'progreso' });
  };
}
