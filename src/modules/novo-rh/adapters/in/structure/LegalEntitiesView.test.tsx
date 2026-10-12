import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { LegalEntity } from "../../../domain/entities/legal-entities.ts";
import { legalEntityErrors, validEsCif, validPtNif } from "../../../domain/services/legal-entities.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { LegalEntitiesView } from "./LegalEntitiesView.tsx";

const CATALOG = [
  { code: "PT" as const, label: "Portugal", taxIdTypes: [{ key: "nif" as const, label: "NIF / NIPC" }], regionLabel: "Distrito", socialSecurityLabel: "NISS da entidade" },
  { code: "ES" as const, label: "Espanha", taxIdTypes: [{ key: "cif" as const, label: "CIF" }], regionLabel: "Província", socialSecurityLabel: "CCC" },
];
// Dados fictícios: NIF de exemplo com dígito de controlo válido.
const ENTITY: LegalEntity = { id: "le1", name: "Entidade PT Demo", country: "PT", taxIdType: "nif", taxId: "123456789", socialSecurityId: "20000000000", billingEmail: "f@demo.invalid", street: "Rua Exemplo 1", postalCode: "4000-001", city: "Porto", region: "Porto", phone: null, status: "active", createdAt: "x", updatedAt: "x", etag: '"v1"', locations: 1 };

function renderWith(m: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <LegalEntitiesView />
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

describe("Entidades legais (FE-092)", () => {
  it("validação no cliente igual à do servidor", () => {
    expect(validPtNif("123456789")).toBe(true);
    expect(validEsCif("B12345674")).toBe(true);
    const e = legalEntityErrors({ ...ENTITY, taxId: "123456780", postalCode: "4000", phone: "220000000" }, "Distrito");
    expect(Object.keys(e).sort()).toEqual(["phone", "postalCode", "taxId"]);
  });

  it("criar: erros ao sair do campo e envio com os dados", async () => {
    const m = fakeNovoRhModule();
    m.legalEntities.catalog = vi.fn(async () => CATALOG);
    m.legalEntities.create = vi.fn(async () => ENTITY);
    renderWith(m);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nova entidade" }));
    const box = screen.getByRole("region", { name: "Nova entidade" });
    await user.type(within(box).getByLabelText("N.º de identificação fiscal"), "123456780");
    await user.tab();
    expect(within(box).getByText("Identificação fiscal inválida (formato ou dígito de controlo).")).toBeInTheDocument();
    await user.clear(within(box).getByLabelText("N.º de identificação fiscal"));
    await user.type(within(box).getByLabelText("N.º de identificação fiscal"), "123456789");
    await user.type(within(box).getByLabelText("Denominação social"), "Entidade PT Demo");
    await user.type(within(box).getByLabelText("NISS da entidade"), "20000000000");
    await user.type(within(box).getByLabelText("E-mail de faturação"), "f@demo.invalid");
    await user.type(within(box).getByLabelText("Morada (rua e número)"), "Rua Exemplo 1");
    await user.type(within(box).getByLabelText("Código postal"), "4000-001");
    await user.type(within(box).getByLabelText("Localidade"), "Porto");
    await user.type(within(box).getByLabelText("Distrito"), "Porto");
    await user.click(within(box).getByRole("button", { name: "Criar entidade" }));
    expect(m.legalEntities.create).toHaveBeenCalledWith(expect.objectContaining({ taxId: "123456789", country: "PT", postalCode: "4000-001", phone: null }));
  });

  it("editar em uso: país bloqueado, motivo obrigatório e aviso fiscal; arquivar bloqueado mostra as contagens", async () => {
    const m = fakeNovoRhModule();
    m.legalEntities.catalog = vi.fn(async () => CATALOG);
    m.legalEntities.list = vi.fn(async () => [ENTITY]);
    m.legalEntities.usage = vi.fn(async () => ({ locations: 1, contracts: 4 }));
    m.legalEntities.update = vi.fn(async () => ENTITY);
    m.legalEntities.archive = vi.fn(async () => {
      throw new ApiError("em uso", 409, { locations: 1, contracts: 4 });
    });
    renderWith(m);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Abrir" }));
    const box = screen.getByRole("region", { name: "Entidade PT Demo" });
    expect(await within(box).findByText("Em uso: 1 centro(s) ativo(s) e 4 contrato(s) em vigor.")).toBeInTheDocument();
    expect(within(box).getByLabelText("País")).toBeDisabled();
    await user.clear(within(box).getByLabelText("NISS da entidade"));
    await user.type(within(box).getByLabelText("NISS da entidade"), "20000000001");
    expect(within(box).getByText(/Vai alterar dados fiscais/)).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Gravar alterações" })).toBeDisabled();
    await user.type(within(box).getByLabelText("Motivo da alteração"), "Correção do NISS");
    await user.click(within(box).getByRole("button", { name: "Gravar alterações" }));
    expect(m.legalEntities.update).toHaveBeenCalledWith(ENTITY, { socialSecurityId: "20000000001" }, "Correção do NISS");
  });

  it("arquivar com uso mostra as contagens do servidor", async () => {
    const m = fakeNovoRhModule();
    m.legalEntities.catalog = vi.fn(async () => CATALOG);
    m.legalEntities.list = vi.fn(async () => [ENTITY]);
    m.legalEntities.archive = vi.fn(async () => {
      throw new ApiError("em uso", 409, { locations: 1, contracts: 4 });
    });
    renderWith(m);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Abrir" }));
    const box = screen.getByRole("region", { name: "Entidade PT Demo" });
    await user.type(within(box).getByLabelText("Motivo para arquivar"), "Fecho da empresa");
    await user.click(within(box).getByRole("button", { name: "Arquivar" }));
    expect(await within(box).findByText("Não é possível arquivar: 1 centro(s) ativo(s) e 4 contrato(s) em vigor.")).toBeInTheDocument();
  });

  it("FE-093: escolher a entidade de um centro", async () => {
    const m = fakeNovoRhModule();
    m.legalEntities.catalog = vi.fn(async () => CATALOG);
    m.legalEntities.list = vi.fn(async () => [ENTITY]);
    m.legalEntities.locations = vi.fn(async () => [{ id: "porto", name: "Porto", legalEntityId: null }]);
    m.legalEntities.setLocationEntity = vi.fn(async () => []);
    renderWith(m);
    const user = userEvent.setup();
    const select = await screen.findByLabelText("Entidade do centro Porto");
    await screen.findByRole("option", { name: "Entidade PT Demo" });
    await user.selectOptions(select, "le1");
    expect(m.legalEntities.setLocationEntity).toHaveBeenCalledWith("porto", "le1");
  });
});
