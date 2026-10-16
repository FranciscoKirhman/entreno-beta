// Más: atajos y listas. Los controles originales se mueven, nunca se clonan.
// Cada ajuste ocupa una vista de detalle; cambiar de grupo conserva lo escrito.
import { E, R, esc } from './comun.js';
import { imagenAvatar } from './avatares.js';
import { icono } from './iconos.js';
import { graficoSemanasHtml, enlazarProgresoHevy } from './progreso-hevy.js';

// Como el perfil de Hevy: el nombre y cuántos entrenamientos llevas (sin los del ejemplo, salvo en el ejemplo).
const cuantas = () => { const n = (E.sesiones || []).length; return `${n.toLocaleString('es-CL')} entrenamiento${n === 1 ? '' : 's'}`; };
// Como el encabezado del perfil de Hevy (Workouts, Followers, Following): tus entrenamientos, los de este mes y las horas.
function cifrasPerfil() {
  const xs = E.sesiones || [], mes = new Date().toISOString().slice(0, 7);
  const horas = Math.round(xs.reduce((a, s) => a + (Number(s.duracion_min) || 0), 0) / 60);
  const c = (n, t) => '<span class="perfil-cifra"><small>' + t + '</small><b class="num">' + n.toLocaleString('es-CL') + '</b></span>';
  return '<span class="perfil-cifras">' + c(xs.length, 'Entrenamientos') + c(xs.filter(s => s.fecha?.startsWith(mes)).length, 'Este mes') + c(horas, 'Horas') + '</span>';
}
const vistas = new WeakMap(); // Borradores en memoria, separados por perfil y cuenta.
const BORRADORES = ['plan-texto', 'plan-semanas', 'respuesta'];
const TITULOS = {
  cuenta: 'Cuenta', recordatorios: 'Recordatorios', pantalla: 'Pantalla y unidades',
  conexiones: 'Conexiones', respaldo: 'Mis datos', ia: 'Tu IA', importar: 'Importar un plan',
  plan: 'Tu plan', instalar: 'Instalar en el teléfono', prueba: 'Versión de prueba', datos: 'Datos de este teléfono',
  ajustes: 'Ajustes'
};
// Como Hevy, los ajustes van detrás del engranaje: estos paneles vuelven a Ajustes y no al perfil.
const EN_AJUSTES = new Set(['recordatorios', 'pantalla', 'cuenta', 'conexiones', 'respaldo', 'ia', 'importar', 'instalar', 'prueba', 'datos', 'tablero']);
const POR_ID = { cuenta: 'cuenta', recordatorios: 'recordatorios', pantalla: 'pantalla', conexiones: 'conexiones', 'tu-ia': 'ia', 'conectar-ia': 'ia' };

function recogerBorradores(raiz, estado) {
  for (const id of BORRADORES) {
    const campo = raiz.querySelector('#' + id);
    if (campo) estado.borradores[id] = campo.value;
  }
}

/** Antes de volver a pintar por una preferencia o una sincronización. */
export function estadoVistaMas() {
  const estado = vistas.get(E);
  if (!estado) return null;
  const raiz = document.getElementById('vista-mas');
  if (raiz === estado.raiz) {
    recogerBorradores(raiz, estado);
    if (estado.panel) estado.alturas[estado.panel] = scrollY; else estado.yResumen = scrollY;
    const foco = document.activeElement;
    estado.foco = raiz.contains(foco) ? foco.id ? '#' + CSS.escape(foco.id)
      : foco.dataset.unidad ? '[data-unidad="' + CSS.escape(foco.dataset.unidad) + '"]' : null : null;
    estado.observador?.disconnect();
    estado.salida?.disconnect();
    estado.eventos?.abort();
  }
  return estado;
}

function fila(panel, nombre, simbolo, secundaria = '', identificador = 'mas-abrir-' + panel) {
  return '<button type="button" class="mas-fila" id="' + identificador + '" data-mas-abrir="' + panel + '">' +
    icono(simbolo) + '<span class="mas-texto"><span>' + nombre + '</span>' +
    (secundaria ? '<small>' + secundaria + '</small>' : '') + '</span>' + icono('flecha', 'icono mas-flecha') + '</button>';
}
function grupo(nombre, filas) {
  return '<section class="mas-grupo"><h2>' + nombre + '</h2><div class="mas-lista">' + filas + '</div></section>';
}

export function organizarMas({ estado: anterior = null, ir = null, repintar = null } = {}) {
  const raiz = document.getElementById('vista-mas');
  if (!raiz) return;
  if (!document.getElementById('estilos-mas')) {
    const enlace = document.createElement('link');
    enlace.id = 'estilos-mas'; enlace.rel = 'stylesheet'; enlace.href = new URL('./mas.css', import.meta.url).href;
    document.head.append(enlace);
  }
  const ambito = E;
  const estado = anterior || { panel: null, volver: null, yResumen: 0, alturas: {}, borradores: {}, foco: null };
  estado.raiz = raiz;
  vistas.set(ambito, estado);
  const secciones = [...raiz.querySelectorAll(':scope > section')];
  const perfil = raiz.querySelector('#perfil');
  const borrar = raiz.querySelector('#borrar-local');
  const version = raiz.querySelector(':scope > p:last-child');
  const titulo = raiz.querySelector('h1');
  const paneles = document.createElement('div');
  paneles.className = 'mas-paneles';
  const grupos = new Map();
  for (const seccion of secciones) {
    const clave = seccion.dataset.masPanel || POR_ID[seccion.id] || (seccion.querySelector('#ver-tablero-original') ? 'tablero' : null);
    if (!clave) continue;
    if (!grupos.has(clave)) {
      const panel = document.createElement('div');
      panel.dataset.masDetalle = clave; panel.hidden = true;
      grupos.set(clave, panel); paneles.append(panel);
    }
    grupos.get(clave).append(seccion);
  }
  const datos = document.createElement('div');
  datos.dataset.masDetalle = 'datos'; datos.hidden = true;
  const tarjetaDatos = document.createElement('section');
  tarjetaDatos.className = 'tarjeta';
  tarjetaDatos.innerHTML = '<h3>Borrar los datos locales</h3><p class="pequeno suave">Esta acción borra el perfil y los registros de este teléfono. La copia de tus datos está en Ajustes, Mis datos.</p>';
  if (borrar) { tarjetaDatos.append(borrar); borrar.classList.add('mas-peligro'); }
  datos.append(tarjetaDatos); grupos.set('datos', datos); paneles.append(datos);

  // Ajustes: las listas que antes estaban en el perfil, ahora en su propio panel.
  const ajustes = document.createElement('div');
  ajustes.dataset.masDetalle = 'ajustes'; ajustes.hidden = true;
  ajustes.innerHTML = grupo('Preferencias', fila('recordatorios', 'Recordatorios', 'reloj') + fila('pantalla', 'Pantalla y unidades', 'ajustes')) +
    grupo('Datos y conexiones', fila('cuenta', 'Cuenta', 'persona') + fila('respaldo', 'Mis datos', 'bajar', 'Respaldo y restaurar') + fila('conexiones', 'Conexiones', 'cadena') + fila('ia', 'Tu IA', 'chat')) +
    grupo('Herramientas', fila('importar', 'Importar un plan', 'calendario') +
      (grupos.has('instalar') ? fila('instalar', 'Instalar en el teléfono', 'casa') : '') +
      (grupos.has('prueba') ? fila('prueba', 'Versión de prueba', 'ajustes') : '') +
      (grupos.has('tablero') ? '<button type="button" class="mas-fila" data-mas-tablero>' + icono('grafico') + '<span class="mas-texto">Tu tablero original</span>' + icono('flecha', 'icono mas-flecha') + '</button>' : '')) +
    '<div class="mas-datos-locales">' + fila('datos', 'Datos de este teléfono', 'ajustes') + '</div>';
  grupos.set('ajustes', ajustes); paneles.append(ajustes);

  // El perfil, como el de Hevy: quién eres, tus cifras y el gráfico de las últimas semanas, que lleva a Progreso.
  // El plan, el banco y Progreso viven en Mi plan.
  const resumen = document.createElement('div');
  resumen.className = 'mas-resumen';
  resumen.innerHTML = '<button type="button" class="mas-perfil" id="mas-perfil">' + imagenAvatar() +
    '<span class="mas-texto"><strong>' + esc(R()?.apodo || 'Tu perfil') + '</strong>' + cifrasPerfil() + '<small>Foto, equipo y preferencias</small></span>' + icono('flecha', 'icono mas-flecha') + '</button>' +
    (ir ? '<div class="mas-progreso">' + graficoSemanasHtml() + '<button type="button" class="mas-fila mas-ver-progreso" id="mas-ver-progreso">' + icono('grafico') + '<span class="mas-texto">Ver mi progreso</span>' + icono('flecha', 'icono mas-flecha') + '</button></div>' : '');
  resumen.querySelector('#mas-perfil').onclick = () => perfil?.click();
  ajustes.querySelector('[data-mas-tablero]')?.addEventListener('click', () => raiz.querySelector('#ver-tablero-original')?.click());
  const cabecera = document.createElement('header');
  cabecera.className = 'mas-cabecera';
  cabecera.innerHTML = '<button type="button" class="mas-volver" id="mas-volver" data-atras hidden>' + icono('flecha') + '<span>Perfil</span></button>' +
    '<button type="button" class="mas-engranaje" id="mas-engranaje" data-mas-abrir="ajustes" aria-label="Ajustes">' + icono('engranaje') + '</button>';
  titulo.tabIndex = -1;
  cabecera.append(titulo);
  const engranaje = cabecera.querySelector('#mas-engranaje');
  const notas = document.createElement('div');
  notas.className = 'mas-notas'; notas.setAttribute('aria-live', 'polite');
  raiz.replaceChildren(cabecera, notas, resumen, paneles);
  if (version) { version.classList.add('mas-version'); ajustes.append(version); }
  if (ir) enlazarProgresoHevy(() => repintar?.(), () => ir('progreso'));
  resumen.querySelector('#mas-ver-progreso')?.addEventListener('click', () => ir('progreso'));
  const volver = cabecera.querySelector('#mas-volver');
  const eventos = new AbortController();
  estado.eventos = eventos;
  const recordarAltura = () => {
    if (!raiz.isConnected) return;
    if (estado.panel) estado.alturas[estado.panel] = scrollY; else estado.yResumen = scrollY;
  };
  // Capturar antes de que una navegación retire los nodos de Más.
  addEventListener('scroll', recordarAltura, { passive: true, signal: eventos.signal });
  document.addEventListener('click', recordarAltura, { capture: true, signal: eventos.signal });

  function abrir(clave, { origen = null, enfocar = true, restaurar = false } = {}) {
    if (!grupos.has(clave)) return;
    if (!restaurar) {
      if (estado.panel) estado.alturas[estado.panel] = scrollY; else estado.yResumen = scrollY;
      if (!ajustes.contains(origen)) estado.volver = origen?.id || estado.volver;
    }
    estado.panel = clave;
    resumen.hidden = true; volver.hidden = false; engranaje.hidden = true; titulo.textContent = TITULOS[clave] || 'Perfil';
    volver.querySelector('span').textContent = EN_AJUSTES.has(clave) ? 'Ajustes' : 'Perfil';
    grupos.forEach((panel, nombre) => { panel.hidden = nombre !== clave; });
    if (enfocar) { scrollTo(0, estado.alturas[clave] || 0); titulo.focus({ preventScroll: true }); }
  }
  volver.onclick = () => {
    estado.alturas[estado.panel] = scrollY;
    if (EN_AJUSTES.has(estado.panel)) {
      const desde = estado.panel;
      abrir('ajustes', { restaurar: true, enfocar: false });
      scrollTo(0, estado.alturas.ajustes || 0);
      ajustes.querySelector('#mas-abrir-' + CSS.escape(desde))?.focus({ preventScroll: true });
      return;
    }
    estado.panel = null; estado.foco = null;
    grupos.forEach(panel => { panel.hidden = true; });
    resumen.hidden = false; volver.hidden = true; engranaje.hidden = false; titulo.textContent = 'Perfil';
    scrollTo(0, estado.yResumen);
    const origen = estado.volver && raiz.querySelector('#' + CSS.escape(estado.volver));
    (origen || resumen.querySelector('#mas-perfil')).focus({ preventScroll: true });
  };
  raiz.addEventListener('click', ev => {
    const acceso = ev.target.closest('[data-mas-abrir]');
    if (acceso) abrir(acceso.dataset.masAbrir, { origen: acceso });
    const enlaceIA = ev.target.closest('a[href="#tu-ia"]');
    if (enlaceIA) { ev.preventDefault(); abrir('ia', { origen: ajustes.querySelector('#mas-abrir-ia') }); }
  });
  raiz.addEventListener('abrir-ajuste-mas', ev => abrir(ev.detail, { origen: raiz.querySelector('#mas-abrir-' + ev.detail) }));
  raiz.addEventListener('input', () => recogerBorradores(raiz, estado));
  for (const id of BORRADORES) {
    const campo = raiz.querySelector('#' + id);
    if (campo && Object.hasOwn(estado.borradores, id)) campo.value = estado.borradores[id];
  }

  function actualizarNotas() {
    if (!raiz.isConnected) return;
    const pendientes = raiz.querySelectorAll('[data-confirmar-ia]').length;
    const avisos = [];
    if (pendientes) avisos.push(fila('ia', pendientes === 1 ? 'Tienes una propuesta de IA' : 'Tienes ' + pendientes + ' propuestas de IA', 'chat', '', 'mas-propuestas-ia'));
    for (const [id, clave, etiqueta] of [
      ['estado-cuenta', 'cuenta', 'Revisa el ingreso a tu cuenta'],
      ['estado-sincronizacion', 'cuenta', 'Revisa la sincronización'],
      ['estado-hevy', 'conexiones', 'Revisa la conexión con Hevy'],
      ['conexiones-ia-estado', 'ia', 'Revisa la conexión con tu IA']
    ]) {
      const salida = raiz.querySelector('#' + id);
      if (salida && (/^\s*(no pude|no se pudo|el código no funcionó|quedan\s+\d+.*pendientes)/i.test(salida.textContent) || salida.querySelector('.alerta, [role="alert"]'))) {
        avisos.push('<div class="mas-aviso">' + fila(clave, etiqueta, 'info', '', 'mas-aviso-' + id) + '</div>');
      }
    }
    const html = avisos.join('');
    if (notas.innerHTML !== html) notas.innerHTML = html;
    notas.hidden = !avisos.length;
  }
  // Los mensajes de cuenta y las propuestas pueden llegar después de pintar.
  const observador = new MutationObserver(actualizarNotas);
  observador.observe(paneles, { subtree: true, childList: true, characterData: true });
  const salida = new MutationObserver(() => {
    if (!raiz.isConnected) { observador.disconnect(); salida.disconnect(); eventos.abort(); }
  });
  salida.observe(raiz.parentElement, { childList: true });
  estado.observador = observador;
  estado.salida = salida;
  actualizarNotas();
  const panelInicial = estado.panel || (!anterior && location.hash === '#tu-ia' ? 'ia' : null);
  if (panelInicial) abrir(panelInicial, { enfocar: false, restaurar: true });
  if (anterior || panelInicial) {
    const focoAlPintar = document.activeElement;
    requestAnimationFrame(() => {
      if (!raiz.isConnected || estado.panel !== panelInicial) return;
      // Un acceso como "Con tu correo" ya abrió su panel y eligió el campo.
      if (document.activeElement !== focoAlPintar && raiz.contains(document.activeElement)) return;
      scrollTo(0, panelInicial ? estado.alturas[panelInicial] || 0 : estado.yResumen);
      if (panelInicial) {
        const foco = estado.foco && raiz.querySelector(estado.foco);
        (foco || titulo).focus({ preventScroll: true });
      }
    });
  }
}
