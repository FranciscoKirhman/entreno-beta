// Peso del cuerpo desde la exportación de Apple Health (export.xml), como permite OpenGym. El archivo puede pesar
// cientos de MB: se lee por partes y solo se buscan los registros de peso (HKQuantityTypeIdentifierBodyMass).
// Queda un valor por día (el último del día), en kilos.

const LB = 0.45359237;
const REGISTRO = /<Record\b[^>]*type="HKQuantityTypeIdentifierBodyMass"[^>]*>/g;
const atributo = (tag, nombre) => tag.match(new RegExp(`\\b${nombre}="([^"]*)"`))?.[1];

/** Lector por partes: agregar(texto) con cada trozo y al final pesos() → [{fecha, peso_kg}] por fecha. */
export function lectorPesos() {
  let resto = '';
  const porDia = new Map();
  const leer = texto => {
    for (const m of texto.matchAll(REGISTRO)) {
      const valor = Number(atributo(m[0], 'value')), unidad = atributo(m[0], 'unit') || 'kg';
      const fecha = (atributo(m[0], 'startDate') || '').slice(0, 10);
      if (!Number.isFinite(valor) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
      const kg = /lb/i.test(unidad) ? valor * LB : /^g$/i.test(unidad) ? valor / 1000 : valor;
      if (kg < 30 || kg > 300) continue;
      porDia.set(fecha, Math.round(kg * 10) / 10);
    }
  };
  return {
    agregar(trozo) {
      const texto = resto + trozo;
      const corte = texto.lastIndexOf('<Record'); // un registro puede quedar partido entre dos trozos
      if (corte < 0) { resto = texto.slice(-2000); return; }
      leer(texto.slice(0, corte));
      resto = texto.slice(corte);
    },
    pesos() { leer(resto); resto = ''; return [...porDia].sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, peso_kg]) => ({ fecha, peso_kg })); },
  };
}

/** Junta los pesos traídos con las medidas: no reemplaza un peso que ya anotaste ese día. */
export function juntarPesos(medidas = [], pesos = []) {
  const porFecha = new Map(medidas.map(m => [m.fecha, m]));
  let nuevos = 0;
  for (const p of pesos) {
    const m = porFecha.get(p.fecha);
    if (m?.peso_kg != null) continue;
    porFecha.set(p.fecha, { ...m, fecha: p.fecha, peso_kg: p.peso_kg });
    nuevos++;
  }
  return { medidas: [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)), nuevos };
}

/** Hacia la meta o lejos de ella: 'hacia', 'lejos' o null (sin meta o sin cambio). */
export function direccionMeta(desde, hasta, meta) {
  if (meta == null || desde == null || hasta == null || desde === hasta) return null;
  return Math.abs(hasta - meta) < Math.abs(desde - meta) ? 'hacia' : 'lejos';
}
