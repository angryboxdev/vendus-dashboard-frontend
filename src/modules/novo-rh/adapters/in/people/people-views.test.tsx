import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Person } from "../../../domain/entities/people.ts";
import { changedFields, draftOf, needsReason } from "../../../domain/services/people-form.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { PeopleListView } from "./PeopleListView.tsx";
import { PersonView } from "./PersonView.tsx";

const PERSON: Person = {
  id: "e1", firstName: "Carla", lastName: "Demo", fullName: "Carla Demo", nif: "123456789", email: "carla@demo.invalid", phone: null, personalEmail: null,
  address: null, postalCode: null, city: null, country: null, birthDate: null, gender: null, nationality: null, niss: null, idCardNumber: null, iban: null,
  hireDate: "2026-10-01", primaryLocationId: "loc-1", positionId: null, status: "active", currency: "EUR", payPeriod: "monthly", baseSalary: null, hourlyRate: null,
  deactivatedAt: null, deactivationReason: null, userId: null, photoUrl: null, version: 3, hidden: ["iban"], missing: [],
};

function renderAt(path: string, ui: ReactNode, mod: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={qc}>
        <NovoRhProvider module={mod}>
          <Routes>
            <Route path="/hr/novo/pessoas" element={ui} />
            <Route path="/hr/novo/pessoas/:id" element={ui} />
          </Routes>
        </NovoRhProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function mod() {
  const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => [{ id: "loc-1", label: "Loja Porto" }]), listDefinitions: vi.fn(async () => []), effective: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
  return m;
}

describe("Novo RH → Pessoas", () => {
  it("formulário: só os campos alterados; sensível pede motivo; escondidos nunca vão", () => {
    const d = draftOf(PERSON);
    expect(changedFields(PERSON, d)).toEqual({});
    const c = changedFields(PERSON, { ...d, phone: "910000000", nif: "999999999", iban: "PT50..." });
    expect(c).toEqual({ phone: "910000000", nif: "999999999" });
    expect(needsReason(c)).toBe(true);
    expect(needsReason({ phone: "x" })).toBe(false);
  });

  it("lista: escondido mostra 'Sem permissão'; ficha a completar assinalada", async () => {
    const m = mod();
    m.people.list = vi.fn(async () => [{ ...PERSON, hidden: ["nif"], missing: ["nif"] }]);
    renderAt("/hr/novo/pessoas", <PeopleListView />, m);
    expect(await screen.findByRole("link", { name: "Carla Demo" })).toHaveAttribute("href", "/hr/novo/pessoas/e1");
    // O NIF é uma coluna opcional na lista premium.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Colunas" }));
    await user.click(screen.getByRole("checkbox", { name: "NIF" }));
    expect(screen.getByText("Sem permissão")).toBeInTheDocument();
    expect(screen.getByText("A completar")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "Loja Porto" })).toBeInTheDocument();
  });

  it("ficha: alterar NIF pede motivo e envia com a versão lida", async () => {
    const m = mod();
    m.people.get = vi.fn(async () => ({ person: PERSON, etag: '"v3"' }));
    m.people.update = vi.fn(async () => ({ person: { ...PERSON, nif: "999999999", version: 4 }, etag: '"v4"' }));
    renderAt("/hr/novo/pessoas/e1", <PersonView />, m);
    const user = userEvent.setup();
    const nif = await screen.findByLabelText(/^NIF/);
    expect(screen.getByText("Sem permissão")).toBeInTheDocument(); // IBAN escondido
    await user.clear(nif);
    await user.type(nif, "999999999");
    const save = screen.getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Motivo da alteração"), "Correção do NIF");
    await user.click(save);
    expect(m.people.update).toHaveBeenCalledWith("e1", '"v3"', { nif: "999999999", reason: "Correção do NIF" });
  });

  it("ficha: desativar exige motivo", async () => {
    const m = mod();
    m.people.get = vi.fn(async () => ({ person: PERSON, etag: '"v3"' }));
    m.people.deactivate = vi.fn(async () => ({ person: { ...PERSON, status: "inactive" as const }, etag: '"v4"' }));
    renderAt("/hr/novo/pessoas/e1", <PersonView />, m);
    const user = userEvent.setup();
    const btn = await screen.findByRole("button", { name: "Desativar" });
    expect(btn).toBeDisabled();
    const header = btn.parentElement!;
    await user.type(within(header).getByLabelText("Motivo para desativar ou reativar"), "Fim do contrato");
    await user.click(btn);
    expect(m.people.deactivate).toHaveBeenCalledWith("e1", '"v3"', "Fim do contrato");
  });

  it("ficha: PIN do quiosque só com o quiosque ligado; 4 dígitos", async () => {
    const m = mod();
    m.people.get = vi.fn(async () => ({ person: PERSON, etag: '"v3"' }));
    m.people.setKioskPin = vi.fn(async () => {});
    (m.settings as unknown as { features: () => Promise<Record<string, boolean>> }).features = vi.fn(async () => ({ "time_tracking.kiosk.enabled": true }));
    renderAt("/hr/novo/pessoas/e1", <PersonView />, m);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "PIN do quiosque" }));
    const save = screen.getByRole("button", { name: "Guardar PIN" });
    await user.type(screen.getByLabelText("Novo PIN (4 dígitos)"), "12a3");
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Novo PIN (4 dígitos)"), "4");
    await user.click(save);
    expect(m.people.setKioskPin).toHaveBeenCalledWith("e1", "1234");
    expect(await screen.findByText("PIN do quiosque guardado.")).toBeInTheDocument();
  });

  it("ficha: sem o quiosque ligado não há botão de PIN", async () => {
    const m = mod();
    m.people.get = vi.fn(async () => ({ person: PERSON, etag: '"v3"' }));
    (m.settings as unknown as { features: () => Promise<Record<string, boolean>> }).features = vi.fn(async () => ({ "time_tracking.kiosk.enabled": false }));
    renderAt("/hr/novo/pessoas/e1", <PersonView />, m);
    await screen.findByRole("button", { name: "Desativar" });
    expect(screen.queryByRole("button", { name: "PIN do quiosque" })).toBeNull();
  });
});
