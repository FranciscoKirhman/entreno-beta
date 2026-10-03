// Crear la cuenta o entrar: con Google o Apple cuando estén activados en el servidor (los botones aparecen solos)
// y con el correo, en Más. Sin servidor (versión sin cuentas) no se muestra nada.
import { guardar } from './comun.js';
import * as nube from './nube.js';

const NOMBRES = { google: 'Continuar con Google', apple: 'Continuar con Apple' };

/** Tarjeta para crear la cuenta o entrar, para el inicio, el plan nuevo y el resumen de la sesión. */
export function cuentaNuevaHtml({ titulo = 'Crea tu cuenta', texto = 'Guarda tu plan y tus sesiones para no perderlos si cambias o pierdes el teléfono.' } = {}) {
  if (!nube.hay() || nube.conectado()) return '';
  return `<section class="tarjeta cuenta-nueva"><h3>${titulo}</h3><p class="pequeno">${texto}</p>
    <div class="cuenta-proveedores" data-proveedores></div>
    <button type="button" class="boton" id="cuenta-correo">Con tu correo</button>
    <p class="pequeno" data-estado-cuenta role="status" aria-live="polite"></p></section>`;
}

/** Pone los botones de Google y Apple que estén listos en cada [data-proveedores] de la pantalla. */
export function pintarProveedores() {
  const cajas = [...document.querySelectorAll('[data-proveedores]')];
  if (!cajas.length) return;
  nube.proveedoresDisponibles().then(p => {
    const listos = ['google', 'apple'].filter(x => p[x]);
    for (const caja of cajas) {
      if (!caja.isConnected) continue;
      caja.innerHTML = listos.map(x => `<button type="button" class="boton primario" data-proveedor="${x}">${NOMBRES[x]}</button>`).join('');
      const tarjeta = caja.closest('section') || caja.parentElement;
      // Sin Google ni Apple, el correo pasa a ser el camino principal.
      tarjeta.querySelector('#cuenta-correo')?.classList.toggle('primario', !listos.length);
      caja.querySelectorAll('[data-proveedor]').forEach(b => {
        b.onclick = async () => {
          const estado = tarjeta.querySelector('[data-estado-cuenta]');
          b.disabled = true;
          guardar(); // sale a la página del proveedor: lo de este teléfono queda guardado antes
          try { await nube.entrarCon(b.dataset.proveedor); }
          catch (e) { b.disabled = false; if (estado) estado.textContent = `No pude abrir ${NOMBRES[b.dataset.proveedor].replace('Continuar con ', '')}: ${e.message}`; }
        };
      });
    }
  });
}

export function enlazarCuentaNueva(ir) {
  const correo = document.getElementById('cuenta-correo');
  if (correo) correo.onclick = () => {
    ir('mas');
    document.getElementById('cuenta')?.scrollIntoView({ block: 'start' });
    document.getElementById('correo')?.focus({ preventScroll: true });
  };
  pintarProveedores();
}
