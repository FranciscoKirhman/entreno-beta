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
 * Deshace entera la superserie de los ejercicios dados (por id): cada uno vuelve a ir solo, en el mismo lugar y con su
 * propio descanso. Las demás superseries quedan como estaban. Para "Separar" (Francisco, 28 de octubre de 2026).
 */
export function deshacer(ejercicios, ids) {
  return limpiar(ejercicios.map(e => {
    const x = { ...e };
    if (ids.has(e.ejercicio_id)) delete x.superserie;
    return x;
  }));
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

/**
 * El orden nuevo de una sesión sin partir sus superseries: al mover un ejercicio de una superserie, sus compañeros
 * van con él (Francisco, 11 de noviembre de 2026: antes quedaba separada y se hacía como series normales). Y un
 * ejercicio suelto que cae en medio de una superserie queda justo después de ella.
 * @param ejercicios la sesión como está (con su `superserie`)
 * @param orden      el orden pedido, por clave (clave(e, i))
 * @param clave      cómo se nombra cada ejercicio en `orden`
 * @returns las claves en el orden final
 */
export function ordenSinPartirSuperseries(ejercicios, orden = [], clave = (e, i) => e.ejercicio_id || `i${i}`) {
  const claves = ejercicios.map(clave), g = grupos(ejercicios);
  const lugar = k => { const i = orden.indexOf(k); return i < 0 ? Infinity : i; };
  const pedido = claves.map((k, i) => [k, i]).sort(([a, i], [b, j]) => lugar(a) - lugar(b) || i - j).map(([k]) => k);
  if (!g.some(Boolean)) return pedido;
  const grupoDe = new Map(claves.map((k, i) => [k, g[i] ? g[i].miembros.map(m => claves[m]) : null]));
  // El que se movió: sin él, el resto quedó en el mismo orden relativo. Con varios cambios a la vez no hay uno solo.
  const movido = claves.find(k => claves.filter(x => x !== k).join('\u0001') === pedido.filter(x => x !== k).join('\u0001') && claves.indexOf(k) !== pedido.indexOf(k)) ?? null;
  // Dónde va cada superserie: donde quedó el miembro movido o, si no fue uno de ellos, donde quedó su primer miembro.
  const ancla = new Map();
  for (const miembros of new Set([...grupoDe.values()].filter(Boolean))) {
    ancla.set(miembros, miembros.includes(movido) ? movido : miembros.reduce((a, k) => (pedido.indexOf(k) < pedido.indexOf(a) ? k : a)));
  }
  const out = [], puestos = new Set();
  for (const k of pedido) {
    if (puestos.has(k)) continue;
    const miembros = grupoDe.get(k);
    if (!miembros) { out.push(k); puestos.add(k); continue; }
    if (ancla.get(miembros) !== k) continue; // entra con su superserie, cuando llegue el ancla
    for (const m of miembros) { out.push(m); puestos.add(m); }
  }
  return out;
}
