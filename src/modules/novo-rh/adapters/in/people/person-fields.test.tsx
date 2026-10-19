import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Person } from "../../../domain/entities/people.ts";
import { changedFields, draftOf } from "../../../domain/services/people-form.service.ts";
import { formatIban, ibanStatus, ibanToSave, joinPhone, nationalities, splitPhone, withCurrent } from "../../../domain/services/person-fields.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { PersonView } from "./PersonView.tsx";

/** IBAN, telefone com indicativo, género e nacionalidade em lista. Dados fictícios. */
const VALID_PT = "PT50000201231234567890154";
const PERSON: Person = {
  id: "e1", firstName: "Carla", lastName: "Demo", fullName: "Carla Demo", nif: "123456789", email: "carla@demo.invalid", phone: "912345678", personalEmail: null,
  address: null, postalCode: null, city: null, country: null, birthDate: null, gender: "F", nationality: null, niss: null, idCardNumber: null, iban: null,
  hireDate: "2026-10-01", primaryLocationId: "loc-1", positionId: null, status: "active", currency: "EUR", payPeriod: "monthly", baseSalary: null, hourlyRate: null,
  deactivatedAt: null, deactivationReason: null, userId: null, photoUrl: null, version: 3, hidden: [], missing: [],
};

function renderPerson(m: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter initialEntries={["/hr/novo/pessoas/e1"]}>
      <QueryClientProvider client={qc}>
        <NovoRhProvider module={m}>
          <Routes>
            <Route path="/hr/novo/pessoas/:id" element={<PersonView />} />
          </Routes>
        </NovoRhProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
const mod = () => {
  const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => [{ id: "loc-1", label: "Loja Porto" }]), listDefinitions: vi.fn(async () => []), effective: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
  m.people.get = vi.fn(async () => ({ person: PERSON, etag: '"v3"' }));
  m.people.update = vi.fn(async () => ({ person: { ...PERSON, version: 4 }, etag: '"v4"' }));
  return m;
};

describe("Campos da ficha — regras", () => {
  it("IBAN: agrupado de 4 em 4, dígito de controlo, PT com 25 caracteres; só «PT50» conta como vazio", () => {
    expect(formatIban("pt50000201231234567890154")).toBe("PT50 0002 0123 1234 5678 9015 4");
    expect(ibanStatus(VALID_PT)).toBe("valid");
    expect(ibanStatus("PT50 0002 0123 1234 5678 9015 5")).toBe("invalid");
    expect(ibanStatus("PT5000020123")).toBe("invalid");
    expect(ibanStatus("PT50")).toBeNull();
    expect(ibanStatus("")).toBeNull();
    expect(ibanToSave("PT50")).toBe("");
    expect(ibanToSave("PT50 0002 0123 1234 5678 9015 4")).toBe(VALID_PT);
  });

  it("telefone: indicativo à escolha (Portugal por omissão), números antigos sem indicativo continuam a funcionar", () => {
    expect(splitPhone("912345678")).toEqual({ code: "+351", number: "912345678" });
    expect(splitPhone("+34 600 123 456")).toEqual({ code: "+34", number: "600123456" });
    expect(splitPhone("0033612345678")).toEqual({ code: "+33", number: "612345678" });
    expect(splitPhone("+1809 5551234")).toEqual({ code: "+1809", number: "5551234" });
    expect(splitPhone("")).toEqual({ code: "+351", number: "" });
    expect(joinPhone("+351", "912 345 678")).toBe("+351 912345678");
    expect(joinPhone("+351", "")).toBe("");
  });

  it("listas: nacionalidades em português com Portugal primeiro; valor antigo fora da lista mantém-se", () => {
    const n = nationalities();
    expect(n.slice(0, 3)).toEqual(["Portugal", "Espanha", "Brasil"]);
    expect(n.length).toBeGreaterThan(180);
    expect(withCurrent(["Feminino"], "F")).toEqual(["F", "Feminino"]);
    expect(withCurrent(["Feminino"], "Feminino")).toEqual(["Feminino"]);
  });

  it("formulário: tocar no IBAN vazio (PT50) não conta como alteração; IBAN e telefone gravam normalizados", () => {
    const d = draftOf(PERSON);
    expect(changedFields(PERSON, { ...d, iban: "PT50" })).toEqual({});
    expect(changedFields(PERSON, { ...d, iban: "PT50 0002 0123 1234 5678 9015 4", phone: "+34 600123456" })).toEqual({ iban: VALID_PT, phone: "+34 600123456" });
  });
});

describe("Campos da ficha — ecrã", () => {
  it("IBAN começa em PT50, mostra se é válido e grava sem espaços (com motivo)", async () => {
    const m = mod();
    renderPerson(m);
    const user = userEvent.setup();
    const iban = await screen.findByLabelText("IBAN");
    await user.click(iban);
    expect(iban).toHaveValue("PT50");
    await user.type(iban, "000201231234567890154");
    expect(iban).toHaveValue("PT50 0002 0123 1234 5678 9015 4");
    expect(screen.getByText("IBAN válido.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Motivo da alteração"), "Novo IBAN");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(m.people.update).toHaveBeenCalledWith("e1", '"v3"', { iban: VALID_PT, reason: "Novo IBAN" });
  });

  it("telefone: troca de indicativo; género e nacionalidade em lista (valor antigo mantém-se)", async () => {
    const m = mod();
    renderPerson(m);
    const user = userEvent.setup();
    const phone = await screen.findByLabelText("Telefone");
    expect(phone).toHaveValue("912345678");
    expect(screen.getByLabelText("Indicativo do país")).toHaveValue("+351");
    await user.selectOptions(screen.getByLabelText("Indicativo do país"), "+34");
    expect(screen.getByLabelText("Género")).toHaveValue("F");
    await user.selectOptions(screen.getByLabelText("Género"), "Feminino");
    await user.selectOptions(screen.getByLabelText("Nacionalidade"), "Portugal");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(m.people.update).toHaveBeenCalledWith("e1", '"v3"', { phone: "+34 912345678", gender: "Feminino", nationality: "Portugal" });
  });
});
