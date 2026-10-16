// Cuánto tarda la app en este teléfono: al abrir (contenido listo, primer dibujo, cuenta al día) y al guardar. Se ve en
// Perfil, al final (versión de prueba). Solo se guardan números en este teléfono: no sale nada del teléfono.

const CLAVE = 'entreno-mediciones', MAX = 10;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const guardado = { n: 0, ultimoMs: 0, peorMs: 0, totalMs: 0, kb: 0 };
const apertura = { cuando: new Date().toISOString(), fondo: typeof document !== 'undefined' && document.visibilityState === 'hidden' };
let anotada = false;

/** El tiempo de un guardado y el tamaño de lo escrito (app/comun.js: guardar). */
export function medirGuardado(ms, largo) {
  guardado.n += 1; guardado.ultimoMs = ms; guardado.totalMs += ms; guardado.peorMs = Math.max(guardado.peorMs, ms);
  guardado.kb = Math.round(largo / 1024);
}

/** Marca un momento de la apertura: 'contenido', 'dibujo' o 'cuenta'. */
export function anotarApertura(parte) {
  if (apertura[parte] != null) return;
  apertura[parte] = Math.round(performance.now());
  if (parte === 'dibujo') {
    const js = performance.getEntriesByType?.('resource').filter(e => /\.js(\?|$)/.test(e.name)) || [];
    apertura.modulos = js.length;
    apertura.modulosMs = Math.round(Math.max(0, ...js.map(e => e.responseEnd)));
  }
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE) || '[]').filter(x => x?.cuando !== apertura.cuando);
    lista.unshift({ ...apertura });
    localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, MAX)));
    anotada = true;
  } catch { /* sin almacenamiento: solo en memoria */ }
}

const ms = v => (v == null ? 'sin dato' : `${v.toLocaleString('es-CL')} ms`);
const promedio = xs => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** El detalle para Perfil. El espacio del teléfono se completa después (navigator.storage.estimate es asíncrono). */
export function htmlMedicion() {
  let lista = [];
  try { lista = anotada || localStorage.getItem(CLAVE) ? JSON.parse(localStorage.getItem(CLAVE) || '[]') : [apertura]; } catch { lista = [apertura]; }
  const visibles = lista.filter(x => !x.fondo && x.dibujo != null);
  let principalKb = 0;
  try { for (let i = 0; i < localStorage.length; i++) principalKb += (localStorage.getItem(localStorage.key(i)) || '').length * 2 / 1024; } catch { /* sin acceso */ }
  const filas = [
    ['Primer dibujo al abrir', apertura.fondo ? 'abrió en el fondo' : ms(apertura.dibujo)],
    ['Promedio de las últimas aperturas', `${ms(promedio(visibles.map(x => x.dibujo)))} (${visibles.length})`],
    ['Contenido listo', ms(apertura.contenido)],
    ['Módulos', apertura.modulos ? `${apertura.modulos}, listos a los ${ms(apertura.modulosMs)}` : 'sin dato'],
    ['Cuenta al día', ms(apertura.cuenta)],
    ['Último guardado', guardado.n ? `${ms(guardado.ultimoMs)}, ${guardado.kb} KB` : 'todavía no'],
    ['Guardados en esta apertura', guardado.n ? `${guardado.n}, promedio ${ms(Math.round(guardado.totalMs / guardado.n))}, el más lento ${ms(guardado.peorMs)}` : '0'],
    ['Almacenamiento principal', `${Math.round(principalKb).toLocaleString('es-CL')} KB de unos 5.000 KB`],
  ];
  return `<dl class="medicion pequeno">${filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}<dt>Espacio de la app</dt><dd id="medicion-espacio">calculando…</dd></dl>`;
}

/** Completa el espacio total que usa la app (copias, caché sin señal e imágenes). */
export function completarMedicion() {
  const el = document.getElementById('medicion-espacio');
  if (!el) return;
  if (!navigator.storage?.estimate) { el.textContent = 'sin dato'; return; }
  navigator.storage.estimate().then(({ usage }) => { el.textContent = `${(usage / 1048576).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MB`; })
    .catch(() => { el.textContent = 'sin dato'; });
}
