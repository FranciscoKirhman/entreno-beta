// Pantalla de inicio. Quien llega elige entre armar su plan (el cuestionario) o entrenar sin plan (una sesión
// vacía), y después puede crear su cuenta. Quien ya tiene plan elige al abrir la app, una vez al día, entre la sesión
// planificada y una sesión vacía.
import { C, E, R, guardar, esc, $, hoy, fechaCorta, modoEjemplo } from './comun.js';
import { dice, nombreAsistente } from './cuestionario.js';
import { hayImagen, miniatura } from './imagenes.js';
import { proponerSesionVacia } from './sesion-libre-ui.js';
import { cuentaNuevaHtml, enlazarCuentaNueva } from './cuenta-ui.js';
import { entrarEnOrden } from './movimiento.js';
import { planLibre, eleccionDeHoy } from '../nucleo/plan-libre.js';
import { duracionSesion } from '../nucleo/motor-plan.js';
import * as nube from './nube.js';

// El lugar supuesto (gimnasio completo) y la unidad no cuentan como haber empezado el cuestionario.
const respondio = () => Object.keys(R()).some(k => !['unidad', 'lugares'].includes(k) || (k === 'lugares' && R().lugares.some(l => !l.supuesto)));
const fechaLarga = f => new Date(f + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Una opción grande del inicio: todo el recuadro se toca. Su nombre es el título; el texto, su descripción. */
const opcion = (id, titulo, texto, accion, extra = '') => `<button type="button" class="tarjeta opcion-inicio" id="${id}" aria-labelledby="${id}-t" aria-describedby="${id}-d">
    ${extra}<span class="opcion-titulo" id="${id}-t">${titulo}</span><span class="pequeno" id="${id}-d">${texto}</span><span class="opcion-accion" aria-hidden="true">${accion}</span></button>`;

/** Entrenar sin plan: la sesión vacía de hoy en un plan libre. Con un plan de verdad, se pregunta antes (sesión vacía). */
function entrenarSinPlan(ir, volver) {
  if (E.plan && !E.plan.libre) return proponerSesionVacia({ volver, alCambiar: () => { E.eleccionInicio = hoy(); guardar(); ir('hoy'); } });
  const r = R();
  // Sin lugar elegido se supone un gimnasio completo, igual que al armar el plan; el cuestionario lo pregunta después.
  if (!r.lugares?.length) {
    const x = C.secciones.flatMap(s => s.preguntas).find(q => q.id === 'lugares').presets[0];
    r.lugares = [{ nombre: x.nombre, tipo: x.tipo, equipamiento: [...x.equipamiento], principal: true, preset: x.id, supuesto: true }];
  }
  r.unidad ||= 'kg';
  E.plan = planLibre(E.plan, { hoy: hoy(), lugar: (r.lugares.find(l => l.principal) || r.lugares[0]).nombre });
  E.eleccionInicio = hoy();
  E.mensaje = 'Sesión vacía lista. Agrega tus ejercicios desde el banco.';
  guardar();
  ir('hoy');
}

/** Para quien llega: armar el plan o entrenar sin plan; después, la cuenta. */
export function vistaBienvenida(ir, { abrirEjemplo }) {
  const sigue = respondio(), portada = 'img/pantallas/inicio.webp';
  $('app').innerHTML = `<div id="vista-inicio">
    ${hayImagen(portada) ? `<img class="inicio-portada" src="${portada}" alt="" width="1024" height="683" decoding="async">` : ''}
    <h1>Tu compañero de entrenamiento</h1>
    ${dice('saludo', sigue ? `¡Hola de nuevo! Soy ${nombreAsistente()}. Seguimos donde quedamos.` : `¡Hola! Soy ${nombreAsistente()}. ¿Cómo quieres partir?`)}
    ${nube.conectado() && !E.plan ? `<section class="tarjeta"><h3>Recuperar mi entrenamiento</h3><p class="pequeno">Entraste como ${esc(nube.correo())}, pero esta cuenta todavía no tiene un plan. Los datos de otro teléfono o del tablero anterior necesitan trasladarse a ella.</p><button type="button" class="boton" id="recuperar-datos">Recuperar mis datos</button></section>` : ''}
    <div class="opciones-inicio">
      ${opcion('empezar', sigue ? 'Seguir armando mi plan' : 'Armar mi plan', 'Unas preguntas cortas y te armo un plan para tu semana, con el porqué de cada ejercicio.', sigue ? 'Seguir con el cuestionario' : 'Empezar el cuestionario')}
      ${opcion('sin-plan', 'Entrenar sin plan', 'Empiezas una sesión vacía y eliges tus ejercicios desde el banco. El plan lo armas cuando quieras.', 'Empezar sesión vacía')}
    </div>
    ${cuentaNuevaHtml({ titulo: '¿Ya tienes cuenta?', texto: 'Entra para traer tu plan y tus sesiones a este teléfono.' })}
    <p class="pequeno inicio-otros"><button type="button" class="enlace" id="ejemplo">Ver un ejemplo</button><button type="button" class="enlace" id="a-respaldo">Restaurar un respaldo</button></p>
    <p class="suave pequeno">${esc(C.intro)}</p>
  </div>`;
  $('empezar').onclick = () => ir('cuestionario');
  $('sin-plan').onclick = ev => entrenarSinPlan(ir, ev.currentTarget);
  $('ejemplo').onclick = abrirEjemplo;
  $('a-respaldo').onclick = () => ir('mas');
  $('recuperar-datos')?.addEventListener('click', () => ir('mas'));
  enlazarCuentaNueva(ir);
  entrarEnOrden([document.querySelector('#vista-inicio .inicio-portada'), ...document.querySelectorAll('#vista-inicio .opcion-inicio'), document.querySelector('#vista-inicio .cuenta-nueva')]);
}

/** Qué hay que elegir hoy al abrir la app, o null. */
export const eleccionPendiente = () => (modoEjemplo ? null
  : eleccionDeHoy({ plan: E.plan, hoy: hoy(), registro: E.registro, sesiones: E.sesiones, elegido: E.eleccionInicio }));

/** Para quien ya tiene plan: la sesión planificada o una vacía (o, con plan libre, armar el plan). */
export function vistaEleccion(ir) {
  const x = eleccionDeHoy({ plan: E.plan, hoy: hoy(), registro: E.registro, sesiones: E.sesiones });
  if (!x) return ir('hoy');
  const dia = x.dia, ejercicios = dia?.ejercicios || [];
  const series = ejercicios.reduce((n, e) => n + (Number(e.series) || 0), 0);
  const minutos = dia && !x.libre ? duracionSesion(dia) : null;
  const minis = ejercicios.slice(0, 3).map(e => miniatura(e.ejercicio_id, 'miniatura chica')).join('');
  const elegirPlan = () => { E.eleccionInicio = hoy(); guardar(); ir('hoy'); };
  $('app').innerHTML = `<div id="vista-eleccion">
    <span class="sobretitulo">${esc(fechaLarga(hoy()))}</span>
    <h1>¿Cómo entrenas hoy?</h1>
    <div class="opciones-inicio">
      ${x.libre ? opcion('eleccion-cuestionario', respondio() ? 'Seguir armando mi plan' : 'Armar mi plan', 'Unas preguntas cortas y te armo un plan para tu semana.', respondio() ? 'Seguir con el cuestionario' : 'Empezar el cuestionario')
        : dia ? opcion('eleccion-plan', esc(dia.foco), `Sesión planificada: ${ejercicios.length} ${ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}, ${series} series${minutos ? `, unos ${minutos} minutos` : ''}.`, 'Empezar la sesión planificada', minis ? `<span class="opcion-minis" aria-hidden="true">${minis}</span>` : '')
        : opcion('eleccion-plan', 'Hoy toca descanso', x.proxima ? `La próxima sesión planificada es ${esc(x.proxima.foco)}, el ${esc(fechaCorta(x.proxima.fecha))}.` : 'Hoy no tienes una sesión planificada.', 'Ir a Hoy')}
      ${x.libre ? opcion('eleccion-vacia', 'Entrenar sin plan', 'Una sesión vacía: eliges tus ejercicios desde el banco.', 'Empezar sesión vacía')
        : opcion('eleccion-vacia', 'Sesión vacía', 'Empiezas sin ejercicios y eliges desde el banco. Antes te muestro cómo queda hoy y lo confirmas.', 'Empezar sesión vacía')}
    </div>
    ${cuentaNuevaHtml()}
  </div>`;
  $('eleccion-plan')?.addEventListener('click', elegirPlan);
  $('eleccion-cuestionario')?.addEventListener('click', () => { E.eleccionInicio = hoy(); guardar(); ir('cuestionario'); });
  $('eleccion-vacia').onclick = ev => entrenarSinPlan(ir, ev.currentTarget);
  entrarEnOrden(document.querySelectorAll('#vista-eleccion .opcion-inicio'));
  enlazarCuentaNueva(ir);
}
