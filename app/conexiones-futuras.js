// Entradas listas para conectar con el servidor o con los permisos de la app nativa.
// Un adaptador escucha solicitar-conexion y cancela el aviso antes de iniciar su flujo.
import { esc } from './comun.js';

export const CONEXIONES_FUTURAS = Object.freeze({
  strava: {
    nombre: 'Strava', requisito: 'Próximamente',
    descripcion: 'Publicar tus sesiones en Strava cuando esta conexión esté habilitada.',
    pendiente: 'La conexión con Strava todavía no está habilitada en Entreno. Cuando esté lista, este botón te permitirá autorizarla.'
  },
  'salud-apple': {
    nombre: 'Salud de Apple', requisito: 'App para iPhone',
    descripcion: 'Conectar tus sesiones y medidas desde la futura app para iPhone.',
    pendiente: 'Esta conexión requiere la app para iPhone. Cuando esté disponible, desde este botón podrás elegir qué datos leer o guardar en Salud de Apple.'
  },
  'health-connect': {
    nombre: 'Health Connect', requisito: 'App para Android',
    descripcion: 'Conectar tus sesiones y medidas desde la futura app para Android.',
    pendiente: 'Esta conexión requiere la app para Android. Cuando esté disponible, desde este botón podrás elegir qué datos leer o guardar en Health Connect.'
  }
});

export function conexionFuturaHtml(clave, simbolo) {
  const conexion = CONEXIONES_FUTURAS[clave];
  const id = 'conexion-futura-' + clave;
  return '<li><div class="cab-conexion">' + simbolo + '<strong>' + esc(conexion.nombre) + '</strong>' +
    '<span class="chip">' + esc(conexion.requisito) + '</span></div>' +
    '<p class="pequeno suave" id="' + id + '-descripcion">' + esc(conexion.descripcion) + '</p>' +
    '<button type="button" class="boton" data-conexion-futura="' + clave + '" aria-expanded="false" aria-controls="' + id + '" aria-describedby="' + id + '-descripcion">Conectar ' + esc(conexion.nombre) + '</button>' +
    '<p class="aviso ojo" id="' + id + '" role="status" hidden></p></li>';
}

export function enlazarConexionesFuturas(raiz) {
  raiz.querySelectorAll('[data-conexion-futura]').forEach(boton => {
    boton.addEventListener('click', () => {
      const clave = boton.dataset.conexionFutura;
      const conexion = CONEXIONES_FUTURAS[clave];
      if (!conexion) return;
      const solicitud = new CustomEvent('solicitar-conexion', { bubbles: true, cancelable: true, detail: { conexion: clave } });
      if (!boton.dispatchEvent(solicitud)) return; // Un adaptador ya se encarga de autorizar la conexión.
      const aviso = raiz.querySelector('#' + CSS.escape('conexion-futura-' + clave));
      aviso.textContent = conexion.pendiente;
      aviso.hidden = !aviso.hidden;
      boton.setAttribute('aria-expanded', String(!aviso.hidden));
    });
  });
}
