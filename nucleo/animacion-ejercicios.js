// Animación de ejercicios hecha con código: una figura humana vista de lado que se mueve por los ángulos de sus
// articulaciones. Las reglas de la técnica (pies quietos, barra subiendo y bajando sobre la mitad del pie) se cumplen
// por cálculo, no a ojo. Quien dibuja (la app o una página de prueba) solo pinta lo que esto devuelve.
// Unidades: metros. x hacia adelante, y hacia arriba; el suelo en y = 0 y el tobillo sobre x = 0.

// Largo de cada segmento como fracción de la estatura (Winter, Biomechanics and Motor Control of Human Movement).
// cabeza es el radio de la cabeza; tobillo, la altura del tobillo sobre el suelo.
export const PROPORCIONES = {
  tobillo: 0.039, pierna: 0.246, muslo: 0.245, tronco: 0.288, cuello: 0.052, cabeza: 0.062, brazo: 0.186, antebrazo: 0.146, pie: 0.152,
};
export const medidas = (estatura = 1.75) => Object.fromEntries(Object.entries(PROPORCIONES).map(([k, v]) => [k, v * estatura]));

export const rad = g => (g * Math.PI) / 180;
export const grados = r => (r * 180) / Math.PI;
export const entre = (a, b, t) => a + (b - a) * t;
/** Un punto a cierta distancia de otro, con el ángulo medido desde la vertical (positivo hacia adelante). */
export const desde = (o, largo, angulo) => ({ x: o.x + largo * Math.sin(angulo), y: o.y + largo * Math.cos(angulo) });
/** Aceleración y frenado suaves, como un movimiento controlado. */
export const suave = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Cinemática inversa de dos segmentos (brazo y antebrazo, muslo y pierna): dónde queda la articulación del medio para
 * que el extremo llegue al objetivo. lado = 1 o -1 elige hacia dónde se dobla.
 */
export function dosSegmentos(origen, objetivo, l1, l2, lado = 1) {
  const dx = objetivo.x - origen.x, dy = objetivo.y - origen.y;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6);
  const giro = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const a = Math.atan2(dy, dx) + lado * giro;
  return { x: origen.x + l1 * Math.cos(a), y: origen.y + l1 * Math.sin(a) };
}

/** Busca el valor de x en [a, b] que deja f(x) en cero (f creciente o decreciente, sin saltos). */
export function raiz(f, a, b, pasos = 48) {
  let fa = f(a);
  for (let i = 0; i < pasos; i++) {
    const m = (a + b) / 2, fm = f(m);
    if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

/** Disco de 20 kg: 45 cm de diámetro. */
export const RADIO_DISCO = 0.225;

/**
 * Sentadilla con barra alta, vista de lado. s va de 0 (de pie) a 1 (abajo, con el muslo bajo la horizontal).
 * La rodilla y la cadera se doblan juntas; el tronco se inclina lo justo para que la barra quede sobre la mitad del pie.
 */
export const SENTADILLA_BARRA = {
  id: 'sentadilla_barra',
  nombre: 'Sentadilla con barra',
  // Ritmo de una repetición: bajar en 2 s, una pausa corta abajo, subir en 1,2 s y respirar arriba.
  fases: [
    { nombre: 'Baja', seg: 2, de: 0, a: 1 },
    { nombre: 'Abajo', seg: 0.3, de: 1, a: 1 },
    { nombre: 'Sube', seg: 1.2, de: 1, a: 0 },
    { nombre: 'Arriba', seg: 0.8, de: 0, a: 0 },
  ],
  pose(s, m = medidas()) {
    const talon = { x: -0.27 * m.pie, y: 0 }, punta = { x: 0.73 * m.pie, y: 0 }; // el tobillo queda sobre el último cuarto del pie
    const mitadPie = (talon.x + punta.x) / 2;
    const tobillo = { x: 0, y: m.tobillo };
    const inclinacionPierna = rad(entre(1, 30, s)); // la rodilla avanza: dorsiflexión del tobillo
    const flexionMuslo = rad(entre(0, 100, s)); // el muslo pasa de vertical a quedar bajo la horizontal
    const rodilla = desde(tobillo, m.pierna, inclinacionPierna);
    const cadera = desde(rodilla, m.muslo, -flexionMuslo);
    // La barra alta descansa sobre los trapecios: 4 cm detrás y 3 cm sobre la articulación del hombro.
    const barraCon = tronco => {
      const hombro = desde(cadera, m.tronco, tronco);
      const atras = { x: -Math.cos(tronco), y: Math.sin(tronco) };
      return { hombro, barra: { x: hombro.x + 0.04 * atras.x + 0.03 * Math.sin(tronco), y: hombro.y + 0.04 * atras.y + 0.03 * Math.cos(tronco) } };
    };
    const tronco = raiz(t => barraCon(t).barra.x - mitadPie, 0, rad(75));
    const { hombro, barra } = barraCon(tronco);
    // La cabeza sigue al tronco a medias: mirada al frente y un poco abajo, el cuello neutro.
    const base = desde(hombro, m.cuello * 0.35, tronco);
    const cabeza = desde(base, m.cuello * 0.65 + m.cabeza, tronco * 0.45);
    // Las manos toman la barra por fuera de los hombros: de lado el brazo se ve acortado (el codo va hacia afuera) y el
    // antebrazo casi entero, así el codo apunta abajo y atrás.
    const mano = { x: barra.x + 0.01, y: barra.y };
    const lb = m.brazo * 0.6, la = m.antebrazo * 0.85;
    const opciones = [1, -1].map(lado => dosSegmentos(hombro, mano, lb, la, lado));
    const codo = opciones[0].y < opciones[1].y ? opciones[0] : opciones[1]; // el codo apunta hacia abajo
    return {
      talon, punta, mitadPie, tobillo, rodilla, cadera, hombro, base, cabeza, codo, mano, barra,
      angulos: {
        tobillo: grados(inclinacionPierna),
        rodilla: grados(inclinacionPierna + flexionMuslo),
        cadera: grados(flexionMuslo + tronco),
        tronco: grados(tronco),
      },
    };
  },
};

export const duracion = ej => ej.fases.reduce((a, f) => a + f.seg, 0);

/**
 * En qué punto del movimiento está a los t segundos (el ciclo se repite): s entre 0 y 1, la fase y cuántos segundos
 * lleva en ella (para respirar mientras se mantiene un estiramiento). Una fase "lineal" avanza sin acelerar ni frenar
 * (caminar, trotar).
 */
export function enElTiempo(ej, t) {
  const total = duracion(ej);
  let x = ((t % total) + total) % total;
  for (const f of ej.fases) {
    if (x <= f.seg) { const u = f.seg ? x / f.seg : 1; return { s: entre(f.de, f.a, f.lineal ? u : suave(u)), fase: f, enFase: x }; }
    x -= f.seg;
  }
  const ultima = ej.fases.at(-1);
  return { s: ultima.a, fase: ultima, enFase: ultima.seg };
}

/** Revisión automática de la técnica a lo largo de una repetición: lo que la figura cumple y cuánto. */
export function revisarSentadilla(m = medidas(), muestras = 200) {
  let desvioBarra = 0, avanceRodilla = -Infinity, troncoMax = 0, tobilloMax = 0;
  for (let i = 0; i <= muestras; i++) {
    const p = SENTADILLA_BARRA.pose(i / muestras, m);
    desvioBarra = Math.max(desvioBarra, Math.abs(p.barra.x - p.mitadPie));
    avanceRodilla = Math.max(avanceRodilla, p.rodilla.x - p.punta.x);
    troncoMax = Math.max(troncoMax, p.angulos.tronco);
    tobilloMax = Math.max(tobilloMax, p.angulos.tobillo);
  }
  const abajo = SENTADILLA_BARRA.pose(1, m);
  return {
    desvioBarraCm: desvioBarra * 100,
    caderaBajoRodilla: abajo.cadera.y < abajo.rodilla.y,
    avanceRodillaCm: avanceRodilla * 100,
    troncoMax,
    tobilloMax,
    rodillaAbajo: abajo.angulos.rodilla,
    caderaAbajo: abajo.angulos.cadera,
  };
}
