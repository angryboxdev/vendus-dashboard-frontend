import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TimeBankLedger } from "../../../domain/entities/time-bank.ts";
import { clampCompensation, formatBank, parseHhMm, toHhMm } from "../../../domain/services/time-bank.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { TimeBankView } from "./TimeBankView.tsx";

function renderWith(m: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <TimeBankView />
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

const LEDGER: TimeBankLedger = {
  employeeId: "e1",
  cutoff: "2026-09-30",
  today: "2026-10-11",
  balance: 14569,
  available: 14569,
  compensateBeyondBalance: false,
  generated: 14569,
  compensatedRest: 0,
  compensatedPaid: 0,
  expired: 0,
  pendingValidation: [{ workDate: "2026-09-29", excessSeconds: 3600 }],
  entries: [
    { id: "a", kind: "deficit", seconds: -10764, workDate: "2026-09-28", postedOn: "2026-09-28", paymentMonth: null, reason: "Défice de tempo", createdBy: "sistema", running: 7302 },
    { id: "b", kind: "adjustment", seconds: 14, workDate: "2026-09-15", postedOn: "2026-10-11", paymentMonth: null, reason: "Correção do dia 2026-09-15", createdBy: "sistema", running: 14569 },
  ],
};

const mod = () => {
  const m = fakeNovoRhModule({ settings: { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Teste" }]) } as unknown as NovoRhModule["settings"] });
  m.timeBank.ledger = vi.fn(async () => LEDGER);
  return m;
};

async function openLedger() {
  const user = userEvent.setup();
  await screen.findByRole("option", { name: "Ana Teste" });
  await user.selectOptions(screen.getByLabelText("Colaborador"), "e1");
  await screen.findByText("+4h02m49s", { selector: "dd" });
  return user;
}

describe("Banco de horas — formatação", () => {
  it("segundos com sinal, HH:MM e limite do campo (RE-28)", () => {
    expect(formatBank(14569)).toBe("+4h02m49s");
    expect(formatBank(-10764)).toBe("-2h59m24s");
    expect(parseHhMm("09:00")).toBe(32400);
    expect(parseHhMm("9h")).toBeNull();
    expect(toHhMm(14569)).toBe("04:02");
    expect(clampCompensation(32400, 14569, false)).toBe(14569);
    expect(clampCompensation(32400, 14569, true)).toBe(32400);
  });
});

describe("Banco de horas — ecrã", () => {
  it("RE_26_RE_29_mostra_acumulado_e_ajuste_lancado_hoje", async () => {
    renderWith(mod());
    await openLedger();
    expect(screen.getByText("Inclui os dias até 2026-09-30")).toBeInTheDocument();
    const adj = screen.getByText("Correção do dia 2026-09-15").closest("tr")!;
    expect(within(adj).getByText("Ajuste")).toBeInTheDocument();
    expect(within(adj).getByText("lançado a 2026-10-11")).toBeInTheDocument();
    expect(screen.getByText("-2h59m24s")).toBeInTheDocument();
  });

  it("RE_28_digitar_9h_com_4h02_fica_limitado_ao_maximo", async () => {
    const m = mod();
    m.timeBank.compensate = vi.fn(async () => undefined);
    renderWith(m);
    const user = await openLedger();
    const box = screen.getByRole("group", { name: "Compensar horas" });
    const field = within(box).getByPlaceholderText("00:00");
    await user.type(field, "09:00");
    expect(field).toHaveValue("04:02");
    await user.type(within(box).getByLabelText("Motivo"), "Folga");
    await user.click(within(box).getByRole("button", { name: "Compensar horas" }));
    expect(m.timeBank.compensate).toHaveBeenCalledWith("e1", { mode: "rest", seconds: 14520, paymentMonth: null, reason: "Folga" });
  });

  it("validar excedente; recusar exige motivo (C6.5)", async () => {
    const m = mod();
    m.timeBank.decideValidation = vi.fn(async () => undefined);
    renderWith(m);
    const user = await openLedger();
    expect(screen.getByRole("button", { name: "Recusar 2026-09-29" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Validar 2026-09-29" }));
    expect(m.timeBank.decideValidation).toHaveBeenCalledWith("e1", "2026-09-29", "approve", null);
  });

  it("ajuste negativo com motivo", async () => {
    const m = mod();
    m.timeBank.adjust = vi.fn(async () => undefined);
    renderWith(m);
    const user = await openLedger();
    const box = screen.getByRole("group", { name: "Ajustar" });
    await user.type(within(box).getByPlaceholderText("+01:00"), "-01:30");
    await user.type(within(box).getByLabelText("Motivo"), "Acordo");
    await user.click(within(box).getByRole("button", { name: "Ajustar" }));
    expect(m.timeBank.adjust).toHaveBeenCalledWith("e1", { seconds: -5400, workDate: null, reason: "Acordo" });
  });

  it("categoria com multiplicador (C4.6)", async () => {
    const m = mod();
    m.timeBank.createCategory = vi.fn(async () => ({ id: "c", name: "Fim de tarde", validFrom: "2026-10-01", validTo: null, windows: [], factor: 1.5, archived: false }));
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Horas categorizadas" }));
    const box = await screen.findByRole("group", { name: "Nova categoria" });
    await user.type(within(box).getByLabelText("Nome"), "Fim de tarde");
    await user.type(within(box).getByLabelText("Desde"), "2026-10-01");
    await user.type(within(box).getByLabelText("Fator (vazio = só classificar)"), "1,5");
    await user.click(within(box).getByRole("button", { name: "Nova categoria" }));
    expect(m.timeBank.createCategory).toHaveBeenCalledWith({ name: "Fim de tarde", validFrom: "2026-10-01", validTo: null, windows: [{ weekdays: ["1", "2", "3", "4", "5"], start: "17:00", end: "18:00" }], factor: 1.5 });
  });
});
