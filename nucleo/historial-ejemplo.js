// Historial inventado para probar la versión de prueba: 8 semanas de una persona intermedia que entrena torso y
// pierna 4 días a la semana, con cargas que suben de a poco, una semana de descarga y alguna sesión que faltó. No
// es de nadie: sirve para ver "la vez anterior", las marcas, el mapa de la semana y que el plan parta con pesos.

// [id, carga inicial en kg (null: peso corporal o segundos), cuánto sube cada 2 semanas, series, reps mínimas y máximas]
const DIAS = [
  { dia: 0, titulo: 'Torso A', ejercicios: [['press_banca_barra', 40, 2.5, 3, 6, 10], ['jalon_polea', 45, 2.5, 3, 8, 12], ['press_hombro_mancuernas', 12, 2, 3, 8, 12], ['remo_polea', 40, 2.5, 3, 8, 12], ['curl_mancuernas', 10, 1, 2, 10, 15], ['triceps_cuerda', 20, 2.5, 2, 10, 15]] },
  { dia: 1, titulo: 'Pierna A', ejercicios: [['sentadilla_barra', 50, 2.5, 3, 6, 10], ['peso_muerto_rumano_barra', 50, 2.5, 3, 8, 10], ['prensa', 100, 5, 3, 10, 12], ['curl_femoral_sentado', 35, 2.5, 3, 10, 12], ['pantorrilla_maquina', 40, 2.5, 3, 10, 15], ['plancha', null, 0, 2, 30, 45]] },
  { dia: 3, titulo: 'Torso B', ejercicios: [['press_inclinado_mancuernas', 16, 2, 3, 8, 12], ['remo_mancuerna', 20, 2, 3, 8, 12], ['elevaciones_laterales', 6, 1, 3, 12, 15], ['face_pull', 15, 2.5, 2, 12, 15], ['curl_martillo', 10, 1, 2, 10, 12]] },
  { dia: 4, titulo: 'Pierna B', ejercicios: [['hip_thrust_barra', 60, 5, 3, 8, 12], ['bulgara_mancuernas', 10, 2, 3, 8, 10], ['extension_cuadriceps', 35, 2.5, 3, 10, 15], ['abductora', 40, 2.5, 2, 12, 15], ['crunch_polea', 25, 2.5, 2, 10, 15]] },
];
const SEMANA_DESCARGA = 5; // de 1 a 8: la mitad de las series y más reserva
const FALTAS = new Set(['3-3', '6-1']); // semana-día que "faltó"

const sumarDias = (f, n) => new Date(Date.parse(f + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const lunesDe = f => sumarDias(f, -((new Date(f + 'T12:00:00Z').getUTCDay() + 6) % 7));

/** Números pseudoaleatorios repetibles, para que el ejemplo sea siempre el mismo. */
function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

/**
 * Las sesiones de ejemplo, en el formato del teléfono (como las importadas de Hevy), de las 8 semanas anteriores a
 * la semana de `hoy`. Llevan origen 'ejemplo' para poder sacarlas.
 */
export function historialDeEjemplo(hoy, indice, semanas = 8) {
  const r = azar(20261002);
  const inicio = sumarDias(lunesDe(hoy), -7 * semanas);
  const out = [];
  for (let w = 1; w <= semanas; w++) {
    const descarga = w === SEMANA_DESCARGA;
    for (const d of DIAS) {
      if (FALTAS.has(`${w}-${d.dia}`)) continue;
      const fecha = sumarDias(inicio, (w - 1) * 7 + d.dia);
      if (fecha >= hoy) continue;
      const series = [];
      for (const [id, carga0, paso, nSeries, rmin, rmax] of d.ejercicios) {
        const ej = indice.porId.get(id);
        if (!ej) continue;
        const subidas = Math.floor((w - 1) / 2) - (w > SEMANA_DESCARGA ? 1 : 0);
        const carga = carga0 == null ? null : Math.round((carga0 + paso * Math.max(0, subidas)) * 2) / 2;
        const seg = ej.patron.startsWith('core_estabilidad');
        // Un calentamiento en lo principal, con la mitad del peso.
        if (carga && d.ejercicios[0][0] === id) series.push({ ejercicio_id: id, ejercicio_nombre: ej.nombre, tipo: 'calentamiento', carga_kg: Math.round(carga / 2), reps: 10, duracion_seg: null, rpe: null, rir: null });
        for (let i = 0; i < (descarga ? Math.ceil(nSeries / 2) : nSeries); i++) {
          // Más repeticiones a medida que avanza entre subidas de peso; un poco menos en las últimas series.
          const base = rmin + Math.round(((w - 1) % 2) * (rmax - rmin) / 2) + (r() < 0.3 ? 1 : 0) - (i === nSeries - 1 && r() < 0.5 ? 1 : 0);
          const reps = Math.max(rmin, Math.min(rmax, base));
          const rpe = descarga ? 6.5 : [7.5, 8, 8, 8.5, 9][Math.floor(r() * 5)];
          series.push(seg
            ? { ejercicio_id: id, ejercicio_nombre: ej.nombre, tipo: 'efectiva', carga_kg: null, reps: null, duracion_seg: reps + 5 * subidas, rpe: null, rir: null }
            : { ejercicio_id: id, ejercicio_nombre: ej.nombre, tipo: 'efectiva', carga_kg: carga, reps, duracion_seg: null, rpe, rir: Math.max(0, 10 - rpe) });
        }
      }
      out.push({ id: `ejemplo-${fecha}`, origen: 'ejemplo', fecha, titulo: d.titulo, duracion_min: descarga ? 40 : 55 + Math.round(r() * 15), notas: [],
        series: series.map((s, orden) => ({ orden, ...s })) });
    }
  }
  return out;
}
