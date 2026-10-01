// Superseries: dos o más ejercicios seguidos, sin descanso entre ellos; el descanso va al terminar la vuelta.
// Cada ejercicio de una superserie lleva la misma letra (`superserie: 'A'`) y van juntos en la sesión. Una letra
// suelta o separada (por ejemplo, después de reemplazar un ejercicio) no cuenta como superserie.

export const LETRAS = 'ABCDEFGH';

/**
 * Superserie de cada ejercicio del día, en el orden de la lista.
 * @returns {Array<{letra, pos, total, miembros: number[]} | null>} pos va de 1 a total; miembros son índices.
 */
export function grupos(ejercicios) {
  const out = ejercicios.map(() => null);
  let i = 0;
  while (i < ejercicios.length) {
    const letra = ejercicios[i].superserie;
    let j = i;
    while (letra && j + 1 < ejercicios.length && ejercicios[j + 1].superserie === letra) j++;
    if (letra && j > i) {
      const miembros = Array.from({ length: j - i + 1 }, (_, n) => i + n);
      miembros.forEach((m, n) => { out[m] = { letra, pos: n + 1, total: miembros.length, miembros }; });
    }
    i = j + 1;
  }
  return out;
}

/** Deja solo las superseries válidas (seguidas, de 2 o más) y renumera el orden. */
function limpiar(ejercicios) {
  const g = grupos(ejercicios);
  return ejercicios.map((e, i) => {
    const x = { ...e, orden: i };
    if (g[i]) x.superserie = g[i].letra; else delete x.superserie;
    return x;
  });
}

/**
 * Une el ejercicio j a la superserie del i (o arma una nueva con los dos): j pasa a ir justo después del último
 * de esa superserie. Devuelve una lista nueva.
 */
export function unir(ejercicios, i, j) {
  if (i === j || !ejercicios[i] || !ejercicios[j]) return ejercicios;
  const g = grupos(ejercicios);
  const lista = ejercicios.map(e => ({ ...e }));
  // Si j estaba en otra superserie, sale de ella.
  if (g[j]) delete lista[j].superserie;
  const usadas = new Set(g.filter(Boolean).map(x => x.letra));
  const letra = g[i]?.letra || [...LETRAS].find(l => !usadas.has(l)) || 'H';
  lista[i].superserie = letra;
  lista[j].superserie = letra;
  const mover = lista[j];
  const sin = lista.filter((_, n) => n !== j);
  const ultimo = sin.reduce((u, e, n) => (e.superserie === letra && e !== mover ? n : u), -1);
  sin.splice(ultimo + 1, 0, mover);
  return limpiar(sin);
}

/** Saca el ejercicio i de su superserie; si queda uno solo, la superserie se deshace. Va al final de la que era. */
export function separar(ejercicios, i) {
  const g = grupos(ejercicios)[i];
  if (!g) return ejercicios;
  const lista = ejercicios.map(e => ({ ...e }));
  const [sale] = lista.splice(i, 1);
  delete sale.superserie;
  const fin = g.miembros.at(-1) - 1; // la superserie se corrió un lugar
  lista.splice(fin + 1, 0, sale);
  return limpiar(lista);
}

/**
 * Copia las superseries de un día a otro de la misma plantilla (las semanas siguientes): por ejercicio, con los
 * de cada superserie juntos en el mismo orden. Lo que no está en el día de origen queda como estaba.
 */
export function copiarSuperseries(origen, destino) {
  const g = grupos(origen);
  const letraDe = new Map(origen.map((e, i) => [e.ejercicio_id, g[i]?.letra || null]));
  const lista = destino.map(e => {
    const x = { ...e };
    if (letraDe.has(e.ejercicio_id)) { if (letraDe.get(e.ejercicio_id)) x.superserie = letraDe.get(e.ejercicio_id); else delete x.superserie; }
    return x;
  });
  // Junta a cada superserie donde está su primer ejercicio, en el orden del día de origen.
  const posOrigen = new Map(origen.map((e, i) => [e.ejercicio_id, i]));
  const out = [];
  for (const e of lista) {
    if (out.includes(e)) continue;
    if (!e.superserie) { out.push(e); continue; }
    out.push(...lista.filter(x => x.superserie === e.superserie).sort((a, b) => (posOrigen.get(a.ejercicio_id) ?? 99) - (posOrigen.get(b.ejercicio_id) ?? 99)));
  }
  return limpiar(out);
}

/**
 * Qué sigue después de marcar una serie del ejercicio k.
 * @param pendientes por ejercicio, cuántas series le faltan (después de marcar esta)
 * @returns {{ descansar: boolean, siguiente: number | null }} siguiente: el ejercicio que toca (índice), si es de la superserie.
 */
export function despuesDeSerie(ejercicios, k, pendientes) {
  const g = grupos(ejercicios)[k];
  if (!g) return { descansar: true, siguiente: null };
  const despues = g.miembros.filter(m => m > k && pendientes[m] > 0);
  if (despues.length) return { descansar: false, siguiente: despues[0] };
  const vuelta = g.miembros.find(m => pendientes[m] > 0);
  return { descansar: true, siguiente: vuelta ?? null };
}

/** Descanso de una superserie: el mayor de sus ejercicios, una vez por vuelta. */
export const descansoDeGrupo = (ejercicios, g, descansoDe = e => e.descanso_seg ?? 90) => Math.max(...g.miembros.map(m => descansoDe(ejercicios[m], m)));

/** Nombre corto para mostrar: "A1", "A2"… */
export const etiquetaSuperserie = g => (g ? `${g.letra}${g.pos}` : '');
