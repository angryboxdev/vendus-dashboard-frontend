import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { StockPurchaseReviewProvider } from "../../modules/stock-purchase-review/stock-purchase-review.module.tsx";
import type { StockPurchaseReviewApiPort } from "../../modules/stock-purchase-review/domain/ports/out/stock-purchase-review-api.port.ts";

let access: unknown = null;
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: { access } }) }));

const { InventoryIndexRedirect, InventoryLayout } = await import("./InventoryLayout.tsx");

// Duas compras por tratar e uma já movimentada (não conta).
const listReviews = vi.fn(async () => [{ status: "pending" }, { status: "in_review" }, { status: "applied" }]);
const fakeModule = { api: { listReviews } as unknown as StockPurchaseReviewApiPort };

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StockPurchaseReviewProvider module={fakeModule}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/stock/inventario" element={<InventoryIndexRedirect />} />
            <Route element={<InventoryLayout />}>
              <Route path="/stock/movimentacoes" element={<p>ecrã stock atual</p>} />
              <Route path="/stock/historico-movimentos" element={<p>ecrã movimentos</p>} />
              <Route path="/stock/contagens" element={<p>ecrã contagens</p>} />
              <Route path="/stock/compras-por-rever" element={<p>ecrã compras por rever</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </StockPurchaseReviewProvider>
    </QueryClientProvider>,
  );
}

const tabLabels = () => screen.getAllByRole("link").map((l) => l.textContent);

describe("Inventário (um item no menu, separadores na página)", () => {
  it("mostra os quatro separadores, com o nº de compras por tratar, e abre o primeiro", async () => {
    access = { isAdmin: true, portalOnly: false, permissions: {} };
    renderAt("/stock/inventario");
    expect(screen.getByText("ecrã stock atual")).toBeTruthy();
    await waitFor(() => expect(tabLabels()).toEqual(["Stock atual", "Movimentos", "Contagens", "Compras por rever2"]));
  });

  it("só com Contagens: um separador e abre logo as contagens (sem pedir as compras)", () => {
    listReviews.mockClear();
    access = { isAdmin: false, portalOnly: false, permissions: { "stock.counts": "READ" } };
    renderAt("/stock/inventario");
    expect(screen.getByText("ecrã contagens")).toBeTruthy();
    expect(tabLabels()).toEqual(["Contagens"]);
    expect(listReviews).not.toHaveBeenCalled();
  });

  it("só com Compras por rever: abre logo esse separador", async () => {
    access = { isAdmin: false, portalOnly: false, permissions: { "stock.purchase_reviews": "READ" } };
    renderAt("/stock/inventario");
    expect(screen.getByText("ecrã compras por rever")).toBeTruthy();
    await waitFor(() => expect(tabLabels()).toEqual(["Compras por rever2"]));
  });

  it("«Importar fatura» no cabeçalho, em qualquer separador, para quem gere Compras por rever", () => {
    access = { isAdmin: false, portalOnly: false, permissions: { "stock.movements": "READ", "stock.purchase_reviews": "MANAGE" } };
    renderAt("/stock/movimentacoes");
    expect(screen.getByRole("button", { name: "Importar fatura" })).toBeTruthy();
  });

  it("sem Gerir em Compras por rever, não há «Importar fatura»", () => {
    access = { isAdmin: false, portalOnly: false, permissions: { "stock.purchase_reviews": "READ" } };
    renderAt("/stock/compras-por-rever");
    expect(screen.queryByRole("button", { name: "Importar fatura" })).toBeNull();
  });
});
