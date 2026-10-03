// Cronómetro de descanso entre series: parte solo al marcar una serie, con el descanso que indica el plan, y avisa
// al terminar (vibra en Android y suena un pitido corto). Se dibuja sobre el menú, fuera de la vista, así sigue
// corriendo aunque la vista se vuelva a dibujar o se cambie de pantalla.
import { imagenAsistente, asistenteActual } from './cuestionario.js';
import { entrarPose } from './movimiento.js';

let fin = 0, reloj = null, audio = null, etiqueta = '', siguientes = [], textoFinal = '¡A la siguiente serie!';
// Series por tiempo (plancha y parecidas): al terminar, o al tocar Listo antes, se avisa cuántos segundos se hicieron.
let alFin = null, inicio = 0;
// El anillo alrededor del asistente se vacía con el tramo; inicioTramo y fin dicen cuánto queda.
let inicioTramo = 0;
const ANILLO = 2 * Math.PI * 22;
const hechos = () => Math.round((Date.now() - inicio) / 1000);
const formato = seg => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;

function caja() {
  let el = document.getElementById('descanso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'descanso';
    el.setAttribute('role', 'timer');
    el.innerHTML = `<div class="descanso-cab"><span class="descanso-anillo" aria-hidden="true"><svg viewBox="0 0 48 48"><circle class="pista" cx="24" cy="24" r="22"/><circle class="progreso" cx="24" cy="24" r="22" stroke-dasharray="${ANILLO.toFixed(2)}"/></svg><span class="descanso-asistente"></span></span><div class="texto"><span class="etiqueta pequeno"></span><strong class="tiempo num"></strong></div></div>
      <div class="descanso-controles"><button type="button" class="boton" data-menos aria-label="Restar 15 segundos">−15</button>
      <button type="button" class="boton" data-mas aria-label="Sumar 15 segundos">+15</button>
      <button type="button" class="boton" data-listo>Listo</button></div>`;
    // Como en Hevy: 15 segundos menos o más. Restar no deja el término antes de ahora.
    el.querySelector('[data-menos]').onclick = () => { if (!reloj) return; fin = Math.max(Date.now(), fin - 15_000); pintar(); };
    el.querySelector('[data-mas]').onclick = () => { if (!reloj) inicioTramo = Date.now(); fin = Math.max(fin, Date.now()) + 15_000; if (!reloj) correr(); pintar(); };
    el.querySelector('[data-listo]').onclick = detenerDescanso;
    document.body.append(el);
  }
  return el;
}

function pintar() {
  const el = caja();
  let resta = Math.ceil((fin - Date.now()) / 1000);
  // Cronómetro por tramos (calentamiento, estiramiento, cardio): al terminar uno, aviso corto y sigue el próximo.
  if (resta <= 0 && reloj && siguientes.length) {
    const s = siguientes.shift();
    fin = Date.now() + s.seg * 1000; etiqueta = s.texto; resta = s.seg; inicioTramo = Date.now();
    navigator.vibrate?.(200);
    if (audio) pitido();
  }
  resta = Math.max(0, resta);
  el.querySelector('.tiempo').textContent = formato(resta);
  el.querySelector('.etiqueta').textContent = resta ? etiqueta : textoFinal;
  // Cuatro veces por segundo, con una transición lineal de 250 ms: se vacía de forma continua. Solo cambia el trazo.
  const queda = Math.max(0, fin - Date.now()), total = Math.max(1, fin - inicioTramo);
  el.querySelector('.descanso-anillo .progreso').style.strokeDashoffset = (ANILLO * (1 - queda / total)).toFixed(2);
  el.classList.toggle('ultimos', queda > 0 && queda <= 3000);
  const personaje = el.querySelector('.descanso-asistente');
  const pose = resta ? 'cronometro' : 'animo', asistente = asistenteActual();
  // El cronómetro se actualiza cuatro veces por segundo; la imagen solo cambia al cambiar la pose o el asistente.
  if (personaje.dataset.pose !== pose || personaje.dataset.asistente !== asistente) {
    personaje.innerHTML = imagenAsistente(pose, 'descanso-personaje', asistente);
    personaje.dataset.pose = pose; personaje.dataset.asistente = asistente;
    entrarPose(personaje.firstElementChild); // una entrada corta, solo cuando cambia
  }
  if (!resta && reloj) terminar();
}

function correr() {
  clearInterval(reloj);
  reloj = setInterval(pintar, 250); // con la hora de término, no se atrasa aunque el teléfono frene la app
  caja().classList.remove('termino');
}

function pitido() {
  try {
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + 0.4);
  } catch { /* sin sonido */ }
}

function terminar() {
  clearInterval(reloj);
  reloj = null;
  navigator.vibrate?.([200, 100, 200]);
  if (audio) pitido();
  if (alFin) {
    // Normalmente anota la serie y parte el descanso; si no hay descanso, se cierra.
    const f = alFin; alFin = null; f(hechos());
    if (!reloj) detenerDescanso();
    return;
  }
  caja().classList.add('termino');
  setTimeout(() => { if (!reloj) detenerDescanso(); }, 5000);
}

/** Parte el descanso. Hay que llamarla desde un toque: en iPhone el sonido solo se habilita así. */
export function iniciarDescanso(segundos, texto = 'Descanso') {
  iniciarTramos([{ seg: segundos, texto }], '¡A la siguiente serie!');
}

/** Cronómetro por tramos [{seg, texto}] (calentamiento, estiramiento, cardio): avisa en cada cambio y al terminar.
 *  alTerminar(segundos): para una serie por tiempo, recibe los segundos hechos al terminar o al tocar Listo antes. */
export function iniciarTramos(tramos, final = '¡Listo!', { alTerminar = null } = {}) {
  if (!tramos?.length) return;
  alFin = alTerminar; inicio = Date.now();
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { audio = null; }
  const [primero, ...resto] = tramos;
  fin = Date.now() + primero.seg * 1000;
  inicioTramo = Date.now();
  etiqueta = primero.texto;
  siguientes = resto;
  textoFinal = final;
  caja().classList.add('visible');
  document.body.classList.add('con-descanso');
  correr();
  pintar();
}

export function detenerDescanso() {
  const corriendo = Boolean(reloj), f = alFin;
  clearInterval(reloj);
  reloj = null;
  siguientes = [];
  alFin = null;
  document.getElementById('descanso')?.classList.remove('visible', 'termino', 'ultimos');
  document.body.classList.remove('con-descanso');
  if (f && corriendo) f(hechos()); // Listo antes de tiempo: cuenta lo hecho hasta ahí
}
