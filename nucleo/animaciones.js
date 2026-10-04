// Los movimientos de todos los ejercicios, calentamientos y estiramientos, para animar la figura de app/figura.js.
// Cada familia (sentadilla, bisagra, press, remo...) es un movimiento con parámetros: cada ejercicio elige su familia y
// sus ajustes (carga, banco, polea). Todo se calcula con proporciones humanas: los pies quedan en el suelo, las manos en
// la barra y la carga sobre la mitad del pie cuando la técnica lo pide.
//
// Convenciones: metros; x hacia adelante, y hacia arriba; suelo en y = 0. Ángulos en grados desde la vertical hacia
// arriba, positivos hacia adelante (180 es hacia abajo). De pie, la figura mira hacia +x; acostada boca arriba, la
// cabeza va hacia −x (así la cara mira al techo); boca abajo, la cabeza va hacia +x.
// s va de 0 a 1 dentro de cada repetición; las fases dicen el ritmo. Los que van hacia el costado o giran se ven de
// frente: están en nucleo/animaciones-frente.js (vista: 'frente').
import { desde, dosSegmentos, raiz } from './animacion-ejercicios.js';
import { FRENTE, PASOS_FRENTE, proyectarPose } from './animaciones-frente.js';

const R = g => (g * Math.PI) / 180;
const D = (o, largo, g) => desde(o, largo, R(g));
const mix = (a, b, s) => a + (b - a) * s;
const mixP = (p, q, s) => ({ x: mix(p.x, q.x, s), y: mix(p.y, q.y, s) });
const mas = (p, x, y) => ({ x: p.x + x, y: p.y + y });
const angulo = (a, b) => (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
const distancia = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const largoBrazo = m => m.brazo + m.antebrazo;

// ── Fases (ritmo de cada repetición) ──────────────────────────────────────────────────────────────────────────
const F = (nombre, seg, de, a, extra = {}) => ({ nombre, seg, de, a, ...extra });
export const RITMOS = {
  bajaSube: [F('Baja', 2, 0, 1), F('Abajo', 0.3, 1, 1), F('Sube', 1.2, 1, 0), F('Arriba', 0.7, 0, 0)],
  empuja: [F('Baja', 2, 0, 1), F('Abajo', 0.3, 1, 1), F('Empuja', 1, 1, 0), F('Arriba', 0.6, 0, 0)],
  tira: [F('Tira', 1, 0, 1), F('Aprieta', 0.4, 1, 1), F('Vuelve', 2, 1, 0), F('Estira', 0.4, 0, 0)],
  sube: [F('Sube', 1, 0, 1), F('Arriba', 0.5, 1, 1), F('Baja', 2, 1, 0), F('Abajo', 0.3, 0, 0)],
  extiende: [F('Extiende', 1, 0, 1), F('Aprieta', 0.4, 1, 1), F('Vuelve', 2, 1, 0), F('Pausa', 0.3, 0, 0)],
  levanta: [F('Sube', 1.4, 1, 0), F('Arriba', 0.6, 0, 0), F('Baja', 1.8, 0, 1), F('Abajo', 0.4, 1, 1)],
  balanceo: [F('Sube', 0.7, 1, 0), F('Arriba', 0.15, 0, 0), F('Baja', 0.7, 0, 1), F('Abajo', 0.1, 1, 1)],
  mantiene: [F('Entra', 1.2, 0, 1), F('Mantén', 3.6, 1, 1, { respira: true }), F('Sale', 1, 1, 0), F('Descansa', 0.5, 0, 0)],
  sostiene: [F('Mantén', 4, 1, 1, { respira: true })],
  alterna: [F('Un lado', 1.4, 0, 1), F('Vuelve', 1, 1, 0), F('Pausa', 0.3, 0, 0)],
  camina: [F('Camina', 1.1, 0, 1, { lineal: true })],
  trota: [F('Trota', 0.72, 0, 1, { lineal: true })],
  sube_escalon: [F('Sube', 1.6, 0, 1, { lineal: true })],
  circulos: [F('Gira', 2.4, 0, 1, { lineal: true })],
};
/** Una oscilación suave para respirar mientras se mantiene una postura (0 fuera de "Mantén"). */
const respira = (fase, enFase) => (fase?.respira ? Math.sin((enFase / 3.6) * Math.PI * 2) : 0);

// ── Piezas del cuerpo ─────────────────────────────────────────────────────────────────────────────────────────
/** Pie desde el tobillo. ang: dirección del talón a la punta (0 = plano hacia adelante; positivo, punta arriba). */
export function pie(m, tobillo, ang = 0) {
  const d = { x: Math.cos(R(ang)), y: Math.sin(R(ang)) }, suela = { x: d.y, y: -d.x }, h = m.tobillo, L = m.pie;
  return {
    tobillo,
    talon: { x: tobillo.x - d.x * 0.27 * L + suela.x * h, y: tobillo.y - d.y * 0.27 * L + suela.y * h },
    punta: { x: tobillo.x + d.x * 0.73 * L + suela.x * h, y: tobillo.y + d.y * 0.73 * L + suela.y * h },
  };
}
/** Pie apoyado en la punta (talón levantado o pie apuntando hacia abajo). */
function pieDesdePunta(m, punta, ang) {
  const d = { x: Math.cos(R(ang)), y: Math.sin(R(ang)) }, suela = { x: d.y, y: -d.x };
  return pie(m, { x: punta.x - d.x * 0.73 * m.pie - suela.x * m.tobillo, y: punta.y - d.y * 0.73 * m.pie - suela.y * m.tobillo }, ang);
}
/** Pie apoyado en el talón (punta hacia arriba). */
function pieDesdeTalon(m, talon, ang) {
  const d = { x: Math.cos(R(ang)), y: Math.sin(R(ang)) }, suela = { x: d.y, y: -d.x };
  return pie(m, { x: talon.x + d.x * 0.27 * m.pie - suela.x * m.tobillo, y: talon.y + d.y * 0.27 * m.pie - suela.y * m.tobillo }, ang);
}
/** Pie que sigue a la pierna: la punta hacia el lado de la tibia (para pies en el aire). extra: punta más abajo (+). */
function pieDeLaPierna(m, rodilla, tobillo, extra = 0) {
  const u = { x: tobillo.x - rodilla.x, y: tobillo.y - rodilla.y }, L = Math.hypot(u.x, u.y) || 1;
  return pie(m, tobillo, (Math.atan2(u.x / L, -u.y / L) * 180) / Math.PI - extra);
}
/** Elige entre las dos soluciones de dos segmentos la que queda hacia "pref". */
function ik(a, objetivo, l1, l2, pref) {
  const c1 = dosSegmentos(a, objetivo, l1, l2, 1), c2 = dosSegmentos(a, objetivo, l1, l2, -1), medio = mixP(a, objetivo, 0.5);
  const puntaje = c => (c.x - medio.x) * pref.x + (c.y - medio.y) * pref.y;
  return puntaje(c1) >= puntaje(c2) ? c1 : c2;
}
const brazoIK = (m, hombro, mano, pref = { x: 0, y: -1 }, kb = 1, ka = 1) => ({ codo: ik(hombro, mano, m.brazo * kb, m.antebrazo * ka, pref), mano });
const brazoFK = (m, hombro, a1, a2 = a1, kb = 1, ka = 1) => { const codo = D(hombro, m.brazo * kb, a1); return { codo, mano: D(codo, m.antebrazo * ka, a2) }; };
const piernaIK = (m, cadera, tobillo, pref = { x: 1, y: 0.2 }) => ik(cadera, tobillo, m.muslo, m.pierna, pref);
/** Cabeza sobre los hombros, con su eje en "ang" grados. */
function cabeza(m, hombro, ang) { const base = D(hombro, m.cuello * 0.35, ang); return { base, cabeza: D(base, m.cuello * 0.65 + m.cabeza, ang) }; }
/** Un punto del tronco: u a lo largo (desde la cadera) y v hacia el pecho. */
function enTronco(cadera, hombro, u, v) {
  const L = distancia(cadera, hombro) || 1, t = { x: (hombro.x - cadera.x) / L, y: (hombro.y - cadera.y) / L }, frente = { x: t.y, y: -t.x };
  return { x: cadera.x + t.x * u + frente.x * v, y: cadera.y + t.y * u + frente.y * v };
}
/** De pie: tobillo en x, pierna, muslo y tronco con sus ángulos. */
function dePie(m, { pierna = 0, muslo = 0, tronco = 0, x = 0 } = {}) {
  const p = pie(m, { x, y: m.tobillo });
  const rodilla = D(p.tobillo, m.pierna, pierna), cadera = D(rodilla, m.muslo, -muslo), hombro = D(cadera, m.tronco, tronco);
  return { ...p, rodilla, cadera, hombro };
}
/** Sentado en un asiento: cadera fija, muslo hacia adelante y pies en el suelo. */
function sentado(m, { cadera = { x: 0, y: 0.5 }, tronco = -5, muslo = 92, pies = 0.02 } = {}) {
  const rodillaAprox = D(cadera, m.muslo, muslo);
  const tobillo = { x: rodillaAprox.x + pies, y: m.tobillo };
  const rodilla = piernaIK(m, cadera, tobillo, { x: 0.3, y: 1 });
  return { ...pie(m, tobillo), rodilla, cadera, hombro: D(cadera, m.tronco, tronco) };
}
/** Acostado boca arriba con la cadera en "cadera": el tronco hacia atrás (cabeza hacia −x). incl: grados sobre la horizontal. */
function bocaArriba(m, cadera, incl = 0) { return { cadera, hombro: D(cadera, m.tronco, -(90 - incl)) }; }
const pasoMitad = p => (p.talon.x + p.punta.x) / 2;
/** Solo la pierna (para la pierna del otro lado): sin hombro ni brazos, que siguen siendo los del cuerpo. */
const soloPierna = p => ({ talon: p.talon, punta: p.punta, tobillo: p.tobillo, rodilla: p.rodilla });

// ── Equipo ────────────────────────────────────────────────────────────────────────────────────────────────────
const barraCon = (c, r = 0.225, capa = 'frente') => [{ tipo: 'disco', centro: mas(c, -0.015, 0.01), r, capa: 'fondo' }, { tipo: 'barra', centro: c, capa }];
const mancuernas = (cerca, lejos = mas(cerca, 0.02, 0.012)) => [{ tipo: 'mancuerna', centro: lejos, capa: 'fondo' }, { tipo: 'mancuerna', centro: cerca, capa: 'frente' }];
const banco = (a, b, extra = {}) => ({ tipo: 'banco', a, b, capa: 'fondo', ...extra });
const cable = (desde, hasta) => [{ tipo: 'cable', desde, hasta, capa: 'fondo' }, { tipo: 'mango', centro: hasta, capa: 'frente' }];
const asiento = (cadera, tronco, m, alto = 0.45) => [banco({ x: cadera.x - 0.2, y: alto }, { x: cadera.x + 0.25, y: alto })]
  .concat(tronco < -1 ? [banco(enTronco(cadera, D(cadera, m.tronco, tronco), 0.02, -0.12), enTronco(cadera, D(cadera, m.tronco, tronco), m.tronco + 0.1, -0.12), { patas: false })] : []);

/** Arma la pose completa: agrega la cabeza si falta. */
function armar(m, p, cabezaAng) {
  if (!p.cabeza) Object.assign(p, cabeza(m, p.hombro, cabezaAng ?? angulo(p.cadera, p.hombro) * 0.5));
  return p;
}

// ── Piernas ───────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Sentadilla. carga: 'espalda' (barra alta), 'frente' (copa), 'zercher', 'lados' (mancuernas), 'libre' (brazos al
 * frente), 'kettlebell' (sumo). El tronco se inclina lo justo para dejar la carga sobre la mitad del pie.
 */
export function sentadilla({ carga = 'espalda', profundidad = 100, tobillo = 30, smith = false, cajon = false, abierta = false } = {}) {
  const posar = (s, mBase) => {
    // Con los pies abiertos (sumo) los muslos apuntan hacia afuera: de lado se ven más cortos y el tronco queda más recto.
    const m = abierta ? { ...mBase, muslo: mBase.muslo * 0.74 } : mBase;
    const base = pie(m, { x: 0, y: m.tobillo }), mitad = pasoMitad(base);
    const rodilla = D(base.tobillo, m.pierna, mix(1, tobillo, s)), cadera = D(rodilla, m.muslo, -mix(0, profundidad, s));
    const con = tau => {
      const hombro = D(cadera, m.tronco, tau);
      const punto = { espalda: enTronco(cadera, hombro, m.tronco + 0.03, -0.04), frente: enTronco(cadera, hombro, m.tronco - 0.13, 0.18), zercher: enTronco(cadera, hombro, m.tronco * 0.55, 0.2) }[carga];
      // Con carga colgando (mancuernas o kettlebell), la carga cae bajo los hombros y es la que se equilibra.
      const cm = punto ? punto.x : carga === 'libre' ? cadera.x * 0.55 + hombro.x * 0.25 + (hombro.x + largoBrazo(m)) * 0.2 : hombro.x;
      return { hombro, punto, cm };
    };
    const tau = raiz(t => con(t).cm - mitad, -10, 75);
    const { hombro, punto } = con(tau);
    let brazos, equipo = [];
    if (carga === 'espalda') { brazos = brazoIK(m, hombro, mas(punto, 0.01, 0), { x: 0, y: -1 }, 0.6, 0.85); equipo = barraCon(punto, 0.225, 'medio'); }
    else if (carga === 'frente') { brazos = brazoIK(m, hombro, mas(punto, 0, -0.02), { x: 0, y: -1 }, 0.95, 0.95); equipo = [{ tipo: 'mancuerna', centro: punto, capa: 'frente' }]; }
    else if (carga === 'zercher') { brazos = { codo: punto, mano: enTronco(cadera, hombro, m.tronco * 0.9, 0.24) }; equipo = barraCon(punto, 0.225, 'frente'); }
    else if (carga === 'libre') brazos = brazoFK(m, hombro, 90, 90);
    else { brazos = brazoFK(m, hombro, 180, 180); equipo = carga === 'kettlebell' ? [{ tipo: 'kettlebell', centro: mas(brazos.mano, 0, -0.12), capa: 'frente' }] : mancuernas(brazos.mano); }
    if (smith) equipo.unshift({ tipo: 'rieles', x: punto ? punto.x : hombro.x, capa: 'fondo' });
    return { ...base, rodilla, cadera, hombro, ...brazos, equipo, ...cabeza(m, hombro, tau * 0.45), angulos: { rodilla: mix(1, tobillo, s) + mix(0, profundidad, s), tronco: tau } };
  };
  return {
    fases: RITMOS.bajaSube,
    pose(s, m) {
      const p = posar(s, m);
      if (cajon) { const abajo = posar(1, m); p.equipo.unshift({ tipo: 'cajon', x1: abajo.cadera.x - 0.42, x2: abajo.cadera.x + 0.05, alto: abajo.cadera.y - 0.12, capa: 'fondo' }); }
      return p;
    },
  };
}

/** Prensa: sentado en el carro, los pies empujan la plataforma por el riel. pantorrilla: piernas estiradas, solo tobillos. */
export function prensa({ angulo: riel = 45, pantorrilla = false } = {}) {
  return {
    fases: pantorrilla ? RITMOS.sube : RITMOS.empuja,
    pose(s, m) {
      const cadera = { x: 0, y: 0.5 }, hombro = D(cadera, m.tronco, riel === 45 ? -55 : -22);
      const d = { x: Math.cos(R(riel)), y: Math.sin(R(riel)) }, perp = { x: -d.y, y: d.x }, largo = (m.muslo + m.pierna) * 0.96;
      const flex = pantorrilla ? 0 : s;
      const tobillo = { x: cadera.x + d.x * (largo - 0.42 * flex), y: cadera.y + d.y * (largo - 0.42 * flex) };
      const rodilla = piernaIK(m, cadera, tobillo, perp);
      const p = pie(m, tobillo, riel + 90 - (pantorrilla ? 28 * s : 0));
      const plataforma = { tipo: 'plataforma', a: mas(p.talon, d.x * 0.04 - (p.punta.x - p.talon.x) * 0.2, d.y * 0.04 - (p.punta.y - p.talon.y) * 0.2), b: mas(p.punta, d.x * 0.04 + (p.punta.x - p.talon.x) * 0.25, d.y * 0.04 + (p.punta.y - p.talon.y) * 0.25), capa: 'frente' };
      const mano = mas(cadera, 0.12, -0.02);
      return armar(m, { ...p, rodilla, cadera, hombro, ...brazoIK(m, hombro, mano, { x: 0, y: -1 }), equipo: [...asiento(cadera, riel === 45 ? -55 : -22, m, 0.42), plataforma] }, angulo(cadera, hombro) * 0.8);
    },
  };
}

/** Sentadilla hack: espalda en el respaldo inclinado; la cadera baja por el riel. */
export function hack() {
  return {
    fases: RITMOS.bajaSube,
    pose(s, m) {
      const tau = -22, t = { x: Math.sin(R(tau)), y: Math.cos(R(tau)) };
      const arriba = { x: -0.06, y: 0.9 }, cadera = mas(arriba, -t.x * 0.42 * s, -t.y * 0.42 * s);
      const p = pie(m, { x: 0.24, y: m.tobillo }), rodilla = piernaIK(m, cadera, p.tobillo, { x: 1, y: 0.3 }), hombro = D(cadera, m.tronco, tau);
      const respaldo = banco(enTronco(cadera, hombro, -0.05, -0.13), enTronco(cadera, hombro, m.tronco + 0.12, -0.13), { patas: false });
      return armar(m, { ...p, rodilla, cadera, hombro, ...brazoIK(m, hombro, mas(hombro, 0.06, 0.08), { x: 0, y: -1 }), equipo: [respaldo, { tipo: 'rodillo', centro: mas(hombro, -0.02, 0.07), capa: 'frente' }] }, 0);
    },
  };
}

/** Bisagra de cadera (peso muerto rumano, buenos días, bisagra sin carga). La carga baja vertical sobre la mitad del pie. */
export function rumano({ carga = 'barra', rodillas = 10, hasta = 0.4, smith = false, pared = false } = {}) {
  return {
    fases: RITMOS.bajaSube,
    pose(s, m) {
      const base = pie(m, { x: 0, y: m.tobillo }), mitad = pasoMitad(base), rodilla = D(base.tobillo, m.pierna, mix(3, rodillas, s));
      const L = largoBrazo(m), arriba = m.tobillo + m.pierna + m.muslo + m.tronco - L * 0.99;
      const manoY = mix(arriba, hasta, s), objetivo = { x: mitad + 0.02, y: manoY + L * 0.98 };
      const cadera = ik(rodilla, objetivo, m.muslo, m.tronco, { x: -1, y: 0.2 }), hombro = D(cadera, m.tronco, angulo(cadera, objetivo));
      const brazos = carga === 'manos' ? brazoIK(m, hombro, enTronco(cadera, hombro, 0.05, 0.13), { x: -0.5, y: -1 }) : brazoFK(m, hombro, 180, 180, 0.98, 0.98);
      const equipo = carga === 'barra' ? barraCon(brazos.mano) : carga === 'mancuernas' ? mancuernas(brazos.mano) : [];
      if (smith) equipo.unshift({ tipo: 'rieles', x: brazos.mano.x, capa: 'fondo' });
      if (pared) equipo.unshift({ tipo: 'pared', x: -0.62, capa: 'fondo' });
      const tronco = angulo(cadera, hombro);
      return { ...base, rodilla, cadera, hombro, ...brazos, equipo, ...cabeza(m, hombro, tronco * 0.85) };
    },
  };
}

/** Peso muerto desde el suelo: la barra sube pegada a las piernas sobre la mitad del pie. */
export function pesoMuerto({ smith = false } = {}) {
  return {
    fases: RITMOS.levanta,
    pose(s, m) {
      const base = pie(m, { x: 0, y: m.tobillo }), mitad = pasoMitad(base), rodilla = D(base.tobillo, m.pierna, mix(2, 22, s));
      const L = largoBrazo(m), arriba = m.tobillo + m.pierna + m.muslo + m.tronco - L * 0.99;
      const manoY = mix(arriba, 0.225, s), objetivo = { x: mitad + 0.03 + 0.04 * s, y: manoY + L * 0.98 };
      const cadera = ik(rodilla, objetivo, m.muslo, m.tronco, { x: -1, y: 0.2 }), hombro = D(cadera, m.tronco, angulo(cadera, objetivo));
      const brazos = brazoFK(m, hombro, 180, 180, 0.98, 0.98), equipo = barraCon(brazos.mano);
      if (smith) equipo.unshift({ tipo: 'rieles', x: brazos.mano.x, capa: 'fondo' });
      return { ...base, rodilla, cadera, hombro, ...brazos, equipo, ...cabeza(m, hombro, angulo(cadera, hombro) * 0.8) };
    },
  };
}

/** Buenos días: barra en la espalda, rodillas apenas dobladas; el tronco baja y la barra sigue sobre la mitad del pie. */
export function buenosDias() {
  return {
    fases: RITMOS.bajaSube,
    pose(s, m) {
      const base = pie(m, { x: 0, y: m.tobillo }), mitad = pasoMitad(base), rodilla = D(base.tobillo, m.pierna, mix(2, 8, s)), tau = mix(8, 68, s);
      const con = phi => { const cadera = D(rodilla, m.muslo, -phi), hombro = D(cadera, m.tronco, tau); return { cadera, hombro, barra: enTronco(cadera, hombro, m.tronco + 0.03, -0.04) }; };
      // El equilibrio va por el centro de masa: la cadera va atrás con las piernas casi rectas.
      const { cadera, hombro, barra } = con(raiz(phi => { const c = con(phi); return c.cadera.x * 0.55 + c.hombro.x * 0.45 - mitad; }, -10, 60));
      return { ...base, rodilla, cadera, hombro, ...brazoIK(m, hombro, mas(barra, 0.01, 0), { x: 0, y: -1 }, 0.6, 0.85), equipo: barraCon(barra, 0.225, 'medio'), ...cabeza(m, hombro, tau * 0.8) };
    },
  };
}

/** Swing con kettlebell: bisagra explosiva; los brazos van de entre las piernas a la altura del pecho. */
export function swing() {
  return {
    fases: RITMOS.balanceo,
    pose(s, m) {
      const base = pie(m, { x: 0, y: m.tobillo }), mitad = pasoMitad(base), rodilla = D(base.tobillo, m.pierna, mix(3, 14, s)), tau = mix(0, 58, s);
      const con = phi => { const cadera = D(rodilla, m.muslo, -phi), hombro = D(cadera, m.tronco, tau); return { cadera, hombro }; };
      const { cadera, hombro } = con(raiz(phi => { const c = con(phi); return c.cadera.x * 0.6 + c.hombro.x * 0.4 - mitad; }, -10, 90));
      const brazos = brazoFK(m, hombro, mix(92, 204, s), mix(92, 204, s));
      return { ...base, rodilla, cadera, hombro, ...brazos, equipo: [{ tipo: 'kettlebell', centro: D(brazos.mano, 0.13, mix(92, 204, s)), capa: 'frente' }], ...cabeza(m, hombro, tau * 0.7) };
    },
  };
}

/**
 * Hip thrust y puente de glúteo: los hombros apoyados (en el banco o en el suelo); la cadera sube hasta alinear
 * hombros, cadera y rodillas. carga: 'barra', 'maquina' o 'ninguna'.
 */
export function hipThrust({ suelo = false, carga = 'barra', smith = false, marcha = false } = {}) {
  return {
    fases: marcha ? RITMOS.alterna : RITMOS.sube,
    pose(s, m) {
      const hombro = suelo ? { x: -0.7, y: 0.12 } : { x: -0.72, y: 0.44 };
      const th = marcha ? (suelo ? 26 : 2) : mix(suelo ? 4 : -30, suelo ? 26 : 2, s);
      const cadera = { x: hombro.x + m.tronco * Math.cos(R(th)), y: hombro.y + m.tronco * Math.sin(R(th)) };
      const base = pie(m, { x: suelo ? 0.02 : 0.04, y: m.tobillo }), rodilla = piernaIK(m, cadera, base.tobillo, { x: 0.2, y: 1 });
      const barra = enTronco(cadera, hombro, -0.02, 0.15);
      const brazos = carga === 'barra' || smith ? brazoIK(m, hombro, mas(barra, -0.04, 0.02), { x: 0, y: -1 }) : brazoFK(m, hombro, suelo ? 92 : 150, suelo ? 92 : 150);
      const equipo = [];
      if (!suelo) equipo.push(banco({ x: -1.15, y: 0.4 }, { x: -0.6, y: 0.4 }));
      if (carga === 'barra' || smith) equipo.push(...barraCon(barra));
      if (carga === 'maquina') equipo.push({ tipo: 'rodillo', centro: barra, r: 0.06, capa: 'frente' });
      if (smith) equipo.unshift({ tipo: 'rieles', x: barra.x, capa: 'fondo' });
      const p = { ...base, rodilla, cadera, hombro, ...brazos, equipo, ...cabeza(m, hombro, angulo(cadera, hombro) + 12) };
      if (marcha) { // una rodilla sube hacia el pecho mientras la otra sostiene
        const rod = D(cadera, m.muslo, mix(angulo(cadera, rodilla), -10, s)), tob = D(rod, m.pierna, mix(angulo(rodilla, base.tobillo), 80, s));
        p.lejos = { rodilla: rod, ...(s < 0.15 ? pie(m, tob) : pieDeLaPierna(m, rod, tob, -20)) };
      }
      return p;
    },
  };
}

/** Estocada, zancada y búlgara: el pie de adelante (este lado) y el de atrás (el otro lado). trasero: 'suelo' o 'banco'. */
export function estocada({ trasero = 'suelo', carga = 'ninguna', smith = false } = {}) {
  return {
    fases: RITMOS.bajaSube,
    pose(s, m) {
      const delante = pie(m, { x: 0, y: m.tobillo });
      const atras = trasero === 'banco' ? pie(m, { x: -0.78, y: 0.52 }, 196) : pieDesdePunta(m, { x: -0.72, y: 0 }, -mix(38, 52, s));
      const cadera = { x: trasero === 'banco' ? -0.22 : -0.3, y: mix(trasero === 'banco' ? 0.86 : 0.84, trasero === 'banco' ? 0.5 : 0.52, s) };
      const rodilla = piernaIK(m, cadera, delante.tobillo, { x: 1, y: 0.3 }), rodillaAtras = piernaIK(m, cadera, atras.tobillo, { x: 0.2, y: -1 });
      const hombro = D(cadera, m.tronco, trasero === 'banco' ? mix(5, 14, s) : 4);
      const brazos = carga === 'mancuernas' ? brazoFK(m, hombro, 182, 182) : carga === 'barra' ? brazoIK(m, hombro, enTronco(cadera, hombro, m.tronco + 0.04, -0.03), { x: 0, y: -1 }, 0.6, 0.85) : brazoIK(m, hombro, enTronco(cadera, hombro, 0.06, 0.1), { x: -1, y: 0 });
      const equipo = carga === 'mancuernas' ? mancuernas(brazos.mano) : carga === 'barra' ? barraCon(enTronco(cadera, hombro, m.tronco + 0.03, -0.04), 0.225, 'medio') : [];
      if (trasero === 'banco') equipo.unshift(banco({ x: -1.25, y: 0.45 }, { x: -0.7, y: 0.45 }));
      if (smith) equipo.unshift({ tipo: 'rieles', x: hombro.x - 0.04, capa: 'fondo' });
      return { ...delante, rodilla, cadera, hombro, ...brazos, equipo, ...cabeza(m, hombro, 3), lejos: { ...atras, rodilla: rodillaAtras } };
    },
  };
}

/** Subida al cajón: un pie arriba, se sube con esa pierna y la otra acompaña. */
export function stepUp({ carga = 'ninguna' } = {}) {
  return {
    fases: RITMOS.sube,
    pose(s, m) {
      const alto = 0.4, arriba = pie(m, { x: 0.16, y: alto + m.tobillo });
      const cadera = { x: mix(-0.12, 0.12, s), y: mix(0.78, alto + 0.9, s) };
      const rodilla = piernaIK(m, cadera, arriba.tobillo, { x: 1, y: 0.3 });
      let tobAtras = mixP({ x: -0.28, y: m.tobillo }, mas(cadera, -0.05, -0.62), Math.max(0, (s - 0.35) / 0.65));
      let rodAtras = piernaIK(m, cadera, tobAtras, { x: 1, y: 0.1 });
      let atras = s < 0.35 ? pie(m, tobAtras) : pieDeLaPierna(m, rodAtras, tobAtras, 15);
      const bajo = Math.min(atras.talon.y, atras.punta.y);
      if (bajo < 0) { // al despegar, el pie no puede atravesar el suelo: se levanta un poco antes
        tobAtras = mas(tobAtras, 0, -bajo); rodAtras = piernaIK(m, cadera, tobAtras, { x: 1, y: 0.1 }); atras = pieDeLaPierna(m, rodAtras, tobAtras, 15);
      }
      const hombro = D(cadera, m.tronco, mix(14, 4, s));
      const brazos = carga === 'mancuernas' ? brazoFK(m, hombro, 182, 182) : brazoFK(m, hombro, 172, 160);
      const equipo = [{ tipo: 'cajon', x1: -0.08, x2: 0.5, alto, capa: 'fondo' }, ...(carga === 'mancuernas' ? mancuernas(brazos.mano) : [])];
      return { ...arriba, rodilla, cadera, hombro, ...brazos, equipo, ...cabeza(m, hombro, 4), lejos: { ...atras, rodilla: rodAtras } };
    },
  };
}

// ── Empujes ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Press en banco (plano o inclinado), con barra o mancuernas: la barra baja al pecho y sube sobre los hombros. */
export function pressBanco({ carga = 'barra', inclinacion = 0, smith = false } = {}) {
  return {
    fases: RITMOS.empuja,
    pose(s, m) {
      const { cadera, hombro } = bocaArriba(m, { x: 0, y: 0.55 }, inclinacion);
      const base = pie(m, { x: 0.42, y: m.tobillo }), rodilla = piernaIK(m, cadera, base.tobillo, { x: 0.3, y: 1 });
      const pecho = enTronco(cadera, hombro, m.tronco * (inclinacion ? 0.86 : 0.74), 0.15);
      const arriba = { x: (inclinacion ? hombro.x + 0.04 : pecho.x + 0.02), y: hombro.y + largoBrazo(m) * 0.97 };
      const mano = mixP(arriba, mas(pecho, 0, 0.05), s);
      const brazos = brazoIK(m, hombro, mano, { x: 0.25, y: -1 }, 0.98, 0.98);
      const equipo = [banco({ x: -1.05, y: 0.45 }, { x: 0.14, y: 0.45 })];
      if (inclinacion) equipo.push(banco(enTronco(cadera, hombro, 0, -0.1), enTronco(cadera, hombro, m.tronco + 0.2, -0.1), { patas: false }));
      equipo.push(...(carga === 'barra' ? barraCon(mano) : mancuernas(mano)));
      if (smith) equipo.unshift({ tipo: 'rieles', x: mano.x, capa: 'fondo' });
      return { ...base, rodilla, cadera, hombro, ...brazos, equipo, ...cabeza(m, hombro, angulo(cadera, hombro) + 8) };
    },
  };
}

/** Press de pecho sentado en máquina (plano o inclinado): las manijas avanzan desde el pecho. */
export function pressMaquina({ inclinado = false } = {}) {
  return {
    fases: RITMOS.empuja,
    pose(s, m) {
      const cuerpo = sentado(m, { tronco: -8 }), { cadera, hombro } = cuerpo;
      const dir = inclinado ? 22 : 0, lejos = mas(hombro, largoBrazo(m) * 0.92 * Math.cos(R(dir)), largoBrazo(m) * 0.92 * Math.sin(R(dir)) - 0.06);
      const mano = mixP(lejos, mas(hombro, 0.14, -0.04 + (inclinado ? 0.04 : 0)), s);
      return armar(m, { ...cuerpo, ...brazoIK(m, hombro, mano, { x: -0.3, y: -1 }), equipo: [...asiento(cadera, -8, m), { tipo: 'mango', centro: mano, capa: 'frente' }, { tipo: 'poste', x: lejos.x + 0.2, y2: 1.6, capa: 'fondo' }] }, 0);
    },
  };
}

/** Flexiones de brazos (en el suelo, con las manos en un banco o con las rodillas apoyadas): el cuerpo baja recto. */
export function flexion({ manos = 0, rodillas = false } = {}) {
  return {
    fases: RITMOS.bajaSube,
    pose(s, m) {
      const L = largoBrazo(m), mano = { x: 0, y: manos + 0.03 };
      let apoyo, largo, piernas;
      if (rodillas) { apoyo = { x: -0.86, y: 0.06 }; largo = m.muslo + m.tronco; }
      else { const p = pieDesdePunta(m, { x: -1.25, y: 0 }, -70); apoyo = p.tobillo; largo = m.pierna + m.muslo + m.tronco; piernas = p; }
      const arriba = Math.asin(Math.min(1, (mano.y + L * 0.96 - apoyo.y) / largo)), abajo = Math.asin(Math.max(0.02, (mano.y + 0.2 - apoyo.y) / largo));
      const th = mix(arriba, abajo, s), dir = { x: Math.cos(th), y: Math.sin(th) };
      const punto = d => ({ x: apoyo.x + dir.x * d, y: apoyo.y + dir.y * d });
      const hombro = punto(largo);
      // Las manos quedan bajo los hombros cuando los brazos están estirados.
      const manoX = apoyo.x + Math.cos(arriba) * largo;
      const brazos = brazoIK(m, hombro, { x: manoX, y: mano.y }, { x: -1, y: 0.5 });
      let p;
      if (rodillas) {
        const rodilla = apoyo, cadera = punto(m.muslo), tobillo = { x: rodilla.x - m.pierna * 0.95, y: 0.1 };
        p = { ...pieDeLaPierna(m, rodilla, tobillo, -10), rodilla, cadera };
      } else p = { ...piernas, rodilla: punto(m.pierna), cadera: punto(m.pierna + m.muslo) };
      const equipo = manos ? [banco({ x: manoX - 0.2, y: manos }, { x: manoX + 0.35, y: manos })] : [];
      return { ...p, hombro, ...brazos, equipo, ...cabeza(m, hombro, 90 - (th * 180) / Math.PI) };
    },
  };
}

/** Fondos en paralelas: el cuerpo baja entre las barras hasta que el brazo queda horizontal. */
export function fondos({ inclinacion = 18, asistido = false, lastre = false } = {}) {
  return {
    fases: RITMOS.bajaSube,
    pose(s, m) {
      const mano = { x: 0, y: 1.15 }, L = largoBrazo(m);
      const hombro = mixP({ x: -0.03, y: mano.y + L * 0.96 }, { x: 0.05, y: mano.y + 0.24 }, s);
      const cadera = D(hombro, m.tronco, 180 + inclinacion), rodilla = D(cadera, m.muslo, 165), tobillo = D(rodilla, m.pierna, 255);
      const equipo = [{ tipo: 'paralela', centro: mas(mano, 0, -0.02), capa: 'frente' }];
      if (asistido) equipo.push({ tipo: 'rodillo', centro: mas(rodilla, 0, -0.07), r: 0.05, capa: 'fondo' }, { tipo: 'poste', x: rodilla.x, y2: rodilla.y - 0.07, capa: 'fondo' });
      if (lastre) equipo.push({ tipo: 'disco', centro: mas(cadera, 0.03, -0.3), r: 0.13, capa: 'frente' });
      return { ...pieDeLaPierna(m, rodilla, tobillo, 30), rodilla, cadera, hombro, ...brazoIK(m, hombro, mano, { x: -1, y: 0.1 }), equipo, ...cabeza(m, hombro, inclinacion * 0.6) };
    },
  };
}

/** Fondos en banco: las manos atrás en el banco, las piernas estiradas; la cadera baja junto al banco. */
export function fondoBanco() {
  return {
    fases: RITMOS.bajaSube,
    pose(s, m) {
      const mano = { x: -0.2, y: 0.47 }, L = largoBrazo(m);
      const hombro = mixP({ x: -0.16, y: mano.y + L * 0.95 }, { x: -0.12, y: mano.y + 0.3 }, s);
      // Los talones quedan donde llegan las piernas casi estiradas con la cadera arriba, y no se mueven.
      const caderaArriba = D({ x: -0.16, y: mano.y + L * 0.95 }, m.tronco, 184), alcance = (m.muslo + m.pierna) * 0.97;
      const talonX = caderaArriba.x + Math.sqrt(Math.max(0, alcance ** 2 - (caderaArriba.y - 0.09) ** 2));
      const cadera = D(hombro, m.tronco, 184), p = pieDesdeTalon(m, { x: talonX, y: 0 }, 68), rodilla = piernaIK(m, cadera, p.tobillo, { x: 0, y: 1 });
      return { ...p, rodilla, cadera, hombro, ...brazoIK(m, hombro, mano, { x: -1, y: 0 }), equipo: [banco({ x: -0.75, y: 0.45 }, { x: -0.15, y: 0.45 })], ...cabeza(m, hombro, 6) };
    },
  };
}

/** Press de hombros de pie o sentado: la carga sube desde la altura del mentón hasta quedar sobre la cabeza. */
export function pressVertical({ sentado: enAsiento = false, carga = 'barra', smith = false } = {}) {
  return {
    fases: RITMOS.empuja,
    pose(s, m) {
      const cuerpo = enAsiento ? sentado(m, { tronco: -3 }) : dePie(m, { pierna: 2, tronco: -2 });
      const { cadera, hombro } = cuerpo, L = largoBrazo(m);
      const abajo = carga === 'mancuernas' ? mas(hombro, 0.05, 0.06) : carga === 'maquina' ? mas(hombro, 0.03, 0.08) : mas(hombro, 0.1, 0.07);
      const mano = mixP(mas(hombro, -0.01, L * 0.96), abajo, s);
      const equipo = carga === 'barra' ? barraCon(mano) : carga === 'mancuernas' ? mancuernas(mano) : [{ tipo: 'mango', centro: mano, capa: 'frente' }, { tipo: 'poste', x: hombro.x - 0.32, y2: 1.9, capa: 'fondo' }];
      if (enAsiento) equipo.unshift(...asiento(cadera, -3, m), banco(enTronco(cadera, hombro, 0, -0.12), enTronco(cadera, hombro, m.tronco + 0.05, -0.12), { patas: false }));
      if (smith) equipo.unshift({ tipo: 'rieles', x: mano.x, capa: 'fondo' });
      return armar(m, { ...cuerpo, ...brazoIK(m, hombro, mano, { x: 0.35, y: -1 }), equipo }, carga === 'barra' ? -8 * s : 0);
    },
  };
}

// ── Tirones ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Jalón al pecho sentado: la barra baja desde arriba hasta la parte alta del pecho. */
export function jalon() {
  return {
    fases: RITMOS.tira,
    pose(s, m) {
      const tau = mix(-6, -18, s), cuerpo = sentado(m, { tronco: tau, muslo: 88 }), { cadera, hombro } = cuerpo, L = largoBrazo(m);
      const mano = mixP(mas(hombro, 0.13, L * 0.94), mas(hombro, 0.15, 0.06), s);
      const polea = { x: mas(hombro, 0.13, L * 0.94).x + 0.04, y: 2.35 };
      return armar(m, { ...cuerpo, ...brazoIK(m, hombro, mano, { x: -0.3, y: -1 }), equipo: [...asiento(cadera, 0, m), { tipo: 'rodillo', centro: mas(cuerpo.rodilla, -0.06, 0.1), capa: 'frente' }, ...cable(polea, mano), { tipo: 'barra', centro: mano, r: 0.02, capa: 'frente' }] }, 10 * s);
    },
  };
}

/** Dominadas: colgado de la barra, el cuerpo sube hasta que el mentón pasa la barra. */
export function dominada({ asistida = false, banda = false, lastre = false, escapular = false } = {}) {
  return {
    fases: RITMOS.tira,
    pose(s, m) {
      const barra = { x: 0, y: 2.3 }, mano = mas(barra, 0, -0.02), L = largoBrazo(m);
      const abajo = { x: -0.04, y: mano.y - L * 0.97 }, hombro = mixP(abajo, escapular ? mas(abajo, 0, 0.05) : { x: -0.07, y: mano.y - 0.14 }, s);
      const cadera = D(hombro, m.tronco, 172), rodilla = D(cadera, m.muslo, 176), tobillo = D(rodilla, m.pierna, 210);
      const equipo = [{ tipo: 'barraFija', centro: barra, capa: 'frente' }];
      if (asistida) equipo.push({ tipo: 'rodillo', centro: mas(rodilla, 0.02, -0.07), r: 0.05, capa: 'fondo' }, { tipo: 'poste', x: rodilla.x + 0.02, y2: rodilla.y - 0.07, capa: 'fondo' });
      if (banda) equipo.push({ tipo: 'banda', puntos: [mano, mas(rodilla, 0.04, -0.03), mas(mano, 0.06, 0)], capa: 'fondo' });
      if (lastre) equipo.push({ tipo: 'disco', centro: mas(cadera, 0.04, -0.32), r: 0.13, capa: 'frente' });
      return { ...pieDeLaPierna(m, rodilla, tobillo, 35), rodilla, cadera, hombro, ...brazoIK(m, hombro, mano, { x: 0.6, y: -1 }), equipo, ...cabeza(m, hombro, 4) };
    },
  };
}

/** Remo inclinado con barra o mancuernas: el tronco queda quieto y la carga sube desde los brazos estirados al abdomen. */
export function remoInclinado({ carga = 'barra', tronco = 50, rodillas = 16, smith = false } = {}) {
  return {
    fases: RITMOS.tira,
    pose(s, m) {
      const base = pie(m, { x: 0, y: m.tobillo }), mitad = pasoMitad(base), rodilla = D(base.tobillo, m.pierna, rodillas);
      const con = phi => { const cadera = D(rodilla, m.muslo, -phi); return { cadera, hombro: D(cadera, m.tronco, tronco) }; };
      // El centro de masa (cuerpo y barra) queda sobre la mitad del pie: la cadera atrás y la barra un poco adelante.
      const { cadera, hombro } = con(raiz(phi => { const c = con(phi); return c.cadera.x * 0.5 + c.hombro.x * 0.5 - mitad; }, -10, 120));
      const L = largoBrazo(m), mano = mixP(mas(hombro, 0, -L * 0.97), enTronco(cadera, hombro, m.tronco * 0.28, 0.16), s);
      const brazos = brazoIK(m, hombro, mano, { x: -0.6, y: 1 });
      const equipo = carga === 'barra' ? barraCon(mano) : mancuernas(mano);
      if (smith) equipo.unshift({ tipo: 'rieles', x: mano.x, capa: 'fondo' });
      return { ...base, rodilla, cadera, hombro, ...brazos, equipo, ...cabeza(m, hombro, tronco * 0.8) };
    },
  };
}

/** Remo con mancuerna apoyado en el banco: una rodilla y una mano en el banco, la otra mano rema. */
export function remoUnBrazo() {
  return {
    fases: RITMOS.tira,
    pose(s, m) {
      const cadera = { x: -0.12, y: 0.86 }, hombro = D(cadera, m.tronco, 84);
      const p = pie(m, { x: -0.3, y: m.tobillo }), rodilla = piernaIK(m, cadera, p.tobillo, { x: 1, y: 0 });
      const rodLejos = { x: -0.02, y: 0.5 }, tobLejos = { x: -0.44, y: 0.5 };
      const manoApoyo = { x: hombro.x + 0.02, y: 0.5 }, L = largoBrazo(m);
      const mano = mixP(mas(hombro, 0.02, -L * 0.97), enTronco(cadera, hombro, 0.12, 0.12), s);
      return {
        ...p, rodilla, cadera, hombro, ...brazoIK(m, hombro, mano, { x: -0.6, y: 1 }),
        lejos: { ...pie(m, tobLejos, 180 + 10), rodilla: rodLejos, ...brazoIK(m, hombro, manoApoyo, { x: -1, y: 0 }) },
        equipo: [banco({ x: -0.6, y: 0.45 }, { x: hombro.x + 0.25, y: 0.45 }), { tipo: 'mancuerna', centro: mano, capa: 'frente' }],
        ...cabeza(m, hombro, 80),
      };
    },
  };
}

/** Remo sentado en polea, máquina o con banda: las manos van desde adelante hasta el abdomen. */
export function remoSentado({ maquina = false, banda = false, bajo = false } = {}) {
  return {
    fases: RITMOS.tira,
    pose(s, m) {
      const L = largoBrazo(m);
      if (maquina) {
        const cuerpo = sentado(m, { tronco: 14 }), { cadera, hombro } = cuerpo;
        const mano = mixP(mas(hombro, L * 0.85, bajo ? -0.3 : -0.12), mas(hombro, 0.02, bajo ? -0.22 : -0.1), s);
        const pecho = banco(enTronco(cadera, hombro, m.tronco * 0.45, 0.24), enTronco(cadera, hombro, m.tronco * 0.95, 0.24), { patas: false, capa: 'frente' });
        return armar(m, { ...cuerpo, ...brazoIK(m, hombro, mano, { x: -1, y: 0.2 }), equipo: [...asiento(cadera, 0, m), pecho, { tipo: 'mango', centro: mano, capa: 'frente' }, { tipo: 'poste', x: hombro.x + L * 0.85 + 0.15, y2: 1.5, capa: 'fondo' }] }, 8);
      }
      const cadera = { x: 0, y: 0.38 }, tau = mix(20, -6, s), hombro = D(cadera, m.tronco, tau);
      const tobillo = { x: 0.78, y: 0.22 }, rodilla = piernaIK(m, cadera, tobillo, { x: 0, y: 1 });
      const mano = mixP(mas(hombro, L * 0.95, -0.08), enTronco(cadera, hombro, m.tronco * 0.32, 0.16), s);
      const ancla = banda ? { x: 0.92, y: 0.22 } : { x: 1.25, y: 0.36 };
      const equipo = [banco({ x: -0.45, y: 0.3 }, { x: 0.35, y: 0.3 }), { tipo: 'plataforma', a: { x: 0.9, y: 0.06 }, b: { x: 0.9, y: 0.4 }, capa: 'fondo' }];
      if (banda) equipo.push({ tipo: 'banda', puntos: [mano, ancla], capa: 'fondo' }); else equipo.push(...cable(ancla, mano));
      return armar(m, { ...pie(m, tobillo, 80), rodilla, cadera, hombro, ...brazoIK(m, hombro, mano, { x: -1, y: -0.2 }), equipo }, tau * 0.5);
    },
  };
}

/** Remo invertido o en suspensión: boca arriba bajo la barra, el cuerpo recto sube hasta que el pecho llega a la barra. */
export function remoInvertido({ suspension = false } = {}) {
  return {
    fases: RITMOS.tira,
    pose(s, m) {
      const barra = { x: 0, y: 1.0 }, L = largoBrazo(m), largo = m.pierna + m.muslo + m.tronco;
      const p = pieDesdeTalon(m, { x: 1.36, y: 0 }, 82), apoyo = p.tobillo;
      const alcance = h => Math.asin(Math.min(1, (h - apoyo.y) / largo));
      const th = mix(alcance(barra.y - L * 0.96), alcance(barra.y - 0.14), s), dir = { x: -Math.cos(th), y: Math.sin(th) };
      const punto = d => ({ x: apoyo.x + dir.x * d, y: apoyo.y + dir.y * d }), hombro = punto(largo);
      const mano = { x: barra.x, y: barra.y - 0.02 };
      const equipo = suspension ? [{ tipo: 'banda', puntos: [{ x: barra.x, y: 2.4 }, mano], capa: 'fondo' }, { tipo: 'mango', centro: mano, capa: 'frente' }] : [{ tipo: 'barra', centro: barra, r: 0.022, capa: 'frente' }, { tipo: 'rieles', x: barra.x, capa: 'fondo' }];
      return { ...p, rodilla: punto(m.pierna), cadera: punto(m.pierna + m.muslo), hombro, ...brazoIK(m, hombro, mano, { x: 0, y: -1 }), equipo, ...cabeza(m, hombro, angulo(punto(0), hombro) + 6) };
    },
  };
}

// ── Brazos y hombros ──────────────────────────────────────────────────────────────────────────────────────────
const discosChicos = c => [{ tipo: 'disco', centro: mas(c, -0.01, 0.006), r: 0.14, capa: 'fondo' }, { tipo: 'barra', centro: c, capa: 'frente' }];
/**
 * Curl de bíceps. tipo: 'pie', 'predicador', 'inclinado' o 'tras' (polea por detrás). carga: 'barra', 'mancuernas',
 * 'polea' o 'maquina'. El codo queda quieto y el antebrazo sube.
 */
export function curl({ tipo = 'pie', carga = 'barra' } = {}) {
  return {
    fases: RITMOS.sube,
    pose(s, m) {
      let cuerpo, a1, a2, equipo = [];
      if (tipo === 'predicador') { cuerpo = sentado(m, { tronco: 16 }); a1 = 138; a2 = mix(148, 26, s); }
      else if (tipo === 'inclinado') { cuerpo = sentado(m, { tronco: -38, muslo: 96 }); a1 = 182; a2 = mix(182, 40, s); }
      else if (tipo === 'tras') { cuerpo = dePie(m, { pierna: 2 }); a1 = 196; a2 = mix(196, 62, s); }
      else { cuerpo = dePie(m, { pierna: 2 }); a1 = mix(178, 168, s); a2 = mix(176, 32, s); }
      const { cadera, hombro } = cuerpo, brazos = brazoFK(m, hombro, a1, a2);
      if (carga === 'barra') equipo.push(...discosChicos(brazos.mano));
      else if (carga === 'mancuernas') equipo.push(...mancuernas(brazos.mano));
      else if (carga === 'polea') equipo.push(...cable(tipo === 'tras' ? { x: -0.55, y: 0.18 } : { x: 0.5, y: 0.14 }, brazos.mano));
      else equipo.push({ tipo: 'mango', centro: brazos.mano, capa: 'frente' });
      if (tipo === 'predicador') {
        const dir = D({ x: 0, y: 0 }, 1, a1), abajo = { x: dir.y * 0.06, y: -dir.x * 0.06 };
        equipo.unshift({ tipo: 'banco', a: mas(D(hombro, m.brazo * 0.2, a1), abajo.x, abajo.y), b: mas(D(hombro, m.brazo * 1.05, a1), abajo.x, abajo.y), patas: false, capa: 'fondo' }, { tipo: 'poste', x: D(hombro, m.brazo * 0.6, a1).x, y2: D(hombro, m.brazo * 0.6, a1).y - 0.08, capa: 'fondo' });
      }
      if (tipo === 'predicador' || tipo === 'inclinado') equipo.unshift(...asiento(cadera, tipo === 'inclinado' ? -38 : 0, m));
      return armar(m, { ...cuerpo, ...brazos, equipo }, tipo === 'predicador' ? 10 : tipo === 'inclinado' ? -20 : 0);
    },
  };
}

/** Tríceps. tipo: 'polea' (empuje hacia abajo), 'sobreCabeza', 'rompecraneos' o 'maquina'. */
export function triceps({ tipo = 'polea', carga = 'polea' } = {}) {
  return {
    fases: tipo === 'rompecraneos' ? RITMOS.empuja : RITMOS.extiende,
    pose(s, m) {
      if (tipo === 'rompecraneos') {
        const { cadera, hombro } = bocaArriba(m, { x: 0, y: 0.55 }), base = pie(m, { x: 0.42, y: m.tobillo });
        const brazos = brazoFK(m, hombro, -12, mix(-12, -122, s));
        return { ...base, rodilla: piernaIK(m, cadera, base.tobillo, { x: 0.3, y: 1 }), cadera, hombro, ...brazos, equipo: [banco({ x: -1.05, y: 0.45 }, { x: 0.14, y: 0.45 }), ...discosChicos(brazos.mano)], ...cabeza(m, hombro, angulo(cadera, hombro) + 8) };
      }
      if (tipo === 'maquina') {
        const cuerpo = sentado(m, { tronco: -4 }), { cadera, hombro } = cuerpo;
        const mano = mixP(mas(hombro, 0.12, -0.08), mas(hombro, 0.1, -0.5), s);
        return armar(m, { ...cuerpo, ...brazoIK(m, hombro, mano, { x: -1, y: 0 }), equipo: [...asiento(cadera, -4, m), { tipo: 'mango', centro: mano, capa: 'frente' }] }, 0);
      }
      if (tipo === 'sobreCabeza') {
        const cuerpo = dePie(m, { pierna: 3, tronco: carga === 'polea' ? 12 : 0 }), { hombro } = cuerpo;
        const brazos = brazoFK(m, hombro, carga === 'polea' ? 20 : 4, mix(192, carga === 'polea' ? 380 : 364, s));
        const equipo = carga === 'polea' ? cable({ x: -0.55, y: 0.4 }, brazos.mano) : [{ tipo: 'mancuerna', centro: brazos.mano, capa: 'frente' }];
        return armar(m, { ...cuerpo, ...brazos, equipo }, 0);
      }
      const cuerpo = dePie(m, { pierna: 5, muslo: 8, tronco: 12 }), { hombro } = cuerpo;
      const brazos = brazoFK(m, hombro, 174, mix(78, 178, s));
      return armar(m, { ...cuerpo, ...brazos, equipo: cable({ x: hombro.x + 0.32, y: 2.2 }, brazos.mano) }, 6);
    },
  };
}

/** Elevación frontal: el brazo casi estirado sube hasta la altura del hombro. */
export function elevacionFrontal() {
  return {
    fases: RITMOS.sube,
    pose(s, m) {
      const cuerpo = dePie(m, { pierna: 2 }), brazos = brazoFK(m, cuerpo.hombro, mix(176, 92, s), mix(172, 86, s));
      return armar(m, { ...cuerpo, ...brazos, equipo: mancuernas(brazos.mano) }, 0);
    },
  };
}

/** Face pull: la cuerda llega a la cara con los codos altos. banda: con una banda en vez de polea. */
export function facePull({ banda = false } = {}) {
  return {
    fases: RITMOS.tira,
    pose(s, m) {
      const cuerpo = dePie(m, { pierna: 3, tronco: -4 }), { hombro } = cuerpo, L = largoBrazo(m);
      const mano = mixP(mas(hombro, L * 0.94, 0.12), mas(hombro, 0.05, 0.17), s);
      const ancla = { x: hombro.x + 0.85, y: hombro.y + 0.16 };
      const equipo = banda ? [{ tipo: 'banda', puntos: [mano, ancla], capa: 'fondo' }, { tipo: 'poste', x: ancla.x + 0.03, y2: 2, capa: 'fondo' }] : cable(ancla, mano);
      return armar(m, { ...cuerpo, ...brazoIK(m, hombro, mano, { x: -1, y: 0.5 }), equipo }, 0);
    },
  };
}

/** Cruce de poleas (de arriba hacia abajo, o de abajo hacia arriba), visto de lado. */
export function cruce({ bajo = false } = {}) {
  return {
    fases: RITMOS.tira,
    pose(s, m) {
      const cuerpo = dePie(m, { pierna: 6, muslo: 6, tronco: bajo ? 4 : 14 }), { hombro } = cuerpo;
      const a = bajo ? mix(168, 76, s) : mix(48, 148, s), brazos = brazoFK(m, hombro, a, a - 6);
      return armar(m, { ...cuerpo, ...brazos, equipo: cable(bajo ? { x: hombro.x - 0.2, y: 0.15 } : { x: hombro.x - 0.15, y: 2.25 }, brazos.mano) }, 0);
    },
  };
}

/** Encogimiento de hombros: los hombros suben hacia las orejas con los brazos colgando. */
export function encogimiento({ carga = 'mancuernas' } = {}) {
  return {
    fases: RITMOS.sube,
    pose(s, m) {
      const base = dePie(m, { pierna: 2 }), hombro = mas(base.hombro, 0, 0.045 * s), brazos = brazoFK(m, hombro, 180, 180);
      return armar(m, { ...base, hombro, ...brazos, equipo: carga === 'barra' ? barraCon(brazos.mano) : mancuernas(brazos.mano) }, 0);
    },
  };
}

/** Curl de muñeca (palmas arriba) o extensión (palmas abajo): los antebrazos apoyados en los muslos. */
export function muneca({ extension = false } = {}) {
  return {
    fases: RITMOS.sube,
    pose(s, m) {
      const cuerpo = sentado(m, { tronco: 28, cadera: { x: 0, y: 0.5 } }), { hombro, rodilla, cadera } = cuerpo;
      const muneca = mas(rodilla, 0.08, 0.06), codo = mas(cadera, 0.16, 0.08), giro = mix(extension ? 210 : 150, extension ? 120 : 60, s);
      const puno = D(muneca, 0.07, giro);
      return armar(m, { ...cuerpo, codo, mano: muneca, puno, equipo: [...asiento(cadera, 0, m), ...discosChicos(puno)] }, 30);
    },
  };
}

// ── Piernas en máquina ────────────────────────────────────────────────────────────────────────────────────────
/** Extensión de cuádriceps: sentado, la pierna sube hasta quedar estirada. */
export function extensionCuadriceps() {
  return {
    fases: RITMOS.extiende,
    pose(s, m) {
      // El asiento es alto: con la rodilla doblada los pies quedan en el aire.
      const cadera = { x: 0, y: 0.64 }, hombro = D(cadera, m.tronco, -8), rodilla = D(cadera, m.muslo, 92), tobillo = D(rodilla, m.pierna, mix(186, 96, s));
      return armar(m, { ...pieDeLaPierna(m, rodilla, tobillo, 10), rodilla, cadera, hombro, ...brazoIK(m, hombro, mas(cadera, 0.1, -0.03)), equipo: [...asiento(cadera, -8, m, 0.59), { tipo: 'rodillo', centro: D(tobillo, 0.07, mix(96, 6, s) + 90), capa: 'frente' }] }, 0);
    },
  };
}

/** Curl femoral acostado, sentado o de pie: la rodilla se dobla contra el rodillo. */
export function curlFemoral({ tipo = 'acostado' } = {}) {
  return {
    fases: RITMOS.extiende,
    pose(s, m) {
      if (tipo === 'acostado') {
        const cadera = { x: 0.42, y: 0.66 }, hombro = D(cadera, m.tronco, 90), rodilla = D(cadera, m.muslo, 268), tobillo = D(rodilla, m.pierna, mix(270, 372, s));
        return { ...pieDeLaPierna(m, rodilla, tobillo, 20), rodilla, cadera, hombro, ...brazoIK(m, hombro, mas(hombro, 0.26, -0.12), { x: 0, y: -1 }), equipo: [banco({ x: -0.02, y: 0.58 }, { x: 1.2, y: 0.58 }), { tipo: 'rodillo', centro: D(tobillo, 0.07, mix(270, 372, s) + 90), capa: 'frente' }], ...cabeza(m, hombro, 96) };
      }
      if (tipo === 'sentado') {
        const cadera = { x: 0, y: 0.66 }, hombro = D(cadera, m.tronco, -10), rodilla = D(cadera, m.muslo, 90), tobillo = D(rodilla, m.pierna, mix(96, 196, s));
        return armar(m, { ...pieDeLaPierna(m, rodilla, tobillo, 10), rodilla, cadera, hombro, ...brazoIK(m, hombro, mas(cadera, 0.12, -0.02)), equipo: [...asiento(cadera, -10, m, 0.61), { tipo: 'rodillo', centro: D(tobillo, 0.07, mix(96, 196, s) - 90), capa: 'frente' }, { tipo: 'rodillo', centro: mas(rodilla, -0.12, 0.1), capa: 'frente' }] }, 0);
      }
      const cuerpo = dePie(m, { pierna: 2, tronco: 8 }), { cadera, hombro } = cuerpo;
      const rodilla = D(cadera, m.muslo, 176), tobillo = D(rodilla, m.pierna, mix(194, 285, s)); // el pie que trabaja no apoya
      return armar(m, { ...cuerpo, ...brazoIK(m, hombro, mas(hombro, 0.3, -0.2)), lejos: { ...cuerpo }, rodilla, ...pieDeLaPierna(m, rodilla, tobillo, -10), equipo: [{ tipo: 'rodillo', centro: D(tobillo, 0.07, mix(194, 285, s) - 90), capa: 'frente' }, { tipo: 'poste', x: hombro.x + 0.35, y2: 1.3, capa: 'fondo' }] }, 0);
    },
  };
}

/** Pantorrillas de pie o en máquina: el talón sube girando sobre la punta del pie. */
export function pantorrilla({ maquina = false } = {}) {
  return {
    fases: RITMOS.sube,
    pose(s, m) {
      const ang = mix(0, 28, s), alto = maquina ? 0.08 : 0, p = pieDesdePunta(m, { x: 0.2, y: alto }, -ang);
      const rodilla = D(p.tobillo, m.pierna, 2), cadera = D(rodilla, m.muslo, 0), hombro = D(cadera, m.tronco, 0);
      const equipo = maquina ? [{ tipo: 'cajon', x1: 0.02, x2: 0.36, alto, capa: 'fondo' }, { tipo: 'rodillo', centro: mas(hombro, -0.02, 0.07), capa: 'frente' }, { tipo: 'poste', x: hombro.x - 0.3, y2: 2, capa: 'fondo' }] : [];
      return armar(m, { ...p, rodilla, cadera, hombro, ...(maquina ? brazoIK(m, hombro, mas(hombro, 0.05, 0.1)) : brazoFK(m, hombro, 180, 180)), equipo }, 0);
    },
  };
}

/** Extensión lumbar en máquina: sentado, el tronco vuelve desde inclinado hasta quedar recto. */
export function extensionLumbar() {
  return {
    fases: RITMOS.extiende,
    pose(s, m) {
      const cuerpo = sentado(m, { tronco: mix(38, -8, s) }), { cadera, hombro } = cuerpo;
      return armar(m, { ...cuerpo, ...brazoIK(m, hombro, enTronco(cadera, hombro, m.tronco * 0.8, 0.14), { x: 0.3, y: -1 }), equipo: [...asiento(cadera, 0, m), { tipo: 'rodillo', centro: enTronco(cadera, hombro, m.tronco * 0.75, -0.13), capa: 'fondo' }] }, mix(30, 0, s));
    },
  };
}

// ── Core ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Acostado boca arriba con rodillas dobladas y pies en el suelo: el punto de partida de varios abdominales. */
function supino(m, incl, { pies = 0.46, cadera = { x: 0, y: 0.11 } } = {}) {
  const t = bocaArriba(m, cadera, incl), base = pie(m, { x: pies, y: m.tobillo });
  return { ...base, ...t, rodilla: piernaIK(m, t.cadera, base.tobillo, { x: 0.2, y: 1 }) };
}
const conCabeza = (m, p, extra = 10) => ({ ...p, ...cabeza(m, p.hombro, angulo(p.cadera, p.hombro) + extra) });

/**
 * Abdominales con flexión del tronco. tipo: 'crunch', 'completo' (sit-up), 'declinado', 'maquina', 'polea' (de
 * rodillas), 'inverso' (la pelvis sube), 'navaja' (brazos y piernas se juntan), 'tocarPies', 'bicicleta' y 'hollow'.
 */
export function abdominal({ tipo = 'crunch', lastre = false } = {}) {
  return {
    fases: tipo === 'bicicleta' ? RITMOS.alterna : tipo === 'hollow' ? RITMOS.circulos : RITMOS.sube,
    pose(s, m) {
      if (tipo === 'polea') {
        const rodilla = { x: 0, y: 0.06 }, cadera = D(rodilla, m.muslo, 4), hombro = D(cadera, m.tronco, mix(18, 82, s));
        const mano = enTronco(cadera, hombro, m.tronco + 0.08, 0.12), tobillo = { x: -0.43, y: 0.08 };
        return conCabeza(m, { ...pie(m, tobillo, 205), rodilla, cadera, hombro, ...brazoIK(m, hombro, mano, { x: 0, y: -1 }), equipo: cable({ x: 0.55, y: 2.1 }, mano) }, -30);
      }
      if (tipo === 'maquina') {
        const cuerpo = sentado(m, { tronco: mix(-6, 38, s) }), { cadera, hombro } = cuerpo;
        return armar(m, { ...cuerpo, ...brazoIK(m, hombro, enTronco(cadera, hombro, m.tronco * 0.9, 0.16), { x: 0.3, y: -1 }), equipo: [...asiento(cadera, 0, m), { tipo: 'rodillo', centro: enTronco(cadera, hombro, m.tronco * 0.85, 0.2), capa: 'frente' }] }, mix(0, 30, s));
      }
      if (tipo === 'declinado') {
        const cadera = { x: 0, y: 0.72 }, hombro = D(cadera, m.tronco, mix(-112, -40, s)), tobillo = { x: 0.48, y: 0.6 }, rodilla = piernaIK(m, cadera, tobillo, { x: 0, y: 1 });
        return conCabeza(m, { ...pie(m, tobillo, 20), rodilla, cadera, hombro, ...brazoIK(m, hombro, enTronco(cadera, hombro, m.tronco * 0.8, 0.13), { x: 0, y: 1 }), equipo: [banco({ x: -0.9, y: 0.4 }, { x: 0.5, y: 0.66 }), { tipo: 'rodillo', centro: { x: 0.56, y: 0.74 }, capa: 'frente' }] });
      }
      if (tipo === 'inverso') {
        const t = bocaArriba(m, { x: 0, y: 0.11 }, 2), rodilla = D(t.cadera, m.muslo, mix(-2, -46, s)), tobillo = D(rodilla, m.pierna, mix(88, 44, s));
        return conCabeza(m, { ...pieDeLaPierna(m, rodilla, tobillo), ...t, rodilla, ...brazoFK(m, t.hombro, 92, 92) });
      }
      if (tipo === 'navaja' || tipo === 'tocarPies' || tipo === 'hollow') {
        const vaiven = tipo === 'hollow' ? Math.sin(s * Math.PI * 2) * 8 : 0;
        const incl = tipo === 'navaja' ? mix(2, 50, s) : tipo === 'tocarPies' ? mix(4, 30, s) : 20 + vaiven;
        const piernas = tipo === 'navaja' ? mix(88, 40, s) : tipo === 'tocarPies' ? 4 : 70 - vaiven;
        const t = bocaArriba(m, { x: 0, y: 0.11 }, incl), rodilla = D(t.cadera, m.muslo, piernas), tobillo = D(rodilla, m.pierna, piernas);
        const brazo = tipo === 'navaja' ? mix(-96, 42, s) : tipo === 'tocarPies' ? mix(-20, 20, s) : -100;
        return conCabeza(m, { ...pieDeLaPierna(m, rodilla, tobillo, -10), ...t, rodilla, ...brazoFK(m, t.hombro, brazo, brazo) });
      }
      if (tipo === 'bicicleta') {
        const t = bocaArriba(m, { x: 0, y: 0.11 }, 24);
        const pierna = (k) => { const rod = D(t.cadera, m.muslo, mix(70, 10, k)), tob = D(rod, m.pierna, mix(76, 96, k)); return { rodilla: rod, ...pieDeLaPierna(m, rod, tob) }; };
        const manos = cabeza(m, t.hombro, angulo(t.cadera, t.hombro) + 10).cabeza;
        return conCabeza(m, { ...t, ...pierna(s), ...brazoIK(m, t.hombro, mas(manos, -0.04, 0.02), { x: 0.4, y: 1 }), lejos: pierna(1 - s) });
      }
      const incl = tipo === 'completo' ? mix(3, 78, s) : mix(3, 30, s), p = supino(m, incl);
      const manos = tipo === 'completo' ? cabeza(m, p.hombro, angulo(p.cadera, p.hombro) + 10).cabeza : enTronco(p.cadera, p.hombro, m.tronco * 0.78, 0.13);
      return conCabeza(m, { ...p, ...brazoIK(m, p.hombro, mas(manos, 0, 0.02), { x: 0.3, y: 1 }), equipo: lastre ? [{ tipo: 'disco', centro: enTronco(p.cadera, p.hombro, m.tronco * 0.75, 0.2), r: 0.12, capa: 'frente' }] : [] });
    },
  };
}

/** Elevación de rodillas colgado de la barra o en paralelas (con la espalda en el respaldo). */
export function elevacionRodillas({ paralelas = false, piernasRectas = false } = {}) {
  return {
    fases: RITMOS.sube,
    pose(s, m) {
      const L = largoBrazo(m);
      const hombro = paralelas ? { x: 0, y: 1.58 } : { x: -0.04, y: 2.28 - L * 0.97 };
      const cadera = D(hombro, m.tronco, 180), rodilla = D(cadera, m.muslo, mix(178, piernasRectas ? 96 : 84, s));
      const tobillo = D(rodilla, m.pierna, piernasRectas ? mix(178, 96, s) : mix(182, 178, s));
      const brazos = paralelas ? { codo: mas(hombro, 0.02, -0.3), mano: mas(hombro, 0.3, -0.28) } : brazoIK(m, hombro, { x: 0, y: 2.28 }, { x: 0.6, y: -1 });
      const equipo = paralelas ? [{ tipo: 'banco', a: mas(brazos.codo, -0.05, -0.04), b: mas(brazos.mano, 0.05, -0.04), patas: false, capa: 'fondo' }, banco(enTronco(cadera, hombro, 0, -0.13), enTronco(cadera, hombro, m.tronco + 0.1, -0.13), { patas: false }), { tipo: 'poste', x: hombro.x - 0.2, y2: 1.7, capa: 'fondo' }] : [{ tipo: 'barraFija', centro: { x: 0, y: 2.3 }, capa: 'frente' }];
      return { ...pieDeLaPierna(m, rodilla, tobillo, 25), rodilla, cadera, hombro, ...brazos, equipo, ...cabeza(m, hombro, 2) };
    },
  };
}

/** Plancha (sobre antebrazos, o con las rodillas apoyadas): se mantiene el cuerpo recto respirando. */
export function plancha({ rodillas = false } = {}) {
  return {
    fases: RITMOS.sostiene,
    pose(s, m, fase, enFase) {
      const r = respira(fase, enFase) * 0.006, codo = { x: 0, y: 0.04 }, hombro = { x: 0, y: 0.04 + m.brazo * 0.98 + r };
      let p;
      if (rodillas) {
        const rodilla = { x: -0.78, y: 0.06 }, th = Math.atan2(hombro.y - rodilla.y, hombro.x - rodilla.x), dir = { x: Math.cos(th), y: Math.sin(th) };
        p = { rodilla, cadera: { x: rodilla.x + dir.x * m.muslo, y: rodilla.y + dir.y * m.muslo }, ...pie(m, { x: rodilla.x - m.pierna * 0.95, y: 0.1 }, 160) };
        p.hombro = { x: rodilla.x + dir.x * (m.muslo + m.tronco), y: rodilla.y + dir.y * (m.muslo + m.tronco) };
      } else {
        const largo = m.pierna + m.muslo + m.tronco, pf = pieDesdePunta(m, { x: 0, y: 0 }, -72);
        const th = Math.asin((hombro.y - pf.tobillo.y) / largo), dir = { x: Math.cos(th), y: Math.sin(th) };
        const apoyo = { x: hombro.x - dir.x * largo, y: pf.tobillo.y }, corre = apoyo.x - pf.tobillo.x, punto = d => ({ x: apoyo.x + dir.x * d, y: apoyo.y + dir.y * d });
        p = { talon: mas(pf.talon, corre, 0), punta: mas(pf.punta, corre, 0), tobillo: apoyo, rodilla: punto(m.pierna), cadera: punto(m.pierna + m.muslo), hombro: punto(largo) };
      }
      return { ...p, codo: mas(codo, 0, 0), mano: mas(codo, m.antebrazo * 0.95, 0), equipo: [{ tipo: 'colchoneta', x1: -1.5, x2: 0.4, capa: 'fondo' }], ...cabeza(m, p.hombro, 90 - (Math.atan2(p.hombro.y - p.cadera.y, p.hombro.x - p.cadera.x) * 180) / Math.PI) };
    },
  };
}

/** Bicho muerto: boca arriba, brazos al techo y piernas en 90-90; este brazo baja atrás mientras la otra pierna se estira. */
export function bichoMuerto() {
  return {
    fases: RITMOS.alterna,
    pose(s, m) {
      const t = bocaArriba(m, { x: 0, y: 0.11 }, 2);
      const rodilla = D(t.cadera, m.muslo, 2), tobillo = D(rodilla, m.pierna, 92);
      const rodL = D(t.cadera, m.muslo, mix(2, 80, s)), tobL = D(rodL, m.pierna, mix(92, 82, s));
      return conCabeza(m, { ...pieDeLaPierna(m, rodilla, tobillo), ...t, rodilla, ...brazoFK(m, t.hombro, mix(4, -86, s), mix(4, -86, s)), lejos: { rodilla: rodL, ...pieDeLaPierna(m, rodL, tobL), ...brazoFK(m, t.hombro, 4, 4) }, equipo: [{ tipo: 'colchoneta', x1: -1, x2: 0.7, capa: 'fondo' }] });
    },
  };
}

/** Pájaro-perro: en cuatro apoyos, este brazo va adelante y la otra pierna atrás, con la espalda quieta. */
export function birdDog() {
  return {
    fases: RITMOS.alterna,
    pose(s, m) {
      const rodilla = { x: 0, y: 0.05 }, cadera = D(rodilla, m.muslo, 0), hombro = D(cadera, m.tronco, 90), tobillo = mas(rodilla, -m.pierna * 0.98, 0.04);
      const sube = Math.sqrt(s), rodL = D(cadera, m.muslo, mix(180, 268, sube)), tobL = D(rodL, m.pierna, 268);
      const tobAhora = s < 0.3 ? mixP(tobillo, tobL, s / 0.3) : tobL;
      const apoyoL = { rodilla: rodL, ...(s < 0.35 ? pie(m, tobAhora, 175) : pieDeLaPierna(m, rodL, tobAhora, -45)) };
      return { ...pie(m, tobillo, 175), rodilla, cadera, hombro, ...brazoFK(m, hombro, mix(180, 88, s), mix(180, 88, s)), lejos: { ...apoyoL, ...brazoFK(m, hombro, 180, 180) }, equipo: [{ tipo: 'colchoneta', x1: -0.7, x2: 0.9, capa: 'fondo' }], ...cabeza(m, hombro, 96) };
    },
  };
}

/** Rueda abdominal de rodillas: los brazos llevan la rueda hacia adelante con el tronco firme, y vuelven. */
export function ruedaAbdominal() {
  return {
    fases: RITMOS.bajaSube,
    pose(s, m) {
      const rodilla = { x: 0, y: 0.06 }, cadera = D(rodilla, m.muslo, mix(28, 62, s)), hombro = D(cadera, m.tronco, mix(62, 84, s));
      const rueda = { x: mix(hombro.x + 0.02, hombro.x + 0.38, s), y: 0.09 }, tobillo = mas(rodilla, -m.pierna * 0.97, 0.05);
      return { ...pie(m, tobillo, 175), rodilla, cadera, hombro, ...brazoIK(m, hombro, rueda, { x: -1, y: 0 }), equipo: [{ tipo: 'disco', centro: rueda, r: 0.09, capa: 'frente' }], ...cabeza(m, hombro, 86) };
    },
  };
}

/** Pallof: de pie, las manos empujan la manija al frente del pecho sin dejar que el tronco gire. */
export function pallof() {
  return {
    fases: RITMOS.extiende,
    pose(s, m) {
      const cuerpo = dePie(m, { pierna: 6, muslo: 6 }), { hombro } = cuerpo, mano = mixP(mas(hombro, 0.14, -0.08), mas(hombro, largoBrazo(m) * 0.93, -0.06), s);
      return armar(m, { ...cuerpo, ...brazoIK(m, hombro, mano, { x: 0, y: -1 }), equipo: [{ tipo: 'cable', desde: { x: hombro.x - 0.15, y: hombro.y - 0.06 }, hasta: mano, capa: 'fondo' }, { tipo: 'mango', centro: mano, capa: 'frente' }] }, 0);
    },
  };
}

// ── Caminar, trotar y subir ───────────────────────────────────────────────────────────────────────────────────
/**
 * Marcha en el lugar (sin avanzar, como en una cinta). correr: trote. escalera: escaladora. granjero: con mancuernas.
 * cinta: dibuja la cinta (inclinada si inclinacion > 0). rodillas: marcha levantando las rodillas.
 */
export function marcha({ correr = false, escalera = false, granjero = false, cinta = false, inclinacion = 0, rodillas = false } = {}) {
  return {
    fases: correr ? RITMOS.trota : escalera ? RITMOS.sube_escalon : RITMOS.camina,
    pose(s, m) {
      const ampMuslo = correr ? 32 : escalera ? 26 : rodillas ? 38 : 18, base = correr ? 6 : escalera ? 28 : rodillas ? 30 : 2;
      const pierna = fase => {
        const c = Math.cos(fase * Math.PI * 2), muslo = base + ampMuslo * c;
        const flex = fase < 0.6 ? (correr ? 22 : 6) + (correr ? 18 : 10) * Math.sin((Math.PI * fase) / 0.6) : (correr ? 22 : 6) + (correr ? 85 : escalera ? 70 : rodillas ? 85 : 52) * Math.sin((Math.PI * (fase - 0.6)) / 0.4);
        const rodilla = D({ x: 0, y: 0 }, m.muslo, 180 - muslo), tobillo = D(rodilla, m.pierna, 180 - muslo + flex);
        return { rodilla, tobillo };
      };
      const cerca = pierna(s), lejos = pierna((s + 0.5) % 1);
      const pies = [cerca, lejos].map(l => ({ ...l, ...pieDeLaPierna(m, l.rodilla, l.tobillo, -6) }));
      const bajo = Math.min(...pies.flatMap(p => [p.talon.y, p.punta.y]));
      const sube = escalera ? 0.18 + 0.09 * Math.sin(s * Math.PI * 4) : correr ? 0.01 : 0;
      const mover = p => ({ x: p.x, y: p.y - bajo + sube });
      const [a, b] = pies.map(p => ({ rodilla: mover(p.rodilla), tobillo: mover(p.tobillo), talon: mover(p.talon), punta: mover(p.punta) }));
      const cadera = mover({ x: 0, y: 0 }), hombro = D(cadera, m.tronco, correr ? 9 : inclinacion ? 7 : 3);
      const giro = (correr ? 34 : 22) * Math.cos(s * Math.PI * 2);
      const brazo = k => (granjero ? brazoFK(m, hombro, 180, 180) : correr ? brazoFK(m, hombro, 180 - k, 90 - k) : brazoFK(m, hombro, 180 - k, 170 - k));
      const equipo = [];
      if (cinta) equipo.push({ tipo: 'cinta', x1: -0.75, y1: -0.03, x2: 0.75, y2: -0.03 + Math.tan(R(inclinacion)) * 1.5, capa: 'fondo' });
      if (escalera) equipo.push({ tipo: 'escalones', puntos: [{ x: -0.35, y: 0.18 }, { x: -0.05, y: 0.36 }, { x: 0.25, y: 0.54 }], capa: 'fondo' });
      const brazoCerca = brazo(-giro), brazoLejos = brazo(giro);
      if (granjero) equipo.push(...mancuernas(brazoCerca.mano, mas(brazoLejos.mano, 0.02, 0.01)));
      return { ...a, cadera, hombro, ...brazoCerca, lejos: { ...b, ...brazoLejos }, equipo, ...cabeza(m, hombro, 2) };
    },
  };
}

/** Colgarse de la barra (agarre o estiramiento del dorsal): se mantiene colgado respirando. */
export function colgado() {
  return {
    fases: RITMOS.sostiene,
    pose(s, m, fase, enFase) {
      const barra = { x: 0, y: 2.3 }, L = largoBrazo(m), r = respira(fase, enFase) * 0.008;
      const hombro = { x: -0.03, y: barra.y - L * 0.98 + r }, cadera = D(hombro, m.tronco, 178), rodilla = D(cadera, m.muslo, 178), tobillo = D(rodilla, m.pierna, 186);
      return { ...pieDeLaPierna(m, rodilla, tobillo, 40), rodilla, cadera, hombro, ...brazoIK(m, hombro, mas(barra, 0, -0.02), { x: 0.6, y: -1 }), equipo: [{ tipo: 'barraFija', centro: barra, capa: 'frente' }], ...cabeza(m, hombro, 0) };
    },
  };
}

/** Respiración 90-90: boca arriba con caderas y rodillas en 90 grados, los pies apoyados en la pared. */
export function respiracion9090() {
  return {
    fases: RITMOS.sostiene,
    pose(s, m, fase, enFase) {
      const t = bocaArriba(m, { x: 0, y: 0.11 }, 1 + respira(fase, enFase) * 1.5), rodilla = D(t.cadera, m.muslo, 4), tobillo = D(rodilla, m.pierna, 92);
      return conCabeza(m, { ...pieDeLaPierna(m, rodilla, tobillo), ...t, rodilla, ...brazoFK(m, t.hombro, 120, 120), equipo: [{ tipo: 'pared', x: tobillo.x + 0.1, capa: 'fondo' }] });
    },
  };
}

// ── Estiramientos (entra, mantiene respirando y sale) ─────────────────────────────────────────────────────────
const sostener = pose => ({ fases: RITMOS.mantiene, pose });
const brazosColgando = (m, hombro) => brazoFK(m, hombro, 178, 176);

export const ESTIRAMIENTOS = {
  /** Pectoral en el marco de la puerta: el antebrazo apoyado atrás y el cuerpo avanza. */
  pectoral: () => sostener((s, m, f, e) => {
    const cuerpo = dePie(m, { pierna: mix(0, 8, s), tronco: mix(0, 10, s) + respira(f, e) }), { hombro } = cuerpo;
    const codo = mas(hombro, -0.24, -0.02), mano = mas(codo, -0.02, 0.24), atras = dePie(m, { x: -0.4, pierna: -6 });
    return armar(m, { ...cuerpo, codo, mano, lejos: { ...soloPierna(atras), rodilla: piernaIK(m, cuerpo.cadera, atras.tobillo, { x: 1, y: 0 }), ...brazosColgando(m, hombro) }, equipo: [{ tipo: 'marco', x: codo.x - 0.1, capa: 'fondo' }] }, 0);
  }),
  /** Flexor de cadera en estocada: la rodilla de atrás en el suelo y la cadera avanza. */
  flexorCadera: () => sostener((s, m, f, e) => {
    const delante = pie(m, { x: 0.15, y: m.tobillo }), rodAtras = { x: -0.42, y: 0.06 }, tobAtras = mas(rodAtras, -m.pierna * 0.97, 0.05);
    const cadera = { x: mix(-0.36, -0.22, s) + respira(f, e) * 0.01, y: 0.5 }, hombro = D(cadera, m.tronco, -2);
    const rodilla = piernaIK(m, cadera, delante.tobillo, { x: 1, y: 0.3 });
    return armar(m, { ...delante, rodilla, cadera, hombro, ...brazoIK(m, hombro, mas(rodilla, -0.02, 0.06), { x: -0.5, y: -1 }), lejos: { ...pie(m, tobAtras, 175), rodilla: piernaIK(m, cadera, rodAtras, { x: 0, y: -1 }), tobillo: tobAtras } }, 0);
  }),
  /** Glúteo en figura 4 acostado: un tobillo sobre la otra rodilla y ambas piernas hacia el pecho. */
  gluteo: () => sostener((s, m, f, e) => {
    const t = bocaArriba(m, { x: 0, y: 0.11 }, 2), ang = mix(10, -32, s) - respira(f, e) * 2;
    const rodL = D(t.cadera, m.muslo, ang), tobL = D(rodL, m.pierna, ang + 92);
    const tobillo = mas(rodL, 0.04, 0.05), rodilla = piernaIK(m, t.cadera, tobillo, { x: 0.3, y: 1 });
    return conCabeza(m, { ...pieDeLaPierna(m, rodilla, tobillo), ...t, rodilla, ...brazoIK(m, t.hombro, mas(rodL, -0.06, -0.04), { x: -0.3, y: 1 }), lejos: { rodilla: rodL, ...pieDeLaPierna(m, rodL, tobL) }, equipo: [{ tipo: 'colchoneta', x1: -1, x2: 0.6, capa: 'fondo' }] });
  }),
  /** Isquiotibiales acostado con banda: una pierna estirada hacia el techo, la otra en el suelo. */
  isquiotibiales: () => sostener((s, m, f, e) => {
    const t = bocaArriba(m, { x: 0, y: 0.11 }, 1), ang = mix(40, -6, s) - respira(f, e) * 2;
    const rodilla = D(t.cadera, m.muslo, ang), tobillo = D(rodilla, m.pierna, ang), p = pieDeLaPierna(m, rodilla, tobillo, -5);
    const rodL = D(t.cadera, m.muslo, 89), tobL = D(rodL, m.pierna, 89);
    const mano = enTronco(t.cadera, t.hombro, m.tronco * 0.9, 0.3);
    return conCabeza(m, { ...p, ...t, rodilla, ...brazoIK(m, t.hombro, mano, { x: -0.5, y: 1 }), lejos: { rodilla: rodL, ...pieDeLaPierna(m, rodL, tobL, -20) }, equipo: [{ tipo: 'banda', puntos: [mano, p.punta], capa: 'frente' }, { tipo: 'colchoneta', x1: -1, x2: 1.1, capa: 'fondo' }] });
  }),
  /** Aductores en mariposa: sentado, las plantas juntas y el tronco se inclina adelante. */
  aductor: () => PASOS_FRENTE.mariposa(), // plantas juntas y rodillas a los lados: se entiende de frente
  /** Cuádriceps de pie: una pierna sostiene y la mano lleva el talón de la otra hacia el glúteo. */
  cuadriceps: () => sostener((s, m, f, e) => {
    const cuerpo = dePie(m, { pierna: 1 }), { cadera, hombro } = cuerpo;
    const rodilla = D(cadera, m.muslo, mix(176, 186, s)), tobillo = D(rodilla, m.pierna, mix(205, 352, s) + respira(f, e));
    const p = pieDeLaPierna(m, rodilla, tobillo, -15);
    return armar(m, { ...cuerpo, rodilla, ...p, ...brazoIK(m, hombro, mas(tobillo, 0, -0.02), { x: -1, y: 0 }), lejos: { ...cuerpo, ...brazoFK(m, hombro, 150, 140) } }, 0);
  }),
  /** Pantorrilla en la pared: las manos en la pared, la pierna de atrás estirada con el talón en el suelo. */
  pantorrilla: () => sostener((s, m, f, e) => {
    const delante = pie(m, { x: 0.15, y: m.tobillo }), atras = pie(m, { x: -0.62, y: m.tobillo });
    const cadera = { x: mix(-0.25, -0.15, s) + respira(f, e) * 0.008, y: 0.86 }, hombro = D(cadera, m.tronco, mix(12, 22, s));
    const pared = hombro.x + 0.55, mano = { x: pared - 0.02, y: hombro.y + 0.05 };
    return armar(m, { ...delante, rodilla: piernaIK(m, cadera, delante.tobillo, { x: 1, y: 0.2 }), cadera, hombro, ...brazoIK(m, hombro, mano, { x: 0, y: -1 }), lejos: { ...atras, rodilla: piernaIK(m, cadera, atras.tobillo, { x: 1, y: 0 }) }, equipo: [{ tipo: 'pared', x: pared, capa: 'fondo' }] }, 8);
  }),
  dorsal: colgado,
  /** Bíceps y antebrazo en la pared: el brazo estirado atrás con la palma apoyada. */
  biceps: () => sostener((s, m, f, e) => {
    const cuerpo = dePie(m, { pierna: 1, tronco: mix(0, 4, s) }), { hombro } = cuerpo, brazos = brazoFK(m, hombro, mix(200, 258, s) + respira(f, e), mix(200, 260, s));
    return armar(m, { ...cuerpo, ...brazos, equipo: [{ tipo: 'pared', x: brazos.mano.x - 0.1, capa: 'fondo' }] }, 0);
  }),
  /** Tríceps sobre la cabeza: el codo arriba, la mano detrás de la nuca y la otra mano empuja el codo. */
  triceps: () => sostener((s, m, f, e) => {
    const cuerpo = dePie(m, { pierna: 1 }), { hombro } = cuerpo, brazos = brazoFK(m, hombro, mix(150, -8, s), mix(150, 186, s) + respira(f, e));
    return armar(m, { ...cuerpo, ...brazos, lejos: { ...cuerpo, ...brazoIK(m, hombro, mas(brazos.codo, 0.03, 0.02), { x: 1, y: 0.3 }) } }, mix(0, 10, s));
  }),
};

// ── Calentamiento ─────────────────────────────────────────────────────────────────────────────────────────────
export const CALENTAMIENTOS = {
  /** Círculos de hombro: los brazos estirados dan vueltas grandes y lentas. */
  circulosHombro: () => ({ fases: RITMOS.circulos, pose(s, m) { const c = dePie(m, { pierna: 1 }), a = 180 + 360 * s; return armar(m, { ...c, ...brazoFK(m, c.hombro, a, a - 4), lejos: { ...c, ...brazoFK(m, c.hombro, a, a - 4) } }, 0); } }),
  /** Deslizamiento en pared: la espalda y los brazos apoyados, los brazos suben de W a Y. */
  deslizamientoPared: () => ({ fases: RITMOS.sube, pose(s, m) { const c = dePie(m, { pierna: 2 }), b = brazoFK(m, c.hombro, mix(120, 14, s), mix(20, 6, s), 0.7, 0.9); return armar(m, { ...c, ...b, equipo: [{ tipo: 'pared', x: c.cadera.x - 0.22, capa: 'fondo' }] }, 0); } }),
  /** Empuje de omóplatos en pared: apoyado con los brazos estirados, el pecho se aleja de la pared. */
  serrato: () => ({ fases: RITMOS.extiende, pose(s, m) {
    const c = dePie(m, { pierna: 8, tronco: 12, x: -0.1 }), hombro = mas(c.hombro, 0.03 * s, 0), mano = { x: c.hombro.x + largoBrazo(m) * 0.97, y: c.hombro.y + 0.02 };
    return armar(m, { ...c, hombro, ...brazoIK(m, hombro, mano, { x: 0, y: -1 }), equipo: [{ tipo: 'pared', x: mano.x + 0.04, capa: 'fondo' }] }, 6);
  } }),
  facePull: () => facePull({ banda: true }),
  /** Círculos de cadera de pie: la rodilla sube y dibuja un círculo hacia afuera. */
  circulosCadera: () => ({ fases: RITMOS.circulos, pose(s, m) {
    const c = dePie(m, { pierna: 1 }), muslo = 120 - 30 * Math.cos(s * Math.PI * 2), rodilla = D(c.cadera, m.muslo, 180 - muslo + 0), tobillo = D(rodilla, m.pierna, 180 - muslo + 75);
    return armar(m, { ...c, rodilla, ...pieDeLaPierna(m, rodilla, tobillo, 10), ...brazoFK(m, c.hombro, 150, 120), lejos: { ...c }, equipo: [{ tipo: 'pared', x: c.hombro.x + 0.62, capa: 'fondo' }] }, 0);
  } }),
  /** Movilidad de tobillo contra la pared: la rodilla avanza sobre la punta del pie sin levantar el talón. */
  tobillo: () => ({ fases: RITMOS.extiende, pose(s, m) {
    // Medio arrodillado: la rodilla de atrás en el suelo; la cadera queda a un muslo de cada rodilla.
    const delante = pie(m, { x: 0, y: m.tobillo }), rodilla = D(delante.tobillo, m.pierna, mix(8, 38, s)), atras = { x: -0.5, y: 0.06 };
    const cadera = ik(rodilla, atras, m.muslo, m.muslo, { x: 0, y: 1 }), hombro = D(cadera, m.tronco, 6), pared = delante.punta.x + 0.12;
    return armar(m, { ...delante, rodilla, cadera, hombro, ...brazoIK(m, hombro, { x: pared - 0.02, y: hombro.y }, { x: 0, y: -1 }), lejos: { ...pie(m, mas(atras, -m.pierna * 0.95, 0.04), 175), rodilla: atras }, equipo: [{ tipo: 'pared', x: pared, capa: 'fondo' }] }, 0);
  } }),
  bisagra: () => rumano({ carga: 'manos', rodillas: 14, hasta: 0.62, pared: true }),
  flexionCodo: () => curl({ carga: 'mancuernas' }),
  /** Activación de dorsal con banda: los brazos estirados bajan desde adelante hasta los muslos. */
  dorsal: () => ({ fases: RITMOS.tira, pose(s, m) {
    const c = dePie(m, { pierna: 6, muslo: 10, tronco: 14 }), a = mix(52, 172, s), b = brazoFK(m, c.hombro, a, a - 4), ancla = { x: c.hombro.x + 0.9, y: 2.0 };
    return armar(m, { ...c, ...b, equipo: [{ tipo: 'banda', puntos: [b.mano, ancla], capa: 'fondo' }, { tipo: 'poste', x: ancla.x + 0.03, y2: 2.1, capa: 'fondo' }] }, 6);
  } }),
  /** Paso de banda sobre la cabeza: los brazos estirados pasan desde adelante hasta atrás por arriba. */
  pasoBanda: () => ({ fases: RITMOS.extiende, pose(s, m) {
    const c = dePie(m, { pierna: 1 }), a = mix(168, -168, s), b = brazoFK(m, c.hombro, a, a);
    return armar(m, { ...c, ...b, equipo: [{ tipo: 'banda', puntos: [b.mano, mas(b.mano, 0.01, 0.01)], capa: 'frente' }] }, 0);
  } }),
  colgarse: colgado,
  /** Extensión terminal de rodilla con banda: la banda tira de la rodilla y la pierna se estira por completo. */
  rodillaBanda: () => ({ fases: RITMOS.extiende, pose(s, m) {
    const p = pie(m, { x: 0, y: m.tobillo }), rodilla = D(p.tobillo, m.pierna, mix(18, 0, s)), cadera = D(rodilla, m.muslo, -mix(22, 0, s)), hombro = D(cadera, m.tronco, mix(10, 2, s));
    const atras = dePie(m, { x: -0.3, pierna: -4 }), ancla = { x: 0.7, y: rodilla.y };
    return armar(m, { ...p, rodilla, cadera, hombro, ...brazoFK(m, hombro, 176, 170), lejos: { ...soloPierna(atras), rodilla: piernaIK(m, cadera, atras.tobillo, { x: 1, y: 0 }) }, equipo: [{ tipo: 'banda', puntos: [mas(rodilla, -0.06, 0), ancla], capa: 'frente' }, { tipo: 'poste', x: ancla.x + 0.03, y2: 0.9, capa: 'fondo' }] }, 0);
  } }),
  /** Movilidad de cuello: la cabeza baja y sube despacio, sin forzar. */
  cuello: () => PASOS_FRENTE.cuello(), // gira la cabeza a cada lado: se ve de frente
  /** Muñecas en cuatro apoyos: las palmas quietas bajo los hombros y el peso va unos centímetros adelante y vuelve. */
  muneca: () => ({
    fases: RITMOS.extiende,
    pose(s, m) {
      const rodilla = { x: 0, y: 0.05 }, tobillo = mas(rodilla, -m.pierna * 0.98, 0.04), largo = largoBrazo(m);
      const cadera0 = D(rodilla, m.muslo, 0), mano = { x: cadera0.x + Math.sqrt(m.tronco ** 2 - (0.035 + largo - cadera0.y) ** 2), y: 0.035 };
      const cadera = D(rodilla, m.muslo, mix(0, 11, s)), hombro = dosSegmentos(cadera, mano, m.tronco, largo - 1e-4, 1);
      return armar(m, { ...pie(m, tobillo, 175), rodilla, cadera, hombro, ...brazoIK(m, hombro, mano, { x: -1, y: 0 }), equipo: [{ tipo: 'colchoneta', x1: -0.7, x2: 0.9, capa: 'fondo' }] }, 100);
    },
  }),
  marcha: () => marcha(), // marcha suave en el lugar
  puente: () => hipThrust({ suelo: true, carga: 'ninguna' }),
  remoLiviano: () => remoInclinado({ carga: 'mancuernas' }),
};

// ── Glúteos y espalda baja ────────────────────────────────────────────────────────────────────────────────────
/** Patada de glúteo: de pie en polea o máquina (una pierna sostiene) o en cuatro apoyos en el suelo. */
export function patadaGluteo({ tipo = 'polea' } = {}) {
  return {
    fases: RITMOS.extiende,
    pose(s, m) {
      if (tipo === 'suelo') {
        const rodilla = { x: 0, y: 0.05 }, cadera = D(rodilla, m.muslo, 0), hombro = D(cadera, m.tronco, 90), tobillo = mas(rodilla, -m.pierna * 0.98, 0.04);
        const sube = Math.sqrt(s), rodC = D(cadera, m.muslo, mix(180, 262, sube)), tobC = D(rodC, m.pierna, mix(268, 262, sube)); // la rodilla se despega rápido del suelo
        const tobAhora = s < 0.2 ? mixP(tobillo, tobC, s / 0.2) : tobC;
        return { ...(s < 0.35 ? pie(m, tobAhora, 175) : pieDeLaPierna(m, rodC, tobAhora, -45)), rodilla: rodC, cadera, hombro, ...brazoFK(m, hombro, 180, 180), lejos: { rodilla, ...pie(m, tobillo, 175) }, equipo: [{ tipo: 'colchoneta', x1: -0.7, x2: 0.9, capa: 'fondo' }], ...cabeza(m, hombro, 96) };
      }
      const apoyo = dePie(m, { pierna: 4, muslo: 18, tronco: 30 }), { cadera, hombro } = apoyo;
      const muslo = mix(166, 212, s), rodilla = D(cadera, m.muslo, muslo), tobillo = D(rodilla, m.pierna, tipo === 'maquina' ? muslo + 70 : muslo + mix(48, 4, s)); // la rodilla parte doblada y el pie no toca el suelo
      const p = pieDeLaPierna(m, rodilla, tobillo, tipo === 'maquina' ? 70 : -30); // en polea, la punta hacia la tibia
      const equipo = tipo === 'maquina' ? [{ tipo: 'rodillo', centro: mas(p.talon, -0.03, 0.02), capa: 'frente' }, { tipo: 'poste', x: hombro.x + 0.32, y2: 1.3, capa: 'fondo' }] : cable({ x: hombro.x + 0.25, y: 0.12 }, mas(tobillo, 0.02, -0.02));
      return armar(m, { ...p, rodilla, cadera, hombro, ...brazoIK(m, hombro, mas(hombro, 0.32, -0.12)), lejos: { ...apoyo }, equipo }, 20);
    },
  };
}

/** Hiperextensión a 45 grados: las piernas fijas y el tronco sube desde colgando hasta alinearse con ellas. */
export function hiperextension() {
  return {
    fases: RITMOS.sube,
    pose(s, m) {
      const tobillo = { x: -0.62, y: 0.24 }, dir = 45, rodilla = D(tobillo, m.pierna, dir), cadera = D(rodilla, m.muslo, dir), hombro = D(cadera, m.tronco, mix(168, dir, s));
      const abajo = { x: 0.075, y: -0.075 }; // el apoyo va bajo los muslos, del lado del cuádriceps
      const apoyo = { tipo: 'banco', a: mas(D(rodilla, 0.05, dir), abajo.x, abajo.y), b: mas(D(cadera, 0.05, dir), abajo.x, abajo.y), patas: false, capa: 'fondo' };
      const centro = mixP(apoyo.a, apoyo.b, 0.5);
      return armar(m, { ...pie(m, tobillo, dir - 90), rodilla, cadera, hombro, ...brazoIK(m, hombro, enTronco(cadera, hombro, m.tronco * 0.8, 0.14), { x: 0, y: 1 }), equipo: [{ tipo: 'poste', x: centro.x, y2: centro.y, capa: 'fondo' }, apoyo, { tipo: 'plataforma', a: mas(tobillo, -0.05, -0.1), b: mas(tobillo, 0.16, -0.1), capa: 'fondo' }, { tipo: 'poste', x: tobillo.x + 0.05, y2: tobillo.y - 0.1, capa: 'fondo' }] }, angulo(cadera, hombro) * 0.9);
    },
  };
}

/** Dragon flag: hombros en el banco y el cuerpo recto baja como una tabla. */
export function dragonFlag() {
  return {
    fases: RITMOS.bajaSube,
    pose(s, m) {
      const hombro = { x: -0.6, y: 0.56 }, th = R(mix(70, 14, s)), dir = { x: Math.cos(th), y: Math.sin(th) };
      const punto = d => ({ x: hombro.x + dir.x * d, y: hombro.y + dir.y * d });
      const cadera = punto(m.tronco), rodilla = punto(m.tronco + m.muslo), tobillo = punto(m.tronco + m.muslo + m.pierna);
      return conCabeza(m, { ...pieDeLaPierna(m, rodilla, tobillo, -20), rodilla, cadera, hombro, ...brazoIK(m, hombro, { x: -0.98, y: 0.5 }, { x: 0, y: 1 }), equipo: [banco({ x: -1.05, y: 0.45 }, { x: 0.1, y: 0.45 })] });
    },
  };
}

/** Elevación de piernas en el suelo (rectas o con las rodillas dobladas). */
export function elevacionPiernasSuelo({ rodillas = false } = {}) {
  return {
    fases: RITMOS.sube,
    pose(s, m) {
      const t = bocaArriba(m, { x: 0, y: 0.11 }, 2), muslo = mix(86, rodillas ? -8 : 4, s), rodilla = D(t.cadera, m.muslo, muslo), tobillo = D(rodilla, m.pierna, rodillas ? mix(88, 90, s) : muslo);
      return conCabeza(m, { ...pieDeLaPierna(m, rodilla, tobillo, -10), ...t, rodilla, ...brazoFK(m, t.hombro, 92, 92), equipo: [{ tipo: 'colchoneta', x1: -1, x2: 1.1, capa: 'fondo' }] });
    },
  };
}

// ── Qué animación tiene cada ejercicio del catálogo ──────────────────────────────────────────────────────────
const MAPA = {
  sentadilla_barra: () => sentadilla(), sentadilla_smith: () => sentadilla({ smith: true }), sentadilla_mancuernas: () => sentadilla({ carga: 'lados' }),
  sentadilla_corporal: () => sentadilla({ carga: 'libre' }), sentadilla_cajon_barra: () => sentadilla({ cajon: true, profundidad: 88 }), sentadilla_goblet: () => sentadilla({ carga: 'frente' }),
  sentadilla_sumo_kb: () => sentadilla({ carga: 'kettlebell', tobillo: 22, abierta: true }), sentadilla_zercher: () => sentadilla({ carga: 'zercher' }), sentadilla_hack: () => hack(),
  prensa: () => prensa(), prensa_horizontal: () => prensa({ angulo: 0 }), prensa_unilateral: () => prensa(),
  bulgara_mancuernas: () => estocada({ trasero: 'banco', carga: 'mancuernas' }), bulgara: () => estocada({ trasero: 'banco' }), bulgara_smith: () => estocada({ trasero: 'banco', carga: 'barra', smith: true }),
  step_up: () => stepUp(), step_up_mancuernas: () => stepUp({ carga: 'mancuernas' }),
  zancada_cruzada: () => estocada({ carga: 'mancuernas' }), zancadas_caminando: () => estocada({ carga: 'mancuernas' }), zancadas_corporal: () => estocada(),
  extension_cuadriceps: () => extensionCuadriceps(),
  peso_muerto_rumano_barra: () => rumano(), peso_muerto_rumano_smith: () => rumano({ smith: true }), peso_muerto_rumano_mancuernas: () => rumano({ carga: 'mancuernas' }),
  peso_muerto_barra: () => pesoMuerto(), peso_muerto_smith: () => pesoMuerto({ smith: true }), buenos_dias: () => buenosDias(), swing_kettlebell: () => swing(),
  hip_thrust_barra: () => hipThrust(), hip_thrust_maquina: () => hipThrust({ carga: 'maquina' }), hip_thrust_smith: () => hipThrust({ smith: true }),
  puente_gluteo: () => hipThrust({ suelo: true, carga: 'ninguna' }), hiperextension_gluteo: () => hiperextension(),
  patada_gluteo_maquina: () => patadaGluteo({ tipo: 'maquina' }), patada_gluteo_polea: () => patadaGluteo(), patada_gluteo_suelo: () => patadaGluteo({ tipo: 'suelo' }),
  extension_lumbar_maquina: () => extensionLumbar(),
  curl_femoral_acostado: () => curlFemoral(), curl_femoral_sentado: () => curlFemoral({ tipo: 'sentado' }), curl_femoral_de_pie: () => curlFemoral({ tipo: 'pie' }),
  pantorrilla_maquina: () => pantorrilla({ maquina: true }), pantorrilla_prensa: () => prensa({ pantorrilla: true }), pantorrilla_de_pie: () => pantorrilla(),
  press_banca_barra: () => pressBanco(), press_banca_mancuernas: () => pressBanco({ carga: 'mancuernas' }),
  press_inclinado_barra: () => pressBanco({ inclinacion: 32 }), press_inclinado_mancuernas: () => pressBanco({ carga: 'mancuernas', inclinacion: 32 }),
  press_pecho_maquina: () => pressMaquina(), press_pecho_inclinado_maquina: () => pressMaquina({ inclinado: true }), press_pecho_isolateral: () => pressMaquina(),
  flexiones: () => flexion(), flexiones_inclinadas: () => flexion({ manos: 0.45 }),
  fondos: () => fondos(), fondos_asistidos: () => fondos({ asistido: true }), fondos_lastre: () => fondos({ lastre: true }), fondos_triceps: () => fondos({ inclinacion: 4 }),
  fondos_banco: () => fondoBanco(),
  triceps_polea: () => triceps(), triceps_polea_unilateral: () => triceps(), triceps_cuerda: () => triceps(),
  triceps_sobre_cabeza: () => triceps({ tipo: 'sobreCabeza' }), triceps_sobre_cabeza_unilateral: () => triceps({ tipo: 'sobreCabeza' }),
  triceps_mancuerna: () => triceps({ tipo: 'sobreCabeza', carga: 'mancuerna' }), triceps_mancuerna_unilateral: () => triceps({ tipo: 'sobreCabeza', carga: 'mancuerna' }),
  triceps_maquina: () => triceps({ tipo: 'maquina' }), rompecraneos: () => triceps({ tipo: 'rompecraneos' }),
  cruce_poleas: () => cruce(), cruce_poleas_bajo: () => cruce({ bajo: true }),
  press_militar_barra: () => pressVertical(), press_militar_sentado_barra: () => pressVertical({ sentado: true }),
  press_hombro_smith: () => pressVertical({ sentado: true, smith: true }), press_hombro_sentado_smith: () => pressVertical({ sentado: true, smith: true }), press_hombro_de_pie_smith: () => pressVertical({ smith: true }),
  press_hombro_mancuernas: () => pressVertical({ sentado: true, carga: 'mancuernas' }), press_hombro_sentado_mancuernas: () => pressVertical({ sentado: true, carga: 'mancuernas' }),
  press_hombro_de_pie_mancuernas: () => pressVertical({ carga: 'mancuernas' }), press_hombro_maquina: () => pressVertical({ sentado: true, carga: 'maquina' }), press_arnold: () => pressVertical({ sentado: true, carga: 'mancuernas' }),
  elevaciones_frontales: () => elevacionFrontal(), face_pull: () => facePull(),
  jalon_polea: () => jalon(), jalon_maquina: () => jalon(), jalon_agarre_cerrado: () => jalon(), jalon_un_brazo: () => jalon(),
  dominadas: () => dominada(), dominadas_asistidas: () => dominada({ asistida: true }), dominadas_banda: () => dominada({ banda: true }), dominadas_lastre: () => dominada({ lastre: true }),
  dominadas_supinas: () => dominada(), dominadas_supinas_lastre: () => dominada({ lastre: true }), dominadas_supinas_asistidas: () => dominada({ asistida: true }), dominadas_escapulares: () => dominada({ escapular: true }),
  remo_maquina: () => remoSentado({ maquina: true }), remo_maquina_cable: () => remoSentado({ maquina: true }), remo_polea: () => remoSentado(), remo_polea_un_brazo: () => remoSentado(),
  remo_isolateral: () => remoSentado({ maquina: true }), remo_isolateral_discos: () => remoSentado({ maquina: true }), remo_isolateral_bajo: () => remoSentado({ maquina: true, bajo: true }),
  remo_barra: () => remoInclinado(), remo_pendlay: () => remoInclinado({ tronco: 78, rodillas: 22 }), remo_smith: () => remoInclinado({ smith: true }), remo_banda: () => remoSentado({ banda: true }),
  remo_mancuerna: () => remoUnBrazo(), remo_landmine: () => remoInclinado({ tronco: 45 }), remo_invertido: () => remoInvertido(), remo_suspension: () => remoInvertido({ suspension: true }),
  encogimientos: () => encogimiento(),
  curl_mancuernas: () => curl({ carga: 'mancuernas' }), curl_barra: () => curl(), curl_barra_ez: () => curl(), curl_polea: () => curl({ carga: 'polea' }), curl_maquina: () => curl({ tipo: 'predicador', carga: 'maquina' }),
  curl_martillo: () => curl({ carga: 'mancuernas' }), curl_predicador_barra: () => curl({ tipo: 'predicador' }), curl_predicador_ez: () => curl({ tipo: 'predicador' }),
  curl_predicador_mancuerna: () => curl({ tipo: 'predicador', carga: 'mancuernas' }), curl_predicador_maquina: () => curl({ tipo: 'predicador', carga: 'maquina' }), curl_predicador_maquina_unilateral: () => curl({ tipo: 'predicador', carga: 'maquina' }),
  curl_inclinado: () => curl({ tipo: 'inclinado', carga: 'mancuernas' }), curl_tras_espalda: () => curl({ tipo: 'tras', carga: 'polea' }),
  curl_muneca: () => muneca(), extension_muneca_barra: () => muneca({ extension: true }),
  caminata_granjero: () => marcha({ granjero: true }), colgarse: () => colgado(),
  crunch: () => abdominal(), crunch_maquina: () => abdominal({ tipo: 'maquina' }), crunch_lastre: () => abdominal({ lastre: true }), crunch_declinado: () => abdominal({ tipo: 'declinado' }),
  crunch_polea: () => abdominal({ tipo: 'polea' }), crunch_bicicleta: () => abdominal({ tipo: 'bicicleta' }), crunch_inverso: () => abdominal({ tipo: 'inverso' }), abdominal_completo: () => abdominal({ tipo: 'completo' }),
  navaja: () => abdominal({ tipo: 'navaja' }), v_up: () => abdominal({ tipo: 'navaja' }), codo_rodilla: () => abdominal({ tipo: 'bicicleta' }), tocar_pies: () => abdominal({ tipo: 'tocarPies' }), hollow_rock: () => abdominal({ tipo: 'hollow' }),
  dragon_flag: () => dragonFlag(), elevacion_rodillas_colgado: () => elevacionRodillas(), elevacion_rodillas_paralelas: () => elevacionRodillas({ paralelas: true }),
  elevacion_piernas_paralelas: () => elevacionRodillas({ paralelas: true, piernasRectas: true }), elevacion_rodillas_suelo: () => elevacionPiernasSuelo({ rodillas: true }), elevacion_piernas_suelo: () => elevacionPiernasSuelo(),
  plancha: () => plancha(), plancha_rodillas: () => plancha({ rodillas: true }), dead_bug: () => bichoMuerto(), rueda_abdominal: () => ruedaAbdominal(), bird_dog: () => birdDog(),
  marcha: () => marcha({ rodillas: true }), puente_marcha: () => hipThrust({ suelo: true, carga: 'ninguna', marcha: true }), pallof: () => pallof(),
  escaladora: () => marcha({ escalera: true }), trotadora: () => marcha({ cinta: true }), caminata: () => marcha(), caminata_inclinada: () => marcha({ cinta: true, inclinacion: 8 }), trote: () => marcha({ correr: true }),
  respiracion_90_90: () => respiracion9090(),
  ...FRENTE,
};

/** Ejercicios del catálogo que todavía no tienen animación (quedan con su ilustración). Hoy, ninguno. */
export const PENDIENTES = {};

const cache = new Map();
/** La animación de un ejercicio del catálogo, o null si todavía no tiene (PENDIENTES). */
export function animacionDe(id) {
  if (!MAPA[id]) return null;
  if (!cache.has(id)) cache.set(id, MAPA[id]());
  return cache.get(id);
}
export const idsConAnimacion = () => Object.keys(MAPA);

// Pasos de calentamiento y estiramientos, por su nombre (vienen del plan, del tablero o del calentamiento de la sesión).
const PASOS = [
  [/c[ií]rculos de hombro/i, () => CALENTAMIENTOS.circulosHombro()], [/deslizamiento en pared/i, () => CALENTAMIENTOS.deslizamientoPared()],
  [/om[oó]platos|serrato/i, () => CALENTAMIENTOS.serrato()], [/face pull/i, () => CALENTAMIENTOS.facePull()], [/c[ií]rculos de cadera/i, () => CALENTAMIENTOS.circulosCadera()],
  [/tobillo/i, () => CALENTAMIENTOS.tobillo()], [/bisagra/i, () => CALENTAMIENTOS.bisagra()], [/flexi[oó]n y extensi[oó]n de codo/i, () => CALENTAMIENTOS.flexionCodo()],
  [/activaci[oó]n de dorsal/i, () => CALENTAMIENTOS.dorsal()], [/paso de banda/i, () => CALENTAMIENTOS.pasoBanda()], [/terminal de rodilla/i, () => CALENTAMIENTOS.rodillaBanda()],
  [/movilidad de cuello/i, () => CALENTAMIENTOS.cuello()], [/marcha|bicicleta o caminata|caminata suave/i, () => CALENTAMIENTOS.marcha()], [/puente de gl[uú]teo/i, () => CALENTAMIENTOS.puente()],
  [/colgarse|colgado/i, () => colgado()],
  [/pectoral/i, () => ESTIRAMIENTOS.pectoral()], [/flexor de cadera/i, () => ESTIRAMIENTOS.flexorCadera()], [/gl[uú]teo.*figura|figura.?4/i, () => ESTIRAMIENTOS.gluteo()],
  [/isquiotibiales/i, () => ESTIRAMIENTOS.isquiotibiales()], [/aductor|mariposa/i, () => ESTIRAMIENTOS.aductor()], [/cu[aá]driceps/i, () => ESTIRAMIENTOS.cuadriceps()],
  [/pantorrilla/i, () => ESTIRAMIENTOS.pantorrilla()], [/b[ií]ceps y antebrazo/i, () => ESTIRAMIENTOS.biceps()], [/tr[ií]ceps sobre la cabeza/i, () => ESTIRAMIENTOS.triceps()],
  // Vistos de frente: giran o van hacia el costado.
  [/tor[aá]cica/i, () => PASOS_FRENTE.toracica()], [/90\s*\/\s*90 de cadera/i, () => PASOS_FRENTE.cadera9090()], [/rotaci[oó]n externa/i, () => PASOS_FRENTE.rotacionExterna()],
  [/cuello y trapecio/i, () => PASOS_FRENTE.cuelloTrapecio()], [/mu[ñn]eca/i, () => CALENTAMIENTOS.muneca()],
];
const cachePasos = new Map();
/** La animación de un paso de calentamiento o estiramiento, por su nombre; null si no tiene. Los ensayos y las aproximaciones usan la del ejercicio. */
export function animacionDePaso(paso) {
  const nombre = typeof paso === 'string' ? paso : paso?.name || '';
  const ej = typeof paso === 'object' && (paso.agregar_id || String(paso.clave || '').replace(/^(ensayo|aprox):/, ''));
  if (ej && MAPA[ej]) return animacionDe(ej);
  if (!nombre) return null;
  const [, crear] = PASOS.find(([re]) => re.test(nombre)) || [];
  if (!crear) return null;
  const clave = PASOS.findIndex(([re]) => re.test(nombre));
  if (!cachePasos.has(clave)) cachePasos.set(clave, crear());
  return cachePasos.get(clave);
}

/** El cuadro que ocupa una animación en todas sus fases (metros), para encuadrarla sin cortar el cuerpo ni el equipo. */
export function encuadre(anim, m) {
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  const ver = (q, r = 0) => { if (!q || !Number.isFinite(q.x)) return; x1 = Math.min(x1, q.x - r); x2 = Math.max(x2, q.x + r); y1 = Math.min(y1, q.y - r); y2 = Math.max(y2, q.y + r); };
  if (anim.vista === 'frente') {
    for (let k = 0; k <= 8; k++) {
      const p = proyectarPose(anim.pose(k / 8, m, anim.fases[0], 0), anim.camara);
      [...p.hombros, ...p.caderas, ...p.brazos.flatMap(b => [b.codo, b.mano]), ...p.piernas.flatMap(pi => [pi.rodilla, pi.tobillo, pi.talon, pi.punta])].forEach(q => ver(q, 0.08));
      ver(p.cabeza, m.cabeza + 0.05);
      for (const e of p.equipo || []) if (e.encuadra !== false) [e.centro, e.a, e.b, ...(e.puntos || [])].forEach(q => ver(q, e.centro ? e.r || 0.08 : 0.02));
    }
    if (anim.suelo !== false) y1 = Math.min(y1, 0);
    const lado = Math.max(x2 - x1, y2 - y1) + 0.3, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    return anim.suelo !== false ? { x: cx - lado / 2, y: y1 - 0.08, lado } : { x: cx - lado / 2, y: cy - lado / 2, lado };
  }
  for (const s of [0, 0.25, 0.5, 0.75, 1]) {
    const p = anim.pose(s, m, anim.fases[0], 0);
    for (const k of ['talon', 'punta', 'tobillo', 'rodilla', 'cadera', 'hombro', 'codo', 'mano']) { ver(p[k], 0.08); ver(p.lejos?.[k], 0.08); }
    ver(p.cabeza, m.cabeza + 0.04);
    for (const e of p.equipo || []) { if (e.centro) ver(e.centro, e.r || 0.1); if (e.a) ver(e.a); if (e.b) ver(e.b); }
  }
  y1 = Math.min(y1, 0);
  const lado = Math.max(x2 - x1, y2 - y1) + 0.3, cx = (x1 + x2) / 2;
  return { x: cx - lado / 2, y: y1 - 0.08, lado };
}
