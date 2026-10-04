// Figura humana para animar ejercicios, vista de lado, con el estilo de las ilustraciones de Entreno: polera naranja,
// short oscuro, zapatillas y pelo castaño. Se arma una vez y se mueve con cualquier pose del motor
// (nucleo/animacion-ejercicios.js): la misma figura sirve para todos los ejercicios. Cada forma (cuádriceps,
// pantorrilla, pecho, espalda, cara) se define en el sistema de su hueso, así acompaña al cuerpo en cualquier postura.
// Los colores salen de variables CSS (--fig-piel, --fig-polera...) con un valor por defecto.

const NS = 'http://www.w3.org/2000/svg';
const COLOR = {
  piel: 'var(--fig-piel, #E8A37C)', pielLejos: 'var(--fig-piel-lejos, #C7845F)', pielSombra: 'var(--fig-piel-sombra, #D48D66)',
  polera: 'var(--fig-polera, #E2622B)', poleraLejos: 'var(--fig-polera-lejos, #B44C1F)',
  short: 'var(--fig-short, #3B3E47)', shortLejos: 'var(--fig-short-lejos, #2A2C33)',
  zapatilla: 'var(--fig-zapatilla, #2C2F36)', zapatillaLejos: 'var(--fig-zapatilla-lejos, #1F2126)', suela: 'var(--fig-suela, #E7E8EC)',
  pelo: 'var(--fig-pelo, #5A3823)', ojo: 'var(--fig-ojo, #2A1C14)', borde: 'var(--fig-borde, #FFFFFF)',
  barra: 'var(--fig-barra, #9AA0AC)', disco: 'var(--fig-disco, #30333B)', discoBorde: 'var(--fig-disco-borde, #4A4E58)',
};

// Perfiles de cada segmento: [t a lo largo del hueso (0 a 1), ancho hacia adelante, ancho hacia atrás], en metros.
// "Adelante" es la cara anterior: el cuádriceps en el muslo, la tibia en la pierna, el bíceps en el brazo.
export const PERFILES = {
  muslo: [[0, 0.078, 0.088], [0.22, 0.086, 0.082], [0.5, 0.08, 0.07], [0.78, 0.064, 0.056], [1, 0.05, 0.046]],
  pierna: [[0, 0.046, 0.05], [0.18, 0.042, 0.064], [0.36, 0.038, 0.058], [0.62, 0.032, 0.04], [0.88, 0.027, 0.029], [1, 0.03, 0.031]],
  brazo: [[0, 0.056, 0.052], [0.16, 0.053, 0.046], [0.48, 0.047, 0.044], [0.82, 0.039, 0.037], [1, 0.034, 0.033]],
  antebrazo: [[0, 0.036, 0.036], [0.22, 0.041, 0.037], [0.62, 0.031, 0.028], [1, 0.024, 0.022]],
  cuello: [[0, 0.052, 0.05], [1, 0.045, 0.046]],
};
// Silueta del tronco en su sistema: u sube desde la cadera hacia el hombro, v va hacia adelante (metros).
const TRONCO = [[-0.07, 0.03], [0, 0.085], [0.1, 0.1], [0.2, 0.104], [0.3, 0.124], [0.38, 0.138], [0.45, 0.12], [0.51, 0.06],
  [0.535, 0], [0.52, -0.05], [0.47, -0.088], [0.36, -0.104], [0.24, -0.094], [0.14, -0.078], [0.06, -0.1], [-0.03, -0.126], [-0.09, -0.07]];
const SHORT_PELVIS = [[-0.075, 0.035], [0, 0.09], [0.095, 0.104], [0.098, 0.04], [0.098, -0.03], [0.095, -0.088], [0.06, -0.104], [-0.03, -0.128], [-0.095, -0.07]];
// Cabeza de perfil, en radios de la cabeza: u hacia arriba, v hacia adelante.
const CARA = [[0.62, 0.78], [0.25, 0.93], [0.1, 0.97], [-0.05, 0.92], [-0.17, 1.07], [-0.29, 0.95], [-0.41, 0.96], [-0.54, 0.91], [-0.72, 0.85],
  [-0.86, 0.64], [-0.8, 0.33], [-0.7, 0.05], [-0.62, -0.45], [-0.35, -0.88], [0.15, -0.98], [0.62, -0.75], [0.95, -0.25], [1, 0.25]];
const PELO = [[0.6, 0.8], [0.92, 0.52], [1.07, 0.02], [0.92, -0.56], [0.48, -0.99], [-0.12, -1.03], [-0.46, -0.84], [-0.3, -0.62], [0.06, -0.58],
  [0.34, -0.3], [0.5, 0.22], [0.55, 0.62]];

// Variante de mujer: hombros y brazos más finos, cintura más marcada, busto, glúteos y cola de caballo; el short es
// más largo. Se elige con el sexo del perfil (si se eligió mujer, la figura es de mujer).
const TRONCO_MUJER = [[-0.07, 0.03], [0, 0.084], [0.1, 0.084], [0.19, 0.078], [0.27, 0.098], [0.33, 0.148], [0.38, 0.152], [0.43, 0.118],
  [0.5, 0.054], [0.53, 0], [0.515, -0.045], [0.46, -0.08], [0.36, -0.09], [0.24, -0.078], [0.14, -0.07], [0.06, -0.106], [-0.03, -0.142], [-0.1, -0.076]];
const SHORT_PELVIS_MUJER = [[-0.075, 0.035], [0, 0.088], [0.095, 0.088], [0.098, 0.04], [0.098, -0.03], [0.095, -0.08], [0.06, -0.11], [-0.03, -0.146], [-0.102, -0.08]];
const PELO_MUJER = [[0.6, 0.82], [0.94, 0.52], [1.09, 0.02], [0.94, -0.58], [0.5, -1.02], [-0.12, -1.06], [-0.48, -0.86], [-0.3, -0.62], [0.06, -0.58],
  [0.34, -0.3], [0.5, 0.24], [0.56, 0.64]];
const COLA = [[0.42, -0.86], [0.18, -1.06], [-0.18, -1.22], [-0.62, -1.3], [-1.02, -1.2], [-0.82, -1.06], [-0.4, -1.02], [0.02, -0.92]];
export const VARIANTES = {
  hombre: { estatura: 1.75, tronco: TRONCO, short: SHORT_PELVIS, pelo: PELO, cola: null, largoShort: 0.34, brazos: 1 },
  mujer: { estatura: 1.62, tronco: TRONCO_MUJER, short: SHORT_PELVIS_MUJER, pelo: PELO_MUJER, cola: COLA, largoShort: 0.5, brazos: 0.88 },
};
/** La variante que corresponde al perfil (respuestas del cuestionario). */
export const varianteDe = respuestas => (respuestas?.sexo === 'femenino' ? 'mujer' : 'hombre');
const escalar = (perfil, k) => perfil.map(([t, a, b]) => [t, a * k, b * k]);

const f = n => n.toFixed(1);
/** Curva cerrada suave que pasa por todos los puntos (Catmull-Rom convertida a Bézier). */
export function curva(puntos) {
  const n = puntos.length;
  let d = `M${f(puntos[0].x)} ${f(puntos[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = puntos[(i - 1 + n) % n], p1 = puntos[i], p2 = puntos[(i + 1) % n], p3 = puntos[(i + 2) % n];
    d += ` C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d + 'Z';
}

/** Un hueso de a a b (metros): pasa coordenadas del hueso (t a lo largo, v hacia su cara anterior) al mundo. */
function marco(a, b, signo = 1) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1e-9, ux = dx / L, uy = dy / L;
  const nx = -uy * signo, ny = ux * signo;
  return (t, v) => ({ x: a.x + dx * t + nx * v, y: a.y + dy * t + ny * v });
}

/** Contorno de un miembro según su perfil, con las puntas redondeadas para que las articulaciones se vean continuas. */
export function contornoMiembro(a, b, perfil, signo = 1, holgura = 0) {
  const w = marco(a, b, signo), L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
  const [t0, f0, a0] = perfil[0], [t1, f1, a1] = perfil.at(-1);
  const frente = perfil.map(([t, fr]) => w(t, fr + holgura)), atras = [...perfil].reverse().map(([t, , at]) => w(t, -(at + holgura)));
  return [w(t0 - (f0 + a0) / 2 / L * 0.9, 0), ...frente, w(t1 + (f1 + a1) / 2 / L * 0.9, 0), ...atras];
}

/** Una prenda que cubre el comienzo de un miembro (short, manga), con el borde recto en "largo" (0 a 1 del hueso). */
export function contornoPrenda(a, b, largo, frente, atras, signo = 1) {
  const w = marco(a, b, signo);
  return [w(-0.07, 0), w(0, frente), w(largo * 0.45, frente + 0.004), w(largo, frente * 0.97), w(largo, frente * 0.3), w(largo, -atras * 0.3),
    w(largo, -atras * 0.97), w(largo * 0.45, -(atras + 0.004)), w(0, -atras)];
}

// Equipo (metros): se dibuja en tres capas: detrás del cuerpo, entre el tronco y el brazo de este lado, y delante.
const COLOR_EQUIPO = {
  metal: 'var(--fig-metal, #9AA0AC)', oscuro: 'var(--fig-equipo, #3A3E47)', borde: 'var(--fig-equipo-borde, #555A65)',
  tapiz: 'var(--fig-tapiz, #4B505B)', estructura: 'var(--fig-estructura, #B9BEC8)', banda: 'var(--fig-banda, #3FA34D)',
  pared: 'var(--fig-pared, #D9DCE2)', cajon: 'var(--fig-cajon, #C98B52)', cinta: 'var(--fig-cinta, #2F3238)',
};
/** El dibujo SVG (texto) de una lista de equipos, ya en píxeles. */
export function equipoSvg(items, px, k) {
  const P = q => px(q), n = v => v.toFixed(1);
  const linea = (a, b, ancho, color, extra = '') => `<line x1="${n(P(a).x)}" y1="${n(P(a).y)}" x2="${n(P(b).x)}" y2="${n(P(b).y)}" stroke="${color}" stroke-width="${n(ancho * k)}" stroke-linecap="round"${extra}/>`;
  const circ = (c, r, fill, extra = '') => `<circle cx="${n(P(c).x)}" cy="${n(P(c).y)}" r="${n(r * k)}" fill="${fill}"${extra}/>`;
  const rect = (x1, y1, x2, y2, fill, radio = 0.01) => { const a = P({ x: x1, y: y2 }), b = P({ x: x2, y: y1 }); return `<rect x="${n(a.x)}" y="${n(a.y)}" width="${n(b.x - a.x)}" height="${n(b.y - a.y)}" rx="${n(radio * k)}" fill="${fill}"/>`; };
  return items.map(e => {
    switch (e.tipo) {
      case 'disco': return circ(e.centro, e.r || 0.225, COLOR_EQUIPO.oscuro, ` stroke="${COLOR_EQUIPO.borde}" stroke-width="${n(0.025 * k)}"`) + circ(e.centro, (e.r || 0.225) * 0.2, COLOR_EQUIPO.borde);
      case 'barra': return circ(e.centro, e.r || 0.03, COLOR_EQUIPO.metal, ` stroke="var(--fig-borde, #FFFFFF)" stroke-width="2" paint-order="stroke"`);
      case 'mancuerna': return circ(e.centro, 0.075, COLOR_EQUIPO.oscuro, ` stroke="${COLOR_EQUIPO.borde}" stroke-width="${n(0.015 * k)}"`) + circ(e.centro, 0.02, COLOR_EQUIPO.metal);
      case 'kettlebell': {
        const c = e.centro, asa = { x: c.x, y: c.y + 0.11 };
        return `<path d="M${n(P({ x: c.x - 0.05, y: c.y + 0.05 }).x)} ${n(P({ x: c.x - 0.05, y: c.y + 0.05 }).y)} Q${n(P(asa).x)} ${n(P({ x: c.x, y: c.y + 0.2 }).y)} ${n(P({ x: c.x + 0.05, y: c.y + 0.05 }).x)} ${n(P({ x: c.x + 0.05, y: c.y + 0.05 }).y)}" fill="none" stroke="${COLOR_EQUIPO.oscuro}" stroke-width="${n(0.025 * k)}"/>` + circ(c, 0.095, COLOR_EQUIPO.oscuro);
      }
      case 'banco': { // tapiz de a a b (su cara superior) con patas al suelo
        const g = e.grosor || 0.07, a = e.a, b = e.b;
        const pata = q => linea({ x: q.x, y: q.y - g / 2 }, { x: q.x, y: 0.02 }, 0.04, COLOR_EQUIPO.estructura);
        const patas = e.patas === false ? '' : pata({ x: a.x + (b.x - a.x) * 0.15, y: a.y + (b.y - a.y) * 0.15 - g / 2 }) + pata({ x: a.x + (b.x - a.x) * 0.85, y: a.y + (b.y - a.y) * 0.85 - g / 2 });
        const d = { x: b.x - a.x, y: b.y - a.y }, L = Math.hypot(d.x, d.y) || 1, abajo = { x: d.y / L * g / 2, y: -d.x / L * g / 2 };
        const m1 = { x: a.x + abajo.x, y: a.y + abajo.y }, m2 = { x: b.x + abajo.x, y: b.y + abajo.y };
        return patas + linea(m1, m2, g, COLOR_EQUIPO.tapiz);
      }
      case 'rodillo': return circ(e.centro, e.r || 0.055, COLOR_EQUIPO.tapiz);
      case 'poste': return linea({ x: e.x, y: e.y1 ?? 0 }, { x: e.x, y: e.y2 }, e.ancho || 0.06, COLOR_EQUIPO.estructura);
      case 'cable': return linea(e.desde, e.hasta, 0.008, COLOR_EQUIPO.metal) + circ(e.desde, 0.035, COLOR_EQUIPO.estructura) + circ(e.desde, 0.012, COLOR_EQUIPO.oscuro);
      case 'mango': return circ(e.centro, e.r || 0.028, COLOR_EQUIPO.oscuro);
      case 'barraFija': return linea({ x: e.centro.x + 0.32, y: 0 }, { x: e.centro.x + 0.32, y: e.centro.y + 0.08 }, 0.05, COLOR_EQUIPO.estructura)
        + linea({ x: e.centro.x, y: e.centro.y }, { x: e.centro.x + 0.32, y: e.centro.y + 0.08 }, 0.035, COLOR_EQUIPO.estructura) + circ(e.centro, 0.022, COLOR_EQUIPO.metal);
      case 'paralela': return linea({ x: e.centro.x - 0.05, y: 0 }, { x: e.centro.x - 0.05, y: e.centro.y }, 0.045, COLOR_EQUIPO.estructura) + circ(e.centro, 0.025, COLOR_EQUIPO.metal);
      case 'cajon': return rect(e.x1, 0, e.x2, e.alto, COLOR_EQUIPO.cajon, 0.015);
      case 'colchoneta': return rect(e.x1, 0, e.x2, 0.02, COLOR_EQUIPO.banda, 0.01);
      case 'pared': return rect(e.x, 0, e.x + 0.08, 2.3, COLOR_EQUIPO.pared, 0);
      case 'marco': return rect(e.x, 0, e.x + 0.06, 2.1, COLOR_EQUIPO.estructura, 0);
      case 'banda': return `<polyline points="${e.puntos.map(q => `${n(P(q).x)},${n(P(q).y)}`).join(' ')}" fill="none" stroke="${COLOR_EQUIPO.banda}" stroke-width="${n(0.016 * k)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      case 'rieles': return linea({ x: e.x - 0.04, y: 0 }, { x: e.x - 0.04, y: 2.15 }, 0.02, COLOR_EQUIPO.estructura) + linea({ x: e.x + 0.04, y: 0 }, { x: e.x + 0.04, y: 2.15 }, 0.02, COLOR_EQUIPO.estructura);
      case 'plataforma': return linea(e.a, e.b, 0.05, COLOR_EQUIPO.oscuro);
      case 'cinta': return linea({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }, 0.07, COLOR_EQUIPO.cinta) + linea({ x: e.x2, y: e.y2 }, { x: e.x2 + 0.05, y: e.y2 + 1.1 }, 0.05, COLOR_EQUIPO.estructura);
      case 'escalones': return e.puntos.map((q, i) => rect(q.x, q.y - 0.18, q.x + 0.3, q.y, i % 2 ? COLOR_EQUIPO.oscuro : COLOR_EQUIPO.tapiz, 0.01)).join('');
      default: return '';
    }
  }).join('');
}

/**
 * Crea la figura dentro de un grupo SVG. escala: píxeles por metro (el suelo queda en y = 0 del grupo).
 * dibujar(pose) la pone en la pose. pose.lejos trae las articulaciones del otro lado cuando no son las mismas (una
 * estocada); si no, se corren un poco para que se vea la profundidad. pose.equipo: lista de equipos (equipoSvg) con su capa
 * ('fondo', 'medio' o 'frente'). pose.puno: dónde va el puño si no es la muñeca (curl de muñeca).
 */
export function crearFigura(grupo, { escala = 200, lejos = { x: 0.014, y: 0 }, variante = 'hombre' } = {}) {
  const V = VARIANTES[variante] || VARIANTES.hombre;
  const perfilBrazo = escalar(PERFILES.brazo, V.brazos), perfilAntebrazo = escalar(PERFILES.antebrazo, V.brazos);
  const px = q => ({ x: q.x * escala, y: -q.y * escala });
  const capa = (fill, borde = false) => {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('fill', fill);
    if (borde) { el.setAttribute('stroke', COLOR.borde); el.setAttribute('stroke-width', '2.2'); el.setAttribute('paint-order', 'stroke'); el.setAttribute('stroke-linejoin', 'round'); }
    grupo.append(el);
    return el;
  };
  const grupoEquipo = () => { const g = document.createElementNS(NS, 'g'); grupo.append(g); return g; };
  const circulo = (fill, r) => { const el = document.createElementNS(NS, 'circle'); el.setAttribute('fill', fill); el.setAttribute('r', r); grupo.append(el); return el; };
  const forma = (el, puntos) => el.setAttribute('d', curva(puntos.map(px)));

  const equipoFondo = grupoEquipo();
  // El otro lado, más oscuro.
  const L = {
    brazo: capa(COLOR.pielLejos), manga: capa(COLOR.poleraLejos), antebrazo: capa(COLOR.pielLejos), mano: capa(COLOR.pielLejos),
    muslo: capa(COLOR.pielLejos), short: capa(COLOR.shortLejos), pierna: capa(COLOR.pielLejos), zapatilla: capa(COLOR.zapatillaLejos), suela: capa(COLOR.suela),
  };
  // Cuello y tronco; el muslo de este lado va sobre la polera y bajo el short.
  const cuello = capa(COLOR.pielSombra);
  const tronco = capa(COLOR.polera, true);
  const C = { muslo: capa(COLOR.piel, true) };
  const shortPelvis = capa(COLOR.short);
  Object.assign(C, { short: capa(COLOR.short), pierna: capa(COLOR.piel, true), zapatilla: capa(COLOR.zapatilla, true), suela: capa(COLOR.suela) });
  // Cabeza, el equipo del medio (la barra sobre los hombros) y el brazo de este lado.
  const cola = V.cola ? capa(COLOR.pelo) : null; // la cola de caballo va detrás de la cabeza
  const cabeza = capa(COLOR.piel, true), oreja = capa(COLOR.pielSombra), pelo = capa(COLOR.pelo), ojo = circulo(COLOR.ojo, 2.2), ceja = capa(COLOR.pelo);
  const equipoMedio = grupoEquipo();
  Object.assign(C, { brazo: capa(COLOR.piel, true), manga: capa(COLOR.polera, true), antebrazo: capa(COLOR.piel, true), mano: capa(COLOR.piel, true) });
  const equipoFrente = grupoEquipo();

  /** Una zapatilla en el sistema del pie: del talón a la punta, con la suela hacia el lado de apoyo. */
  const zapatilla = (talon, punta, tobillo) => {
    const dx = punta.x - talon.x, dy = punta.y - talon.y, Lp = Math.hypot(dx, dy) || 1e-9, ex = { x: dx / Lp, y: dy / Lp }, ey = { x: -ex.y, y: ex.x };
    const k = (tobillo.x - talon.x) * ex.x + (tobillo.y - talon.y) * ex.y;
    const w = ([a, u]) => ({ x: talon.x + ex.x * a + ey.x * u, y: talon.y + ex.y * a + ey.y * u });
    return {
      capellada: [[0.004, 0.02], [-0.006, 0.058], [0.018, 0.098], [k + 0.038, 0.092], [k + 0.085, 0.066], [Lp - 0.035, 0.045], [Lp + 0.006, 0.03], [Lp, 0.018]].map(w),
      suela: [[-0.008, 0.024], [-0.01, 0.004], [Lp + 0.008, 0.002], [Lp + 0.014, 0.016], [Lp + 0.002, 0.026]].map(w),
    };
  };
  const mano = q => Array.from({ length: 8 }, (_, i) => ({ x: q.x + 0.042 * Math.cos(i * Math.PI / 4), y: q.y + 0.038 * Math.sin(i * Math.PI / 4) }));

  function lado(capas, p, d) {
    const s = q => ({ x: q.x + d.x, y: q.y + d.y });
    forma(capas.muslo, contornoMiembro(s(p.cadera), s(p.rodilla), PERFILES.muslo));
    forma(capas.short, contornoPrenda(s(p.cadera), s(p.rodilla), V.largoShort, 0.09, 0.09));
    forma(capas.pierna, contornoMiembro(s(p.rodilla), s(p.tobillo), PERFILES.pierna));
    const z = zapatilla(s(p.talon), s(p.punta), s(p.tobillo));
    forma(capas.zapatilla, z.capellada); forma(capas.suela, z.suela);
    forma(capas.brazo, contornoMiembro(s(p.hombro), s(p.codo), perfilBrazo));
    forma(capas.manga, contornoPrenda(s(p.hombro), s(p.codo), 0.38, 0.062 * V.brazos, 0.058 * V.brazos));
    forma(capas.antebrazo, contornoMiembro(s(p.codo), s(p.mano), perfilAntebrazo));
    forma(capas.mano, mano(s(p.puno || p.mano)));
  }

  function dibujar(p) {
    const equipo = [...(p.equipo || [])];
    // La barra con discos de antes (pose.barra) sigue funcionando: disco detrás y la barra sobre los hombros.
    if (p.barra) equipo.push({ tipo: 'disco', centro: { x: p.barra.x - 0.015, y: p.barra.y + 0.01 }, r: p.radioDisco || 0.225, capa: 'fondo' }, { tipo: 'barra', centro: p.barra, capa: 'medio' });
    equipoFondo.innerHTML = equipoSvg(equipo.filter(e => (e.capa || 'fondo') === 'fondo'), px, escala);
    equipoMedio.innerHTML = equipoSvg(equipo.filter(e => e.capa === 'medio'), px, escala);
    equipoFrente.innerHTML = equipoSvg(equipo.filter(e => e.capa === 'frente'), px, escala);
    lado(L, p.lejos ? { ...p, puno: null, ...p.lejos } : p, p.lejos ? { x: 0, y: 0 } : lejos);
    // Tronco: sistema con v hacia adelante (signo -1 respecto del lado anterior de los miembros).
    const wt = marco(p.cadera, p.hombro, -1), Lt = Math.hypot(p.hombro.x - p.cadera.x, p.hombro.y - p.cadera.y);
    const enTronco = ([u, v]) => wt(u / Lt, v);
    forma(tronco, V.tronco.map(enTronco));
    forma(shortPelvis, V.short.map(enTronco));
    forma(cuello, contornoMiembro(enTronco([0.46, -0.01]), p.cabeza, PERFILES.cuello, -1)); // la cabeza tapa su extremo
    // Cabeza: su eje va de la base del cuello al centro de la cabeza; la cara mira hacia el lado anterior.
    const R = p.radioCabeza || 0.108, ux0 = p.cabeza.x - p.base.x, uy0 = p.cabeza.y - p.base.y, lu = Math.hypot(ux0, uy0) || 1;
    const u = { x: ux0 / lu, y: uy0 / lu }, v = { x: u.y, y: -u.x };
    const enCabeza = ([a, b]) => ({ x: p.cabeza.x + (u.x * a + v.x * b) * R, y: p.cabeza.y + (u.y * a + v.y * b) * R });
    forma(cabeza, CARA.map(enCabeza));
    forma(pelo, V.pelo.map(enCabeza));
    if (cola) forma(cola, V.cola.map(enCabeza));
    forma(oreja, Array.from({ length: 8 }, (_, i) => enCabeza([-0.1 + 0.2 * Math.sin(i * Math.PI / 4), -0.08 + 0.14 * Math.cos(i * Math.PI / 4)])));
    const o = px(enCabeza([0.08, 0.7]));
    ojo.setAttribute('cx', f(o.x)); ojo.setAttribute('cy', f(o.y));
    forma(ceja, [[0.24, 0.6], [0.3, 0.86], [0.24, 0.9], [0.2, 0.62]].map(enCabeza));
    lado(C, p, { x: 0, y: 0 });
  }
  return { dibujar };
}
