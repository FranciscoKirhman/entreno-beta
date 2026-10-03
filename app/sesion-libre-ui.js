import { E, ctxNucleo, cambiarPlan, avisar } from './comun.js';
import { prepararSesionVacia } from '../nucleo/sesion-vacia.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';

const contexto = () => ({ ...ctxNucleo(), registro: E.registro, sesiones: E.sesiones, cardioHecho: E.cardioHecho });
export function proponerSesionVacia({ volver, alCambiar }) {
  const estado = E, usuario = nube.usuarioId();
  const r = prepararSesionVacia(contexto());
  if (r.error) return avisar(r.error.replace(/[–—]/g, ' a '));
  abrirHoja({ titulo: 'Empezar sesión vacía', volver,
    nota: 'Hoy quedará como Sesión libre, sin ejercicios ni cardio sugerido. Después eliges desde el banco. Las otras fechas y el historial se conservan. Las series ya hechas hoy también se conservan; si vuelves a agregar ese ejercicio, continúas sus series de hoy.',
    opciones: [{ valor: 'si', icono: icono('visto'), nombre: 'Confirmar y empezar vacía' }, { valor: 'no', icono: icono('flecha'), nombre: 'Dejar como está' }],
    alElegir: async v => {
      if (v !== 'si') return;
      if (E !== estado || nube.usuarioId() !== usuario) return avisar('La cuenta cambió. Vuelve a revisar el cambio.');
      const actual = prepararSesionVacia(contexto());
      if (actual.error) return avisar(actual.error.replace(/[–—]/g, ' a '));
      if (JSON.stringify(actual) !== JSON.stringify(r)) return proponerSesionVacia({ volver, alCambiar });
      const f = contexto().hoy;
      Object.assign((E.retirados ||= {})[f] ||= {}, actual.conservar);
      for (const [id, entrada] of Object.entries(actual.conservar)) {
        if (entrada.ejercicio.ejercicio_id !== id || E.registro[f]?.[id]) continue;
        ((E.registro[f] ||= {})[id]) = entrada.series.map(s => ({ hecho: true, tipo: s.tipo === 'efectiva' ? 'normal' : s.tipo, kg: s.carga_kg, reps: s.reps ?? s.distancia_m ?? s.duracion_seg, rir: s.rir, rpe: s.rpe }));
      }
      const aviso = await cambiarPlan(actual.plan, 'Sesión vacía lista. Elige tus ejercicios desde el banco.', nube);
      if (aviso) avisar(aviso);
      alCambiar?.();
    },
  });
}
