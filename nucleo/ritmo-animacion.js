// Ritmo de una repetición para la figura anatómica de la ficha (app/figura-anatomica.js). Usa las mismas fases del
// motor (nucleo/animaciones.js), pero con curvas distintas: lo que se controla (la bajada de una sentadilla, la vuelta
// de un remo) parte y frena despacio, y el esfuerzo (subir, tirar, empujar) parte con fuerza y frena al final. En la
// pausa del extremo el cuerpo se asienta apenas, y el pecho respira: suelta el aire en el esfuerzo y lo toma después.
// No cambia el motor: solo decide "s" y agrega datos para quien dibuja.
const suave5 = u => u * u * u * (u * (u * 6 - 15) + 10); // parte y frena más despacio que la curva cúbica del motor
const sale = u => 1 - (1 - u) ** 3; // parte rápido y frena al final
const seMueve = f => f.de !== f.a && !f.lineal;
const ASIENTA = 0.014; // cuánto se pasa de su extremo al asentarse (s llega a 1,014)
const INHALA = 0.7; // segundos mínimos para tomar aire después del esfuerzo
const RESPIRO = 3.6; // segundos de una respiración cuando no hay esfuerzo (la misma del "Mantén" del motor)

/**
 * Qué fases son de esfuerzo. Si la fase lo dice (esfuerzo: true o false), manda eso. Si no, es la que se mueve claramente
 * más rápido que la otra: en todos los ritmos del motor la parte que se controla dura más que la que se empuja o tira.
 * "Vuelve" nunca es esfuerzo: es regresar al punto de partida.
 */
export function fasesDeEsfuerzo(anim) {
  const largo = Math.max(0, ...anim.fases.filter(seMueve).map(f => f.seg));
  return anim.fases.map(f => f.esfuerzo ?? (seMueve(f) && f.nombre !== 'Vuelve' && f.seg < 0.8 * largo));
}

const planes = new WeakMap();
/** Lo que no cambia de un cuadro a otro: cuándo parte cada fase, cuáles son de esfuerzo y cuánto dura tomar aire. */
function planDe(anim) {
  if (planes.has(anim)) return planes.get(anim);
  const fases = anim.fases, n = fases.length, total = fases.reduce((a, f) => a + f.seg, 0), esfuerzo = fasesDeEsfuerzo(anim);
  const inicio = []; let t = 0;
  for (const f of fases) { inicio.push(t); t += f.seg; }
  // Para cada fase que no es de esfuerzo: cuándo terminó el último esfuerzo y en cuánto tiempo se vuelve a llenar el pecho.
  const aire = fases.map((_, i) => {
    if (esfuerzo[i] || !esfuerzo.includes(true)) return null;
    let j = i; do j = (j - 1 + n) % n; while (!esfuerzo[j]);
    let k = j, libre = 0; do { k = (k + 1) % n; if (!esfuerzo[k]) libre += fases[k].seg; } while (!esfuerzo[k]);
    const despues = fases[(j + 1) % n], pausa = despues.de === despues.a ? despues.seg : 0;
    return { fin: inicio[j] + fases[j].seg, dura: Math.min(libre, Math.max(INHALA, pausa)) };
  });
  const plan = { total, inicio, esfuerzo, aire };
  planes.set(anim, plan);
  return plan;
}

/**
 * Dónde va el movimiento a los t segundos (el ciclo se repite). s: 0 a 1 (hasta 1,014 al asentarse); fase y enFase,
 * como el enElTiempo del motor; u: avance dentro de la fase (0 a 1); esfuerzo: si esa fase es la que empuja o tira;
 * aire: 0 (sin aire) a 1 (pecho lleno).
 */
export function enElTiempo(anim, t) {
  const { total, inicio, esfuerzo, aire: planAire } = planDe(anim), fases = anim.fases;
  let x = ((t % total) + total) % total, i = fases.length - 1, u = 1;
  for (let k = 0; k < fases.length; k++) { if (x <= fases[k].seg) { i = k; u = fases[k].seg ? x / fases[k].seg : 1; break; } x -= fases[k].seg; }
  const fase = fases[i], quieta = fase.de === fase.a, tramo = fase.a - fase.de;
  let s;
  if (fase.lineal) s = fase.de + tramo * u;
  else if (quieta) s = fase.de + (fase.de > 0.5 && !fase.respira && fase.seg <= 1 ? ASIENTA * Math.sin(Math.PI * u) : 0);
  else if (esfuerzo[i]) s = fase.de + tramo * (0.35 * suave5(u) + 0.65 * sale(u));
  else s = fase.de + tramo * suave5(u);
  let aire;
  if (esfuerzo[i]) aire = 1 - suave5(u); // suelta el aire mientras empuja o tira
  else if (planAire[i]) { // lo toma apenas termina el esfuerzo y lo sostiene hasta el siguiente
    const desde = (((inicio[i] + x - planAire[i].fin) % total) + total) % total;
    aire = desde >= planAire[i].dura ? 1 : suave5(desde / planAire[i].dura);
  } else if (fase.respira) aire = 0.5 + 0.5 * Math.sin((x / RESPIRO) * Math.PI * 2); // al mantener, respira con el motor
  else aire = 0.5 - 0.5 * Math.cos((t / RESPIRO) * Math.PI * 2); // caminar, trotar: respira tranquilo
  return { s, fase, u, enFase: x, esfuerzo: esfuerzo[i], aire: Math.min(1, Math.max(0, aire)), total };
}

/** El recorrido de la carga (la barra) en toda la repetición, para dibujar su línea. */
export function recorridoCarga(anim, m, pasos = 24) {
  const puntos = [];
  for (let i = 0; i <= pasos; i++) {
    const p = anim.pose(i / pasos, m, anim.fases[0], 0), barra = (p.equipo || []).find(e => e.tipo === 'barra');
    if (!barra) return [];
    puntos.push(barra.centro);
  }
  return puntos;
}
