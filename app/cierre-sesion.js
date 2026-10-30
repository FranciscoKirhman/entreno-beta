// El cierre de una sesión guardada en este teléfono: el comentario del coach con IA y "Para la próxima"
// (app/progresion-sesion.js). Pasan solos al guardar (app/hoy.js: terminarSesion); si el guardado se cortó (sin señal,
// la app cerrada a mitad), lo que faltó se completa al volver a abrir la app, sin que la persona lo pida: el coach
// recibe la sesión y, si "Para la próxima" trae cambios que nunca se mostraron, se abre el resumen para que se vean el
// antes, el después y el porqué antes de aplicarse (regla 10 de AGENTS.md). Solo las sesiones anotadas en este
// teléfono: otro teléfono con la misma cuenta no las vuelve a mandar al coach ni a ajustar.
import { E, guardar, hoy, indice, modoEjemplo, avisar, fechaCorta } from './comun.js';
import { pedirComentarioSesion } from './coach-ui.js';
import { mensajeSesionCoach } from './resumen.js';
import { faltaMostrarAjustes } from './progresion-sesion.js';
import { notasDeSesionTexto, huellaNotas } from '../nucleo/revision-semanal.js';
import { sumarDias } from '../nucleo/agenda.js';
import * as nube from './nube.js';

const DIAS_MAXIMO = 3; // una marca más vieja ya no se completa: el plan y la conversación siguieron
const conCoach = () => !modoEjemplo && nube.hay() && nube.usuarioId();
const pedida = id => (E.chat || []).some(m => m.rol === 'persona' && m.sesionId === id);
// Anotada aquí: sus series marcadas siguen en el registro de este teléfono (otro teléfono solo trae la sesión guardada).
const anotadaAqui = sesion => Object.values(E.registro?.[sesion.fecha] || {}).some(l => Array.isArray(l) && l.some(r => r?.hecho));
const ultimaGuardada = () => E.sesiones.filter(s => !s.origen)
  .reduce((m, s) => (!m || s.fecha > m.fecha || (s.fecha === m.fecha && (s.hora || '') > (m.hora || '')) ? s : m), null);
// Otra sesión empezada después: no se le quita la pantalla para mostrar un resumen viejo.
const otraEnCurso = sesion => Object.keys(E.inicioSesion || {}).some(f => f > sesion.fecha && !E.sesiones.some(s => s.fecha === f && !s.origen));

/** Al guardar (app/hoy.js): queda por cerrar hasta que el coach la tenga y "Para la próxima" se haya mostrado. */
export function marcarPorCerrar(id) { (E.porCerrar ||= {})[id] = Date.now(); }

/** Las guardadas antes de esta marca no la traen: la última, de hoy o de ayer, anotada aquí y sin pedido al coach ni
 *  "Para la próxima" mostrado, es un guardado que se quedó esperando la señal (29 de octubre de 2026). Una vez. */
function sinMarcaPorCerrar() {
  const s = ultimaGuardada();
  if (!s || E.porCerrar?.[s.id] || E.porCerrarRevisada === s.id || s.fecha < sumarDias(hoy(), -1) || !anotadaAqui(s)) return;
  E.porCerrarRevisada = s.id;
  if ((conCoach() && !pedida(s.id)) || faltaMostrarAjustes(s)) marcarPorCerrar(s.id);
}

/** Al abrir la app (app/app.js), con la cuenta ya al día: completa lo que faltó de cada sesión por cerrar. */
export function completarCierres(ir) {
  if (modoEjemplo || !Array.isArray(E.sesiones)) return;
  sinMarcaPorCerrar();
  let mostrar = null;
  for (const [id, desde] of Object.entries(E.porCerrar || {})) {
    const sesion = E.sesiones.find(s => s.id === id && !s.origen);
    if (!sesion || Date.now() - desde > DIAS_MAXIMO * 864e5) { delete E.porCerrar[id]; continue; }
    if (conCoach() && !pedida(id)) {
      // El mismo mensaje que al guardar: lo hecho contra el plan, récords y las notas para el entrenador.
      const notas = notasDeSesionTexto(sesion, indice), texto = mensajeSesionCoach(sesion, notas);
      (E.notasAlCoach ||= {})[`${id}:${huellaNotas(texto)}`] = true;
      pedirComentarioSesion(sesion, texto);
    }
    const falta = faltaMostrarAjustes(sesion);
    if (falta && !otraEnCurso(sesion)) mostrar = sesion;
    else if (!falta && (pedida(id) || !conCoach())) delete E.porCerrar[id];
  }
  guardar();
  if (!mostrar) return;
  ir('resumen', { id: mostrar.id }); // el resumen muestra "Para la próxima" y parte su cuenta de 10 segundos
  avisar(`Faltaba cerrar tu sesión del ${fechaCorta(mostrar.fecha)}: así quedan las próximas veces.`);
  if (!faltaMostrarAjustes(mostrar) && (pedida(mostrar.id) || !conCoach())) { delete E.porCerrar[mostrar.id]; guardar(); }
}
