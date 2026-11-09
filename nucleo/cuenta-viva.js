// La cuenta de 10 segundos de los cambios de la sesión viva (app/hoy.js). Los cambios de un ejercicio se miden con el
// reloj, como siempre. El ajuste de tiempo al empezar cambia la sesión entera, así que solo cuenta los segundos que de
// verdad se vio: nada se recorta sin que la persona lo haya tenido enfrente. Nace de la beta (9 de noviembre de 2026):
// al apretar Empezar la pantalla bajaba al primer ejercicio, el aviso quedaba tapado bajo la cabecera y a los 10
// segundos una sesión de 28 series quedó en 12 sin que nadie lo viera; y con la pantalla apagada se aplicaba de golpe
// al volver.
import { SEGUNDOS_PARA_ACEPTAR } from './sesion-viva.js';

/** Segundos que le faltan a un cambio pendiente para aplicarse solo. */
export function restanAceptar(p, ahora = Date.now()) {
  const pasados = p.tipo === 'tiempo' ? p.visto || 0 : Math.floor((ahora - p.desde) / 1000);
  return Math.max(0, SEGUNDOS_PARA_ACEPTAR - pasados);
}

/**
 * Un segundo del reloj de la sesión: el ajuste de tiempo solo avanza si se está viendo.
 * @param seVe el botón está en la pantalla y nada lo tapa
 * @returns los segundos que faltan
 */
export function contarSegundo(p, seVe, ahora = Date.now()) {
  if (p.tipo === 'tiempo' && seVe) p.visto = (p.visto || 0) + 1;
  return restanAceptar(p, ahora);
}

/** Con qué se calculó un ajuste de tiempo: la sesión del plan y lo hecho hasta ese momento. */
export const huellaAjuste = (firma, hechas) => `${firma}|${JSON.stringify(hechas)}`;

/**
 * Un ajuste de tiempo pendiente sirve mientras la sesión siga como cuando se calculó. Como puede esperar a que se vea,
 * entretanto pueden anotarse series, cambiar un ejercicio o llegar otro plan de la cuenta: aplicarlo pisaría eso.
 * Lo demás (y lo que no está pendiente) no caduca por esto.
 */
export const ajusteVigente = (p, huella) => p?.tipo !== 'tiempo' || p.huella === huella;
