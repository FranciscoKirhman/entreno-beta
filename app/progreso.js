// Vista Progreso: fotos de progreso privadas, suplementos, indicaciones de tu médico o kinesiólogo, y lo que
// anotaste para el entrenador.
import { E, guardar, C, esc, $, fechaCorta, hoy, indice, cambiarPlan, opcionesRadio, chk, mostrarMensaje, seriesTexto, volumenTexto } from './comun.js';
import { tipoParaGuardar } from '../nucleo/registro.js';
import { sesionDe, sumarDias, diaSemana } from '../nucleo/agenda.js';
import { constancia } from '../nucleo/suplementos.js';
import { aplicarIndicacion } from '../nucleo/cuidado.js';
import { resumenParaEntrenador } from '../nucleo/notas.js';
import { reconocer } from '../nucleo/importar-plan.js';
import { guardarFotoLocal, listarFotosLocales, borrarFotoLocal, guardarArchivoLocal } from './fotos-local.js';
import { subirACuenta, subirPendientes, estadoCola } from './cola.js';
import * as nube from './nube.js';

const DIAS = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const nombreEj = id => indice.porId.get(id)?.nombre || id;
let verTodo = false;

/** Sesiones para el historial: las guardadas (de la app o importadas de Hevy) y los días con series marcadas sin terminar. */
function historial() {
  const out = E.sesiones.map(s => ({ fecha: s.fecha, titulo: s.titulo, origen: s.origen,
    series: (s.series || []).map(x => ({ nombre: x.ejercicio_nombre || nombreEj(x.ejercicio_id), carga_kg: x.carga_kg, reps: x.reps ?? x.duracion_seg, tipo: x.tipo })) }));
  for (const [fecha, porEj] of Object.entries(E.registro)) {
    if (E.sesiones.some(s => s.fecha === fecha && !s.origen)) continue;
    const series = Object.entries(porEj || {}).flatMap(([id, l]) => (l || []).filter(x => x?.hecho)
      .map(x => ({ nombre: nombreEj(id), carga_kg: x.kg ?? null, reps: x.reps ?? null, tipo: tipoParaGuardar(x) })));
    if (series.length) out.push({ fecha, titulo: (E.plan && sesionDe(E.plan, fecha)?.foco) || 'Sesión', sinTerminar: true, series });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}
const deTrabajo = x => !['calentamiento', 'drop', 'descarga'].includes(x.tipo);
const volumen = series => series.filter(x => x.tipo !== 'calentamiento').reduce((a, x) => a + (Number(x.carga_kg) || 0) * (Number(x.reps) || 0), 0);

function historialHtml() {
  const h = historial();
  if (!h.length) return '<p class="pequeno suave">Todavía no hay sesiones. Marca tus series en Hoy, o importa tu historial de Hevy en Más.</p>';
  const lunes = sumarDias(hoy(), -((diaSemana(hoy()) + 6) % 7));
  const semana = h.filter(s => s.fecha >= lunes);
  const resumen = semana.length ? `Esta semana: ${semana.length} sesión${semana.length === 1 ? '' : 'es'} · ${semana.reduce((a, s) => a + s.series.filter(deTrabajo).length, 0)} series de trabajo · volumen ${volumenTexto(semana.reduce((a, s) => a + volumen(s.series), 0))}.` : 'Esta semana todavía no entrenas.';
  const item = s => {
    const porEj = [];
    for (const x of s.series) {
      let g = porEj.find(y => y.nombre === x.nombre);
      if (!g) porEj.push(g = { nombre: x.nombre, trabajo: [], calentamiento: 0 });
      if (x.tipo === 'calentamiento') g.calentamiento++; else g.trabajo.push(x);
    }
    return `<li><details><summary><span class="fecha-h">${esc(fechaCorta(s.fecha))}</span><span class="titulo-h">${esc(s.titulo || 'Sesión')}${s.origen === 'hevy' ? ' <span class="chip">Hevy</span>' : ''}${s.sinTerminar && s.fecha === hoy() ? ' <span class="chip">en curso</span>' : ''}</span><span class="cifra-h num">${s.series.filter(deTrabajo).length} series</span></summary>
      <ul class="pequeno detalle-h">${porEj.map(g => `<li><strong>${esc(g.nombre)}</strong>: ${esc(seriesTexto(g.trabajo) || '—')}${g.calentamiento ? ` <span class="suave">(+${g.calentamiento} de calentamiento)</span>` : ''}</li>`).join('')}</ul></details></li>`;
  };
  return `<p class="pequeno">${esc(resumen)}</p>
    <ul class="historial">${(verTodo ? h : h.slice(0, 6)).map(item).join('')}</ul>
    ${h.length > 6 ? `<button type="button" class="enlace" id="ver-todo">${verTodo ? 'Ver menos' : `Ver las ${h.length} sesiones`}</button>` : ''}`;
}

export async function vistaProgreso(ir) {
  const notas = Object.entries(E.notas).flatMap(([fecha, porEj]) => Object.entries(porEj).map(([id, n]) => {
    const { nota, para_entrenador, ...respuestas } = n;
    return { fecha, ejercicio_id: id, respuestas, nota, para_entrenador };
  }));
  const resumen = resumenParaEntrenador(notas, indice);
  const cons = E.suplementos.length ? constancia(E.suplementos, E.tomas, hoy()) : null;
  const cola = estadoCola();
  $('app').innerHTML = `<div id="vista-progreso">
    <h1>Progreso</h1>
    <section class="tarjeta">
      <h3>Historial</h3>
      ${historialHtml()}
      ${nube.conectado() && cola.total ? `<div class="aviso ojo" id="cola">${cola.total} cosa${cola.total === 1 ? '' : 's'} esperando subir a tu cuenta (${[cola.sesiones && `${cola.sesiones} sesión${cola.sesiones === 1 ? '' : 'es'}`, cola.indicaciones && `${cola.indicaciones} indicación${cola.indicaciones === 1 ? '' : 'es'}`].filter(Boolean).join(', ')}). Quedan guardadas en este teléfono y se suben solas cuando hay señal.${cola.detenidos ? ` Después de varios intentos se pausó${cola.error ? ` (${esc(cola.error)})` : ''}.` : ''}
        <div class="fila-botones"><button type="button" class="boton" id="reintentar">Reintentar ahora</button></div></div>` : ''}
    </section>

    <section class="tarjeta">
      <h3>Fotos de progreso</h3>
      <p class="pequeno suave">${nube.conectado() ? 'Se guardan en tu cuenta, en un espacio privado: solo tú las ves.' : 'Sin cuenta, quedan solo en este teléfono.'} Nunca se comparten ni aparecen en tablas de amigos.</p>
      ${E.consentimientos.fotos_progreso ? `
        <div class="dos-col"><label class="pequeno">Fecha <input type="date" id="foto-fecha" value="${hoy()}"></label>
        <label class="pequeno">Ángulo <select id="foto-angulo"><option value="frente">Frente</option><option value="perfil">Perfil</option><option value="espalda">Espalda</option><option value="otro">Otro</option></select></label></div>
        <input type="file" id="foto" accept="image/*" capture="environment">
        <div id="fotos" class="galeria"><p class="suave pequeno">Cargando…</p></div>`
      : `<label class="pequeno casilla"><input type="checkbox" id="consentir-fotos"> Acepto guardar fotos de mi cuerpo como datos personales sensibles, solo para ver mi progreso.</label>`}
    </section>

    <section class="tarjeta">
      <h3>Suplementos</h3>
      <p class="pequeno suave">La app no recomienda suplementos: te recuerda los que tú decides tomar. Para que te avise a su hora, activa los recordatorios en <button type="button" class="enlace" data-ir-mas>Más</button>.</p>
      ${cons ? `<p class="pequeno">Racha: <strong>${cons.racha}</strong> día(s) completos${cons.porcentaje_30_dias != null ? ` · ${Math.round(cons.porcentaje_30_dias * 100)}% de los últimos 30 días` : ''}.</p>` : ''}
      <ul class="lista-simple">${E.suplementos.map(s => `<li><span>${esc(s.nombre)}${s.dosis ? ` · ${esc(s.dosis)}` : ''} · ${s.horas?.length ? s.horas.join(', ') : 'sin hora'}${s.dias?.length ? ` · ${s.dias.map(d => DIAS.find(x => x[0] === d)[1]).join('')}` : ''}</span><button type="button" class="enlace" data-borrar-sup="${s.id}">Quitar</button></li>`).join('')}</ul>
      <details class="extra"${E.suplementos.length ? '' : ' open'}><summary>Agregar un suplemento</summary>
      <form id="form-sup" class="panel">
        <div class="dos-col"><label class="pequeno">Nombre <input type="text" id="sup-nombre" placeholder="Creatina" required></label><label class="pequeno">Dosis <input type="text" id="sup-dosis" placeholder="5 g"></label></div>
        <label class="pequeno">Hora del recordatorio <input type="time" id="sup-hora" value="09:00"></label>
        <span class="pequeno">Días (ninguno = todos)</span><div class="escala">${DIAS.map(([d, t]) => `<label><input type="checkbox" class="sup-dia" value="${d}">${t}</label>`).join('')}</div>
        <button type="submit" class="boton">Agregar</button>
      </form>
      </details>
    </section>

    <section class="tarjeta">
      <h3>Indicación de tu médico o kinesiólogo</h3>
      <p class="pequeno suave">Si un profesional te dio restricciones o ejercicios, anótalos: el plan los respeta y van primero.</p>
      ${E.indicaciones.map(i => `<div class="aviso ojo">${esc(i.profesional || 'Profesional')}${i.fecha ? `, ${esc(fechaCorta(i.fecha))}` : ''}: evitar ${esc((i.restricciones?.zonas || []).join(', ') || '—')}; ${esc((i.ejercicios || []).map(e => `${e.nombre} ${e.series}×${e.reps || e.segundos + ' s'} ${e.por_semana}/sem`).join('; ') || 'sin ejercicios')}${nube.conectado() ? `<span class="pequeno"> · ${i.enCuenta ? 'en tu cuenta' : 'esperando subir'}${i.archivo ? ` · <button type="button" class="enlace" data-ver-archivo="${esc(i.archivo)}">Ver el documento</button>` : ''}</span>` : ''}</div>`).join('')}
      <details class="extra"><summary>Agregar una indicación</summary>
      <form id="form-ind" class="panel">
        <div class="dos-col"><label class="pequeno">Profesional <input type="text" id="ind-prof" placeholder="Kinesióloga, traumatólogo…"></label><label class="pequeno">Hasta <input type="date" id="ind-hasta"></label></div>
        <span class="pequeno">Zonas que no se deben cargar</span><div class="chips">${C.zonas.articulaciones.map(([z, t]) => `<label><input type="checkbox" class="ind-zona" value="${z}">${esc(t)}</label>`).join('')}</div>
        <label class="pequeno">Ejercicios indicados, uno por línea: nombre, series × repeticiones o segundos, veces por semana
          <textarea id="ind-ej" placeholder="Rotación externa con banda 3x15 3 por semana&#10;Isométrico de cuádriceps 4x45s 2 por semana"></textarea></label>
        ${nube.conectado() ? '<label class="pequeno">Foto o PDF de la indicación (opcional, queda privado en tu cuenta) <input type="file" id="ind-archivo" accept="image/*,application/pdf"></label>' : ''}
        <button type="submit" class="boton">Incorporar al plan</button>
      </form>
      </details>
    </section>

    <section class="tarjeta">
      <h3>Lo que anotaste para el entrenador</h3>
      ${resumen.length ? `<ul class="lista-simple">${resumen.map(x => `<li><span><strong>${esc(x.ejercicio)}</strong> (${esc(fechaCorta(x.fecha))})${x.marcas.length ? `: ${esc(x.marcas.join(', '))}` : ''}${x.nota ? ` — "${esc(x.nota)}"` : ''}</span>${x.para_entrenador ? '<span class="chip firme">Para el entrenador</span>' : ''}</li>`).join('')}</ul>` : '<p class="pequeno suave">En cada ejercicio de Hoy hay un desplegable para contar cómo te fue.</p>'}
    </section>
  </div>`;

  document.querySelector('[data-ir-mas]')?.addEventListener('click', () => ir('mas'));
  $('ver-todo')?.addEventListener('click', () => { verTodo = !verTodo; const y = scrollY; vistaProgreso(ir); scrollTo(0, y); });
  $('consentir-fotos')?.addEventListener('change', ev => {
    if (!ev.target.checked) return;
    E.consentimientos.fotos_progreso = true; guardar();
    if (nube.conectado()) nube.consentir('fotos_progreso').catch(() => {});
    vistaProgreso(ir);
  });
  if (E.consentimientos.fotos_progreso) {
    pintarFotos();
    $('foto').onchange = async ev => {
      const archivo = ev.target.files[0];
      if (!archivo) return;
      const datos = { fecha: $('foto-fecha').value || hoy(), angulo: $('foto-angulo').value, archivo };
      try { nube.conectado() ? await nube.subirFoto(datos) : await guardarFotoLocal(datos); E.mensaje = 'Foto guardada.'; }
      catch (e) { E.mensaje = `No se pudo guardar la foto: ${e.message}`; }
      guardar(); vistaProgreso(ir);
    };
  }
  $('form-sup').onsubmit = async ev => {
    ev.preventDefault();
    const s = { id: crypto.randomUUID(), nombre: $('sup-nombre').value.trim(), dosis: $('sup-dosis').value.trim(), horas: $('sup-hora').value ? [$('sup-hora').value] : [], dias: [...document.querySelectorAll('.sup-dia:checked')].map(i => Number(i.value)), activo: true };
    if (!s.nombre) return;
    if (nube.conectado()) { try { s.id = await nube.guardarSuplemento(s); } catch { /* queda local */ } }
    E.suplementos.push(s); guardar(); vistaProgreso(ir);
  };
  document.querySelectorAll('[data-borrar-sup]').forEach(b => b.onclick = () => {
    E.suplementos = E.suplementos.filter(s => s.id !== b.dataset.borrarSup);
    if (nube.conectado()) nube.borrarSuplemento(b.dataset.borrarSup).catch(() => {});
    guardar(); vistaProgreso(ir);
  });
  $('form-ind').onsubmit = async ev => {
    ev.preventDefault();
    const ejercicios = $('ind-ej').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/^(.*?)\s+(\d+)\s*[x×]\s*(\d+)\s*(s|seg)?\b(?:.*?(\d+)\s*(?:por semana|\/sem|veces))?/i);
      if (!m) return { nombre: l, series: 2, reps: 10, por_semana: 3 };
      return { nombre: m[1], ejercicio_id: reconocer(m[1], indice).ejercicio?.id || null, series: Number(m[2]), [m[4] ? 'segundos' : 'reps']: Number(m[3]), por_semana: Number(m[5] || 3) };
    });
    const ind = { id: crypto.randomUUID(), profesional: $('ind-prof').value.trim() || null, fecha: hoy(), hasta: $('ind-hasta').value || null, restricciones: { zonas: [...document.querySelectorAll('.ind-zona:checked')].map(i => i.value) }, ejercicios };
    const archivo = $('ind-archivo')?.files[0];
    if (archivo) { await guardarArchivoLocal(ind.id, archivo); ind.archivoPendiente = true; } // espera en el teléfono hasta subir
    E.indicaciones.push(ind);
    const { plan, quitados } = aplicarIndicacion(E.plan, ind, indice);
    await cambiarPlan(plan, `Indicación incorporada.${quitados.length ? ` Se sacaron ${quitados.length} ejercicio(s) que cargaban lo restringido.` : ''}`, nube);
    if (nube.conectado()) {
      const subio = await subirACuenta('indicacion', ind.id, ind);
      E.mensaje = `${E.mensaje || ''} ${subio ? 'Quedó guardada en tu cuenta.' : 'Todavía no se pudo subir a tu cuenta: se sube sola cuando haya señal.'}`.trim();
      guardar();
    }
    vistaProgreso(ir);
  };
  $('reintentar')?.addEventListener('click', async ev => {
    ev.currentTarget.disabled = true;
    const r = await subirPendientes({ forzar: true });
    E.mensaje = r?.subidos.length ? `Subido a tu cuenta: ${r.subidos.length}.` : `No se pudo subir${r?.fallidos[0]?.error ? `: ${r.fallidos[0].error}` : ''}. Se vuelve a intentar sola.`;
    guardar(); vistaProgreso(ir);
  });
  document.querySelectorAll('[data-ver-archivo]').forEach(b => b.onclick = async () => {
    try { window.open(await nube.verArchivoIndicacion(b.dataset.verArchivo), '_blank', 'noopener'); }
    catch (e) { E.mensaje = `No se pudo abrir el documento: ${e.message}`; guardar(); vistaProgreso(ir); }
  });
  mostrarMensaje();
}

async function pintarFotos() {
  const caja = $('fotos');
  try {
    const fotos = nube.conectado() ? await nube.listarFotos() : await listarFotosLocales();
    if (!fotos.length) { caja.innerHTML = '<p class="suave pequeno">Todavía no hay fotos. Una por mes, con la misma luz y el mismo ángulo, sirve para comparar.</p>'; return; }
    caja.innerHTML = fotos.map(f => `<figure><img src="${esc(f.url)}" alt="Foto de progreso, ${esc(f.angulo || '')}, ${esc(fechaCorta(f.fecha))}" loading="lazy"><figcaption>${esc(fechaCorta(f.fecha))} · ${esc(f.angulo || '')} <button type="button" class="enlace" data-borrar-foto="${esc(f.id)}">Borrar</button></figcaption></figure>`).join('');
    caja.querySelectorAll('[data-borrar-foto]').forEach(b => b.onclick = async () => {
      const f = fotos.find(x => String(x.id) === b.dataset.borrarFoto);
      nube.conectado() ? await nube.borrarFoto(f) : await borrarFotoLocal(f.id);
      pintarFotos();
    });
  } catch (e) { caja.innerHTML = `<p class="pequeno">No se pudieron cargar las fotos: ${esc(e.message)}</p>`; }
}
