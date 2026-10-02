import { E, ctxNucleo, cambiarPlan, avisar, presc } from './comun.js';
import { editarSesion } from '../nucleo/editar-sesion.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';

const contexto = () => ({ ...ctxNucleo(), registro: E.registro, sesiones: E.sesiones });
export function proponerEdicion(accion, { volver, alCambiar }) {
  const estado = E, usuario = nube.usuarioId();
  const r = editarSesion(accion, contexto());
  if (r.error) { avisar(r.error.replace(/[–—]/g, ' a ')); return; }
  const agregar = accion.tipo === 'agregar';
  abrirHoja({ titulo: agregar ? 'Agregar a la sesión de hoy' : 'Quitar de la sesión de hoy', volver,
    nota: `${r.ejercicio.nombre || 'Ejercicio'}${agregar ? `: ${presc(r.ejercicio)}` : ''}. ${r.cantidad ? `Hoy quedaría con ${r.cantidad} ${r.cantidad === 1 ? 'ejercicio' : 'ejercicios'}, unos ${r.minutos} minutos.` : 'Hoy quedaría sin ejercicios.'} Las otras sesiones se mantienen.`,
    opciones: [{ valor: 'si', icono: icono(agregar ? 'visto' : 'cerrar'), nombre: agregar ? 'Confirmar y agregar' : 'Confirmar y quitar', peligro: !agregar },
      { valor: 'no', icono: icono('flecha'), nombre: 'Dejar como está' }],
    alElegir: async v => {
      if (v !== 'si') return;
      if (E !== estado || nube.usuarioId() !== usuario) return avisar('La cuenta cambió. Vuelve a revisar el cambio.');
      // Se vuelve a calcular: otra pantalla puede haber cambiado el plan o marcado series mientras estaba abierta.
      const actual = editarSesion(accion, contexto());
      if (actual.error) return avisar(actual.error.replace(/[–—]/g, ' a '));
      if (JSON.stringify(actual.plan) !== JSON.stringify(r.plan)) return proponerEdicion(accion, { volver, alCambiar });
      const aviso = await cambiarPlan(actual.plan, `Se ${agregar ? 'agregó' : 'quitó'} ${r.ejercicio.nombre || 'el ejercicio'} ${agregar ? 'a' : 'de'} la sesión de hoy.`, nube);
      if (aviso) avisar(aviso);
      alCambiar?.();
    },
  });
}
