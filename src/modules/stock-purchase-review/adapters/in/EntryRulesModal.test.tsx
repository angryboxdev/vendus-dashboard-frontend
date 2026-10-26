import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StockPurchaseReviewProvider } from "../../stock-purchase-review.module.tsx";
import type { StockPurchaseReviewApiPort } from "../../domain/ports/out/stock-purchase-review-api.port.ts";
import type { EntryRules } from "../../domain/entities/stock-purchase-review.ts";
import { EntryRulesModal } from "./EntryRulesModal.tsx";

const oneLocation = async () => ({ defaultLocationId: null, locations: [{ id: "loc-a", name: "Loja A" }] });
const defaults: EntryRules = { ingredient: "stock", beverage: "stock", packaging: "stock", cleaning: "no_stock", consumable: "review", other: "review", unknown: "review" };

describe("EntryRulesModal (V4 §2)", () => {
  it("mostra as regras por tipo de artigo e grava a alteração", async () => {
    const saveEntryRules = vi.fn(async (r: EntryRules) => r);
    const api = { getEntryRules: async () => defaults, saveEntryRules, getStockSettings: oneLocation } as unknown as StockPurchaseReviewApiPort;
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
    const api = { getEntryRules: async () => defaults, saveEntryRules: async () => { throw new Error("Sem permissão para gerir Compras por rever."); }, getStockSettings: oneLocation } as unknown as StockPurchaseReviewApiPort;
    render(
      <StockPurchaseReviewProvider module={{ api }}>
        <EntryRulesModal onClose={vi.fn()} />
      </StockPurchaseReviewProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Gravar regras" }));
    expect(await screen.findByText("Sem permissão para gerir Compras por rever.")).toBeTruthy();
  });

  it("V5 §2.4: localização principal do Stock — escolhe a loja e grava junto com as regras", async () => {
    const saveStockSettings = vi.fn(async (id: string | null) => ({ defaultLocationId: id, locations: [{ id: "loc-a", name: "Loja A" }, { id: "loc-b", name: "Loja B" }] }));
    const api = {
      getEntryRules: async () => defaults,
      saveEntryRules: async (r: EntryRules) => r,
      getStockSettings: async () => ({ defaultLocationId: null, locations: [{ id: "loc-a", name: "Loja A" }, { id: "loc-b", name: "Loja B" }] }),
      saveStockSettings,
    } as unknown as StockPurchaseReviewApiPort;
    render(
      <StockPurchaseReviewProvider module={{ api }}>
        <EntryRulesModal onClose={vi.fn()} />
      </StockPurchaseReviewProvider>,
    );
    fireEvent.change(await screen.findByLabelText("Localização principal do Stock"), { target: { value: "loc-b" } });
    fireEvent.click(screen.getByRole("button", { name: "Gravar regras" }));
    await waitFor(() => expect(saveStockSettings).toHaveBeenCalledWith("loc-b"));
  });
});
