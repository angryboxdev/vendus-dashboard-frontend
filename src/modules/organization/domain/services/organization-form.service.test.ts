import { describe, expect, it } from "vitest";
import { sampleOrganizationProfile } from "../../adapters/out/in-memory-organization-api.adapter.ts";
import { diffChanges, hasChanges, toFormValues, validateLogoFile } from "./organization-form.service.ts";
import { changedFieldLabels } from "./organization-history.service.ts";

describe("diffChanges", () => {
  it("devolve só os campos alterados, comparando após trim", () => {
    const profile = sampleOrganizationProfile();
    const values = { ...toFormValues(profile), legalName: "Exemplo, Lda", name: "  Pizzaria Exemplo  " };

    expect(diffChanges(profile, values)).toEqual({ legalName: "Exemplo, Lda" });
  });

  it("opcional esvaziado vai como null; obrigatório esvaziado vai como string vazia", () => {
    const profile = sampleOrganizationProfile({ phone: "+351 220 000 000" });
    const values = { ...toFormValues(profile), phone: "", nif: "" };

    expect(diffChanges(profile, values)).toEqual({ phone: null, nif: "" });
  });

  it("sem alterações não há nada a enviar", () => {
    const profile = sampleOrganizationProfile();
    expect(hasChanges(diffChanges(profile, toFormValues(profile)))).toBe(false);
  });
});

describe("validateLogoFile", () => {
  it("aceita imagens até 2 MB e recusa outros formatos ou tamanhos", () => {
    expect(validateLogoFile({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateLogoFile({ type: "application/pdf", size: 1024 })).toMatch(/Formato/);
    expect(validateLogoFile({ type: "image/png", size: 3 * 1024 * 1024 })).toMatch(/2 MB/);
  });
});

describe("changedFieldLabels", () => {
  it("lista os rótulos dos campos que mudaram numa alteração", () => {
    const before = sampleOrganizationProfile();
    const after = { ...before, legalName: "Exemplo, Lda", city: "Porto" };
    expect(changedFieldLabels({ id: "1", createdAt: "", action: "update", actor: "x", before, after })).toEqual([
      "Razão social",
      "Localidade",
    ]);
  });
});
