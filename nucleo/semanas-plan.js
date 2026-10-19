// Los días anteriores al inicio pertenecen al bloque previo, también si una copia antigua los marcó como semana 1.
// Se conservan fechas, ejercicios y registros; solo se corrige esa clasificación.
export function conSemanasPrevias(plan) {
  if (!plan?.inicio || !Array.isArray(plan.dias)) return plan;
  return { ...plan, dias: plan.dias.map(d => d.fecha < plan.inicio && d.semana !== 0 ? { ...d, semana: 0 } : d) };
}
