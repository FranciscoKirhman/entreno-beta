// Cada propuesta del chat trae su paquete completo (un plan de un mes pesa unos 130 KB). Una vez aceptada, descartada o
// vencida ya no se puede aplicar, así que guardar ese paquete en el teléfono solo gasta espacio: Safari da unos 5 MB y
// diez propuestas viejas llegaban a la mitad. Se conservan el resumen y el estado; el detalle queda en la cuenta.
const RESUELTA = ['aplicada', 'descartada', 'no_disponible'];

/** Quita el paquete de las propuestas que ya no se pueden aceptar. Devuelve cuántas compactó.
 *  protegida: la propuesta cuya confirmación falta comprobar (E.chatPorTraer), que nunca se toca. */
export function compactarChat(chat, { ahora = Date.now(), protegida = null } = {}) {
  let n = 0;
  for (const m of Array.isArray(chat) ? chat : []) {
    const p = m?.propuesta;
    if (!p || typeof p !== 'object' || !p.paquete || p.id === protegida || m.estadoPropuesta === 'por_comprobar') continue;
    const vencida = !m.estadoPropuesta && p.vence && Date.parse(p.vence) < ahora;
    if (!RESUELTA.includes(m.estadoPropuesta) && !RESUELTA.includes(p.estado) && !vencida) continue;
    delete p.paquete;
    if (vencida) { m.estadoPropuesta = 'no_disponible'; m.opciones = null; }
    n += 1;
  }
  return n;
}
