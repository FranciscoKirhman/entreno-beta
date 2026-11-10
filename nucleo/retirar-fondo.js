// Retirar el fondo de una hoja que se cierra sin dejar pasar el segundo toque de un doble toque.
// iOS busca el destino del clic al levantar el dedo: un toque que empieza sobre el fondo puede soltar su clic cuando el
// fondo ya no está, y marcar la serie que quedaba debajo. Por eso el fondo se queda RETENCION_MS y, si hay un dedo
// apoyado, espera su clic (o ESPERA_CLIC_MS desde que se levanta) antes de irse. TOPE_MS lo saca pase lo que pase.
// Medido con toques reales en el simulador (docs/48-plan-simplificar-ui.md, entrega P): 240 ms no alcanzan, 400 sí.
export const RETENCION_MS = 400;
export const ESPERA_CLIC_MS = 500;
export const TOPE_MS = 3000;

/**
 * Empieza a seguir los toques sobre el fondo desde que la hoja se abre, para que al cerrar ya se sepa si hay un dedo
 * apoyado (el segundo toque puede empezar antes del clic que cierra).
 * @param fondo  elemento con addEventListener y remove
 * @param reloj  { setTimeout, clearTimeout }, para las pruebas
 * @returns {() => void} retirar: se llama al cerrar la hoja
 */
export function vigilarFondo(fondo, reloj = globalThis) {
  let cerrando = false, cumplido = false, dedos = 0, esperandoClic = false, espera = null, fuera = false;
  const sacar = () => { if (!fuera) { fuera = true; fondo.remove(); } };
  const probar = () => { if (cerrando && cumplido && !dedos && !esperandoClic) sacar(); };
  const soltar = () => {
    dedos = Math.max(0, dedos - 1);
    esperandoClic = true;
    reloj.clearTimeout(espera);
    espera = reloj.setTimeout(() => { esperandoClic = false; probar(); }, ESPERA_CLIC_MS);
  };
  fondo.addEventListener('touchstart', () => { dedos++; }, { passive: true });
  fondo.addEventListener('touchend', soltar, { passive: true });
  fondo.addEventListener('touchcancel', soltar, { passive: true });
  // El clic cierra la espera del toque que ya se levantó; un dedo que sigue apoyado se sigue esperando.
  fondo.addEventListener('click', () => { reloj.clearTimeout(espera); esperandoClic = false; probar(); });
  return () => {
    if (cerrando) return;
    cerrando = true;
    reloj.setTimeout(() => { cumplido = true; probar(); }, RETENCION_MS);
    reloj.setTimeout(sacar, TOPE_MS);
  };
}

/** Lo mismo para un fondo que no se venía siguiendo: empieza a mirar los toques desde ahora. */
export function retirarFondo(fondo, reloj = globalThis) {
  vigilarFondo(fondo, reloj)();
}
