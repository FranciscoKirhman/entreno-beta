// Ajustes de la sesión, como "Workout Settings" de Hevy: arriba las filas con su valor (descanso por defecto, valores
// anteriores) y debajo los interruptores, cada uno con su explicación. Se guardan en E.ajustesSesion (este teléfono);
// unidades y tema siguen en Perfil.
import { E, R, esc, guardar } from './comun.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import { actualizarPantalla, encendidaDisponible } from './pantalla.js';
import { cambiarAvisoCerrada, avisoCerradaActivo, avisoCerradaDisponible } from './aviso-descanso.js';
import { avisar } from './comun.js';

const DESCANSOS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const ANTERIOR = { rutina: 'Misma sesión del plan', cualquiera: 'Cualquier sesión' };
const largo = seg => (seg ? [Math.floor(seg / 60) && `${Math.floor(seg / 60)} min`, seg % 60 && `${seg % 60} s`].filter(Boolean).join(' ') : 'Apagado');

/** Lo elegido, con sus valores por defecto (todo encendido, como viene Hevy; "anterior" de la misma sesión del plan). */
export const ajuste = clave => ({ esfuerzo: true, avisoRecord: true, sonido: true, superserieSigue: true, discos: true, cronoFila: true, descanso: 90, anterior: 'rutina', ...(E.ajustesSesion || {}) })[clave];
const poner = (clave, valor) => { (E.ajustesSesion ||= {})[clave] = valor; guardar(); };

const fila = (id, texto, valor) => `<button type="button" class="ajuste-fila" data-ajuste-fila="${id}"><span>${texto}</span><span class="ajuste-valor">${esc(valor)}</span>${icono('flecha', 'icono ajuste-flecha')}</button>`;
const interruptor = (id, texto, activo, ayuda) => `<label class="ajuste-sesion"><span class="ajuste-cab"><strong>${texto}</strong><input type="checkbox" role="switch" class="interruptor" data-ajuste="${id}"${activo ? ' checked' : ''}></span><small>${ayuda}</small></label>`;

export function abrirAjustesSesion(volver, { ir, alCambiar }) {
  const modo = R().escala_esfuerzo === 'rir' ? 'RIR' : 'RPE';
  const reabrir = () => abrirAjustesSesion(volver, { ir, alCambiar });
  abrirHoja({
    titulo: 'Ajustes de la sesión', volver,
    contenido: `<div class="ajustes-sesion">
      <div class="ajustes-grupo">
        ${fila('descanso', 'Descanso por defecto', largo(ajuste('descanso')))}
        ${fila('anterior', 'Valores anteriores', ANTERIOR[ajuste('anterior')])}
        ${fila('unidades', 'Unidades, esfuerzo y tema', `kg o lb, ${modo}`)}
      </div>
      <div class="ajustes-grupo">
        ${interruptor('pantalla', 'Pantalla encendida', E.pantallaEncendida !== false, encendidaDisponible() ? 'Actívalo si no quieres que el teléfono se apague mientras entrenas.' : 'Este navegador no lo permite.')}
        ${interruptor('discos', 'Calculadora de discos', ajuste('discos'), 'Calcula los discos que van en cada lado de la barra. Aparece en el menú de los ejercicios con barra.')}
        ${interruptor('esfuerzo', `Esfuerzo (${modo})`, ajuste('esfuerzo'), `El ${modo} mide qué tan dura fue cada serie. Activado, lo anotas en cada serie de la sesión.`)}
        ${interruptor('superserieSigue', 'Superserie: ir al siguiente', ajuste('superserieSigue'), 'Al marcar una serie, la pantalla baja sola al ejercicio que sigue en la superserie.')}
        ${interruptor('cronoFila', 'Cronómetro en la fila', ajuste('cronoFila'), 'Los ejercicios por tiempo traen su cronómetro en cada serie.')}
        ${interruptor('avisoRecord', 'Aviso de récord', ajuste('avisoRecord'), 'Te avisa cuando logras un récord al marcar la serie.')}
        ${interruptor('sonido', 'Sonido del descanso', ajuste('sonido'), 'Un pitido corto al terminar el descanso. La vibración sigue.')}
        ${interruptor('avisoCerrada', 'Aviso con la pantalla bloqueada', avisoCerradaActivo(), avisoCerradaDisponible() ? 'Una notificación cuando termina el descanso, aunque la app esté cerrada.' : 'Una notificación cuando termina el descanso. En iPhone, con la app instalada en la pantalla de inicio.')}
      </div>
    </div>`,
    opciones: [{ valor: 'listo', icono: icono('visto'), clase: 'confirmar', nombre: 'Listo' }],
    alElegir: () => alCambiar?.(),
  });
  const hoja = document.getElementById('hoja');
  hoja.querySelectorAll('[data-ajuste]').forEach(c => c.onchange = () => {
    if (c.dataset.ajuste === 'pantalla') { E.pantallaEncendida = c.checked; guardar(); actualizarPantalla(); }
    else if (c.dataset.ajuste === 'avisoCerrada') cambiarAvisoCerrada(c.checked).then(error => { if (error) { c.checked = false; avisar(error); } else if (c.checked) avisar('Listo: te aviso cuando termine el descanso, aunque la pantalla esté bloqueada.'); });
    else poner(c.dataset.ajuste, c.checked);
  });
  hoja.querySelectorAll('[data-ajuste-fila]').forEach(b => b.onclick = () => {
    const que = b.dataset.ajusteFila;
    if (que === 'unidades') { ir('mas', { panel: 'pantalla' }); return; }
    if (que === 'descanso') abrirHoja({
      titulo: 'Descanso por defecto', volver,
      nota: 'Para los ejercicios que no traen descanso en el plan. Cada ejercicio puede tener el suyo desde su línea "Descanso".',
      opciones: DESCANSOS.map(x => ({ valor: String(x), icono: x === ajuste('descanso') ? icono('visto') : '', clase: 'confirmar', nombre: largo(x) })),
      alElegir: x => { poner('descanso', Number(x)); alCambiar?.(); reabrir(); },
    });
    if (que === 'anterior') abrirHoja({
      titulo: 'Valores anteriores', volver,
      nota: 'Qué se muestra en la columna Anterior: lo de la última vez que hiciste esta misma sesión del plan (por ejemplo, Torso A con Torso A) o lo de la última vez que hiciste el ejercicio en cualquier sesión.',
      opciones: Object.entries(ANTERIOR).map(([v, t]) => ({ valor: v, icono: v === ajuste('anterior') ? icono('visto') : '', clase: 'confirmar', nombre: t })),
      alElegir: x => { poner('anterior', x); alCambiar?.(); reabrir(); },
    });
  });
}
