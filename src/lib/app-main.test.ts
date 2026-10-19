import { describe, expect, it } from "vitest";
import { appMainClass } from "./app-main.ts";

describe("Área principal da aplicação", () => {
  it("no Novo RH não é contentor de scroll (o sticky acompanha a janela); nos outros módulos fica como estava", () => {
    expect(appMainClass("/hr/novo/escalas")).toContain("overflow-x-clip");
    expect(appMainClass("/hr/novo")).toContain("overflow-x-clip");
    expect(appMainClass("/hr/novo/escalas")).not.toContain("overflow-auto");
    expect(appMainClass("/hr/novos")).toContain("overflow-auto");
    expect(appMainClass("/dre/demonstrativo")).toContain("overflow-auto");
    expect(appMainClass("/hr/people")).toContain("overflow-auto");
  });
});
