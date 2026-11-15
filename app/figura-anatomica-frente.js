// Figura anatómica plana vista de frente (o de espalda, o desde arriba si está acostada): el mismo estilo de la de lado
// (app/figura-anatomica.js), gris y con los músculos a la vista, para los ejercicios que giran o van hacia el costado
// (nucleo/animaciones-frente.js). Dibuja las poses ya proyectadas: cada parte se ordena por su profundidad, así lo que
// está más cerca de la cámara tapa lo de atrás. De frente se ven los músculos de adelante (pecho, abdominales,
// cuádriceps, bíceps); de espalda, los de atrás (trapecio, dorsal, lumbares, glúteo, femoral, tríceps, pantorrilla).
// El rojo marca los músculos del catálogo, nunca una medición de activación (docs/41-personaje-3d.md).
import { VARIANTES, PERFILES, curva, contornoMiembro, equipoSvg } from './figura.js';

const NS = 'http://www.w3.org/2000/svg';
const crear = (padre, nombre, attrs = {}) => { const el = document.createElementNS(NS, nombre); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); padre.append(el); return el; };

// Silueta del cuerpo de frente: [altura en fracción del tronco (0 en las caderas, 1 en los hombros), medio ancho en
// metros]. Abajo cubre la pelvis y el comienzo de los muslos; arriba llega a la base del cuello.
const TRONCO = {
  hombre: [[-0.13, 0], [-0.2, 0.05], [-0.2, 0.13], [-0.1, 0.165], [0.04, 0.168], [0.2, 0.15], [0.38, 0.148], [0.55, 0.162], [0.72, 0.178], [0.86, 0.188], [0.95, 0.186], [1.0, 0.168], [1.04, 0.12], [1.07, 0.065], [1.085, 0.03]],
  mujer: [[-0.13, 0], [-0.2, 0.05], [-0.2, 0.135], [-0.1, 0.176], [0.04, 0.174], [0.2, 0.142], [0.36, 0.126], [0.52, 0.136], [0.68, 0.152], [0.82, 0.16], [0.93, 0.164], [1.0, 0.148], [1.04, 0.108], [1.07, 0.058], [1.085, 0.028]],
};
// Músculos del tronco, de un lado (se reflejan al otro): [u como en TRONCO, distancia al centro en metros]. La silueta
// los recorta, así que pueden pasarse del borde.
const TRONCO_FRENTE = [
  { grupo: 'pecho', puntos: [[0.66, 0.012], [0.9, 0.012], [0.97, 0.06], [0.97, 0.15], [0.88, 0.2], [0.75, 0.17], [0.66, 0.09]] },
  { grupo: 'core', puntos: [[0.15, 0.008], [0.63, 0.008], [0.64, 0.06], [0.4, 0.064], [0.15, 0.05]] }, // recto abdominal
  { grupo: 'core', puntos: [[0.2, 0.078], [0.58, 0.084], [0.66, 0.16], [0.5, 0.2], [0.3, 0.2], [0.16, 0.16]] }, // oblicuos
  { grupo: 'trapecio', puntos: [[0.98, 0.045], [1.07, 0.04], [1.04, 0.12], [1.0, 0.2], [0.96, 0.15]] },
  { grupo: 'aductor_abductor', zona: 'abductor', puntos: [[-0.06, 0.135], [0.12, 0.145], [0.16, 0.2], [-0.06, 0.2]] }, // glúteo medio y tensor, al costado
];
const TRONCO_ESPALDA = [
  { grupo: 'trapecio', puntos: [[0.62, 0.004], [0.86, 0.004], [1.08, 0.035], [1.04, 0.13], [0.99, 0.2], [0.88, 0.15], [0.72, 0.06]] },
  { grupo: 'espalda', puntos: [[0.36, 0.03], [0.6, 0.065], [0.74, 0.13], [0.9, 0.2], [0.78, 0.22], [0.55, 0.2], [0.36, 0.13]] },
  { grupo: 'erectores', puntos: [[0.04, 0.012], [0.52, 0.012], [0.54, 0.054], [0.3, 0.06], [0.04, 0.06]] },
  { grupo: 'gluteo', puntos: [[-0.24, 0.006], [0.07, 0.008], [0.1, 0.08], [0.04, 0.17], [-0.12, 0.18], [-0.25, 0.13], [-0.27, 0.04]] },
  { grupo: 'aductor_abductor', zona: 'abductor', puntos: [[0.06, 0.07], [0.17, 0.09], [0.17, 0.2], [0.04, 0.2], [0.0, 0.16]] }, // glúteo medio
];
// Músculos de cada miembro: [t a lo largo del hueso (0 a 1), v hacia afuera del cuerpo en metros].
const MIEMBROS_FRENTE = {
  muslo: [
    { grupo: 'cuadriceps', puntos: [[0.06, -0.04], [0.04, 0.08], [0.4, 0.09], [0.9, 0.055], [0.99, 0.0], [0.92, -0.045], [0.55, -0.05], [0.25, -0.035]] },
    { grupo: 'aductor_abductor', zona: 'aductor', puntos: [[0.0, -0.046], [0.25, -0.042], [0.52, -0.058], [0.46, -0.11], [0.0, -0.11]] },
    { grupo: 'aductor_abductor', zona: 'abductor', puntos: [[-0.02, 0.06], [0.3, 0.07], [0.34, 0.12], [-0.02, 0.12]] }, // tensor de la fascia lata, arriba y afuera
  ],
  pierna: [
    { grupo: 'tibial', puntos: [[0.08, 0.006], [0.72, 0.008], [0.76, 0.06], [0.08, 0.06]] },
    { grupo: 'pantorrilla', puntos: [[0.06, -0.022], [0.3, -0.026], [0.56, -0.016], [0.52, -0.08], [0.08, -0.08]] },
  ],
  brazo: [
    { grupo: 'hombro', puntos: [[-0.25, -0.09], [-0.25, 0.1], [0.15, 0.1], [0.38, 0.02], [0.3, -0.07]] },
    { grupo: 'biceps', puntos: [[0.34, -0.026], [0.38, 0.028], [0.88, 0.024], [0.93, -0.018], [0.6, -0.032]] },
    { grupo: 'triceps', puntos: [[0.36, -0.036], [0.86, -0.03], [0.86, -0.09], [0.36, -0.09]] },
  ],
  antebrazo: [{ grupo: 'antebrazo', puntos: [[0.04, -0.06], [0.04, 0.06], [0.72, 0.05], [0.72, -0.05]] }],
};
const MIEMBROS_ESPALDA = {
  muslo: [
    { grupo: 'femoral', puntos: [[0.14, -0.036], [0.12, 0.06], [0.5, 0.08], [0.95, 0.036], [0.96, -0.03], [0.5, -0.052]] },
    { grupo: 'aductor_abductor', zona: 'aductor', puntos: [[0.02, -0.05], [0.36, -0.05], [0.3, -0.11], [0.02, -0.11]] },
    { grupo: 'aductor_abductor', zona: 'abductor', puntos: [[-0.02, 0.065], [0.22, 0.075], [0.24, 0.12], [-0.02, 0.12]] },
  ],
  pierna: [{ grupo: 'pantorrilla', puntos: [[0.04, -0.07], [0.04, 0.07], [0.3, 0.075], [0.62, 0.03], [0.64, -0.03], [0.3, -0.075]] }],
  brazo: [
    { grupo: 'hombro', puntos: [[-0.25, -0.09], [-0.25, 0.1], [0.15, 0.1], [0.38, 0.02], [0.3, -0.07]] },
    { grupo: 'triceps', puntos: [[0.3, -0.036], [0.3, 0.036], [0.93, 0.026], [0.96, -0.026]] },
  ],
  antebrazo: [{ grupo: 'antebrazo', puntos: [[0.04, -0.06], [0.04, 0.06], [0.72, 0.05], [0.72, -0.05]] }],
};
/** Los músculos del catálogo que esta figura sabe pintar (una prueba del núcleo revisa que no falte ninguno). */
export const GRUPOS_QUE_PINTA = [...new Set([...TRONCO_FRENTE, ...TRONCO_ESPALDA, ...Object.values(MIEMBROS_FRENTE).flat(), ...Object.values(MIEMBROS_ESPALDA).flat()].map(mu => mu.grupo))];

// Cabeza de frente, en radios de la cabeza: [hacia el lado, hacia arriba]. Sin rasgos, como la de lado.
const CABEZA = [[0, 1.02], [0.5, 0.92], [0.8, 0.6], [0.86, 0.15], [0.8, -0.3], [0.62, -0.7], [0.32, -0.95], [0, -1.0], [-0.32, -0.95], [-0.62, -0.7], [-0.8, -0.3], [-0.86, 0.15], [-0.8, 0.6], [-0.5, 0.92]];
const PELO = {
  hombre: { frente: [[-0.88, 0.3], [-0.93, 0.64], [-0.68, 0.99], [-0.25, 1.12], [0.25, 1.12], [0.68, 0.99], [0.93, 0.64], [0.88, 0.3], [0.78, 0.52], [0.45, 0.66], [0, 0.62], [-0.45, 0.66], [-0.78, 0.52]], cola: null },
  mujer: {
    frente: [[-0.92, 0.2], [-0.95, 0.66], [-0.66, 1.02], [-0.2, 1.15], [0.3, 1.14], [0.72, 0.98], [0.95, 0.64], [0.92, 0.22], [0.82, 0.5], [0.55, 0.7], [0.2, 0.74], [-0.3, 0.62], [-0.7, 0.48]],
    cola: [[-0.2, 0.55], [0.2, 0.55], [0.26, -0.1], [0.18, -0.9], [0, -1.35], [-0.18, -0.9], [-0.26, -0.1]],
  },
};
// Pie descalzo: de frente se ve corto (apunta a la cámara); desde arriba, a lo largo.
const PIE_ARRIBA = [[0, 0.036, 0.036], [0.55, 0.046, 0.046], [1, 0.034, 0.034]];

const resta = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const unit2 = v => { const L = Math.hypot(v.x, v.y) || 1e-9; return { x: v.x / L, y: v.y / L }; };
const mezcla = (a, b, s) => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s });
/** Sistema de un miembro de a a b: t a lo largo y v hacia "lado" (la normal del contorno con ese signo). */
function marco(a, b, signo) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1e-9, nx = (-dy / L) * signo, ny = (dx / L) * signo;
  return (t, v) => ({ x: a.x + dx * t + nx * v, y: a.y + dy * t + ny * v });
}
let figuras = 0; // cada figura necesita recortes con nombre propio dentro de la página

/**
 * Crea la figura anatómica de frente dentro de un grupo SVG. escala: píxeles por metro (el suelo queda en y = 0).
 * musculos: { primarios, secundarios, cadera } con los nombres del catálogo (cadera: 'aductor' o 'abductor', ver
 * zonaCadera en nucleo/animaciones.js). sombra: false para los movimientos sin suelo.
 */
export function crearFiguraAnatomicaFrente(grupo, { escala = 100, variante = 'hombre', musculos = {}, id = `af${++figuras}`, sombra: conSombra = true } = {}) {
  const V = VARIANTES[variante] || VARIANTES.hombre, tipo = variante === 'mujer' ? 'mujer' : 'hombre';
  const primarios = musculos.primarios || [], secundarios = musculos.secundarios || [];
  // El catálogo junta aductores y abductores; "cadera" dice cuál pintar: 'abductor' (abductora, plancha lateral),
  // 'aductor' (aductora, sentadillas) o, si falta, los dos.
  const tono = (g, zona) => (zona && musculos.cadera && zona !== musculos.cadera ? 'reposo' : primarios.includes(g) ? 'principal' : secundarios.includes(g) ? 'secundario' : 'reposo');
  const perfil = { muslo: PERFILES.muslo, pierna: PERFILES.pierna, brazo: PERFILES.brazo.map(([t, a, b]) => [t, a * V.brazos, b * V.brazos]), antebrazo: PERFILES.antebrazo.map(([t, a, b]) => [t, a * V.brazos, b * V.brazos]) };
  const px = q => ({ x: q.x * escala, y: -q.y * escala });
  const d = puntos => curva(puntos.map(px));
  let n = 0;
  const sombra = crear(grupo, 'ellipse', { class: 'an-sombra' });
  const grupoNuevo = () => crear(grupo, 'g');

  /** Una parte con silueta gris y, recortados por ella, sus músculos (los de adelante o los de atrás, según la vista). */
  function parte(g, clase, frente, espalda) {
    const clip = `${id}-${n++}`;
    const silueta = crear(g, 'path', { class: `an-cuerpo cerca ${clase === 'tronco' ? '' : 'borde '}${clase}` });
    const recorte = crear(crear(g, 'clipPath', { id: clip }), 'path');
    const gm = crear(g, 'g', { 'clip-path': `url(#${clip})` });
    const hacer = lista => lista.map(mu => ({ mu, el: crear(gm, 'path', { class: `an-musculo ${tono(mu.grupo, mu.zona)} cerca` }) }));
    const vistas = { frente: hacer(frente), espalda: hacer(espalda) };
    return {
      poner(contorno, w, deEspalda) {
        const dd = contorno ? d(contorno) : '';
        silueta.setAttribute('d', dd); recorte.setAttribute('d', dd);
        for (const [vista, lista] of Object.entries(vistas)) {
          const ver = contorno && (vista === 'espalda') === deEspalda;
          for (const { mu, el } of lista) el.setAttribute('d', ver ? d(mu.puntos.map(([a, b]) => w(a, b))) : '');
        }
      },
    };
  }
  /** Los músculos del tronco van de los dos lados: se duplican reflejados. */
  const dosLados = lista => lista.flatMap(mu => [mu, { ...mu, puntos: mu.puntos.map(([u, w]) => [u, -w]) }]);
  const suelta = (g, clase) => crear(g, 'path', { class: clase });

  const piernas = [0, 1].map(() => {
    const g = grupoNuevo();
    return { g, pierna: parte(g, 'pierna', MIEMBROS_FRENTE.pierna, MIEMBROS_ESPALDA.pierna), muslo: parte(g, 'muslo', MIEMBROS_FRENTE.muslo, MIEMBROS_ESPALDA.muslo), pie: suelta(g, 'an-cuerpo cerca borde pie') };
  });
  const gTronco = grupoNuevo();
  const cuello = suelta(gTronco, 'an-cuerpo cerca cuello');
  const tronco = parte(gTronco, 'tronco', dosLados(TRONCO_FRENTE), dosLados(TRONCO_ESPALDA));
  const gCabeza = grupoNuevo();
  const cola = suelta(gCabeza, 'an-pelo'), cabeza = suelta(gCabeza, 'an-cuerpo cerca borde cabeza'), pelo = suelta(gCabeza, 'an-pelo');
  const brazos = [0, 1].map(() => {
    const g = grupoNuevo();
    return { g, brazo: parte(g, 'brazo', MIEMBROS_FRENTE.brazo, MIEMBROS_ESPALDA.brazo), antebrazo: parte(g, 'antebrazo', MIEMBROS_FRENTE.antebrazo, MIEMBROS_ESPALDA.antebrazo), mano: suelta(g, 'an-cuerpo cerca borde mano') };
  });
  const equipos = [];
  const ovalo = (q, rx, ry) => Array.from({ length: 8 }, (_, i) => ({ x: q.x + rx * Math.cos(i * Math.PI / 4), y: q.y + ry * Math.sin(i * Math.PI / 4) }));

  /** Pie: de frente (apunta a la cámara) se ve corto, bajo el tobillo; si se ve entero (desde arriba), a lo largo. */
  function formaPie(pi, signo) {
    const talon = pi.talon, punta = pi.punta;
    if (Math.hypot(punta.x - talon.x, punta.y - talon.y) > 0.13) return contornoMiembro(talon, punta, PIE_ARRIBA, signo);
    const baja = unit2(resta(pi.tobillo, pi.rodilla)), lado = { x: -baja.y * signo, y: baja.x * signo };
    const apoyo = { x: pi.tobillo.x + baja.x * 0.06, y: pi.tobillo.y + baja.y * 0.06 };
    const w = ([a, b]) => ({ x: apoyo.x - baja.x * a + lado.x * b, y: apoyo.y - baja.y * a + lado.y * b });
    return [[0, -0.044], [0.04, -0.05], [0.07, -0.036], [0.08, 0], [0.07, 0.04], [0.04, 0.054], [0, 0.05], [-0.01, 0]].map(w);
  }

  /** Sombra en el suelo bajo lo que apoya; sin suelo (vistas desde arriba) o sin apoyo, no hay sombra. */
  function ponerSombra(p) {
    const puntos = [...p.piernas.flatMap(pi => [pi.talon, pi.punta, pi.rodilla]), ...p.brazos.map(b => b.mano), p.pelvis].filter(q => q && Number.isFinite(q.x));
    let x1 = Infinity, x2 = -Infinity, fuerza = 0;
    for (const q of puntos) { const c = Math.min(1, Math.max(0, (0.18 - q.y) / 0.12)); if (c > 0) { x1 = Math.min(x1, q.x - 0.06); x2 = Math.max(x2, q.x + 0.06); fuerza = Math.max(fuerza, c); } }
    if (!conSombra || !fuerza) { sombra.setAttribute('rx', '0'); return; }
    const c = px({ x: (x1 + x2) / 2, y: 0 });
    sombra.setAttribute('cx', c.x.toFixed(1)); sombra.setAttribute('cy', (c.y + 1.5).toFixed(1));
    sombra.setAttribute('rx', (((x2 - x1) / 2 + 0.05) * escala).toFixed(1)); sombra.setAttribute('ry', (0.03 * escala).toFixed(1));
    sombra.setAttribute('opacity', fuerza.toFixed(2));
  }

  function dibujar(p) {
    const R = p.radioCabeza || 0.108, espalda = Boolean(p.espalda);
    const P = p.pelvis, C = p.centroHombros, Lp = p.Lp, Ls = p.L;
    // Tronco: el centro va de la pelvis a los hombros; el ancho gira de la cadera al pecho.
    const enTronco = (u, w) => {
      const t = Math.min(1, Math.max(0, (u - 0.25) / 0.5)), lat = mezcla(Lp, Ls, t), c = mezcla(P, C, u);
      return { x: c.x + lat.x * w, y: c.y + lat.y * w };
    };
    const perfilTronco = TRONCO[tipo];
    const silueta = [...perfilTronco.map(([u, w]) => enTronco(u, -w)), ...[...perfilTronco].reverse().map(([u, w]) => enTronco(u, w))]
      .filter((q, i, a) => i === 0 || Math.hypot(q.x - a[i - 1].x, q.y - a[i - 1].y) > 1e-4);
    tronco.poner(silueta, enTronco, espalda);
    cuello.setAttribute('d', d(contornoMiembro(p.cuello, p.cabeza, PERFILES.cuello)));
    ponerSombra(p);

    // Miembros: el lado más ancho de cada perfil va hacia afuera del cuerpo.
    p.piernas.forEach((pi, i) => {
      const c = piernas[i], signo = i ? 1 : -1;
      c.muslo.poner(contornoMiembro(pi.cadera, pi.rodilla, perfil.muslo, signo), marco(pi.cadera, pi.rodilla, signo), espalda);
      c.pierna.poner(contornoMiembro(pi.rodilla, pi.tobillo, perfil.pierna, -signo), marco(pi.rodilla, pi.tobillo, signo), espalda);
      c.pie.setAttribute('d', d(formaPie(pi, signo)));
    });
    p.brazos.forEach((b, i) => {
      const c = brazos[i], signo = i ? 1 : -1;
      c.brazo.poner(contornoMiembro(b.hombro, b.codo, perfil.brazo, signo), marco(b.hombro, b.codo, signo), espalda);
      c.antebrazo.poner(contornoMiembro(b.codo, b.mano, perfil.antebrazo, signo), marco(b.codo, b.mano, signo), espalda);
      c.mano.setAttribute('d', d(ovalo(b.puno || b.mano, 0.04, 0.038)));
    });

    // Cabeza sin rasgos: de frente, el pelo arriba; de espalda, el pelo la cubre (y la cola cae sobre la nuca).
    const arriba = unit2(resta(p.cabeza, p.cuello)), lat = { x: arriba.y, y: -arriba.x };
    const en = ([v, u]) => ({ x: p.cabeza.x + (lat.x * v + arriba.x * u) * R, y: p.cabeza.y + (lat.y * v + arriba.y * u) * R });
    const giro = ((p.cabezaGiro || 0) * Math.PI) / 180, corre = v => 0.86 * Math.sin(Math.asin(Math.max(-1, Math.min(1, v / 0.86))) + giro);
    const peloV = PELO[tipo];
    cabeza.setAttribute('d', d(CABEZA.map(en)));
    if (espalda) {
      // El pelo cubre la cabeza por detrás y la cola cae encima, sobre la nuca.
      pelo.setAttribute('d', d(CABEZA.map(([v, u]) => en([v * 1.03, u * 1.03 + 0.02]))));
      cola.setAttribute('d', peloV.cola ? d(peloV.cola.map(en)) : '');
      gCabeza.append(cola);
    } else {
      pelo.setAttribute('d', d(peloV.frente.map(([v, u]) => [corre(Math.max(-0.86, Math.min(0.86, v))) + (Math.abs(v) > 0.86 ? v - Math.sign(v) * 0.86 : 0), u]).map(en)));
      cola.setAttribute('d', '');
    }

    // Equipo: cada pieza en su grupo, con su profundidad.
    const lista = p.equipo || [];
    while (equipos.length < lista.length) equipos.push(grupoNuevo());
    equipos.forEach((g, i) => { g.innerHTML = lista[i] ? equipoSvg([lista[i]], px, escala) : ''; });

    // Orden: lo más lejano primero. Con la misma profundidad, piernas, tronco, cabeza y brazos (en ese orden).
    const z = (...qs) => qs.reduce((t, q) => t + q.z, 0) / qs.length;
    const partes = [
      ...p.piernas.map((pi, i) => [piernas[i].g, z(pi.cadera, pi.rodilla, pi.tobillo) - 0.03]),
      [gTronco, z(P, C)], [gCabeza, Math.max(p.cabeza.z, z(P, C)) + 0.02],
      ...p.brazos.map((b, i) => [brazos[i].g, z(b.hombro, b.codo, b.mano, b.mano) + 0.03]),
      ...equipos.map((g, i) => [g, lista[i] ? lista[i].profundidad ?? -1 : -9]),
    ];
    partes.sort((a, b) => a[1] - b[1]).forEach(([g]) => grupo.append(g));
  }
  return { dibujar };
}
