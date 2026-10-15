// Vista Coach: el chat con la IA (las reglas de Entreno son una de sus herramientas, en el servidor). Nada cambia el
// plan sin que la persona lo confirme con un botón: el coach muestra cómo queda la sesión de hoy o la semana y
// pregunta; después ofrece ir a verlo. Las ideas de mensajes las propone la IA. Las notas de cada sesión y la revisión
// de cada semana (nucleo/revision-semanal.js) se mandan solas al coach y quedan a la vista en el chat.
// Arriba, si hay sesiones pasadas sin registro, pregunta si se hicieron (nucleo/sin-registro.js): "La hice", "No la
// hice" (alternativas con la semana a la vista antes de aceptar) o "Revisar después" (vuelve a preguntar mañana).
import { propuestaChatHtml, confirmarCambioChat } from './propuesta-chat.js';
import { E, guardar, esc, $, ctxNucleo, cambiarPlan, hoy, avisar } from './comun.js';
import { aplicarOpcion } from '../nucleo/coach.js';
import * as nube from './nube.js';
import { sesionesPorRevisar, diaCorto } from '../nucleo/sin-registro.js';
import { sesionDe } from '../nucleo/agenda.js';
import { borradorNuevo } from '../nucleo/dia-pasado.js';
import { icono } from './iconos.js';
import { semanaPorRevisar, mensajeRevision } from '../nucleo/revision-semanal.js';

const borradores = new WeakMap(), decisiones = new WeakSet();
let consultaActual = null, limpiarRedaccion = () => {}, irActual = null, estadoChatTexto = null, pidiendoIdeas = null;
function borradorChat() {
  if (!borradores.has(E)) borradores.set(E, { texto: E.borradorChat || '', archivo: null, lectura: 0, leyendo: false });
  return borradores.get(E);
}
function recuperarConsultaInterrumpida() {
  let cambio = false;
  for (const m of E.chat) if (m.pendiente && !(consultaActual?.estado === E && consultaActual.usuario === nube.usuarioId() && consultaActual.mensaje === m)) {
    delete m.pendiente;
    m.texto = 'La consulta se interrumpió. Revisa si llegó una propuesta antes de volver a enviarla.';
    m.opciones = [{ etiqueta: 'Revisar propuestas en Perfil', accion: { tipo: 'ir', vista: 'mas' } }];
    cambio = true;
  }
  if (cambio) guardar();
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
  $('app').innerHTML = `<div id="vista-coach">
    <h1>Coach</h1>
    ${E.chatModo === 'plan' ? `<div class="modo-plan"><span>${icono('calendario', 'icono icono-chico')} Afinando tu plan</span><button type="button" class="enlace" id="salir-modo-plan">Volver al chat</button></div>`
      : E.plan?.dias?.length && !E.plan.bloqueado ? `<div class="atajos-plan" role="group" aria-label="Tu plan con el coach"><button type="button" class="boton" id="coach-afinar">${icono('calendario', 'icono icono-chico')} Afinar mi plan</button><button type="button" class="boton" id="coach-explicar">${icono('libro', 'icono icono-chico')} Explícame mi plan</button></div>` : ''}
    ${revisionHtml(porRevisar)}
    ${sensacionHtml()}
    ${!E.plan ? '<p>Cuéntame qué quieres entrenar. Para preparar el primer plan, completa tu edad y acepta los términos en tu perfil.</p><button class="boton" id="perfil-chat">Completar mi perfil</button>' : ''}
    <div class="chat" id="chat" aria-live="polite">${E.chat.length ? E.chat.map(burbuja).join('') : '<p class="suave">Cuéntame qué pasa: si faltaste, si una máquina está ocupada, si dormiste mal o si te duele algo. También te explico el porqué de cada ejercicio. Las notas de tus sesiones y la revisión de cada semana llegan aquí solas.</p>'}</div>
    <section id="permisos-chat" class="tarjeta" hidden></section>
    <div id="ideas-ia" class="chips sugerencias" role="group" aria-label="Ideas del coach">${ideasHtml(sobre)}</div>
    <div id="coach-redaccion">
      <form id="form-chat" class="fila-chat chat-redaccion"><textarea id="mensaje" rows="1" maxlength="30000" placeholder="Cuéntame o pega tu plan…" aria-label="Mensaje"></textarea><button type="submit" class="boton primario">Enviar</button></form>
      <div class="coach-herramientas"><details id="chat-adjuntos" ${borrador.archivo || borrador.leyendo ? 'open' : ''}><summary>Adjuntar</summary><div class="adjunto-chat"><label class="boton" for="archivo-chat">Adjuntar plan o historial</label><input id="archivo-chat" type="file" accept=".csv,.txt,text/csv,text/plain" hidden><button type="button" class="enlace" id="quitar-archivo" ${borrador.archivo || borrador.leyendo ? '' : 'hidden'}>Quitar archivo</button><button type="button" class="enlace" id="adjunto-futuro">Foto, PDF o audio (próximamente)</button><span id="archivo-chat-nombre" class="pequeno suave" role="status">${borrador.leyendo ? 'Leyendo el archivo…' : borrador.archivo ? esc(borrador.archivo.nombre) : 'CSV de Hevy o texto, hasta 200 KB'}</span></div></details><div id="estado-chat" class="pequeno suave" role="status">${nube.conectado() ? estadoChatTexto || '' : 'Sin conexión con el coach'}</div></div>
    </div>
    ${E.chat.length ? '<button type="button" class="enlace" id="limpiar">Borrar la conversación</button>' : ''}
  </div>`;
  $('perfil-chat')?.addEventListener('click', () => ir('perfil'));
  revisarEstadoChat(ir);
  pedirIdeas(sobre);
  const vigente = () => E === estadoVista && nube.usuarioId() === usuarioVista && $('vista-coach')?.isConnected;
  $('mensaje').value = borrador.texto;
  crecer($('mensaje'));
  $('mensaje').oninput = ev => { crecer(ev.target); if (!vigente()) return; borrador.texto = ev.target.value; E.borradorChat = borrador.texto; guardar(); };
  $('adjunto-futuro').onclick = () => avisar('Todavía no lee fotos, PDF ni audio. Por ahora adjunta CSV o texto.', 'neutro');
  $('quitar-archivo').onclick = () => {
    if (!vigente()) return;
    borrador.lectura++; borrador.leyendo = false; borrador.archivo = null;
    $('archivo-chat').value = ''; $('archivo-chat-nombre').textContent = 'CSV de Hevy o texto, hasta 200 KB'; $('quitar-archivo').hidden = true;
  };
  $('archivo-chat').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    const lectura = ++borrador.lectura;
    borrador.leyendo = false;
    if (f.size > 200000 || !/\.(csv|txt)$/i.test(f.name)) { avisar('Elige un archivo CSV o TXT de hasta 200 KB.'); ev.target.value = ''; $('archivo-chat-nombre').textContent = borrador.archivo?.nombre || 'CSV de Hevy o texto, hasta 200 KB'; $('quitar-archivo').hidden = !borrador.archivo; return; }
    const nombre = $('archivo-chat-nombre');
    borrador.leyendo = true; $('quitar-archivo').hidden = false;
    nombre.textContent = 'Leyendo el archivo…';
    try {
      const texto = await f.text();
      if (E !== estadoVista || nube.usuarioId() !== usuarioVista || lectura !== borrador.lectura) return;
      borrador.archivo = { tipo: /\.csv$/i.test(f.name) ? 'csv' : 'txt', texto, nombre: f.name };
    } catch {
      if (E === estadoVista && nube.usuarioId() === usuarioVista && lectura === borrador.lectura) avisar('No pude leer ese archivo. Elige otro o vuelve a intentarlo.');
    } finally {
      if (lectura === borrador.lectura) borrador.leyendo = false;
      if (vigente() && lectura === borrador.lectura) {
        $('archivo-chat-nombre').textContent = borrador.archivo?.nombre || 'CSV de Hevy o texto, hasta 200 KB';
        $('quitar-archivo').hidden = !borrador.archivo;
      }
    }
  };
  const chat = $('chat');
  prepararRedaccion();
  $('form-chat').onsubmit = ev => { ev.preventDefault(); const t = $('mensaje').value.trim(); if (borrador.leyendo) return avisar('Espera a que termine de leer el archivo.'); if (t || borrador.archivo) return enviar(t || 'Quiero importar este archivo.', ir, borrador.archivo); };
  $('vista-coach').addEventListener('click', ev => { const b = ev.target.closest('.sugerencia'); if (b) enviar(b.textContent, ir); });
  $('limpiar')?.addEventListener('click', () => { if (E.chat.some(m => m.pendiente) || E.chat.some(m => decisiones.has(m))) return avisar('Espera a que termine esta consulta o decisión antes de borrar la conversación.'); E.chat = []; guardar(); vistaCoach(ir); });
  chat.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-opcion]');
    if (!b) return;
    const msg = E.chat[Number(b.dataset.msg)];
    const op = msg && opcionesMensaje(msg)?.[Number(b.dataset.opcion)];
    if (!op || decisiones.has(msg) || !vigente()) return;
    if (op.accion.tipo === 'ir') return ir(op.accion.vista); // los botones para ir a ver el cambio quedan
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
  $('coach-afinar')?.addEventListener('click', () => vistaCoach(ir, { plan: 'afinar' }));
  $('coach-explicar')?.addEventListener('click', () => vistaCoach(ir, { plan: 'explicar' }));
  // La revisión de la semana que terminó y lo que quedó por mandar (sin señal) salen al abrir el chat.
  revisarSemanaSiToca();
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
export function mandarAlCoach({ texto, paraIA, modo, tipo }) {
  E.chat.push({ rol: 'persona', texto, tipo, modo, ...(paraIA && paraIA !== texto ? { paraIA } : {}), porEnviar: true });
  guardar();
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
function procesarColaCoach() {
  const m = E.chat.find(x => x.porEnviar);
  if (!m || !nube.conectado() || E.consentimientos?.ia_transferencia === false || E.chat.some(x => x.pendiente)) return;
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

/** El documento es la única zona de desplazamiento. Reserva el alto real del editor y del menú. La distancia al menú
 *  sale de su alto (no de su posición en pantalla, que en el iPhone cambia al mover la página o abrir el teclado y
 *  hacía subir y bajar la caja). Con el teclado abierto, el menú se oculta y la caja queda pegada arriba del teclado. */
function prepararRedaccion() {
  const panel = $('coach-redaccion'), app = $('app'), nav = $('nav'), editor = $('mensaje');
  const vv = typeof visualViewport !== 'undefined' ? visualViewport : null;
  let observador;
  const escribiendo = () => document.activeElement === editor && vv && innerHeight - vv.height > 120;
  const ubicar = () => {
    if (!panel.isConnected) { limpiar(); return; }
    const teclado = escribiendo();
    document.body?.classList.toggle('escribiendo-coach', Boolean(teclado));
    panel.style.bottom = teclado ? `${Math.max(8, innerHeight - (vv.offsetTop + vv.height) + 8)}px` : '';
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
    document.body?.classList.remove('escribiendo-coach');
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
  return m.opciones?.length ? m.opciones : m.rol === 'coach' && !m.pendiente
    ? Array.isArray(E.plan?.dias) && !E.plan.bloqueado ? irA('semana') : [{ etiqueta: 'Completar mi perfil', accion: { tipo: 'ir', vista: 'perfil' } }] : null;
}

/** El texto de la IA con formato simple y seguro: párrafos, **negrita** y listas con "- ". Todo se escapa antes. */
function textoRico(t) {
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
  const opciones = opcionesMensaje(m), ocupada = decisiones.has(m);
  // semana: cómo quedaría (o quedó) la semana, día por día, con lo que cambia marcado.
  const semana = m.semana?.length ? `<ul class="semana-chat">${m.semana.map(d => `<li class="${d.libre ? 'libre' : d.cambio ? 'cambia' : ''}"><span class="num">${esc(diaCorto(d.fecha))}</span><strong>${esc(d.foco)}</strong>${d.cambio ? `<small>${esc(d.cambio)}</small>` : ''}</li>`).join('')}</ul>` : '';
  // Las notas de una sesión y la revisión semanal se escribieron solas: llevan su etiqueta y el mismo formato del coach.
  const etiqueta = m.tipo === 'nota' ? 'Nota de la sesión' : m.tipo === 'revision' ? 'Revisión semanal' : '';
  const cabeza = etiqueta ? `<span class="tipo-mensaje">${icono(m.tipo === 'nota' ? 'lapiz' : 'calendario', 'icono icono-chico')} ${etiqueta}${m.porEnviar ? ` · ${esperaTexto()}` : ''}</span>` : '';
  return `<div id="mensaje-chat-${i}" tabindex="-1" class="burbuja ${m.rol}${etiqueta ? ' automatico' : ''}">${cabeza}<div class="texto-chat">${m.rol === 'coach' || etiqueta ? textoRico(m.texto) : esc(m.texto)}${m.enlace ? ` <a class="enlace" href="${esc(m.enlace)}" target="_blank" rel="noopener">Ver videos</a>` : ''}</div>${semana}${m.propuesta ? propuestaChatHtml({ ...m.propuesta, estado: m.estadoPropuesta || m.propuesta.estado }) : ''}${opciones?.length ? `<div class="opciones-chat" ${ocupada ? 'aria-busy="true"' : ''}>${opciones.map((o, k) => `<button type="button" ${ocupada ? 'disabled' : ''} class="boton${['confirmar', 'confirmar_ia', 'aceptar_alternativa'].includes(o.accion?.tipo) && k === 0 ? ' primario' : ''}" data-msg="${i}" data-opcion="${k}">${esc(o.etiqueta)}</button>${o.nota ? `<span class="pequeno suave nota-opcion">${esc(o.nota)}</span>` : ''}${o.avisos?.length ? `<span class="pequeno suave">${esc(o.avisos.join(' '))}</span>` : ''}`).join('')}</div>` : ''}${m.sugerencias?.length && i === E.chat.length - 1 ? `<div class="chips respuestas-rapidas" role="group" aria-label="Respuestas rápidas">${m.sugerencias.map(x => `<button type="button" class="sugerencia">${esc(x)}</button>`).join('')}</div>` : ''}</div>`;
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
  const modo = existente?.modo || (E.chatModo === 'plan' ? 'plan' : 'chat');
  const enVista = () => Boolean($('vista-coach')?.isConnected);
  // El chat es siempre con IA: las reglas de Entreno son una herramienta de la IA en el servidor. Sin cuenta o sin
  // señal no hay coach; se explica qué falta.
  const r = { requiere_ia: true, texto: !nube.hay() || !nube.usuarioId() ? 'El coach con IA necesita tu cuenta: entra en Perfil, Ajustes, Cuenta.' : 'No hay conexión: el coach con IA responde cuando vuelva la señal. Lo que escribiste queda aquí.' };
  if (nube.conectado()) {
    const mensaje = { rol: 'coach', texto: 'Pensando…', pendiente: true };
    consulta = consultaActual = { estado, usuario, mensaje };
    E.chat.push(mensaje);
    guardar();
    if (enVista()) vistaCoach(ir);
    try {
      const historial = E.chat.filter(m => !m.pendiente && m !== persona).slice(-7).map(m => ({ rol: m.rol, texto: m.texto.slice(0, 4000) }));
      const ia = await nube.chat(persona.paraIA || texto, historial, archivo ? { tipo: archivo.tipo, texto: archivo.texto } : null, modo);
      if (E !== estado || usuario !== nube.usuarioId()) return false;
      E.chat = E.chat.filter(m => m !== mensaje);
      if (existente && ia.requiere_permiso) {
        // Sin el permiso de la IA, la nota queda a la vista esperando; se manda al activarlo.
        existente.porEnviar = true; E.consentimientos.ia_transferencia = false; guardar();
        if (enVista()) vistaCoach(ir, { respuesta: true });
        return false;
      }
      completada = !ia.requiere_ia && !ia.requiere_permiso && !ia.motivo;
      E.chat.push({ rol: 'coach', texto: ia.texto || r.texto, propuesta: ia.propuesta || null, opciones: ia.propuesta ? confirmarIA(ia.propuesta.id) : ia.opciones || null, sugerencias: ia.sugerencias || null, enlace: ia.enlace || null });
      if (!enVista()) { E.chatSinLeer = true; marcarNovedadCoach(); }
    } catch (e) {
      if (E !== estado || usuario !== nube.usuarioId()) return false;
      completada = false;
      E.chat = E.chat.filter(m => m !== mensaje);
      // Lo que salió solo vuelve a esperar (se reintenta al abrir el chat); lo escrito muestra el error.
      if (existente) existente.porEnviar = true;
      else E.chat.push({ rol: 'coach', texto: `No pude completar la consulta. Se conserva lo escrito y el archivo para que decidas cuándo reintentar. ${e.message}` });
    } finally { if (consultaActual === consulta) consultaActual = null; }
  } else if (existente) {
    existente.porEnviar = true; guardar(); return false;
  } else {
    // Sin cuenta o sin señal: se dice qué falta y lo escrito queda en el borrador.
    completada = false;
    E.chat.push({ rol: 'coach', texto: r.texto });
  }
  if (completada && !existente) {
    if (borrador.texto.trim() === texto.trim()) borrador.texto = E.borradorChat = '';
    if (archivo && borrador.archivo === archivo) borrador.archivo = null;
  }
  guardar();
  if (enVista()) vistaCoach(ir, { respuesta: true });
  return completada;
}

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
      estadoChatTexto = 'OpenAI activo';
      out.innerHTML = `OpenAI activo <button class="enlace" id="revocar-chat">Desactivar IA</button>`;
      $('revocar-chat').onclick = async () => { await nube.consentirChat(false); if (E !== estado || usuario !== nube.usuarioId()) return; E.consentimientos.ia_transferencia = false; guardar(); if (out.isConnected) revisarEstadoChat(ir); };
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
  } catch { if (out.isConnected) out.textContent = 'Sin conexión con el coach'; }
}
