// Vista Semana: el plan por semanas, mover o faltar a un día, y agendar según el calendario de Google (.ics).
import { E, guardar, R, esc, $, fechaCorta, presc, cambiarPlan, hoy, indice, mostrarMensaje, sesionVista, mostrarSemana } from './comun.js';
import { moverSesion, intercambiar, marcarFaltada, reagendarConCalendario, sesionDe, nombreDia } from '../nucleo/agenda.js';
import { leerIcs } from '../nucleo/ics.js';
import { duracionEstimada } from '../nucleo/motor-plan.js';
import { avisoCheckin } from './checkin.js';
import { tarjetaTemporada, tarjetaDescarga, enlazarTemporada } from './temporada.js';
import { semanaDe } from '../nucleo/ciclos.js';
import * as nube from './nube.js';

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Si ese día ya se entrenó (sesión guardada o series marcadas). */
const entrenado = f => E.sesiones.some(s => s.fecha === f && !s.origen) || Object.values(E.registro[f] || {}).some(l => (l || []).some(x => x?.hecho));

export function vistaSemana(ir) {
  const p = E.plan;
  if (!p || p.bloqueado) return ir('inicio');
  const f = hoy();
  const semanas = [...new Set(p.dias.map(d => d.semana))].filter(Boolean).sort((a, b) => a - b);
  if (!sesionVista.semanaElegida) E.semana = semanaDe(p, f) || E.semana; // al entrar, la semana en curso
  if (!semanas.includes(E.semana)) E.semana = semanas[0];
  const dias = p.dias.filter(x => x.semana === E.semana);
  const diasSemana = [...new Set(p.dias.filter(x => x.semana === semanas[0]).map(x => new Date(x.fecha + 'T12:00:00Z').getUTCDay()))];
  // La nota "elige un peso" se repite en cada ejercicio: en el plan se dice una vez, arriba.
  const eligePeso = dias.some(x => x.ejercicios.some(e => /^Elige un peso/.test(e.nota || '')));
  $('app').innerHTML = `<div id="vista-semana">
    <h1>Tu plan</h1>
    <p class="resumen-plan">${p.semanas} semanas · ${diasSemana.length} días: ${esc(diasSemana.map(d => DIAS_CORTOS[d]).join(', '))}</p>
    <button type="button" class="enlace" id="ver-plan">Ver tu plan explicado&nbsp;›</button>
    ${tarjetaDescarga()}
    ${avisoCheckin(true)}
    ${tarjetaTemporada()}
    <div class="semanas" role="group" aria-label="Semana"><span class="pequeno suave">Semana</span>${semanas.map(s => `<button type="button" data-semana="${s}" aria-pressed="${s === E.semana}"${s === p.semana_descarga ? ' aria-label="Semana ' + s + ', de descarga"' : ''}>${s}${s === p.semana_descarga ? ' · descarga' : ''}</button>`).join('')}</div>
    ${eligePeso ? '<p class="pequeno suave">Donde no hay peso indicado, elige uno con el que te sobren las repeticiones de reserva (RIR) en la última serie. Lo anotas en Hoy y la app lo ajusta desde ahí.</p>' : ''}
    ${dias.map(x => `<section class="tarjeta dia${x.fecha === f ? ' es-hoy' : ''}" id="dia-${x.fecha}">
      <h3>${esc(fechaCorta(x.fecha))}${x.hora ? ` · ${esc(x.hora)}` : ''} · ${esc(x.foco)} ${x.fecha === f ? '<span class="chip hoy">Hoy</span>' : ''}${entrenado(x.fecha) ? '<span class="chip firme">Hecha ✓</span>' : `<span class="chip ${x.firme ? 'firme' : ''}">${x.firme ? 'Firme' : 'Opcional'}</span>`} <span class="chip num">~${duracionEstimada(x.ejercicios)} min</span></h3>
      <ul class="ejercicios">${x.ejercicios.map(e => `<li><span class="nombre">${esc(e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || '')}</span><span class="presc">${esc(presc(e))}</span>${e.nota && !/^Elige un peso/.test(e.nota) ? `<span class="detalle">${esc(e.nota)}</span>` : ''}</li>`).join('')}</ul>
      <details class="extra"><summary>Mover, intercambiar o marcar que faltaste</summary>
        <div class="panel">
          <label class="pequeno">Mover a <input type="date" data-mover="${x.fecha}" value="${x.fecha}"></label>
          <div class="fila-botones"><button type="button" class="boton" data-aplicar-mover="${x.fecha}">Mover</button><button type="button" class="boton" data-falte="${x.fecha}">Falté este día</button></div>
        </div>
      </details>
    </section>`).join('')}
    <section class="tarjeta">
      <h3>Agendar con mi calendario</h3>
      <p class="pequeno suave">En Google Calendar: Configuración → tu calendario → "Dirección secreta en formato iCal", o Exportar. Descarga el archivo .ics y súbelo aquí. Se lee en este teléfono; no se guarda ni se envía.</p>
      <input type="file" id="ics" accept=".ics,text/calendar">
      <div class="dos-col"><label class="pequeno">Puedo desde <input type="time" id="ventana-ini" value="${esc(E.ventana?.[0] || '06:30')}"></label><label class="pequeno">hasta <input type="time" id="ventana-fin" value="${esc(E.ventana?.[1] || '21:30')}"></label></div>
      <label class="pequeno">Prefiero entrenar a las <input type="time" id="hora-preferida" value="${esc(E.horaPreferida || '19:00')}"></label>
      <div id="ics-resultado"></div>
    </section>
  </div>`;
  const raiz = $('vista-semana');
  enlazarTemporada(() => vistaSemana(ir));
  $('ver-plan').onclick = () => ir('plan');
  raiz.querySelectorAll('[data-ir-checkin]').forEach(b => b.onclick = () => ir('checkin', b.dataset.irCheckin));
  raiz.querySelectorAll('[data-semana]').forEach(b => b.onclick = () => { mostrarSemana(Number(b.dataset.semana)); guardar(); vistaSemana(ir); });
  raiz.querySelectorAll('[data-aplicar-mover]').forEach(b => b.onclick = async () => {
    const de = b.dataset.aplicarMover, a = raiz.querySelector(`[data-mover="${de}"]`).value;
    if (!a || a === de) return;
    const r = sesionDe(E.plan, a) ? intercambiar(E.plan, de, a) : moverSesion(E.plan, de, a, { noPuedo: R().dias_no_puedo || [] });
    if (!r.ok) { E.mensaje = r.error; guardar(); return vistaSemana(ir); }
    await cambiarPlan(r.plan, `Listo: ${nombreDia(de)} ${Number(de.slice(8))} → ${nombreDia(a)} ${Number(a.slice(8))}.${r.avisos.length ? ' Ojo: ' + r.avisos.join(' ') : ''}`, nube);
    vistaSemana(ir);
  });
  raiz.querySelectorAll('[data-falte]').forEach(b => b.onclick = async () => {
    const r = marcarFaltada(E.plan, b.dataset.falte, { hoy: hoy(), noPuedo: R().dias_no_puedo || [] });
    if (!r.ok) { E.mensaje = r.error; guardar(); return vistaSemana(ir); }
    await cambiarPlan(r.plan, `Semana reacomodada.${r.cambios.map(c => ` ${c.foco}: ${nombreDia(c.de)} → ${nombreDia(c.a)}.`).join('')}${r.avisos.length ? ' ' + r.avisos.join(' ') : ''}`, nube);
    vistaSemana(ir);
  });
  $('ics').onchange = async ev => {
    const archivo = ev.target.files[0];
    if (!archivo) return;
    E.ventana = [$('ventana-ini').value, $('ventana-fin').value];
    E.horaPreferida = $('hora-preferida').value;
    guardar();
    const desde = hoy() > E.plan.inicio ? hoy() : E.plan.inicio;
    const hasta = E.plan.dias.at(-1).fecha;
    const eventos = leerIcs(await archivo.text(), { desde, hasta });
    const r = reagendarConCalendario(E.plan, eventos, { desde, hasta, noPuedo: R().dias_no_puedo || [], ventana: E.ventana, minutos: 90, preferida: E.horaPreferida });
    const caja = $('ics-resultado');
    caja.innerHTML = `<p class="pequeno">Leí ${eventos.length} eventos entre ${esc(fechaCorta(desde))} y ${esc(fechaCorta(hasta))}.</p>
      ${r.cambios.length ? `<p><strong>Propuesta:</strong></p><ul class="pequeno">${r.cambios.map(c => `<li>${esc(c.foco)}: ${esc(fechaCorta(c.de))} → ${esc(fechaCorta(c.a))} a las ${esc(c.hora)}</li>`).join('')}</ul>` : '<p class="pequeno">Tus sesiones caben en sus días; solo les puse hora.</p>'}
      ${r.avisos.length ? `<div class="aviso ojo">${esc(r.avisos.join(' '))}</div>` : ''}
      <button type="button" class="boton primario" id="aplicar-ics">Aplicar al plan</button>`;
    $('aplicar-ics').onclick = async () => { await cambiarPlan(r.plan, 'Plan agendado según tu calendario.', nube); vistaSemana(ir); };
  };
  mostrarMensaje();
}
