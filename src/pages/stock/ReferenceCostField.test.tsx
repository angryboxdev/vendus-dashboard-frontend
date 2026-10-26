import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceCostField, formatPerPricingUnit } from "./ReferenceCostField.tsx";

describe("custo de referência em Artigos e ingredientes", () => {
  it("artigo em g: mostra e recebe o preço por kg, guarda por g", () => {
    const onChange = vi.fn();
    render(<ReferenceCostField label="Custo de referência s/ IVA" baseUnit="g" value={0.00779} onChange={onChange} />);
    expect(screen.getByText("Custo de referência s/ IVA por kg (€)")).toBeTruthy();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("7.79");
    fireEvent.change(input, { target: { value: "5,58" } });
    expect(onChange).toHaveBeenLastCalledWith(0.00558);
  });

  it("artigo à unidade fica por unidade; último custo legível por kg", () => {
    render(<ReferenceCostField label="Custo de referência s/ IVA" baseUnit="un" value={null} onChange={vi.fn()} />);
    expect(screen.getByText("Custo de referência s/ IVA por un (€)")).toBeTruthy();
    expect(formatPerPricingUnit(0.00558, "g")).toMatch(/5,58\s€\/kg/);
  });

  it("valor invulgar (3,783 €/g = 3783 €/kg) avisa que pode ser o preço da embalagem", () => {
    render(<ReferenceCostField label="Custo" baseUnit="g" value={3.783} onChange={() => {}} />);
    expect(screen.getByRole("alert").textContent).toMatch(/invulgar/);
  });

  it("valor normal não avisa", () => {
    render(<ReferenceCostField label="Custo" baseUnit="g" value={0.003783} onChange={() => {}} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
