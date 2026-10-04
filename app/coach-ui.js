// Vista Coach: el chat. Las reglas (nucleo/coach.js) responden al instante y sin señal; con cuenta, lo que no
// entienden lo responde la IA del servidor. Nada cambia el plan sin que la persona lo confirme con un botón: el
// coach muestra cómo queda la sesión de hoy o la semana y pregunta; después ofrece ir a verlo.
// Arriba, si hay sesiones pasadas sin registro, pregunta si se hicieron (nucleo/sin-registro.js): "La hice", "No la
// hice" (alternativas con la semana a la vista antes de aceptar) o "Revisar después" (vuelve a preguntar mañana).
import { conPropios } from '../nucleo/propios.js';
import { E, guardar, esc, $, ctxNucleo, cambiarPlan, hoy, avisar } from './comun.js';
import { responder, aplicarOpcion } from '../nucleo/coach.js';
import * as nube from './nube.js';
import { sesionesPorRevisar, diaCorto } from '../nucleo/sin-registro.js';
import { sesionDe } from '../nucleo/agenda.js';
import { borradorNuevo } from '../nucleo/dia-pasado.js';
import { icono } from './iconos.js';

const SUGERENCIAS = ['¿Qué me toca hoy?', 'No entrené ayer', 'Falté hoy', 'Hoy no quiero hacer piernas', 'La máquina está ocupada', 'Solo tengo 30 minutos', 'Dormí mal y estoy cansado', 'Me duele el hombro', '¿Por qué hip thrust?'];

export function vistaCoach(ir, mensajeInicial) {
  if (!E.plan || E.plan.bloqueado) return ir('inicio');
  // Desde el menú ⋯ de un ejercicio llega {ejercicio, nombre}: preguntas sobre ese ejercicio y el texto empezado.
  const sobre = mensajeInicial && typeof mensajeInicial === 'object' && mensajeInicial.ejercicio ? mensajeInicial : null;
  const revisar = Boolean(mensajeInicial?.revisar); // desde el aviso de Hoy
  const porRevisar = sesionesPorRevisar(E.plan, E.sesiones, { hoy: hoy(), marcas: E.marcasPlan || {}, despues: E.revisarDespues || {} });
  const sugerencias = sobre
    ? [`¿Cómo se hace ${sobre.nombre}?`, `¿Por qué ${sobre.nombre}?`, `La máquina de ${sobre.nombre} está ocupada`, `Me duele al hacer ${sobre.nombre}`]
    : SUGERENCIAS;
  $('app').innerHTML = `<div id="vista-coach">
    <h1>Coach</h1>
    ${revisionHtml(porRevisar)}
    ${nube.hay() ? '' : '<p class="pequeno suave">En la versión de prueba respondo con las reglas de la app, sin IA: entiendo frases como las de abajo. La IA se activa cuando la app tenga servidor.</p>'}
    <div class="chat" id="chat" aria-live="polite">${E.chat.length ? E.chat.map(burbuja).join('') : '<p class="suave">Cuéntame qué pasa: si faltaste, si no quieres hacer algo hoy, si una máquina está ocupada, si dormiste mal o si te duele algo. También puedo explicarte por qué de cada ejercicio.</p>'}</div>
    <div class="chips sugerencias">${sugerencias.map(s => `<button type="button" class="sugerencia">${esc(s)}</button>`).join('')}</div>
    <form id="form-chat" class="fila-chat"><input type="text" id="mensaje" autocomplete="off" placeholder="Escribe aquí…" aria-label="Mensaje"><button type="submit" class="boton primario">Enviar</button></form>
    ${E.chat.length ? '<button type="button" class="enlace" id="limpiar">Borrar la conversación</button>' : ''}
  </div>`;
  const chat = $('chat');
  chat.scrollTop = chat.scrollHeight;
  $('form-chat').onsubmit = ev => { ev.preventDefault(); const t = $('mensaje').value.trim(); if (t) enviar(t, ir); };
  document.querySelectorAll('.sugerencia').forEach(b => b.onclick = () => enviar(b.textContent, ir));
  $('limpiar')?.addEventListener('click', () => { E.chat = []; guardar(); vistaCoach(ir); });
  chat.addEventListener('click', ev => {
    const b = ev.target.closest('[data-opcion]');
    if (!b) return;
    const msg = E.chat[Number(b.dataset.msg)];
    const op = msg?.opciones?.[Number(b.dataset.opcion)];
    if (!op) return;
    if (op.accion.tipo === 'ir') return ir(op.accion.vista); // los botones para ir a ver el cambio quedan
    msg.opciones = null; // una decisión por mensaje: tocar dos veces no repite el cambio
    decidir(op.accion, op.etiqueta, ir);
  });
  // La revisión de sesiones sin registro: cada respuesta se ve en el chat, como si se hubiera escrito.
  $('revision-registro')?.addEventListener('click', ev => {
    const b = ev.target.closest('[data-revision]');
    if (!b) return;
    const { revision: r, fecha } = b.dataset, foco = sesionDe(E.plan, fecha)?.foco || 'la sesión';
    if (r === 'despues') {
      (E.revisarDespues ||= {})[fecha] = hoy();
      guardar(); vistaCoach(ir, { revisar: true }); avisar(`Te pregunto de nuevo mañana por ${foco} del ${diaCorto(fecha)}.`);
      return;
    }
    decidir(r === 'hice' ? { tipo: 'la_hice', fecha } : { tipo: 'no_hecha', fecha }, r === 'hice' ? `La hice: ${foco} del ${diaCorto(fecha)}` : `No hice ${foco} del ${diaCorto(fecha)}`, ir);
  });
  // Desde el aviso de Hoy: la revisión ya está arriba; el foco va a su pregunta para que se lea primero.
  if (revisar && porRevisar.length) requestAnimationFrame(() => $('revision-titulo')?.focus({ preventScroll: true }));
  if (typeof mensajeInicial === 'string') enviar(mensajeInicial, ir);
  else if (sobre) { const m = $('mensaje'); m.value = `Sobre ${sobre.nombre}: `; m.focus(); m.setSelectionRange(m.value.length, m.value.length); }
}

/** Ejecuta una opción (del chat o de la revisión): la deja escrita como respuesta de la persona y aplica su resultado. */
async function decidir(accion, etiqueta, ir) {
  if (accion.tipo === 'anotar_pasado') {
    // Anotar los detalles de una sesión hecha: abre "Anotar un día pasado" con esa fecha (sin pisar un borrador con datos).
    const b = E.borradorPasado, conDatos = b?.ejercicios?.some(e => e.series?.some(x => x.reps != null || x.duracion_seg != null));
    if (!conDatos || b.fecha === accion.fecha) E.borradorPasado = conDatos ? b : borradorNuevo(accion.fecha, sesionDe(E.plan, accion.fecha));
    else avisar('Tienes un día pasado a medio anotar: termínalo o descártalo antes.');
    guardar();
    return ir('pasado');
  }
  E.chat.push({ rol: 'persona', texto: etiqueta });
  let r;
  if (accion.tipo === 'confirmar_ia') {
    // Un cambio que propuso la IA del servidor: se guarda ahora (guardar-plan lo vuelve a validar).
    r = E.propuestaIA ? { texto: 'Listo, cambié tu plan.', plan: E.propuestaIA, ir: 'semana' } : { texto: 'Ese cambio ya no está disponible. Pídemelo de nuevo.' };
    E.propuestaIA = null;
  } else r = aplicarOpcion(accion, ctxNucleo());
  if (accion.tipo === 'nada') E.propuestaIA = null;
  if (r.consentimiento) {
    E.consentimientos[r.consentimiento] = true;
    if (nube.conectado()) nube.consentir(r.consentimiento).catch(() => {});
  }
  if (r.marca) (E.marcasPlan ||= {})[r.marca.fecha] = r.marca.valor; // "la hice" o "la salto": manda sobre lo deducido
  const aviso = r.plan ? await cambiarPlan(r.plan, null, nube) : null;
  const cambio = Boolean(r.plan && !aviso) || r.marca?.valor === 'saltada';
  E.chat.push({ rol: 'coach', texto: aviso || r.texto, opciones: r.opciones || (cambio ? irA(r.ir) : null), semana: r.semana || null });
  guardar();
  vistaCoach(ir);
}

const NUMEROS = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete'];
/** "Hay dos sesiones sin registro. ¿Las realizaste?": cada una con su fecha y tres respuestas. */
function revisionHtml(xs) {
  if (!xs.length) return '';
  const una = xs.length === 1;
  return `<section class="revision-registro" id="revision-registro" aria-labelledby="revision-titulo">
    <h2 id="revision-titulo" tabindex="-1">Hay ${NUMEROS[xs.length] || xs.length} ${una ? 'sesión' : 'sesiones'} sin registro. ¿${una ? 'La' : 'Las'} realizaste?</h2>
    <p class="pequeno suave">No tener registro no significa que faltaste. Si no la hiciste, te muestro alternativas antes de cambiar nada.</p>
    <ul class="revision-lista">${xs.map(x => `<li>
      <div class="revision-sesion">${icono('calendario')}<span><strong>${esc(x.foco)}</strong><small>${esc(diaCorto(x.fecha))}</small></span></div>
      <div class="revision-botones" role="group" aria-label="${esc(`${x.foco} del ${diaCorto(x.fecha)}`)}">
        <button type="button" class="boton primario" data-revision="hice" data-fecha="${x.fecha}">La hice</button>
        <button type="button" class="boton" data-revision="no" data-fecha="${x.fecha}">No la hice</button>
        <button type="button" class="enlace" data-revision="despues" data-fecha="${x.fecha}">Revisar después</button>
      </div></li>`).join('')}</ul>
  </section>`;
}

/** Botones para ir a ver lo que cambió. */
const irA = donde => [
  ...(donde === 'hoy' ? [{ etiqueta: 'Ver Hoy', accion: { tipo: 'ir', vista: 'hoy' } }] : []),
  { etiqueta: 'Ver la semana', accion: { tipo: 'ir', vista: 'semana' } },
];
const CONFIRMAR_IA = [{ etiqueta: 'Sí, cambiar', accion: { tipo: 'confirmar_ia' } }, { etiqueta: 'No, dejarlo como está', accion: { tipo: 'nada' } }];

function burbuja(m, i) {
  // semana: cómo quedaría (o quedó) la semana, día por día, con lo que cambia marcado.
  const semana = m.semana?.length ? `<ul class="semana-chat">${m.semana.map(d => `<li class="${d.libre ? 'libre' : d.cambio ? 'cambia' : ''}"><span class="num">${esc(diaCorto(d.fecha))}</span><strong>${esc(d.foco)}</strong>${d.cambio ? `<small>${esc(d.cambio)}</small>` : ''}</li>`).join('')}</ul>` : '';
  return `<div class="burbuja ${m.rol}">${esc(m.texto)}${m.enlace ? ` <a class="enlace" href="${esc(m.enlace)}" target="_blank" rel="noopener">Ver videos</a>` : ''}${semana}${m.opciones?.length ? `<div class="opciones-chat">${m.opciones.map((o, k) => `<button type="button" class="boton${['confirmar', 'confirmar_ia', 'aceptar_alternativa'].includes(o.accion?.tipo) && k === 0 ? ' primario' : ''}" data-msg="${i}" data-opcion="${k}">${esc(o.etiqueta)}</button>${o.nota ? `<span class="pequeno suave nota-opcion">${esc(o.nota)}</span>` : ''}${o.avisos?.length ? `<span class="pequeno suave">${esc(o.avisos.join(' '))}</span>` : ''}`).join('')}</div>` : ''}</div>`;
}

async function enviar(texto, ir) {
  E.chat.push({ rol: 'persona', texto });
  const r = responder(texto, ctxNucleo());
  if (r.requiere_ia && nube.conectado()) {
    E.chat.push({ rol: 'coach', texto: 'Pensando…', pendiente: true });
    guardar(); vistaCoach(ir);
    try {
      const historial = E.chat.filter(m => !m.pendiente).slice(-8).map(m => ({ rol: m.rol, texto: m.texto }));
      const ia = await nube.chat(texto, historial.slice(0, -1));
      E.chat = E.chat.filter(m => !m.pendiente);
      const sinIa = ia.origen === 'reglas' && ia.requiere_ia ? ' (La IA del coach todavía no está activa o se acabó el cupo del mes; por ahora respondo con las reglas de la app.)' : '';
      // Si la IA propone un cambio, queda pendiente hasta que la persona lo confirme.
      if (ia.propuesta) E.propuestaIA = ia.propuesta;
      E.chat.push({ rol: 'coach', texto: (ia.texto || r.texto) + sinIa, opciones: ia.propuesta ? CONFIRMAR_IA : ia.opciones || null });
      if (ia.recargar_plan && !ia.propuesta) { const p = await nube.cargarPlan(); if (p) E.plan = conPropios(p, E.plan); }
    } catch (e) {
      E.chat = E.chat.filter(m => !m.pendiente);
      E.chat.push({ rol: 'coach', texto: `${r.texto} (No pude consultar a la IA: ${e.message})` });
    }
  } else {
    // Las reglas nunca traen el plan cambiado: proponen y la persona confirma con un botón.
    E.chat.push({ rol: 'coach', texto: r.texto + (r.requiere_ia && !nube.conectado() ? (nube.hay() ? ' Con una cuenta, esto lo responde la IA.' : ' En esta versión de prueba el coach responde con las reglas de la app; la IA llega con las cuentas.') : ''), opciones: r.opciones || null, enlace: r.enlace || null });
  }
  guardar();
  vistaCoach(ir);
}
