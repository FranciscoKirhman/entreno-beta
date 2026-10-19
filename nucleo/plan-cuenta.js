// Los días creados desde una sesión libre también deben cumplir el contrato de la cuenta.
// Los planes antiguos pueden no traer tipo y firme. Completar esos campos no mueve fechas ni ejercicios.
import { conSemanasPrevias } from './semanas-plan.js';

export function planParaCuenta(plan) {
  plan = conSemanasPrevias(plan);
  return { ...plan, dias: plan.dias.map(d => ({
    ...d,
    tipo: d.tipo || 'entrenamiento',
    firme: d.firme ?? false,
  })) };
}
