// Vista Coach: el chat. Las reglas (nucleo/coach.js) responden al instante y sin señal; con cuenta, lo que no
// entienden lo responde la IA del servidor.
import { E, guardar, esc, $, ctxNucleo, cambiarPlan } from './comun.js';
import { responder, aplicarOpcion } from '../nucleo/coach.js';
import * as nube from './nube.js';

const SUGERENCIAS = ['¿Qué me toca hoy?', 'Falté hoy', 'Hoy no quiero hacer piernas', 'La máquina está ocupada', 'Solo tengo 30 minutos', 'Dormí mal y estoy cansado', 'Me duele el hombro', '¿Por qué hip thrust?'];

export function vistaCoach(ir, mensajeInicial) {
  if (!E.plan || E.plan.bloqueado) return ir('inicio');
  $('app').innerHTML = `<div id="vista-coach">
    <h1>Coach</h1>
    <div class="chat" id="chat" aria-live="polite">${E.chat.length ? E.chat.map(burbuja).join('') : '<p class="suave">Cuéntame qué pasa: si faltaste, si no quieres hacer algo hoy, si una máquina está ocupada, si dormiste mal o si te duele algo. También puedo explicarte por qué de cada ejercicio.</p>'}</div>
    <div class="chips sugerencias">${SUGERENCIAS.map(s => `<button type="button" class="sugerencia">${esc(s)}</button>`).join('')}</div>
    <form id="form-chat" class="fila-chat"><input type="text" id="mensaje" autocomplete="off" placeholder="Escribe aquí…" aria-label="Mensaje"><button type="submit" class="boton primario">Enviar</button></form>
    ${E.chat.length ? '<button type="button" class="enlace" id="limpiar">Borrar la conversación</button>' : ''}
  </div>`;
  const chat = $('chat');
  chat.scrollTop = chat.scrollHeight;
  $('form-chat').onsubmit = ev => { ev.preventDefault(); const t = $('mensaje').value.trim(); if (t) enviar(t, ir); };
  document.querySelectorAll('.sugerencia').forEach(b => b.onclick = () => enviar(b.textContent, ir));
  $('limpiar')?.addEventListener('click', () => { E.chat = []; guardar(); vistaCoach(ir); });
  chat.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-opcion]');
    if (!b) return;
    const msg = E.chat[Number(b.dataset.msg)];
    const op = msg?.opciones?.[Number(b.dataset.opcion)];
    if (!op) return;
    msg.opciones = null; // una opción por mensaje
    E.chat.push({ rol: 'persona', texto: op.etiqueta });
    const r = aplicarOpcion(op.accion, ctxNucleo());
    if (r.consentimiento) {
      E.consentimientos[r.consentimiento] = true;
      if (nube.conectado()) nube.consentir(r.consentimiento).catch(() => {});
    }
    E.chat.push({ rol: 'coach', texto: r.texto, opciones: r.opciones || null });
    const aviso = r.plan ? await cambiarPlan(r.plan, null, nube) : null;
    if (aviso) E.chat.push({ rol: 'coach', texto: aviso });
    guardar();
    vistaCoach(ir);
  });
  if (mensajeInicial) enviar(mensajeInicial, ir);
}

function burbuja(m, i) {
  return `<div class="burbuja ${m.rol}">${esc(m.texto)}${m.enlace ? ` <a class="enlace" href="${esc(m.enlace)}" target="_blank" rel="noopener">Ver videos</a>` : ''}
    ${m.opciones?.length ? `<div class="opciones-chat">${m.opciones.map((o, k) => `<button type="button" class="boton" data-msg="${i}" data-opcion="${k}">${esc(o.etiqueta)}</button>${o.avisos?.length ? `<span class="pequeno suave">${esc(o.avisos.join(' '))}</span>` : ''}`).join('')}</div>` : ''}</div>`;
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
      E.chat.push({ rol: 'coach', texto: (ia.texto || r.texto) + sinIa, opciones: ia.opciones || null });
      if (ia.recargar_plan) { const p = await nube.cargarPlan(); if (p) E.plan = p; }
    } catch (e) {
      E.chat = E.chat.filter(m => !m.pendiente);
      E.chat.push({ rol: 'coach', texto: `${r.texto} (No pude consultar a la IA: ${e.message})` });
    }
  } else {
    E.chat.push({ rol: 'coach', texto: r.texto + (r.requiere_ia && !nube.conectado() ? (nube.hay() ? ' Con una cuenta, esto lo responde la IA.' : ' En esta versión de prueba el coach responde con las reglas de la app; la IA llega con las cuentas.') : ''), opciones: r.opciones || null, enlace: r.enlace || null });
    const aviso = r.plan ? await cambiarPlan(r.plan, null, nube) : null;
    if (aviso) E.chat.push({ rol: 'coach', texto: aviso });
  }
  guardar();
  vistaCoach(ir);
}
