// Funciones que llegarán después: qué son, dónde van a estar y qué les falta. Solo datos. La app muestra cada botón en
// su lugar definitivo (app/funciones-futuras.js) y, cuando exista la integración, un adaptador real se encarga de la
// autorización escuchando el evento de la función. Ninguna guarda datos, finge estar conectada ni promete una fecha.
// Mismo patrón que las conexiones de Más (app/conexiones-futuras.js): Strava, Salud de Apple y Health Connect.

/** Qué hace falta para habilitarla. */
export const REQUISITOS = Object.freeze({
  nativa: { etiqueta: 'Requiere la app', explica: 'Necesita la app para iPhone o Android, que todavía no existe.' },
  servidor: { etiqueta: 'Requiere servidor', explica: 'Necesita funciones nuevas en el servidor de Entreno.' },
  web: { etiqueta: 'Requiere conexión', explica: 'Necesita que autorices una integración web con otro servicio.' },
});

/**
 * tipo: 'funcion' (algo nuevo de Entreno) o 'conexion' (con otro servicio). donde: la pantalla donde está el botón.
 * requiere: claves de REQUISITOS. detalle: qué más le falta, en palabras de la persona. mientras: qué puede usar hoy.
 * ruta: tarea de docs/11-prioridades.md.
 */
export const FUNCIONES_FUTURAS = Object.freeze({
  revisionTecnica: {
    tipo: 'funcion', nombre: 'Revisar mi técnica', donde: 'ficha', requiere: ['servidor'], ruta: 'T52',
    descripcion: 'Grabar una serie y recibir comentarios sobre tu técnica.',
    detalle: 'Analizar un video también exige resguardar tu privacidad y que un profesional valide las indicaciones antes de mostrarlas.',
    mientras: 'Mientras tanto, guíate por los pasos, por "Ojo con" y por los videos de técnica.',
  },
});

/** Lo que dice el botón al tocarlo: qué falta, qué requisitos tiene y qué se puede usar hoy. */
export function explicacion(clave) {
  const f = FUNCIONES_FUTURAS[clave];
  if (!f) return '';
  return ['Todavía no está disponible.', ...f.requiere.map(r => REQUISITOS[r].explica), f.detalle, f.mientras].filter(Boolean).join(' ');
}

/** El evento que puede escuchar un adaptador real (cancelable: si lo cancela, la app no muestra la explicación). */
export const eventoDe = clave => (FUNCIONES_FUTURAS[clave]?.tipo === 'conexion'
  ? { nombre: 'solicitar-conexion', detail: { conexion: clave } }
  : { nombre: 'solicitar-funcion', detail: { funcion: clave } });
