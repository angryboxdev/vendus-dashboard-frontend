import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CostCenterCategory, CostCenterGroup } from "../../../financial-base/domain/entities/cost-center.ts";
import type { DraftAllocation } from "../../domain/services/allocations-draft.ts";
import { AllocationsEditor } from "./AllocationsEditor.tsx";

vi.mock("../../../locations/adapters/in/use-locations.ts", () => ({ useLocations: () => ({ locations: [], activeLocations: [], hasMultipleLocations: false }) }));

const groups = [{ id: "g1", code: "CMV", name: "Matéria-prima", isActive: true }] as CostCenterGroup[];
const categories = [
  { id: "c1", groupId: "g1", code: "01", name: "Carne", isActive: true },
  { id: "c2", groupId: "g1", code: "02", name: "Bebidas", isActive: true },
  { id: "c3", groupId: "g1", code: "03", name: "Embalagens", isActive: true },
] as CostCenterCategory[];

const row = (key: string, categoryId: string, amount: string): DraftAllocation => ({
  key, description: `Rep ${key}`, groupId: "g1", categoryId, locationId: null, amount,
});

function Harness({ initial, netBaseCents, lines = [] }: { initial: DraftAllocation[]; netBaseCents: number; lines?: { key: string; categoryId: string | null; locationId: string | null; netCents: number }[] }) {
  const [rows, setRows] = useState(initial);
  return <AllocationsEditor rows={rows} netBaseCents={netBaseCents} groups={groups} categories={categories} lines={lines} onChange={setRows} />;
}

const remaining = () => screen.getByTestId("allocations-remaining").textContent ?? "";

describe("AllocationsEditor («Por valores»)", () => {
  it("100 + 250 + 300 = 650 € fecha com Por distribuir 0,00", () => {
    render(<Harness initial={[row("a", "c1", "100"), row("b", "c2", "250"), row("c", "c3", "300")]} netBaseCents={65000} />);
    expect(remaining()).toMatch(/Por distribuir.*0,00/);
    expect(screen.queryByText(/tem de ser igual/)).toBeNull();
  });

  it("base 649 € ou 651 € não fecha (excesso / por distribuir)", () => {
    const { unmount } = render(<Harness initial={[row("a", "c1", "100"), row("b", "c2", "250"), row("c", "c3", "300")]} netBaseCents={64900} />);
    expect(remaining()).toMatch(/Excesso.*1,00/);
    expect(screen.getByText(/tem de ser igual/)).toBeTruthy();
    unmount();
    render(<Harness initial={[row("a", "c1", "100"), row("b", "c2", "250"), row("c", "c3", "300")]} netBaseCents={65100} />);
    expect(remaining()).toMatch(/Por distribuir.*1,00/);
  });

  it("adicionar uma repartição e escrever o montante atualiza Por distribuir", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} netBaseCents={10000} />);
    expect(screen.getByText(/Adicione pelo menos uma repartição/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Adicionar repartição/ }));
    await user.type(screen.getByLabelText("Montante líquido da repartição 1"), "40");
    expect(remaining()).toMatch(/Por distribuir.*60,00/);
    expect(screen.getByText(/precisa de descrição, subcategoria e montante/)).toBeTruthy();
  });

  it("«Propor a partir das linhas» soma por subcategoria e deixa o resto por distribuir", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[]}
        netBaseCents={30000}
        lines={[
          { key: "l1", categoryId: "c1", locationId: null, netCents: 10000 },
          { key: "l2", categoryId: "c1", locationId: null, netCents: 5000 },
          { key: "l3", categoryId: null, locationId: null, netCents: 15000 },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Propor a partir das linhas" }));
    expect((screen.getByLabelText("Montante líquido da repartição 1") as HTMLInputElement).value).toBe("150.00");
    expect(remaining()).toMatch(/Por distribuir.*150,00/);
  });

  it("sem linhas classificadas não propõe nada", () => {
    render(<Harness initial={[]} netBaseCents={1000} lines={[{ key: "l1", categoryId: null, locationId: null, netCents: 1000 }]} />);
    expect((screen.getByRole("button", { name: "Propor a partir das linhas" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
