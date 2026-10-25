import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StockPurchaseReviewProvider } from "../../stock-purchase-review.module.tsx";
import type { StockPurchaseReviewApiPort } from "../../domain/ports/out/stock-purchase-review-api.port.ts";
import type { EntryRules } from "../../domain/entities/stock-purchase-review.ts";
import { EntryRulesModal } from "./EntryRulesModal.tsx";

const defaults: EntryRules = { ingredient: "stock", beverage: "stock", packaging: "stock", cleaning: "no_stock", consumable: "review", other: "review", unknown: "review" };

describe("EntryRulesModal (V4 §2)", () => {
  it("mostra as regras por tipo de artigo e grava a alteração", async () => {
    const saveEntryRules = vi.fn(async (r: EntryRules) => r);
    const api = { getEntryRules: async () => defaults, saveEntryRules } as unknown as StockPurchaseReviewApiPort;
    render(
      <StockPurchaseReviewProvider module={{ api }}>
        <EntryRulesModal onClose={vi.fn()} />
      </StockPurchaseReviewProvider>,
    );
    const cleaning = await screen.findByRole("radiogroup", { name: "Higiene e limpeza" });
    expect(within(cleaning).getByRole("radio", { name: "Fora do Stock" }).getAttribute("aria-checked")).toBe("true");
    expect(within(screen.getByRole("radiogroup", { name: "Ingredientes" })).getByRole("radio", { name: "Entra no Stock" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(cleaning).getByRole("radio", { name: "Entra no Stock" }));
    fireEvent.click(screen.getByRole("button", { name: "Gravar regras" }));
    await waitFor(() => expect(saveEntryRules).toHaveBeenCalledWith({ ...defaults, cleaning: "stock" }));
    expect(await screen.findByText("Regras gravadas.")).toBeTruthy();
  });

  it("sem permissão para gravar, mostra o erro do servidor", async () => {
    const api = { getEntryRules: async () => defaults, saveEntryRules: async () => { throw new Error("Sem permissão para gerir Compras por rever."); } } as unknown as StockPurchaseReviewApiPort;
    render(
      <StockPurchaseReviewProvider module={{ api }}>
        <EntryRulesModal onClose={vi.fn()} />
      </StockPurchaseReviewProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Gravar regras" }));
    expect(await screen.findByText("Sem permissão para gerir Compras por rever.")).toBeTruthy();
  });
});
