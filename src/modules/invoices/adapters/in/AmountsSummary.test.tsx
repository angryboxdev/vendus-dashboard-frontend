import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { previewDetailed, previewSimple, type DraftAmountHeader, type DraftAmountLine } from "../../domain/services/draft-amounts.ts";
import { AmountsSummary } from "./ReviewImportedInvoiceDrawer.tsx";

const header = (over: Partial<DraftAmountHeader> = {}): DraftAmountHeader => ({
  totalStr: "118.30", subtotalStr: "111.60", vatStr: "6.70",
  globalDiscountKind: "pct", globalDiscountValue: "", footerDiscount: "", adjustments: "",
  roundingCents: 0, roundingReason: "", vatSummary: null, ...over,
});
const mozzarella: DraftAmountLine = { key: "l1", quantity: "20", unitCost: "6.20", vatRate: "6", discountKind: "pct", discountValue: "10" };

function renderSummary(h: DraftAmountHeader, lines: DraftAmountLine[], extra: { roundingOn?: boolean; onRoundingToggle?: (on: boolean) => void } = {}) {
  const preview = previewDetailed(h, lines);
  render(
    <AmountsSummary
      detailed
      preview={preview}
      simple={previewSimple(h)}
      header={h}
      declaredTotalCents={Math.round(Number(h.totalStr) * 100)}
      rawDifferenceCents={preview.differenceCents}
      roundingOn={extra.roundingOn ?? false}
      onHeaderChange={() => {}}
      onRoundingToggle={extra.onRoundingToggle ?? (() => {})}
    />,
  );
}

describe("AmountsSummary (quadro de valores da revisão)", () => {
  it("Mozzarella: mostra bruto, desconto, base, IVA por taxa e diferença 0,00", () => {
    renderSummary(header(), [mozzarella]);
    expect(screen.getByText("Bruto antes de descontos").nextSibling?.textContent).toMatch(/124,00/);
    expect(screen.getByText("Desconto").nextSibling?.textContent).toMatch(/12,40/);
    expect(screen.getByText("Base após descontos").nextSibling?.textContent).toMatch(/111,60/);
    expect(screen.getByText(/IVA 6% \(base/).nextSibling?.textContent).toMatch(/6,70/);
    expect(screen.getByText("Diferença para a fatura").nextSibling?.textContent).toMatch(/0,00/);
    expect(screen.queryByText(/Só pode confirmar/)).toBeNull();
    expect(screen.queryByText(/Saldo/)).toBeNull();
  });

  it("diferença real: mostra o valor e explica que não pode confirmar", () => {
    renderSummary(header({ totalStr: "119.00" }), [mozzarella]);
    expect(screen.getByText("Diferença para a fatura").nextSibling?.textContent).toMatch(/0,70/);
    expect(screen.getByText(/Só pode confirmar quando a diferença for 0,00 €/)).toBeTruthy();
    expect(screen.queryByText(/ajuste de arredondamento/)).toBeNull();
  });

  it("diferença de 1 cêntimo: oferece registar ajuste de arredondamento com motivo", async () => {
    const toggle = vi.fn();
    renderSummary(header({ totalStr: "118.31" }), [mozzarella], { onRoundingToggle: toggle });
    await userEvent.click(screen.getByRole("checkbox"));
    expect(toggle).toHaveBeenCalledWith(true);
  });

  it("IVA por validar aparece como problema por resolver", () => {
    renderSummary(header(), [{ ...mozzarella, vatRate: "" }]);
    expect(screen.getByText(/Por resolver: linha sem taxa de IVA/)).toBeTruthy();
  });
});
