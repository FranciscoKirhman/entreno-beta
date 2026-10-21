// Cambios al plan desde Hoy y desde la ficha de un ejercicio, sin pasar por el chat: la misma lógica del entrenador
// (nucleo/coach.js), en hojas que suben desde abajo. Siempre se muestra cómo quedaría y se pregunta antes de cambiar.
// También "Ajustar hoy", que comparten Hoy y la hoja ＋ del Coach.
import { E, C, hoy, ctxNucleo, cambiarPlan, avisar } from './comun.js';
import { sesionDe } from '../nucleo/agenda.js';
import { abrirTiempo } from './tiempo-ui.js';
import { nombreAsistente } from './cuestionario.js';
import { srcArticulacion } from './articulaciones.js';
import { responder, aplicarOpcion } from '../nucleo/coach.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import { srcMiniatura } from './imagenes.js';
import * as nube from './nube.js';

const iconoDe = a => (a.tipo === 'confirmar' ? ['visto', 'confirmar'] : a.tipo === 'nada' ? ['cerrar', 'nada'] : ['flecha', '']);

/**
 * Sigue una respuesta del entrenador ({texto, opciones?, plan?}): con opciones, una hoja para elegir; al elegir, la
 * respuesta siguiente (otra hoja), hasta que se confirma un cambio (se guarda) o se elige no cambiar nada.
 * @param o.titulo    título de la primera hoja
 * @param o.alCambiar (r) => void después de guardar el plan nuevo (r.ir dice qué pantalla mirar)
 * @param o.volver    foco a devolver al cerrar
 */
export async function seguir(r, { titulo, alCambiar, volver = null }) {
  if (r.plan) {
    const aviso = await cambiarPlan(r.plan, r.texto, nube);
    if (aviso) avisar(aviso);
    alCambiar?.(r);
    return;
  }
  if (!r.opciones?.length) { avisar(r.texto); return; }
  const confirma = r.opciones.some(o => o.accion?.tipo === 'confirmar');
  abrirHoja({
    titulo: confirma ? '¿Lo cambio?' : titulo,
    nota: r.texto,
    volver,
    opciones: r.opciones.map((o, i) => {
      const [ic, clase] = iconoDe(o.accion || {});
      // Al elegir con qué cambiar un ejercicio, se ve su dibujo o su máquina.
      const imagen = o.accion?.tipo === 'reemplazar_hoy' ? srcMiniatura(o.accion.a) : null;
      return { valor: String(i), ...(imagen ? { imagen } : { icono: icono(ic) }), clase, nombre: o.etiqueta };
    }),
    alElegir: v => seguir(aplicarOpcion(r.opciones[Number(v)].accion, ctxNucleo()), { titulo, alCambiar, volver }),
  });
}

/** Lo mismo que escribirle al entrenador, pero en hojas: "solo tengo 30 minutos", "dormí mal", "falté hoy". */
export const preguntar = (texto, o) => seguir(responder(texto, ctxNucleo()), o);
/** Una acción directa del entrenador (por ejemplo, {tipo: 'elegir_alternativa', fecha, ejercicio}). */
export const proponer = (accion, o) => seguir(aplicarOpcion(accion, ctxNucleo()), o);

const articulo = z => (z === 'lumbar' ? 'la zona lumbar' : `${['muneca', 'cadera', 'rodilla'].includes(z) ? 'la' : 'el'} ${C.zonas.articulaciones.find(x => x[0] === z)[1].toLowerCase()}`);

/**
 * "Ajustar hoy": las mismas opciones desde Hoy y desde la hoja ＋ del Coach. Usa las reglas del entrenador en el
 * teléfono, así funciona sin señal y sin IA; siempre muestra cómo quedaría y pregunta antes de cambiar.
 * @param o.alDolor (texto) => void: qué hacer con "me duele el hombro 4/10" (por ejemplo, mandarlo al chat).
 *                  Sin alDolor, lo responden las reglas en hojas.
 * @param o.alChat  () => void: la opción "Hablar con…" (solo si se pasa)
 */
export function abrirAjustarHoy({ titulo = 'Ajustar hoy', volver = null, alCambiar, alDolor = null, alChat = null } = {}) {
  const fecha = hoy(), dia = sesionDe(E.plan, fecha);
  const o = { titulo, volver, alCambiar };
  if (!dia) return seguir(responder('hoy no quiero hacer esto, ¿qué otra opción tienes?', ctxNucleo()), { ...o, titulo: 'Hoy no tienes sesión' });
  abrirHoja({
    titulo, volver,
    nota: 'Te muestro cómo quedaría y te pregunto antes de cambiar algo.',
    opciones: [
      { valor: 'tiempo', icono: icono('reloj'), nombre: 'Ajustar el tiempo' },
      { valor: 'cansado', icono: icono('luna'), nombre: 'Dormí mal o estoy cansado' },
      { valor: 'maquina', icono: icono('cambiar'), nombre: 'Una máquina está ocupada' },
      { valor: 'otra', icono: icono('calendario'), nombre: 'Prefiero entrenar otra cosa' },
      { valor: 'falte', icono: icono('flecha'), nombre: 'Hoy no puedo, moverla' },
      { valor: 'dolor', icono: icono('curita'), clase: 'tipo-fallo', nombre: 'Me duele algo' },
      ...(alChat ? [{ valor: 'chat', icono: icono('chat'), nombre: `Hablar con ${nombreAsistente()}` }] : []),
    ],
    alElegir: v => (v === 'chat' ? alChat?.() : accionHoy(v, { ...o, alDolor })),
  });
}

/** Una opción de "Ajustar hoy" por su nombre: tiempo, cansado, maquina, otra, falte o dolor. */
export function accionHoy(v, { titulo = 'Ajustar hoy', volver = null, alCambiar, alDolor = null } = {}) {
  const fecha = hoy(), dia = sesionDe(E.plan, fecha), o = { titulo, volver, alCambiar };
  if (!dia && v !== 'dolor') return seguir(responder('hoy no quiero hacer esto, ¿qué otra opción tienes?', ctxNucleo()), { ...o, titulo: 'Hoy no tienes sesión' });
  // La rueda: elige los minutos (más o menos que el plan, o sin límite) y muestra cómo queda antes de cambiar.
  if (v === 'tiempo') abrirTiempo({ volver, alCambiar: () => alCambiar?.({ ir: 'hoy' }) });
  else if (v === 'cansado') preguntar('dormí mal y estoy cansado', o);
  else if (v === 'maquina') preguntar('la máquina está ocupada', { ...o, titulo: '¿Qué máquina está ocupada?' });
  else if (v === 'otra') preguntar('hoy no quiero hacer esto, ¿qué otra opción tienes?', { ...o, titulo: 'Otra opción para hoy' });
  else if (v === 'falte') proponer({ tipo: 'falte', fecha }, o);
  else if (v === 'dolor') elegirDolor({ volver, alElegir: texto => (alDolor ? alDolor(texto) : preguntar(texto, { ...o, titulo: 'Para tu dolor' })) });
}

/** ¿Dónde y cuánto duele? Dos hojas tocables que arman "me duele el hombro 4/10" (las reglas piden zona e intensidad). */
export function elegirDolor({ volver = null, alElegir }) {
  abrirHoja({
    titulo: '¿Dónde te duele?', volver,
    opciones: C.zonas.articulaciones.map(([z, t]) => ({ valor: z, imagen: srcArticulacion(z), icono: icono('curita'), clase: 'tipo-fallo', nombre: t })),
    alElegir: z => abrirHoja({
      titulo: '¿Cuánto te duele?', volver, nota: 'De 0 a 10. Si es fuerte, aparece de golpe o viene con hormigueo, para y consulta.',
      opciones: [[2, 'Poco (2 de 10)'], [4, 'Molesta (4 de 10)'], [6, 'Bastante (6 de 10)'], [8, 'Mucho (8 de 10)']].map(([n, t]) => ({ valor: String(n), icono: icono('curita'), clase: 'tipo-fallo', nombre: t })),
      alElegir: n => alElegir(`me duele ${articulo(z)} ${n}/10`),
    }),
  });
}
