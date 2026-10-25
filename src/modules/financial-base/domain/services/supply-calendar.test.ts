import { describe, expect, it } from "vitest";
import { effectiveRule, leadDays, leadTimeRange, upcomingOpportunities } from "./supply-calendar.ts";
import type { DeliveryDayRule } from "../entities/supplier-delivery-schedule.ts";

// Seg ← Sex 12h, Qua ← Seg 12h, Sáb ← Qui 12h (como no mockup).
const RULES: DeliveryDayRule[] = [
  { weekday: 1, orderWeekday: 5, orderTime: "12:00", notes: "Manhã" },
  { weekday: 3, orderWeekday: 1, orderTime: "12:00", notes: null },
  { weekday: 6, orderWeekday: 4, orderTime: "12:00", notes: null },
];

describe("supply-calendar", () => {
  it("sem regra, encomenda-se na véspera à hora limite geral", () => {
    expect(effectiveRule(1, [], "10:00")).toEqual({ orderWeekday: 7, orderTime: "10:00", notes: null });
    expect(effectiveRule(3, RULES, "10:00").orderTime).toBe("12:00");
  });

  it("lead time conta a passagem da semana", () => {
    expect(leadDays(1, 5)).toBe(3);
    expect(leadDays(3, 1)).toBe(2);
    expect(leadDays(2, 2)).toBe(7);
    expect(leadTimeRange([1, 3, 6], RULES, null)).toEqual({ min: 2, max: 3 });
    expect(leadTimeRange([], RULES, null)).toBeNull();
  });

  it("próximas oportunidades saltam as que já passaram o prazo", () => {
    // Domingo 13/09/2026, 10:00 → a segunda 14/09 exigia pedido até sexta 11/09: já passou.
    const now = new Date(2026, 8, 13, 10, 0);
    const ops = upcomingOpportunities([1, 3, 6], RULES, null, now, 28);
    expect(ops[0]!.deliveryDate.getDate()).toBe(16);
    expect(ops[0]!.orderDeadline).toEqual(new Date(2026, 8, 14, 12, 0));
    expect(ops[0]!.daysUntilDelivery).toBe(3);
    expect(ops.map((o) => o.deliveryDate.getDate()).slice(0, 4)).toEqual([16, 19, 21, 23]);
  });

  it("sem dias de entrega não há oportunidades", () => {
    expect(upcomingOpportunities([], RULES, null, new Date(), 28)).toEqual([]);
  });
});
