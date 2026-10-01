// Vista Más: cuenta, ajustar con tu propia IA (copiar y pegar), importar un plan escrito y reiniciar.
import { E, guardar, reiniciar, R, D, esc, $, indice, hoy, cambiarPlan, fechaCorta, respaldo, restaurar, chk } from './comun.js';
import { soporte, configAvisos, cambiarAvisos, activarAvisos, notificar, enlaceCalendario } from './avisos.js';
import { CONFIG } from './config.js';
import { aplicarCambios, promptParaIA, leerRespuestaIA } from '../nucleo/cambios.js';
import { validarPlan } from '../nucleo/validador.js';
import { permitidos } from '../nucleo/mcp.js';
import { leerPlanTexto, calendarizar } from '../nucleo/importar-plan.js';
import * as nube from './nube.js';

export function vistaMas(ir, { armarPlan, sincronizarAlEntrar }) {
  $('app').innerHTML = `<div id="vista-mas">
    <h1>Más</h1>
    ${E.mensaje ? `<div class="aviso bien">${esc(E.mensaje)}</div>` : ''}
    <section class="tarjeta" id="cuenta">${cuentaHtml()}</section>
    ${instalada() ? '' : `<section class="tarjeta"><h3>Instalarla en el teléfono</h3>
      <p class="pequeno"><strong>iPhone:</strong> en Safari, botón Compartir y "Agregar a pantalla de inicio".<br><strong>Android:</strong> en Chrome, menú ⋮ e "Instalar app".<br>Queda con su ícono y abre sin señal en el gimnasio.</p></section>`}

    <section class="tarjeta" id="recordatorios">${recordatoriosHtml()}</section>

    <section class="tarjeta">
      <h3>Respaldo</h3>
      <p class="pequeno">${nube.conectado() ? 'Tu cuenta ya guarda todo. Igual puedes' : 'Lo que anotas queda solo en este teléfono. Cada tanto,'} descarga un respaldo: sirve para no perder nada si se borran los datos del navegador o si cambias de teléfono. Las fotos no van en el respaldo.</p>
      <div class="fila-botones"><button type="button" class="boton" id="descargar-respaldo">Descargar respaldo</button>
        <label class="boton">Restaurar un respaldo<input type="file" id="archivo-respaldo" accept="application/json,.json" hidden></label></div>
      <div id="estado-respaldo"></div>
    </section>

    <section class="tarjeta">
      <h3>Ajustar con tu IA</h3>
      <p class="pequeno">Usa ChatGPT, Claude o Gemini. Copia el texto, pégalo en tu IA y trae de vuelta su respuesta. La app revisa todo con las mismas reglas antes de cambiar tu plan.</p>
      <textarea id="pedido" placeholder="Ej: quiero más glúteo, el martes solo tengo 40 minutos">${esc(E.pedido)}</textarea>
      <div class="fila-botones"><button type="button" class="boton" id="copiar">Copiar texto para mi IA</button></div>
      <div id="prompt-caja"></div>
      <textarea id="respuesta" placeholder="Pega aquí la respuesta completa de tu IA"></textarea>
      <div class="fila-botones"><button type="button" class="boton" id="revisar">Revisar cambios</button></div>
      <div id="resultado-ia"></div>
    </section>

    <section class="tarjeta">
      <h3>Importar un plan que ya tengo</h3>
      <p class="pequeno">Pega el plan que te dio tu entrenador o que tienes anotado. Una línea por ejercicio, con series × repeticiones. Los días se marcan con "Lunes", "Día 1", etc.</p>
      <textarea id="plan-texto" rows="8" placeholder="Lunes - Pierna&#10;Sentadilla 4x8 80kg&#10;Hip thrust 3x10-12 RIR 2&#10;&#10;Miércoles - Torso&#10;Press banca 4x6-8&#10;Jalón al pecho 3x10"></textarea>
      <label class="pequeno">Semanas a agendar <input type="number" id="plan-semanas" min="1" max="12" value="4"></label>
      <div class="fila-botones"><button type="button" class="boton" id="importar">Revisar</button></div>
      <div id="resultado-importar"></div>
    </section>

    <section class="tarjeta">
      <h3>Tu plan</h3>
      <div class="fila-botones"><button type="button" class="boton" id="rehacer">Rehacer el plan con mis respuestas</button><button type="button" class="boton" id="cuestionario">Cambiar mis respuestas</button></div>
      <div class="fila-botones"><button type="button" class="boton" id="borrar-local">Borrar todo de este teléfono</button></div>
    </section>
    <p class="pequeno suave">Versión ${esc(CONFIG.version)}</p>
  </div>`;
  enlazarCuenta(ir, sincronizarAlEntrar);
  enlazarRecordatorios();
  $('pedido').oninput = e => { E.pedido = e.target.value; guardar(); };
  $('copiar').onclick = async () => {
    const d = D();
    const texto = promptParaIA({ derivados: d, plan: E.plan, permitidos: permitidos({ indice, respuestas: R(), derivados: d, hoy: hoy() }), pedido: E.pedido || '' });
    $('prompt-caja').innerHTML = `<pre class="prompt" id="prompt-texto">${esc(texto)}</pre><p class="pequeno" id="copiado"></p>`;
    try { await navigator.clipboard.writeText(texto); $('copiado').textContent = 'Copiado. Pégalo en tu IA.'; }
    catch { const sel = getSelection(), rango = document.createRange(); rango.selectNodeContents($('prompt-texto')); sel.removeAllRanges(); sel.addRange(rango); $('copiado').textContent = 'Texto seleccionado: cópialo con Copiar.'; }
  };
  $('revisar').onclick = () => {
    const out = $('resultado-ia');
    const leido = leerRespuestaIA($('respuesta').value);
    if (!leido.ok) { out.innerHTML = `<div class="aviso alerta">${esc(leido.error)}</div>`; return; }
    const c = aplicarCambios(E.plan, leido.cambios, indice);
    const v = validarPlan(c.plan, { derivados: D(), respuestas: R(), indice, hoy: hoy() });
    out.innerHTML = `${c.aplicados.length ? `<div class="aviso bien"><strong>${v.ok ? 'Se pueden aplicar' : 'Lo que propone'}:</strong><ul>${c.aplicados.map(x => `<li>${esc(x.motivo || x.tipo)}</li>`).join('')}</ul></div>` : ''}
      ${c.rechazados.length ? `<div class="aviso ojo"><strong>Descartados:</strong><ul>${c.rechazados.map(x => `<li>${esc(x.motivo)}</li>`).join('')}</ul></div>` : ''}
      ${v.errores.length ? `<div class="aviso alerta"><strong>No pasa las reglas de la app:</strong><ul>${v.errores.map(x => `<li>${esc(x.mensaje)}</li>`).join('')}</ul></div>` : ''}
      ${v.ok && c.aplicados.length ? '<button type="button" class="boton primario" id="aplicar-ia">Aplicar a mi plan</button>' : ''}`;
    $('aplicar-ia')?.addEventListener('click', async () => { await cambiarPlan({ ...c.plan, generado_por: 'ia_externa' }, `${c.aplicados.length} cambio(s) de tu IA aplicados.`, nube); ir('semana'); });
  };
  $('importar').onclick = () => {
    const imp = leerPlanTexto($('plan-texto').value, indice);
    const out = $('resultado-importar');
    if (!imp.dias.length) { out.innerHTML = '<div class="aviso alerta">No encontré ejercicios. Cada ejercicio necesita series × repeticiones, por ejemplo "Sentadilla 4x8".</div>'; return; }
    const lunes = (() => { const d = new Date(hoy() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7)); return d.toISOString().slice(0, 10); })();
    const plan = calendarizar(imp, { inicio: lunes, semanas: Number($('plan-semanas').value) || 4, noPuedo: R().dias_no_puedo || [], indice });
    const v = validarPlan(plan, { derivados: D(), respuestas: R(), indice, hoy: hoy() });
    out.innerHTML = `<p class="pequeno">Desde el ${esc(fechaCorta(lunes))}:</p>
      <ul class="pequeno">${imp.dias.map(d => `<li><strong>${esc(d.titulo)}</strong>: ${d.ejercicios.map(e => e.ejercicio_id ? esc(indice.porId.get(e.ejercicio_id).nombre) : `<span class="chip descartado">¿${esc(e.nombre)}?</span>`).join(', ')}</li>`).join('')}</ul>
      ${imp.revisar.length ? `<div class="aviso ojo">No reconocí ${imp.revisar.length} ejercicio(s). Escríbelos de otra forma o pregúntale al coach; mientras, quedan fuera.</div>` : ''}
      ${v.errores.length ? `<div class="aviso alerta">${esc(v.errores.map(e => e.mensaje).join(' '))}</div>` : ''}
      ${v.ok ? '<button type="button" class="boton primario" id="aplicar-importado">Usar este plan</button>' : ''}`;
    $('aplicar-importado')?.addEventListener('click', async () => { await cambiarPlan(plan, 'Plan importado y agendado.', nube); ir('semana'); });
  };
  $('descargar-respaldo').onclick = async () => {
    const nombre = `entreno-respaldo-${hoy()}.json`;
    const archivo = new File([JSON.stringify(respaldo())], nombre, { type: 'application/json' });
    // En el teléfono, compartir deja guardarlo en Archivos, Drive o mandarlo por correo; en el computador, se descarga.
    if (navigator.canShare?.({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], title: 'Respaldo de Entreno' }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(archivo);
    $('estado-respaldo').innerHTML = `<a class="enlace" href="${url}" download="${nombre}">Guardar ${esc(nombre)}</a>`;
  };
  $('archivo-respaldo').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    const out = $('estado-respaldo');
    let r;
    try { r = JSON.parse(await f.text()); restaurarValido(r); }
    catch (e) { out.innerHTML = `<div class="aviso alerta">${esc(e.message.startsWith('Ese archivo') ? e.message : 'No pude leer ese archivo. Elige un respaldo descargado desde esta app.')}</div>`; return; }
    out.innerHTML = `<div class="aviso ojo">Respaldo del ${esc(fechaCorta(r.creado.slice(0, 10)))}. Reemplaza todo lo que hay ahora en este teléfono.</div>
      <div class="fila-botones"><button type="button" class="boton primario" id="confirmar-respaldo">Restaurar</button></div>`;
    $('confirmar-respaldo').onclick = () => { restaurar(r); E.mensaje = 'Respaldo restaurado.'; guardar(); ir(E.plan ? 'hoy' : 'inicio'); };
  };
  $('rehacer').onclick = () => armarPlan();
  $('cuestionario').onclick = () => { E.seccion = 0; ir('cuestionario'); };
  $('borrar-local').onclick = ev => {
    const b = ev.currentTarget;
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'Toca de nuevo para borrar todo de este teléfono'; return; }
    reiniciar(); ir('inicio');
  };
}

function recordatoriosHtml() {
  const s = soporte(), c = configAvisos();
  const activos = c.activos && s.permiso === 'granted';
  const puede = s.hay && !(s.ios && !s.instalada) && s.permiso !== 'denied';
  const estado = s.ios && !s.instalada ? '<div class="aviso ojo">En iPhone, los avisos solo funcionan con la app instalada en la pantalla de inicio: en Safari, botón Compartir y "Agregar a pantalla de inicio". Después ábrela desde su ícono y actívalos aquí.</div>'
    : !s.hay ? '<div class="aviso ojo">Este navegador no permite avisos. Usa el calendario, más abajo.</div>'
      : s.permiso === 'denied' ? `<div class="aviso ojo">Los avisos están bloqueados. ${s.ios ? 'Actívalos en Ajustes → Notificaciones → Entreno B.' : 'Actívalos en los permisos del sitio (el ícono junto a la dirección) o en los ajustes de la app.'}</div>`
        : activos ? '<div class="aviso bien">Avisos activos en este teléfono.</div>' : '';
  return `<h3>Recordatorios</h3>
    <p class="pequeno">Te avisa de la sesión del día y de tus suplementos a su hora.</p>
    ${estado}
    <div class="opciones-aviso">
      <div class="opcion"><input type="checkbox" id="av-entrenar"${chk(c.entrenar)}><div><label for="av-entrenar">La sesión del día</label>
        <p class="pequeno suave">1 hora antes si la sesión tiene hora; si no, a las <input type="time" id="av-hora" value="${esc(c.horaEntreno)}" aria-label="Hora del aviso de la sesión"></p></div></div>
      <div class="opcion"><input type="checkbox" id="av-sup"${chk(c.suplementos)}><div><label for="av-sup">Suplementos</label>
        <p class="pequeno suave">A la hora de cada uno${E.suplementos.length ? '' : ' (se agregan en Progreso)'}.</p></div></div>
    </div>
    ${puede || activos ? `<div class="fila-botones">${activos ? '<button type="button" class="boton" id="av-probar">Probar un aviso</button><button type="button" class="boton" id="av-apagar">Apagar avisos</button>' : '<button type="button" class="boton primario" id="av-activar">Activar avisos</button>'}</div>` : ''}
    <p class="pequeno suave">Ojo: sin un servidor, el teléfono no puede abrir la app a una hora fija. Estos avisos llegan solo con la app abierta (en Android, también un rato después de cerrarla). Para que suenen siempre, aunque la app esté cerrada, agrégalos a tu calendario. Si cambias el plan o los suplementos, vuelve a agregarlos.</p>
    ${E.plan?.dias ? `<div class="fila-botones">${enlaceCalendario()}</div>${s.ios ? '' : '<p class="pequeno suave">En Android, si tu calendario no abre el archivo, impórtalo en calendar.google.com → Configuración → Importar.</p>'}` : ''}
    <p class="pequeno" id="av-estado"></p>`;
}

function enlazarRecordatorios() {
  const repintar = () => { $('recordatorios').innerHTML = recordatoriosHtml(); enlazarRecordatorios(); };
  $('av-entrenar').onchange = e => { cambiarAvisos({ entrenar: e.target.checked }); repintar(); };
  $('av-sup').onchange = e => { cambiarAvisos({ suplementos: e.target.checked }); repintar(); };
  $('av-hora').onchange = e => { if (e.target.value) { cambiarAvisos({ horaEntreno: e.target.value }); repintar(); } };
  $('av-activar')?.addEventListener('click', async () => {
    const permiso = await activarAvisos();
    repintar();
    if (permiso === 'granted') notificar('Avisos activos', 'Así te va a avisar Entreno.', 'prueba').catch(() => {});
    else $('av-estado').textContent = 'No se activaron: el teléfono no dio permiso.';
  });
  $('av-probar')?.addEventListener('click', () => notificar('Entreno', 'Así se ven tus avisos.', 'prueba').catch(e => { $('av-estado').textContent = `No se pudo mostrar el aviso: ${e.message}`; }));
  $('av-apagar')?.addEventListener('click', () => { cambiarAvisos({ activos: false }); repintar(); });
}

/** Ya abierta como app instalada (no en una pestaña del navegador). */
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** Revisa que un archivo sea un respaldo antes de ofrecer restaurarlo (restaurar() vuelve a revisar). */
function restaurarValido(r) {
  if (r?.app !== 'entreno' || !r.estado || typeof r.estado !== 'object' || !r.creado) throw new Error('Ese archivo no es un respaldo de Entreno.');
}

function cuentaHtml() {
  if (!nube.hay()) return '<h3>Versión de prueba</h3><p class="pequeno">Todo lo que anotas queda guardado solo en este teléfono. Las cuentas, la sincronización y la IA del coach llegan con la beta.</p>';
  if (nube.conectado()) return `<h3>Cuenta</h3><p>Entraste como <strong>${esc(nube.correo())}</strong>. Tu plan, tus registros y tus fotos quedan en tu cuenta.</p>
    <div class="fila-botones"><button type="button" class="boton" id="descargar">Descargar mis datos</button><button type="button" class="boton" id="salir">Salir</button></div>
    <div class="fila-botones"><button type="button" class="boton" id="borrar-cuenta">Borrar mi cuenta</button></div><div id="datos-descargados"></div>`;
  return `<h3>Entrar</h3><p class="pequeno">Con una cuenta, tu plan y tus registros quedan guardados y el coach puede usar IA. Te mandamos un código y un enlace al correo; no hay contraseña.</p>
    <form id="form-correo" class="fila-chat"><input type="email" id="correo" required placeholder="tu@correo.cl" autocomplete="email" aria-label="Correo"><button type="submit" class="boton primario">Mandar código</button></form>
    <form id="form-codigo" class="fila-chat" hidden><input type="text" id="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Código de 6 dígitos" aria-label="Código"><button type="submit" class="boton primario">Entrar</button></form>
    <p class="pequeno" id="estado-cuenta"></p>`;
}

function enlazarCuenta(ir, sincronizarAlEntrar) {
  $('form-correo')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    try { await nube.pedirCodigo($('correo').value.trim()); $('form-codigo').hidden = false; $('estado-cuenta').textContent = 'Te mandamos un correo. Escribe aquí el código, o toca el enlace del correo desde este mismo teléfono.'; $('codigo').focus(); }
    catch (e) { $('estado-cuenta').textContent = `No se pudo mandar el código: ${e.message}`; }
  });
  $('form-codigo')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    try { await nube.verificarCodigo($('correo').value.trim(), $('codigo').value); await sincronizarAlEntrar(); E.mensaje = `Entraste como ${nube.correo()}.`; guardar(); ir('hoy'); }
    catch (e) { $('estado-cuenta').textContent = `El código no funcionó: ${e.message}`; }
  });
  $('salir')?.addEventListener('click', async () => { await nube.salir(); E.mensaje = 'Saliste de tu cuenta. Lo de este teléfono sigue aquí.'; guardar(); ir('mas'); });
  $('descargar')?.addEventListener('click', async () => {
    const d = await nube.descargarDatos();
    const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' }));
    $('datos-descargados').innerHTML = `<a class="enlace" href="${url}" download="mis-datos-entreno.json">Guardar el archivo con tus datos</a>`;
  });
  $('borrar-cuenta')?.addEventListener('click', async ev => {
    const b = ev.currentTarget;
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'Toca de nuevo: se borra tu cuenta y todo lo guardado en ella'; return; }
    await nube.borrarCuenta(); E.mensaje = 'Tu cuenta y sus datos fueron borrados.'; guardar(); ir('mas');
  });
}
