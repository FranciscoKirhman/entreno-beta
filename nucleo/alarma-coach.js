import { normalizar } from './catalogo.js';

// Respuesta determinista compartida por las reglas y el servidor, antes de pedir ejercicios o llamar a la IA.
// Fuentes: https://saludresponde.minsal.cl/iam/ y https://www.samu.cl/preguntas-frecuentes/
export function alarmaCoach(texto) {
  const n = normalizar(texto);
  const patron = /\b(me duele (?:el )?pecho|dolor(?: fuerte| intenso)? (?:de|en el|en|al) pecho|opresion (?:en el )?pecho|me falta (?:el )?aire|falta de aire|dificultad (?:para )?respirar|me (?:estoy ahogando|ahogo|desmaye)|perdi el conocimiento)\b/g;
  const presente = [...n.matchAll(patron)].some(m => {
    const antes = n.slice(Math.max(0, m.index - 45), m.index);
    return !/\b(?:no|sin|ni)(?:\s+(?:tengo|siento|presento))?\s+$/.test(antes);
  });
  return presente ? { texto: 'Detén el entrenamiento y llama al 131 (SAMU) o pide que alguien llame por ti. Busca atención urgente. No sigas entrenando mientras esperas ayuda.', opciones: [], alarma: true } : null;
}
