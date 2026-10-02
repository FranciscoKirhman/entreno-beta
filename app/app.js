// App Entreno. Funciona sin cuenta (todo en este navegador) y con cuenta (Supabase). Usa el mismo núcleo
// que el servidor: nucleo/*.js.
//
//   node herramientas/servir.mjs  →  http://127.0.0.1:5173/app/
import { C, E, guardar, R, esc, $, hoy, indice, mostrarMensaje, empezarDeNuevo, entrarEjemplo, salirEjemplo, modoEjemplo, errorGuardado, activarCuenta } from './comun.js';
import { prepararSesion, unirSesiones } from '../nucleo/sincronizacion.js';
import { historialDeEjemplo } from '../nucleo/historial-ejemplo.js';
import { derivar } from '../nucleo/derivar.js';
import { generarPlan } from '../nucleo/motor-plan.js';
import { vistaHoy } from './hoy.js';
import { vistaFicha } from './ficha.js';
import { vistaSemana } from './semana.js';
import { vistaCoach } from './coach-ui.js';
import { vistaProgreso } from './progreso.js';
import { vistaMas } from './mas.js';
import { vistaCheckin } from './checkin.js';
import { historialReciente, fechasEntrenadas } from './temporada.js';
import { vistaRapido, vistaPerfil, vistaSeccion, firmaRespuestas, dice, nombreAsistente } from './cuestionario.js';
import { vistaPlan } from './plan.js';
import { progresoNivel } from '../nucleo/nivel.js';
import { programarAvisos } from './avisos.js';
import { actualizarPantalla } from './pantalla.js';
import { dejarPendiente, subirPendientes } from './cola.js';
import * as nube from './nube.js';
import { CONFIG } from './config.js';

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
  const estado = E, usuario = nube.usuarioId();
  const consultar = async fn => {
    const comprobar = () => { if (E !== estado || nube.usuarioId() !== usuario) throw new Error('La cuenta cambió durante la sincronización.'); };
    comprobar(); const resultado = await fn(); comprobar(); return resultado;
  };
  if (E.preferenciasPendientes) { await consultar(() => nube.guardarPreferencias(E.preferenciasPendientes)); E.firmaPreferenciasCuenta = JSON.stringify(E.preferenciasPendientes); delete E.preferenciasPendientes; guardar(); }
  if (E.planPendiente) { const r = await consultar(() => nube.guardarPlan(E.planPendiente)); E.plan = { ...E.planPendiente, id: r.id }; delete E.planPendiente; guardar(); }
  const respuestas = await consultar(() => nube.cargarRespuestas());
  const plan = await consultar(() => nube.cargarPlan());
  if (respuestas && plan) {
    const borrador = E.firmaPlan && firmaRespuestas(E.firmaPlan) !== firmaRespuestas();
    if (!borrador) E.respuestas = respuestas;
    E.plan = plan;
  }
  else if (R().objetivo_principal) await consultar(() => armarPlan());
  let p = await consultar(() => nube.cargarPreferencias());
  if (!p.preferencias_actualizadas) { p = { unidad: R().unidad || 'kg', asistente: E.asistente || 'entrenadora' }; await consultar(() => nube.guardarPreferencias(p)); }
  R().unidad = p.unidad; E.asistente = p.asistente || 'entrenadora';
  E.firmaPreferenciasCuenta = JSON.stringify({ unidad: R().unidad, asistente: E.asistente });
  try { E.suplementos = await consultar(() => nube.subirLocal({ suplementos: E.suplementos, tomas: E.tomas, consentimientos: E.consentimientos })); }
  catch (e) { console.warn('No se pudo subir lo anotado en este teléfono', e); }
  // Sesiones e indicaciones anotadas sin cuenta: a la cola, que las sube con su id (sin duplicar).
  for (const s of E.sesiones.filter(x => !x.enCuenta && x.origen !== 'ejemplo')) {
    Object.assign(s, prepararSesion(s));
    const { id, enCuenta, ...datos } = s;
    if (!(E.pendientes || []).some(x => x.tipo === 'sesion' && x.clave === id)) dejarPendiente('sesion', id, datos);
  }
  for (const i of E.indicaciones.filter(x => !x.enCuenta)) { i.id ||= crypto.randomUUID(); if (!(E.pendientes || []).some(x => x.tipo === 'indicacion' && x.clave === i.id)) dejarPendiente('indicacion', i.id, i); }
  for (const [fecha, b] of Object.entries(E.bienestar)) if (!b.enCuenta) {
    const datos = Object.fromEntries(['sueno_horas', 'sueno_calidad', 'cansancio', 'animo', 'estres', 'dolor', 'dolor_zona', 'enfermo', 'puntaje', 'recomendacion'].filter(k => b[k] !== undefined).map(k => [k, b[k]]));
    if (!(E.pendientes || []).some(x => x.tipo === 'bienestar' && x.clave === fecha)) dejarPendiente('bienestar', fecha, datos);
  }
  try { for (const i of await consultar(() => nube.cargarIndicaciones())) if (!E.indicaciones.some(x => x.id === i.id)) E.indicaciones.push(i); }
  catch (e) { console.warn('No se pudieron traer las indicaciones de la cuenta', e); }
  guardar();
  await consultar(() => subirPendientes({ forzar }));
  E.sesiones = unirSesiones(E.sesiones, await consultar(() => nube.cargarSesiones()), E.pendientes || []);
  E.bienestar = { ...await consultar(() => nube.cargarBienestar()), ...Object.fromEntries(Object.entries(E.bienestar).filter(([, b]) => !b.enCuenta)) };
  guardar();
}

function vistaBloqueada() {
  $('app').innerHTML = `<h1>Antes de armar tu plan</h1><div class="aviso alerta">${esc(E.plan.mensaje)}</div>
    <div class="fila-botones"><button type="button" class="boton primario" id="autorizado">${esc(C.reglas.alerta_medica[0].confirmacion)}</button><button type="button" class="boton" id="volver">Revisar respuestas</button></div>`;
  $('autorizado').onclick = () => { R().autorizacion_medica = true; armarPlan(); };
  $('volver').onclick = () => { E.seccionPerfil = 'salud'; ir('seccion'); };
}

function vistaInicio() {
  $('app').innerHTML = `<div id="vista-inicio">
    <h1>Tu compañero de entrenamiento</h1>
    ${dice('saludo', Object.keys(R()).length ? `¡Hola de nuevo! Soy ${nombreAsistente()}. Seguimos donde quedamos.` : `¡Hola! Soy ${nombreAsistente()}. Te ayudo a armar tu plan y te acompaño en cada entrenamiento.`)}
    <p class="pequeno">${CONFIG.modoPrueba ? 'Esta prueba funciona con reglas, sin IA ni nube. Tus respuestas y registros se conservan en este navegador. El ejemplo es ficticio y está separado de tu perfil.' : 'Puedes usar reglas en este teléfono. La IA requiere una cuenta y un servidor habilitado.'}</p>
    <p>Arma tu plan, lo agenda en tu semana, lo ajusta cuando faltas, cuando una máquina está ocupada o cuando dormiste mal, y te explica por qué de cada ejercicio, con evidencia.</p>
    ${nube.hay() && !nube.conectado() ? `<section class="tarjeta"><h3>Entrar con tu correo</h3><p class="pequeno">Puedes recuperar tus sesiones guardadas en otro dispositivo. El coach usa reglas mientras la IA no esté habilitada.</p><button type="button" class="boton primario" id="a-cuenta">Entrar</button></section>` : ''}
    ${nube.conectado() ? `<p class="pequeno suave">Entraste como ${esc(nube.correo())}.</p>` : ''}
    <div class="fila-botones">
      <button type="button" class="boton primario" id="empezar">${Object.keys(R()).length ? 'Seguir con el cuestionario' : 'Empezar el cuestionario'}</button>
      <button type="button" class="boton" id="ejemplo">Ver un ejemplo</button>
    </div>
    <p class="pequeno">¿Cambiaste de teléfono? <button type="button" class="enlace" id="a-respaldo">Restaurar un respaldo</button></p>
    <p class="suave pequeno" style="margin-top:24px">${esc(C.intro)}</p>
  </div>`;
  $('a-respaldo').onclick = () => ir('mas');
  $('a-cuenta')?.addEventListener('click', () => ir('mas'));
  $('empezar').onclick = () => ir('cuestionario');
  $('ejemplo').onclick = () => { if (nube.conectado()) { E.mensaje = 'Sal de tu cuenta antes de abrir el ejemplo local.'; mostrarMensaje(); return; } entrarEjemplo(); E.respuestas = structuredClone(EJEMPLO); E.sesiones = historialDeEjemplo(hoy(), indice); armarPlan(); };
  mostrarMensaje();
}

// ── Navegación ──────────────────────────────────────────────────────────────
const VISTAS_CON_PLAN = ['hoy', 'semana', 'coach', 'progreso', 'checkin', 'plan'];
const PESTANA = { checkin: 'semana', plan: 'semana', perfil: 'mas', seccion: 'mas' };
function ir(vista, extra) {
  if (VISTAS_CON_PLAN.includes(vista) && (!E.plan)) vista = 'inicio';
  if (VISTAS_CON_PLAN.includes(vista) && E.plan?.bloqueado) { vistaBloqueada(); return; }
  E.vista = vista; guardar();
  $('nav').hidden = !E.plan || E.plan.bloqueado;
  const pestana = vista === 'ejercicio' ? PESTANA[extra?.desde] || extra?.desde || 'hoy' : PESTANA[vista] || vista;
  document.querySelectorAll('#nav [data-ir]').forEach(b => b.setAttribute('aria-current', String(b.dataset.ir === pestana)));
  pintarModo();
  const vistas = {
    inicio: vistaInicio, cuestionario: () => vistaRapido(ir, armarPlan), perfil: () => vistaPerfil(ir, armarPlan), seccion: () => vistaSeccion(ir),
    plan: () => vistaPlan(ir, { armarPlan, nuevo: extra?.nuevo }), hoy: () => vistaHoy(ir, extra), ejercicio: () => vistaFicha(ir, extra || {}), semana: () => vistaSemana(ir),
    coach: () => vistaCoach(ir, extra), checkin: () => vistaCheckin(ir, extra), progreso: () => vistaProgreso(ir), mas: () => vistaMas(ir, { armarPlan, sincronizarAlEntrar }),
  };
  (vistas[vista] || vistaInicio)();
  mostrarMensaje(); // los avisos se muestran una vez, flotando sobre el menú
  window.scrollTo(0, 0);
  programarAvisos(); // recordatorios de hoy con lo último (sesión hecha, suplemento tomado)
  actualizarPantalla(); // con una sesión en curso, la pantalla no se apaga sola
}
$('nav').addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) ir(b.dataset.ir); });

/** Encabezado: sin señal (lo anotado se guarda igual) o, con cuenta, el correo. En la versión de prueba, nada. */
function pintarModo() {
  const m = $('modo');
  const texto = modoEjemplo ? 'Ejemplo ficticio · Volver a mis datos' : errorGuardado ? 'Hay cambios sin guardar' : !navigator.onLine ? 'Sin señal · se guarda igual' : nube.conectado() ? (R().demo_privada ? 'Demo privada · Perfil ficticio' : nube.correo() || 'Cuenta') : nube.hay() ? 'Sin cuenta' : '';
  m.textContent = texto;
  m.onclick = modoEjemplo ? () => { salirEjemplo(); ir(E.plan ? 'hoy' : 'inicio'); } : null;
  m.setAttribute('role', modoEjemplo ? 'button' : 'status');
  m.tabIndex = modoEjemplo ? 0 : -1;
  m.onkeydown = e => { if (modoEjemplo && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); m.click(); } };
  m.hidden = !texto;
  m.classList.toggle('sin-senal', !navigator.onLine);
}
addEventListener('online', pintarModo);
addEventListener('offline', pintarModo);

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

// El perfil personal persiste al abrir. El ejemplo solo empieza por elección explícita.
await nube.iniciar();
if (nube.conectado()) {
  activarCuenta(nube.usuarioId());
  try { await sincronizarAlEntrar(); }
  catch { E.mensaje = 'No pude sincronizar ahora. Puedes seguir con la copia de esta cuenta en el teléfono y reintentar en Más.'; }
  if (nube.entroPorEnlace()) { E.mensaje = `Entraste como ${nube.correo()}.`; E.vista = E.plan ? 'hoy' : 'inicio'; }
}
ir(['cuestionario', 'hoy', 'semana', 'coach', 'progreso', 'mas', 'checkin', 'plan', 'perfil', 'seccion'].includes(E.vista) ? E.vista : (E.plan ? 'hoy' : 'inicio'));
