import type { DeliveryDayRule } from "../entities/supplier-delivery-schedule.ts";

/** Dia da semana ISO (1 = segunda … 7 = domingo) de uma data local. */
export function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Regra efetiva de um dia de entrega: sem regra, encomenda-se no dia anterior à hora limite geral. */
export function effectiveRule(weekday: number, rules: DeliveryDayRule[], cutoffTime: string | null): { orderWeekday: number; orderTime: string | null; notes: string | null } {
  const rule = rules.find((r) => r.weekday === weekday);
  return {
    orderWeekday: rule?.orderWeekday ?? (weekday === 1 ? 7 : weekday - 1),
    orderTime: rule?.orderTime ?? cutoffTime,
    notes: rule?.notes ?? null,
  };
}

/** Dias entre o pedido e a entrega (o mesmo dia da semana conta como uma semana). */
export function leadDays(deliveryWeekday: number, orderWeekday: number): number {
  return (deliveryWeekday - orderWeekday + 7) % 7 || 7;
}

/** Menor e maior prazo entre pedido e entrega no calendário; `null` sem dias de entrega. */
export function leadTimeRange(weekdays: number[], rules: DeliveryDayRule[], cutoffTime: string | null): { min: number; max: number } | null {
  if (weekdays.length === 0) return null;
  const leads = weekdays.map((w) => leadDays(w, effectiveRule(w, rules, cutoffTime).orderWeekday));
  return { min: Math.min(...leads), max: Math.max(...leads) };
}

export interface SupplyOpportunity {
  deliveryDate: Date;
  /** Limite para encomendar (data + hora; sem hora = fim desse dia). */
  orderDeadline: Date;
  hasOrderTime: boolean;
  /** Dias de calendário de hoje até à entrega. */
  daysUntilDelivery: number;
}

/**
 * Próximas entregas cujo prazo de encomenda ainda não passou, dentro de
 * `horizonDays` a contar de hoje. Informativo — nunca um compromisso.
 */
export function upcomingOpportunities(
  weekdays: number[],
  rules: DeliveryDayRule[],
  cutoffTime: string | null,
  now: Date,
  horizonDays: number,
): SupplyOpportunity[] {
  if (weekdays.length === 0) return [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const out: SupplyOpportunity[] = [];
  for (let i = 0; i <= horizonDays; i++) {
    const delivery = new Date(today);
    delivery.setDate(today.getDate() + i);
    const weekday = isoWeekday(delivery);
    if (!weekdays.includes(weekday)) continue;
    const rule = effectiveRule(weekday, rules, cutoffTime);
    const deadline = new Date(delivery);
    deadline.setDate(delivery.getDate() - leadDays(weekday, rule.orderWeekday));
    if (rule.orderTime) {
      const [h, m] = rule.orderTime.split(":").map(Number);
      deadline.setHours(h!, m!, 0, 0);
    } else {
      deadline.setHours(23, 59, 59, 999);
    }
    if (deadline <= now) continue;
    out.push({ deliveryDate: delivery, orderDeadline: deadline, hasOrderTime: !!rule.orderTime, daysUntilDelivery: i });
  }
  return out;
}
