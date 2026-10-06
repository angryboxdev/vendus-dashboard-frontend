import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SalesDeclarationFile, SaftUpload } from "../../domain/entities/sales-declaration.ts";
import { ExportSalesDeclarationUseCase } from "../../application/use-cases/export-sales-declaration.use-case.ts";
import { SalesDeclarationProvider, type SalesDeclarationModule } from "../../sales-declaration.module.tsx";
import { SalesDeclarationView } from "./SalesDeclarationView.tsx";

function renderView(
  exportFromSaft: (files: SaftUpload[]) => Promise<SalesDeclarationFile> = vi.fn(async () => ({ fileName: "SalesReport.xlsx", content: new ArrayBuffer(1) })),
) {
  const save = vi.fn();
  const mod: SalesDeclarationModule = { exportSalesDeclaration: new ExportSalesDeclarationUseCase({ exportFromSaft }, { save }) };
  render(
    <SalesDeclarationProvider module={mod}>
      <SalesDeclarationView />
    </SalesDeclarationProvider>,
  );
  return { exportFromSaft, save };
}

const xml = (name: string) => new File(["<AuditFile/>"], name, { type: "text/xml" });

describe("SalesDeclarationView", () => {
  it("só permite gerar depois de escolher ficheiros", () => {
    renderView();
    expect(screen.getByRole("button", { name: "Gerar Excel" })).toBeDisabled();
  });

  it("envia os SAF-T escolhidos e descarrega o Excel devolvido", async () => {
    const user = userEvent.setup();
    const { exportFromSaft, save } = renderView();

    await user.upload(screen.getByLabelText(/Ficheiros SAF-T/), [xml("vendus.xml"), xml("bo.xml")]);
    expect(screen.getByText("vendus.xml")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerar Excel" }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(vi.mocked(exportFromSaft).mock.calls[0]![0].map((f) => f.name)).toEqual(["vendus.xml", "bo.xml"]);
    expect(save.mock.calls[0]![0].fileName).toBe("SalesReport.xlsx");
  });

  it("permite remover um ficheiro da lista", async () => {
    const user = userEvent.setup();
    renderView();
    await user.upload(screen.getByLabelText(/Ficheiros SAF-T/), [xml("a.xml"), xml("b.xml")]);

    await user.click(screen.getByRole("button", { name: "Remover a.xml" }));

    expect(screen.queryByText("a.xml")).not.toBeInTheDocument();
    expect(screen.getByText("b.xml")).toBeInTheDocument();
  });

  it("avisa e bloqueia quando o ficheiro não é .xml", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderView();

    await user.upload(screen.getByLabelText(/Ficheiros SAF-T/), new File(["x"], "extrato.pdf"));

    expect(screen.getByText(/extrato\.pdf" não é um ficheiro \.xml/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar Excel" })).toBeDisabled();
  });

  it("mostra o erro devolvido pelo backend", async () => {
    const user = userEvent.setup();
    renderView(vi.fn(async () => { throw new Error("lixo.xml: O ficheiro não é um SAF-T"); }));
    await user.upload(screen.getByLabelText(/Ficheiros SAF-T/), xml("lixo.xml"));

    await user.click(screen.getByRole("button", { name: "Gerar Excel" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("não é um SAF-T");
  });
});
