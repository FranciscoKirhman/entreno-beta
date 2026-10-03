// Vista Semana: el plan por semanas, mover o faltar a un día, y agendar según el calendario de Google (.ics).
import { E, guardar, R, D, esc, $, fechaCorta, presc, cambiarPlan, hoy, indice, mostrarMensaje, sesionVista, mostrarSemana } from './comun.js';
import { ordenarOpcionales } from '../nucleo/opcionales.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { NOMBRE_MUSCULO, lista } from './musculos.js';
import { moverSesion, intercambiar, marcarFaltada, reagendarConCalendario, sesionDe, nombreDia } from '../nucleo/agenda.js';
import { leerIcs } from '../nucleo/ics.js';
import { duracionSesion } from '../nucleo/motor-plan.js';
import { avisoCheckin } from './checkin.js';
import { tarjetaTemporada, tarjetaDescarga, enlazarTemporada } from './temporada.js';
import { semanaDe } from '../nucleo/ciclos.js';
import { grupos, etiquetaSuperserie } from '../nucleo/superseries.js';
import { miniatura } from './imagenes.js';
import * as nube from './nube.js';

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

import { estadoSesion, resumenSemana } from '../nucleo/estado-sesion.js';
import { estadoDelPlan } from '../nucleo/registrado.js';
const estado = f => estadoSesion(f, E.sesiones, E.registro);
const diaCorto = iso => `${DIAS_CORTOS[new Date(iso + 'T12:00:00Z').getUTCDay()]} ${Number(iso.slice(8))}`;

/** Opcionales de esta semana que quedan por hacer, de la que más conviene a la que menos, con su porqué. */
function opcionalesHtml(dias, reg, f) {
  const pendientes = dias.filter(x => !x.firme && x.fecha >= f && !['hecha', 'recuperada', 'adelantada', 'hecha_sin_registro', 'saltada', 'reemplazada'].includes(reg.porDia.get(x.fecha)?.t));
  const rango = D().series_rango;
  if (pendientes.length < 2 || !rango) return '';
  const orden = ordenarOpcionales({ dias: pendientes, series: seriesAnotadas(E.sesiones, E.registro), indice, hoy: f, rango, prioridad: R().musculos_prioridad || [] });
  const nombres = xs => lista(xs.slice(0, 3).map(m => NOMBRE_MUSCULO[m] || m));
  const porque = o => (o.bajo.length ? `trabaja ${nombres(o.bajo)}, que ${o.bajo.length === 1 ? 'va' : 'van'} bajo la franja de tu nivel en los últimos 12 días`
    : o.prioritarios.length ? `trabaja ${nombres(o.prioritarios)}, que pediste priorizar` : 'tus músculos van en la franja: elige la que te acomode');
  return `<section class="tarjeta opcionales">
    <h3>Tus opcionales de esta semana</h3>
    <p class="pequeno suave">Si alcanzas a hacer alguna, conviene en este orden.</p>
    <ol class="lista-opcionales">${orden.map((o, i) => `<li><strong>${esc(fechaCorta(o.fecha))} · ${esc(o.foco)}</strong>${i === 0 || o.bajo.length || o.prioritarios.length ? `<span class="pequeno suave">${esc(porque(o))}.</span>` : ''}</li>`).join('')}</ol>
  </section>`;
}

/** Cómo quedó un día del plan según lo registrado en la app o en Hevy (nucleo/registrado.js). */
function chipEstado(x, reg) {
  const e = reg.porDia.get(x.fecha);
  if (estado(x.fecha) === 'en_curso' && e?.t !== 'hecha') return '<span class="chip">En curso</span>';
  switch (e?.t) {
    case 'hecha': return `<span class="chip firme">Hecha ✓${e.sesion?.origen === 'hevy' ? ' en Hevy' : ''}</span>`;
    case 'recuperada': return `<span class="chip firme">Hecha el ${diaCorto(e.el)}</span>`;
    case 'adelantada': return `<span class="chip firme">Hecha antes, el ${diaCorto(e.el)}</span>`;
    case 'hecha_sin_registro': return '<span class="chip firme">Hecha, sin anotar</span>';
    case 'saltada': return '<span class="chip">Saltada</span>';
    case 'pendiente': return '<span class="chip pendiente">Pendiente</span>';
    case 'no_hecha': return '<span class="chip">No se hizo</span>';
    case 'omitida': return '<span class="chip">Opcional, no se hizo</span>';
    case 'reemplazada': return `<span class="chip">Se repite el ${diaCorto(e.por)}</span>`;
    case 'sin_datos': return '<span class="chip">Sin registro todavía</span>';
    default: return `<span class="chip ${x.firme ? 'firme' : ''}">${x.firme ? 'Firme' : 'Opcional'}</span>`;
  }
}

export function vistaSemana(ir) {
  const p = E.plan;
  if (!p || p.bloqueado) return ir('inicio');
  const f = hoy();
  const semanas = [...new Set(p.dias.map(d => d.semana))].filter(Boolean).sort((a, b) => a - b);
  if (!sesionVista.semanaElegida) E.semana = semanaDe(p, f) || E.semana; // al entrar, la semana en curso
  if (!semanas.includes(E.semana)) E.semana = semanas[0];
  const dias = p.dias.filter(x => x.semana === E.semana);
  const resumen = resumenSemana(p.dias, E.semana);
  const reg = estadoDelPlan(p, E.sesiones, { hoy: f, marcas: E.marcasPlan || {} });
  const diasSemana = resumen.dias;
  // La nota "elige un peso" se repite en cada ejercicio: en el plan se dice una vez, arriba.
  const eligePeso = dias.some(x => x.ejercicios.some(e => /^Elige un peso/.test(e.nota || '')));
  $('app').innerHTML = `<div id="vista-semana">
    <h1>Tu plan</h1>
    <p class="resumen-plan">${p.semanas} semanas · ${resumen.sesiones} sesiones en ${diasSemana.length} días: ${esc(diasSemana.map(d => DIAS_CORTOS[d]).join(', '))}</p>
    <button type="button" class="enlace" id="ver-plan">Ver tu plan explicado&nbsp;›</button>
    ${tarjetaDescarga()}
    ${avisoCheckin(true)}
    ${tarjetaTemporada()}
    ${E.semana === semanaDe(p, f) ? opcionalesHtml(dias, reg, f) : ''}
    <div class="semanas" role="group" aria-label="Semana"><span class="pequeno suave">Semana</span>${semanas.map(s => `<button type="button" data-semana="${s}" aria-pressed="${s === E.semana}"${s === p.semana_descarga ? ' aria-label="Semana ' + s + ', de descarga"' : ''}>${s}${s === p.semana_descarga ? ' · descarga' : ''}</button>`).join('')}</div>
    ${eligePeso ? '<p class="pequeno suave">Donde no hay peso indicado, elige uno con el que te sobren las repeticiones de reserva (RIR) en la última serie. Lo anotas en Hoy y la app lo ajusta desde ahí.</p>' : ''}
    ${dias.map(x => `<section class="tarjeta dia${x.fecha === f ? ' es-hoy' : ''}" id="dia-${x.fecha}">
      <h3>${esc(fechaCorta(x.fecha))}${x.hora ? ` · ${esc(x.hora)}` : ''} · ${esc(x.foco)} ${x.fecha === f ? '<span class="chip hoy">Hoy</span>' : ''}${chipEstado(x, reg)} <span class="chip num">~${duracionSesion(x)} min</span></h3>
      <ul class="ejercicios">${x.ejercicios.map((e, k, todos) => { const g = grupos(todos)[k]; return `<li class="con-mini${g ? ` en-superserie ss-${g.letra}` : ''}">${indice.porId.has(e.ejercicio_id) ? `<button type="button" class="ej-semana" data-ficha="${e.ejercicio_id}">${miniatura(e.ejercicio_id, 'miniatura chica')}` : '<span class="ej-semana"><span class="miniatura chica vacia" aria-hidden="true"></span>'}<span class="nombre">${g ? `<span class="chip-ss">${etiquetaSuperserie(g)}</span>` : ''}${esc(e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || '')}</span>${indice.porId.has(e.ejercicio_id) ? '</button>' : '</span>'}<span class="presc">${esc(presc(e))}</span>${e.nota && !/^Elige un peso/.test(e.nota) ? `<span class="detalle">${esc(e.nota)}</span>` : ''}</li>`; }).join('')}</ul>
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
  raiz.querySelectorAll('[data-ficha]').forEach(b => b.onclick = () => ir('ejercicio', { id: b.dataset.ficha, desde: 'semana' }));
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
