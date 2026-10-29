import { describe, expect, it } from "vitest";
import type { BankMovementDTO, DaySlotDTO } from "../entities/bank-statement.ts";
import { rowStatus, visibleMonthDays } from "./month-movements.ts";

const mv = (id: string, over: Partial<BankMovementDTO>): BankMovementDTO =>
  ({ id, description: "X", normalizedDescription: "X", movementKind: "to_review", amount: 1000, movementType: "debit", isResolved: false, reconciliationStatus: "saida_nao_justificada", ...over }) as BankMovementDTO;
const day = (date: string, movements: BankMovementDTO[]): DaySlotDTO => ({ date, movements, totalDebitCents: 0, totalCreditCents: 0, totalMovements: movements.length, reconciledCount: 0 });

const days = [
  day("2026-09-01", [
    mv("a", { description: "TARIFA MENSAL", amount: 1230, isResolved: true, reconciliationStatus: "justificado" }),
    mv("b", { description: "PAGSERV FORMIFRI", amount: 38278 }),
    mv("c", { description: "CREDITO TPA", normalizedDescription: "Vendas TPA", movementType: "credit", movementKind: "sales", amount: 36908, isResolved: true }),
  ]),
  day("2026-09-02", [mv("d", { description: "TRF P/ FORNECEDOR", movementKind: "transfer_out", amount: 9656 })]),
];
const base = { tab: "movements" as const, chip: "all" as const, search: "", sort: "priority" as const, suggestedIds: new Set<string>() };
const ids = (r: DaySlotDTO[]) => r.flatMap((d) => d.movements.map((m) => m.id));

describe("visibleMonthDays", () => {
  it("«Mais prioritários»: por conciliar primeiro, maior valor primeiro, dentro de cada dia", () => {
    expect(ids(visibleMonthDays(days, base))).toEqual(["b", "c", "a", "d"]);
  });
  it("ordem por data mantém a ordem do extrato", () => {
    expect(ids(visibleMonthDays(days, { ...base, sort: "date" }))).toEqual(["a", "b", "c", "d"]);
  });
  it("Conciliados / Por conciliar / Entradas / Transferências / Com sugestão", () => {
    expect(ids(visibleMonthDays(days, { ...base, tab: "reconciled" }))).toEqual(["c", "a"]);
    expect(ids(visibleMonthDays(days, { ...base, chip: "pending" }))).toEqual(["b", "d"]);
    expect(ids(visibleMonthDays(days, { ...base, chip: "inflows" }))).toEqual(["c"]);
    expect(ids(visibleMonthDays(days, { ...base, chip: "transfers" }))).toEqual(["d"]);
    expect(ids(visibleMonthDays(days, { ...base, chip: "with_suggestion", suggestedIds: new Set(["d"]) }))).toEqual(["d"]);
  });
  it("pesquisa na descrição normalizada e no valor («382,78»); dias vazios desaparecem", () => {
    expect(ids(visibleMonthDays(days, { ...base, search: "vendas" }))).toEqual(["c"]);
    const r = visibleMonthDays(days, { ...base, search: "382,78" });
    expect(ids(r)).toEqual(["b"]);
    expect(r).toHaveLength(1);
  });
});

describe("rowStatus", () => {
  it("parcial, conciliado, por conciliar", () => {
    expect(rowStatus({ isResolved: false, reconciliationStatus: "conciliado_parcial" })).toBe("partial");
    expect(rowStatus({ isResolved: true, reconciliationStatus: "justificado" })).toBe("reconciled");
    expect(rowStatus({ isResolved: false, reconciliationStatus: "saida_nao_justificada" })).toBe("pending");
    expect(rowStatus({ isResolved: false, reconciliationStatus: "pendente_de_documento" })).toBe("classified");
  });

  it("filtro «Classificados» mostra só os que aguardam fatura", () => {
    const mv = (id: string, reconciliationStatus: string) => ({ id, isResolved: false, reconciliationStatus, description: id, normalizedDescription: null, amount: 100, movementType: "debit" }) as unknown as BankMovementDTO;
    const days = [{ date: "2026-10-05", movements: [mv("a", "pendente_de_documento"), mv("b", "saida_nao_justificada")] }] as unknown as DaySlotDTO[];
    const out = visibleMonthDays(days, { tab: "movements", chip: "classified", search: "", sort: "date", suggestedIds: new Set() });
    expect(out[0]!.movements.map((m) => m.id)).toEqual(["a"]);
  });
});
