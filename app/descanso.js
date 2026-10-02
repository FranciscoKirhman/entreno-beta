// Cronómetro de descanso entre series: parte solo al marcar una serie, con el descanso que indica el plan, y avisa
// al terminar (vibra en Android y suena un pitido corto). Se dibuja sobre el menú, fuera de la vista, así sigue
// corriendo aunque la vista se vuelva a dibujar o se cambie de pantalla.
let fin = 0, reloj = null, audio = null, etiqueta = '', siguientes = [], textoFinal = '¡A la siguiente serie!';
const formato = seg => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;

function caja() {
  let el = document.getElementById('descanso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'descanso';
    el.setAttribute('role', 'timer');
    el.innerHTML = `<div class="texto"><span class="etiqueta pequeno"></span><strong class="tiempo num"></strong></div>
      <button type="button" class="boton" data-menos aria-label="Restar 15 segundos">−15</button>
      <button type="button" class="boton" data-mas aria-label="Sumar 15 segundos">+15</button>
      <button type="button" class="boton" data-listo>Listo</button>`;
    // Como en Hevy: 15 segundos menos o más. Restar no deja el término antes de ahora.
    el.querySelector('[data-menos]').onclick = () => { if (!reloj) return; fin = Math.max(Date.now(), fin - 15_000); pintar(); };
    el.querySelector('[data-mas]').onclick = () => { fin = Math.max(fin, Date.now()) + 15_000; if (!reloj) correr(); pintar(); };
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
    fin = Date.now() + s.seg * 1000; etiqueta = s.texto; resta = s.seg;
    navigator.vibrate?.(200);
    if (audio) pitido();
  }
  resta = Math.max(0, resta);
  el.querySelector('.tiempo').textContent = formato(resta);
  el.querySelector('.etiqueta').textContent = resta ? etiqueta : textoFinal;
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
  caja().classList.add('termino');
  setTimeout(() => { if (!reloj) detenerDescanso(); }, 5000);
}

/** Parte el descanso. Hay que llamarla desde un toque: en iPhone el sonido solo se habilita así. */
export function iniciarDescanso(segundos, texto = 'Descanso') {
  iniciarTramos([{ seg: segundos, texto }], '¡A la siguiente serie!');
}

/** Cronómetro por tramos [{seg, texto}] (calentamiento, estiramiento, cardio): avisa en cada cambio y al terminar. */
export function iniciarTramos(tramos, final = '¡Listo!') {
  if (!tramos?.length) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { audio = null; }
  const [primero, ...resto] = tramos;
  fin = Date.now() + primero.seg * 1000;
  etiqueta = primero.texto;
  siguientes = resto;
  textoFinal = final;
  caja().classList.add('visible');
  document.body.classList.add('con-descanso');
  correr();
  pintar();
}

export function detenerDescanso() {
  clearInterval(reloj);
  reloj = null;
  siguientes = [];
  document.getElementById('descanso')?.classList.remove('visible', 'termino');
  document.body.classList.remove('con-descanso');
}
