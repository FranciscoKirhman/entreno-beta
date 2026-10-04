// Animaciones de ejercicios dentro de la app: la figura de app/figura.js con el movimiento de nucleo/animaciones.js.
// La figura es de hombre o de mujer según el sexo del perfil, se encuadra sola y se mueve únicamente mientras está a la
// vista (un solo reloj para todas). Si el teléfono pide reducir movimiento, queda quieta y se puede ver con un toque.
import { R, esc } from './comun.js';
import { crearFigura, varianteDe, VARIANTES } from './figura.js';
import { crearFiguraFrente } from './figura-frente.js';
import { proyectarPose } from '../nucleo/animaciones-frente.js';
import { medidas, enElTiempo } from '../nucleo/animacion-ejercicios.js';
import { encuadre } from '../nucleo/animaciones.js';
import { sinMovimiento } from './movimiento.js';

const K = 100; // píxeles por metro dentro del dibujo
let activas = [], cuadro = 0, inicio = performance.now();
const mirar = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(es => { for (const e of es) { const a = activas.find(x => x.caja === e.target); if (a) a.visible = e.isIntersecting; } seguir(); }, { rootMargin: '80px' })
  : null;

function pintar(a, segundos) {
  const { s, fase, enFase } = a.corre ? enElTiempo(a.anim, segundos + a.t0) : { s: 1, fase: a.anim.fases[0], enFase: 0 };
  const p = a.anim.pose(s, a.m, fase, enFase);
  a.figura.dibujar({ ...(a.anim.vista === 'frente' ? proyectarPose(p, a.anim.camara) : p), radioCabeza: a.m.cabeza });
}
function seguir() {
  activas = activas.filter(a => a.caja.isConnected);
  if (cuadro || !activas.some(a => a.visible && a.corre)) return;
  const paso = ahora => {
    cuadro = 0;
    activas = activas.filter(a => a.caja.isConnected);
    const vivas = activas.filter(a => a.visible && a.corre);
    for (const a of vivas) pintar(a, (ahora - inicio) / 1000);
    if (vivas.length) cuadro = requestAnimationFrame(paso);
  };
  cuadro = requestAnimationFrame(paso);
}

/** Pone la animación dentro de "caja". nombre: para el lector de pantalla. */
export function montarAnimacion(caja, anim, { nombre = '' } = {}) {
  if (!caja || !anim) return;
  const variante = varianteDe(R()), m = medidas(VARIANTES[variante].estatura), e = encuadre(anim, m);
  const x = e.x * K, y = -(e.y + e.lado) * K, lado = e.lado * K;
  caja.innerHTML = `<svg viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${lado.toFixed(1)} ${lado.toFixed(1)}" role="img" aria-label="${esc(`Cómo se mueve: ${nombre}`)}">
    ${anim.suelo === false ? '' : `<line x1="${(x - 10).toFixed(1)}" y1="0" x2="${(x + lado + 10).toFixed(1)}" y2="0" stroke="var(--line)" stroke-width="1.5"/>`}<g></g></svg>`;
  const crear = anim.vista === 'frente' ? crearFiguraFrente : crearFigura; // de frente: los que giran o van hacia el costado
  const a = { caja, anim, m, figura: crear(caja.querySelector('g'), { escala: K, variante }), visible: !mirar, corre: !sinMovimiento(), t0: Math.random() * 2 };
  if (!a.corre) {
    // Con reducir movimiento queda quieta; un toque la pone en movimiento.
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ver-movimiento'; b.textContent = 'Ver el movimiento';
    b.onclick = () => { a.corre = !a.corre; b.textContent = a.corre ? 'Detener' : 'Ver el movimiento'; if (!a.corre) pintar(a, 0); seguir(); };
    caja.append(b);
  }
  activas.push(a);
  pintar(a, 0);
  mirar?.observe(caja);
  seguir();
}

/** Monta todas las animaciones marcadas con [data-animar] dentro de "raiz", con la función que entrega cada una. */
export function montarAnimaciones(raiz, buscar) {
  raiz?.querySelectorAll('[data-animar]').forEach(caja => { const anim = buscar(caja); if (anim) montarAnimacion(caja, anim, { nombre: caja.dataset.animar }); else caja.remove(); });
}
