// Figura anatómica plana para la ficha de cada ejercicio: el mismo cuerpo de lado del motor (nucleo/animaciones.js),
// pero gris y con los músculos a la vista. Los músculos principales del ejercicio van en rojo y los secundarios en rojo
// claro: es lo que dice el catálogo, no una medición de activación (docs/41-personaje-3d.md). Cada músculo se define en
// el sistema de su hueso, así acompaña cualquier postura. Los colores y las clases (.an-cuerpo, .an-musculo, .an-pelo,
// .an-sombra) están en app/estilos.css. Estilo elegido por Francisco el 13 de noviembre de 2026.
import { curva, contornoMiembro, PERFILES, VARIANTES, equipoSvg } from './figura.js';

const NS = 'http://www.w3.org/2000/svg';
const crear = (padre, nombre, attrs = {}) => { const el = document.createElementNS(NS, nombre); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); padre.append(el); return el; };

/** Sistema de un hueso: t a lo largo (0 a 1) y v en metros hacia su cara anterior. */
function marco(a, b, signo = 1) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1e-9, nx = (-dy / L) * signo, ny = (dx / L) * signo;
  return (t, v) => ({ x: a.x + dx * t + nx * v, y: a.y + dy * t + ny * v });
}

// Músculos por segmento. Cada punto: [t a lo largo del hueso, v hacia adelante en metros]. El contorno del segmento
// los recorta, así que pueden pasarse del borde. En el tronco, t es metros desde la cadera.
const MUSCULOS = {
  muslo: [
    { grupo: 'cuadriceps', puntos: [[0.05, -0.006], [0.03, 0.14], [0.5, 0.13], [0.97, 0.1], [0.94, -0.008], [0.6, -0.016], [0.3, -0.014]] },
    { grupo: 'femoral', puntos: [[0.24, -0.024], [0.6, -0.026], [0.92, -0.018], [0.99, -0.1], [0.5, -0.13], [0.2, -0.14]] },
  ],
  pierna: [
    { grupo: 'pantorrilla', puntos: [[0.03, -0.012], [0.3, -0.004], [0.6, -0.008], [0.66, -0.09], [0.3, -0.11], [0.02, -0.09]] },
    { grupo: 'tibial', puntos: [[0.05, 0.004], [0.4, 0.012], [0.82, 0.008], [0.84, 0.08], [0.05, 0.08]] },
  ],
  brazo: [
    { grupo: 'hombro', puntos: [[-0.2, -0.09], [-0.2, 0.09], [0.2, 0.09], [0.4, 0.004], [0.2, -0.09]] },
    { grupo: 'biceps', puntos: [[0.32, 0.01], [0.44, 0.002], [0.9, 0.006], [0.94, 0.09], [0.3, 0.09]] },
    { grupo: 'triceps', puntos: [[0.3, -0.012], [0.45, -0.008], [0.96, -0.006], [0.98, -0.09], [0.28, -0.09]] },
  ],
  antebrazo: [{ grupo: 'antebrazo', puntos: [[0.04, -0.07], [0.04, 0.07], [0.8, 0.06], [0.8, -0.06]] }],
  tronco: [
    { grupo: 'core', puntos: [[0.0, 0.034], [0.14, 0.04], [0.285, 0.05], [0.29, 0.2], [-0.02, 0.2]] }, // abdominales
    { grupo: 'core', puntos: [[0.03, -0.026], [0.14, -0.022], [0.25, -0.014], [0.262, 0.036], [0.14, 0.026], [0.02, 0.02]] }, // oblicuos
    { grupo: 'pecho', puntos: [[0.305, 0.034], [0.4, 0.02], [0.47, 0.03], [0.5, 0.2], [0.3, 0.2]] },
    { grupo: 'espalda', puntos: [[0.2, -0.034], [0.28, -0.03], [0.41, -0.022], [0.4, -0.2], [0.2, -0.2]] },
    // Zona lumbar: entre el glúteo y el dorsal.
    { grupo: 'erectores', puntos: [[-0.02, -0.04], [0.1, -0.038], [0.2, -0.034], [0.205, -0.2], [-0.04, -0.2]] },
    { grupo: 'trapecio', puntos: [[0.425, -0.022], [0.5, -0.004], [0.6, 0], [0.6, -0.2], [0.415, -0.2]] },
  ],
};
// Glúteo y abductores: unen la pelvis con el muslo, por eso mezclan los dos sistemas y se estiran al doblar la cadera.
const GLUTEO = [['tronco', 0.112, -0.05], ['tronco', 0.1, -0.12], ['tronco', 0.01, -0.165], ['muslo', 0.1, -0.14], ['muslo', 0.27, -0.11], ['muslo', 0.25, -0.036], ['muslo', 0.08, -0.018], ['tronco', 0.05, -0.03]];
const ABDUCTOR = [['tronco', 0.112, -0.04], ['tronco', 0.115, 0.045], ['muslo', 0.1, 0.04], ['muslo', 0.21, 0.004], ['muslo', 0.07, -0.006], ['tronco', 0.05, -0.018]];
/** Los músculos del catálogo que esta figura sabe pintar (una prueba del núcleo revisa que no falte ninguno). */
export const GRUPOS_QUE_PINTA = [...new Set([...Object.values(MUSCULOS).flat().map(mu => mu.grupo), 'gluteo', 'aductor_abductor'])];
let figuras = 0; // cada figura necesita recortes con nombre propio dentro de la página

/**
 * Crea la figura anatómica dentro de un grupo SVG.
 * escala: píxeles por metro. musculos: { primarios, secundarios } con los nombres del catálogo.
 * sombra: false para los movimientos sin suelo. modo 'zonas': solo los músculos que trabajan, para ponerlos sobre otra
 * figura (prototipos/animaciones/pulido.js).
 */
export function crearFiguraAnatomica(grupo, { escala = 100, variante = 'hombre', musculos = {}, id = `an${++figuras}`, modo = 'figura', sombra: conSombra = true } = {}) {
  if (modo === 'zonas') grupo.classList.add('an-zonas');
  const primarios = musculos.primarios || [], secundarios = musculos.secundarios || [];
  const V = VARIANTES[variante] || VARIANTES.hombre;
  const px = q => ({ x: q.x * escala, y: -q.y * escala });
  const perfil = { muslo: PERFILES.muslo, pierna: PERFILES.pierna, brazo: PERFILES.brazo.map(([t, a, b]) => [t, a * V.brazos, b * V.brazos]), antebrazo: PERFILES.antebrazo.map(([t, a, b]) => [t, a * V.brazos, b * V.brazos]) };
  const tono = g => (primarios.includes(g) ? 'principal' : secundarios.includes(g) ? 'secundario' : 'reposo');
  const d = puntos => curva(puntos.map(px));
  let n = 0;

  /** Un segmento: su silueta gris y, recortados por ella, sus músculos. */
  function segmento(nombre, lado) {
    const clip = `${id}-${nombre}-${lado}-${n++}`;
    const silueta = crear(grupo, 'path', { class: `an-cuerpo ${lado} ${nombre}` });
    const recorte = crear(crear(grupo, 'clipPath', { id: clip }), 'path');
    const g = crear(grupo, 'g', { 'clip-path': `url(#${clip})` });
    const partes = (MUSCULOS[nombre] || []).map(mu => ({ mu, el: crear(g, 'path', { class: `an-musculo ${tono(mu.grupo)} ${lado}` }) }));
    return {
      poner(contorno, w) {
        const dd = d(contorno);
        silueta.setAttribute('d', dd); recorte.setAttribute('d', dd);
        for (const { mu, el } of partes) el.setAttribute('d', d(mu.puntos.map(([t, v]) => w(t, v))));
      },
    };
  }
  const suelta = (clase) => crear(grupo, 'path', { class: clase });
  const capaEquipo = () => crear(grupo, 'g', { class: 'an-equipo' });

  const sombra = crear(grupo, 'ellipse', { class: 'an-sombra' });
  const equipoFondo = capaEquipo();
  const lejos = { brazo: segmento('brazo', 'lejos'), antebrazo: segmento('antebrazo', 'lejos'), mano: suelta('an-cuerpo lejos'), muslo: segmento('muslo', 'lejos'), pierna: segmento('pierna', 'lejos'), pie: suelta('an-cuerpo lejos') };
  const cola = V.cola ? suelta('an-pelo') : null;
  const cuello = suelta('an-cuerpo cuello');
  const tronco = segmento('tronco', 'cerca');
  const cerca = { muslo: segmento('muslo', 'cerca'), pierna: segmento('pierna', 'cerca'), pie: suelta('an-cuerpo cerca') };
  // El glúteo y el abductor van sobre la pelvis y el muslo, recortados por la unión de los dos.
  const clipCadera = `${id}-cadera`;
  const recorteCadera = crear(grupo, 'clipPath', { id: clipCadera });
  const recorteTronco = crear(recorteCadera, 'path'), recorteMuslo = crear(recorteCadera, 'path');
  const gCadera = crear(grupo, 'g', { 'clip-path': `url(#${clipCadera})` });
  const abductor = crear(gCadera, 'path', { class: `an-musculo ${tono('aductor_abductor')} cerca` });
  const gluteo = crear(gCadera, 'path', { class: `an-musculo ${tono('gluteo')} cerca` });
  const cabeza = suelta('an-cuerpo cerca cabeza'), pelo = suelta('an-pelo');
  const equipoMedio = capaEquipo();
  Object.assign(cerca, { brazo: segmento('brazo', 'cerca'), antebrazo: segmento('antebrazo', 'cerca'), mano: suelta('an-cuerpo cerca mano') });
  const equipoFrente = capaEquipo();

  const ovalo = (c, rx, ry, eje = { x: 1, y: 0 }) => Array.from({ length: 10 }, (_, i) => { const a = (i * Math.PI) / 5, u = rx * Math.cos(a), v = ry * Math.sin(a); return { x: c.x + eje.x * u - eje.y * v, y: c.y + eje.y * u + eje.x * v }; });
  /** Pie descalzo, del talón a la punta. */
  function formaPie(talon, punta, tobillo) {
    const dx = punta.x - talon.x, dy = punta.y - talon.y, L = Math.hypot(dx, dy) || 1e-9, ex = { x: dx / L, y: dy / L }, ey = { x: -ex.y, y: ex.x };
    const k = (tobillo.x - talon.x) * ex.x + (tobillo.y - talon.y) * ex.y;
    return [[-0.012, 0.004], [-0.016, 0.05], [k - 0.03, 0.094], [k + 0.036, 0.09], [k + 0.09, 0.052], [L - 0.04, 0.034], [L + 0.004, 0.02], [L, 0.002]].map(([a, u]) => ({ x: talon.x + ex.x * a + ey.x * u, y: talon.y + ex.y * a + ey.y * u }));
  }

  function extremidades(c, p, corr) {
    const s = q => ({ x: q.x + corr.x, y: q.y + corr.y });
    const cad = s(p.cadera), rod = s(p.rodilla), tob = s(p.tobillo), hom = s(p.hombro), cod = s(p.codo), man = s(p.mano);
    c.muslo.poner(contornoMiembro(cad, rod, perfil.muslo), marco(cad, rod));
    c.pierna.poner(contornoMiembro(rod, tob, perfil.pierna), marco(rod, tob));
    c.pie.setAttribute('d', d(formaPie(s(p.talon), s(p.punta), tob)));
    c.brazo.poner(contornoMiembro(hom, cod, perfil.brazo), marco(hom, cod));
    c.antebrazo.poner(contornoMiembro(cod, man, perfil.antebrazo), marco(cod, man));
    c.mano.setAttribute('d', d(ovalo(s(p.puno || p.mano), 0.042, 0.038)));
  }

  /**
   * Sombra de contacto en el suelo: bajo lo que está apoyado (los pies, o el cuerpo entero si está acostado), más ancha
   * hacia lo que queda cerca del suelo (la cadera al fondo de una sentadilla) y más tenue cuando el apoyo se levanta.
   * Colgado o sentado con los pies en el aire, no hay sombra.
   */
  function ponerSombra(p) {
    const limitar = v => Math.min(1, Math.max(0, v));
    const puntos = ['talon', 'punta', 'rodilla', 'cadera', 'hombro', 'codo', 'mano', 'cabeza'].flatMap(k => [p[k], p.lejos?.[k]]).filter(q => q && Number.isFinite(q.x));
    let apoyo = 0, centro = 0, fuerza = 0;
    for (const q of puntos) { const c = limitar((0.2 - q.y) / 0.12); apoyo += c; centro += c * q.x; fuerza = Math.max(fuerza, c); }
    if (!conSombra || !apoyo) { sombra.setAttribute('rx', '0'); return; }
    centro /= apoyo;
    let x1 = centro, x2 = centro;
    for (const q of puntos) { const w = limitar((0.9 - q.y) / 0.7); x1 = Math.min(x1, centro + (q.x - 0.1 - centro) * w); x2 = Math.max(x2, centro + (q.x + 0.06 - centro) * w); }
    const s0 = px({ x: (x1 + x2) / 2, y: 0 });
    sombra.setAttribute('cx', s0.x.toFixed(1)); sombra.setAttribute('cy', (s0.y + 1.5).toFixed(1));
    sombra.setAttribute('rx', (((x2 - x1) / 2) * escala).toFixed(1)); sombra.setAttribute('ry', (0.035 * escala).toFixed(1));
    sombra.setAttribute('opacity', fuerza.toFixed(2));
  }

  function dibujar(p, { aire = 0 } = {}) {
    const equipo = modo === 'zonas' ? [] : [...(p.equipo || [])];
    if (p.barra) equipo.push({ tipo: 'disco', centro: { x: p.barra.x - 0.015, y: p.barra.y + 0.01 }, r: p.radioDisco || 0.225, capa: 'fondo' }, { tipo: 'barra', centro: p.barra, capa: 'medio' });
    equipoFondo.innerHTML = equipoSvg(equipo.filter(e => (e.capa || 'fondo') === 'fondo'), px, escala);
    equipoMedio.innerHTML = equipoSvg(equipo.filter(e => e.capa === 'medio'), px, escala);
    equipoFrente.innerHTML = equipoSvg(equipo.filter(e => e.capa === 'frente'), px, escala);
    ponerSombra(p);

    extremidades(lejos, p.lejos ? { ...p, puno: null, ...p.lejos } : p, p.lejos ? { x: 0, y: 0 } : { x: 0.02, y: 0.004 });
    // Tronco: t en metros desde la cadera; el pecho se abre un poco al tomar aire.
    const Lt = Math.hypot(p.hombro.x - p.cadera.x, p.hombro.y - p.cadera.y) || 1e-9, wt0 = marco(p.cadera, p.hombro, -1);
    const pecho = u => 1 + 0.045 * aire * Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.18) / 0.36))));
    const wt = (u, v) => wt0(u / Lt, v > 0 ? v * pecho(u) : v);
    const siluetaTronco = V.tronco.map(([u, v]) => wt(u, v));
    tronco.poner(siluetaTronco, wt);
    cuello.setAttribute('d', d(contornoMiembro(wt(0.46, -0.01), p.cabeza, PERFILES.cuello, -1)));
    extremidades({ muslo: cerca.muslo, pierna: cerca.pierna, pie: cerca.pie, brazo: cerca.brazo, antebrazo: cerca.antebrazo, mano: cerca.mano }, p, { x: 0, y: 0 });
    // Cadera: glúteo y abductor entre la pelvis y el muslo.
    const wm = marco(p.cadera, p.rodilla), en = ([sis, a, b]) => (sis === 'tronco' ? wt(a, b) : wm(a, b));
    recorteTronco.setAttribute('d', d(siluetaTronco));
    recorteMuslo.setAttribute('d', d(contornoMiembro(p.cadera, p.rodilla, perfil.muslo)));
    gluteo.setAttribute('d', d(GLUTEO.map(en)));
    abductor.setAttribute('d', d(ABDUCTOR.map(en)));
    // Cabeza sin rasgos, con el pelo de la variante.
    const R = p.radioCabeza || 0.108, ux = p.cabeza.x - p.base.x, uy = p.cabeza.y - p.base.y, lu = Math.hypot(ux, uy) || 1, u = { x: ux / lu, y: uy / lu }, v = { x: u.y, y: -u.x };
    const enCabeza = ([a, b]) => ({ x: p.cabeza.x + (u.x * a + v.x * b) * R, y: p.cabeza.y + (u.y * a + v.y * b) * R });
    cabeza.setAttribute('d', d([[1, 0.1], [0.82, 0.6], [0.3, 0.9], [-0.2, 0.95], [-0.62, 0.86], [-0.9, 0.56], [-0.8, 0.1], [-0.62, -0.45], [-0.35, -0.86], [0.15, -0.97], [0.62, -0.76], [0.93, -0.35]].map(enCabeza)));
    pelo.setAttribute('d', d(V.pelo.map(enCabeza)));
    if (cola) cola.setAttribute('d', d(V.cola.map(enCabeza)));
  }
  return { dibujar };
}
