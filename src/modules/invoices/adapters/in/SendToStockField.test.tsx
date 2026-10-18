import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { StockRoutingSuggestion } from "../../domain/entities/invoice.ts";
import { stockDecision } from "../../domain/services/stock-decision.ts";
import { SendToStockField } from "./SendToStockField.tsx";

function Harness({ suggestion }: { suggestion: StockRoutingSuggestion | null }) {
  const [choice, setChoice] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const decision = stockDecision(suggestion, choice, reason);
  return (
    <>
      <SendToStockField suggestion={suggestion} decision={decision} choice={choice} reason={reason} onChoice={setChoice} onReason={setReason} inputCls="" />
      <output data-testid="override">{decision.override}</output>
      <output data-testid="blocking">{decision.blocking ?? ""}</output>
    </>
  );
}

describe("SendToStockField («Enviar para Stock»)", () => {
  it("predefinição «Enviar»: marcado, com o motivo da predefinição discreto", () => {
    render(<Harness suggestion={{ send: true, source: "supplier", reason: "Fornecedor: enviar por defeito", requiresDecision: false }} />);
    expect((screen.getByRole("checkbox", { name: /Enviar para Stock/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Fornecedor: enviar por defeito/)).toBeTruthy();
    expect(screen.getByTestId("override").textContent).toBe("auto");
  });

  it("desmarcar contra a predefinição pede motivo e bloqueia até haver um", async () => {
    const user = userEvent.setup();
    render(<Harness suggestion={{ send: true, source: "category", reason: "Ingredientes", requiresDecision: false }} />);
    await user.click(screen.getByRole("checkbox", { name: /Enviar para Stock/ }));
    expect(screen.getByTestId("blocking").textContent).toMatch(/motivo/);
    await user.type(screen.getByLabelText("Motivo para não enviar para o Stock"), "Oferta");
    expect(screen.getByTestId("blocking").textContent).toBe("");
    expect(screen.getByTestId("override").textContent).toBe("force_skip");
  });

  it("«Decidir no documento» pede escolha explícita", async () => {
    const user = userEvent.setup();
    render(<Harness suggestion={{ send: null, source: "supplier", reason: "Decidir no documento", requiresDecision: true }} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByTestId("blocking").textContent).toMatch(/Indique se/);
    await user.click(screen.getByRole("radio", { name: "Não enviar" }));
    expect(screen.getByTestId("override").textContent).toBe("force_skip");
    expect(screen.getByTestId("blocking").textContent).toBe("");
    // depois de escolher, volta a ser uma checkbox normal
    expect((screen.getByRole("checkbox", { name: /Enviar para Stock/ }) as HTMLInputElement).checked).toBe(false);
  });
});
