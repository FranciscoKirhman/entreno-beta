import { normalizar } from './catalogo.js';

/** Contexto explícito; la ausencia de una señal nunca se interpreta como negación. */
export function contextoDolor(texto, indicaciones = [], hoy, zona) {
  const n = normalizar(texto);
  const senales = [];
  const alarmas = ['hormigueo', 'deformidad', 'fiebre', 'perdida de sensibilidad', 'no puedo mover', 'dolor de pecho', 'falta de aire', 'golpe', 'caida'];
  for (const alarma of alarmas) {
    const posiciones = [...n.matchAll(new RegExp(`\\b${alarma}\\b`, 'g'))];
    if (posiciones.some(m => !/\b(no|sin)\s+(?:tengo\s+)?$/.test(n.slice(Math.max(0, m.index - 18), m.index)))) senales.push(alarma);
  }
  const dias = Number(n.match(/(?:hace|llevo)\s+(\d+)\s*dias?\b/)?.[1]);
  const empeoro = /\b(empeoro|empeorando|peor)\b/.test(n) && !/\b(no empeoro|no esta peor|sin empeorar)\b/.test(n);
  const evolucion = /\b(empeoro|empeorando|peor|sin empeorar|mejorando|mejoro|igual)\b/.test(n);
  const sinSenales = /\bsin senales de alarma\b/.test(n);
  const indicacion = indicaciones.find(i => (!i.fecha || i.fecha <= hoy) && (!i.hasta || i.hasta >= hoy)
    && (i.zona === zona || i.restricciones?.zonas?.includes(zona)));
  const profesional = !!indicacion || /\bsin indicaciones profesionales\b/.test(n);
  return { dias: Number.isFinite(dias) ? dias : 0, empeoro, senales, indicacion,
    contextoCompleto: Number.isFinite(dias) && evolucion && sinSenales && profesional };
}
