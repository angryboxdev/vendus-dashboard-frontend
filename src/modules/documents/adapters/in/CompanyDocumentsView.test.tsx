import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InMemoryCompanyDocumentsApiAdapter } from "../out/in-memory-company-documents-api.adapter.ts";
import {
  CreateCompanyDocumentCategoryUseCase,
  GetCompanyDocumentDownloadUrlUseCase,
  GetCompanyDocumentHistoryUseCase,
  ListCompanyDocumentCategoriesUseCase,
  ListCompanyDocumentsUseCase,
  RemoveCompanyDocumentUseCase,
  ReplaceCompanyDocumentUseCase,
  SetCompanyDocumentCategoryActiveUseCase,
  UploadCompanyDocumentUseCase,
} from "../../application/use-cases/company-documents.use-cases.ts";
import { DocumentsProvider, type DocumentsModule } from "../../documents.module.tsx";
import { CompanyDocumentsView } from "./CompanyDocumentsView.tsx";

/** Objeto estável entre renders (ver nota no teste de LocationsAdminView). */
const auth = vi.hoisted(() => ({
  value: { user: { id: "u1", email: "admin@exemplo.pt", role: "admin" as "admin" | "manager" | "hr_viewer", organizationId: "org" }, loading: false },
}));
vi.mock("../../../../contexts/AuthContext.tsx", () => ({ useAuth: () => auth.value }));

function setRole(role: "admin" | "manager" | "hr_viewer") {
  auth.value = { ...auth.value, user: { ...auth.value.user, role } };
}

function renderView() {
  const api = new InMemoryCompanyDocumentsApiAdapter([
    { id: "c1", slug: "apolice", label: "Apólice de seguro", scope: "company", acceptedMimeTypes: [], active: true },
  ]);
  const mod: DocumentsModule = {
    listDocuments: new ListCompanyDocumentsUseCase(api),
    uploadDocument: new UploadCompanyDocumentUseCase(api),
    replaceDocument: new ReplaceCompanyDocumentUseCase(api),
    removeDocument: new RemoveCompanyDocumentUseCase(api),
    getDownloadUrl: new GetCompanyDocumentDownloadUrlUseCase(api),
    getHistory: new GetCompanyDocumentHistoryUseCase(api),
    listCategories: new ListCompanyDocumentCategoriesUseCase(api),
    createCategory: new CreateCompanyDocumentCategoryUseCase(api),
    setCategoryActive: new SetCompanyDocumentCategoryActiveUseCase(api),
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DocumentsProvider module={mod}>
        <CompanyDocumentsView />
      </DocumentsProvider>
    </QueryClientProvider>,
  );
}

const pdf = (name: string) => new File(["%PDF"], name, { type: "application/pdf" });

describe("CompanyDocumentsView", () => {
  it("envia um documento e renova-o, preservando a versão anterior no histórico", async () => {
    setRole("admin");
    renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Novo documento" }));
    let dialog = screen.getByRole("dialog", { name: "Novo documento da empresa" });
    await user.selectOptions(within(dialog).getByLabelText(/Categoria/), "apolice");
    await user.upload(within(dialog).getByLabelText(/Ficheiro/), pdf("apolice-2026.pdf"));
    await user.click(within(dialog).getByRole("button", { name: "Enviar documento" }));
    expect(await screen.findByText("apolice-2026.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Renovar" }));
    dialog = screen.getByRole("dialog", { name: "Renovar Apólice de seguro" });
    await user.upload(within(dialog).getByLabelText(/Ficheiro/), pdf("apolice-2027.pdf"));
    await user.click(within(dialog).getByRole("button", { name: "Guardar nova versão" }));

    expect(await screen.findByText("apolice-2027.pdf")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Histórico" }));
    expect(await screen.findByText("Substituído")).toBeInTheDocument();
  });

  it("gestor não vê a opção 'Só administração'", async () => {
    setRole("manager");
    renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Novo documento" }));
    const options = within(screen.getByLabelText("Visibilidade")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Gestão"]);
  });

  it("perfil só-leitura de RH não tem acesso", () => {
    setRole("hr_viewer");
    renderView();
    expect(screen.getByText("Os documentos da empresa só estão disponíveis para a gestão.")).toBeInTheDocument();
  });
});
