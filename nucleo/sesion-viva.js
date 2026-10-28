// La sesión que se ajusta mientras se hace. Lee lo hecho hoy (series, esfuerzo y notas) y arma cambios para lo que
// queda: quitar o agregar series y ejercicios, bajar o subir el peso, más reserva, o cambiar una máquina ocupada.
// La app muestra cada cambio con lo que había antes y lo que queda ahora, y lo aplica sola a los 10 segundos salvo que
// la persona lo rechace (app/hoy.js). Pedido de Francisco, 21 de octubre de 2026: "que no pregunte pero que diga que lo
// cambió y por qué", "que la persona pueda rechazar el cambio", "el botón aceptar solo 10 segundos y luego auto acepta",
// "que diga qué es lo anterior todo el tiempo" y "que cambie en base a notas".
// El peso y las repeticiones de la serie siguiente los ajusta además el consejo de cada serie (nucleo/series.js), y el
// peso de partida de cada ejercicio, nucleo/fatiga-sesion.js.
import { SERIES_SESION } from './fatiga-sesion.js';

export const SEGUNDOS_PARA_ACEPTAR = 10;
const TRABAJO = new Set(['normal', 'fallo']);
const cuenta = ej => ej && ej.tipo !== 'core' && ej.tipo !== 'cardio' && ej.tipo !== 'movilidad';
const reservaDe = s => (s.tipo === 'fallo' ? 0 : s.rir != null ? Number(s.rir) : s.rpe != null ? 10 - Number(s.rpe) : null);
const deTrabajo = s => s && TRABAJO.has(s.tipo || 'normal');
const MUCHO = 10; // sobre esto un músculo ya tiene suficiente hoy
const sinTildes = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const kgTexto = n => `${String(Math.round(n * 100) / 100).replace('.', ',')} kg`;
const bajarA = (kg, f, inc) => Math.max(inc, Math.floor((kg * f) / inc + 1e-9) * inc);
// Una firma corta del texto de la nota: si la persona la cambia, se vuelve a leer.
const firma = t => { let h = 0; for (const c of sinTildes(t)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };

/** "3 × 10 a 15 con 54 kg": cómo está un ejercicio, para mostrar el antes y el ahora. */
export function describir(e) {
  if (!e) return 'no estaba';
  const reps = e.reps_min === e.reps_max ? `${e.reps_min}` : `${e.reps_min} a ${e.reps_max}`;
  return `${e.series} × ${reps}${e.carga_kg ? ` con ${kgTexto(Number(e.carga_kg))}` : ''}${e.rir != null ? `, ${e.rir} de reserva` : ''}`;
}

/** Lo que dice una nota, en pocas categorías. Las molestias leves no se tratan como lesión: solo se aliviana. */
export function leerNota(texto) {
  const t = sinTildes(texto);
  if (!t.trim()) return null;
  if (/ocupad|no hay (la |una )?maquina|no esta la maquina|sin maquina/.test(t)) return 'ocupada';
  if (/(duele|dolor|molest|pincha|tirón|tiron)/.test(t)) return /(mucho|fuerte|no puedo|no pude|para[rd]|grave)/.test(t) ? 'dolor_fuerte' : 'molestia';
  if (/(facil|liviano|me sobr|podia mas|podria mas|suave|quedo corto)/.test(t)) return 'facil';
  if (/(pesad|me costo|muy duro|dificil|no pude|no llegue|no alcance|reventad|muerto|agotad)/.test(t)) return 'pesado';
  return null;
}

/**
 * @param dia       el día del plan, con sus ejercicios en orden
 * @param registro  E.registro[fecha]: {[ejercicio_id]: filas}
 * @param o.notas   {[ejercicio_id]: texto de la nota de hoy}
 * @param o.porId   catálogo por id
 * @param o.minutos minutos que lleva la sesión; o.disponibles, los que tiene (null: sin límite)
 * @param o.prioridad músculos que la persona quiere priorizar
 * @param o.candidato (musculo, excluir) => ejercicio del catálogo para agregar
 * @param o.alternativa (ejercicio_id, excluir) => ejercicio parecido para una máquina ocupada
 * @param o.incrementoDe (ej) => escalón en kg
 * @returns {{propuestas: object[], hechas: {[musculo]: number}}}
 *   propuesta: {id, tipo, ejercicio_id, nombre, accion (lo que va a hacer), hecho (lo que hizo), motivo, cambio}
 */
export function sesionViva(dia, registro = {}, { notas = {}, porId, minutos = null, disponibles = null, prioridad = [], candidato = null, alternativa = null, incrementoDe = () => 2.5 } = {}) {
  const ejs = dia?.ejercicios || [];
  const filas = e => registro[e.ejercicio_id] || [];
  const hechasDe = e => filas(e).filter(s => s?.hecho && deTrabajo(s));
  const faltan = e => Math.max(0, (e.series || 0) - hechasDe(e).length);
  const hechas = {};
  for (const e of ejs) {
    const ej = porId.get(e.ejercicio_id);
    if (!cuenta(ej)) continue;
    for (const m of ej.musculos_primarios) hechas[m] = (hechas[m] || 0) + hechasDe(e).length;
  }
  const empezada = ejs.some(e => filas(e).some(s => s?.hecho)) || Object.values(notas).some(Boolean);
  const propuestas = [];
  if (!empezada) return { propuestas, hechas };
  const lleno = (ej, n) => ej.musculos_primarios.every(m => (hechas[m] || 0) >= n);
  const minimoHechas = ej => Math.min(...ej.musculos_primarios.map(m => hechas[m] || 0));
  const poner = p => propuestas.push(p);

  ejs.forEach((e, k) => {
    const ej = porId.get(e.ejercicio_id);
    if (!cuenta(ej) || (e.unidad || 'reps') !== 'reps') return;
    const h = hechasDe(e), quedan = faltan(e), nombre = ej.nombre, inc = incrementoDe(ej) || 2.5;
    const base = { ejercicio_id: e.ejercicio_id, nombre };

    // Notas: lo que la persona escribió de este ejercicio cambia lo que queda de él.
    const nota = leerNota(notas[e.ejercicio_id]);
    if (nota) {
      const id = `nota-${nota}:${e.ejercicio_id}:${firma(notas[e.ejercicio_id])}`;
      if (nota === 'ocupada' && !h.length && alternativa) {
        const otro = alternativa(e.ejercicio_id, new Set(ejs.map(x => x.ejercicio_id)));
        if (otro) return poner({ ...base, id, tipo: 'reemplazar', a: otro.id, accion: `cambiarlo por ${otro.nombre}`, hecho: `Lo cambié por ${otro.nombre}`, motivo: 'anotaste que la máquina está ocupada' });
      }
      if (nota === 'dolor_fuerte' && quedan) return poner({ ...base, id, tipo: 'quitar_series', series: h.length, accion: quedan === 1 ? 'quitar la serie que queda' : `quitar las ${quedan} que quedan`, hecho: quedan === 1 ? 'Quité la serie que quedaba' : `Quité las ${quedan} que quedaban`, motivo: 'anotaste que duele bastante; si sigue, cuéntaselo al coach' });
      // El peso al que va, no "un escalón": así se lee sin hacer la cuenta (28 de octubre de 2026).
      if ((nota === 'molestia' || nota === 'pesado') && quedan && e.carga_kg) {
        const f = nota === 'molestia' ? 0.9 : 0.95, nuevo = bajarA(Number(e.carga_kg), f, inc);
        return poner({ ...base, id, tipo: 'ajustar', carga_kg: nuevo, rir: Math.min(4, (e.rir ?? 2) + (nota === 'molestia' ? 1 : 0)),
          accion: `bajar a ${kgTexto(nuevo)} lo que queda`, hecho: `Bajé a ${kgTexto(nuevo)} lo que queda`, motivo: nota === 'molestia' ? 'anotaste una molestia: más liviano y con una de reserva más' : 'anotaste que te está costando' });
      }
      if (nota === 'facil' && quedan && e.carga_kg) {
        const nuevo = Number(e.carga_kg) + inc;
        return poner({ ...base, id, tipo: 'ajustar', carga_kg: nuevo, accion: `subir a ${kgTexto(nuevo)} lo que queda`, hecho: `Subí a ${kgTexto(nuevo)} lo que queda`, motivo: 'anotaste que está fácil' });
      }
    }

    // Las dos últimas series bajo el rango o al fallo pidiendo reserva: lo que queda ya no suma.
    const ult = h.slice(-2);
    const bajo = ult.length === 2 && ult.every(s => Number(s.reps) < (e.reps_min || 0));
    const alFallo = ult.length === 2 && ult.every(s => e.rir >= 1 && reservaDe(s) != null && reservaDe(s) <= 0);
    if (quedan && (bajo || alFallo)) {
      return poner({ ...base, id: `quitar-series:${e.ejercicio_id}`, tipo: 'quitar_series', series: h.length,
        accion: quedan === 1 ? 'quitar la serie que queda' : `quitar las ${quedan} que quedan`, hecho: quedan === 1 ? 'Quité la serie que quedaba' : `Quité las ${quedan} que quedaban`,
        motivo: `las dos últimas ${bajo ? `quedaron bajo ${e.reps_min}` : 'llegaron al fallo'} y ya tienes el estímulo` });
    }
    // Un ejercicio que no empieza y cuyos músculos ya pasaron el tope por sesión: sale; si van cerca, queda en 2.
    if (!h.length && k > 0 && lleno(ej, SERIES_SESION.aviso)) {
      return poner({ ...base, id: `quitar-ejercicio:${e.ejercicio_id}`, tipo: 'quitar_ejercicio', accion: 'sacarlo por hoy', hecho: 'Lo saqué por hoy',
        motivo: `${ej.musculos_primarios.length > 1 ? 'esos músculos ya llevan' : 'ese músculo ya lleva'} ${minimoHechas(ej)} series hoy y más rinden poco` });
    }
    if (!h.length && k > 0 && lleno(ej, MUCHO - 2) && e.series > 2) {
      return poner({ ...base, id: `menos-series:${e.ejercicio_id}`, tipo: 'quitar_series', series: 2, accion: `dejarlo en 2 series en vez de ${e.series}`, hecho: `Lo dejé en 2 series en vez de ${e.series}`,
        motivo: `llegas con ${minimoHechas(ej)} series del mismo músculo` });
    }
    // Con más de 10 series del músculo hoy, lo que queda va con una repetición más de reserva.
    if (quedan && e.rir != null && e.rir < 3 && lleno(ej, MUCHO)) {
      return poner({ ...base, id: `reserva:${e.ejercicio_id}`, tipo: 'ajustar', rir: e.rir + 1, accion: `dejar ${e.rir + 1} de reserva en vez de ${e.rir}`, hecho: `Ahora deja ${e.rir + 1} de reserva en vez de ${e.rir}`,
        motivo: `esos músculos ya llevan más de ${MUCHO} series hoy` });
    }
    // Terminado, con todas las series fáciles y espacio en el músculo: una serie más, un escalón más arriba.
    const faciles = h.length >= 2 && h.every(s => (reservaDe(s) != null && reservaDe(s) >= (e.rir ?? 2) + 1.5) || (Number(s.reps) > (e.reps_max || 99) && (reservaDe(s) ?? e.rir) >= (e.rir ?? 2)));
    if (!quedan && faciles && !lleno(ej, MUCHO) && e.series < 6) {
      const kg = Number(h.at(-1).kg), sube = kg > 0 ? kg + inc : null;
      poner({ ...base, id: `agregar-serie:${e.ejercicio_id}`, tipo: 'agregar_serie', carga_kg: sube,
        accion: `agregar una serie más${sube ? ` con ${kgTexto(sube)}` : ''}`, hecho: `Agregué una serie más${sube ? ` con ${kgTexto(sube)}` : ''}`, motivo: `te sobró en las ${h.length} series` });
    }
  });

  // Todo lo de pesas hecho, con tiempo de sobra y un músculo del día corto: un ejercicio más para él.
  const pendientes = ejs.filter(e => cuenta(porId.get(e.ejercicio_id)) && faltan(e) > 0);
  const sobra = disponibles == null ? 20 : disponibles - (minutos ?? 0);
  if (!pendientes.length && candidato && sobra >= 12) {
    const delDia = [...new Set(ejs.flatMap(e => (cuenta(porId.get(e.ejercicio_id)) ? porId.get(e.ejercicio_id).musculos_primarios : [])))];
    const m = [...prioridad, ...delDia].find(x => delDia.includes(x) && (hechas[x] || 0) < MUCHO - 2);
    const ej = m ? candidato(m, new Set(ejs.map(e => e.ejercicio_id))) : null;
    if (ej) poner({ id: `agregar-ejercicio:${ej.id}`, tipo: 'agregar_ejercicio', ejercicio_id: ej.id, nombre: ej.nombre, accion: `agregar ${ej.nombre}, 3 series`, hecho: `Agregué ${ej.nombre}, 3 series`,
      motivo: `te ${disponibles == null ? 'queda tiempo' : `quedan unos ${Math.round(sobra)} minutos`} y ${m} lleva ${hechas[m] || 0} series hoy` });
  }
  return { propuestas, hechas };
}

/**
 * Aplica un cambio al día. Nunca saca lo hecho: quitar series deja al menos las ya hechas y un ejercicio empezado no
 * sale ni se reemplaza.
 * @param nuevoEjercicio (ejercicio_id, orden, como) => prescripción para agregar o reemplazar (la arma la app)
 * @returns {{ejercicios, antes, ahora}} antes y ahora: cómo estaba y cómo quedó el ejercicio, en palabras
 */
export function aplicarViva(ejercicios, p, registro = {}, nuevoEjercicio = null) {
  const lista = ejercicios.map(e => ({ ...e }));
  const hechas = id => (registro[id] || []).filter(s => s?.hecho && deTrabajo(s)).length;
  const i = lista.findIndex(e => e.ejercicio_id === p.ejercicio_id);
  const antes = i < 0 ? 'no estaba' : p.tipo === 'reemplazar' ? `${p.nombre}: ${describir(lista[i])}` : describir(lista[i]);
  let ahora = antes;
  if (p.tipo === 'quitar_series' && i >= 0) { lista[i].series = Math.max(hechas(lista[i].ejercicio_id), Math.min(lista[i].series, p.series)); ahora = describir(lista[i]); }
  else if (p.tipo === 'quitar_ejercicio' && i >= 0 && !hechas(lista[i].ejercicio_id)) { lista.splice(i, 1); ahora = 'fuera por hoy'; }
  else if (p.tipo === 'agregar_serie' && i >= 0) { lista[i].series += 1; if (p.carga_kg) lista[i].carga_kg = p.carga_kg; ahora = describir(lista[i]); }
  else if (p.tipo === 'ajustar' && i >= 0) { if (p.carga_kg != null) lista[i].carga_kg = p.carga_kg; if (p.rir != null) lista[i].rir = p.rir; ahora = describir(lista[i]); }
  else if (p.tipo === 'reemplazar' && i >= 0 && !hechas(lista[i].ejercicio_id) && nuevoEjercicio) {
    lista[i] = nuevoEjercicio(p.a, i, lista[i]);
    ahora = `${lista[i].nombre}: ${describir(lista[i])}`;
  }
  else if (p.tipo === 'agregar_ejercicio' && i < 0 && nuevoEjercicio) { lista.push(nuevoEjercicio(p.ejercicio_id, lista.length)); ahora = describir(lista.at(-1)); }
  return { ejercicios: lista.map((e, k) => ({ ...e, orden: k })), antes, ahora };
}
