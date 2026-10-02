// Ilustraciones decorativas: acompañan el texto sin tapar los datos ni las acciones.
import { esc, fechaCorta } from './comun.js';
import { imagenAsistente } from './cuestionario.js';
import { hayImagen } from './imagenes.js';

export function descansoHtml(proxima) {
  return `<section class="tarjeta descanso-ilustrado">
    <div class="estado-ilustrado">
      <div class="estado-texto"><h3>Hoy descansas</h3><p class="suave">Un espacio para recuperar energía.</p></div>
      ${imagenAsistente('descanso', 'estado-personaje')}
    </div>
    ${proxima ? `<p class="pequeno suave proxima-sesion">La próxima es <strong>${esc(proxima.foco)}</strong>, el ${esc(fechaCorta(proxima.fecha))}.</p>` : ''}
    <button type="button" class="boton" id="entrenar-igual">Quiero entrenar hoy igual</button>
  </section>`;
}

export function bienvenidaProgreso() {
  return `<section class="tarjeta estado-ilustrado progreso-ilustrado">
    <div class="estado-texto"><h3>Cómo te ha ido hasta ahora</h3><p class="pequeno suave">Tu semana, tus sesiones y lo que vas registrando.</p></div>
    ${imagenAsistente('progreso', 'estado-personaje')}
  </section>`;
}

export function historialVacio() {
  const src = 'img/pantallas/sin_historial.webp';
  return `<div class="historial-vacio">${hayImagen(src) ? `<img src="${src}" alt="" width="144" height="144" loading="lazy" decoding="async">` : ''}
    <p class="pequeno suave">Todavía no hay sesiones. Marca tus series en Hoy, o importa tu historial de Hevy en Más.</p>
  </div>`;
}
