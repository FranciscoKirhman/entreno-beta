// Resumen al terminar una sesión, como el de Hevy al guardar: cuánto levantaste, los récords y qué salió bien y qué
// salió mal, comparado con el plan del día y con la vez anterior. Devuelve datos; la pantalla los dice en palabras.
import { esDeTrabajoGuardada } from './registro.js';
import { recordsDeSesion } from './records.js';

const n = v => (v == null || v === '' ? null : Number(v));
// La ayuda de la máquina (ejercicios asistidos) no es peso levantado: no suma al volumen.
const volumenDe = (series, asistidos = new Set()) => series.filter(s => !asistidos.has(s.ejercicio_id)).reduce((a, s) => a + (n(s.carga_kg) || 0) * (n(s.reps) || 0), 0);

/**
 * @param sesion    sesión guardada {fecha, hora, titulo, duracion_min, series: [{ejercicio_id, ejercicio_nombre, tipo, carga_kg, reps, duracion_seg, rir, rpe}]}
 * @param dia       el día del plan de esa fecha (para comparar con lo pedido), o null
 * @param historial series de trabajo anteriores a la sesión, también las de otra sesión más temprano el mismo día
 *                  [{fecha, ejercicio_id, carga_kg, reps, duracion_seg, rir, rpe}]
 * @param asistidos ids de ejercicios asistidos (su peso es ayuda: no cuenta para récords de peso)
 * @returns {{minutos, volumen, seriesTrabajo, ejercicios, records, bien, mal, porEjercicio}}
 *   bien: [{tipo: 'record' | 'rango_completo' | 'mejor_que_antes', ejercicio_id, ...}]
 *   mal:  [{tipo: 'no_hecho' | 'menos_series' | 'bajo_rango' | 'fallo_no_pedido' | 'menos_que_antes', ejercicio_id, ...}]
 */
export function resumenSesion({ sesion, dia = null, historial = [], asistidos = new Set() }) {
  const trabajo = (sesion.series || []).filter(esDeTrabajoGuardada);
  const clave = s => s.ejercicio_id || `nombre:${s.ejercicio_nombre}`;
  const porEjercicio = [];
  for (const s of trabajo) {
    let g = porEjercicio.find(x => x.clave === clave(s));
    if (!g) porEjercicio.push(g = { clave: clave(s), ejercicio_id: s.ejercicio_id || null, nombre: s.ejercicio_nombre || null, series: [] });
    g.series.push(s);
  }
  for (const g of porEjercicio) {
    const previas = g.ejercicio_id ? historial.filter(h => h.ejercicio_id === g.ejercicio_id && h.fecha <= sesion.fecha) : [];
    const ultima = previas.reduce((m, h) => (h.fecha > m ? h.fecha : m), '');
    g.anterior = ultima ? previas.filter(h => h.fecha === ultima) : [];
    g.plan = dia?.ejercicios?.find(e => e.ejercicio_id && e.ejercicio_id === g.ejercicio_id) || null;
    g.volumen = volumenDe(g.series, asistidos);
  }
  const records = recordsDeSesion(historial.filter(h => h.fecha <= sesion.fecha), trabajo, { asistidos });
  const bien = records.map(r => ({ tipo: 'record', ejercicio_id: r.ejercicio_id, record: r }));
  const mal = [];
  for (const g of porEjercicio) {
    const p = g.plan, conPeso = !asistidos.has(g.ejercicio_id) && g.series.some(s => n(s.carga_kg) > 0);
    if (p && (p.unidad || 'reps') === 'reps') {
      const reps = g.series.map(s => n(s.reps)).filter(x => x != null);
      if (g.series.length >= p.series && reps.length && reps.every(r => r >= p.reps_max)) bien.push({ tipo: 'rango_completo', ejercicio_id: g.ejercicio_id, reps_max: p.reps_max });
      const baja = Math.min(...reps);
      if (reps.length && baja < p.reps_min) mal.push({ tipo: 'bajo_rango', ejercicio_id: g.ejercicio_id, reps: baja, reps_min: p.reps_min, reps_max: p.reps_max });
      if (p.rir >= 1 && g.series.some(s => s.tipo === 'fallo' || n(s.rir) === 0)) mal.push({ tipo: 'fallo_no_pedido', ejercicio_id: g.ejercicio_id, rir: p.rir });
    }
    if (p && g.series.length < p.series) mal.push({ tipo: 'menos_series', ejercicio_id: g.ejercicio_id, hechas: g.series.length, plan: p.series });
    const antes = volumenDe(g.anterior, asistidos);
    if (conPeso && antes > 0 && !records.some(r => r.ejercicio_id === g.ejercicio_id)) {
      if (g.volumen > antes * 1.02) bien.push({ tipo: 'mejor_que_antes', ejercicio_id: g.ejercicio_id, volumen: g.volumen, antes });
      else if (g.volumen < antes * 0.8) mal.push({ tipo: 'menos_que_antes', ejercicio_id: g.ejercicio_id, volumen: g.volumen, antes });
    }
  }
  for (const e of dia?.ejercicios || []) {
    if (e.ejercicio_id && !porEjercicio.some(g => g.ejercicio_id === e.ejercicio_id)) mal.push({ tipo: 'no_hecho', ejercicio_id: e.ejercicio_id, nombre: e.nombre || null });
  }
  return {
    minutos: n(sesion.duracion_min), volumen: volumenDe(trabajo, asistidos), seriesTrabajo: trabajo.length,
    ejercicios: porEjercicio.length, records, bien, mal, porEjercicio,
  };
}
