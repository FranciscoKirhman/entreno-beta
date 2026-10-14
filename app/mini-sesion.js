// Sesión minimizada, como en Hevy: fuera de la pantalla de la sesión, una barra sobre el menú con el nombre, el tiempo
// que lleva, "Seguir" y "Descartar". Se dibuja fuera de la vista, así no se pierde al cambiar de pantalla.
import { E, esc } from './comun.js';
import { estadoHoy, descartarSesion, transcurrido, enPausa } from './hoy.js';
import { icono } from './iconos.js';

let reloj = null;
// Con el descanso corriendo, la barra muestra el descanso (como Hevy) y la barra del descanso se esconde.
const detalle = s => {
  const resta = document.body.classList.contains('con-descanso') && document.querySelector('#descanso .tiempo')?.textContent;
  return resta ? `Descanso ${resta}` : `${enPausa(s.f) ? 'En pausa, ' : ''}${transcurrido(s.f)} · ${s.avance.hechas} de ${s.avance.total} series`;
};

export function pintarMiniSesion(vista, ir) {
  let barra = document.getElementById('mini-sesion');
  const s = E.plan ? estadoHoy() : null;
  // No en la sesión ni encima de ella (el selector de ejercicios), donde no hay pestañas.
  const ver = Boolean(s?.enCurso && s.dia) && vista !== 'hoy' && vista !== 'inicio' && !document.body.classList.contains('en-sesion');
  clearInterval(reloj); reloj = null;
  document.body.classList.toggle('con-mini-sesion', ver);
  if (!ver) { barra?.remove(); return; }
  if (!barra) {
    barra = document.createElement('div');
    barra.id = 'mini-sesion';
    barra.setAttribute('role', 'region');
    barra.setAttribute('aria-label', 'Sesión en curso');
    document.body.append(barra);
  }
  barra.innerHTML = `<button type="button" class="mini-sesion-abrir" data-seguir>
      <span class="mini-sesion-icono" aria-hidden="true">${icono('pesa')}</span>
      <span class="mini-sesion-textos"><strong>${esc(s.dia.foco)}</strong><small id="mini-sesion-detalle">${detalle(s)}</small></span>
    </button>
    <button type="button" class="mini-sesion-seguir" data-seguir>Seguir</button>
    <button type="button" class="mini-sesion-descartar" data-descartar aria-label="Descartar la sesión">${icono('basurero')}</button>`;
  barra.querySelectorAll('[data-seguir]').forEach(b => b.onclick = () => ir('hoy', { sesion: true }));
  barra.querySelector('[data-descartar]').onclick = ev => descartarSesion({ volver: ev.currentTarget, alDescartar: () => ir(E.vista === 'hoy' ? 'entrenar' : E.vista) });
  reloj = setInterval(() => {
    const t = document.getElementById('mini-sesion-detalle');
    if (!t) { clearInterval(reloj); reloj = null; return; }
    t.textContent = detalle(s);
  }, 500);
}
