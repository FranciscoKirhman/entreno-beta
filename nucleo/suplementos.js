// Suplementos: registro diario y recordatorios de lo que la persona decide tomar.
// La app no recomienda suplementos (contenido/evidencia/00-principios.md): solo ayuda a no olvidarlos y a ver
// si se están tomando con constancia.
//
// Un suplemento configurado: { id, nombre, dosis, horas: ['08:00'], dias: [0..6] (vacío = todos), activo }
// Una toma registrada:      { suplemento_id, fecha: 'AAAA-MM-DD', hora: 'HH:MM' }

const diaSemana = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
const sumarDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// Sugerencias de nombre para el formulario, desde lo que se respondió en el cuestionario (pregunta suplementos).
export const DESDE_CUESTIONARIO = {
  creatina: { nombre: 'Creatina', dosis: '', horas: ['09:00'] },
  proteina: { nombre: 'Proteína en polvo', dosis: '', horas: ['18:00'] },
  cafeina: { nombre: 'Cafeína o pre-entreno', dosis: '', horas: [] },
};

/** Tomas que corresponden a una fecha, con su estado: tomada, pendiente o atrasada (pasada la hora + margen). */
export function checklist(suplementos, tomas, fecha, ahora = null, margenMin = 60) {
  const out = [];
  for (const s of suplementos.filter(x => x.activo !== false)) {
    if (s.dias?.length && !s.dias.includes(diaSemana(fecha))) continue;
    const horas = s.horas?.length ? s.horas : [null];
    horas.forEach((hora, i) => {
      const hechas = tomas.filter(t => t.suplemento_id === s.id && t.fecha === fecha);
      const tomada = hechas.length > i;
      let estado = tomada ? 'tomada' : 'pendiente';
      if (!tomada && hora && ahora && ahora.slice(0, 10) === fecha) {
        const [h, m] = hora.split(':').map(Number);
        const [ah, am] = ahora.slice(11, 16).split(':').map(Number);
        if (ah * 60 + am > h * 60 + m + margenMin) estado = 'atrasada';
      }
      out.push({ suplemento_id: s.id, nombre: s.nombre, dosis: s.dosis || '', hora, estado });
    });
  }
  return out.sort((a, b) => (a.hora || '99') < (b.hora || '99') ? -1 : 1);
}

/** Recordatorios a mostrar o enviar ahora: lo que debía tomarse en los últimos `ventanaMin` minutos y no está. */
export function recordatoriosAhora(suplementos, tomas, ahora, ventanaMin = 30) {
  const fecha = ahora.slice(0, 10);
  const [ah, am] = ahora.slice(11, 16).split(':').map(Number);
  const minAhora = ah * 60 + am;
  return checklist(suplementos, tomas, fecha, ahora, 10_000).filter(x => {
    if (x.estado === 'tomada' || !x.hora) return false;
    const [h, m] = x.hora.split(':').map(Number);
    return minAhora >= h * 60 + m && minAhora - (h * 60 + m) <= ventanaMin;
  });
}

/** Constancia: días seguidos con todo lo programado tomado (hoy cuenta si ya está completo; si no, se parte de
 *  ayer) y porcentaje de días completos en los últimos 30. */
export function constancia(suplementos, tomas, hoy) {
  let racha = 0, rachaViva = true, completos = 0, programados = 0;
  for (let i = 0; i < 30; i++) {
    const f = sumarDias(hoy, -i);
    const lista = checklist(suplementos, tomas, f);
    if (!lista.length) continue;
    const ok = lista.every(x => x.estado === 'tomada');
    if (i === 0 && !ok) continue; // hoy todavía está en curso
    programados++;
    if (ok) completos++;
    if (rachaViva && ok) racha++; else rachaViva = false;
  }
  return { racha, porcentaje_30_dias: programados ? completos / programados : null };
}
