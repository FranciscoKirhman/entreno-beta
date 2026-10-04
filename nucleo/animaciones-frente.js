// Ejercicios vistos de frente (o desde arriba, si se hacen acostados): los que van hacia el costado o giran, que de
// lado no se entienden. Cada pose se arma en tres dimensiones con las mismas proporciones de la vista de lado y se
// proyecta según la cámara del ejercicio; la figura de app/figura-frente.js la dibuja.
//
// Convenciones: metros; x hacia la derecha de quien mira, y hacia arriba, z hacia quien mira; suelo en y = 0. Mirando
// a la cámara, el lado 0 de cada par (hombros, caderas, brazos, piernas) es el que queda a la izquierda de la pantalla
// (el lado derecho de la persona). Ángulos en grados. Las vistas desde arriba (acostado) usan z como la altura sobre
// el suelo, con la cabeza hacia arriba de la pantalla, y no dibujan la línea del suelo.

const R = g => (g * Math.PI) / 180;
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const sum = (...ps) => ps.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }), v3());
const dif = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const por = (a, k) => v3(a.x * k, a.y * k, a.z * k);
const prod = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cruz = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const largo3 = a => Math.hypot(a.x, a.y, a.z);
const unit = a => por(a, 1 / (largo3(a) || 1e-9));
const mix = (a, b, s) => a + (b - a) * s;
const mezcla = (a, b, s) => v3(mix(a.x, b.x, s), mix(a.y, b.y, s), mix(a.z, b.z, s));
const X = v3(1, 0, 0), Y = v3(0, 1, 0), Z = v3(0, 0, 1);
/** Gira v alrededor de un eje unitario, g grados (regla de la mano derecha: sobre Y, el frente gira hacia +x). */
function girar(v, eje, g) {
  const c = Math.cos(R(g)), s = Math.sin(R(g));
  return sum(por(v, c), por(cruz(eje, v), s), por(eje, prod(eje, v) * (1 - c)));
}
const girarEn = (p, centro, eje, g) => sum(centro, girar(dif(p, centro), eje, g));
/** Aceleración y frenado suaves. */
const suave = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const F = (nombre, seg, de, a, extra = {}) => ({ nombre, seg, de, a, ...extra });

/** Anchos del cuerpo (metros), proporcionales a la estatura. */
const anchos = m => { const e = m.pierna / 0.246; return { hombro: 0.108 * e, cadera: 0.051 * e }; };

/**
 * Cinemática inversa de dos segmentos en el espacio: dónde queda la articulación del medio (rodilla o codo) para que
 * el extremo llegue al objetivo, doblándose hacia "polo". Devuelve el medio y el extremo, a sus largos exactos.
 */
function ik(origen, objetivo, l1, l2, polo) {
  const d = dif(objetivo, origen), u = unit(d);
  const L = Math.min(Math.max(largo3(d), Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  const a = (l1 * l1 + L * L - l2 * l2) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let w = dif(polo, por(u, prod(polo, u)));
  if (largo3(w) < 1e-6) w = cruz(u, Math.abs(u.x) < 0.9 ? X : Y);
  const medio = sum(origen, por(u, a), por(unit(w), h));
  return { medio, fin: sum(medio, por(unit(dif(objetivo, medio)), l2)) };
}

// ── Cuerpo ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Tronco desde la pelvis. arriba: hacia dónde va la columna; frente: hacia dónde mira el pecho. giro: rotación de los
 * hombros sobre la columna (positivo: el pecho gira hacia la derecha de la pantalla); giroPelvis, la de la cadera.
 * inclina: la columna se dobla hacia el lado (positivo: los hombros van a la derecha de la pantalla).
 * cabezaGiro e cabezaInclina mueven solo la cabeza.
 */
function tronco(m, pelvis, { arriba = Y, frente = Z, giro = 0, giroPelvis = 0, inclina = 0, cabezaGiro = 0, cabezaInclina = 0, cabezaAdelante = 0 } = {}) {
  const U0 = unit(arriba), F0 = unit(dif(frente, por(U0, prod(frente, U0))));
  const U = girar(U0, F0, -inclina);
  const L0 = cruz(U0, F0), Lp = girar(L0, U0, giroPelvis), Fp = girar(F0, U0, giroPelvis);
  const Ls = girar(girar(L0, U0, giro), F0, -inclina), Fs = unit(cruz(Ls, U));
  const a = anchos(m), centroHombros = sum(pelvis, por(U, m.tronco));
  const caderas = [sum(pelvis, por(Lp, -a.cadera)), sum(pelvis, por(Lp, a.cadera))];
  const hombros = [sum(centroHombros, por(Ls, -a.hombro), por(U, -0.012)), sum(centroHombros, por(Ls, a.hombro), por(U, -0.012))];
  const cuello = sum(centroHombros, por(U, 0.02));
  let Uc = girar(U, Fs, -cabezaInclina);
  Uc = girar(Uc, Ls, -cabezaAdelante);
  const cabeza = sum(cuello, por(Uc, m.cuello + m.cabeza * 0.82));
  return { pelvis, centroHombros, caderas, hombros, cuello, cabeza, U, L: Ls, F: Fs, Lp, Fp, cabezaGiro: giro + cabezaGiro };
}

/** Una pierna de la cadera al tobillo (la rodilla se dobla hacia "rodilla"); el pie apunta hacia "pie" y apoya hacia "abajo". */
function pierna(m, cadera, tobillo, { rodilla = Z, pie = Z, abajo = v3(0, -1, 0) } = {}) {
  const { medio, fin } = ik(cadera, tobillo, m.muslo, m.pierna, rodilla);
  const dirPie = unit(pie), base = sum(fin, por(unit(abajo), m.tobillo * 0.92));
  return { cadera, rodilla: medio, tobillo: fin, talon: sum(base, por(dirPie, -0.05)), punta: sum(base, por(dirPie, m.pie * 0.72)) };
}
/** Un brazo del hombro hacia la mano (el codo se dobla hacia "codo"). */
function brazo(m, hombro, mano, codo = v3(0, -0.4, -1)) {
  const { medio, fin } = ik(hombro, mano, m.brazo, m.antebrazo, codo);
  return { hombro, codo: medio, mano: fin };
}
/** Un brazo por direcciones: hacia dónde va el brazo y hacia dónde el antebrazo. */
function brazoDir(m, hombro, dirBrazo, dirAntebrazo = dirBrazo) {
  const codo = sum(hombro, por(unit(dirBrazo), m.brazo));
  return { hombro, codo, mano: sum(codo, por(unit(dirAntebrazo), m.antebrazo)) };
}
/** Alto de la pelvis con las piernas casi estiradas y los tobillos separados "dx" de las caderas. */
const altoPelvis = (m, dx = 0.02, flexion = 0) => m.tobillo + Math.sqrt((m.muslo + m.pierna - 0.004) ** 2 - dx * dx) - flexion;

/** De pie, de frente: pies separados "abiertas" a cada lado de la cadera; flexion baja la pelvis (rodillas dobladas). */
function dePie(m, { abiertas = 0.02, flexion = 0, desplaza = 0, opciones = {} } = {}) {
  const a = anchos(m), dx = abiertas;
  const pelvis = v3(desplaza, altoPelvis(m, dx, flexion), 0);
  const t = tronco(m, pelvis, opciones);
  const piernas = [-1, 1].map((lado, i) => pierna(m, t.caderas[i], v3(lado * (a.cadera + dx), m.tobillo, 0.02), { rodilla: v3(lado * 0.15, 0, 1), pie: v3(lado * 0.18, 0, 1) }));
  return { ...t, piernas };
}

/** Sentado en un asiento de alto "alto": muslos hacia la cámara, pies en el suelo. */
function sentado(m, { alto = 0.47, separa = 0.06, opciones = {}, rodillaZ = 0.4 } = {}) {
  const a = anchos(m), pelvis = v3(0, alto + 0.09, -0.02);
  const t = tronco(m, pelvis, opciones);
  const piernas = [-1, 1].map((lado, i) => {
    const cadera = t.caderas[i];
    const rodilla = sum(cadera, v3(lado * separa, -0.03, 0), por(Z, rodillaZ));
    const tobillo = v3(rodilla.x + lado * 0.02, m.tobillo, rodilla.z + 0.06);
    return pierna(m, cadera, tobillo, { rodilla: v3(lado * 0.1, 0.3, 1), pie: v3(lado * 0.15, 0, 1) });
  });
  return { ...t, piernas, sentado: true };
}

const pose = (cuerpo, brazos, extra = {}) => ({ vista: 'frente', ...cuerpo, brazos, equipo: [], ...extra });
/** Mira desde atrás: la misma pose con la profundidad invertida y x espejada (el lado 0 sigue a la izquierda de la pantalla). */
function deEspalda(p) {
  const f = q => (q && Number.isFinite(q.x) ? v3(-q.x, q.y, -q.z) : q);
  const fv = q => (q && Number.isFinite(q.x) ? v3(-q.x, q.y, -q.z) : q);
  const ladoA = k => [...p[k]].reverse();
  const mapa = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
  return {
    ...p, espalda: true, pelvis: f(p.pelvis), centroHombros: f(p.centroHombros), cuello: f(p.cuello), cabeza: f(p.cabeza),
    hombros: ladoA('hombros').map(f), caderas: ladoA('caderas').map(f), brazos: ladoA('brazos').map(mapa), piernas: ladoA('piernas').map(mapa),
    U: fv(p.U), L: por(fv(p.L), -1), F: fv(p.F), Lp: por(fv(p.Lp), -1), Fp: fv(p.Fp), cabezaGiro: -p.cabezaGiro,
    equipo: (p.equipo || []).map(e => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, k === 'profundidad' && !e.siempreAtras ? -v : Array.isArray(v) ? v.map(f) : typeof v === 'object' && v && 'x' in v ? f(v) : v]))),
  };
}

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Lleva un punto a la pantalla: la cámara mira de frente, inclinada "inclinacion" grados hacia abajo. z: profundidad. */
export function proyectar(q, camara = {}) {
  const p = R(camara.inclinacion || 0), z0 = camara.z0 || 0, c = Math.cos(p), s = Math.sin(p);
  return { x: q.x, y: q.y * c - (q.z - z0) * s, z: (q.z - z0) * c + q.y * s };
}
const proyectarV = (v, camara = {}) => { const p = R(camara.inclinacion || 0); return { x: v.x, y: v.y * Math.cos(p) - v.z * Math.sin(p), z: v.z * Math.cos(p) + v.y * Math.sin(p) }; };
const PUNTOS_EQUIPO = ['centro', 'a', 'b', 'desde', 'hasta'];
/** La pose en la pantalla: todos sus puntos proyectados (x, y en metros; z, la profundidad para ordenar lo que tapa). */
export function proyectarPose(p, camara = {}) {
  const P = q => (q ? proyectar(q, camara) : q), M = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, P(v)]));
  return {
    ...p, pelvis: P(p.pelvis), centroHombros: P(p.centroHombros), cuello: P(p.cuello), cabeza: P(p.cabeza),
    hombros: p.hombros.map(P), caderas: p.caderas.map(P), brazos: p.brazos.map(M), piernas: p.piernas.map(M),
    U: proyectarV(p.U, camara), L: proyectarV(p.L, camara), Lp: proyectarV(p.Lp, camara),
    equipo: (p.equipo || []).map(e => {
      const q = { ...e };
      for (const k of PUNTOS_EQUIPO) if (e[k]) q[k] = P(e[k]);
      if (e.puntos) q.puntos = e.puntos.map(P);
      const ps = [...PUNTOS_EQUIPO.map(k => q[k]), ...(q.puntos || [])].filter(Boolean);
      // La profundidad dada a mano es una z del espacio (como la de los puntos): se proyecta igual.
      const yMedio = ps.length ? ps.reduce((t, r) => t + r.y, 0) / ps.length : 0;
      q.profundidad = e.profundidad != null ? proyectar(v3(0, yMedio, e.profundidad), camara).z : ps.length ? ps.reduce((t, r) => t + r.z, 0) / ps.length : -1;
      return q;
    }),
  };
}

// ── Equipo (en tres dimensiones) ──────────────────────────────────────────────────────────────────────────────────
const mancuerna = (centro, extra = {}) => ({ tipo: 'mancuerna', centro, ...extra });
const mancuernaLarga = (centro, dir, extra = {}) => ({ tipo: 'mancuernaBarra', a: sum(centro, por(unit(dir), -0.16)), b: sum(centro, por(unit(dir), 0.16)), ...extra });
const poste = (x, z, alto, extra = {}) => ({ tipo: 'capsula', a: v3(x, 0, z), b: v3(x, alto, z), ancho: 0.06, color: 'estructura', encuadra: false, ...extra });
const cableA = (desde, hasta, extra = {}) => [{ tipo: 'cable', desde, hasta, ...extra }, { tipo: 'mango', centro: hasta, profundidad: hasta.z + 0.06 }];
const cuadro = (puntos, color = 'tapiz', extra = {}) => ({ tipo: 'poligono', puntos, color, ...extra });
/** Un rectángulo plano: centro, medio ancho por "u" y medio alto por "w" (vectores). */
const placa = (c, u, w, color = 'tapiz', extra = {}) => cuadro([sum(c, u, w), sum(c, por(u, -1), w), sum(c, por(u, -1), por(w, -1)), sum(c, u, por(w, -1))], color, extra);
const banda = (puntos, extra = {}) => ({ tipo: 'banda', puntos, ...extra });

/** Asiento de máquina visto de frente, con respaldo detrás del tronco. */
function asientoMaquina(t, alto = 0.47, { respaldo = true } = {}) {
  const items = [placa(v3(0, alto, 0.12), v3(0.21, 0, 0), v3(0, 0, 0.2), 'tapiz', { profundidad: -0.5, siempreAtras: true }), poste(0, 0.1, alto - 0.04, { profundidad: -0.6, siempreAtras: true })];
  if (respaldo) items.push(placa(sum(t.pelvis, por(t.U, 0.32), por(t.F, -0.13)), por(t.L, 0.18), por(t.U, 0.3), 'tapiz', { profundidad: -0.4 }));
  return items;
}

// ── Ritmos ────────────────────────────────────────────────────────────────────────────────────────────────────────
const RITMOS = {
  sube: [F('Sube', 1, 0, 1), F('Arriba', 0.5, 1, 1), F('Baja', 2, 1, 0), F('Abajo', 0.3, 0, 0)],
  tira: [F('Junta', 1, 0, 1), F('Aprieta', 0.5, 1, 1), F('Vuelve', 2, 1, 0), F('Estira', 0.4, 0, 0)],
  abre: [F('Abre', 1, 0, 1), F('Aprieta', 0.5, 1, 1), F('Vuelve', 2, 1, 0), F('Pausa', 0.3, 0, 0)],
  bajaSube: [F('Baja', 1.6, 0, 1), F('Abajo', 0.3, 1, 1), F('Sube', 1.2, 1, 0), F('Arriba', 0.6, 0, 0)],
  mantiene: [F('Entra', 1.2, 0, 1), F('Mantén', 3.6, 1, 1, { respira: true }), F('Sale', 1, 1, 0), F('Descansa', 0.5, 0, 0)],
  // A un lado y al otro: s = 0,25 es un lado y s = 0,75 el otro (lado = sin(2πs)).
  lados: [F('A un lado', 1.1, 0, 0.25), F('Mantén', 0.3, 0.25, 0.25), F('Al otro', 1.8, 0.25, 0.75), F('Mantén', 0.3, 0.75, 0.75), F('Vuelve', 1, 0.75, 1)],
  cambia: [F('Cambia', 1.4, 0, 0.5), F('Mantén', 0.6, 0.5, 0.5), F('Cambia', 1.4, 0.5, 1), F('Mantén', 0.6, 1, 1)],
  salta: [F('Salta', 1, 0, 1, { lineal: true })],
  patina: [F('Salta', 1.7, 0, 1, { lineal: true })],
  pasos: [F('Pasos', 3.6, 0, 1, { lineal: true })],
  golpes: [F('Toca', 2.6, 0, 1, { lineal: true })],
};
const lado = s => Math.sin(2 * Math.PI * s);

// ── Hombros ───────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Elevación lateral: los brazos suben por el costado hasta la altura de los hombros, con los codos un poco doblados y
 * un poco por delante del cuerpo. carga: 'mancuernas' o 'polea' (un brazo, con el cable cruzando desde abajo).
 * sentado: en un banco. unBrazo: solo el brazo derecho de la pantalla, la otra mano afirmada.
 */
export function elevacionLateral({ carga = 'mancuernas', sentadoEnBanco = false, unBrazo = false } = {}) {
  return {
    vista: 'frente', camara: { inclinacion: sentadoEnBanco ? 26 : 4, z0: sentadoEnBanco ? 0.42 : 0 }, fases: RITMOS.sube,
    pose(s, m) {
      const c = sentadoEnBanco ? sentado(m, { alto: 0.45, separa: 0.1 }) : dePie(m, { abiertas: 0.04, flexion: 0.01, opciones: { cabezaAdelante: 3 } });
      const ang = mix(12, 84, s); // desde la vertical
      const brazoEn = i => {
        const l = i ? 1 : -1, h = c.hombros[i];
        const dir = unit(v3(l * Math.sin(R(ang)), -Math.cos(R(ang)), 0.3 * Math.sin(R(ang)) + 0.06));
        return brazo(m, h, sum(h, por(dir, (m.brazo + m.antebrazo) * 0.965)), v3(0, 0.25 + 0.4 * s, -1));
      };
      const activo = unBrazo || carga === 'polea' ? [1] : [0, 1];
      const brazos = [0, 1].map(i => activo.includes(i) ? brazoEn(i) : unBrazo || carga === 'polea'
        ? brazo(m, c.hombros[i], sum(c.hombros[i], v3(-0.16, -0.08, 0.38)), v3(-1, -0.6, 0))
        : brazoEn(i));
      const equipo = [];
      if (sentadoEnBanco) equipo.push(placa(v3(0, 0.45, 0.06), v3(0.2, 0, 0), v3(0, 0, 0.16), 'tapiz', { profundidad: -0.5 }), poste(0, 0.06, 0.42, { profundidad: -0.6 }));
      if (carga === 'polea') {
        const polea = v3(-0.55, 0.12, -0.05);
        equipo.push(poste(-0.62, -0.08, 2.0, { profundidad: -0.8 }), ...cableA(polea, brazos[1].mano));
        brazos[0] = brazo(m, c.hombros[0], v3(-0.62 + 0.04, c.hombros[0].y - 0.12, -0.04), v3(0, -1, -0.3));
      } else {
        for (const i of activo) equipo.push(mancuerna(sum(brazos[i].mano, v3(0, 0, 0.02)), { profundidad: brazos[i].mano.z + 0.05 }));
        if (unBrazo) equipo.push(poste(-0.62, -0.08, 1.9, { profundidad: -0.8 }));
        if (unBrazo) brazos[0] = brazo(m, c.hombros[0], v3(-0.58, c.hombros[0].y - 0.1, -0.06), v3(0, -1, -0.3));
      }
      return pose(c, brazos, { equipo });
    },
  };
}

/**
 * Aperturas: los brazos se abren y se cierran por delante del pecho, con los codos apenas doblados. maquina: sentado en
 * la máquina, de frente. mancuernas: acostado en un banco, visto desde arriba. inversa: deltoide posterior (los brazos
 * van de adelante hacia los lados), visto desde atrás. polea: de pie entre las poleas.
 */
export function aperturas({ tipo = 'maquina', inversa = false } = {}) {
  const arriba = tipo === 'mancuernas';
  return {
    vista: 'frente', camara: arriba ? {} : { inclinacion: tipo === 'maquina' ? 26 : 4, z0: tipo === 'maquina' ? 0.42 : 0 }, suelo: !arriba,
    fases: inversa ? RITMOS.abre : RITMOS.tira,
    pose(s, m) {
      if (arriba) return aperturaAcostado(s, m);
      const c = tipo === 'maquina' ? sentado(m, { alto: 0.47, separa: 0.1, opciones: inversa ? { frente: Z } : {} }) : dePie(m, { abiertas: 0.08, flexion: 0.01 });
      // phi: ángulo horizontal desde el frente; abierto ~95°, cerrado con las manos al centro.
      const cerrado = inversa ? -14 : -16, abierto = inversa ? 92 : 98;
      const phi = mix(inversa ? cerrado : abierto, inversa ? abierto : cerrado, s);
      const brazos = [0, 1].map(i => {
        const l = i ? 1 : -1, h = c.hombros[i], r = (m.brazo + m.antebrazo) * 0.9;
        const mano = sum(h, v3(l * r * Math.sin(R(phi)), -0.03, r * Math.cos(R(phi))));
        return brazo(m, h, mano, v3(l * 0.3, -0.6, -0.5));
      });
      const equipo = [];
      if (tipo === 'maquina') {
        equipo.push(...asientoMaquina(c, 0.47, { respaldo: !inversa }));
        if (inversa) equipo.push(placa(sum(c.centroHombros, v3(0, -0.2, 0.17)), v3(0.16, 0, 0), v3(0, 0.22, 0), 'tapiz', { profundidad: 0.17 }));
        for (const i of [0, 1]) {
          const mn = brazos[i].mano;
          equipo.push({ tipo: 'capsula', a: sum(mn, v3(0, -0.12, 0)), b: sum(mn, v3(0, 0.12, 0)), ancho: 0.05, color: 'oscuro', profundidad: mn.z + 0.04 });
          equipo.push({ tipo: 'capsula', a: sum(mn, v3(0, 0.12, 0)), b: v3(mn.x * 0.4, 1.75, -0.05), ancho: 0.035, color: 'estructura', profundidad: -0.7, siempreAtras: true });
        }
      } else {
        const alto = inversa ? 1.65 : 1.9;
        for (const [i, x] of [[0, -0.85], [1, 0.85]]) {
          // Inversa: cada mano tira del cable que viene del otro lado.
          const desde = v3(inversa ? -x : x, alto, -0.05);
          equipo.push(poste(desde.x * 1.05, -0.1, 2.05, { profundidad: -0.9 }), ...cableA(desde, brazos[i].mano));
        }
      }
      const p = pose(c, brazos, { equipo });
      return inversa ? deEspalda(p) : p;
    },
  };
}
/** Aperturas con mancuernas acostado en un banco plano, vistas desde arriba (la cabeza hacia arriba de la pantalla). */
function aperturaAcostado(s, m) {
  const a = anchos(m), pelvis = v3(0, 0, 0.12);
  const t = tronco(m, pelvis, { arriba: Y, frente: Z });
  const piernas = [-1, 1].map((l, i) => pierna(m, t.caderas[i], v3(l * 0.3, -0.62, -0.36), { rodilla: v3(l * 0.3, 0, 1), pie: v3(l * 0.2, -0.6, 0), abajo: v3(0, 0, -1) }));
  const phi = mix(98, 10, s); // desde el frente (hacia la cámara): 98° es abajo y afuera
  const brazos = [0, 1].map(i => {
    const l = i ? 1 : -1, h = t.hombros[i], r = (m.brazo + m.antebrazo) * 0.9;
    const mano = sum(h, v3(l * r * Math.sin(R(phi)) - l * 0.05 * (1 - s), -0.05, r * Math.cos(R(phi))));
    return brazo(m, h, mano, v3(l * 0.3, -0.7, -0.4));
  });
  const equipo = [
    placa(v3(0, 0.26, 0.04), v3(0.15, 0, 0), v3(0, 0.62, 0), 'tapiz', { profundidad: -0.2 }),
    ...[0, 1].map(i => mancuernaLarga(brazos[i].mano, Y, { profundidad: brazos[i].mano.z + 0.06 })),
  ];
  return pose({ ...t, piernas }, brazos, { equipo });
}

/** Separación de banda: brazos estirados al frente a la altura de los hombros que se abren hasta formar una T. */
export function separacionBanda() {
  return {
    vista: 'frente', camara: { inclinacion: 4 }, fases: RITMOS.abre,
    pose(s, m) {
      const c = dePie(m, { abiertas: 0.05, flexion: 0.01 });
      const phi = mix(6, 88, s);
      const brazos = [0, 1].map(i => {
        const l = i ? 1 : -1, h = c.hombros[i], r = (m.brazo + m.antebrazo) * 0.97;
        return brazo(m, h, sum(h, v3(l * r * Math.sin(R(phi)), -0.02, r * Math.cos(R(phi)))), v3(0, -1, 0));
      });
      return pose(c, brazos, { equipo: [banda([brazos[0].mano, brazos[1].mano], { profundidad: Math.max(brazos[0].mano.z, brazos[1].mano.z) + 0.02 })] });
    },
  };
}

/** Rotación externa con banda: codo pegado al cuerpo a 90°, el antebrazo gira hacia afuera (brazo derecho de la pantalla). */
export function rotacionExterna() {
  return {
    vista: 'frente', camara: { inclinacion: 24 }, fases: RITMOS.abre,
    pose(s, m) {
      const c = dePie(m, { abiertas: 0.05, flexion: 0.01 });
      const h = c.hombros[1], codo = sum(h, v3(0.03, -m.brazo * 0.99, 0.04));
      const beta = mix(-58, 62, s); // desde el frente, positivo hacia afuera
      const der = { hombro: h, codo, mano: sum(codo, por(v3(Math.sin(R(beta)), 0.02, Math.cos(R(beta))), m.antebrazo)) };
      const izq = brazo(m, c.hombros[0], sum(c.hombros[0], v3(-0.04, -(m.brazo + m.antebrazo) * 0.96, 0.05)), v3(-0.2, 0, -1));
      const ancla = v3(-0.85, codo.y, 0.1);
      return pose(c, [izq, der], { equipo: [poste(-0.9, 0.1, 1.5, { profundidad: -0.3 }), banda([ancla, der.mano], { profundidad: der.mano.z + 0.02 })] });
    },
  };
}

// ── Cadera ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Una pierna por direcciones (muslo, pierna y pie), a sus largos exactos; el pie apoya hacia "abajo". */
function piernaDir(m, cadera, dirMuslo, dirPierna, dirPie, abajo = v3(0, -1, 0)) {
  const rodilla = sum(cadera, por(unit(dirMuslo), m.muslo)), tobillo = sum(rodilla, por(unit(dirPierna), m.pierna));
  const pie = unit(dirPie), base = sum(tobillo, por(unit(abajo), m.tobillo * 0.92));
  return { cadera, rodilla, tobillo, talon: sum(base, por(pie, -0.05)), punta: sum(base, por(pie, m.pie * 0.72)) };
}

/**
 * Abductora (los muslos se abren contra las almohadillas, que van por fuera de las rodillas) o aductora (se juntan
 * contra las almohadillas de adentro), sentado en la máquina. Como en la máquina real: cada muslo gira hacia afuera
 * desde la cadera, la pierna cuelga vertical y el pie va en su apoyo, que se mueve con la pierna.
 */
export function abductora({ aductora = false } = {}) {
  return {
    vista: 'frente', camara: { inclinacion: 28, z0: 0.42 }, fases: aductora ? RITMOS.tira : RITMOS.abre,
    pose(s, m) {
      const ang = aductora ? mix(40, 6, s) : mix(6, 40, s); // cada muslo hacia afuera, desde el frente
      const c = sentado(m, { alto: 0.5, separa: 0.05, opciones: { arriba: v3(0, 1, -0.16) } });
      const piernas = [0, 1].map(i => {
        const l = i ? 1 : -1, abre = v3(l * Math.sin(R(ang)), -0.06, Math.cos(R(ang)));
        return piernaDir(m, c.caderas[i], abre, v3(0, -1, 0.06), v3(l * 0.5 * Math.sin(R(ang)), 0, 1));
      });
      const brazos = [0, 1].map(i => {
        const l = i ? 1 : -1, h = c.hombros[i];
        return brazo(m, h, v3(h.x + l * 0.1, 0.52, 0.05), v3(l, -0.3, -0.2)); // manos en las manillas del asiento
      });
      const equipo = [...asientoMaquina(c, 0.5)];
      for (const i of [0, 1]) {
        const l = i ? 1 : -1, pi = piernas[i];
        // La almohadilla toca la rodilla por fuera (abductora) o por dentro (aductora), y baja con su brazo al apoyo del pie.
        const fuera = v3(l * Math.cos(R(ang)), 0, -Math.sin(R(ang))), lado = aductora ? -1 : 1;
        const centro = sum(pi.rodilla, por(unit(dif(pi.cadera, pi.rodilla)), 0.06), por(fuera, lado * 0.085));
        equipo.push({ tipo: 'capsula', a: sum(centro, v3(0, 0.09, 0)), b: sum(centro, v3(0, -0.07, 0)), ancho: 0.065, color: 'oscuro', profundidad: centro.z + 0.03 });
        const apoyo = sum(pi.tobillo, v3(0, -m.tobillo - 0.01, 0.02));
        equipo.push({ tipo: 'capsula', a: sum(centro, v3(0, -0.07, 0)), b: sum(apoyo, por(fuera, lado * 0.07)), ancho: 0.025, color: 'estructura', profundidad: centro.z - 0.05 });
        equipo.push({ tipo: 'capsula', a: sum(apoyo, por(fuera, -0.05)), b: sum(apoyo, por(fuera, 0.07), v3(0, 0, 0.1)), ancho: 0.03, color: 'estructura', profundidad: pi.tobillo.z - 0.02 });
        equipo.push({ tipo: 'mango', centro: brazos[i].mano, profundidad: brazos[i].mano.z + 0.04 });
      }
      return pose({ ...c, piernas }, brazos, { equipo });
    },
  };
}

/** Abducción de pie en máquina: de pie sobre una pierna, la otra va hacia el lado contra la almohadilla. */
export function abduccionDePie() {
  return {
    vista: 'frente', camara: { inclinacion: 4 }, fases: RITMOS.abre,
    pose(s, m) {
      const a = anchos(m), ang = mix(4, 38, s);
      const pelvis = v3(-0.02 * s, altoPelvis(m, 0.02, 0.01), 0);
      const t = tronco(m, pelvis, { inclina: -6 * s });
      const apoyo = pierna(m, t.caderas[0], v3(-(a.cadera + 0.02), m.tobillo, 0.02), { rodilla: v3(-0.15, 0, 1), pie: v3(-0.18, 0, 1) });
      const libre = t.caderas[1], dir = v3(Math.sin(R(ang)), -Math.cos(R(ang)), 0.02);
      const movil = pierna(m, libre, sum(libre, por(dir, m.muslo + m.pierna - 0.006)), { rodilla: v3(0.1, 0, 1), pie: v3(0.18, 0, 1), abajo: dir });
      const brazos = [0, 1].map(i => {
        const h = t.hombros[i];
        return i ? brazo(m, h, v3(0.62, 1.12, 0.02), v3(0.2, -1, -0.6)) : brazo(m, h, sum(t.caderas[0], v3(-0.1, 0.06, 0.05)), v3(-1, 0, -0.3));
      });
      // La palanca gira desde la altura de la cadera: su almohadilla toca el muslo por fuera, sobre la rodilla.
      const pivote = v3(libre.x + 0.07, libre.y, -0.08), almohadilla = sum(movil.rodilla, v3(0.07 * Math.cos(R(ang)), 0.12 + 0.07 * Math.sin(R(ang)), 0));
      const equipo = [
        poste(0.68, -0.12, 1.5, { profundidad: -0.8 }), { tipo: 'capsula', a: v3(0.68, 1.12, -0.06), b: v3(0.62, 1.12, 0.02), ancho: 0.035, color: 'estructura', profundidad: -0.1 },
        { tipo: 'capsula', a: pivote, b: almohadilla, ancho: 0.035, color: 'estructura', profundidad: -0.05 },
        { tipo: 'capsula', a: sum(almohadilla, v3(0, 0.06, 0.02)), b: sum(almohadilla, v3(0, -0.06, 0.02)), ancho: 0.06, color: 'oscuro', profundidad: movil.rodilla.z + 0.05 },
        { tipo: 'mango', centro: brazos[1].mano, profundidad: brazos[1].mano.z + 0.04 },
      ];
      return pose({ ...t, piernas: [apoyo, movil] }, brazos, { equipo });
    },
  };
}

/** Caminata lateral con banda: medio sentadilla, dos pasos hacia un lado y dos de vuelta, con la banda sobre las rodillas. */
export function caminataLateral() {
  return {
    vista: 'frente', camara: { inclinacion: 6 }, fases: RITMOS.pasos,
    pose(s, m) {
      const a = anchos(m), paso = 0.2, base = 0.07;
      // Cuatro tiempos por paso: abre la pierna que guía, la apoya, trae la otra y la apoya.
      const n = s * 4, k = Math.floor(Math.min(n, 3.999)), f = n - k, dir = k < 2 ? 1 : -1;
      const inicio = [0, paso, 2 * paso, paso][k];
      const ab = suave(Math.min(1, f * 2)), cierra = suave(Math.max(0, f * 2 - 1));
      const guia = dir > 0 ? 1 : 0, sigue = 1 - guia;
      const pies = [0, 0];
      pies[guia] = inicio + dir * (paso * ab);
      pies[sigue] = inicio + dir * (paso * cierra);
      const levanta = i => (i === guia ? Math.sin(Math.PI * Math.min(1, f * 2)) : Math.sin(Math.PI * Math.max(0, f * 2 - 1))) * 0.05;
      const centro = (pies[0] + pies[1]) / 2;
      const pelvis = v3(centro, altoPelvis(m, base + paso / 4, 0.14) + 0.01, -0.06);
      const t = tronco(m, pelvis, { arriba: v3(0, 1, 0.22) });
      const piernas = [0, 1].map(i => {
        const l = i ? 1 : -1, x = pies[i] + l * (a.cadera + base);
        return pierna(m, t.caderas[i], v3(x, m.tobillo + levanta(i), 0.06), { rodilla: v3(l * 0.25, 0, 1), pie: v3(l * 0.2, 0, 1) });
      });
      const brazos = [0, 1].map(i => brazo(m, t.hombros[i], sum(t.centroHombros, v3((i ? 1 : -1) * 0.07, -0.3, 0.28)), v3(i ? 1 : -1, -0.5, 0)));
      const sobre = i => mezcla(piernas[i].rodilla, piernas[i].tobillo, 0.25);
      return pose({ ...t, piernas }, brazos, { equipo: [banda([sobre(0), sobre(1)], { profundidad: Math.max(sobre(0).z, sobre(1).z) + 0.03 })] });
    },
  };
}

// ── Tronco ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Plancha lateral sobre el antebrazo, de frente a la cámara: el cuerpo en línea de los tobillos a la cabeza.
 * elevacion: la cadera baja casi al suelo y vuelve a subir; si no, sube una vez y se mantiene respirando.
 */
export function planchaLateral({ elevacion = false } = {}) {
  return {
    vista: 'frente', camara: {}, fases: elevacion ? RITMOS.bajaSube : RITMOS.mantiene,
    pose(s, m, fase, enFase = 0) {
      const a = anchos(m), largoPierna = m.muslo + m.pierna - 0.006;
      // s: con elevación, 0 arriba y 1 abajo; si se mantiene, 0 abajo y 1 arriba.
      const arriba = elevacion ? 1 - s : s;
      const resp = fase?.respira ? Math.sin(enFase * Math.PI * 2) * 0.004 : 0;
      // Tobillos apilados y quietos a la izquierda; el codo de abajo, bajo su hombro, a la derecha.
      const tobillos = [v3(-0.92, 0.055 + 0.1, 0), v3(-0.92, 0.055, 0)];
      const altoHombro = 0.035 + m.brazo, largoCuerpo = largoPierna + m.tronco;
      const xHombro = tobillos[1].x + Math.sqrt(largoCuerpo ** 2 - (altoHombro - tobillos[1].y) ** 2);
      const hombroAbajo = v3(xHombro, altoHombro, 0), codo = v3(xHombro, 0.035, 0.03);
      // La cadera de abajo gira alrededor de su tobillo: recta en la línea del cuerpo, o casi en el suelo.
      const recta = Math.atan2(altoHombro - tobillos[1].y, xHombro - tobillos[1].x), baja = Math.asin(0.03 / largoPierna);
      const th = mix(baja, recta, arriba) + resp;
      const caderaAbajo = sum(tobillos[1], v3(Math.cos(th) * largoPierna, Math.sin(th) * largoPierna, 0));
      const pelvis = sum(caderaAbajo, v3(-Math.sin(th) * a.cadera, Math.cos(th) * a.cadera, 0));
      // La columna va de la pelvis hacia el centro de los hombros, que queda un ancho de hombro por sobre el de abajo.
      const desvio = Math.atan2(a.hombro, m.tronco - 0.012) * 180 / Math.PI;
      const U = girar(unit(dif(hombroAbajo, pelvis)), Z, desvio);
      const t0 = tronco(m, pelvis, { arriba: U, frente: Z });
      const t = tronco(m, sum(pelvis, dif(hombroAbajo, t0.hombros[1])), { arriba: U, frente: Z });
      const piernas = [0, 1].map(i => pierna(m, t.caderas[i], tobillos[i], { rodilla: Z, pie: v3(0, 0, 1), abajo: girar(unit(dif(tobillos[i], t.caderas[i])), Z, -90) }));
      const debajo = { hombro: t.hombros[1], codo, mano: sum(codo, v3(-0.02, 0, m.antebrazo)) };
      const haciaArriba = girar(U, Z, 90);
      const encima = brazo(m, t.hombros[0], sum(t.caderas[0], por(haciaArriba, 0.06), por(U, 0.05), v3(0, 0, 0.05)), sum(haciaArriba, v3(0, 0, 0.6)));
      return pose(t, [encima, debajo], { piernas, equipo: [cuadro([v3(-1.15, 0, -0.3), v3(xHombro + 0.3, 0, -0.3), v3(xHombro + 0.3, 0.02, -0.3), v3(-1.15, 0.02, -0.3)], 'banda', { profundidad: -1, encuadra: false, opacidad: 0.35 })] });
    },
  };
}

/** Toques de talón: acostado, rodillas dobladas y hombros un poco arriba; el tronco se inclina para tocar cada talón (desde arriba). */
export function toquesTalon() {
  return {
    vista: 'frente', camara: {}, suelo: false, fases: RITMOS.golpes,
    pose(s, m) {
      const inc = 22 * lado(s);
      const pelvis = v3(0, 0, 0.1);
      const t = tronco(m, pelvis, { arriba: v3(0, 1, 0.4), frente: Z, inclina: inc, cabezaAdelante: 14 });
      const piernas = [-1, 1].map((l, i) => pierna(m, t.caderas[i], v3(l * 0.19, -0.34, 0.07), { rodilla: v3(l * 0.12, 0, 1), pie: v3(0, -1, 0), abajo: v3(0, 0, -1) }));
      const brazos = [0, 1].map(i => {
        const l = i ? 1 : -1, h = t.hombros[i], alcanza = Math.max(0, l * lado(s));
        const mano = mezcla(sum(h, v3(l * 0.12, -0.55, 0.06)), sum(piernas[i].talon, v3(l * 0.07, 0.05, 0.03)), alcanza);
        return brazo(m, h, mano, v3(l, 0, 0.4));
      });
      return pose({ ...t, piernas }, brazos, { equipo: [placa(v3(0, -0.05, -0.02), v3(0.4, 0, 0), v3(0, 0.95, 0), 'banda', { profundidad: -1, encuadra: false, opacidad: 0.35 })] });
    },
  };
}

/**
 * Giro con el tronco y los brazos estirados. tipo: 'polea' (horizontal, a la altura del pecho), 'lenador' (en diagonal,
 * de arriba hacia abajo), 'ruso' (sentado en el suelo, inclinado hacia atrás, con un disco).
 */
export function giro({ tipo = 'polea' } = {}) {
  const ruso = tipo === 'ruso';
  return {
    vista: 'frente', camara: ruso ? { inclinacion: 30, z0: 0.3 } : { inclinacion: 4 },
    fases: ruso ? RITMOS.lados : RITMOS.tira,
    pose(s, m) {
      if (ruso) return giroRuso(s, m);
      const diagonal = tipo === 'lenador';
      const g = diagonal ? mix(38, -34, s) : mix(42, -42, s);
      const flex = diagonal ? 0.02 + 0.06 * s : 0.03;
      const c = dePie(m, { abiertas: 0.14, flexion: flex, opciones: { giro: g, giroPelvis: g * 0.35, inclina: diagonal ? mix(-4, 8, s) : 0 } });
      const centro = c.centroHombros;
      const dirMano = diagonal
        ? unit(sum(por(c.F, 1), v3(0, mix(0.55, -0.95, s), 0)))
        : unit(sum(por(c.F, 1), v3(0, -0.12, 0)));
      const manos = sum(centro, por(dirMano, (m.brazo + m.antebrazo) * 0.9));
      const brazos = [0, 1].map(i => brazo(m, c.hombros[i], sum(manos, por(c.L, (i ? 1 : -1) * 0.025)), v3(i ? 1 : -1, -0.6, -0.2)));
      const polea = diagonal ? v3(0.95, 2.05, -0.1) : v3(0.95, 1.25, -0.1);
      return pose(c, brazos, { equipo: [poste(1.0, -0.12, 2.15, { profundidad: -0.9 }), ...cableA(polea, manos)] });
    },
  };
}
function giroRuso(s, m) {
  const a = anchos(m), g = 40 * lado(s);
  const pelvis = v3(0, 0.12, 0);
  const t = tronco(m, pelvis, { arriba: v3(0, Math.cos(R(42)), -Math.sin(R(42))), frente: Z, giro: g, cabezaAdelante: 18 });
  const piernas = [-1, 1].map((l, i) => pierna(m, t.caderas[i], v3(l * 0.13, m.tobillo, 0.66), { rodilla: v3(l * 0.15, 1, 0.3), pie: v3(l * 0.12, 0, 1) }));
  // El disco va frente al ombligo, entre el tronco y las rodillas, y gira con el tronco.
  const adelante = girar(Z, Y, g), manos = sum(t.pelvis, por(t.U, 0.3), por(adelante, 0.36));
  const brazos = [0, 1].map(i => brazo(m, t.hombros[i], sum(manos, por(girar(X, Y, g), (i ? 1 : -1) * 0.07)), v3(i ? 1 : -1, -0.8, 0)));
  return pose({ ...t, piernas }, brazos, { equipo: [{ tipo: 'disco', centro: sum(manos, por(adelante, 0.03)), r: 0.11, profundidad: manos.z + 0.08 }] });
}

/** Vuelta al mundo: acostado en el banco, brazos casi estirados que llevan las mancuernas de los muslos a sobre la cabeza por los lados (desde arriba). */
export function vueltaAlMundo() {
  return {
    vista: 'frente', camara: {}, suelo: false, fases: [F('Sube', 2, 0, 1), F('Arriba', 0.4, 1, 1), F('Vuelve', 2, 1, 0), F('Abajo', 0.4, 0, 0)],
    pose(s, m) {
      const pelvis = v3(0, 0, 0.12);
      const t = tronco(m, pelvis, { arriba: Y, frente: Z });
      const piernas = [-1, 1].map((l, i) => pierna(m, t.caderas[i], v3(l * 0.3, -0.62, -0.36), { rodilla: v3(l * 0.3, 0, 1), pie: v3(l * 0.2, -0.6, 0), abajo: v3(0, 0, -1) }));
      const psi = mix(168, 8, suave(s)); // desde arriba de la cabeza (0°) hasta los muslos (180°), por el lado
      const brazos = [0, 1].map(i => {
        const l = i ? 1 : -1, h = t.hombros[i], r = (m.brazo + m.antebrazo) * 0.95;
        return brazo(m, h, sum(h, v3(l * r * Math.sin(R(psi)), r * Math.cos(R(psi)), 0.05)), v3(l * 0.2, 0, 1));
      });
      const equipo = [placa(v3(0, 0.26, 0.04), v3(0.15, 0, 0), v3(0, 0.62, 0), 'tapiz', { profundidad: -0.2 }),
        ...[0, 1].map(i => mancuerna(brazos[i].mano, { profundidad: brazos[i].mano.z + 0.06 }))];
      return pose({ ...t, piernas }, brazos, { equipo });
    },
  };
}

// ── Saltos ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Saltos de tijera: abre piernas y brazos sobre la cabeza y vuelve, con un salto corto en cada cambio. */
export function saltosTijera() {
  return {
    vista: 'frente', camara: { inclinacion: 3 }, fases: RITMOS.salta,
    pose(s, m) {
      const a = anchos(m), abre = Math.sin(Math.PI * s) ** 2; // 0 juntos, 1 abiertos (a mitad del ciclo)
      const vuelo = Math.abs(Math.sin(2 * Math.PI * s)) * 0.06, flex = 0.04 * (1 - Math.abs(Math.sin(2 * Math.PI * s)));
      const dx = mix(0.02, 0.27, abre);
      const pelvis = v3(0, altoPelvis(m, dx, flex) + vuelo, 0);
      const t = tronco(m, pelvis, {});
      const piernas = [-1, 1].map((l, i) => pierna(m, t.caderas[i], v3(l * (a.cadera + dx), m.tobillo + vuelo, 0.02), { rodilla: v3(l * 0.2, 0, 1), pie: v3(l * 0.25, 0, 1) }));
      const ang = mix(14, 168, abre);
      const brazos = [0, 1].map(i => {
        const l = i ? 1 : -1, h = t.hombros[i];
        return brazoDir(m, h, v3(l * Math.sin(R(ang)), -Math.cos(R(ang)), 0.05), v3(l * Math.sin(R(ang + 10)), -Math.cos(R(ang + 10)), 0.05));
      });
      return pose({ ...t, piernas }, brazos);
    },
  };
}

/** Saltos de patinador: de una pierna a la otra hacia el costado; la pierna libre cruza por detrás. */
export function patinador() {
  return {
    vista: 'frente', camara: { inclinacion: 4 }, fases: RITMOS.patina,
    pose(s, m) {
      // Cada mitad: apoyado en la pierna de afuera (la otra cruza por detrás) y luego el salto al otro lado.
      const ida = s < 0.5, f = ida ? s * 2 : (s - 0.5) * 2;
      const apoyo = ida ? 0 : 1, libre = 1 - apoyo, ls = apoyo ? 1 : -1;
      const vuela = f < 0.55 ? 0 : (f - 0.55) / 0.45;
      const cruza = vuela ? 1 - suave(Math.min(1, vuela * 2)) : suave(Math.min(1, f / 0.3));
      const desde = ls * 0.42, x = mix(desde, -desde, suave(vuela)), alto = Math.sin(Math.PI * vuela) * 0.15;
      const flex = 0.12 - 0.07 * Math.sin(Math.PI * vuela) - 0.03 * (1 - cruza);
      const pelvis = v3(x, altoPelvis(m, 0.03, flex) + alto, -0.06);
      const t = tronco(m, pelvis, { arriba: v3(0, 1, 0.32), giro: -ls * 12 * cruza, inclina: ls * 4 * cruza });
      const piernas = [0, 1].map(i => {
        const l = i ? 1 : -1, debajo = v3(t.caderas[i].x + l * 0.03, m.tobillo + alto, 0.04);
        if (i === apoyo) return pierna(m, t.caderas[i], debajo, { rodilla: v3(l * 0.1, 0, 1), pie: v3(l * 0.12, 0, 1) });
        const detras = v3(t.caderas[apoyo].x + ls * 0.14, m.tobillo + 0.13 + alto, -0.4);
        return pierna(m, t.caderas[i], mezcla(debajo, detras, cruza), { rodilla: v3(l * 0.2, 0, 1), pie: mezcla(v3(l * 0.12, 0, 1), v3(ls * 0.4, 0, 0.3), cruza), abajo: v3(0, -1, -0.3 * cruza) });
      });
      // Los brazos acompañan: el del lado libre cruza por delante y el del apoyo va atrás.
      const brazos = [0, 1].map(i => {
        const l = i ? 1 : -1, h = t.hombros[i], adelante = i === libre ? cruza : -cruza;
        const mano = sum(h, v3(i === libre ? -l * 0.25 * cruza + l * 0.08 * (1 - cruza) : l * (0.08 + 0.1 * cruza), -0.5 + 0.08 * Math.abs(adelante), 0.08 + 0.42 * adelante));
        return brazo(m, h, mano, v3(l * 0.5, -0.4, -0.6));
      });
      return pose({ ...t, piernas }, brazos);
    },
  };
}

// ── Calentamiento y estiramientos ─────────────────────────────────────────────────────────────────────────────────
export const PASOS_FRENTE = {
  /** Movilidad torácica sentado: manos en la nuca y el pecho gira a cada lado con la cadera quieta. */
  toracica: () => ({
    vista: 'frente', camara: { inclinacion: 24, z0: 0.42 }, fases: RITMOS.lados,
    pose(s, m) {
      const c = sentado(m, { alto: 0.45, separa: 0.1, opciones: { giro: 38 * lado(s) } });
      const nuca = sum(c.cabeza, por(c.F, -0.09), por(c.U, 0.0));
      const brazos = [0, 1].map(i => brazo(m, c.hombros[i], sum(nuca, por(c.L, (i ? 1 : -1) * 0.05)), sum(por(c.L, i ? 1 : -1), por(c.U, 0.5))));
      return pose(c, brazos, { equipo: [placa(v3(0, 0.45, 0.06), v3(0.22, 0, 0), v3(0, 0, 0.18), 'tapiz', { profundidad: -0.5 }), poste(0, 0.06, 0.42, { profundidad: -0.6 })] });
    },
  }),
  /** 90/90 de cadera: sentado en el suelo, pies quietos y bien separados; las dos rodillas caen a un lado y luego al otro. */
  cadera9090: () => ({
    vista: 'frente', camara: { inclinacion: 34, z0: 0.25 }, suelo: false, fases: RITMOS.cambia,
    pose(s, m) {
      const a = anchos(m), psi = 72 * Math.cos(2 * Math.PI * s);
      const pelvis = v3(0, 0.11, 0);
      const t = tronco(m, pelvis, { arriba: v3(0, 1, -0.08), giro: psi * 0.25 });
      const piernas = [-1, 1].map((l, i) => {
        const cad = t.caderas[i], pie = v3(l * 0.5, m.tobillo * 0.6, 0.32);
        // La rodilla gira alrededor de la línea cadera a pie: hacia arriba (0°) o caída a un lado.
        const eje = unit(dif(pie, cad)), d = largo3(dif(pie, cad));
        const ac = (m.muslo ** 2 + d * d - m.pierna ** 2) / (2 * d), h = Math.sqrt(Math.max(0, m.muslo ** 2 - ac * ac));
        const e1 = unit(dif(Y, por(eje, prod(Y, eje)))), e2b = unit(cruz(eje, e1)), e2 = e2b.x < 0 ? por(e2b, -1) : e2b;
        const dirRodilla = sum(por(e1, Math.cos(R(psi))), por(e2, Math.sin(R(psi))));
        return pierna(m, cad, pie, { rodilla: dirRodilla, pie: v3(l * 0.6, 0, 0.6), abajo: v3(0, -1, 0) });
      });
      const brazos = [0, 1].map(i => brazo(m, t.hombros[i], sum(t.caderas[i], v3((i ? 1 : -1) * 0.12, -0.08, -0.22)), v3(i ? 1 : -1, 0, 0.4)));
      return pose({ ...t, piernas }, brazos, { equipo: [cuadro([v3(-0.85, 0, -0.45), v3(0.85, 0, -0.45), v3(0.85, 0, 0.75), v3(-0.85, 0, 0.75)], 'banda', { profundidad: -2, encuadra: false, opacidad: 0.35 })] });
    },
  }),
  /** Rotación externa con banda: codo pegado al cuerpo a 90°, el antebrazo gira hacia afuera. */
  rotacionExterna: () => rotacionExterna(),
  /** Aductores en mariposa: sentado en el suelo, plantas juntas, las rodillas bajan hacia los lados y las manos toman los pies. */
  mariposa: () => ({
    vista: 'frente', camara: { inclinacion: 30, z0: 0.25 }, suelo: false, fases: RITMOS.mantiene,
    pose(s, m, fase, enFase = 0) {
      const resp = fase?.respira ? Math.sin(enFase * Math.PI * 2) * 0.015 : 0;
      const baja = mix(0, 1, s) + resp; // 0: rodillas arriba; 1: abiertas hacia el suelo
      const pelvis = v3(0, 0.11, 0);
      const t = tronco(m, pelvis, { arriba: v3(0, 1, mix(0.05, 0.28, s)), cabezaAdelante: mix(0, 8, s) });
      const piernas = [0, 1].map(i => {
        const l = i ? 1 : -1, tobillo = v3(l * 0.07, m.tobillo * 0.8, 0.36);
        return pierna(m, t.caderas[i], tobillo, { rodilla: v3(l, mix(0.9, 0.15, baja), 0.1), pie: v3(-l, 0, 0.3), abajo: v3(l * 0.6, -1, 0) });
      });
      const brazos = [0, 1].map(i => brazo(m, t.hombros[i], sum(piernas[i].tobillo, v3(0, 0.05, 0.06)), v3(i ? 1 : -1, -0.2, -0.2)));
      return pose({ ...t, piernas }, brazos, { equipo: [cuadro([v3(-0.75, 0, -0.4), v3(0.75, 0, -0.4), v3(0.75, 0, 0.75), v3(-0.75, 0, 0.75)], 'banda', { profundidad: -2, encuadra: false, opacidad: 0.35 })] });
    },
  }),
  /** Cuello y trapecio: sentado, la cabeza se inclina hacia un hombro con la mano encima, y luego al otro lado. */
  cuelloTrapecio: () => ({
    vista: 'frente', camara: { inclinacion: 24, z0: 0.42 }, fases: RITMOS.lados,
    pose(s, m) {
      const inc = 26 * lado(s);
      const c = sentado(m, { alto: 0.45, separa: 0.1, opciones: { cabezaInclina: inc } });
      const brazos = [0, 1].map(i => {
        const l = i ? 1 : -1, h = c.hombros[i], activa = Math.max(0, l * lado(s));
        const enMuslo = sum(c.piernas[i].rodilla, v3(0, 0.07, -0.1));
        const sobreCabeza = sum(c.cabeza, v3(-l * 0.02, m.cabeza * 0.85, 0.02));
        return brazo(m, h, mezcla(enMuslo, sobreCabeza, Math.min(1, activa * 1.4)), v3(l, -0.2 + activa, -0.2));
      });
      return pose(c, brazos, { equipo: [placa(v3(0, 0.45, 0.06), v3(0.22, 0, 0), v3(0, 0, 0.18), 'tapiz', { profundidad: -0.5 }), poste(0, 0.06, 0.42, { profundidad: -0.6 })] });
    },
  }),
  /** Movilidad de cuello: sentado y erguido, la cabeza gira unos 30° a cada lado con el tronco quieto. */
  cuello: () => ({
    vista: 'frente', camara: { inclinacion: 24, z0: 0.42 }, fases: RITMOS.lados,
    pose(s, m) {
      const c = sentado(m, { alto: 0.45, separa: 0.1, opciones: { cabezaGiro: 32 * lado(s) } });
      const brazos = [0, 1].map(i => brazo(m, c.hombros[i], sum(c.piernas[i].rodilla, v3(0, 0.07, -0.12)), v3(i ? 1 : -1, -0.2, -0.2)));
      return pose(c, brazos, { equipo: [placa(v3(0, 0.45, 0.06), v3(0.22, 0, 0), v3(0, 0, 0.18), 'tapiz', { profundidad: -0.5 }), poste(0, 0.06, 0.42, { profundidad: -0.6 })] });
    },
  }),
};

/** Los ejercicios del catálogo que se ven de frente. */
export const FRENTE = {
  elevaciones_laterales: () => elevacionLateral(), elevaciones_laterales_sentado: () => elevacionLateral({ sentadoEnBanco: true }),
  elevaciones_laterales_polea: () => elevacionLateral({ carga: 'polea' }), elevacion_lateral_un_brazo: () => elevacionLateral({ unBrazo: true }),
  aperturas_maquina: () => aperturas(), aperturas_mancuernas: () => aperturas({ tipo: 'mancuernas' }),
  posterior_maquina: () => aperturas({ inversa: true }), posterior_polea: () => aperturas({ tipo: 'polea', inversa: true }),
  separacion_banda: () => separacionBanda(), abductora: () => abductora(), aductora: () => abductora({ aductora: true }),
  abductor_de_pie: () => abduccionDePie(), caminata_lateral_banda: () => caminataLateral(),
  plancha_lateral: () => planchaLateral(), plancha_lateral_elevacion: () => planchaLateral({ elevacion: true }),
  toques_talon: () => toquesTalon(), giro_polea: () => giro(), lenador: () => giro({ tipo: 'lenador' }), giro_ruso: () => giro({ tipo: 'ruso' }),
  vuelta_al_mundo: () => vueltaAlMundo(), saltos_tijera: () => saltosTijera(), patinador: () => patinador(),
};
