import { responderSalud } from '../nucleo/preguntas-seguimiento.js';
import { E, R, hoy, indice, esc, guardar, fechaCorta, peso, ctxNucleo, cambiarPlan, avisar } from './comun.js';
import { armarFeed, verTarjeta } from '../nucleo/feed.js';
import { efectoPregunta, responderPregunta } from '../nucleo/preguntas-coach.js';
import { aplicarOpcion } from '../nucleo/coach.js';
import { abrirHoja } from './hoja.js';
import { datoCambiado } from './datos-nube.js';
import * as nube from './nube.js';

const estados = new WeakMap();
function estado() { if (!estados.has(E)) estados.set(E, { historial: false, limite: 12, revisiones: new Map() }); return estados.get(E); }
const contexto = () => ({ ...ctxNucleo(), marcas: E.marcasPlan || {}, enCurso: Object.keys(E.inicioSesion || {}).filter(f => !E.sesiones.some(s => s.fecha === f && !s.origen)) });
const modelo = () => armarFeed({ ...E, indice, hoy: hoy(), marcas: E.marcasPlan || {} });
const etiqueta = t => ({ pregunta: 'Tu coach pregunta', avance: 'Tu avance', cambio: 'Cambios del plan', falta: 'Lo que falta', respondida: 'Ya respondiste' })[t];
function grafico(puntos) {
  const valores = puntos.map(p => p.valor), min = Math.min(...valores), max = Math.max(...valores);
  const xy = puntos.map((p, i) => `${8 + i * 284 / (puntos.length - 1)},${64 - (p.valor - min) * 52 / (max - min || 1)}`).join(' ');
  return `<svg class="feed-grafico" viewBox="0 0 300 76" role="img" aria-label="${esc(puntos.map(p => `${fechaCorta(p.fecha)}: ${peso(p.valor)}`).join('; '))}"><polyline points="${xy}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" /></svg>`;
}
function calendario(cal, id) {
  return `<div class="feed-cal" aria-label="Calendario de las opciones">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<b aria-hidden="true">${d}</b>`).join('')}${cal.dias.map(d => {
    const contenido = `<span>${Number(d.fecha.slice(8))}</span><small>${esc(d.letra || ({ faltada: '×', hecha: '✓', sesion: '•', saltada: '×', no_puedo: 'No' })[d.tipo] || (d.elegible ? '+' : ''))}</small>`;
    return d.elegible ? `<button class="feed-cal-dia" data-feed-fecha="${d.fecha}" data-feed-id="${esc(id)}" aria-label="Ponerla el ${esc(fechaCorta(d.fecha))}">${contenido}</button>` : `<span class="feed-cal-dia ${d.tipo === 'faltada' ? 'feed-faltada' : ''}" aria-label="${esc(`${fechaCorta(d.fecha)}: ${d.foco || d.tipo}`)}">${contenido}</span>`;
  }).join('')}</div><p class="pequeno suave">× sin hacer · ✓ hecha · • planificada · cada letra señala su opción</p>`;
}
function revisionHtml(t) {
  const r = estado().revisiones.get(t.id)?.r;
  if (!r) return `<button class="boton" data-feed-revisar="${esc(t.id)}">Revisar la sesión</button>`;
  return `<div class="feed-revision"><p>${esc(r.texto)}</p>${r.calendario ? calendario(r.calendario, t.id) : ''}${r.semana ? `<ul>${r.semana.map(d => `<li>${esc(`${fechaCorta(d.fecha)}: ${d.foco || ''} ${d.cambio || ''}`)}</li>`).join('')}</ul>` : ''}${(r.opciones || []).map((o, i) => `<button class="boton" data-feed-opcion="${i}" data-feed-id="${esc(t.id)}">${esc(`${o.letra ? o.letra + ': ' : ''}${o.etiqueta}`)}</button>${o.nota ? `<p class="pequeno suave">${esc(o.nota)}</p>` : ''}`).join('')}</div>`;
}
function tarjetaHtml(t, historial) {
  const serie = t.serie;
  return `<article class="tarjeta feed-tarjeta feed-${t.tipo}" data-tarjeta-id="${esc(t.id)}">
    <div class="feed-meta"><span>${etiqueta(t.tipo)}</span><time datetime="${esc(t.fecha)}">${esc(fechaCorta(t.fecha))}</time></div>
    <h3>${esc(t.titulo)}</h3><p>${esc(t.texto)}</p>
    ${serie ? `<p class="feed-cifra">${esc(`${serie.carga_kg != null ? peso(serie.carga_kg) + ' × ' : ''}${serie.reps || (serie.duracion_seg ? serie.duracion_seg + ' s' : '')}`)}</p>` : ''}
    ${t.records?.length ? `<ul class="feed-records">${t.records.map(r => `<li><b>${esc(r.nombre)}</b><span>${esc(`${r.serie?.carga_kg != null ? peso(r.serie.carga_kg) + ' × ' : ''}${r.serie?.reps ?? (r.serie?.duracion_seg ? r.serie.duracion_seg + ' s' : '')}`)}</span></li>`).join('')}</ul>` : ''}
    ${t.puntos ? `${grafico(t.puntos)}<p class="pequeno">${esc(peso(t.antes))} a ${esc(peso(t.ahora))} estimados</p>` : ''}
    ${t.tipo === 'cambio' && t.antes ? `<p class="pequeno">Antes: ${esc(t.antes)}<br>Ahora: ${esc(t.ahora)}</p>` : ''}
    ${t.cambios?.length ? `<details><summary>Ver antes, después y por qué</summary>${t.cambios.map(c => `<p><b>${esc(c.nombre)}</b>: ${esc(c.motivo)}<br>Antes: ${esc(dosis(c.antes))}<br>Ahora: ${esc(dosis(c.despues))}</p>`).join('')}</details>` : ''}
    ${t.respuesta ? `<p class="pequeno suave">Respuesta guardada: ${esc(t.respuesta)}</p>` : ''}
    ${historial ? '' : t.tipo === 'pregunta' ? `<div class="feed-respuestas">${t.pregunta.opciones.map(o => `<button class="boton" data-feed-responder="${esc(o.id)}" data-feed-id="${esc(t.id)}">${esc(o.etiqueta)}</button>`).join('')}</div>` : `<div class="feed-acciones">${t.tipo === 'falta' ? revisionHtml(t) : t.ejercicio_id ? `<button class="boton" data-feed-ejercicio="${esc(t.id)}">Ver ejercicio</button>` : t.accion === 'progreso' ? `<button class="boton" data-feed-progreso="${esc(t.id)}">Ver progreso</button>` : ''}<button class="enlace" data-feed-vista="${esc(t.id)}">${t.tipo === 'falta' ? 'Dejar en el historial' : 'Listo'}</button></div>`}
  </article>`;
}
const dosis = e => e ? `${e.carga_kg != null ? peso(e.carga_kg) + ' × ' : ''}${e.reps_min} a ${e.reps_max}` : '';
export function feedHtml() {
  const e = estado(), f = modelo(), tarjetas = e.historial ? f.historial : f.nuevas;
  return `<section class="entrenar-feed" aria-label="Tu actividad"><div class="feed-cab"><h2>Tu actividad</h2><button class="enlace" data-feed-historial>${e.historial ? 'Ver novedades' : 'Historial'}</button></div>
    ${tarjetas.slice(0, e.limite).map(t => tarjetaHtml(t, e.historial)).join('') || `<div class="tarjeta feed-vacio"><h3>${e.historial ? 'Aquí queda lo que revisaste' : 'Estás al día'}</h3><p class="suave">${e.historial ? 'Las tarjetas que marques como listas y tus respuestas aparecerán aquí.' : 'Tus próximos avances, cambios y preguntas aparecerán aquí.'}</p></div>`}
    ${tarjetas.length > e.limite ? '<button class="boton" data-feed-mas>Ver más</button>' : ''}</section>`;
}
function vista(t) { E.feedVistas = verTarjeta(E.feedVistas, t); datoCambiado('feed_vistas'); }
async function guardarRespuesta(p, o, efecto, original) {
  if (E !== original) return;
  if (p.salud) { E.saludFeed = responderSalud(E.saludFeed, p, o, hoy()); datoCambiado('seguimiento_molestias'); return; }
  if (efecto.respuestas) E.respuestas = efecto.respuestas;
  E.respuestas = responderPregunta(R(), p, o, hoy());
  guardar();
  if (nube.conectado()) {
    try { await nube.guardarCuestionario(structuredClone(R())); }
    catch { avisar('Tu respuesta quedó en este teléfono. No pude subirla a la cuenta; revisa la conexión antes de cambiar de equipo.'); }
  }
}
function responder(t, opcion, volver, repintar, ir) {
  const original = E, p = t.pregunta, ctx = contexto(), efecto = efectoPregunta(p, opcion, ctx);
  if (efecto.error) { avisar(efecto.error); return; }
  const firma = JSON.stringify([E.plan, R(), E.registro, E.sesiones, E.inicioSesion]);
  abrirHoja({ titulo: 'Así quedaría', nota: efecto.detalle, volver,
    contenido: efecto.cambios ? `<ul class="feed-previa">${efecto.cambios.map(c => `<li><b>${esc(fechaCorta(c.fecha))}</b><p>Antes: ${esc(c.antes)}<br>Después: ${esc(c.despues)}</p></li>`).join('')}</ul>` : '',
    opciones: [{ valor: 'si', nombre: efecto.tecnica ? 'Ver la técnica y guardar respuesta' : 'Confirmar' }, { valor: 'no', nombre: 'Volver sin cambiar' }],
    alElegir: async valor => {
      if (valor !== 'si' || E !== original) return;
      if (firma !== JSON.stringify([E.plan, R(), E.registro, E.sesiones, E.inicioSesion])) { avisar('Tus datos cambiaron. Revisa de nuevo la propuesta antes de confirmar.'); repintar(); return; }
      if (efecto.plan) {
        const aviso = await cambiarPlan(efecto.plan, 'Cambio del coach confirmado para las sesiones pendientes.', nube);
        if (aviso) avisar(aviso);
        if (E !== original || E.plan !== efecto.plan) return;
      }
      await guardarRespuesta(p, opcion, efecto, original);
      if (E !== original) return;
      if (efecto.tecnica) ir('ficha', { id: efecto.tecnica, desde: 'entrenar' }); else repintar();
    },
  });
}
export function enlazarFeed(raiz, ir, repintar) {
  raiz.querySelector('[data-feed-historial]')?.addEventListener('click', () => { estado().historial = !estado().historial; estado().limite = 12; repintar(); });
  raiz.querySelector('[data-feed-mas]')?.addEventListener('click', () => { estado().limite += 12; repintar(); });
  const tarjetas = new Map(modelo().nuevas.map(t => [t.id, t]));
  raiz.querySelectorAll('[data-feed-vista]').forEach(b => b.onclick = () => { vista(tarjetas.get(b.dataset.feedVista)); repintar(); });
  raiz.querySelectorAll('[data-feed-ejercicio]').forEach(b => b.onclick = () => { const t = tarjetas.get(b.dataset.feedEjercicio); vista(t); ir('ficha', { id: t.ejercicio_id, desde: 'entrenar' }); });
  raiz.querySelectorAll('[data-feed-progreso]').forEach(b => b.onclick = () => { vista(tarjetas.get(b.dataset.feedProgreso)); ir('progreso'); });
  raiz.querySelectorAll('[data-feed-responder]').forEach(b => b.onclick = () => responder(tarjetas.get(b.dataset.feedId), b.dataset.feedResponder, b, repintar, ir));
  const poner = (t, r) => { estado().revisiones.set(t.id, { r, firma: JSON.stringify([E.plan, E.sesiones, E.marcasPlan]) }); repintar(); };
  raiz.querySelectorAll('[data-feed-revisar]').forEach(b => b.onclick = () => {
    const t = tarjetas.get(b.dataset.feedRevisar);
    poner(t, { texto: '¿Hiciste esta sesión?', opciones: [{ etiqueta: 'La hice, sin anotar', accion: { tipo: 'la_hice', fecha: t.fecha } }, { etiqueta: 'No la hice, ver opciones', accion: { tipo: 'no_hecha', fecha: t.fecha } }] });
  });
  async function elegir(t, accion) {
    const original = E, v = estado().revisiones.get(t.id);
    if (v.firma !== JSON.stringify([E.plan, E.sesiones, E.marcasPlan])) { poner(t, aplicarOpcion({ tipo: 'no_hecha', fecha: t.fecha }, contexto())); return; }
    const r = aplicarOpcion(accion, contexto());
    if (r.plan) { const aviso = await cambiarPlan(r.plan, r.texto, nube); if (aviso) avisar(aviso); if (E !== original || E.plan !== r.plan) return; }
    if (r.marca) { (E.marcasPlan ||= {})[r.marca.fecha] = r.marca.valor; datoCambiado('calendario_asistencia'); }
    if (r.plan || r.marca) { vista(t); estado().revisiones.delete(t.id); repintar(); }
    else poner(t, r);
  }
  raiz.querySelectorAll('[data-feed-opcion]').forEach(b => b.onclick = async () => {
    const t = tarjetas.get(b.dataset.feedId), r = estado().revisiones.get(t.id).r;
    b.disabled = true; await elegir(t, r.opciones[Number(b.dataset.feedOpcion)].accion);
  });
  raiz.querySelectorAll('[data-feed-fecha]').forEach(b => b.onclick = async () => {
    const t = tarjetas.get(b.dataset.feedId), cal = estado().revisiones.get(t.id).r.calendario;
    b.disabled = true; await elegir(t, { tipo: 'ver_alternativa', fecha: t.fecha, opcion: 'fecha', destino: b.dataset.feedFecha, base: cal.base });
  });
}
