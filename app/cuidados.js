// Cuidados del plan, en Mi plan: los suplementos que la persona decide tomar, la indicación de su médico o
// kinesiólogo (que el plan respeta) y lo que anotó para el entrenador. Antes estaban en Progreso.
import { E, guardar, C, esc, $, fechaCorta, hoy, indice, cambiarPlan } from './comun.js';
import { constancia } from '../nucleo/suplementos.js';
import { aplicarIndicacion } from '../nucleo/cuidado.js';
import { resumenParaEntrenador } from '../nucleo/notas.js';
import { reconocer } from '../nucleo/importar-plan.js';
import { guardarArchivoLocal } from './fotos-local.js';
import { subirACuenta } from './cola.js';
import * as nube from './nube.js';

const DIAS = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];

export function suplementosHtml() {
  const cons = E.suplementos.length ? constancia(E.suplementos, E.tomas, hoy()) : null;
  return `<section class="tarjeta">
    <h3>Suplementos</h3>
    <p class="pequeno suave">La app no recomienda suplementos: te recuerda los que tú decides tomar. Para que te avise a su hora, activa los recordatorios en <button type="button" class="enlace" data-ir-mas>Perfil, Ajustes</button>.</p>
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
  </section>`;
}

export function indicacionesHtml() {
  return `<section class="tarjeta">
    <h3>Indicación de tu médico o kinesiólogo</h3>
    <p class="pequeno suave">Si un profesional te dio restricciones o ejercicios, anótalos: el plan los respeta y van primero.</p>
    ${E.indicaciones.map(i => `<div class="aviso ojo">${esc(i.profesional || 'Profesional')}${i.fecha ? `, ${esc(fechaCorta(i.fecha))}` : ''}: evitar ${esc((i.restricciones?.zonas || []).join(', ') || 'nada en especial')}; ${esc((i.ejercicios || []).map(e => `${e.nombre} ${e.series}×${e.reps || e.segundos + ' s'} ${e.por_semana}/sem`).join('; ') || 'sin ejercicios')}${nube.conectado() ? `<span class="pequeno"> · ${i.enCuenta ? 'en tu cuenta' : 'esperando subir'}${i.archivo ? ` · <button type="button" class="enlace" data-ver-archivo="${esc(i.archivo)}">Ver el documento</button>` : ''}</span>` : ''}</div>`).join('')}
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
  </section>`;
}

export function notasEntrenadorHtml() {
  const notas = Object.entries(E.notas).flatMap(([fecha, porEj]) => Object.entries(porEj).map(([id, n]) => {
    const { nota, para_entrenador, ...respuestas } = n;
    return { fecha, ejercicio_id: id, respuestas, nota, para_entrenador };
  }));
  const resumen = resumenParaEntrenador(notas, indice);
  return `<section class="tarjeta">
    <h3>Lo que anotaste para el entrenador</h3>
    ${resumen.length ? `<ul class="lista-simple">${resumen.map(x => `<li><span><strong>${esc(x.ejercicio)}</strong> (${esc(fechaCorta(x.fecha))})${x.marcas.length ? `: ${esc(x.marcas.join(', '))}` : ''}${x.nota ? `. Nota: "${esc(x.nota)}"` : ''}</span>${x.para_entrenador ? '<span class="chip firme">Para el entrenador</span>' : ''}</li>`).join('')}</ul>` : '<p class="pequeno suave">En cada ejercicio de Hoy hay un desplegable para contar cómo te fue.</p>'}
  </section>`;
}

/** Formularios y botones de las tres tarjetas. `repintar` vuelve a dibujar la pantalla que las muestra. */
export function enlazarCuidados(repintar, ir) {
  document.querySelector('[data-ir-mas]')?.addEventListener('click', () => ir('mas', { panel: 'recordatorios' }));
  $('form-sup').onsubmit = async ev => {
    ev.preventDefault();
    const s = { id: crypto.randomUUID(), nombre: $('sup-nombre').value.trim(), dosis: $('sup-dosis').value.trim(), horas: $('sup-hora').value ? [$('sup-hora').value] : [], dias: [...document.querySelectorAll('.sup-dia:checked')].map(i => Number(i.value)), activo: true };
    if (!s.nombre) return;
    if (nube.conectado()) { try { s.id = await nube.guardarSuplemento(s); } catch { /* queda local */ } }
    E.suplementos.push(s); guardar(); repintar();
  };
  document.querySelectorAll('[data-borrar-sup]').forEach(b => b.onclick = () => {
    E.suplementos = E.suplementos.filter(s => s.id !== b.dataset.borrarSup);
    if (nube.conectado()) nube.borrarSuplemento(b.dataset.borrarSup).catch(() => {});
    guardar(); repintar();
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
      await subirACuenta('indicacion', ind.id, ind); // cómo le fue lo cuenta la campanita (app/campana.js)
    }
    repintar();
  };
  document.querySelectorAll('[data-ver-archivo]').forEach(b => b.onclick = async () => {
    try { window.open(await nube.verArchivoIndicacion(b.dataset.verArchivo), '_blank', 'noopener'); }
    catch (e) { E.mensaje = `No se pudo abrir el documento: ${e.message}`; guardar(); repintar(); }
  });
}
