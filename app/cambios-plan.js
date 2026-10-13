// Deshacer un cambio del plan, como OpenGym con los cambios de su Coach: cada cambio aceptado guarda una copia del plan
// anterior (app/comun.js, cambiarPlan). Volver a una copia también es un cambio, así que se puede rehacer. Lo que ya
// registraste no cambia: las sesiones están aparte del plan.
import { E, avisar, cambiarPlan } from './comun.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';

const cuando = iso => new Date(iso).toLocaleString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const sinPunto = t => String(t || 'Cambio del plan').replace(/^Listo:\s*/i, '').replace(/\.$/, '');

export const hayCambiosPlan = () => Boolean(E.cambiosPlan?.length);

export function abrirCambiosPlan(volver, { alCambiar } = {}) {
  const lista = E.cambiosPlan || [];
  if (!lista.length) { avisar('Todavía no hay cambios del plan para deshacer.'); return; }
  abrirHoja({
    titulo: 'Deshacer un cambio del plan', volver,
    nota: 'Los últimos cambios, del más nuevo al más antiguo. Elige uno para volver el plan a como estaba antes de ese cambio. Lo que ya registraste no cambia.',
    opciones: lista.map((c, i) => ({ valor: String(i), icono: icono('flecha'), nombre: `${sinPunto(c.mensaje)} (${cuando(c.cuando)})` })),
    alElegir: v => {
      const c = lista[Number(v)];
      abrirHoja({
        titulo: '¿Vuelvo el plan atrás?', volver,
        nota: `Queda como estaba antes de: ${sinPunto(c.mensaje)}. El cambio de ahora también se guarda, por si quieres rehacerlo.`,
        opciones: [{ valor: 'si', icono: icono('visto'), clase: 'confirmar', nombre: 'Sí, volver atrás' }, { valor: 'no', icono: icono('cerrar'), nombre: 'No, dejarlo' }],
        alElegir: async x => {
          if (x !== 'si') return;
          const aviso = await cambiarPlan(structuredClone(c.plan), `Plan devuelto a como estaba antes de: ${sinPunto(c.mensaje).toLowerCase()}.`, nube);
          if (aviso) avisar(aviso);
          alCambiar?.();
        },
      });
    },
  });
}
