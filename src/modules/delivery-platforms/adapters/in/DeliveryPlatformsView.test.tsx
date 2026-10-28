import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeliveryPlatformsProvider, type DeliveryPlatformsModule } from "../../delivery-platforms.module.tsx";
import type { ImportPlatformDocumentsResult } from "../../domain/entities/platform-statement.ts";
import { sampleBoltAndSaft, sampleFoodCost, sampleMarginReport, samplePayouts, sampleStatements } from "../../domain/services/fixtures.ts";
import { DeliveryPlatformsView } from "./DeliveryPlatformsView.tsx";

const fakeModule = (over: Partial<DeliveryPlatformsModule> = {}): DeliveryPlatformsModule => ({
  importDocuments: { execute: async () => ({ imported: [], rejected: [] }) },
  listStatements: { execute: async () => sampleStatements() },
  getMarginReport: { execute: async () => sampleMarginReport() },
  exportMarginReport: { execute: async () => undefined },
  getPayoutReconciliation: { execute: async () => samplePayouts() },
  getFoodCost: { execute: async () => sampleFoodCost() },
  saveProductMappings: { execute: async () => undefined },
  ...over,
});

function renderView(mod: DeliveryPlatformsModule) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DeliveryPlatformsProvider module={mod}>
        <DeliveryPlatformsView year={2026} month={9} />
      </DeliveryPlatformsProvider>
    </QueryClientProvider>,
  );
}

describe("DeliveryPlatformsView", () => {
  it("mostra os extratos do mês por plataforma", async () => {
    renderView(fakeModule());
    expect(await screen.findByText("Extratos do mês")).toBeInTheDocument();
    expect(screen.getByText("UBERTEST01")).toBeInTheDocument();
    expect(screen.getAllByText("Atravessa o mês")).toHaveLength(1);
    expect(screen.getByText(/pagos em dinheiro ao estafeta/)).toBeInTheDocument();
  });

  it("Bolt calculada; o SAF-T não aparece como plataforma", async () => {
    renderView(fakeModule({ listStatements: { execute: async () => [...sampleStatements(), ...sampleBoltAndSaft()] } }));
    expect(await screen.findByText("Líquido (calculado)")).toBeInTheDocument();
    expect(screen.getByText(/o líquido é a diferença/)).toBeInTheDocument();
    expect(screen.queryByText("SAFT-2026-09-01-2026-09-30")).not.toBeInTheDocument();
  });

  it("margem por plataforma: a conta, a conferência com o SAF-T, os documentos repartidos e a exportação", async () => {
    const exported: string[] = [];
    renderView(fakeModule({ exportMarginReport: { execute: async (_y, _m, format) => void exported.push(format) } }));
    expect(await screen.findByText("Margem por plataforma")).toBeInTheDocument();
    expect(screen.getByText("= Margem bruta")).toBeInTheDocument();
    expect(screen.getAllByText("74,0%")).toHaveLength(2);
    expect(screen.getByText(/IVA das vendas 13,25% \(pelo SAF-T do mês\)/)).toBeInTheDocument();
    expect(screen.getByText("Verificar")).toBeInTheDocument();
    expect(screen.getByText(/Glovo 25\/08 – 07\/09 — 75%, pelo faturado diário do SAF-T/)).toBeInTheDocument();
    expect(screen.getByText(/o custo real virá das fichas técnicas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await waitFor(() => expect(exported).toEqual(["pdf"]));
  });

  it("transferências: estado de cada uma, créditos sem documento e aviso do banco", async () => {
    renderView(fakeModule());
    expect(await screen.findByText(/o que os documentos dizem × o que entrou no banco/)).toBeInTheDocument();
    expect(screen.getByText("Diferença", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Por receber")).toBeInTheDocument();
    expect(screen.getByText("até 21/10")).toBeInTheDocument();
    expect(screen.getByText(/Glovo 03\/09/)).toBeInTheDocument();
    expect(screen.getByText(/Banco importado só até 2026-09-30/)).toBeInTheDocument();
  });

  it("custo da comida: estado, produtos e correção de um produto sem correspondência", async () => {
    const saved: unknown[] = [];
    renderView(fakeModule({ saveProductMappings: { execute: async (c) => void saved.push(...c) } }));
    expect(await screen.findByText("Incompleto — a margem usa 30%")).toBeInTheDocument();
    expect(screen.getByText("22,5%")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sugestão: Honey Peperoni (Pequena)" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Corresponde a — Agua mineral 51cl"), { target: { value: "item:i9" } });
    await waitFor(() => expect(saved).toEqual([expect.objectContaining({ productKey: "agua mineral 51cl", targetType: "item", stockItemId: "i9" })]));
    expect(screen.getByText(/«Caixa S» sem custo/)).toBeInTheDocument();
  });

  it("sem extratos: estado vazio", async () => {
    renderView(fakeModule({ listStatements: { execute: async () => [] } }));
    expect(await screen.findByText("Sem extratos neste mês")).toBeInTheDocument();
  });

  it("importa os ficheiros escolhidos e mostra importados e rejeitados", async () => {
    const sent: string[][] = [];
    const result: ImportPlatformDocumentsResult = {
      imported: [
        { fileName: "uber.pdf", platform: "uber_eats", documentNumber: "UBERTEST01", periodFrom: "2026-09-01", periodTo: "2026-09-30", netPayoutCents: 154000, replaced: true },
      ],
      rejected: [{ fileName: "outro.pdf", reason: "Documento não reconhecido" }],
    };
    renderView(fakeModule({ importDocuments: { execute: async (files) => (sent.push(files.map((f) => f.name)), result) } }));
    const input = screen.getByLabelText("Ficheiros");
    fireEvent.change(input, { target: { files: [new File(["%PDF"], "uber.pdf"), new File(["%PDF"], "outro.pdf")] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    expect(await screen.findByText("1 extrato(s) importado(s)")).toBeInTheDocument();
    expect(screen.getByText(/substituiu o anterior/)).toBeInTheDocument();
    expect(screen.getByText(/Documento não reconhecido/)).toBeInTheDocument();
    expect(sent).toEqual([["uber.pdf", "outro.pdf"]]);
  });

  it("formato errado: avisa e não deixa importar", async () => {
    renderView(fakeModule());
    fireEvent.change(screen.getByLabelText("Ficheiros"), { target: { files: [new File(["x"], "folha.xlsx")] } });
    await waitFor(() => expect(screen.getByText("Só PDF, CSV ou XML: folha.xlsx.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });
});
