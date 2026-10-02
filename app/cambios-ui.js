// Cambios al plan desde Hoy y desde la ficha de un ejercicio, sin pasar por el chat: la misma lógica del entrenador
// (nucleo/coach.js), en hojas que suben desde abajo. Siempre se muestra cómo quedaría y se pregunta antes de cambiar.
import { ctxNucleo, cambiarPlan, avisar } from './comun.js';
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
