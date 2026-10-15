// Campanita arriba a la derecha: los avisos de sincronización (lo que subió a la cuenta, lo que espera señal, lo que
// llegó de Hevy) se anotan aquí en vez de salir como aviso flotante. El punto rojo marca un problema sin leer; lo que
// salió bien se anota sin punto. Al abrirla se ven los avisos en una hoja y el punto se apaga.
import { E, guardar, esc } from './comun.js';
import { abrirHoja } from './hoja.js';
import { estadoCola, subirPendientes } from './cola.js';
import * as nube from './nube.js';

const MAX = 30;
let sincronizar = null; // lo pone app.js: la sincronización completa de la cuenta

const SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';

/** app.js entrega cómo sincronizar la cuenta, para el botón de la hoja. */
export function configurarCampana(opciones) { sincronizar = opciones.sincronizar; }

/**
 * Anota un aviso de sincronización. `problema`: enciende el punto rojo. `resuelve`: todo quedó al día, así que los
 * problemas anteriores dejan de marcar el punto. Si el último aviso dice lo mismo, solo se actualiza la hora.
 */
export function anotarSinc(texto, { problema = false, resuelve = false } = {}) {
  const lista = E.avisosSinc ||= [];
  if (resuelve) lista.forEach(x => { x.leido = true; });
  const cuando = new Date().toISOString();
  if (lista[0]?.texto === texto) Object.assign(lista[0], { cuando, problema, leido: lista[0].leido && !problema });
  else lista.unshift({ texto, cuando, problema, leido: !problema });
  lista.length = Math.min(lista.length, MAX);
  guardar();
  pintarCampana();
}

const sinLeer = () => (E.avisosSinc || []).some(x => !x.leido);

/** Dibuja (o esconde) la campanita en la barra de arriba. Se ve con cuenta o si hay avisos anotados. */
export function pintarCampana() {
  const barra = document.querySelector('.barra');
  if (!barra) return;
  let b = document.getElementById('campana');
  if (!b) {
    b = document.createElement('button');
    b.type = 'button'; b.id = 'campana'; b.className = 'campana';
    b.innerHTML = `${SVG}<span class="campana-punto" hidden></span>`;
    b.addEventListener('click', () => abrirCampana(b));
    barra.append(b);
  }
  b.hidden = !nube.conectado() && !E.avisosSinc?.length;
  const punto = sinLeer();
  b.querySelector('.campana-punto').hidden = !punto;
  b.setAttribute('aria-label', punto ? 'Avisos de sincronización, hay algo por revisar' : 'Avisos de sincronización');
}

const hora = iso => {
  const d = new Date(iso), h = d.toLocaleTimeString('es-CL', { hour: 'numeric', minute: '2-digit' });
  const dias = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  return dias === 0 ? `Hoy ${h}` : dias === 1 ? `Ayer ${h}` : `${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} ${h}`;
};

function abrirCampana(boton) {
  const cola = estadoCola(), lista = E.avisosSinc || [];
  const espera = cola.total ? `<p class="aviso ojo campana-cola">${cola.total} cosa${cola.total === 1 ? '' : 's'} esperando subir a tu cuenta. Quedan guardadas en este teléfono y se suben solas cuando hay señal.${cola.detenidos ? ` Se pausó después de varios intentos${cola.error ? ` (${esc(cola.error)})` : ''}.` : ''}</p>` : '';
  const items = lista.length
    ? `<ul class="campana-lista">${lista.map(x => `<li class="${x.problema ? 'problema' : ''}${x.leido ? '' : ' nuevo'}"><span class="pequeno">${esc(hora(x.cuando))}</span>${esc(x.texto)}</li>`).join('')}</ul>`
    : '<p class="pequeno campana-vacia">Todo al día. Aquí aparecen los avisos de sincronización.</p>';
  const opciones = [
    ...(nube.conectado() && sincronizar ? [{ valor: 'sincronizar', letra: '↻', nombre: 'Sincronizar ahora' }] : []),
    ...(cola.total && nube.conectado() ? [{ valor: 'reintentar', letra: '↑', nombre: 'Reintentar la subida' }] : []),
    ...(lista.length ? [{ valor: 'borrar', letra: '×', nombre: 'Borrar avisos' }] : []),
  ];
  lista.forEach(x => { x.leido = true; });
  guardar(); pintarCampana();
  abrirHoja({
    titulo: 'Sincronización', contenido: espera + items, opciones, volver: boton,
    alElegir: async valor => {
      if (valor === 'borrar') { E.avisosSinc = []; guardar(); pintarCampana(); return; }
      try {
        if (valor === 'sincronizar') await sincronizar();
        else await subirPendientes({ forzar: true });
      } catch (e) { anotarSinc(`No pude sincronizar: ${e.message}. Tus datos del teléfono se conservan.`, { problema: navigator.onLine !== false }); }
    },
  });
}
