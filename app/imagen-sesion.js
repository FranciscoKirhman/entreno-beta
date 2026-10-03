// Imagen para compartir una sesión, como la de Hevy: vertical (1080 × 1920, para historias de Instagram o WhatsApp),
// con el nombre de la sesión, minutos, kilos levantados, series, cada ejercicio con su mejor serie y los récords.
// Nunca lleva peso corporal, fotos ni datos de salud. Se dibuja en el teléfono, sin servidor.
const ANCHO = 1080, ALTO = 1920, M = 90;
const C = { fondo: '#1B2024', tarjeta: '#262D33', texto: '#FFFFFF', suave: '#AEB6BD', acento: '#C4562A', bien: '#5BBF86' };
const FUENTE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Corta un texto con "…" para que quepa en un ancho. */
function cortar(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}
/** Parte un título en hasta dos líneas. */
function lineas(ctx, texto, ancho) {
  const palabras = texto.split(' '), out = [''];
  for (const p of palabras) {
    const prueba = out.at(-1) ? `${out.at(-1)} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho || !out.at(-1)) out[out.length - 1] = prueba;
    else out.push(p);
  }
  return out.length > 2 ? [out[0], cortar(ctx, out.slice(1).join(' '), ancho)] : out;
}
function caja(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

/**
 * @param datos { titulo, fecha (texto ya formateado), cifras: [[valor, texto]], ejercicios: [[nombre, detalle]], records: [texto] }
 * @returns Promise<Blob> PNG
 */
export function imagenSesion({ titulo, fecha, cifras, ejercicios, records }) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO; lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, ANCHO, ALTO);
  // Franja de acento arriba
  ctx.fillStyle = C.acento; ctx.fillRect(0, 0, ANCHO, 16);
  let y = 150;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.acento; ctx.font = `700 40px ${FUENTE}`;
  ctx.fillText('ENTRENO', M, y);
  ctx.fillStyle = C.suave; ctx.font = `500 40px ${FUENTE}`;
  ctx.textAlign = 'right'; ctx.fillText(fecha, ANCHO - M, y); ctx.textAlign = 'left';
  y += 130;
  ctx.fillStyle = C.texto; ctx.font = `800 96px ${FUENTE}`;
  for (const l of lineas(ctx, titulo, ANCHO - 2 * M)) { ctx.fillText(l, M, y); y += 110; }
  y += 30;
  // Cifras: hasta 3 cajas
  const n = Math.min(3, cifras.length), gap = 24, w = (ANCHO - 2 * M - gap * (n - 1)) / n;
  cifras.slice(0, 3).forEach(([valor, texto], i) => {
    const x = M + i * (w + gap);
    caja(ctx, x, y, w, 230, 28, C.tarjeta);
    // La cifra se achica hasta caber (por ejemplo, "12.480 kg").
    let tam = 72;
    do { ctx.font = `800 ${tam}px ${FUENTE}`; tam -= 4; } while (tam > 36 && ctx.measureText(String(valor)).width > w - 56);
    ctx.fillStyle = C.texto;
    ctx.fillText(String(valor), x + 28, y + 115);
    ctx.fillStyle = C.suave; ctx.font = `500 38px ${FUENTE}`;
    ctx.fillText(cortar(ctx, texto, w - 56), x + 28, y + 182);
  });
  y += 320;
  // Ejercicios
  ctx.fillStyle = C.suave; ctx.font = `700 36px ${FUENTE}`;
  ctx.fillText('EJERCICIOS', M, y); y += 34;
  const maxEj = records.length ? 6 : 10;
  for (const [nombre, detalle] of ejercicios.slice(0, maxEj)) {
    if (y > ALTO - 420) break; // deja lugar a los récords y al pie
    y += 92;
    ctx.fillStyle = C.texto;
    const derecha = detalle ? (ctx.font = `500 46px ${FUENTE}`, ctx.measureText(detalle).width) : 0;
    ctx.font = `600 50px ${FUENTE}`;
    ctx.fillText(cortar(ctx, nombre, ANCHO - 2 * M - derecha - 30), M, y);
    if (detalle) { ctx.fillStyle = C.suave; ctx.font = `500 46px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText(detalle, ANCHO - M, y); ctx.textAlign = 'left'; }
  }
  if (ejercicios.length > maxEj) { y += 64; ctx.fillStyle = C.suave; ctx.font = `500 36px ${FUENTE}`; ctx.fillText(`y ${ejercicios.length - maxEj} más`, M, y); }
  // Récords
  if (records.length) {
    y += 110;
    ctx.fillStyle = C.acento; ctx.font = `700 36px ${FUENTE}`;
    ctx.fillText(records.length === 1 ? '1 RÉCORD' : `${records.length} RÉCORDS`, M, y); y += 24;
    for (const t of records.slice(0, 4)) {
      if (y > ALTO - 260) break;
      y += 80;
      ctx.fillStyle = C.acento; ctx.beginPath(); ctx.arc(M + 14, y - 15, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.texto; ctx.font = `500 44px ${FUENTE}`;
      ctx.fillText(cortar(ctx, t, ANCHO - 2 * M - 50), M + 46, y);
    }
    if (records.length > 4 && y < ALTO - 200) { y += 60; ctx.fillStyle = C.suave; ctx.font = `500 36px ${FUENTE}`; ctx.fillText(`y ${records.length - 4} más`, M + 46, y); }
  }
  ctx.fillStyle = C.suave; ctx.font = `500 34px ${FUENTE}`;
  ctx.textAlign = 'center'; ctx.fillText('Registrado con Entreno', ANCHO / 2, ALTO - 90);
  return new Promise((ok, mal) => lienzo.toBlob(b => (b ? ok(b) : mal(new Error('No pude armar la imagen.'))), 'image/png'));
}
