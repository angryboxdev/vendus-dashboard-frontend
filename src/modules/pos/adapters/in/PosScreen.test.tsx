import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PosUseCases } from "../../application/use-cases/pos.use-cases.ts";
import type { PosProduct, PosSale, ReceiptDocument } from "../../domain/entities/pos.ts";
import { PosError } from "../../domain/errors.ts";
import type { PosApiPort } from "../../domain/ports/out/pos-api.port.ts";
import { PosProvider } from "../../pos.module.tsx";
import { PosScreen } from "./PosScreen.tsx";

const PRODUCTS: PosProduct[] = [
  { id: "p1", ref: "VPIZ1", name: "Pizza Teste", category: "Grandes", priceCents: 1850, vatRate: 13, productType: "P", trackStock: false, imageUrl: null, active: true },
  { id: "p2", ref: "VREF2", name: "Refrigerante", category: "Bebidas", priceCents: 250, vatRate: 23, productType: "P", trackStock: true, imageUrl: null, active: true },
];
const SALE: PosSale = {
  id: "s1",
  kind: "sale",
  documentId: "d1",
  documentNumber: "FR POS-2027/1",
  employeeId: "e1",
  employeeName: "Ana Fictícia",
  paymentMethod: "cash",
  totalCents: 2100,
  givenCents: 5000,
  changeCents: 2900,
  refundOf: null,
  reason: null,
  lines: [],
  createdAt: "2027-03-10T12:00:00.000Z",
};
const DOC: ReceiptDocument = {
  documentNumber: "FR POS-2027/1",
  documentType: "FR",
  documentDate: "2027-03-10",
  systemEntryDate: "2027-03-10T12:00:00",
  atcud: "CDF7T5HD-1",
  qrPayload: "A:599999999*B:999999990",
  issuer: { taxId: "599999999", name: "Empresa Fictícia, Lda", address: { street: "Rua A", postalCode: "4000-001", city: "Porto" } },
  customer: { taxId: "999999990", name: "Consumidor final" },
  lines: [{ lineNumber: 1, productCode: "VPIZ1", description: "Pizza Teste", quantity: "1", unitPrice: "18.50", discountPct: null, lineAmount: "18.50", taxPercentage: "13" }],
  taxes: [{ taxPercentage: "13", taxableBase: "16.37", taxAmount: "2.13" }],
  netTotal: "16.37",
  taxPayable: "2.13",
  grossTotal: "21.00",
  referencesTo: [],
  statusReason: null,
  printed: { atcud: "ATCUD:CDF7T5HD-1", mentions: ["DOCUMENTO DE TESTE – SEM VALOR FISCAL", "Processado por programa não certificado"] },
};

function renderPos(over: Partial<PosApiPort> = {}) {
  const api = {
    products: vi.fn(async () => PRODUCTS),
    documents: vi.fn(async () => []),
    summary: vi.fn(async () => ({ date: "2027-03-10", salesCount: 0, salesCents: 0, refundsCount: 0, refundsCents: 0, netCents: 0, averageTicketCents: 0, byPayment: { card: 0, cash: 0, mbway: 0 } })),
    login: vi.fn(async (pin: string) => {
      if (pin === "1234") return { id: "e1", name: "Ana Fictícia", isManager: false };
      throw new PosError("PIN inválido", "pin");
    }),
    checkout: vi.fn(async () => SALE),
    receipt: vi.fn(async () => DOC),
    ...over,
  } as unknown as PosApiPort;
  let n = 0;
  render(
    <MemoryRouter>
      <PosProvider module={{ pos: new PosUseCases(api, { next: () => `chave-${++n}` }) }}>
        <PosScreen />
      </PosProvider>
    </MemoryRouter>,
  );
  return api;
}

async function enterPin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const d of pin) await user.click(screen.getByRole("button", { name: d }));
}

describe("PosScreen", () => {
  it("PIN errado mostra o erro; o certo entra no POS", async () => {
    const user = userEvent.setup();
    renderPos();
    await enterPin(user, "9999");
    expect(await screen.findByRole("alert")).toHaveTextContent("PIN inválido");
  });

  it("venda em dinheiro: artigos, troco, fatura com uma só chave e talão com ATCUD", async () => {
    const user = userEvent.setup();
    const api = renderPos();
    await enterPin(user, "1234");
    await user.click(await screen.findByRole("button", { name: /Pizza Teste/ }));
    await user.click(screen.getByRole("button", { name: /Refrigerante/ }));
    await user.click(screen.getByRole("button", { name: "Cobrar 21,00 €" }));

    const dialog = await screen.findByRole("dialog", { name: /Pagamento/ });
    await user.click(within(dialog).getByRole("radio", { name: "Dinheiro" }));
    expect(within(dialog).getByRole("button", { name: "Confirmar pagamento e faturar" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "25,00 €" }));
    expect(within(dialog).getByText("Troco a dar")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar pagamento e faturar" }));

    expect(api.checkout).toHaveBeenCalledWith(
      { pin: "1234", lines: [{ productId: "p1", quantity: 1 }, { productId: "p2", quantity: 1 }], payment: { method: "cash", givenCents: 2500 }, customer: null },
      "chave-1",
    );
    const receipt = await screen.findByRole("dialog", { name: "Fatura-recibo emitida" });
    expect(await within(receipt).findByText("ATCUD:CDF7T5HD-1")).toBeInTheDocument();
    expect(within(receipt).getAllByText("DOCUMENTO DE TESTE – SEM VALOR FISCAL").length).toBeGreaterThan(0);
  });

  it("recusa do servidor (ex.: sem série) aparece no pagamento, sem fechar", async () => {
    const user = userEvent.setup();
    renderPos({ checkout: vi.fn().mockRejectedValue(new PosError("Escolha a série de faturas-recibo nas configurações do POS", "rule")) });
    await enterPin(user, "1234");
    await user.click(await screen.findByRole("button", { name: /Pizza Teste/ }));
    await user.click(screen.getByRole("button", { name: "Cobrar 18,50 €" }));
    const dialog = await screen.findByRole("dialog", { name: /Pagamento/ });
    await user.click(within(dialog).getByRole("radio", { name: "Cartão" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirmar pagamento e faturar" }));
    expect(await within(dialog).findByText("Escolha a série de faturas-recibo nas configurações do POS")).toBeInTheDocument();
  });
});
