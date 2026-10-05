// La próxima serie de Hoy sigue lo último que se hizo, también al alternar una superserie. Las aproximaciones
// pendientes dejan de sugerirse cuando la persona ya hizo una serie de entrenamiento de ese ejercicio.
import { etiquetas, tipoDe } from './registro.js';
import { despuesDeSerie, grupos } from './superseries.js';

/**
 * @param dia día del plan, con sus ejercicios en orden
 * @param filasPorEjercicio filas ya materializadas por ejercicio, en el mismo orden que dia.ejercicios
 * @returns {{ejercicioIndice: number, ejercicioId: string, filaIndice: number, etiqueta: string} | null}
 * No cambia el día ni el registro. Los tiempos t son los milisegundos guardados al marcar cada serie. Si ninguna
 * serie hecha trae un tiempo válido, se elige la primera pendiente sin suponer cuál se hizo al final.
 */
export function siguienteSerie(dia, filasPorEjercicio = []) {
  const ejercicios = dia?.ejercicios || [];
  const listas = ejercicios.map((e, k) => filasPorEjercicio[k] || []);
  const filas = listas.flatMap((lista, k) => {
    const rotulos = etiquetas(lista);
    const entrenado = lista.some(s => s?.hecho && tipoDe(s) !== 'calentamiento');
    return lista.map((s, i) => ({
      s: s || {}, tipo: tipoDe(s), permitido: tipoDe(s) !== 'calentamiento' || !entrenado,
      ejercicioIndice: k, ejercicioId: ejercicios[k].ejercicio_id || `i${k}`, filaIndice: i, etiqueta: rotulos[i],
    }));
  });
  const pendientes = filas.filter(x => !x.s.hecho && x.permitido);
  // Las C son opcionales: terminar las series de entrenamiento no deja una C olvidada como próximo paso.
  if (!pendientes.some(x => x.tipo !== 'calentamiento')) return null;
  const resultado = x => x ? {
    ejercicioIndice: x.ejercicioIndice, ejercicioId: x.ejercicioId, filaIndice: x.filaIndice, etiqueta: x.etiqueta,
  } : null;
  const hechasConTiempo = filas.filter(x => x.s.hecho && Number.isFinite(Number(x.s.t)) && Number(x.s.t) > 0);
  const ultima = hechasConTiempo.reduce((a, x) => !a || Number(x.s.t) >= Number(a.s.t) ? x : a, null);
  if (!ultima) return resultado(pendientes[0]);
  const k = ultima.ejercicioIndice;

  // Un drop inmediatamente después sigue antes de cambiar de ejercicio o de vuelta de superserie.
  const drop = pendientes.find(x => x.ejercicioIndice === k && x.filaIndice === ultima.filaIndice + 1 && x.tipo === 'drop');
  if (drop) return resultado(drop);
  const delEjercicio = pendientes.find(x => x.ejercicioIndice === k);
  if (ultima.tipo === 'calentamiento' && delEjercicio) return resultado(delEjercicio);

  const grupo = grupos(ejercicios)[k];
  if (grupo) {
    const porEjercicio = ejercicios.map((_, j) => pendientes.filter(x => x.ejercicioIndice === j).length);
    const { siguiente } = despuesDeSerie(ejercicios, k, porEjercicio);
    if (siguiente != null) return resultado(pendientes.find(x => x.ejercicioIndice === siguiente));
  } else if (delEjercicio) return resultado(delEjercicio);

  const despues = grupo?.miembros.at(-1) ?? k;
  return resultado(pendientes.find(x => x.ejercicioIndice > despues) || pendientes[0]);
}
