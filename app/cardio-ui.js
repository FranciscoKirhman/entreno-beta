import { E, $, ctxNucleo, cambiarPlan, avisar } from './comun.js';
import { CARDIOS, motivoNoCardio, editarCardio } from '../nucleo/cardio.js';
import { abrirHoja } from './hoja.js';
import { hayImagen } from './imagenes.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';

export function elegirCardio({ volver, alCambiar }) {
  const opciones = CARDIOS.map(c => {
    const motivo = motivoNoCardio(c, ctxNucleo());
    return { valor: c.id, imagen: hayImagen(c.imagen) ? c.imagen : null, nombre: `${c.nombre}${motivo ? ' · No disponible' : ''}`,
      ayuda: motivo || 'Elige los minutos y revisa antes de guardar.' };
  });
  const dia = E.plan?.dias.find(d => d.fecha === ctxNucleo().hoy);
  abrirHoja({ titulo: 'Banco de cardio', nota: '9 opciones con imágenes. Se cambia solo el cardio de hoy.', volver,
    opciones: [...opciones, ...(dia?.cardio ? [{ valor: 'quitar', nombre: 'Quitar el cardio de hoy', icono: icono('cerrar'), peligro: true }] : [])],
    alElegir: id => {
      if (id === 'quitar') return confirmar({ id: null }, alCambiar);
      const c = CARDIOS.find(x => x.id === id), motivo = motivoNoCardio(c, ctxNucleo());
      if (motivo) { avisar(motivo); return elegirCardio({ volver, alCambiar }); }
      abrirHoja({ titulo: c.nombre, nota: 'Elige el tiempo. Puedes escribir otro número de minutos.',
        opciones: [5, 10, 15, 20, 30, 45, 60].map(n => ({ valor: String(n), imagen: hayImagen(c.imagen) ? c.imagen : null, nombre: `${n} minutos` })),
        alElegir: n => ritmo(c, Number(n), alCambiar) });
      // Alternativa editable para duraciones que no están en los accesos rápidos.
      const lista = document.querySelector('#hoja .opciones-hoja');
      lista.insertAdjacentHTML('beforebegin', '<form id="cardio-minutos-form" class="cardio-minutos"><label for="cardio-minutos">Minutos</label><input id="cardio-minutos" type="number" min="1" max="60" value="10" required><button class="boton" type="submit">Elegir</button></form>');
      $('cardio-minutos-form').onsubmit = ev => { ev.preventDefault(); const n = Number($('cardio-minutos').value); if (Number.isInteger(n) && n >= 1 && n <= 60) ritmo(c, n, alCambiar); };
    } });
}
function ritmo(c, minutos, alCambiar) {
  abrirHoja({ titulo: `${c.nombre}, ${minutos} minutos`, opciones: [
    { valor: 'suave', nombre: 'Ritmo suave', imagen: hayImagen(c.imagen) ? c.imagen : null },
    { valor: 'moderado', nombre: 'Ritmo moderado', imagen: hayImagen(c.imagen) ? c.imagen : null }],
    alElegir: ritmo => confirmar({ id: c.id, minutos, ritmo }, alCambiar) });
}
function confirmar(accion, alCambiar) {
  const estado = E, usuario = nube.usuarioId(), r = editarCardio(accion, ctxNucleo());
  if (r.error) return abrirHoja({ titulo: 'Revisar el cardio', nota: r.error.replace(/[–—]/g, ' a '),
    opciones: [{ valor: 'volver', nombre: 'Elegir otro tiempo o actividad', icono: icono('flecha') }], alElegir: () => elegirCardio({ alCambiar }) });
  abrirHoja({ titulo: 'Confirmar cardio de hoy', nota: `${r.texto || 'Se quitaría el cardio de hoy'} La sesión completa quedaría en unos ${r.minutosSesion} minutos.`,
    opciones: [{ valor: 'si', nombre: accion.id === null ? 'Confirmar y quitar cardio' : 'Confirmar cardio', icono: icono('visto') }, { valor: 'no', nombre: 'Dejar como está', icono: icono('flecha') }],
    alElegir: async v => {
      if (v !== 'si') return;
      if (estado !== E || usuario !== nube.usuarioId()) return avisar('La cuenta cambió. Vuelve a revisar el cardio.');
      const actual = editarCardio(accion, ctxNucleo());
      if (actual.error) return avisar(actual.error);
      if (JSON.stringify(actual.plan) !== JSON.stringify(r.plan)) return confirmar(accion, alCambiar);
      const aviso = await cambiarPlan(actual.plan, accion.id === null ? 'Cardio quitado de hoy.' : 'Cardio actualizado para hoy.', nube);
      if (aviso) avisar(aviso);
      alCambiar?.();
    } });
}
