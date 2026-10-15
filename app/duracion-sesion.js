// Corregir la duración y la hora de inicio de una sesión ya guardada (como "Edit Workout" de Hevy): desde el resumen,
// la cabecera de una sesión guardada o el historial. Se guarda en el teléfono y se vuelve a subir a la cuenta con el
// mismo id, así la cuenta la reemplaza en vez de duplicarla.
import { E, guardar, avisar, numero, modoEjemplo } from './comun.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import { subirACuenta } from './cola.js';
import * as nube from './nube.js';

/** Los campos de hora y minutos que se ajustan entre sí (también en la hoja "Guardar sesión"). */
export const camposDuracionHtml = ({ hora, minutos }) => `<div class="ajustar-duracion">
  <label>Empezaste a las<input type="time" id="duracion-inicio" value="${hora || ''}"></label>
  <label>Duración (minutos)<input type="text" inputmode="numeric" id="duracion-minutos" value="${minutos ?? ''}" autocomplete="off"></label></div>`;

/** Enlaza los campos: guarda en `estado` la hora y los minutos escritos. */
export function enlazarCamposDuracion(estado) {
  const hora = document.getElementById('duracion-inicio'), mins = document.getElementById('duracion-minutos');
  if (!hora || !mins) return;
  hora.oninput = () => { if (/^\d{2}:\d{2}$/.test(hora.value)) estado.hora = hora.value; };
  mins.oninput = () => { const n = numero(mins.value); estado.minutos = n == null ? null : Math.round(n); };
}

/** null si está bien; si no, el aviso. */
export const errorDuracion = m => (m == null || !(m >= 1 && m <= 600) ? 'Escribe una duración entre 1 y 600 minutos.' : null);

export function editarDuracionGuardada(sesion, { volver = null, alCambiar } = {}) {
  const estado = { hora: sesion.hora || null, minutos: sesion.duracion_min ?? null };
  abrirHoja({
    titulo: 'Duración de la sesión', volver,
    nota: 'Si apretaste Empezar tarde o terminaste después, corrige aquí cuándo empezaste y cuánto duró.',
    contenido: camposDuracionHtml(estado),
    opciones: [{ valor: 'guardar', icono: icono('visto'), clase: 'confirmar', nombre: 'Guardar' }],
    alElegir: async v => {
      if (v !== 'guardar') return;
      const error = errorDuracion(estado.minutos);
      if (error) { avisar(error); return; }
      sesion.duracion_min = estado.minutos;
      if (estado.hora) sesion.hora = estado.hora;
      guardar();
      alCambiar?.();
      avisar('Duración corregida.');
      if (!modoEjemplo && sesion.origen !== 'ejemplo' && nube.conectado()) {
        const { id, enCuenta, ...datos } = sesion;
        await subirACuenta('sesion', id, datos); // cómo le fue lo cuenta la campanita (app/campana.js)
      }
    },
  });
  enlazarCamposDuracion(estado);
}
