// El nivel cambia con el tiempo. Se parte del que dio la persona (cuánto lleva entrenando y con qué constancia) y
// sube con lo que entrena en la app: principiante hasta los 6 meses de práctica, intermedio hasta los 2 años, y
// avanzado desde ahí si entrena 3 o más días a la semana. Nunca baja solo: después de una pausa larga lo ajusta
// la persona con el objetivo "volver a entrenar".
import { NIVELES, nivel, nivelDeclarado } from './derivar.js';

const MESES_INICIALES = { nunca: 0, menos_6m: 3, '6_24m': 12, '2_5a': 36, mas_5a: 72 };
const SEMANAS_POR_MES = 4.35;
const DIA_MS = 864e5;
const lunesDe = f => { const t = Date.parse(f + 'T12:00:00Z'); const d = new Date(t).getUTCDay(); return new Date(t - ((d + 6) % 7) * DIA_MS).toISOString().slice(0, 10); };

/**
 * @param respuestas del cuestionario (tiempo_entrenando, constancia, nivel_ganado)
 * @param fechas     días en que entrenó con la app ('AAAA-MM-DD', pueden repetirse)
 * @returns {{ nivel, alcanzado, sube, meses, semanasConstantes, ritmo, siguiente, semanasFaltan, falta }}
 *   nivel: el vigente; alcanzado: el que corresponde hoy (sube = es mayor); falta: qué le queda para el siguiente.
 */
export function progresoNivel({ respuestas: r, fechas = [], hoy }) {
  const actual = nivel(r);
  const unicas = [...new Set(fechas)].filter(f => f <= hoy);
  // Semanas constantes: con 2 o más sesiones. Cada 4,35 suma un mes de práctica.
  const porSemana = new Map();
  for (const f of unicas) porSemana.set(lunesDe(f), (porSemana.get(lunesDe(f)) || 0) + 1);
  const semanasConstantes = [...porSemana.values()].filter(n => n >= 2).length;
  const meses = (MESES_INICIALES[r.tiempo_entrenando] ?? 0) + semanasConstantes / SEMANAS_POR_MES;
  // Ritmo de las últimas 12 semanas. Sin datos suficientes de la app, vale lo que contestó.
  const desde = new Date(Date.parse(hoy + 'T12:00:00Z') - 84 * DIA_MS).toISOString().slice(0, 10);
  const ritmo = unicas.filter(f => f > desde).length / 12;
  const constante = ritmo >= 3 || (unicas.length < 8 && ['3_4', '5_mas'].includes(r.constancia));
  const porTiempo = meses >= 24 && constante ? 'avanzado' : meses >= 6 ? 'intermedio' : 'principiante';
  const alcanzado = NIVELES.indexOf(porTiempo) > NIVELES.indexOf(actual) ? porTiempo : actual;
  const siguiente = NIVELES[NIVELES.indexOf(alcanzado) + 1] || null;
  const mesesMeta = siguiente === 'intermedio' ? 6 : siguiente === 'avanzado' ? 24 : null;
  const semanasFaltan = mesesMeta == null ? 0 : Math.max(0, Math.ceil((mesesMeta - meses) * SEMANAS_POR_MES));
  let falta = null;
  if (siguiente === 'intermedio') falta = `Subes a intermedio con ${semanasFaltan} semana${semanasFaltan === 1 ? '' : 's'} más entrenando 2 o más días.`;
  else if (siguiente === 'avanzado' && semanasFaltan > 0) falta = `Subes a avanzado con ${semanasFaltan} semanas más entrenando 2 o más días, y un ritmo de 3 días o más por semana.`;
  else if (siguiente === 'avanzado') falta = 'Subes a avanzado cuando entrenes 3 días o más por semana durante 12 semanas.';
  return {
    nivel: actual, declarado: nivelDeclarado(r), alcanzado, sube: alcanzado !== actual,
    meses: Math.round(meses * 10) / 10, semanasConstantes, ritmo: Math.round(ritmo * 10) / 10, siguiente, semanasFaltan, falta,
  };
}
