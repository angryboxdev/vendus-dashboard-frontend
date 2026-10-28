import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeliveryPlatformsProvider, type DeliveryPlatformsModule } from "../../delivery-platforms.module.tsx";
import type { ImportPlatformDocumentsResult } from "../../domain/entities/platform-statement.ts";
import { sampleStatements } from "../../domain/services/fixtures.ts";
import { DeliveryPlatformsView } from "./DeliveryPlatformsView.tsx";

const fakeModule = (over: Partial<DeliveryPlatformsModule> = {}): DeliveryPlatformsModule => ({
  importDocuments: { execute: async () => ({ imported: [], rejected: [] }) },
  listStatements: { execute: async () => sampleStatements() },
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
    await waitFor(() => expect(screen.getByText("Só PDF ou CSV: folha.xlsx.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });
});
