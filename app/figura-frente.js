// La figura humana vista de frente (o de espalda, o desde arriba si está acostada), con el mismo estilo y colores
// que la de lado (app/figura.js). Dibuja las poses ya proyectadas de nucleo/animaciones-frente.js: cada parte del
// cuerpo y cada equipo se ordena por su profundidad, así lo que está más cerca de la cámara tapa lo de atrás.
import { COLOR, VARIANTES, PERFILES, curva, contornoMiembro, contornoPrenda, equipoSvg } from './figura.js';

const NS = 'http://www.w3.org/2000/svg';
// Siluetas de frente: [altura en fracción del tronco (0 en las caderas, 1 en los hombros), medio ancho en metros].
// Arriba, el escote deja ver la base del cuello.
const POLERA = {
  hombre: [[0.08, 0.15], [0.2, 0.152], [0.4, 0.156], [0.62, 0.172], [0.8, 0.192], [0.93, 0.21], [1.0, 0.205], [1.05, 0.15], [1.085, 0.075], [1.03, 0.04], [1.01, 0]],
  mujer: [[0.08, 0.15], [0.16, 0.142], [0.32, 0.126], [0.52, 0.14], [0.7, 0.158], [0.86, 0.168], [0.96, 0.18], [1.02, 0.168], [1.065, 0.11], [1.09, 0.06], [1.03, 0.035], [1.01, 0]],
};
const SHORT = {
  hombre: [[0.25, 0.153], [0.08, 0.162], [-0.06, 0.166], [-0.16, 0.118], [-0.2, 0]],
  mujer: [[0.25, 0.156], [0.08, 0.17], [-0.06, 0.174], [-0.16, 0.124], [-0.2, 0]],
};
// Sentado, los muslos vienen hacia la cámara: el short se ve como una franja ancha bajo la cintura.
const SHORT_SENTADO = {
  hombre: [[0.25, 0.153], [0.08, 0.168], [-0.08, 0.19], [-0.22, 0.19], [-0.3, 0.12], [-0.32, 0]],
  mujer: [[0.25, 0.156], [0.08, 0.176], [-0.08, 0.198], [-0.22, 0.198], [-0.3, 0.126], [-0.32, 0]],
};
// Cabeza de frente, en radios de la cabeza: [hacia el lado, hacia arriba].
const CARA = [[0, 1.02], [0.5, 0.92], [0.8, 0.6], [0.86, 0.15], [0.8, -0.3], [0.62, -0.7], [0.32, -0.95], [0, -1.0], [-0.32, -0.95], [-0.62, -0.7], [-0.8, -0.3], [-0.86, 0.15], [-0.8, 0.6], [-0.5, 0.92]];
const PELO = {
  hombre: { frente: [[-0.9, 0.3], [-0.95, 0.64], [-0.68, 0.99], [-0.25, 1.13], [0.25, 1.13], [0.68, 0.99], [0.95, 0.64], [0.9, 0.3], [0.8, 0.5], [0.5, 0.68], [0.05, 0.64], [-0.45, 0.7], [-0.8, 0.5]] },
  mujer: {
    // Pelo tomado: el volumen de arriba, una partidura al lado y la cola que asoma por detrás.
    atras: [[-0.96, 0.25], [-0.98, -0.3], [-0.88, -0.5], [0.88, -0.5], [0.98, -0.3], [0.96, 0.25], [0.9, 0.72], [0.5, 1.08], [0, 1.16], [-0.5, 1.08], [-0.9, 0.72]],
    frente: [[-0.93, 0.2], [-0.95, 0.66], [-0.66, 1.02], [-0.2, 1.15], [0.3, 1.14], [0.72, 0.98], [0.95, 0.64], [0.92, 0.22], [0.82, 0.5], [0.55, 0.7], [0.2, 0.74], [-0.3, 0.62], [-0.7, 0.48]],
    cola: [[0.55, 0.85], [0.95, 0.9], [1.25, 0.6], [1.32, 0.1], [1.2, -0.45], [1.05, -0.2], [1.02, 0.3], [0.85, 0.65]],
    colaEspalda: [[-0.2, 0.55], [0.2, 0.55], [0.26, -0.1], [0.18, -0.9], [0, -1.35], [-0.18, -0.9], [-0.26, -0.1]],
  },
};
const PIE_ARRIBA = [[0, 0.042, 0.042], [0.55, 0.052, 0.052], [1, 0.04, 0.04]];

const f1 = n => n.toFixed(1);
const resta = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const unit2 = v => { const L = Math.hypot(v.x, v.y) || 1e-9; return { x: v.x / L, y: v.y / L }; };
const mezcla = (a, b, s) => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s });

/** Crea la figura de frente dentro de un grupo SVG. escala: píxeles por metro (el suelo queda en y = 0). */
export function crearFiguraFrente(grupo, { escala = 200, variante = 'hombre' } = {}) {
  const V = VARIANTES[variante] || VARIANTES.hombre, tipo = variante === 'mujer' ? 'mujer' : 'hombre';
  const perfilBrazo = PERFILES.brazo.map(([t, a, b]) => [t, a * V.brazos, b * V.brazos]);
  const perfilAntebrazo = PERFILES.antebrazo.map(([t, a, b]) => [t, a * V.brazos, b * V.brazos]);
  const px = q => ({ x: q.x * escala, y: -q.y * escala });
  const grupoNuevo = () => { const g = document.createElementNS(NS, 'g'); grupo.append(g); return g; };
  const capa = (g, fill, borde = false) => {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('fill', fill);
    if (borde) { el.setAttribute('stroke', COLOR.borde); el.setAttribute('stroke-width', '2.2'); el.setAttribute('paint-order', 'stroke'); el.setAttribute('stroke-linejoin', 'round'); }
    g.append(el);
    return el;
  };
  const forma = (el, puntos) => el.setAttribute('d', puntos ? curva(puntos.map(px)) : '');

  // Partes: cada una en su grupo, que se reordena por profundidad en cada cuadro.
  const piernas = [0, 1].map(() => {
    const g = grupoNuevo();
    // La rodilla lleva un parche de piel sin borde que esconde las líneas de adentro, donde se juntan muslo y pierna.
    return { g, pierna: capa(g, COLOR.piel, true), muslo: capa(g, COLOR.piel, true), rodilla: capa(g, COLOR.piel), short: capa(g, COLOR.short), zapatilla: capa(g, COLOR.zapatilla, true), suela: capa(g, COLOR.suela) };
  });
  const gTronco = grupoNuevo();
  const cuello = capa(gTronco, COLOR.pielSombra), polera = capa(gTronco, COLOR.polera, true), shortPelvis = capa(gTronco, COLOR.short);
  const gCabeza = grupoNuevo();
  const cola = capa(gCabeza, COLOR.pelo), orejas = [capa(gCabeza, COLOR.pielSombra), capa(gCabeza, COLOR.pielSombra)];
  const peloAtras = capa(gCabeza, COLOR.pelo), cara = capa(gCabeza, COLOR.piel, true), nariz = capa(gCabeza, COLOR.pielSombra), peloFrente = capa(gCabeza, COLOR.pelo);
  const ojos = [0, 1].map(() => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('fill', COLOR.ojo); c.setAttribute('r', f1(0.021 * escala)); gCabeza.append(c); return c; });
  const cejas = [capa(gCabeza, COLOR.pelo), capa(gCabeza, COLOR.pelo)], colaEspalda = capa(gCabeza, COLOR.pelo);
  const brazos = [0, 1].map(() => {
    const g = grupoNuevo();
    return { g, brazo: capa(g, COLOR.piel, true), antebrazo: capa(g, COLOR.piel, true), codo: capa(g, COLOR.piel), manga: capa(g, COLOR.polera, true), mano: capa(g, COLOR.piel, true) };
  });
  const equipos = [];
  const mano = q => Array.from({ length: 8 }, (_, i) => ({ x: q.x + 0.042 * Math.cos(i * Math.PI / 4), y: q.y + 0.04 * Math.sin(i * Math.PI / 4) }));
  const parche = (q, r) => Array.from({ length: 8 }, (_, i) => ({ x: q.x + r * Math.cos(i * Math.PI / 4), y: q.y + r * Math.sin(i * Math.PI / 4) }));

  /** Zapatilla: de frente (el pie apunta a la cámara) o a lo largo si se ve el pie entero (desde arriba o de lado). */
  function zapatilla(capas, pi, signo) {
    const talon = pi.talon, punta = pi.punta;
    if (Math.hypot(punta.x - talon.x, punta.y - talon.y) > 0.13) {
      // Vista desde arriba: la suela blanca asoma alrededor de la capellada.
      capas.zapatilla.setAttribute('fill', COLOR.suela); capas.suela.setAttribute('fill', COLOR.zapatilla);
      forma(capas.zapatilla, contornoMiembro(talon, punta, PIE_ARRIBA, signo, 0.006));
      forma(capas.suela, contornoMiembro(talon, punta, PIE_ARRIBA.map(([t, a, b]) => [t, a - 0.008, b - 0.008]), signo));
      return;
    }
    capas.zapatilla.setAttribute('fill', COLOR.zapatilla); capas.suela.setAttribute('fill', COLOR.suela);
    // De frente: la suela abajo, en el sistema de la pierna (sigue al pie si la pierna se abre).
    const baja = unit2(resta(pi.tobillo, pi.rodilla)), lado = { x: -baja.y * signo, y: baja.x * signo };
    const apoyo = { x: pi.tobillo.x + baja.x * 0.064, y: pi.tobillo.y + baja.y * 0.064 };
    const w = ([a, b]) => ({ x: apoyo.x - baja.x * a + lado.x * b, y: apoyo.y - baja.y * a + lado.y * b });
    forma(capas.zapatilla, [[0, -0.05], [0.05, -0.057], [0.088, -0.044], [0.104, 0], [0.09, 0.046], [0.05, 0.06], [0, 0.056]].map(w));
    forma(capas.suela, [[-0.004, -0.053], [0.02, -0.056], [0.02, 0.06], [-0.004, 0.058]].map(w));
  }

  function dibujar(p) {
    const R = p.radioCabeza || 0.108, espalda = Boolean(p.espalda);
    const P = p.pelvis, C = p.centroHombros, Lp = p.Lp, Ls = p.L;
    // Tronco: el centro va de la pelvis a los hombros; el ancho gira de la cadera al pecho.
    const enTronco = ([u, w]) => {
      const t = Math.min(1, Math.max(0, (u - 0.25) / 0.5)), lat = mezcla(Lp, Ls, t), c = mezcla(P, C, u);
      return { x: c.x + lat.x * w, y: c.y + lat.y * w };
    };
    const contorno = perfil => [...perfil.map(([u, w]) => enTronco([u, -w])), ...[...perfil].reverse().map(([u, w]) => enTronco([u, w]))]
      .filter((q, i, a) => i === 0 || Math.hypot(q.x - a[i - 1].x, q.y - a[i - 1].y) > 1e-4);
    forma(polera, contorno(espalda ? POLERA[tipo].filter(([u]) => u < 1.02).concat([[1.06, 0.06], [1.07, 0]]) : POLERA[tipo]));
    forma(shortPelvis, contorno((p.sentado ? SHORT_SENTADO : SHORT)[tipo]));
    forma(cuello, contornoMiembro(p.cuello, p.cabeza, PERFILES.cuello));

    // Piernas: el lado más ancho del muslo va hacia afuera.
    p.piernas.forEach((pi, i) => {
      const c = piernas[i], signo = i ? 1 : -1;
      forma(c.muslo, contornoMiembro(pi.cadera, pi.rodilla, PERFILES.muslo, signo));
      forma(c.short, contornoPrenda(pi.cadera, pi.rodilla, V.largoShort, 0.088, 0.088, signo));
      forma(c.pierna, contornoMiembro(pi.rodilla, pi.tobillo, PERFILES.pierna, -signo));
      forma(c.rodilla, parche(pi.rodilla, 0.042));
      zapatilla(c, pi, signo);
    });
    p.brazos.forEach((b, i) => {
      const c = brazos[i], signo = i ? 1 : -1;
      forma(c.brazo, contornoMiembro(b.hombro, b.codo, perfilBrazo, signo));
      forma(c.manga, contornoPrenda(b.hombro, b.codo, 0.38, 0.062 * V.brazos, 0.058 * V.brazos, signo));
      forma(c.antebrazo, contornoMiembro(b.codo, b.mano, perfilAntebrazo, signo));
      forma(c.codo, parche(b.codo, 0.03 * V.brazos));
      forma(c.mano, mano(b.puno || b.mano));
    });

    // Cabeza: su eje va de la base del cuello al centro; los rasgos giran con ella como sobre una esfera.
    const arriba = unit2(resta(p.cabeza, p.cuello)), lat = { x: arriba.y, y: -arriba.x };
    const en = ([v, u]) => ({ x: p.cabeza.x + (lat.x * v + arriba.x * u) * R, y: p.cabeza.y + (lat.y * v + arriba.y * u) * R });
    const giro = ((p.cabezaGiro || 0) * Math.PI) / 180, desplaza = v => 0.86 * Math.sin(Math.asin(Math.max(-1, Math.min(1, v / 0.86))) + giro);
    const pelo = PELO[tipo];
    forma(cara, CARA.map(en));
    orejas.forEach((o, i) => {
      const ang = (i ? 1 : -1) * Math.PI / 2 + giro, v = 0.93 * Math.sin(ang);
      forma(o, Math.cos(ang) > -0.45 || espalda ? Array.from({ length: 8 }, (_, k) => en([v + 0.11 * Math.cos(k * Math.PI / 4) * (espalda ? 1 : 0.8 + 0.2 * Math.abs(Math.sin(ang))), 0.02 + 0.2 * Math.sin(k * Math.PI / 4)])) : null);
    });
    if (espalda) {
      cara.setAttribute('fill', COLOR.pelo);
      forma(peloAtras, null); forma(peloFrente, null); forma(nariz, null); forma(cola, null);
      ojos.forEach(o => o.setAttribute('r', '0')); cejas.forEach(c => forma(c, null));
      forma(colaEspalda, pelo.colaEspalda ? pelo.colaEspalda.map(en) : null);
    } else {
      cara.setAttribute('fill', COLOR.piel);
      const corre = ps => ps.map(([v, u]) => [desplaza(Math.max(-0.86, Math.min(0.86, v))) + (Math.abs(v) > 0.86 ? v - Math.sign(v) * 0.86 : 0), u]);
      forma(peloAtras, pelo.atras ? corre(pelo.atras).map(en) : null);
      forma(peloFrente, corre(pelo.frente).map(en));
      forma(cola, pelo.cola ? pelo.cola.map(([v, u]) => [v * Math.cos(giro) - 0.5 * Math.sin(giro), u]).map(en) : null);
      forma(colaEspalda, null);
      forma(nariz, Array.from({ length: 6 }, (_, k) => en([desplaza(0) + 0.06 * Math.cos(k * Math.PI / 3), -0.14 + 0.14 * Math.sin(k * Math.PI / 3)])));
      [-1, 1].forEach((l, i) => {
        const v = desplaza(l * 0.33), o = px(en([v, 0.1]));
        ojos[i].setAttribute('r', f1(0.021 * escala)); ojos[i].setAttribute('cx', f1(o.x)); ojos[i].setAttribute('cy', f1(o.y));
        forma(cejas[i], [[v - 0.15, 0.32], [v - 0.02, 0.38], [v + 0.14, 0.35], [v + 0.14, 0.31], [v - 0.02, 0.335], [v - 0.15, 0.285]].map(en));
      });
    }

    // Equipo: cada pieza en su grupo, con su profundidad.
    const lista = p.equipo || [];
    while (equipos.length < lista.length) equipos.push(grupoNuevo());
    equipos.forEach((g, i) => { g.innerHTML = lista[i] ? equipoSvg([lista[i]], px, escala) : ''; });

    // Orden: lo más lejano primero. Con la misma profundidad, piernas, tronco, cabeza y brazos (en ese orden).
    const z = (...qs) => qs.reduce((t, q) => t + q.z, 0) / qs.length;
    const partes = [
      ...p.piernas.map((pi, i) => [piernas[i].g, z(pi.cadera, pi.rodilla, pi.tobillo) - 0.03]),
      // La cabeza nunca queda detrás de su propio cuello (acostado hacia atrás, la cabeza está más lejos que el tronco).
      [gTronco, z(P, C)], [gCabeza, Math.max(p.cabeza.z, z(P, C)) + 0.02],
      // La mano pesa doble: con las manos en la nuca, el brazo queda detrás de la cabeza.
      ...p.brazos.map((b, i) => [brazos[i].g, z(b.hombro, b.codo, b.mano, b.mano) + 0.03]),
      ...equipos.map((g, i) => [g, lista[i] ? lista[i].profundidad ?? -1 : -9]),
    ];
    partes.sort((a, b) => a[1] - b[1]).forEach(([g]) => grupo.append(g));
  }
  return { dibujar };
}
