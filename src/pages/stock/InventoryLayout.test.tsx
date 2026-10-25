import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

let access: unknown = null;
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: { access } }) }));

const { InventoryIndexRedirect, InventoryLayout } = await import("./InventoryLayout.tsx");

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/stock/inventario" element={<InventoryIndexRedirect />} />
        <Route element={<InventoryLayout />}>
          <Route path="/stock/movimentacoes" element={<p>ecrã stock atual</p>} />
          <Route path="/stock/historico-movimentos" element={<p>ecrã movimentos</p>} />
          <Route path="/stock/contagens" element={<p>ecrã contagens</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Inventário (um item no menu, separadores na página)", () => {
  it("mostra os três separadores e abre o primeiro", () => {
    access = { isAdmin: true, portalOnly: false, permissions: {} };
    renderAt("/stock/inventario");
    expect(screen.getByText("ecrã stock atual")).toBeTruthy();
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Stock atual", "Movimentos", "Contagens"]);
  });

  it("só com Contagens: um separador e abre logo as contagens", () => {
    access = { isAdmin: false, portalOnly: false, permissions: { "stock.counts": "READ" } };
    renderAt("/stock/inventario");
    expect(screen.getByText("ecrã contagens")).toBeTruthy();
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Contagens"]);
  });
});
