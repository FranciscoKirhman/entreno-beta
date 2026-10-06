// App Entreno. Funciona sin cuenta (todo en este navegador) y con cuenta (Supabase). Usa el mismo núcleo
// que el servidor: nucleo/*.js.
//
//   node herramientas/servir.mjs  →  http://127.0.0.1:5173/app/
import { sincronizarDatosTelefono } from './datos-nube.js';
import { hevyAlAbrir } from './hevy-auto.js';
import { conPropios, idsPropios } from '../nucleo/propios.js';
import { C, E, guardar, R, esc, $, hoy, indice, mostrarMensaje, empezarDeNuevo, entrarEjemplo, salirEjemplo, modoEjemplo, errorGuardado, errorRetornoCuenta, activarCuenta, perfilDePrueba, recuperarCopia, claveSesionCuenta, marcarCuentaRecuperada } from './comun.js';
import { prepararSesion, unirSesiones } from '../nucleo/sincronizacion.js';
import { historialDeEjemplo } from '../nucleo/historial-ejemplo.js';
import { derivar } from '../nucleo/derivar.js';
import { generarPlan } from '../nucleo/motor-plan.js';
import { vistaHoy, irAlEjercicioEnCurso } from './hoy.js';
import { vistaFicha } from './ficha.js';
import { vistaDiaPasado } from './dia-pasado.js';
import { vistaSemana } from './semana.js';
import { vistaCoach } from './coach-ui.js';
import { vistaProgreso } from './progreso.js';
import { vistaMas } from './mas.js';
import { pintarPerfilesPrueba, abrirEnlacePerfiles } from './perfiles-prueba-ui.js';
import { vistaTableroOriginal } from './tablero-original.js';
import { vistaBanco } from './banco.js';
import { vistaCheckin } from './checkin.js';
import { historialReciente, fechasEntrenadas } from './temporada.js';
import { vistaRapido, vistaPerfil, vistaSeccion, firmaRespuestas } from './cuestionario.js';
import { vistaPlan } from './plan.js';
import { vistaResumen } from './resumen.js';
import { vistaBienvenida, vistaEleccion, eleccionPendiente } from './inicio.js';
import { progresoNivel } from '../nucleo/nivel.js';
import { programarAvisos } from './avisos.js';
import { actualizarPantalla } from './pantalla.js';
import { dejarPendiente, subirPendientes } from './cola.js';
import * as nube from './nube.js';
import { CONFIG } from './config.js';
import { sinSenalHtml } from './estados-visuales.js';
import { entrarVista, entrarPose, dibujarGraficos } from './movimiento.js';
import { instalarAtras, accionAtras, esVuelta, recordarPantalla, alturaDe, volviendoConGesto } from './atras.js';
import { guardarRetorno } from './comun.js';
import { fechaSesionActiva } from '../nucleo/sesion-activa.js';
import { pantallaGuardada, retornoGuardado } from '../nucleo/retorno-app.js';
import { actualizarChatConfirmado } from './propuesta-chat.js';

// ── Plan y cuenta ───────────────────────────────────────────────────────────
/** Arma (o rehace) el plan con las respuestas y muestra la pantalla "Tu plan". */
async function armarPlan({ mensaje = null } = {}) {
  const estado = E, usuario = nube.usuarioId();
  const r = R();
  // Sin lugar elegido se supone un gimnasio completo, y la pantalla del plan lo dice.
  if (!r.lugares?.length) {
    const x = C.secciones.flatMap(s => s.preguntas).find(q => q.id === 'lugares').presets[0];
    r.lugares = [{ nombre: x.nombre, tipo: x.tipo, equipamiento: [...x.equipamiento], principal: true, preset: x.id, supuesto: true }];
  }
  r.lugares = r.lugares.map((l, i) => ({ ...l, principal: i === 0 }));
  // El nivel sube con lo entrenado: se aplica al rehacer el plan.
  const nv = progresoNivel({ respuestas: r, fechas: fechasEntrenadas(), hoy: hoy() });
  if (nv.sube) { r.nivel_ganado = nv.alcanzado; mensaje = `Subiste a nivel ${nv.alcanzado}. ${mensaje || ''}`.trim(); }
  E.semana = 1; E.mensaje = mensaje; E.paso = 0;
  E.firmaPlan = firmaRespuestas();
  if (nube.conectado()) {
    try {
      await nube.guardarCuestionario(r);
      if (E !== estado || nube.usuarioId() !== usuario) return;
      const res = await nube.generarPlan();
      if (E !== estado || nube.usuarioId() !== usuario) return;
      const plan = await nube.cargarPlan();
      if (E !== estado || nube.usuarioId() !== usuario) return;
      E.plan = plan;
      E.mensaje = [mensaje, ...(res.notas || [])].filter(Boolean).join(' ') || null;
      guardar();
      return ir('plan', { nuevo: true });
    } catch (e) {
      if (E !== estado || nube.usuarioId() !== usuario) return;
      if (e.status === 409) { E.plan = { bloqueado: true, mensaje: e.datos?.mensaje }; guardar(); return ir('hoy'); }
      E.mensaje = `El servidor no respondió (${e.message}); armé el plan en este teléfono.`;
    }
  }
  E.plan = generarPlan({ derivados: derivar(r, C, hoy()), respuestas: r, indice, hoy: hoy(), historial: historialReciente() }); // parte con los pesos ya anotados
  guardar();
  ir(E.plan.bloqueado ? 'hoy' : 'plan', { nuevo: true });
}

/** Al entrar: si la cuenta ya tiene plan, se usa ese; si no, se sube lo de este teléfono. */
async function sincronizarAlEntrar({ forzar = false } = {}) {
  activarCuenta(nube.usuarioId());
  marcarCuentaRecuperada();
  const estadoInicial = E, usuarioInicial = nube.usuarioId();
  const recuperada = await recuperarCopia();
  if (nube.usuarioId() !== usuarioInicial || !recuperada && E !== estadoInicial) throw new Error('La cuenta cambió durante la sincronización.');
  const estado = E, usuario = nube.usuarioId();
  let respuestasAlEntrar = JSON.stringify(E.respuestas);
  let planAlEntrar = JSON.stringify(E.plan);
  const preferenciasAlEntrar = JSON.stringify({ unidad: R().unidad, asistente: E.asistente });
  const comprobar = () => { if (E !== estado || nube.usuarioId() !== usuario) throw new Error('La cuenta cambió durante la sincronización.'); };
  const consultar = async fn => {
    comprobar(); const resultado = await fn(); comprobar(); return resultado;
  };
  const avisos = [];
  const avisar = (parte, e) => {
    comprobar();
    avisos.push({ parte, mensaje: e.datos?.errores?.map(x => x.mensaje).join(' ') || e.message });
  };
  let planIntentado = false;
  if (E.chatPorTraer) {
    if (!await consultar(() => actualizarChatConfirmado())) throw new Error('La cuenta cambió al recuperar los cambios del chat.');
    respuestasAlEntrar = JSON.stringify(E.respuestas); planAlEntrar = JSON.stringify(E.plan);
  }
  if (E.preferenciasPendientes) {
    const enviadas = structuredClone(E.preferenciasPendientes), firma = JSON.stringify(enviadas);
    await consultar(() => nube.guardarPreferencias(enviadas));
    E.firmaPreferenciasCuenta = firma;
    if (JSON.stringify(E.preferenciasPendientes) === firma) delete E.preferenciasPendientes;
    guardar(); // cualquier preferencia nueva conserva su pendiente hasta que se confirme su propia subida
  }
  if (E.planPendiente) {
    const enviado = structuredClone(E.planPendiente), firma = JSON.stringify(enviado);
    planIntentado = true;
    try {
      await consultar(() => nube.guardarCuestionario(structuredClone(R())));
      const r = await consultar(() => nube.guardarPlan(enviado));
      if (JSON.stringify(E.plan) === firma) { E.plan = { ...E.plan, id: r.id }; planAlEntrar = JSON.stringify(E.plan); }
      if (JSON.stringify(E.planPendiente) === firma) delete E.planPendiente;
      guardar();
    } catch (e) { avisar('Plan', e); }
  }
  const respuestas = await consultar(() => nube.cargarRespuestas());
  const plan = await consultar(() => nube.cargarPlan());
  if (respuestas) {
    const borrador = E.firmaPlan && firmaRespuestas(E.firmaPlan) !== firmaRespuestas();
    if (!E.planPendiente && !borrador && JSON.stringify(E.respuestas) === respuestasAlEntrar) E.respuestas = { ...respuestas, escala_esfuerzo: R().escala_esfuerzo };
  }
  if (plan) { if (!E.planPendiente && JSON.stringify(E.plan) === planAlEntrar) E.plan = conPropios(plan, E.plan); }
  else if (!planIntentado && !E.planPendiente && R().objetivo_principal && E.plan?.dias?.length && !E.plan.bloqueado && !E.plan.id && !E.plan.libre) {
    // Perfil local copiado a una cuenta vacía: se sube su plan tal cual (el servidor lo valida), sin armar otro.
    const enviado = structuredClone(E.plan), firma = JSON.stringify(enviado);
    try {
      await consultar(() => nube.guardarCuestionario(structuredClone(R())));
      const r = await consultar(() => nube.guardarPlan(enviado));
      if (JSON.stringify(E.plan) === firma) E.plan.id = r.id;
    }
    catch (e) {
      comprobar();
      if (JSON.stringify(E.plan) === firma) E.planPendiente = enviado;
      avisar('Plan', e);
    }
  }
  else if (!E.planPendiente && R().objetivo_principal && !E.plan?.libre) await consultar(() => armarPlan()); // quien entrena sin plan lo arma cuando quiera
  let p = await consultar(() => nube.cargarPreferencias());
  if (!p.preferencias_actualizadas) { p = { unidad: R().unidad || 'kg', asistente: E.asistente || 'entrenadora' }; await consultar(() => nube.guardarPreferencias(p)); }
  if (JSON.stringify({ unidad: R().unidad, asistente: E.asistente }) === preferenciasAlEntrar) { R().unidad = p.unidad; E.asistente = p.asistente || 'entrenadora'; }
  E.firmaPreferenciasCuenta = JSON.stringify({ unidad: p.unidad, asistente: p.asistente || 'entrenadora' });
  const locales = structuredClone({ suplementos: E.suplementos, tomas: E.tomas, consentimientos: E.consentimientos });
  const firmaLocales = JSON.stringify(locales);
  try {
    const recibidos = await consultar(() => nube.subirLocal(locales));
    if (JSON.stringify({ suplementos: E.suplementos, tomas: E.tomas, consentimientos: E.consentimientos }) === firmaLocales) E.suplementos = recibidos;
    else avisar('Suplementos y permisos', new Error('Hay cambios nuevos pendientes de enviar.'));
  } catch (e) { avisar('Suplementos y permisos', e); }
  // Sesiones e indicaciones anotadas sin cuenta: a la cola, que las sube con su id (sin duplicar).
  for (const s of E.sesiones.filter(x => !x.enCuenta && x.origen !== 'ejemplo')) {
    Object.assign(s, prepararSesion(s));
    const { id, enCuenta, ...datos } = s;
    if (!(E.pendientes || []).some(x => x.tipo === 'sesion' && x.clave === id)) dejarPendiente('sesion', id, datos);
  }
  for (const i of E.indicaciones.filter(x => !x.enCuenta)) { i.id ||= crypto.randomUUID(); if (!(E.pendientes || []).some(x => x.tipo === 'indicacion' && x.clave === i.id)) dejarPendiente('indicacion', i.id, i); }
  for (const [fecha, b] of Object.entries(E.bienestar)) if (!b.enCuenta) {
    const datos = Object.fromEntries(nube.CAMPOS_BIENESTAR.filter(k => b[k] !== undefined).map(k => [k, b[k]]));
    if (!(E.pendientes || []).some(x => x.tipo === 'bienestar' && x.clave === fecha)) dejarPendiente('bienestar', fecha, datos);
  }
  try { for (const i of await consultar(() => nube.cargarIndicaciones())) if (!E.indicaciones.some(x => x.id === i.id)) E.indicaciones.push(i); }
  catch (e) { avisar('Indicaciones', e); }
  guardar();
  await consultar(() => subirPendientes({ forzar }));
  // Ejercicios propios, medidas, notas fijas y fechas del ciclo (antes solo en el teléfono).
  try { await consultar(() => sincronizarDatosTelefono()); } catch (e) { avisar('Datos del teléfono', e); }
  E.sesiones = unirSesiones(E.sesiones, idsPropios(await consultar(() => nube.cargarSesiones()), E.ejerciciosPropios || []), E.pendientes || []);
  E.bienestar = { ...await consultar(() => nube.cargarBienestar()), ...Object.fromEntries(Object.entries(E.bienestar).filter(([, b]) => !b.enCuenta)) };
  const pendientes = E.pendientes?.length || 0;
  const partes = avisos.map(x => `${x.parte}: ${x.mensaje}`);
  if (E.planPendiente && !avisos.some(x => x.parte === 'Plan')) partes.push('plan pendiente');
  if (E.preferenciasPendientes) partes.push('preferencias pendientes');
  if (pendientes) partes.push(`${pendientes} elementos pendientes`);
  if (Object.entries(E.nubeDatos || {}).some(([k, v]) => v.pendiente && (k !== 'medidas_cuerpo' || E.consentimientos?.medidas_cuerpo === true)) && !avisos.some(x => x.parte === 'Datos del teléfono')) partes.push('datos del teléfono pendientes');
  const completa = !partes.length;
  const mensaje = completa ? `Sincronización completa. ${E.sesiones.length} sesiones disponibles en esta cuenta.`
    : `Sincronización incompleta. ${partes.join('. ')}. La copia del teléfono se conserva. Reintenta en Más.`;
  if (!completa || E.mensaje === E.sincronizacionCuenta?.mensaje) E.mensaje = completa ? null : mensaje;
  E.sincronizacionCuenta = { completa, pendientes, avisos, mensaje };
  comprobar();
  if (completa) marcarCuentaRecuperada(usuario);
  guardar();
  return E.sincronizacionCuenta;
}

function vistaBloqueada() {
  $('app').innerHTML = `<h1>Antes de armar tu plan</h1><div class="aviso alerta">${esc(E.plan.mensaje)}</div>
    <div class="fila-botones"><button type="button" class="boton primario" id="autorizado">${esc(C.reglas.alerta_medica[0].confirmacion)}</button><button type="button" class="boton" id="volver">Revisar respuestas</button></div>`;
  $('autorizado').onclick = () => { R().autorizacion_medica = true; armarPlan(); };
  $('volver').onclick = () => { E.seccionPerfil = 'salud'; ir('seccion'); };
}

function vistaInicio() {
  vistaBienvenida(ir, { abrirEjemplo: () => { if (nube.conectado()) { E.mensaje = 'Sal de tu cuenta antes de abrir el ejemplo local.'; mostrarMensaje(); return; } entrarEjemplo(); E.respuestas = structuredClone(EJEMPLO); E.sesiones = historialDeEjemplo(hoy(), indice); armarPlan(); } });
  mostrarMensaje();
}

// ── Navegación ──────────────────────────────────────────────────────────────
const VISTAS_CON_PLAN = ['hoy', 'semana', 'progreso', 'checkin', 'plan', 'resumen', 'eleccion'];
const PESTANA = { eleccion: 'hoy', banco: 'mas', checkin: 'semana', plan: 'semana', perfil: 'mas', seccion: 'mas', pasado: 'progreso', 'tablero-original': 'mas' };
let antesDeFicha = null, finEntrada = null, extraActual = null, primeraVista = true, retornoInicial = null;
function ir(vista, extra) {
  if (VISTAS_CON_PLAN.includes(vista) && (!E.plan)) vista = 'inicio';
  if (VISTAS_CON_PLAN.includes(vista) && E.plan?.bloqueado) { vistaBloqueada(); return; }
  if (vista === 'plan' && E.plan?.libre) vista = 'inicio'; // sin plan todavía: armarlo o seguir sin plan
  if (E.vista === 'eleccion' && vista !== 'eleccion') E.eleccionInicio = hoy(); // ya eligió (o se fue a otra pestaña)
  const anterior = E.vista;
  // Al abrir una ficha se recuerda dónde estaba la persona; al volver, queda en el mismo ejercicio y a la misma altura.
  if (vista === 'ejercicio' && anterior !== 'ejercicio') antesDeFicha = { vista: anterior, y: scrollY, id: extra?.id };
  const volviendo = anterior === 'ejercicio' && antesDeFicha?.vista === vista ? antesDeFicha : null;
  if (vista !== 'ejercicio') antesDeFicha = null;
  extraActual = extra;
  E.vista = vista; guardar();
  $('nav').hidden = !E.plan || E.plan.bloqueado;
  const pestana = ['ejercicio', 'resumen'].includes(vista) ? PESTANA[extra?.desde] || extra?.desde || 'hoy' : PESTANA[vista] || vista;
  document.querySelectorAll('#nav [data-ir]').forEach(b => b.setAttribute('aria-current', String(b.dataset.ir === pestana)));
  pintarModo();
  pintarPerfilesPrueba();
  abrirEnlacePerfiles(); // #perfiles=…: el enlace privado reemplaza pasar el archivo a cada teléfono
  const vistas = {
    inicio: vistaInicio, eleccion: () => vistaEleccion(ir), cuestionario: () => vistaRapido(ir, armarPlan), perfil: () => vistaPerfil(ir, armarPlan), seccion: () => vistaSeccion(ir),
    plan: () => vistaPlan(ir, { armarPlan, nuevo: extra?.nuevo }), hoy: () => vistaHoy(ir, extra), ejercicio: () => vistaFicha(ir, extra || {}), semana: () => vistaSemana(ir),
    banco: () => vistaBanco(ir, extra || {}), coach: () => vistaCoach(ir, extra), checkin: () => vistaCheckin(ir, extra), resumen: () => vistaResumen(ir, extra || {}), progreso: () => vistaProgreso(ir), pasado: () => vistaDiaPasado(ir, extra || {}), mas: () => vistaMas(ir, { armarPlan, sincronizarAlEntrar, panel: extra?.panel }), 'tablero-original': () => vistaTableroOriginal(ir),
  };
  // Al volver atrás, la pantalla queda a la altura donde se dejó (la misma que se vio debajo al deslizar).
  const vuelta = vista !== anterior && (esVuelta(anterior, vista) || volviendoConGesto());
  if (vista !== anterior) recordarPantalla(anterior, $('app'));
  (vistas[vista] || vistaInicio)();
  mostrarMensaje(); // los avisos se muestran una vez, flotando sobre el menú
  window.scrollTo(0, vuelta ? alturaDe(vista) || 0 : 0);
  // Al llegar a Hoy (o al abrir la app ahí) con la sesión empezada, la pantalla queda en el ejercicio que sigue.
  if (vista === 'hoy' && (vista !== anterior || primeraVista) && !volviendo && !extra?.ej && !retornoInicial) requestAnimationFrame(irAlEjercicioEnCurso);
  if (retornoInicial?.vista === vista) {
    const y = retornoInicial.y; retornoInicial = null;
    requestAnimationFrame(() => scrollTo(0, y));
  }
  primeraVista = false;
  if (volviendo) requestAnimationFrame(() => {
    scrollTo(0, volviendo.y);
    const id = CSS.escape(volviendo.id || '');
    document.querySelector(`[data-ficha="${id}"], [data-banco-ver="${id}"], [data-recom-ver="${id}"]`)?.focus({ preventScroll: true });
  });
  // Solo al cambiar de pantalla: repintar la misma (por ejemplo, al anotar una serie) no se anima.
  // Si se volvió con el gesto, la pantalla ya se vio entrar mientras se deslizaba.
  if (vista !== anterior && !volviendoConGesto()) {
    entrarVista($('app'), esVuelta(anterior, vista));
    $('app').classList.add('entrando'); // las poses de la pantalla nueva entran una vez (estilos.css)
    clearTimeout(finEntrada); finEntrada = setTimeout(() => $('app').classList.remove('entrando'), 500);
  }
  if (vista !== anterior) dibujarGraficos(vuelta ? null : $('app')); // al volver, los gráficos ya están dibujados
  programarAvisos(); // recordatorios de hoy con lo último (sesión hecha, suplemento tomado)
  actualizarPantalla(); // con una sesión en curso, la pantalla no se apaga sola
}
$('nav').addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) ir(b.dataset.ir); });
// El enlace de los perfiles también sirve si la app ya estaba abierta (solo cambia lo que va después del #).
addEventListener('hashchange', () => abrirEnlacePerfiles());

/** Encabezado: sin señal (lo anotado se guarda igual) o, con cuenta, el correo. En la versión de prueba, nada. */
function pintarModo() {
  const m = $('modo');
  const texto = modoEjemplo ? 'Ejemplo ficticio · Volver a mis datos' : errorGuardado ? 'Hay cambios sin guardar' : !navigator.onLine ? 'Sin señal · se guarda igual' : nube.conectado() ? (R().demo_privada ? 'Demo privada · Perfil ficticio' : nube.correo() || 'Cuenta') : nube.hay() ? 'Sin cuenta' : '';
  const aviso = perfilDePrueba && !modoEjemplo ? `${perfilDePrueba.nombre}${texto ? ' · ' + texto : ''}` : texto;
  const html = !navigator.onLine ? sinSenalHtml(aviso) : esc(aviso);
  if (m.dataset.html !== html) { m.innerHTML = html; m.dataset.html = html; } // sin parpadeo al cambiar de pantalla
  m.onclick = modoEjemplo ? () => { salirEjemplo(); ir(E.plan ? 'hoy' : 'inicio'); } : null;
  m.setAttribute('role', modoEjemplo ? 'button' : 'status');
  m.tabIndex = modoEjemplo ? 0 : -1;
  m.onkeydown = e => { if (modoEjemplo && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); m.click(); } };
  m.hidden = !aviso;
  m.classList.toggle('sin-senal', !navigator.onLine);
}
addEventListener('online', pintarModo);
addEventListener('offline', () => { pintarModo(); entrarPose($('modo').querySelector('.modo-personaje')); });

// Respuestas de ejemplo: una persona inventada, intermedia, con molestia de codo y prioridad en glúteo.
const EJEMPLO = {
  apodo: 'Ejemplo', fecha_nacimiento: '1995-05-05', sexo: 'femenino', objetivo_principal: 'recomposicion', prioridad_recomposicion: 'grasa',
  musculos_prioridad: ['gluteo'], tiempo_entrenando: '6_24m', constancia: '3_4',
  tecnica: { sentadilla: 'mas_o_menos', bisagra: 'mas_o_menos', press_horizontal: 'domino', remo: 'domino', press_vertical: 'mas_o_menos', dominada: 'no' },
  estilo_prescripcion: 'exacto', rotacion: 'algunos', dias_meta: 4, dias_firmes: 3, dias_no_puedo: [5], duracion_min: '60', estructura: 'fija',
  lugares: [{ nombre: 'Gimnasio', tipo: 'gimnasio_completo', principal: true, incremento_minimo_kg: 2.5, mancuerna_max_kg: 30,
    equipamiento: ['barra_rack', 'smith', 'banco', 'mancuernas', 'poleas', 'prensa', 'extension_cuadriceps', 'curl_femoral', 'hip_thrust_maquina', 'abductora', 'kickback_maquina', 'maquinas', 'jalon', 'bandas', 'escaladora'] }],
  consentimiento_salud: true, tamizaje: { corazon: false, dolor_pecho: false, mareo: false, cronica: false, medicamentos: false, osteoarticular: false, supervision: false },
  embarazo: 'no', lesiones: [{ region: 'codo', tipo: 'molestia', lado: 'izquierdo', intensidad: 2, activa: true }],
  favoritos: ['hip_thrust_barra', 'prensa'], sueno_horas: '6_7', turnos: false, estres: 3, llegas_cansado: 3,
  cardio_actual: ['escaladora'], cardio_para: 'condicion', registro: 'app', dia_checkin: 0, unidad: 'kg',
  terminos: true, privacidad: true, ia_transferencia: true,
};

// Versión de prueba en el celular: guarda la app para que abra sin señal en el gimnasio.
if (CONFIG.sinSenal && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('Sin modo sin señal', e));

// Primero la copia de este perfil y su segunda copia. La red no participa en el primer dibujo.
activarCuenta(nube.usuarioGuardado({ claveSesion: claveSesionCuenta() }));
// Si el almacenamiento principal quedó atrás de la segunda copia del teléfono, se vuelve a lo último que se escribió.
const avisarRecuperado = async () => { if (await recuperarCopia()) E.mensaje = 'Recuperé lo último que anotaste desde la copia de seguridad de este teléfono.'; };
await avisarRecuperado();
// La app restaura su propia posición después de dibujar, sin una segunda corrección del navegador.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
retornoInicial = retornoGuardado(E.pantallaGuardada, E, hoy());
// Con plan, la primera vez del día se elige entre la sesión planificada y una vacía (salvo a mitad del cuestionario).
ir(!retornoInicial && !['cuestionario', 'perfil', 'seccion'].includes(E.vista) && eleccionPendiente() ? 'eleccion'
  : retornoInicial?.vista || (['cuestionario', 'hoy', 'semana', 'coach', 'progreso', 'mas', 'checkin', 'plan', 'perfil', 'seccion', 'tablero-original'].includes(E.vista) ? E.vista : (E.plan ? 'hoy' : 'inicio')), retornoInicial?.extra);
requestAnimationFrame(() => requestAnimationFrame(() => { $('app').dataset.cargaMs = String(Math.round(performance.now())); }));
// Atrás: deslizar desde el borde izquierdo o el botón atrás del teléfono (app/atras.js).
instalarAtras(() => accionAtras({ vista: E.vista, extra: extraActual, ir, conPlan: Boolean(E.plan) }));
// Con la clave de Hevy Pro, lo nuevo de Hevy entra solo; si llega algo, se redibuja la vista (sin mover la pantalla).
let repintadoPendiente = false;
function repintarSinMover() {
  if (document.querySelector('#hoja, #pantalla-pasos') || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) { repintadoPendiente = true; return; }
  repintadoPendiente = false;
  const y = scrollY; ir(E.vista, extraActual); scrollTo(0, y);
}
document.addEventListener('focusout', () => setTimeout(() => { if (repintadoPendiente) repintarSinMover(); }, 0));
document.addEventListener('click', () => { if (repintadoPendiente) setTimeout(repintarSinMover, 250); });
const guardarPantalla = () => guardarRetorno(pantallaGuardada(E.vista, extraActual, scrollY, E.vista === 'hoy' ? fechaSesionActiva(E, hoy()) : hoy()));
addEventListener('pagehide', guardarPantalla);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarPantalla(); });

async function iniciarEnSegundoPlano() {
  const alIniciar = E, usuarioAlIniciar = nube.usuarioId();
  let iniciado;
  try { iniciado = await nube.iniciar({ claveSesion: claveSesionCuenta(), vigente: () => E === alIniciar }); }
  catch (e) {
    if (E !== alIniciar || nube.usuarioId() !== usuarioAlIniciar) return;
    E.mensaje = errorRetornoCuenta || (e.code === 'acceso_retornado_fallido' ? e.message : 'No pude abrir tu cuenta. Pide otro acceso desde Más, Cuenta. Tus datos del teléfono se conservan.');
    E.errorAccesoCuenta = E.mensaje;
    E.vista = 'mas'; extraActual = { panel: 'cuenta' };
    guardar(); repintarSinMover(); return;
  }
  if (E !== alIniciar) return;
  // Si no se pudo verificar la cuenta sin señal, se conserva su copia local. No cambia a otro perfil.
  if (iniciado) { delete E.errorAccesoCuenta; activarCuenta(nube.usuarioId()); await avisarRecuperado(); }
  if (nube.conectado()) {
    const estado = E, usuario = nube.usuarioId(), vigente = () => E === estado && nube.usuarioId() === usuario;
    let resultado;
    try { resultado = await sincronizarAlEntrar(); }
    catch { if (vigente()) E.mensaje = 'No pude sincronizar ahora. Puedes seguir con la copia de esta cuenta en el teléfono y reintentar en Más.'; }
    if (!vigente()) return;
    if (nube.entroPorEnlace()) {
      if (resultado?.completa) E.mensaje = `Entraste como ${nube.correo()}.`;
      E.vista = E.plan ? 'hoy' : 'mas';
      extraActual = E.plan ? null : { panel: 'cuenta' };
    }
  }
  repintarSinMover();
  hevyAlAbrir(() => { if (['hoy', 'semana', 'progreso'].includes(E.vista)) repintarSinMover(); });
}
// Dejar que la copia llegue a la pantalla antes de cargar el cliente de cuentas o hacer consultas.
requestAnimationFrame(() => setTimeout(() => iniciarEnSegundoPlano().catch(e => console.warn('No pude iniciar la cuenta', e)), 0));
