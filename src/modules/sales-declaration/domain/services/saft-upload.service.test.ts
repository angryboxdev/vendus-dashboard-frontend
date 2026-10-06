import { describe, expect, it } from "vitest";
import { MAX_SAFT_FILES, validateSaftFiles } from "./saft-upload.service.ts";

describe("validateSaftFiles", () => {
  it("aceita um ou mais .xml (qualquer capitalização)", () => {
    expect(validateSaftFiles(["vendus.xml"])).toBeNull();
    expect(validateSaftFiles(["Vendus-saft.XML", "saft_bo.xml"])).toBeNull();
  });

  it("exige pelo menos um ficheiro", () => {
    expect(validateSaftFiles([])).toMatch(/pelo menos um/);
  });

  it("rejeita ficheiros que não são .xml, indicando qual", () => {
    expect(validateSaftFiles(["a.xml", "extrato.pdf"])).toContain("extrato.pdf");
  });

  it("rejeita mais ficheiros do que o backend aceita", () => {
    const names = Array.from({ length: MAX_SAFT_FILES + 1 }, (_, i) => `f${i}.xml`);
    expect(validateSaftFiles(names)).toContain(String(MAX_SAFT_FILES));
  });
});
