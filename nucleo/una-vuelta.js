// Una sola vuelta atrás por deslizamiento (app/atras.js). En el iPhone el mismo dedo puede llegar por dos vías: el
// gesto propio de la app instalada y el "atrás" del teléfono, que llega como popstate. Si el popstate llega después de
// que el gesto ya volvió, le pregunta a la pantalla nueva y vuelve otra vez: dos pantallas en vez de una (Francisco,
// 28 de octubre de 2026: "a veces va 2 pantallas atrás en vez de solo una"). Si llega antes, las dos vías apuntan a la
// misma pantalla y no se nota; por eso pasaba solo a veces. Lo que llega por la otra vía durante el gesto o poco
// después cuenta como la misma vuelta.

/**
 * @param ventana ms después de una vuelta en que la otra vía todavía es el mismo deslizamiento
 * @param reloj   () => ms (performance.now en la app)
 * @returns {{ empiezaGesto(): void, puede(via: 'gesto' | 'historial'): boolean }}
 */
export function unaVueltaPorGesto({ ventana = 1000, reloj = () => Date.now() } = {}) {
  let ultima = null, gestoDesde = null;
  return {
    /** El dedo empezó a arrastrar desde el borde: lo que vuelva por el historial desde ahora es este mismo gesto. */
    empiezaGesto() { gestoDesde = reloj(); },
    /** Si esta vía puede volver ahora (y queda anotada), o false si es la vuelta que ya llegó por la otra vía. */
    puede(via) {
      const t = reloj();
      const otra = ultima && ultima.via !== via;
      if (otra && (t - ultima.t < ventana || (via === 'gesto' && gestoDesde != null && ultima.t >= gestoDesde))) return false;
      ultima = { via, t };
      return true;
    },
  };
}
