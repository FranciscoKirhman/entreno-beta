import { validarRespaldo } from '../nucleo/respaldo.js';
// Vista Más: cuenta, ajustar con tu IA (copiar y pegar o conexión directa), importar un plan escrito y reiniciar.
import { E, guardar, reiniciar, empezarDeNuevo, R, D, esc, $, indice, hoy, cambiarPlan, fechaCorta, respaldo, restaurar, chk, mostrarMensaje, unidadPeso, modoEjemplo, activarCuenta, resumenLocal, traerPerfilLocal, cuentaRecuperada, cuentaVaciaParaTraslado, avisar } from './comun.js';
import { esExportacionHevy, importarParaTelefono } from '../nucleo/hevy-csv.js';
import { claveHevy, ultimaHevy, guardarClaveHevy, sincronizarHevy } from './hevy-auto.js';
import { soporte, configAvisos, cambiarAvisos, activarAvisos, notificar, enlaceCalendario } from './avisos.js';
import { CONFIG } from './config.js';
import { conexionIAHtml, enlazarConexionIA } from './conexion-ia.js';
import { iaCopiarHtml, enlazarIACopiar } from './ia-copiar.js';
import { validarPlan } from '../nucleo/validador.js';
import { leerPlanTexto, calendarizar, planATexto } from '../nucleo/importar-plan.js';
import { semanaDe } from '../nucleo/ciclos.js';
import { listarFotosLocales, guardarFotoLocal, restaurarFotosAtomicas } from './fotos-local.js';
import { historialDeEjemplo } from '../nucleo/historial-ejemplo.js';
import * as nube from './nube.js';
import { pintarProveedores } from './cuenta-ui.js';
import { encendidaDisponible, actualizarPantalla } from './pantalla.js';
import { estadoVistaMas, organizarMas } from './mas-paneles.js';
import { conexionFuturaHtml, enlazarConexionesFuturas } from './conexiones-futuras.js';

/** Tema elegido en este teléfono: 'auto' (como el teléfono), 'claro' u 'oscuro'. index.html lo aplica al abrir. */
function temaElegido() {
  try { const t = localStorage.getItem('entreno-tema'); return t === 'claro' || t === 'oscuro' ? t : 'auto'; } catch { return 'auto'; }
}
function elegirTema(t) {
  try { if (t === 'auto') localStorage.removeItem('entreno-tema'); else localStorage.setItem('entreno-tema', t); } catch { /* sin almacenamiento: vale solo hasta cerrar */ }
  if (t === 'auto') delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = t;
}

/** Versión de prueba: volver a hacer el cuestionario y el historial de ejemplo. */
function pruebaHtml() {
  const hay = E.sesiones.some(x => x.origen === 'ejemplo');
  return `<section class="tarjeta destacada" data-mas-panel="prueba">
    <h3>Versión de prueba</h3>
    <p class="pequeno suave">Tus respuestas y registros se conservan al abrir. Puedes revisar el cuestionario sin borrar tu historial.${hay ? ' El historial de Progreso es de ejemplo: inventado, para probar.' : ''}</p>
    <div class="fila-botones"><button type="button" class="boton primario" id="prueba-de-nuevo">Hacer el cuestionario de nuevo</button>
      <button type="button" class="boton" id="prueba-ejemplo" ${modoEjemplo ? '' : 'disabled'}>${hay ? 'Quitar el historial de ejemplo' : 'Cargar historial de ejemplo'}</button></div>
  </section>`;
}

export function vistaMas(ir, { armarPlan, sincronizarAlEntrar, panel = null }) {
  const estadoMas = estadoVistaMas();
  $('app').innerHTML = `<div id="vista-mas">
    <h1>Más</h1>
    <section class="tarjeta" data-mas-panel="banco"><h3>Banco de ejercicios</h3><p class="pequeno suave">Busca por nombre, músculo o equipo, revisa la técnica y agrega ejercicios a hoy.</p><button type="button" class="boton" id="abrir-banco">Explorar ejercicios</button></section>
    ${CONFIG.modoPrueba ? pruebaHtml() : ''}
    ${E.tableroOrigen?.datos ? '<section class="tarjeta"><h3>Tu tablero original</h3><p class="pequeno suave">Consulta el calendario, las series y las indicaciones de tu copia del tablero.</p><button type="button" class="boton" id="ver-tablero-original">Abrir tablero original</button></section>' : ''}
    <section class="tarjeta" id="cuenta">${cuentaHtml()}</section>
    ${instalada() ? '' : `<section class="tarjeta" data-mas-panel="instalar"><h3>Instalarla en el teléfono</h3>
      <p class="pequeno"><strong>iPhone:</strong> en Safari, botón Compartir y "Agregar a pantalla de inicio".<br><strong>Android:</strong> en Chrome, menú ⋮ e "Instalar app".<br>Queda con su ícono y abre sin señal en el gimnasio.</p></section>`}

    <section class="tarjeta" id="recordatorios">${recordatoriosHtml()}</section>

    <section class="tarjeta" data-mas-panel="pantalla">
      <h3>Unidades</h3>
      <div class="fila-unidad"><span>Peso</span><div class="segmentos" role="group" aria-label="Unidad de peso">${['kg', 'lb'].map(u => `<button type="button" data-unidad="${u}" aria-pressed="${unidadPeso() === u}">${u}</button>`).join('')}</div></div>
      <p class="pequeno suave">Todo se guarda en kilos; en libras se muestra redondeado a media libra. Distancia y medidas del cuerpo se suman cuando la app las registre.</p>
      <div class="fila-unidad"><span>Esfuerzo</span><div class="segmentos" role="group" aria-label="Cómo anotar el esfuerzo de cada serie">${[['rpe', 'RPE'], ['rir', 'RIR']].map(([v, t]) => `<button type="button" data-escala-esfuerzo="${v}" aria-pressed="${(R().escala_esfuerzo === 'rir' ? 'rir' : 'rpe') === v}">${t}</button>`).join('')}</div></div>
      <p class="pequeno suave">RPE va de 6 a 10, con medios: 8,5 es que quizás salían 2 más. RIR cuenta las repeticiones que quedaban: 2 es que salían 2 más. Se guardan los dos, así puedes cambiar cuando quieras.</p>
    </section>

    <section class="tarjeta" id="pantalla">
      <h3>Pantalla</h3>
      <div class="fila-unidad"><span>Tema</span><div class="segmentos" role="group" aria-label="Tema">${[['auto', 'Auto'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([v, t]) => `<button type="button" data-elegir-tema="${v}" aria-pressed="${temaElegido() === v}">${t}</button>`).join('')}</div></div>
      <label class="pequeno casilla"><input type="checkbox" id="pantalla-encendida"${chk(E.pantallaEncendida !== false)}> Mantener la pantalla encendida mientras entrenas</label>
      <p class="pequeno suave">Auto sigue al teléfono. La pantalla queda encendida desde la primera serie marcada hasta guardar la sesión${encendidaDisponible() ? '' : ' (este navegador no lo permite)'}.</p>
    </section>

    <section class="tarjeta" id="conexiones">${conexionesHtml()}</section>

    <section class="tarjeta" data-mas-panel="respaldo">
      <h3>Respaldo</h3>
      <p class="pequeno">Descarga un respaldo para conservar una copia de lo anotado en este teléfono. Las series todavía en curso y las fotos locales pueden no estar en la cuenta.</p>
      ${E.consentimientos.fotos_progreso ? '<label class="pequeno casilla"><input type="checkbox" id="respaldo-fotos" checked> Incluir mis fotos de progreso (el archivo pesa más)</label>' : ''}
      <div class="fila-botones"><button type="button" class="boton" id="descargar-respaldo">Descargar respaldo</button>
        <label class="boton">Restaurar un respaldo<input type="file" id="archivo-respaldo" accept="application/json,.json" hidden></label></div>
      <div id="estado-respaldo"></div>
    </section>

    <section class="tarjeta" id="tu-ia">${iaCopiarHtml()}</section>

    <section class="tarjeta" id="conectar-ia">${conexionIAHtml()}</section>

    <section class="tarjeta" data-mas-panel="importar">
      <h3>Importar un plan que ya tengo</h3>
      <p class="pequeno">Pega el plan que te dio tu entrenador o que tienes anotado. Una línea por ejercicio, con series × repeticiones. Los días se marcan con "Lunes", "Día 1", etc.</p>
      <textarea id="plan-texto" aria-label="Plan para importar" rows="8" placeholder="Lunes: Pierna&#10;Sentadilla 4x8 80kg&#10;Hip thrust 3x10 a 12 RIR 2&#10;&#10;Miércoles: Torso&#10;Press banca 4x6 a 8&#10;Jalón al pecho 3x10"></textarea>
      <label class="pequeno">Semanas a agendar <input type="number" id="plan-semanas" min="1" max="12" value="4"></label>
      <div class="fila-botones"><button type="button" class="boton" id="importar">Revisar</button></div>
      <div id="resultado-importar"></div>
    </section>

    <section class="tarjeta" data-mas-panel="plan">
      <h3>Tu plan</h3>
      <div class="fila-botones"><button type="button" class="boton primario" id="perfil">Completar mi perfil</button><button type="button" class="boton" id="ver-plan">Ver mi plan explicado</button></div>
      <div class="fila-botones"><button type="button" class="boton" id="rehacer">Rehacer el plan con mis respuestas</button>${E.plan?.dias?.length && !E.plan.bloqueado ? '<button type="button" class="boton" id="compartir-plan">Compartir mi plan</button>' : ''}</div>
      <div id="plan-compartido"></div>
      <div class="fila-botones"><button type="button" class="boton" id="borrar-local">Borrar todo de este teléfono</button></div>
    </section>
    <p class="pequeno suave">Versión ${esc(CONFIG.version)}</p>
  </div>`;
  enlazarCuenta(ir, sincronizarAlEntrar);
  $('ver-tablero-original')?.addEventListener('click', () => ir('tablero-original'));
  $('prueba-de-nuevo')?.addEventListener('click', () => { empezarDeNuevo(); ir('cuestionario'); });
  $('prueba-ejemplo')?.addEventListener('click', () => {
    if (!modoEjemplo) return;
    const hay = E.sesiones.some(x => x.origen === 'ejemplo');
    E.sesiones = hay ? E.sesiones.filter(x => x.origen !== 'ejemplo') : [...E.sesiones, ...historialDeEjemplo(hoy(), indice)];
    E.sinEjemplo = hay;
    E.mensaje = hay ? 'Saqué el historial de ejemplo.' : 'Cargué 8 semanas de historial de ejemplo.';
    guardar();
    vistaMas(ir, { armarPlan, sincronizarAlEntrar });
  });
  enlazarRecordatorios();
  document.querySelectorAll('[data-escala-esfuerzo]').forEach(b => b.onclick = () => { R().escala_esfuerzo = b.dataset.escalaEsfuerzo; E.mensaje = `Esfuerzo en ${b.dataset.escalaEsfuerzo === 'rir' ? 'RIR (repeticiones en reserva)' : 'RPE (de 6 a 10)'}.`; guardar(); vistaMas(ir, { armarPlan, sincronizarAlEntrar }); }, ir);
  document.querySelectorAll('[data-unidad]').forEach(b => b.onclick = () => { R().unidad = b.dataset.unidad; E.mensaje = `Peso en ${b.dataset.unidad === 'lb' ? 'libras' : 'kilos'}.`; guardar(); vistaMas(ir, { armarPlan, sincronizarAlEntrar }); }, ir);
  enlazarConexiones(() => vistaMas(ir, { armarPlan, sincronizarAlEntrar }));
  // data-elegir-tema y no data-tema: <html data-tema> es el que pinta el tema.
  document.querySelectorAll('[data-elegir-tema]').forEach(b => b.onclick = () => {
    elegirTema(b.dataset.elegirTema);
    document.querySelectorAll('[data-elegir-tema]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  $('pantalla-encendida').onchange = ev => { E.pantallaEncendida = ev.target.checked; guardar(); actualizarPantalla(); };
  enlazarIACopiar(ir);
  enlazarConexionIA(async () => { await sincronizarAlEntrar({ forzar: true }); vistaMas(ir, { armarPlan, sincronizarAlEntrar }); }, ir);
  // Compartir el plan como texto (como las rutinas de Hevy): la otra persona lo pega en "Importar un plan".
  $('compartir-plan')?.addEventListener('click', async () => {
    const texto = planATexto(E.plan, { semana: semanaDe(E.plan, hoy()) || 1 });
    try { if (navigator.share) { await navigator.share({ title: 'Mi plan de Entreno', text: texto }); return; } } catch { return; }
    $('plan-compartido').innerHTML = `<pre class="prompt" id="texto-plan">${esc(texto)}</pre><p class="pequeno" id="plan-copiado"></p>`;
    try { await navigator.clipboard.writeText(texto); $('plan-copiado').textContent = 'Copiado. Mándalo a quien quieras: lo pega en Más, Importar un plan que ya tengo.'; }
    catch { $('plan-copiado').textContent = 'Selecciona el texto y cópialo.'; }
  });
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
  $('descargar-respaldo').onclick = async ev => {
    const boton = ev.currentTarget, estado = $('estado-respaldo');
    const nombre = `entreno-respaldo-${hoy()}.json`;
    let fotos = [];
    if ($('respaldo-fotos')?.checked) {
      boton.disabled = true; estado.innerHTML = '<p class="pequeno">Preparando las fotos…</p>';
      try { fotos = await fotosParaRespaldo(); }
      catch (e) { estado.innerHTML = `<div class="aviso alerta">No pude leer las fotos (${esc(e.message)}). Desmarca "Incluir mis fotos" para descargar el resto.</div>`; boton.disabled = false; return; }
      finally { boton.disabled = false; }
    }
    const texto = JSON.stringify(respaldo(fotos));
    estado.innerHTML = `<p class="pequeno">Respaldo listo: ${esc(megas(texto.length))}${fotos.length ? `, con ${fotos.length} foto${fotos.length === 1 ? '' : 's'}` : ''}.</p>`;
    const archivo = new File([texto], nombre, { type: 'application/json' });
    // En el teléfono, compartir deja guardarlo en Archivos, Drive o mandarlo por correo; en el computador, se descarga.
    if (navigator.canShare?.({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], title: 'Respaldo de Entreno' }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(archivo);
    estado.insertAdjacentHTML('beforeend', `<a class="enlace" href="${url}" download="${nombre}">Guardar ${esc(nombre)}</a>`);
  };
  $('archivo-respaldo').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    const out = $('estado-respaldo');
    let r;
    if (f.size > 100000000) { out.innerHTML = '<div class="aviso alerta">Ese respaldo supera los 100 MB. No cambié tus datos. Usa un respaldo sin fotos y conserva las imágenes por separado.</div>'; return; }
    try { r = JSON.parse(await f.text()); restaurarValido(r); }
    catch (e) { out.innerHTML = `<div class="aviso alerta">${esc(e.message.startsWith('Ese archivo') ? e.message : 'No pude leer ese archivo. Elige un respaldo descargado desde esta app.')}</div>`; return; }
    if (nube.conectado() || modoEjemplo) { out.innerHTML = '<div class="aviso alerta">Para restaurar tus datos personales, vuelve a tu perfil local y sal de tu cuenta. El respaldo no se envía al servidor.</div>'; return; }
    let anterior;
    try { anterior = respaldo(await fotosParaRespaldo()); }
    catch { out.innerHTML = '<div class="aviso alerta">No pude preparar la copia anterior con tus fotos. No cambié tus datos.</div>'; return; }
    const urlAnterior = URL.createObjectURL(new Blob([JSON.stringify(anterior)], { type: 'application/json' }));
    const nFotos = r.fotos?.length || 0;
    out.innerHTML = `<div class="aviso ojo">Respaldo del ${esc(fechaCorta(r.creado.slice(0, 10)))}. Reemplaza tu perfil y registros, y suma ${nFotos} fotos. Primero guarda tu copia anterior.</div>
      <a class="boton" id="copia-anterior" href="${urlAnterior}" download="entreno-antes-restaurar.json">Descargar copia anterior</a>
      <button type="button" class="boton primario" id="confirmar-respaldo" disabled>Restaurar</button>`;
    $('copia-anterior').onclick = () => { $('confirmar-respaldo').disabled = false; };
    $('confirmar-respaldo').onclick = async ev => {
      ev.currentTarget.disabled = true;
      let estadoCambiado = false;
      try {
        const fotos = await Promise.all((r.fotos || []).map(async f => ({ id: f.id, fecha: f.fecha, angulo: f.angulo, blob: await (async () => { const blob = await (await fetch(f.datos)).blob(); const imagen = await createImageBitmap(blob); imagen.close(); return blob; })() })));
        await restaurarFotosAtomicas(fotos, () => { restaurar(r); estadoCambiado = true; });
        E.mensaje = `Respaldo restaurado, con ${fotos.length} fotos.`;
        guardar(); ir(E.plan ? 'hoy' : 'inicio');
        URL.revokeObjectURL(urlAnterior);
      } catch (e) {
        let recuperado = true;
        if (estadoCambiado) { try { restaurar(anterior); } catch { recuperado = false; } }
        out.insertAdjacentHTML('beforeend', `<div class="aviso alerta">No pude completar la restauración. ${recuperado ? 'Conservé tus datos anteriores.' : 'Usa la copia anterior descargada para recuperar tus datos.'} ${esc(e.message)}</div>`);
      }
    };
  };
  $('rehacer').onclick = () => armarPlan();
  $('perfil').onclick = () => ir('perfil');
  $('abrir-banco').onclick = () => ir('banco', { desde: 'mas' });
  $('ver-plan').onclick = () => ir(E.plan ? 'plan' : 'perfil');
  $('borrar-local').onclick = ev => {
    const b = ev.currentTarget;
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'Toca de nuevo para borrar todo de este teléfono'; return; }
    reiniciar(); ir('inicio');
  };
  organizarMas({ estado: estadoMas });
  if (panel) $('vista-mas')?.dispatchEvent(new CustomEvent('abrir-ajuste-mas', { detail: panel }));
  mostrarMensaje();
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

const megas = bytes => (bytes < 1e5 ? `${Math.max(1, Math.round(bytes / 1e3))} KB` : `${(bytes / 1e6).toFixed(1).replace('.', ',')} MB`);
const aDataUrl = blob => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => mal(r.error); r.readAsDataURL(blob); });

/** Fotos de progreso para el respaldo: las de este teléfono o, con cuenta, las de la cuenta. */
async function fotosParaRespaldo() {
  const lista = nube.conectado() ? await nube.listarFotos() : await listarFotosLocales();
  const out = [];
  for (const f of lista) {
    const blob = f.blob || await fetch(f.url).then(x => { if (!x.ok) throw new Error(`foto del ${f.fecha}: ${x.status}`); return x.blob(); });
    out.push({ id: String(f.id), fecha: f.fecha, angulo: f.angulo || null, datos: await aDataUrl(blob) });
  }
  return out;
}

/** Guarda una foto del respaldo (en este teléfono o, con cuenta, en la cuenta). Solo acepta imágenes. */
async function restaurarFoto(f) {
  if (typeof f?.datos !== 'string' || !/^data:image\/(jpeg|png|webp|heic|heif|gif);base64,/.test(f.datos) || !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha || '')) return false;
  const blob = await (await fetch(f.datos)).blob();
  const archivo = new File([blob], `${f.fecha}.${blob.type.split('/')[1].replace('jpeg', 'jpg')}`, { type: blob.type });
  if (nube.conectado()) await nube.subirFoto({ fecha: f.fecha, angulo: f.angulo, archivo });
  else await guardarFotoLocal({ id: f.id, fecha: f.fecha, angulo: f.angulo, archivo }); // mismo id: restaurar dos veces no duplica
  return true;
}

// ── Conexiones con otras apps ───────────────────────────────────────────────
const ICONOS = {
  hevy: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  ia: '<path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  strava: '<path d="M3.5 18.5l5-9 4 6 3-4.5 5 7.5"/>',
  salud: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"/>',
};
const icono = n => `<span class="icono-app" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONOS[n]}</svg></span>`;

function conexionesHtml() {
  const importadas = E.sesiones.filter(s => s.origen === 'hevy');
  const ultima = importadas.map(s => s.fecha).sort().at(-1);
  return `<h3>Conexiones</h3>
    <ul class="conexiones">
      <li>
        <div class="cab-conexion">${icono('hevy')}<strong>Hevy</strong><label class="accion-conexion">Importar<input type="file" id="archivo-hevy" accept=".csv,text/csv" hidden></label></div>
        <p class="pequeno suave">Trae tu historial de Hevy: la app lo usa para "la vez anterior" y para partir el plan con tus pesos reales. En Hevy: Perfil → Ajustes → Exportar e importar datos → Exportar entrenamientos; guarda el archivo y elígelo aquí.</p>
        ${importadas.length ? `<p class="pequeno">Importadas: ${importadas.length} ${importadas.length === 1 ? 'sesión' : 'sesiones'} (la última, ${esc(fechaCorta(ultima))}). <button type="button" class="enlace" id="quitar-hevy">Quitar lo importado</button></p>` : ''}
        <details class="extra"${claveHevy() ? ' open' : ''}><summary>Con Hevy Pro, que entren solas</summary>
          <p class="pequeno suave">Con la clave de la API de Hevy (en Hevy: Ajustes, Desarrollador), al abrir la app se traen tus entrenamientos nuevos, sin exportar el archivo. La clave queda solo en este teléfono: no va en el respaldo ni a tu cuenta.</p>
          ${claveHevy() ? `<p class="pequeno">Clave guardada.${ultimaHevy() ? ` Última revisión: ${esc(new Date(ultimaHevy()).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}.` : ''}</p>
            <div class="fila-botones"><button type="button" class="boton" id="hevy-traer">Traer ahora</button><button type="button" class="enlace" id="hevy-quitar-clave">Quitar la clave</button></div>`
          : `<form id="form-hevy-clave" class="fila-chat"><input type="password" id="hevy-clave" autocomplete="off" placeholder="Clave de la API de Hevy" aria-label="Clave de la API de Hevy" required><button type="submit" class="boton primario">Guardar y traer</button></form>`}
        </details>
        <div id="estado-hevy"></div>
      </li>
      <li>
        <div class="cab-conexion">${icono('ia')}<strong>ChatGPT y Claude</strong><a class="accion-conexion" href="#tu-ia">Usar ahora</a></div>
        <p class="pequeno suave">Tu IA arma o ajusta el plan y la app lo revisa con sus reglas antes de guardarlo. Copiando y pegando funciona sin cuenta; la conexión directa con ChatGPT requiere una cuenta.</p>
      </li>
      ${conexionFuturaHtml('strava', icono('strava'))}
      ${conexionFuturaHtml('salud-apple', icono('salud'))}
      ${conexionFuturaHtml('health-connect', icono('salud'))}
    </ul>`;
}

function enlazarConexiones(repintar) {
  enlazarConexionesFuturas($('conexiones'));
  $('archivo-hevy').onchange = async ev => {
    const archivo = ev.target.files[0];
    if (!archivo) return;
    const out = $('estado-hevy');
    const texto = await archivo.text();
    if (!esExportacionHevy(texto)) { out.innerHTML = '<div class="aviso alerta">Ese archivo no es la exportación de entrenamientos de Hevy (workout_data.csv).</div>'; return; }
    let r;
    try { r = importarParaTelefono(texto, indice, E.sesiones); }
    catch (e) { out.innerHTML = `<div class="aviso alerta">No pude leer el archivo: ${esc(e.message)}</div>`; return; }
    E.sesiones.push(...r.nuevas);
    E.sesiones.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    E.mensaje = r.nuevas.length ? `Importé ${r.nuevas.length} ${r.nuevas.length === 1 ? 'sesión' : 'sesiones'} de Hevy${r.total > r.nuevas.length ? ` (las otras ${r.total - r.nuevas.length} ya estaban)` : ''}.` : 'Esas sesiones ya estaban importadas.';
    if (r.sinCatalogo.length) E.mensaje += ` ${r.sinCatalogo.length} ejercicio${r.sinCatalogo.length === 1 ? '' : 's'} no calza${r.sinCatalogo.length === 1 ? '' : 'n'} con el catálogo y no cuenta${r.sinCatalogo.length === 1 ? '' : 'n'} para "la vez anterior": ${r.sinCatalogo.slice(0, 4).join(', ')}${r.sinCatalogo.length > 4 ? '…' : ''}.`;
    guardar(); repintar();
  };
  // Hevy por la API: guardar la clave, traer ahora o quitarla.
  const traer = async (boton, { nueva = false } = {}) => {
    const out = $('estado-hevy');
    if (boton) boton.disabled = true;
    out.innerHTML = '<p class="pequeno suave" role="status">Trayendo de Hevy…</p>';
    try {
      const r = await sincronizarHevy();
      E.mensaje = r.nuevas.length ? `Llegaron ${r.nuevas.length === 1 ? '1 sesión' : `${r.nuevas.length} sesiones`} de Hevy.` : 'No había sesiones nuevas en Hevy.';
      if (r.sinCatalogo.length) E.mensaje += ` ${r.sinCatalogo.length} ejercicio${r.sinCatalogo.length === 1 ? '' : 's'} no calza${r.sinCatalogo.length === 1 ? '' : 'n'} con el catálogo: ${r.sinCatalogo.slice(0, 4).join(', ')}${r.sinCatalogo.length > 4 ? '…' : ''}.`;
      const aviso = E.mensaje; E.mensaje = null;
      guardar(); repintar(); avisar(aviso);
    } catch (e) {
      if (nueva) guardarClaveHevy(null); // una clave que no funcionó no se guarda
      out.innerHTML = `<div class="aviso alerta">${esc(e.message)}</div>`; if (boton) boton.disabled = false;
    }
  };
  $('form-hevy-clave')?.addEventListener('submit', ev => { ev.preventDefault(); guardarClaveHevy($('hevy-clave').value); traer(ev.submitter, { nueva: true }); });
  $('hevy-traer')?.addEventListener('click', ev => traer(ev.currentTarget));
  $('hevy-quitar-clave')?.addEventListener('click', () => { guardarClaveHevy(null); E.mensaje = 'Quité la clave de Hevy. Lo ya traído se queda.'; guardar(); repintar(); });
  $('quitar-hevy')?.addEventListener('click', ev => {
    const b = ev.currentTarget;
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'Toca de nuevo para quitarlo'; return; }
    E.sesiones = E.sesiones.filter(s => s.origen !== 'hevy');
    E.mensaje = 'Quité lo importado de Hevy. Lo anotado en la app sigue igual.';
    guardar(); repintar();
  });
}

/** Ya abierta como app instalada (no en una pestaña del navegador). */
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** Revisa que un archivo sea un respaldo antes de ofrecer restaurarlo (restaurar() vuelve a revisar). */
function restaurarValido(r) {
  validarRespaldo(r, new Set(indice.porId.keys()));
}

function cuentaHtml() {
  if (!nube.hay()) return E.errorAccesoCuenta ? `<h3>Cuenta</h3><p class="aviso alerta" role="alert">${esc(E.errorAccesoCuenta)}</p><p class="pequeno">Vuelve a abrir Entreno para pedir otro acceso. Tu perfil local se conserva.</p>` : '<h3>Versión de prueba</h3><p class="pequeno">Todo lo que anotas queda guardado solo en este teléfono. Las cuentas, la sincronización y la IA del coach llegan con la beta.</p>';
  if (nube.conectado()) return `<h3>Cuenta</h3><p>Entraste como <strong class="correo-cuenta">${esc(nube.correo())}</strong>. Tu plan y tus sesiones guardadas se sincronizan con esta cuenta.</p>
    ${R().demo_privada ? '<p class="pequeno">Demo privada con historial importado. El cuestionario es ficticio y las pruebas de interfaz no son entrenamientos reales.</p>' : ''}
    <p class="pequeno">El historial guardado se recupera en tus otros dispositivos. Las series todavía en curso permanecen en este teléfono hasta guardar la sesión. Las fotos y documentos locales se conservan por separado.</p>
    <button type="button" class="boton" id="sincronizar">Sincronizar ahora</button><p id="estado-sincronizacion" role="status"></p>
    ${cuentaVaciaParaTraslado() && resumenLocal().perfil ? `<div class="aviso ojo"><strong>Tu perfil sigue en este teléfono</strong><p class="pequeno">${cuentaRecuperada(nube.usuarioId()) ? 'La cuenta está vacía. Revisa el traslado y confírmalo para ver tu plan en otros dispositivos.' : 'Primero pulsa Sincronizar ahora para comprobar si la cuenta tiene datos.'} Tu perfil local conserva ${resumenLocal().sesiones} sesiones.</p></div><button type="button" class="boton primario" id="copiar-local" ${cuentaRecuperada(nube.usuarioId()) ? '' : 'disabled'}>Revisar traslado del perfil local</button>` : ''}
    <div class="fila-botones"><button type="button" class="boton" id="descargar">Descargar mis datos</button><button type="button" class="boton" id="salir">Salir</button></div>
    <div class="fila-botones"><button type="button" class="boton" id="borrar-cuenta">Borrar mi cuenta</button></div><div id="datos-descargados"></div>`;
  return `<h3>Entrar</h3><p class="pequeno">Con una cuenta, puedes sincronizar tus sesiones guardadas. El coach usa reglas mientras la IA no esté habilitada. Entra con Google o recibe un acceso por correo, sin contraseña.</p>
    <div class="cuenta-proveedores" data-proveedores></div>
    <form id="form-correo" class="fila-chat"><input type="email" id="correo" required placeholder="tu@correo.cl" autocomplete="email" aria-label="Correo"><button type="submit" class="boton primario">Mandar acceso</button></form>
    <button type="button" class="enlace" id="ya-tengo-codigo">Ya tengo un código</button>
    <form id="form-codigo" class="fila-chat" hidden><input type="text" id="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Código del correo" aria-label="Código"><button type="submit" class="boton primario">Entrar</button></form>
    <p class="${E.errorAccesoCuenta ? 'aviso alerta' : 'pequeno'}" id="estado-cuenta" role="${E.errorAccesoCuenta ? 'alert' : 'status'}">${esc(E.errorAccesoCuenta || '')}</p>`;
}

function enlazarCuenta(ir, sincronizarAlEntrar) {
  pintarProveedores();
  $('ya-tengo-codigo')?.addEventListener('click', () => {
    if (!$('correo').reportValidity()) return;
    $('form-codigo').hidden = false;
    $('codigo').focus();
  });
  $('sincronizar')?.addEventListener('click', async ev => {
    const b = ev.currentTarget, estado = E, usuario = nube.usuarioId(), salida = $('estado-sincronizacion');
    const vigente = () => E === estado && nube.usuarioId() === usuario && $('estado-sincronizacion') === salida;
    b.disabled = true; salida.textContent = 'Sincronizando…';
    const trasladoInicial = $('copiar-local');
    if (trasladoInicial) { trasladoInicial.disabled = true; delete trasladoInicial.dataset.confirmar; trasladoInicial.textContent = 'Revisar traslado del perfil local'; }
    try { const resultado = await sincronizarAlEntrar({ forzar: true }); if (vigente()) {
      salida.textContent = resultado.mensaje;
      const traslado = $('copiar-local');
      if (traslado) traslado.disabled = !resultado.completa || !cuentaRecuperada(usuario) || !cuentaVaciaParaTraslado();
    } }
    catch (e) { if (vigente()) salida.textContent = `No pude sincronizar: ${e.message}. Tus datos del teléfono se conservan.`; }
    finally { if (vigente()) b.disabled = false; }
  });
  $('copiar-local')?.addEventListener('click', async ev => {
    const b = ev.currentTarget;
    if (!cuentaRecuperada(nube.usuarioId()) || !cuentaVaciaParaTraslado()) { delete b.dataset.confirmar; b.textContent = 'Recupera esta cuenta con Sincronizar ahora antes de revisar el traslado.'; return; }
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.dataset.usuario = nube.usuarioId(); b.textContent = `Confirmar traslado a ${nube.correo()}: perfil y ${resumenLocal().sesiones} sesiones, sin fotos ni documentos`; return; }
    if (b.dataset.usuario !== nube.usuarioId()) { delete b.dataset.confirmar; b.textContent = 'La cuenta cambió. Vuelve a revisar el traslado.'; return; }
    let estado = E;
    const usuario = nube.usuarioId(), vigente = () => E === estado && nube.usuarioId() === usuario;
    b.disabled = true;
    try {
      const revision = await sincronizarAlEntrar({ forzar: true });
      if (!vigente()) return;
      if (!revision.completa || !cuentaRecuperada(usuario) || !cuentaVaciaParaTraslado()) {
        delete b.dataset.confirmar;
        E.mensaje = !revision.completa ? revision.mensaje : 'La cuenta ya tiene datos. Se conservan ambas copias y el traslado necesita revisión.';
        guardar(); ir('mas'); return;
      }
      traerPerfilLocal(usuario); estado = E;
      const resultado = await sincronizarAlEntrar();
      if (!vigente()) return;
      E.mensaje = resultado.completa ? 'Perfil enviado a la cuenta. Se conserva la copia local; las fotos y documentos no se trasladaron.' : `El perfil se copió a este teléfono para el traslado. ${resultado.mensaje} Las fotos y documentos no se trasladaron.`;
      guardar(); ir(resultado.completa && E.plan ? 'hoy' : 'mas');
    } catch (e) { if (vigente()) { E.mensaje = `No pude completar el traslado: ${e.message}. La copia local se conserva. Reintenta la sincronización.`; guardar(); ir('mas'); } }
    finally { b.disabled = false; }
  });
  $('form-correo')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const boton = ev.currentTarget.querySelector('button[type="submit"]'), estado = E, usuario = nube.usuarioId(), salida = $('estado-cuenta');
    const vigente = () => E === estado && nube.usuarioId() === usuario && $('estado-cuenta') === salida;
    if (boton.disabled) return;
    boton.disabled = true;
    try { await nube.pedirCodigo($('correo').value.trim()); if (!vigente()) return; delete E.errorAccesoCuenta; guardar(); $('form-codigo').hidden = false; salida.className = 'pequeno'; salida.setAttribute('role', 'status'); salida.textContent = 'Revisa el correo para entrar en este dispositivo. Si trae un código, escríbelo aquí; si trae un enlace, ábrelo en este mismo navegador.'; $('codigo').focus(); }
    catch (e) { if (vigente()) salida.textContent = `No se pudo mandar el acceso: ${e.message}`; }
    finally { boton.disabled = false; }
  });
  $('form-codigo')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const origen = E, salida = $('estado-cuenta');
    try { await nube.verificarCodigo($('correo').value.trim(), $('codigo').value); }
    catch (e) { if (E === origen && $('estado-cuenta') === salida) salida.textContent = `El código no funcionó: ${e.message}`; return; }
    if (E !== origen) return;
    activarCuenta(nube.usuarioId());
    const estado = E, usuario = nube.usuarioId(), vigente = () => E === estado && nube.usuarioId() === usuario;
    try { const resultado = await sincronizarAlEntrar(); if (!vigente()) return; E.mensaje = resultado.completa ? `Entraste como ${nube.correo()}.` : resultado.mensaje; }
    catch (e) { if (!vigente()) return; E.mensaje = `Entraste, pero no pude sincronizar: ${e.message}. Reintenta en Más.`; }
    guardar(); ir(E.plan ? 'hoy' : 'mas', E.plan ? undefined : { panel: 'cuenta' });
  });
  $('salir')?.addEventListener('click', async () => { await nube.salir(); activarCuenta(); E.mensaje = 'Saliste de tu cuenta. Volviste al perfil local. La copia de la cuenta se conserva por separado.'; guardar(); ir('mas'); });
  $('descargar')?.addEventListener('click', async () => {
    const d = await nube.descargarDatos();
    const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' }));
    $('datos-descargados').innerHTML = `<a class="enlace" href="${url}" download="mis-datos-entreno.json">Guardar el archivo con tus datos</a>`;
  });
  $('borrar-cuenta')?.addEventListener('click', async ev => {
    const b = ev.currentTarget;
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'Toca de nuevo: se borra tu cuenta y todo lo guardado en ella'; return; }
    await nube.borrarCuenta(); activarCuenta(); E.mensaje = 'La cuenta del servidor fue borrada. El perfil local se conserva; las copias descargadas no se borran automáticamente.'; guardar(); ir('mas');
  });
}
