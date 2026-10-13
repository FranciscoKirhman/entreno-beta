import { E, ctxNucleo, cambiarPlan, avisar, presc, esc, hoy } from './comun.js';
import { editarSesion, siguientes } from '../nucleo/editar-sesion.js';
import { sesionDe } from '../nucleo/agenda.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';

const contexto = () => ({ ...ctxNucleo(), registro: E.registro, sesiones: E.sesiones });
const sinGuiones = t => t.replace(/[–—]/g, ' a ');
/** Cuántas sesiones vienen con la misma plantilla que hoy: con alguna, se puede elegir "desde hoy en adelante". */
const cuantasSiguen = () => (E.plan ? siguientes(E.plan, sesionDe(E.plan, hoy())).length : 0);

/** Agregar o quitar un ejercicio: muestra cómo queda hoy y, si la sesión se repite, pregunta si es solo hoy o desde
 *  hoy en adelante. Elegir es la confirmación. */
export function proponerEdicion(accion, { volver, alCambiar }) {
  const estado = E, usuario = nube.usuarioId();
  const r = editarSesion(accion, contexto());
  if (r.error) { avisar(sinGuiones(r.error)); return; }
  const agregar = accion.tipo === 'agregar';
  const n = cuantasSiguen();
  const adelante = n ? editarSesion({ ...accion, alcance: 'adelante' }, contexto()) : null;
  const opciones = [
    { valor: 'hoy', icono: icono(agregar ? 'visto' : 'cerrar'), nombre: n ? 'Solo hoy' : agregar ? 'Confirmar y agregar' : 'Confirmar y quitar', peligro: !agregar },
    ...(adelante && !adelante.error ? [{ valor: 'adelante', icono: icono(agregar ? 'visto' : 'cerrar'), nombre: `Desde hoy en adelante (${n === 1 ? 'y la próxima sesión igual' : `y las ${n} sesiones iguales que vienen`})`, peligro: !agregar }] : []),
    { valor: 'no', icono: icono('flecha'), nombre: 'Dejar como está' },
  ];
  abrirHoja({ titulo: agregar ? 'Agregar a la sesión de hoy' : 'Quitar de la sesión de hoy', volver,
    nota: `${r.ejercicio.nombre || 'Ejercicio'}${agregar ? `: ${presc(r.ejercicio)}` : ''}. ${r.cantidad ? `Hoy quedaría con ${r.cantidad} ${r.cantidad === 1 ? 'ejercicio' : 'ejercicios'}, unos ${r.minutos} minutos.` : 'Hoy quedaría sin ejercicios.'}${r.conservar?.length ? ` ${r.conservar.length === 1 ? 'Se conserva la serie ya hecha' : `Se conservan las ${r.conservar.length} series ya hechas`} al guardar la sesión.` : ''}${adelante?.error ? ` Desde hoy en adelante no se puede: ${sinGuiones(adelante.error)}` : n ? '' : ' Las otras sesiones se mantienen.'}`,
    opciones,
    alElegir: async v => {
      if (v === 'no') return;
      if (E !== estado || nube.usuarioId() !== usuario) return avisar('La cuenta cambió. Vuelve a revisar el cambio.');
      // Se vuelve a calcular: otra pantalla puede haber cambiado el plan o marcado series mientras estaba abierta.
      const final = { ...accion, alcance: v };
      const actual = editarSesion(final, contexto());
      if (actual.error) return avisar(sinGuiones(actual.error));
      const esperado = v === 'adelante' ? adelante : r;
      if (JSON.stringify(actual.plan) !== JSON.stringify(esperado.plan)) return proponerEdicion(accion, { volver, alCambiar });
      if (!agregar && actual.conservar?.length) {
        const f = contexto().hoy;
        ((E.retirados ||= {})[f] ||= {})[accion.ejercicio] = { ejercicio: structuredClone(actual.ejercicio), series: actual.conservar };
      }
      const donde = v === 'adelante' ? 'de hoy en adelante' : 'de hoy';
      const aviso = await cambiarPlan(actual.plan, `Se ${agregar ? 'agregó' : 'quitó'} ${r.ejercicio.nombre || 'el ejercicio'} ${agregar ? 'a' : 'de'} la sesión ${donde}.`, nube);
      if (aviso) avisar(aviso);
      alCambiar?.();
    },
  });
}

/** Ordenar los ejercicios de hoy, como en Hevy: se suben o bajan en la lista y se guarda solo hoy o desde hoy en
 *  adelante. Si una superserie queda separada, se hace como series normales. */
export function ordenarSesion({ volver, alCambiar }) {
  const dia = E.plan && sesionDe(E.plan, hoy());
  if (!dia || dia.ejercicios.length < 2) return avisar('Hoy hay menos de dos ejercicios para ordenar.');
  const estado = E;
  let orden = dia.ejercicios.map((e, i) => ({ id: e.ejercicio_id || `i${i}`, nombre: e.nombre || 'Ejercicio', ss: e.superserie }));
  const n = cuantasSiguen();
  const lista = () => orden.map((x, i) => `<li><span class="num suave">${i + 1}</span><span class="nombre-orden">${esc(x.nombre)}${x.ss ? ` <span class="chip">${esc(x.ss)}</span>` : ''}</span>
    <button type="button" class="boton-icono" data-subir="${i}" aria-label="Subir ${esc(x.nombre)}"${i === 0 ? ' disabled' : ''}>${icono('flecha', 'icono flecha-arriba')}</button>
    <button type="button" class="boton-icono" data-bajar="${i}" aria-label="Bajar ${esc(x.nombre)}"${i === orden.length - 1 ? ' disabled' : ''}>${icono('flecha', 'icono flecha-abajo')}</button></li>`).join('');
  abrirHoja({
    titulo: 'Ordenar los ejercicios de hoy', volver,
    nota: 'Sube o baja cada ejercicio. Si separas una superserie, se hace como series normales.',
    contenido: `<ol class="lista-orden" id="lista-orden">${lista()}</ol>`,
    opciones: [{ valor: 'hoy', icono: icono('visto'), clase: 'confirmar', nombre: n ? 'Guardar solo hoy' : 'Guardar el orden' },
      ...(n ? [{ valor: 'adelante', icono: icono('visto'), clase: 'confirmar', nombre: `Guardar desde hoy en adelante (${n === 1 ? 'y la próxima sesión igual' : `y las ${n} sesiones iguales que vienen`})` }] : []),
      { valor: 'no', icono: icono('flecha'), nombre: 'Dejar como está' }],
    alElegir: async v => {
      if (v === 'no' || E !== estado) return;
      const r = editarSesion({ tipo: 'ordenar', orden: orden.map(x => x.id), alcance: v }, contexto());
      if (r.error) return avisar(sinGuiones(r.error));
      const aviso = await cambiarPlan(r.plan, `Orden guardado${v === 'adelante' ? ' de hoy en adelante' : ' para hoy'}.`, nube);
      if (aviso) avisar(aviso);
      alCambiar?.();
    },
  });
  const ol = document.getElementById('lista-orden');
  ol.addEventListener('click', ev => {
    const b = ev.target.closest('[data-subir],[data-bajar]');
    if (!b) return;
    const i = Number(b.dataset.subir ?? b.dataset.bajar), j = b.dataset.subir != null ? i - 1 : i + 1;
    if (j < 0 || j >= orden.length) return;
    [orden[i], orden[j]] = [orden[j], orden[i]];
    ol.innerHTML = lista();
    ol.querySelector(`[data-${b.dataset.subir != null ? 'subir' : 'bajar'}="${j}"]`)?.focus();
  });
}
