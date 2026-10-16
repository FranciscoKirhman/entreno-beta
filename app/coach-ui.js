// Vista Coach: el chat con la IA (las reglas de Entreno son una de sus herramientas, en el servidor). Nada cambia el
// plan sin que la persona lo confirme con un botón: el coach muestra cómo queda la sesión de hoy o la semana y
// pregunta; después ofrece ir a verlo. Las ideas de mensajes las propone la IA. Las notas de cada sesión y la revisión
// de cada semana (nucleo/revision-semanal.js) se mandan solas al coach y quedan a la vista en el chat.
// Arriba, si hay sesiones pasadas sin registro, pregunta si se hicieron (nucleo/sin-registro.js): "La hice", "No la
// hice" (alternativas con la semana a la vista antes de aceptar) o "Revisar después" (vuelve a preguntar mañana).
// Se ve como Mensajes (docs/36-coach-estilo-apple.md, app/coach.css): cabecera con la cara del coach, saludo con lo de
// hoy, campo redondo con ＋ (herramientas, app/herramientas-coach.js) y lo escrito sin señal queda en espera.
import { propuestaChatHtml, confirmarCambioChat } from './propuesta-chat.js';
import { E, guardar, esc, $, ctxNucleo, cambiarPlan, hoy, avisar, IMAGENES } from './comun.js';
import { aplicarOpcion } from '../nucleo/coach.js';
import * as nube from './nube.js';
import { sesionesPorRevisar, diaCorto } from '../nucleo/sin-registro.js';
import { sesionDe } from '../nucleo/agenda.js';
import { borradorNuevo } from '../nucleo/dia-pasado.js';
import { icono } from './iconos.js';
import { semanaPorRevisar, mensajeRevision } from '../nucleo/revision-semanal.js';
import { nombreAsistente, imagenAsistente, asistenteActual } from './cuestionario.js';
import { abrirHerramientas } from './herramientas-coach.js';
import { abrirHoja } from './hoja.js';
import { duracionSesion } from '../nucleo/motor-plan.js';

const borradores = new WeakMap(), decisiones = new WeakSet();
let consultaActual = null, limpiarRedaccion = () => {}, irActual = null, estadoChatTexto = null, pidiendoIdeas = null;
function borradorChat() {
  if (!borradores.has(E)) borradores.set(E, { texto: E.borradorChat || '', archivo: null, lectura: 0, leyendo: false });
  return borradores.get(E);
}
// Una consulta que se cortó (la app pasó a segundo plano, se cayó la red o el servidor tardó) no se pierde: el
// servidor la termina y guarda la respuesta con el id de la consulta; aquí se pide cada pocos segundos.
const RECUPERAR_MS = 4 * 60_000, CADA_MS = 4000;
const recuperando = new Set();
function recuperarConsultaInterrumpida() {
  let cambio = false;
  for (const m of E.chat) if (m.pendiente && !(consultaActual?.estado === E && consultaActual.usuario === nube.usuarioId() && consultaActual.mensaje === m)) {
    if (m.consulta && Date.now() - (m.desde || 0) < RECUPERAR_MS && nube.conectado()) { esperarRespuesta(m); continue; }
    delete m.pendiente;
    m.texto = m.consulta ? 'No me llegó la respuesta de esta consulta. Puedes reintentarla: si ya estaba lista, no se vuelve a cobrar.' : 'La consulta se interrumpió. Revisa si llegó una propuesta antes de volver a enviarla.';
    m.opciones = m.consulta ? [{ etiqueta: 'Reintentar', accion: { tipo: 'reintentar', consulta: m.consulta } }] : [{ etiqueta: 'Revisar propuestas en Perfil', accion: { tipo: 'ir', vista: 'mas' } }];
    cambio = true;
  }
  if (cambio) guardar();
}

/** Pide la respuesta guardada de una consulta cortada hasta que llega o se acaba el plazo. */
async function esperarRespuesta(pendiente) {
  if (recuperando.has(pendiente.consulta)) return;
  recuperando.add(pendiente.consulta);
  const estado = E, usuario = nube.usuarioId(), vigente = () => E === estado && nube.usuarioId() === usuario && E.chat.includes(pendiente);
  pendiente.texto = 'Sigue pensando…';
  let desconocida = 0;
  try {
    while (vigente() && Date.now() - (pendiente.desde || 0) < RECUPERAR_MS) {
      await new Promise(r => setTimeout(r, CADA_MS));
      if (!vigente()) return;
      let r;
      try { r = await nube.respuestaChat(pendiente.consulta); } catch { continue; } // sin red: se sigue intentando
      if (!vigente()) return;
      if (r.estado === 'lista' && r.respuesta) { aplicarRespuesta(pendiente, r.respuesta); return; }
      // Nunca llegó al servidor: sin conexión vuelve a la cola; con conexión, después de unos intentos, se ofrece reintentar.
      if (r.estado === 'desconocida' && ++desconocida >= 3) break;
    }
    if (!vigente()) return;
    const persona = E.chat.find(m => m.rol === 'persona' && m.consulta === pendiente.consulta);
    E.chat = E.chat.filter(m => m !== pendiente);
    if (persona && (persona.tipo || sinSenal())) { persona.porEnviar = true; pausarCola(); }
    else E.chat.push({ rol: 'coach', texto: 'No me llegó la respuesta de esta consulta. Puedes reintentarla: si ya estaba lista, no se vuelve a cobrar.', opciones: [{ etiqueta: 'Reintentar', accion: { tipo: 'reintentar', consulta: pendiente.consulta } }] });
    guardar(); avisoChat(); pintarChat();
  } finally { recuperando.delete(pendiente.consulta); }
}

/** Pone la respuesta del servidor en el lugar de "Pensando…" (al llegar directo o al recuperarla). */
function aplicarRespuesta(pendiente, ia) {
  const persona = E.chat.find(m => m.rol === 'persona' && m.consulta === pendiente.consulta);
  const i = E.chat.indexOf(pendiente);
  const mensaje = { rol: 'coach', texto: ia.texto || 'Listo.', propuesta: ia.propuesta || null, opciones: ia.propuesta ? confirmarIA(ia.propuesta.id) : ia.opciones || null, sugerencias: ia.sugerencias || null, enlace: ia.enlace || null, ...(persona?.sesionId ? { sesionId: persona.sesionId } : {}) };
  if (i >= 0) E.chat.splice(i, 1, mensaje); else E.chat.push(mensaje);
  if (!$('vista-coach')?.isConnected) { E.chatSinLeer = true; marcarNovedadCoach(); }
  guardar(); avisoChat(); pintarChat();
  procesarColaCoach();
}

/** Lo que respondiste en "¿Cómo se sintió?" al guardar (E.sensaciones): con dos de las últimas tres sesiones brutales,
 *  el Coach propone bajar la carga de hoy; con dos muy fáciles, pide anotar el esfuerzo para que el plan sepa subir. */
function sensacionHtml() {
  const ultimas = [...E.sesiones].filter(s => !s.origen && E.sensaciones?.[s.id]).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3);
  const n = t => ultimas.filter(s => E.sensaciones[s.id] === t).length;
  if (ultimas.length < 2) return '';
  if (n('brutal') >= 2) return `<section class="tarjeta aviso-sensacion"><h3>Tus últimas sesiones se sintieron brutales</h3>
    <p class="pequeno">Si se repite, conviene bajar un poco la carga o las series de hoy y dormir bien. Te muestro cómo quedaría antes de cambiar algo.</p>
    </section>`;
  if (n('facil') >= 2) return `<section class="tarjeta aviso-sensacion"><h3>Tus últimas sesiones se sintieron muy fáciles</h3>
    <p class="pequeno">El plan sube el peso cuando completas el rango con la reserva que pide. Anota el esfuerzo (RPE o RIR) de cada serie: así sabe cuándo subir antes.</p></section>`;
  return '';
}

export function vistaCoach(ir, mensajeInicial) {
  recuperarConsultaInterrumpida();
  const borrador = borradorChat(), estadoVista = E, usuarioVista = nube.usuarioId();
  const editorAnterior = $('mensaje');
  const redaccionActiva = Boolean(editorAnterior && document.activeElement === editorAnterior && !mensajeInicial?.enfocarAlternativas);
  const seleccion = redaccionActiva ? [editorAnterior.selectionStart, editorAnterior.selectionEnd] : null;
  limpiarRedaccion();
  if (E.plan?.bloqueado) avisar('Revisa las indicaciones de tu perfil antes de armar un plan.');
  // Desde el menú ⋯ de un ejercicio llega {ejercicio, nombre}: preguntas sobre ese ejercicio y el texto empezado.
  const sobre = mensajeInicial && typeof mensajeInicial === 'object' && mensajeInicial.ejercicio ? mensajeInicial : null;
  const revisar = Boolean(mensajeInicial?.revisar); // desde el aviso de Hoy
  // Desde Tu plan: {plan: 'afinar' | 'explicar'} abre una conversación de planificación con la IA.
  const desdePlan = mensajeInicial && typeof mensajeInicial === 'object' && mensajeInicial.plan;
  if (desdePlan) E.chatModo = 'plan';
  const porRevisar = sesionesPorRevisar(E.plan, E.sesiones, { hoy: hoy(), marcas: E.marcasPlan || {}, despues: E.revisarDespues || {} });
  irActual = ir;
  if (E.chatSinLeer) { delete E.chatSinLeer; guardar(); marcarNovedadCoach(); }
  const quien = nombreAsistente(), adjunto = borrador.archivo || borrador.leyendo;
  $('app').innerHTML = `<div id="vista-coach" style="--coach-mini:url('${srcPose('explica')}')">
    ${cabeceraHtml()}
    ${E.chatModo === 'plan' ? `<div class="modo-plan"><span>${icono('calendario', 'icono icono-chico')} Afinando tu plan</span><button type="button" class="enlace" id="salir-modo-plan">Volver al chat</button></div>` : ''}
    ${revisionHtml(porRevisar)}
    ${sensacionHtml()}
    ${E.chat.length ? '' : holaHtml()}
    <div class="chat" id="chat" aria-live="polite">${E.chat.map(burbuja).join('')}</div>
    <section id="permisos-chat" class="tarjeta" hidden></section>
    <div id="coach-redaccion">
      <div id="ideas-ia" class="coach-ideas" role="group" aria-label="Ideas del coach">${ideasHtml(sobre)}</div>
      <form id="form-chat" class="coach-campo">
        <button type="button" class="coach-plus" id="coach-herramientas" aria-label="Herramientas" aria-haspopup="dialog">${icono('mas')}</button>
        <div class="coach-entrada">
          <span class="adjunto-pildora" id="adjunto-pildora" ${adjunto ? '' : 'hidden'}>${icono('libro', 'icono icono-chico')}<span id="archivo-chat-nombre" role="status">${borrador.leyendo ? 'Leyendo el archivo…' : esc(borrador.archivo?.nombre || '')}</span><button type="button" id="quitar-archivo" aria-label="Quitar archivo">${icono('cerrar', 'icono icono-chico')}</button></span>
          <div class="fila-entrada"><textarea id="mensaje" rows="1" maxlength="30000" placeholder="Escríbele a ${esc(quien)}" aria-label="Mensaje"></textarea><button type="submit" class="coach-enviar" id="enviar-chat" aria-label="Enviar">${icono('enviar')}</button></div>
        </div>
      </form>
      <input id="archivo-chat" type="file" accept=".csv,.txt,text/csv,text/plain" hidden>
      <div id="estado-chat" class="coach-estado" role="status">${estadoChatTexto || ''}</div>
    </div>
  </div>`;
  $('perfil-chat')?.addEventListener('click', () => ir('perfil'));
  revisarEstadoChat(ir);
  pedirIdeas(sobre);
  const vigente = () => E === estadoVista && nube.usuarioId() === usuarioVista && $('vista-coach')?.isConnected;
  $('mensaje').value = borrador.texto;
  crecer($('mensaje'));
  // La flecha se enciende cuando hay algo que mandar (texto o archivo), como en Mensajes.
  const flecha = () => { const b = $('enviar-chat'); if (b) b.disabled = !$('mensaje').value.trim() && !borrador.archivo; };
  // El archivo adjunto se ve como una píldora dentro del campo, con su ✕.
  const pintarAdjunto = () => {
    $('adjunto-pildora').hidden = !(borrador.archivo || borrador.leyendo);
    $('archivo-chat-nombre').textContent = borrador.leyendo ? 'Leyendo el archivo…' : borrador.archivo?.nombre || '';
    flecha();
  };
  flecha();
  $('mensaje').oninput = ev => { crecer(ev.target); flecha(); if (!vigente()) return; borrador.texto = ev.target.value; E.borradorChat = borrador.texto; guardar(); };
  $('quitar-archivo').onclick = () => {
    if (!vigente()) return;
    borrador.lectura++; borrador.leyendo = false; borrador.archivo = null;
    $('archivo-chat').value = ''; pintarAdjunto();
  };
  $('archivo-chat').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    const lectura = ++borrador.lectura;
    borrador.leyendo = false;
    if (f.size > 200000 || !/\.(csv|txt)$/i.test(f.name)) { avisar('Elige un archivo CSV o TXT de hasta 200 KB.'); ev.target.value = ''; pintarAdjunto(); return; }
    borrador.leyendo = true; pintarAdjunto();
    try {
      const texto = await f.text();
      if (E !== estadoVista || nube.usuarioId() !== usuarioVista || lectura !== borrador.lectura) return;
      borrador.archivo = { tipo: /\.csv$/i.test(f.name) ? 'csv' : 'txt', texto, nombre: f.name };
    } catch {
      if (E === estadoVista && nube.usuarioId() === usuarioVista && lectura === borrador.lectura) avisar('No pude leer ese archivo. Elige otro o vuelve a intentarlo.');
    } finally {
      if (lectura === borrador.lectura) borrador.leyendo = false;
      if (vigente() && lectura === borrador.lectura) pintarAdjunto();
    }
  };
  const chat = $('chat');
  prepararRedaccion();
  $('form-chat').onsubmit = ev => { ev.preventDefault(); const t = $('mensaje').value.trim(); if (borrador.leyendo) return avisar('Espera a que termine de leer el archivo.'); if (t || borrador.archivo) return enviar(t || 'Quiero importar este archivo.', ir, borrador.archivo); };
  $('vista-coach').addEventListener('click', ev => { const b = ev.target.closest('.sugerencia'); if (b) enviar(b.textContent, ir); });
  // ＋: herramientas a un toque. Las de hoy cambian el plan con las reglas del teléfono (sin señal) y dejan una línea
  // con Deshacer; las del plan abren el chat encaminado; Importar y Pegar usan este mismo campo.
  $('coach-herramientas').onclick = ev => abrirHerramientas({
    ir, volver: ev.currentTarget,
    alCambiar: r => { if (!vigente()) return; E.mensaje = null; lineaCambio(r.texto); guardar(); vistaCoach(ir, { respuesta: true }); },
    alDolor: nube.conectado() && navigator.onLine !== false ? texto => enviar(texto, ir) : null, // sin señal, las reglas
    planChat: modo => vistaCoach(ir, { plan: modo }),
    adjuntar: () => $('archivo-chat').click(),
    pegarPlan: () => { const m = $('mensaje'); m.placeholder = 'Pega aquí tu plan y envíalo'; m.focus(); },
  });
  $('coach-menu').onclick = ev => menuCoach(ir, ev.currentTarget);
  $('vista-coach').addEventListener('click', ev => {
    const b = ev.target.closest('[data-coach-ir]');
    if (b) return ir(b.dataset.coachIr);
    if (ev.target.closest('[data-deshacer]')) deshacerCambio(ir);
  });
  chat.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-opcion]');
    if (!b) return;
    const msg = E.chat[Number(b.dataset.msg)];
    const op = msg && opcionesMensaje(msg)?.[Number(b.dataset.opcion)];
    if (!op || decisiones.has(msg) || !vigente()) return;
    if (op.accion.tipo === 'ir') return ir(op.accion.vista); // los botones para ir a ver el cambio quedan
    if (op.accion.tipo === 'reintentar') {
      // La misma consulta (mismo id): si el servidor ya la tenía lista, la devuelve sin volver a cobrar.
      const persona = E.chat.find(m => m.rol === 'persona' && m.consulta === op.accion.consulta);
      if (!persona) return;
      E.chat = E.chat.filter(m => m !== msg);
      return enviar(persona.texto, ir, null, { existente: persona });
    }
    decisiones.add(msg);
    b.closest('.opciones-chat')?.querySelectorAll('button').forEach(x => { x.disabled = true; });
    try {
      const aceptada = await decidir(op.accion, op.etiqueta, ir);
      if (E !== estadoVista || nube.usuarioId() !== usuarioVista) return;
      if (aceptada) { msg.opciones = null; msg.estadoPropuesta = op.accion.tipo === 'confirmar_ia' ? 'aplicada' : op.accion.tipo === 'descartar_ia' ? 'descartada' : null; }
      else if (E.chatPorTraer?.id === op.accion.id) msg.estadoPropuesta = 'por_comprobar';
      guardar();
    } finally { decisiones.delete(msg); if (vigente()) vistaCoach(ir, { respuesta: true, enfocarAlternativas: true }); }
  });
  // La revisión de sesiones sin registro: cada respuesta se ve en el chat, como si se hubiera escrito.
  $('revision-registro')?.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-revision]');
    if (!b) return;
    const { revision: r, fecha } = b.dataset, foco = sesionDe(E.plan, fecha)?.foco || 'la sesión';
    if (r === 'despues') {
      (E.revisarDespues ||= {})[fecha] = hoy();
      guardar(); vistaCoach(ir, { revisar: true }); avisar(`Te pregunto de nuevo mañana por ${foco} del ${diaCorto(fecha)}.`);
      return;
    }
    if (b.disabled || !vigente()) return;
    b.disabled = true;
    try { await decidir(r === 'hice' ? { tipo: 'la_hice', fecha } : { tipo: 'no_hecha', fecha }, r === 'hice' ? `La hice: ${foco} del ${diaCorto(fecha)}` : `No hice ${foco} del ${diaCorto(fecha)}`, ir); }
    finally { if (vigente()) vistaCoach(ir, { respuesta: true, enfocarAlternativas: true }); }
  });
  // Desde el aviso de Hoy: la revisión ya está arriba; el foco va a su pregunta para que se lea primero.
  if (revisar && porRevisar.length) {
    const titulo = $('revision-titulo');
    requestAnimationFrame(() => { if (vigente() && titulo?.isConnected) titulo.focus({ preventScroll: true }); });
  }
  else if (redaccionActiva) {
    const editor = $('mensaje');
    requestAnimationFrame(() => {
      if (!vigente() || !editor?.isConnected) return;
      editor.focus({ preventScroll: true }); editor.setSelectionRange(...seleccion);
    });
  }
  if (!revisar && (mensajeInicial?.respuesta || E.chat.length && !mensajeInicial && !porRevisar.length)) mostrarUltimaRespuesta(estadoVista, usuarioVista, !redaccionActiva);
  if (typeof mensajeInicial === 'string') enviar(mensajeInicial, ir);
  else if (sobre) { const m = $('mensaje'); if (!borrador.texto) { m.value = `Sobre ${sobre.nombre}: `; borrador.texto = E.borradorChat = m.value; guardar(); } m.focus(); m.setSelectionRange(m.value.length, m.value.length); }
  if (desdePlan) enviar(desdePlan === 'explicar' ? 'Explícame mi plan día por día: qué trabaja cada día y por qué.' : 'Quiero afinar mi plan. Hazme las preguntas que necesites antes de cambiarlo.', ir);
  $('salir-modo-plan')?.addEventListener('click', () => { E.chatModo = null; guardar(); vistaCoach(ir); });
  // La revisión de la semana que terminó y lo que quedó por mandar (sin señal) salen al abrir el chat.
  revisarSemanaSiToca();
}

// ── La cara del coach: cabecera, saludo y menú ⋯ ─────────────────────────────────────────────────────────────
/** La imagen de una pose del coach elegido (o su imagen base si esa pose no está). */
function srcPose(pose) {
  const id = asistenteActual(), con = `img/asistentes/${id}/${pose}.webp`;
  return IMAGENES.has(con) ? con : `img/asistentes/${id}.webp`;
}
const sinSenal = () => typeof navigator !== 'undefined' && navigator.onLine === false;
/** Cabecera como un contacto en Mensajes: cara, nombre y en qué está (en línea, sin señal, mensajes en espera). */
function cabeceraHtml() {
  const espera = E.chat.filter(m => m.porEnviar).length;
  const [clase, texto] = !nube.hay() || !nube.usuarioId() ? ['', 'Sin cuenta']
    : sinSenal() ? ['en-espera', espera ? `Sin señal · ${espera} en espera` : 'Sin señal']
    : espera ? ['en-espera', `${espera} en espera`]
    : ['en-linea', E.chatModo === 'plan' ? 'Afinando tu plan' : 'Tu coach'];
  return `<header class="coach-cabecera"><h1 class="sr-only">Coach</h1>
    <div class="coach-quien"><span class="coach-avatar">${imagenAsistente(sinSenal() ? 'sin_senal' : 'saludo', 'asistente-mini')}</span><strong>${esc(nombreAsistente())}</strong><small><span class="punto-estado ${clase}"></span>${esc(texto)}</small></div>
    <button type="button" class="coach-mas" id="coach-menu" aria-label="Más opciones del chat" aria-haspopup="dialog">${icono('puntos')}</button>
  </header>`;
}
/** Con el chat vacío: saludo según la hora, lo que toca hoy en una línea y botones para actuar. */
function holaHtml() {
  const h = new Date().getHours(), saludo = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  const conPlan = Array.isArray(E.plan?.dias) && !E.plan.bloqueado;
  const dia = conPlan ? sesionDe(E.plan, hoy()) : null, proxima = conPlan && !dia ? E.plan.dias.find(d => d.fecha > hoy()) : null;
  const linea = !E.plan ? 'Cuéntame qué quieres entrenar. Para armar tu primer plan, completa tu edad y acepta los términos en tu perfil.'
    : !conPlan ? 'Revisa las indicaciones de tu perfil antes de armar un plan.'
    : dia ? `Hoy toca ${dia.foco}: ${dia.ejercicios.length} ${dia.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}, unos ${duracionSesion(dia)} min.`
    : proxima ? `Hoy descansas. La próxima es ${proxima.foco}, el ${diaCorto(proxima.fecha)}.` : 'Hoy descansas.';
  const acciones = !E.plan ? '<button type="button" class="boton primario" id="perfil-chat">Completar mi perfil</button>'
    : dia ? '<button type="button" class="boton primario" data-coach-ir="hoy">Empezar</button><button type="button" class="boton" data-coach-ir="semana">Ver la semana</button>'
    : conPlan ? '<button type="button" class="boton" data-coach-ir="semana">Ver la semana</button>' : '';
  const nota = sinSenal() ? '<p class="pequeno">Sin señal: lo que escribas queda en espera y las herramientas del ＋ funcionan igual.</p>' : '';
  return `<section class="coach-hola">${imagenAsistente(sinSenal() ? 'sin_senal' : 'saludo', 'asistente-grande')}<h2>${saludo}</h2><p>${esc(linea)}</p>${nota}<div class="coach-acciones">${acciones}</div></section>`;
}
/** ⋯: lo que se usa poco y no debe estar a mano (borrar, el permiso de la IA). */
function menuCoach(ir, volver) {
  const iaActiva = nube.conectado() && E.consentimientos?.ia_transferencia === true;
  abrirHoja({
    titulo: nombreAsistente(), volver,
    opciones: [
      ...(Array.isArray(E.plan?.dias) && !E.plan.bloqueado ? [{ valor: 'afinar', icono: icono('ajustes'), nombre: 'Afinar mi plan' }, { valor: 'explicar', icono: icono('libro'), nombre: 'Explícame mi plan' }] : []),
      { valor: 'asistente', icono: icono('persona'), nombre: 'Cambiar de coach' },
      ...(iaActiva ? [{ valor: 'ia', icono: icono('cerrar'), nombre: 'Desactivar la IA' }] : []),
      ...(E.chat.length ? [{ valor: 'borrar', icono: icono('basurero'), nombre: 'Borrar la conversación', peligro: true }] : []),
    ],
    alElegir: v => {
      if (v === 'afinar' || v === 'explicar') return vistaCoach(ir, { plan: v });
      if (v === 'asistente') return ir('perfil');
      if (v === 'ia') return revocarIA(ir);
      if (v === 'borrar') {
        if (E.chat.some(m => m.pendiente) || E.chat.some(m => decisiones.has(m))) return avisar('Espera a que termine esta consulta o decisión antes de borrar la conversación.');
        abrirHoja({
          titulo: '¿Borrar la conversación?', volver, nota: 'Se borra de este teléfono. Tu plan y tus sesiones no cambian.',
          opciones: [{ valor: 'si', icono: icono('basurero'), nombre: 'Borrar', peligro: true }, { valor: 'no', icono: icono('cerrar'), nombre: 'Cancelar' }],
          alElegir: x => { if (x !== 'si') return; E.chat = []; guardar(); vistaCoach(ir); },
        });
      }
    },
  });
}

/** Desactivar la IA desde el menú ⋯: una respuesta tardía no toca otra cuenta ni otra pantalla. */
async function revocarIA(ir) {
  const estado = E, usuario = nube.usuarioId();
  try { await nube.consentirChat(false); } catch { if (E === estado && usuario === nube.usuarioId()) avisar('No pude cambiar el permiso. Reintenta con señal.'); return; }
  if (E !== estado || usuario !== nube.usuarioId()) return;
  E.consentimientos.ia_transferencia = false; estadoChatTexto = null; guardar();
  if ($('vista-coach')?.isConnected) vistaCoach(ir);
}

// ── Cambios hechos con las herramientas: una línea gris con Deshacer, como en Mail ────────────────────────────
/** El cambio vale para Deshacer mientras sea el último guardado (E.cambiosPlan[0], app/cambios-plan.js). */
function lineaCambio(texto) {
  const copia = E.cambiosPlan?.[0];
  for (const m of E.chat) delete m.deshacer;
  E.chat.push({ rol: 'coach', sistema: true, texto: String(texto || 'Listo, cambié tu plan.').replace(/^Listo:?\s*/i, ''), ...(copia ? { deshacer: copia.cuando } : {}) });
}
async function deshacerCambio(ir) {
  const m = E.chat.findLast(x => x.deshacer), copia = E.cambiosPlan?.[0];
  if (!m || copia?.cuando !== m.deshacer) { avisar('Ese cambio ya no es el último. Puedes deshacerlo desde Entrenar, Deshacer un cambio del plan.'); return; }
  delete m.deshacer;
  const aviso = await cambiarPlan(structuredClone(copia.plan), null, nube);
  if (aviso) { avisar(aviso); return; }
  E.mensaje = null;
  E.chat.push({ rol: 'coach', sistema: true, texto: 'Deshiciste el cambio: el plan quedó como antes.' });
  guardar(); vistaCoach(ir, { respuesta: true });
}

// ── Ideas de mensajes: las propone la IA con tu plan y cómo vienes (una vez al día, o al cambiar algo) ──────────
const claveIdeas = sobre => `${hoy()}|${E.sesiones.length}|${E.plan?.inicio || ''}|${sobre?.ejercicio || ''}`;
/** Solo cuando el último mensaje del coach no trae sus propias respuestas rápidas ni botones. */
function ideasVisibles() {
  const ultimo = E.chat.at(-1);
  return !(ultimo?.sugerencias?.length || (ultimo?.rol === 'coach' && ultimo.opciones?.length) || E.chat.some(m => m.pendiente));
}
function ideasHtml(sobre) {
  const ideas = E.ideasChat?.clave === claveIdeas(sobre) ? E.ideasChat.ideas : [];
  return ideasVisibles() ? ideas.map(x => `<button type="button" class="sugerencia">${esc(x)}</button>`).join('') : '';
}
async function pedirIdeas(sobre) {
  const clave = claveIdeas(sobre);
  if (!nube.conectado() || E.consentimientos?.ia_transferencia === false || E.ideasChat?.clave === clave || pidiendoIdeas === clave) return;
  const estado = E, usuario = nube.usuarioId();
  pidiendoIdeas = clave;
  try {
    const r = await nube.chat(sobre ? `Sobre el ejercicio ${sobre.nombre}` : 'ideas', [], null, 'ideas');
    if (E !== estado || nube.usuarioId() !== usuario) return;
    if (r.requiere_permiso) return;
    E.ideasChat = { clave, ideas: (r.sugerencias || []).slice(0, 4) };
    guardar();
    const caja = $('ideas-ia');
    if (caja?.isConnected) caja.innerHTML = ideasHtml(sobre);
  } catch { /* sin ideas: el chat sigue igual */ } finally { if (pidiendoIdeas === clave) pidiendoIdeas = null; }
}

// ── Lo que se manda solo al coach: notas de la sesión y revisión de la semana ────────────────────────────────
/** El punto en la pestaña Coach cuando llegó una respuesta sin estar mirando el chat. */
export function marcarNovedadCoach() {
  document.querySelector('#nav [data-ir="coach"]')?.classList.toggle('con-novedad', Boolean(E.chatSinLeer));
}
/** Deja el mensaje a la vista en el chat y lo manda en cuanto se pueda (con señal y el permiso de la IA). */
export function mandarAlCoach({ texto, paraIA, modo, tipo, sesionId }) {
  E.chat.push({ rol: 'persona', texto, tipo, modo, ...(paraIA && paraIA !== texto ? { paraIA } : {}), ...(sesionId ? { sesionId } : {}), porEnviar: true });
  guardar(); avisoChat();
  pintarChat();
  procesarColaCoach();
}
/** Si terminó una semana del plan y no se revisó, la pide (una vez por semana). */
export function revisarSemanaSiToca() {
  const s = semanaPorRevisar(E.plan, hoy(), E.revisionesIA || {});
  if (s && nube.conectado() && E.consentimientos?.ia_transferencia !== false) {
    (E.revisionesIA ||= {})[s.clave] = true;
    mandarAlCoach({ ...mensajeRevision(s), modo: 'semana', tipo: 'revision' });
  } else procesarColaCoach();
}
/** Si un envío falló con señal (servidor caído, red que no responde), la cola espera 30 s antes de reintentar: así
 *  repintar el chat no la vuelve a mandar en bucle. Volver la señal ('online') la manda de inmediato. */
let pausaCola = 0, reintentoCola = null;
function pausarCola() {
  pausaCola = Date.now() + 30000;
  if (!reintentoCola && typeof setTimeout === 'function') reintentoCola = setTimeout(() => { reintentoCola = null; procesarColaCoach(); }, 30000);
}
function procesarColaCoach({ forzar = false } = {}) {
  const m = E.chat.find(x => x.porEnviar);
  if (!m || !nube.conectado() || sinSenal() || E.consentimientos?.ia_transferencia === false || E.chat.some(x => x.pendiente)) return;
  if (!forzar && Date.now() < pausaCola) return;
  enviar(m.texto, irActual, null, { existente: m }).then(ok => { if (ok) procesarColaCoach(); });
}
function pintarChat() {
  if ($('vista-coach')?.isConnected && irActual) vistaCoach(irActual, { respuesta: true });
}

/** El campo crece con el texto hasta unas cinco líneas, como iMessage; recién ahí se desplaza por dentro (T24). */
function crecer(t) {
  t.style.height = 'auto';
  t.style.height = `${Math.min(t.scrollHeight + 2, 140)}px`;
}

/** Sin teclado, el documento es la única zona de desplazamiento: reserva el alto real del editor y del menú. La
 *  distancia al menú sale de su alto (no de su posición en pantalla, que en el iPhone cambia al mover la página).
 *  Con el teclado abierto, el chat entero ocupa solo la zona visible (visualViewport: arriba y alto, nunca innerHeight,
 *  que en el iPhone dejaba la caja muy arriba del teclado): cabecera arriba, mensajes al medio y caja abajo, como en
 *  Mensajes. Al abrir el teclado se ve lo último; al cerrarlo, la página vuelve a donde estaba el chat. */
function prepararRedaccion() {
  const panel = $('coach-redaccion'), app = $('app'), nav = $('nav'), editor = $('mensaje'), vista = $('vista-coach');
  const vv = typeof visualViewport !== 'undefined' ? visualViewport : null;
  let observador, activo = false;
  // En el teléfono basta con que el campo tenga el foco: en iOS reciente la ventana se achica junto con el teclado,
  // así que innerHeight y visualViewport miden lo mismo y la diferencia no sirve para saber si está abierto.
  const tactil = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const escribiendo = () => document.activeElement === editor && (tactil || (vv && innerHeight - vv.height > 120));
  const ubicar = () => {
    if (!panel.isConnected) { limpiar(); return; }
    const teclado = Boolean(escribiendo()), cuerpo = document.body;
    if (teclado) {
      cuerpo.style.setProperty('--coach-vv-arriba', `${vv ? Math.max(0, vv.offsetTop) : 0}px`);
      cuerpo.style.setProperty('--coach-vv-alto', vv ? `${vv.height}px` : '100dvh');
    }
    if (teclado === activo) return;
    const alFinal = teclado || vista.scrollHeight - vista.scrollTop - vista.clientHeight < 40, desde = vista.scrollTop;
    activo = teclado;
    cuerpo.classList.toggle('escribiendo-coach', teclado);
    if (teclado) vista.scrollTop = vista.scrollHeight;
    else scrollTo(0, alFinal ? document.documentElement.scrollHeight : desde);
  };
  const medir = () => {
    if (!panel.isConnected) { limpiar(); return; }
    const distancia = nav && !nav.hidden ? `calc(env(safe-area-inset-bottom,0px) + ${nav.offsetHeight + 16}px)` : 'calc(env(safe-area-inset-bottom,0px) + 12px)';
    app.style.setProperty('--coach-menu-distancia', distancia);
    app.style.setProperty('--coach-redaccion-alto', `${Math.round(panel.offsetHeight)}px`);
  };
  const alSalir = () => setTimeout(ubicar, 0);
  function limpiar() {
    observador?.disconnect(); vv?.removeEventListener('resize', ubicar); vv?.removeEventListener('scroll', ubicar);
    document.body?.classList.remove('escribiendo-coach'); activo = false;
  }
  medir();
  if (typeof ResizeObserver !== 'undefined') { observador = new ResizeObserver(medir); observador.observe(panel); }
  vv?.addEventListener('resize', ubicar); vv?.addEventListener('scroll', ubicar);
  editor.addEventListener('focus', ubicar); editor.addEventListener('blur', alSalir);
  limpiarRedaccion = limpiar;
}

/** Las alternativas y la aceptación quedan sobre el editor; una respuesta larga conserva un solo scroll. */
function mostrarUltimaRespuesta(estado, usuario, enfocar) {
  const indice = E.chat.findLastIndex(m => m.rol === 'coach');
  const mensaje = $(`mensaje-chat-${indice}`);
  if (!mensaje) return;
  requestAnimationFrame(() => {
    if (E !== estado || nube.usuarioId() !== usuario || !mensaje.isConnected) return;
    const opciones = mensaje.querySelector('.opciones-chat'), primera = opciones?.querySelector('button');
    const disponible = $('coach-redaccion').getBoundingClientRect().top - 64;
    const destino = mensaje.getBoundingClientRect().height <= disponible ? mensaje
      : opciones?.getBoundingClientRect().height <= disponible ? opciones : primera || mensaje;
    destino.scrollIntoView({ block: destino === primera ? 'start' : 'end', behavior: 'instant' });
    if (enfocar) (primera || mensaje).focus({ preventScroll: true });
  });
}

/** Ejecuta una opción (del chat o de la revisión): la deja escrita como respuesta de la persona y aplica su resultado. */
async function decidir(accion, etiqueta, ir) {
  const estado = E, uid = nube.usuarioId();
  const vigente = () => E === estado && uid === nube.usuarioId();
  if (accion.tipo === 'anotar_pasado') {
    // Anotar los detalles de una sesión hecha: abre "Anotar un día pasado" con esa fecha (sin pisar un borrador con datos).
    const b = E.borradorPasado, conDatos = b?.ejercicios?.some(e => e.series?.some(x => x.reps != null || x.duracion_seg != null));
    if (!conDatos || b.fecha === accion.fecha) E.borradorPasado = conDatos ? b : borradorNuevo(accion.fecha, sesionDe(E.plan, accion.fecha));
    else avisar('Tienes un día pasado a medio anotar: termínalo o descártalo antes.');
    guardar();
    ir('pasado'); return true;
  }
  E.chat.push({ rol: 'persona', texto: etiqueta });
  let r, aceptada = true;
  if (accion.tipo === 'confirmar_ia' || accion.tipo === 'descartar_ia') {
    try {
      if (accion.tipo === 'confirmar_ia') {
        if (!await confirmarCambioChat(accion.id)) return false;
        r = { texto: E.chatPorTraer ? 'Aceptaste estos cambios y se guardaron en tu cuenta. Falta traerlos a este teléfono. Sincroniza cuando tengas señal.' : 'Listo, aceptaste estos cambios. Ya están guardados en tu cuenta.', ir: 'semana', opciones: irA('semana') };
      } else {
        await nube.descartarPropuestaIA(accion.id);
        if (!vigente()) return false;
        if (E.chatPorTraer?.id === accion.id && !E.chatPorTraer.confirmado) delete E.chatPorTraer;
        r = { texto: 'Descartaste esta propuesta.' };
      }
      if (!vigente()) return false;
    } catch (e) { if (!vigente()) return false; r = { texto: e.message }; aceptada = false; }
  } else r = aplicarOpcion(accion, ctxNucleo());
  if (r.consentimiento) {
    E.consentimientos[r.consentimiento] = true;
    if (nube.conectado()) nube.consentir(r.consentimiento).catch(() => {});
  }
  if (r.marca) (E.marcasPlan ||= {})[r.marca.fecha] = r.marca.valor; // "la hice" o "la salto": manda sobre lo deducido
  const aviso = r.plan ? await cambiarPlan(r.plan, null, nube) : null;
  if (!vigente()) return false;
  if (r.plan && E.plan !== r.plan) aceptada = false;
  const cambio = Boolean(r.plan && !aviso) || r.marca?.valor === 'saltada';
  E.chat.push({ rol: 'coach', texto: aviso || r.texto, opciones: r.opciones || (cambio ? irA(r.ir) : null), semana: r.semana || null });
  guardar();
  return aceptada;
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
const confirmarIA = id => [{ etiqueta: 'Aceptar estos cambios', accion: { tipo: 'confirmar_ia', id } }, { etiqueta: 'Descartar', accion: { tipo: 'descartar_ia', id } }];
function opcionesMensaje(m) {
  const pendiente = m.propuesta?.id && E.chatPorTraer?.id === m.propuesta.id;
  if (pendiente || m.estadoPropuesta === 'por_comprobar') return [
    { etiqueta: 'Revisar y sincronizar en Perfil', accion: { tipo: 'ir', vista: 'mas' } },
    ...(!pendiente || !E.chatPorTraer.confirmado ? [{ etiqueta: 'Descartar', accion: { tipo: 'descartar_ia', id: m.propuesta.id } }] : []),
  ];
  if (['aplicada', 'descartada', 'no_disponible'].includes(m.estadoPropuesta)) return null;
  // "Ver la semana" solo va con los cambios (los traen sus opciones); una respuesta común no lleva botones.
  return m.opciones?.length ? m.opciones : m.rol === 'coach' && !m.pendiente && !m.sistema && !(Array.isArray(E.plan?.dias) && !E.plan.bloqueado)
    ? [{ etiqueta: 'Completar mi perfil', accion: { tipo: 'ir', vista: 'perfil' } }] : null;
}

/** El texto de la IA con formato simple y seguro: párrafos, **negrita** y listas con "- ". Todo se escapa antes. */
export function textoRico(t) {
  const linea = x => esc(x).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const bloques = [];
  for (const l of String(t || '').split('\n')) {
    const item = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/), titulo = l.match(/^\s*#{1,4}\s+(.*)$/);
    if (item) { const u = bloques.at(-1); if (u?.tipo === 'ul') u.items.push(item[1]); else bloques.push({ tipo: 'ul', items: [item[1]] }); }
    else if (titulo) bloques.push({ tipo: 'h', texto: titulo[1] });
    else if (!l.trim()) bloques.push({ tipo: 'corte' });
    else { const u = bloques.at(-1); if (u?.tipo === 'p') u.texto += ' ' + l.trim(); else bloques.push({ tipo: 'p', texto: l.trim() }); }
  }
  return bloques.map(b => (b.tipo === 'ul' ? `<ul>${b.items.map(x => `<li>${linea(x)}</li>`).join('')}</ul>` : b.tipo === 'h' ? `<p><strong>${linea(b.texto)}</strong></p>` : b.tipo === 'p' ? `<p>${linea(b.texto)}</p>` : '')).join('');
}

const esperaTexto = () => (!nube.usuarioId() ? 'se envía al entrar a tu cuenta' : E.consentimientos?.ia_transferencia === false ? 'se envía al activar la IA' : 'se envía con señal');
function burbuja(m, i) {
  // Lo que pasó (un cambio con las herramientas, deshacerlo): una línea gris centrada, con Deshacer si vale.
  if (m.sistema) return `<p id="mensaje-chat-${i}" tabindex="-1" class="linea-sistema">${esc(m.texto)}${m.deshacer ? ' · <button type="button" data-deshacer>Deshacer</button>' : ''}</p>`;
  if (m.pendiente) return `<div id="mensaje-chat-${i}" tabindex="-1" class="burbuja coach"><span class="escribiendo" role="status" aria-label="${esc(nombreAsistente())} está escribiendo"><i></i><i></i><i></i></span></div>`;
  const opciones = opcionesMensaje(m), ocupada = decisiones.has(m);
  // semana: cómo quedaría (o quedó) la semana, día por día, con lo que cambia marcado.
  const semana = m.semana?.length ? `<ul class="semana-chat">${m.semana.map(d => `<li class="${d.libre ? 'libre' : d.cambio ? 'cambia' : ''}"><span class="num">${esc(diaCorto(d.fecha))}</span><strong>${esc(d.foco)}</strong>${d.cambio ? `<small>${esc(d.cambio)}</small>` : ''}</li>`).join('')}</ul>` : '';
  // Las notas de una sesión y la revisión semanal se escribieron solas: llevan su etiqueta y el mismo formato del coach.
  const etiqueta = m.tipo === 'sesion' ? 'Tu sesión' : m.tipo === 'nota' ? 'Nota de la sesión' : m.tipo === 'revision' ? 'Revisión semanal' : '';
  const cabeza = etiqueta ? `<span class="tipo-mensaje">${icono(m.tipo === 'revision' ? 'calendario' : m.tipo === 'sesion' ? 'pesa' : 'lapiz', 'icono icono-chico')} ${etiqueta}${m.porEnviar ? ` · ${esperaTexto()}` : ''}</span>` : '';
  // Lo escrito sin señal: el mensaje queda a la vista, más tenue, con "En espera" debajo.
  const espera = m.porEnviar && !etiqueta ? `<span class="estado-envio">En espera · ${esperaTexto()}</span>` : '';
  return `<div id="mensaje-chat-${i}" tabindex="-1" class="burbuja ${m.rol}${etiqueta ? ' automatico' : ''}${espera ? ' en-espera' : ''}${m.propuesta ? ' con-propuesta' : ''}">${cabeza}<div class="texto-chat">${m.rol === 'coach' || etiqueta ? textoRico(m.texto) : esc(m.texto)}${m.enlace ? ` <a class="enlace" href="${esc(m.enlace)}" target="_blank" rel="noopener">Ver videos</a>` : ''}</div>${semana}${m.propuesta ? propuestaChatHtml({ ...m.propuesta, estado: m.estadoPropuesta || m.propuesta.estado }) : ''}${opciones?.length ? `<div class="opciones-chat" ${ocupada ? 'aria-busy="true"' : ''}>${opciones.map((o, k) => `<button type="button" ${ocupada ? 'disabled' : ''} class="boton${['confirmar', 'confirmar_ia', 'aceptar_alternativa'].includes(o.accion?.tipo) && k === 0 ? ' primario' : ''}" data-msg="${i}" data-opcion="${k}">${esc(o.etiqueta)}</button>${o.nota ? `<span class="pequeno suave nota-opcion">${esc(o.nota)}</span>` : ''}${o.avisos?.length ? `<span class="pequeno suave">${esc(o.avisos.join(' '))}</span>` : ''}`).join('')}</div>` : ''}${m.sugerencias?.length && i === E.chat.length - 1 ? `<div class="chips respuestas-rapidas" role="group" aria-label="Respuestas rápidas">${m.sugerencias.map(x => `<button type="button" class="sugerencia">${esc(x)}</button>`).join('')}</div>` : ''}</div>${espera}`;
}

/** existente: un mensaje que ya está en el chat esperando salir (nota de sesión o revisión semanal). */
async function enviar(texto, ir, archivo = null, { existente = null } = {}) {
  recuperarConsultaInterrumpida();
  if (E.chat.some(m => m.pendiente)) { if (!existente) avisar('Hay una consulta en curso. Puedes seguir escribiendo mientras termina.'); return false; }
  if (archivo && !nube.conectado()) { avisar('Entra a tu cuenta en Perfil para revisar este archivo. Se conserva aquí mientras mantengas la app abierta.'); return false; }
  const estado = E, usuario = nube.usuarioId();
  const borrador = borradorChat();
  let completada = true, consulta;
  const persona = existente || { rol: 'persona', texto };
  if (existente) delete existente.porEnviar; else E.chat.push(persona);
  persona.consulta ||= typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  const modo = existente?.modo || (E.chatModo === 'plan' ? 'plan' : 'chat');
  // Como en Mensajes: al enviar, el campo queda vacío de inmediato. Si la consulta falla, lo escrito vuelve al campo.
  const vaciado = !existente && nube.conectado() && borrador.texto.trim() === texto.trim() && Boolean(texto.trim());
  if (vaciado) { borrador.texto = E.borradorChat = ''; const campo = $('mensaje'); if (campo?.isConnected) { campo.value = ''; crecer(campo); } }
  const enVista = () => Boolean($('vista-coach')?.isConnected);
  // El chat es siempre con IA: las reglas de Entreno son una herramienta de la IA en el servidor. Sin cuenta o sin
  // señal no hay coach; se explica qué falta.
  const r = { requiere_ia: true, texto: !nube.hay() || !nube.usuarioId() ? 'El coach con IA necesita tu cuenta: entra en Perfil, Ajustes, Cuenta.' : 'No hay conexión: el coach con IA responde cuando vuelva la señal. Lo que escribiste queda aquí.' };
  if (nube.conectado() && sinSenal()) {
    // Sin señal: queda en espera en el chat y sale solo al volver la conexión (procesarColaCoach).
    persona.porEnviar = true;
    if (!existente && borrador.texto.trim() === texto.trim()) borrador.texto = E.borradorChat = '';
    if (!existente && archivo && borrador.archivo === archivo) borrador.archivo = null;
    guardar(); avisoChat();
    if (enVista()) vistaCoach(ir, { respuesta: true });
    return false;
  }
  if (nube.conectado()) {
    const mensaje = { rol: 'coach', texto: 'Pensando…', pendiente: true, consulta: persona.consulta, desde: Date.now() };
    consulta = consultaActual = { estado, usuario, mensaje };
    E.chat.push(mensaje);
    guardar();
    if (enVista()) vistaCoach(ir);
    try {
      const historial = E.chat.filter(m => !m.pendiente && m !== persona).slice(-7).map(m => ({ rol: m.rol, texto: m.texto.slice(0, 4000) }));
      const ia = await nube.chat(persona.paraIA || texto, historial, archivo ? { tipo: archivo.tipo, texto: archivo.texto } : null, modo, persona.consulta);
      if (E !== estado || usuario !== nube.usuarioId()) return false;
      if (ia.estado === 'pensando') { consultaActual = null; esperarRespuesta(mensaje); return false; } // ya la estaba respondiendo
      E.chat = E.chat.filter(m => m !== mensaje);
      if (existente && ia.requiere_permiso) {
        // Sin el permiso de la IA, la nota queda a la vista esperando; se manda al activarlo.
        existente.porEnviar = true; E.consentimientos.ia_transferencia = false; guardar();
        if (enVista()) vistaCoach(ir, { respuesta: true });
        return false;
      }
      completada = !ia.requiere_ia && !ia.requiere_permiso && !ia.motivo;
      E.chat.push({ rol: 'coach', texto: ia.texto || r.texto, propuesta: ia.propuesta || null, opciones: ia.propuesta ? confirmarIA(ia.propuesta.id) : ia.opciones || null, sugerencias: ia.sugerencias || null, enlace: ia.enlace || null, ...(persona.sesionId ? { sesionId: persona.sesionId } : {}) });
      if (!enVista()) { E.chatSinLeer = true; marcarNovedadCoach(); }
    } catch (e) {
      if (E !== estado || usuario !== nube.usuarioId()) return false;
      completada = false;
      // La red se cortó o el servidor tardó (un 504 llega sin CORS: también es TypeError): la consulta pudo llegar y
      // el servidor la termina igual. Se espera su respuesta guardada en vez de darla por perdida o reenviarla.
      if (!sinSenal() && (e?.name === 'TypeError' || [502, 503, 504, 546].includes(e?.status))) {
        if (consultaActual === consulta) consultaActual = null;
        guardar(); esperarRespuesta(mensaje);
        return false;
      }
      E.chat = E.chat.filter(m => m !== mensaje);
      // Lo que salió solo, o lo que no salió por falta de señal, vuelve a esperar; otros errores se muestran.
      if (existente) { existente.porEnviar = true; pausarCola(); }
      else if (sinSenal() || e?.name === 'TypeError') { // fetch sin red: "Failed to fetch"
        persona.porEnviar = true; pausarCola();
        if (borrador.texto.trim() === texto.trim()) borrador.texto = E.borradorChat = '';
      }
      else E.chat.push({ rol: 'coach', texto: `No pude completar la consulta. Se conserva lo escrito y el archivo para que decidas cuándo reintentar. ${e.message}` });
    } finally { if (consultaActual === consulta) consultaActual = null; }
  } else if (existente) {
    existente.porEnviar = true; guardar(); return false;
  } else {
    // Sin cuenta o sin señal: se dice qué falta y lo escrito queda en el borrador.
    completada = false;
    E.chat.push({ rol: 'coach', texto: r.texto, ...(!nube.usuarioId() ? { opciones: [{ etiqueta: 'Entrar a mi cuenta', accion: { tipo: 'ir', vista: 'mas' } }] } : {}) });
  }
  if (completada && !existente) {
    if (borrador.texto.trim() === texto.trim()) borrador.texto = E.borradorChat = '';
    if (archivo && borrador.archivo === archivo) borrador.archivo = null;
  } else if (vaciado && !persona.porEnviar && !borrador.texto) borrador.texto = E.borradorChat = texto;
  guardar(); avisoChat();
  if (enVista()) vistaCoach(ir, { respuesta: true });
  return completada;
}

/** Avisa a otras pantallas (el resumen de la sesión) que el chat cambió. */
const avisoChat = () => { if (typeof document !== 'undefined') document.dispatchEvent?.(new Event('coach-chat')); };

/** El comentario del coach para una sesión guardada (lo pide el resumen, app/resumen.js): sale como mensaje de la
 *  sesión; si no hay señal, queda en espera. La respuesta lleva el mismo sesionId. */
export function pedirComentarioSesion(sesion, paraIA) {
  if (E.chat.some(m => m.rol === 'persona' && m.sesionId === sesion.id)) return;
  E.chat.push({ rol: 'persona', texto: `¿Cómo me fue en ${sesion.titulo || 'la sesión'} del ${diaCorto(sesion.fecha)}?`, paraIA, tipo: 'sesion', modo: 'nota', sesionId: sesion.id, porEnviar: true });
  guardar(); avisoChat(); pintarChat(); procesarColaCoach();
}
// Al volver la señal, sale lo que quedó en espera.
if (typeof window !== 'undefined') window.addEventListener('online', () => procesarColaCoach({ forzar: true }));

async function revisarEstadoChat(ir) {
  if (!nube.conectado()) return;
  const out = $('estado-chat'), usuario = nube.usuarioId(), estado = E;
  try {
    const r = await nube.estadoChat();
    if (E !== estado || usuario !== nube.usuarioId()) return;
    // El permiso puede venir de otro teléfono: así la cola de notas sabe si puede salir.
    if (r.disponible && E.consentimientos.ia_transferencia !== r.autorizado) { E.consentimientos.ia_transferencia = r.autorizado; guardar(); if (r.autorizado) procesarColaCoach(); }
    if (!out.isConnected) return;
    if (!r.disponible) out.textContent = estadoChatTexto = 'IA sin activar';
    else if (r.autorizado) {
      // Todo anda: sin texto (desactivar la IA está en el menú ⋯).
      estadoChatTexto = null; out.textContent = '';
    } else {
      estadoChatTexto = null;
      out.innerHTML = '<button class="enlace" id="ver-permiso-chat">Activar IA</button>';
      const panel = $('permisos-chat');
      panel.innerHTML = '<h2 id="permiso-chat-titulo" tabindex="-1">Chat con OpenAI</h2><p>Para usar IA, tus mensajes, archivos TXT y los datos necesarios de tu plan, historial, preferencias, suplementos y bienestar se envían a OpenAI cuando los consultes. Las lesiones requieren además tu permiso de salud. Tú aceptas cada cambio.</p><button class="boton" id="activar-chat">Permitir el chat con OpenAI</button><p id="permiso-chat-error" role="status"></p>';
      $('ver-permiso-chat').onclick = () => {
        if (E !== estado || usuario !== nube.usuarioId() || !panel.isConnected) return;
        panel.hidden = false; panel.scrollIntoView({ block: 'end', behavior: 'instant' });
        $('permiso-chat-titulo').focus({ preventScroll: true });
      };
      $('activar-chat').onclick = async ev => { ev.currentTarget.disabled = true; try { await nube.consentirChat(); if (E !== estado || usuario !== nube.usuarioId()) return; E.consentimientos.ia_transferencia = true; guardar(); if (panel.isConnected && out.isConnected) vistaCoach(ir); } catch { if (E === estado && usuario === nube.usuarioId() && panel.isConnected) { $('permiso-chat-error').textContent = 'No pude registrar el permiso. Reintenta con señal.'; ev.currentTarget.disabled = false; } } };
    }
  } catch { if (out.isConnected) out.textContent = ''; }
}
