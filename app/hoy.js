// Vista Hoy: check-in de bienestar, suplementos y la sesión del día con su registro, el "¿Por qué?" de cada
// ejercicio y el desplegable de cómo te fue con nota para el entrenador.
import { E, guardar, R, D, C, K, EVIDENCIA, indice, hoy, ahora, esc, $, fechaCorta, presc, escala, opcionesRadio, chk, cambiarPlan, ctxNucleo, numero, coma, mostrarMensaje, avisar } from './comun.js';
import { evaluarDia, ajustarSesion, TEXTO_RECOMENDACION } from '../nucleo/bienestar.js';
import { checklist } from '../nucleo/suplementos.js';
import { explicarEjercicio } from '../nucleo/explicar.js';
import { sesionDe } from '../nucleo/agenda.js';
import { duracionEstimada, incrementoPara } from '../nucleo/motor-plan.js';
import { ESFUERZO, prioridadEsfuerzo, consejoSerie } from '../nucleo/series.js';
import { avisoCheckin } from './checkin.js';
import { avisoDescargaCorto } from './temporada.js';
import { subirACuenta } from './cola.js';
import { iniciarDescanso, detenerDescanso } from './descanso.js';
import * as nube from './nube.js';

const app = () => $('app');

export function vistaHoy(ir) {
  const f = hoy();
  const plan = E.plan;
  if (!plan || plan.bloqueado) return ir('inicio');
  const dia = sesionDe(plan, f);
  const b = E.bienestar[f];
  const sups = checklist(E.suplementos, E.tomas, f, ahora());
  const proxima = plan.dias.find(d => d.fecha > f);
  app().innerHTML = `<div id="vista-hoy">
    <h1>Hoy <span class="suave pequeno">${esc(fechaCorta(f))}</span></h1>
    ${D().mensaje_alerta ? `<div class="aviso ojo">${esc(D().mensaje_alerta)}</div>` : ''}
    ${avisoCheckin()}
    ${avisoDescargaCorto()}
    ${b ? `<div class="tarjeta fila-resumen"><span>Cómo estás: <strong class="num">${b.puntaje}</strong>/100 · ${esc(TEXTO_RECOMENDACION[b.recomendacion])}</span><button type="button" class="enlace" id="rehacer-bienestar">Cambiar</button></div>`
      : E.bienestarSaltado === f ? '<div class="tarjeta fila-resumen"><span class="suave">¿Cómo estás hoy?</span><button type="button" class="enlace" id="responder-bienestar">Responder</button></div>'
        : formularioBienestar()}
    ${sups.length ? `<section class="tarjeta"><h3>Suplementos</h3><ul class="lista-check">${sups.map((s, i) => `<li class="${s.estado}"><button type="button" class="check" data-toma="${s.suplemento_id}" ${s.estado === 'tomada' ? 'disabled aria-pressed="true"' : 'aria-pressed="false"'} aria-label="Marcar ${esc(s.nombre)} como tomado">${s.estado === 'tomada' ? '✓' : ''}</button><span>${esc(s.nombre)}${s.dosis ? ` · ${esc(s.dosis)}` : ''}</span><span class="suave pequeno">${s.hora || ''}${s.estado === 'atrasada' ? ' · atrasado' : ''}</span></li>`).join('')}</ul></section>` : ''}
    ${dia ? sesionHoy(dia) : `<section class="tarjeta"><h3>Hoy descansas</h3>${proxima ? `<p class="suave">La próxima es ${esc(proxima.foco)}, el ${esc(fechaCorta(proxima.fecha))}.</p>` : ''}<button type="button" class="boton" id="entrenar-igual">Quiero entrenar hoy igual</button></section>`}
  </div>`;
  enlazar(ir, dia);
  mostrarMensaje();
}

function formularioBienestar() {
  const fila = (etiqueta, campo) => `<div class="fila-b"><span class="pequeno">${etiqueta}</span><div>${campo}</div></div>`;
  return `<form class="tarjeta" id="bienestar">
    <div class="cab-tarjeta"><h3>¿Cómo estás hoy?</h3><button type="button" class="enlace pequeno" id="saltar-bienestar">Hoy no</button></div>
    <p class="suave pequeno">20 segundos. Ajusta la sesión de hoy y, con el tiempo, cuándo toca descargar.</p>
    <div class="bienestar">
      ${fila('Dormí', '<label class="horas"><input type="text" id="b-sueno" inputmode="decimal" autocomplete="off" placeholder="7" aria-label="Horas de sueño"> horas</label>')}
      ${fila('Sueño', escala('b-calidad', 1, 5, null, ['Muy malo', 'Muy bueno']))}
      ${fila('Cansancio', escala('b-cansancio', 1, 5, null, ['Fresco', 'Agotado']))}
      ${fila('Ánimo', escala('b-animo', 1, 5, null, ['Bajo', 'Muy bueno']))}
      ${fila('¿Enfermo?', opcionesRadio('b-enfermo', [['no', 'No'], ['resfrio', 'Resfrío leve'], ['fiebre_o_cuerpo', 'Fiebre o cuerpo cortado']], 'no'))}
    </div>
    <div class="fila-botones"><button type="submit" class="boton primario">Listo</button></div>
  </form>`;
}

/** Series hechas y totales de la sesión, para el avance. */
function avance(dia) {
  const reg = E.registro[dia.fecha] || {};
  const total = dia.ejercicios.reduce((a, e) => a + e.series, 0);
  const hechas = dia.ejercicios.reduce((a, e, k) => a + (reg[e.ejercicio_id || `i${k}`] || []).slice(0, e.series).filter(x => x?.hecho).length, 0);
  return { hechas, total };
}
const avanceHtml = ({ hechas, total }) => `<div class="avance" id="avance" aria-live="polite"><span class="pequeno"><strong class="num">${hechas}</strong> de ${total} series${hechas && hechas === total ? ' · ¡completa!' : ''}</span><div class="medidor" aria-hidden="true"><i style="width:${total ? Math.round((hechas / total) * 100) : 0}%"></i></div></div>`;

function sesionHoy(dia) {
  const f = dia.fecha;
  const reg = E.registro[f] || {};
  const notas = E.notas[f] || {};
  return `<section class="tarjeta dia">
    <h3>${esc(dia.foco)} ${dia.hora ? `<span class="chip">${esc(dia.hora)}</span>` : ''} <span class="chip num">~${duracionEstimada(dia.ejercicios)} min</span></h3>
    ${dia.ejercicios.length ? avanceHtml(avance(dia)) : ''}
    <p class="suave pequeno">${esc(dia.racional || '')}</p>
    ${dia.ejercicios.length ? '' : '<p>Hoy, descanso activo: 20 a 30 minutos de caminata o bicicleta suave y movilidad.</p>'}
    <ol class="ejercicios-hoy">${dia.ejercicios.map((e, k) => ejercicioHoy(e, k, reg[e.ejercicio_id || `i${k}`] || [], notas[e.ejercicio_id || `i${k}`] || {})).join('')}</ol>
    ${dia.cardio ? `<p class="pequeno"><strong>Cardio:</strong> ${esc(dia.cardio)}</p>` : ''}
    <details class="extra"><summary>Calentamiento</summary><ul class="pequeno">${(dia.calentamiento || []).map(c => `<li><strong>${esc(c.name)}</strong>. ${esc(c.how)}</li>`).join('')}</ul></details>
    <div class="fila-botones">
      <button type="button" class="boton" id="problema">Tengo un problema con la sesión</button>
      <button type="button" class="boton primario" id="terminar">${E.sesiones.some(s => s.fecha === f) ? 'Guardar de nuevo' : 'Terminar sesión'}</button>
    </div>
  </section>`;
}

function ejercicioHoy(e, k, reg, nota) {
  const id = e.ejercicio_id || `i${k}`;
  const ej = indice.porId.get(e.ejercicio_id);
  const filas = Array.from({ length: e.series }, (_, i) => {
    const r = reg[i] || {};
    return `<div class="serie${r.hecho ? ' hecha' : ''}${r.rpe != null || r.fallo ? ' con-esfuerzo' : ''}${e.unidad === 'seg' ? ' seg' : ''}"><span class="suave pequeno">${i + 1}</span>
      ${e.unidad === 'seg' ? '' : `<input type="text" inputmode="decimal" autocomplete="off" data-ej="${id}" data-i="${i}" data-c="kg" value="${esc(coma(r.kg ?? e.carga_kg ?? ''))}" placeholder="kg" aria-label="Kilos serie ${i + 1}">`}
      <input type="text" inputmode="numeric" autocomplete="off" data-ej="${id}" data-i="${i}" data-c="reps" value="${esc(r.reps ?? '')}" placeholder="${e.unidad === 'seg' ? 'seg' : `${e.reps_min}-${e.reps_max}`}" aria-label="${e.unidad === 'seg' ? 'Segundos' : 'Repeticiones'} serie ${i + 1}">
      <button type="button" class="check" data-hecho="${id}" data-i="${i}" aria-pressed="${Boolean(r.hecho)}" aria-label="Serie ${i + 1} hecha">${r.hecho ? '✓' : ''}</button>
      ${e.unidad === 'seg' ? '' : `<div class="esfuerzo"><select data-ej="${id}" data-i="${i}" data-c="rpe" aria-label="Esfuerzo serie ${i + 1}"><option value="">Esfuerzo (RPE · RIR)</option>${ESFUERZO.map(o => `<option value="${o.rpe}"${Number(r.rpe) === o.rpe ? ' selected' : ''}>${o.etiqueta}</option>`).join('')}</select>
        <label class="pequeno fallo"><input type="checkbox" data-ej="${id}" data-i="${i}" data-c="fallo"${chk(r.fallo)}> Fallo</label></div>`}
      ${r.consejo ? `<p class="consejo ${r.consejo.tipo}">${esc(r.consejo.texto)}</p>` : ''}</div>`;
  }).join('');
  const preguntas = K.por_ejercicio.preguntas.filter(p => !p.mostrar_si || Object.entries(p.mostrar_si).every(([q, vals]) => vals.includes(nota[q])));
  return `<li class="ej" id="ej-${id}">
    <div class="ej-cab"><span class="nombre">${esc(e.nombre || ej?.nombre || id)}</span><span class="presc">${esc(presc(e))}</span></div>
    ${e.nota ? `<p class="pequeno suave">${esc(e.nota)}</p>` : ''}
    <div class="series">${filas}</div>
    <div class="acciones-ej">
      ${ej ? `<button type="button" class="enlace" data-porque="${id}" aria-expanded="false">¿Por qué?</button>${e.unidad !== 'seg' ? `<button type="button" class="enlace" data-prioriza="${id}" aria-expanded="false">Qué priorizar</button>` : ''}<a class="enlace" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${ej.nombre} técnica correcta`)}" target="_blank" rel="noopener">Video</a>` : '<span class="chip">Indicado por tu profesional</span>'}
    </div>
    ${ej && e.unidad !== 'seg' ? `<p class="prioriza pequeno" id="prioriza-${id}" hidden>${esc(prioridadEsfuerzo(e, ej, D(), (R().lesiones || []).filter(l => l.activa !== false).map(l => l.region)).texto)}</p>` : ''}
    <div id="porque-${id}"></div>
    <details class="extra"${Object.keys(nota).length ? ' open' : ''}><summary>Cómo te fue · nota para el entrenador</summary>
      <div class="preguntas-ej">
        ${preguntas.map(p => `<div><span class="pequeno">${esc(p.texto)}</span>${p.tipo === 'escala'
          ? escala(`n-${id}-${p.id}`, p.min, p.max, nota[p.id], p.extremos, `data-nota="${id}" data-p="${p.id}" data-num`)
          : opcionesRadio(`n-${id}-${p.id}`, p.zonas ? [] : p.opciones, nota[p.id], `data-nota="${id}" data-p="${p.id}"`)}${p.zonas ? `<select data-nota="${id}" data-p="${p.id}"><option value="">—</option>${C.zonas[p.zonas].map(([z, t]) => `<option value="${z}"${nota[p.id] === z ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}</div>`).join('')}
        <label class="pequeno">${esc(K.por_ejercicio.nota_entrenador.texto)}<textarea data-nota="${id}" data-p="nota" placeholder="${esc(K.por_ejercicio.nota_entrenador.ayuda)}">${esc(nota.nota || '')}</textarea></label>
        <label class="pequeno"><input type="checkbox" data-nota="${id}" data-p="para_entrenador"${chk(nota.para_entrenador)}> Que la vea mi entrenador</label>
      </div>
    </details>
  </li>`;
}

function enlazar(ir, dia) {
  const f = hoy();
  $('rehacer-bienestar')?.addEventListener('click', () => { delete E.bienestar[f]; guardar(); vistaHoy(ir); });
  $('saltar-bienestar')?.addEventListener('click', () => { E.bienestarSaltado = f; guardar(); vistaHoy(ir); });
  $('responder-bienestar')?.addEventListener('click', () => { E.bienestarSaltado = null; guardar(); vistaHoy(ir); });
  $('bienestar')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const val = n => document.querySelector(`input[name="${n}"]:checked`)?.value;
    const datos = {
      sueno_horas: numero($('b-sueno').value), sueno_calidad: Number(val('b-calidad')) || null,
      cansancio: Number(val('b-cansancio')) || null, animo: Number(val('b-animo')) || null, enfermo: val('b-enfermo') || 'no',
    };
    const r = evaluarDia(datos);
    E.bienestar[f] = { ...datos, puntaje: r.puntaje, recomendacion: r.recomendacion, motivos: r.motivos };
    guardar();
    if (nube.conectado()) nube.guardarBienestar(f, { ...datos, puntaje: r.puntaje, recomendacion: r.recomendacion }).catch(() => {});
    if (dia && r.recomendacion !== 'normal') {
      E.mensaje = null;
      vistaHoy(ir);
      const caja = document.createElement('div');
      caja.className = 'aviso ojo';
      caja.innerHTML = `${esc(r.motivos.length ? `Por lo que contaste (${r.motivos.join(', ')}): ` : '')}${esc(TEXTO_RECOMENDACION[r.recomendacion])}<div class="fila-botones"><button type="button" class="boton primario" id="aplicar-bienestar">Ajustar la sesión</button><button type="button" class="boton" id="normal-igual">Hacerla normal igual</button></div>`;
      $('vista-hoy').querySelector('h1').after(caja);
      $('aplicar-bienestar').onclick = async () => {
        const nuevo = structuredClone(E.plan);
        sesionDe(nuevo, f).ejercicios = ajustarSesion(sesionDe(nuevo, f).ejercicios, r.recomendacion).map((e, i) => ({ ...e, orden: i }));
        await cambiarPlan(nuevo, `Sesión de hoy ajustada: ${TEXTO_RECOMENDACION[r.recomendacion]}`, nube);
        vistaHoy(ir);
      };
      $('normal-igual').onclick = () => caja.remove();
    } else vistaHoy(ir);
  });
  document.querySelectorAll('[data-toma]').forEach(b => b.onclick = () => {
    E.tomas.push({ suplemento_id: b.dataset.toma, fecha: f, hora: ahora().slice(11) });
    guardar();
    if (nube.conectado()) nube.registrarToma(b.dataset.toma, f, ahora().slice(11)).catch(() => {});
    vistaHoy(ir);
  });
  document.querySelectorAll('[data-ir-checkin]').forEach(b => b.onclick = () => ir('checkin', b.dataset.irCheckin));
  document.querySelectorAll('[data-ir-semana]').forEach(b => b.onclick = () => ir('semana'));
  $('entrenar-igual')?.addEventListener('click', () => ir('coach', 'Hoy no tenía sesión pero quiero entrenar, ¿qué otra opción tienes?'));
  $('problema')?.addEventListener('click', () => ir('coach'));
  if (!dia) return;

  // Registro de series
  const reg = (E.registro[f] ||= {});
  const raiz = $('vista-hoy');
  raiz.addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset.ej && t.dataset.c) {
      const lista = (reg[t.dataset.ej] ||= []);
      lista[t.dataset.i] = { ...(lista[t.dataset.i] || {}), [t.dataset.c]: numero(t.value) };
      guardar();
    } else if (t.dataset.nota && t.tagName === 'TEXTAREA') guardarNota(t.dataset.nota, 'nota', t.value);
  });
  document.querySelectorAll('[data-hecho]').forEach(b => b.onclick = () => {
    const lista = (reg[b.dataset.hecho] ||= []);
    const fila = b.closest('.serie');
    const r = { ...(lista[b.dataset.i] || {}) };
    // Si no escribió nada, se anota lo de la serie anterior o, si no hay, lo indicado por el plan.
    const e = dia.ejercicios.find((x, k) => (x.ejercicio_id || `i${k}`) === b.dataset.hecho);
    const anterior = lista[Number(b.dataset.i) - 1];
    if (r.kg == null && e?.unidad !== 'seg') r.kg = anterior?.kg ?? e?.carga_kg ?? null;
    if (r.reps == null) r.reps = e?.reps_max ?? null;
    r.hecho = !r.hecho;
    lista[b.dataset.i] = r;
    guardar();
    fila.classList.toggle('hecha', r.hecho);
    b.setAttribute('aria-pressed', String(r.hecho));
    b.textContent = r.hecho ? '✓' : '';
    fila.querySelector('[data-c="kg"]') && (fila.querySelector('[data-c="kg"]').value = coma(r.kg));
    fila.querySelector('[data-c="reps"]').value = r.reps ?? '';
    if (r.hecho) actualizarConsejo(b.dataset.hecho, Number(b.dataset.i));
    else { delete r.consejo; fila.querySelector('.consejo')?.remove(); guardar(); }
    const a = avance(dia);
    $('avance').outerHTML = avanceHtml(a);
    // Descanso hasta la serie siguiente; con la última serie de la sesión, el aviso para guardarla.
    if (r.hecho && a.hechas === a.total) { detenerDescanso(); avisar('¡Sesión completa! Toca "Terminar sesión" para guardarla.'); }
    else if (r.hecho) {
      const quedan = e.series - (lista.slice(0, e.series).filter(x => x?.hecho).length);
      iniciarDescanso(e.descanso_seg || 90, quedan ? `Descanso · falta${quedan === 1 ? '' : 'n'} ${quedan} serie${quedan === 1 ? '' : 's'}` : 'Descanso · sigue otro ejercicio');
    } else detenerDescanso();
  });
  // Consejo para la serie siguiente (nucleo/series.js), según reps, esfuerzo y fallo.
  function actualizarConsejo(id, i) {
    const e = dia.ejercicios.find((x, k) => (x.ejercicio_id || `i${k}`) === id);
    const ej = indice.porId.get(e?.ejercicio_id);
    const lugar = (R().lugares || [])[0];
    const r = reg[id][i];
    r.consejo = consejoSerie(e, r, ej ? incrementoPara(ej, lugar) : null);
    guardar();
    const filaEl = document.querySelectorAll(`#ej-${id} .serie`)[i];
    filaEl.querySelector('.consejo')?.remove();
    if (r.consejo) filaEl.insertAdjacentHTML('beforeend', `<p class="consejo ${r.consejo.tipo}">${esc(r.consejo.texto)}</p>`);
  }
  raiz.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.ej && (t.dataset.c === 'rpe' || t.dataset.c === 'fallo')) {
      const lista = (reg[t.dataset.ej] ||= []);
      const fila = { ...(lista[t.dataset.i] || {}) };
      if (t.dataset.c === 'rpe') {
        fila.rpe = t.value === '' ? null : Number(t.value);
        fila.fallo = fila.rpe === 10;
        const caja = t.closest('.serie').querySelector('[data-c="fallo"]');
        if (caja) caja.checked = fila.fallo;
      }
      else {
        fila.fallo = t.checked;
        if (t.checked) fila.rpe = 10;
        const sel = t.closest('.serie').querySelector('select[data-c="rpe"]');
        if (sel && t.checked) sel.value = '10';
      }
      lista[t.dataset.i] = fila; guardar();
      if (fila.hecho) actualizarConsejo(t.dataset.ej, Number(t.dataset.i));
      return;
    }
    if (!t.dataset.nota || t.tagName === 'TEXTAREA') return;
    const v = t.type === 'checkbox' ? t.checked : t.dataset.num !== undefined ? Number(t.value) : t.value;
    guardarNota(t.dataset.nota, t.dataset.p, v);
    if (t.dataset.p === 'molestia') vistaHoyMantener(ir, t.dataset.nota);
  });
  function guardarNota(id, p, v) { ((E.notas[f] ||= {})[id] ||= {})[p] = v; guardar(); }

  // Qué priorizar si no salen las repeticiones o la reserva.
  document.querySelectorAll('[data-prioriza]').forEach(b => b.onclick = () => {
    const p = $(`prioriza-${b.dataset.prioriza}`);
    p.hidden = !p.hidden;
    b.setAttribute('aria-expanded', String(!p.hidden));
  });

  // ¿Por qué?
  document.querySelectorAll('[data-porque]').forEach(b => b.onclick = () => {
    const caja = $(`porque-${b.dataset.porque}`);
    b.setAttribute('aria-expanded', String(!caja.innerHTML));
    if (caja.innerHTML) { caja.innerHTML = ''; return; }
    const e = dia.ejercicios.find(x => x.ejercicio_id === b.dataset.porque);
    const ex = explicarEjercicio({ e, dia, plan: E.plan, respuestas: R(), indice, evidencia: EVIDENCIA });
    caja.innerHTML = `<div class="panel porque">
      ${ex.motivos.map(m => `<div><strong>${esc(m.pregunta)}</strong><p>${esc(m.respuesta)}</p>${m.fuente ? `<p class="pequeno suave">Fuente: ${esc(m.fuente.documento)} → ${esc(m.fuente.seccion)}${m.refs.length ? ` [${m.refs.join(', ')}]` : ''}</p>` : ''}</div>`).join('')}
      ${ex.referencias.length ? `<details class="extra"><summary>Papers que lo respaldan (${ex.referencias.length})</summary><ol class="refs">${ex.referencias.map(r => `<li value="${r.n}">${esc(r.texto)} <span class="chip ${r.verificada ? 'verificada' : ''}">${r.verificada ? 'verificada' : 'por verificar'}</span></li>`).join('')}</ol></details>` : ''}
      <a class="enlace" href="${esc(ex.video)}" target="_blank" rel="noopener">Ver videos de técnica</a>
    </div>`;
  });

  // Terminar sesión: queda en el historial local y, con cuenta, en el servidor.
  $('terminar').onclick = async () => {
    const series = [], notas = [];
    let orden = 0;
    dia.ejercicios.forEach((e, k) => {
      const id = e.ejercicio_id || `i${k}`;
      for (const r of (reg[id] || []).filter(x => x?.hecho)) {
        series.push({ orden: orden++, ejercicio_id: e.ejercicio_id, ejercicio_nombre: e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || id, tipo: r.fallo ? 'fallo' : 'efectiva',
          carga_kg: e.unidad === 'seg' ? null : r.kg ?? null, reps: e.unidad === 'seg' ? null : r.reps ?? null, duracion_seg: e.unidad === 'seg' ? r.reps ?? null : null,
          rpe: r.rpe ?? null, rir: r.rpe != null ? 10 - r.rpe : null });
      }
      const n = (E.notas[f] || {})[id];
      if (n && Object.keys(n).length) {
        const { nota, para_entrenador, ...respuestas } = n;
        notas.push({ fecha: f, ejercicio_id: e.ejercicio_id, respuestas, nota: nota || null, para_entrenador: Boolean(para_entrenador) });
      }
    });
    if (!series.length) { E.mensaje = 'Marca al menos una serie como hecha.'; guardar(); return vistaHoy(ir); }
    // El id es del teléfono y se mantiene al guardar de nuevo: así la cuenta la reemplaza en vez de duplicarla.
    const id = E.sesiones.find(s => s.fecha === f)?.id || crypto.randomUUID();
    E.sesiones = E.sesiones.filter(s => s.fecha !== f);
    E.sesiones.push({ id, fecha: f, titulo: dia.foco, series, notas });
    E.mensaje = `Sesión guardada: ${series.length} serie${series.length === 1 ? '' : 's'}.`;
    detenerDescanso();
    guardar();
    if (nube.conectado()) {
      const subio = await subirACuenta('sesion', id, { fecha: f, titulo: dia.foco, series, notas });
      E.mensaje += subio ? ' También quedó en tu cuenta.' : ' Todavía no se pudo subir a tu cuenta: queda en este teléfono y se sube sola cuando vuelva la señal.';
      guardar();
    }
    vistaHoy(ir);
  };
}

function vistaHoyMantener(ir, id) {
  const y = window.scrollY;
  vistaHoy(ir);
  window.scrollTo(0, y);
  $(`ej-${id}`)?.querySelector('details')?.setAttribute('open', '');
}
