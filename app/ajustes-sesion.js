// Ajustes de la sesión, como el botón "Settings" de Hevy durante el entrenamiento: lo que cambia cómo se anota, sin
// salir de la sesión. Se guardan en E.ajustesSesion (solo en este teléfono); unidades y tema siguen en Más.
import { E, R, guardar } from './comun.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import { actualizarPantalla, encendidaDisponible } from './pantalla.js';

const DESCANSOS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const reloj = seg => (seg ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}` : 'Apagado');

/** Lo elegido, con sus valores por defecto (todo encendido, como viene Hevy). */
export const ajuste = clave => ({ esfuerzo: true, avisoRecord: true, sonido: true, superserieSigue: true, descanso: 90, ...(E.ajustesSesion || {}) })[clave];
const poner = (clave, valor) => { (E.ajustesSesion ||= {})[clave] = valor; guardar(); };

const interruptor = (id, texto, activo, ayuda = '') => `<label class="ajuste-sesion"><span><strong>${texto}</strong>${ayuda ? `<small>${ayuda}</small>` : ''}</span><input type="checkbox" role="switch" class="interruptor" data-ajuste="${id}"${activo ? ' checked' : ''}></label>`;

export function abrirAjustesSesion(volver, { ir, alCambiar }) {
  const modo = R().escala_esfuerzo === 'rir' ? 'RIR' : 'RPE';
  abrirHoja({
    titulo: 'Ajustes de la sesión', volver,
    contenido: `<div class="ajustes-sesion">
      ${interruptor('pantalla', 'Pantalla encendida', E.pantallaEncendida !== false, encendidaDisponible() ? 'Mientras entrenas, el teléfono no se apaga solo.' : 'Este navegador no lo permite.')}
      ${interruptor('esfuerzo', `Columna de esfuerzo (${modo})`, ajuste('esfuerzo'), 'Ocúltala si no anotas el esfuerzo de cada serie.')}
      ${interruptor('avisoRecord', 'Aviso de récord al marcar', ajuste('avisoRecord'), 'La medalla que aparece al superar una marca.')}
      ${interruptor('sonido', 'Sonido del descanso', ajuste('sonido'), 'Un pitido corto al terminar. La vibración sigue.')}
      ${interruptor('superserieSigue', 'Superserie: ir al ejercicio siguiente', ajuste('superserieSigue'), 'Al marcar una serie, la pantalla baja sola al que sigue.')}
    </div>`,
    opciones: [
      { valor: 'descanso', icono: icono('reloj'), nombre: `Descanso por defecto: ${reloj(ajuste('descanso'))}` },
      { valor: 'unidades', icono: icono('ajustes'), nombre: 'Unidades, esfuerzo RPE o RIR y tema' },
      { valor: 'listo', icono: icono('visto'), clase: 'confirmar', nombre: 'Listo' },
    ],
    alElegir: v => {
      if (v === 'unidades') ir('mas', { panel: 'pantalla' });
      else if (v === 'descanso') abrirHoja({
        titulo: 'Descanso por defecto', volver,
        nota: 'Para los ejercicios que no traen descanso en el plan. Cada ejercicio puede tener el suyo desde su línea "Descanso".',
        opciones: DESCANSOS.map(x => ({ valor: String(x), icono: x === ajuste('descanso') ? icono('visto') : '', clase: 'confirmar', nombre: reloj(x) })),
        alElegir: x => { poner('descanso', Number(x)); alCambiar?.(); abrirAjustesSesion(volver, { ir, alCambiar }); },
      });
      else alCambiar?.();
    },
  });
  document.querySelectorAll('#hoja [data-ajuste]').forEach(c => c.onchange = () => {
    if (c.dataset.ajuste === 'pantalla') { E.pantallaEncendida = c.checked; guardar(); actualizarPantalla(); }
    else poner(c.dataset.ajuste, c.checked);
  });
}
