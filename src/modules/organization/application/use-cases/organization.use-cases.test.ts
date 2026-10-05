import { describe, expect, it } from "vitest";
import { InMemoryOrganizationApiAdapter } from "../../adapters/out/in-memory-organization-api.adapter.ts";
import { InvalidLogoFileError } from "../../domain/entities/organization-errors.ts";
import { toFormValues } from "../../domain/services/organization-form.service.ts";
import { UpdateOrganizationProfileUseCase, UploadOrganizationLogoUseCase } from "./organization.use-cases.ts";

describe("UpdateOrganizationProfileUseCase", () => {
  it("envia só os campos alterados", async () => {
    const api = new InMemoryOrganizationApiAdapter();
    const current = await api.getProfile();

    const updated = await new UpdateOrganizationProfileUseCase(api).execute(current, {
      ...toFormValues(current),
      legalName: "Exemplo, Lda",
    });

    expect(api.updateCalls).toEqual([{ legalName: "Exemplo, Lda" }]);
    expect(updated.legalName).toBe("Exemplo, Lda");
  });

  it("sem alterações não faz pedido", async () => {
    const api = new InMemoryOrganizationApiAdapter();
    const current = await api.getProfile();

    const result = await new UpdateOrganizationProfileUseCase(api).execute(current, toFormValues(current));

    expect(result).toBe(current);
    expect(api.updateCalls).toHaveLength(0);
  });
});

describe("UploadOrganizationLogoUseCase", () => {
  it("recusa ficheiro inválido antes de qualquer pedido", async () => {
    const api = new InMemoryOrganizationApiAdapter();
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });

    await expect(new UploadOrganizationLogoUseCase(api).execute(pdf)).rejects.toBeInstanceOf(InvalidLogoFileError);
    expect((await api.getProfile()).logoUrl).toBeNull();
  });
});
