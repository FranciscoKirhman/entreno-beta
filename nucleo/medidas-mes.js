// Tarjeta mensual privada de fotos y medidas, en Tu actividad. Solo con permiso (medidas del cuerpo o fotos de
// progreso) y solo para la persona. La tarjeta no lleva ningún valor: el feed guarda una copia de cada tarjeta vista y
// la sube a la cuenta (feed_vistas), y ahí no debe viajar un dato de salud. Las cifras se calculan al dibujarla, en el
// teléfono, con comparacionMes.
import { CAMPOS_MEDIDA } from './medidas.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = mes => MESES[Number(mes.slice(5, 7)) - 1];
const mesAnterior = mes => { const d = new Date(`${mes}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };

/**
 * La tarjeta del mes en curso, o null sin permiso. Una por mes: su id no cambia, así "Listo" la deja en el historial
 * hasta el mes siguiente.
 * @returns {{id, tipo: 'medidas', fecha, mes, titulo, texto, medidas: boolean, fotos: boolean} | null}
 */
export function tarjetaMedidasMes({ consentimientos = {}, hoy }) {
  const medidas = Boolean(consentimientos.medidas_cuerpo), fotos = Boolean(consentimientos.fotos_progreso);
  if (!hoy || (!medidas && !fotos)) return null;
  const mes = hoy.slice(0, 7);
  const que = medidas && fotos ? 'tu cintura y tu foto' : medidas ? 'tu cintura o tu peso' : 'tu foto';
  // Con la fecha de hoy: queda entre lo primero de Tu actividad hasta que se toca Listo, una vez al mes.
  return { id: `medidas:${mes}`, tipo: 'medidas', fecha: hoy, mes, medidas, fotos,
    titulo: `Tu ${nombreMes(mes)} en ${medidas && fotos ? 'medidas y fotos' : medidas ? 'medidas' : 'fotos'}`,
    texto: `Anota ${que} de este mes: se compara con el mes anterior. Solo tú lo ves.` };
}

/**
 * Lo que se muestra dentro de la tarjeta, calculado en el teléfono: por cada medida con dato este mes, su valor y el
 * cambio contra la última del mes anterior. Y si falta anotar este mes.
 * @returns {{mes, anterior, filas: [{campo, nombre, unidad, ahora, antes, cambio}], falta: boolean}}
 */
export function comparacionMes(lista = [], mes) {
  const anterior = mesAnterior(mes);
  const ultima = (m, campo) => lista.filter(x => x.fecha?.startsWith(m) && x[campo] != null).sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1)?.[campo] ?? null;
  const filas = CAMPOS_MEDIDA.map(([campo, nombre, unidad]) => {
    const ahora = ultima(mes, campo), antes = ultima(anterior, campo);
    return ahora == null ? null : { campo, nombre, unidad, ahora, antes, cambio: antes == null ? null : Math.round((ahora - antes) * 10) / 10 };
  }).filter(Boolean);
  return { mes, anterior, filas, falta: !filas.length };
}

/** Lo mismo para las fotos: cuántas hay este mes y el mes anterior (fotos: [{fecha}]). */
export function fotosDelMes(fotos = [], mes) {
  const anterior = mesAnterior(mes), de = m => fotos.filter(f => f.fecha?.startsWith(m)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { ahora: de(mes), antes: de(anterior) };
}
