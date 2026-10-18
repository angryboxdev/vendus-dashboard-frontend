import { describe, expect, it, vi } from "vitest";
import type { PortalApiPort } from "../../domain/ports/out/portal-api.port.ts";
import { ModeAwarePortalApiAdapter } from "./mode-aware-portal-api.adapter.ts";

const fakeApi = (name: string) => ({ listMyRequests: vi.fn(async () => [{ id: name }]) }) as unknown as PortalApiPort;

describe("Portal — escolha da fonte (Novo RH ou sistema de sempre)", () => {
  it("com o interruptor ligado usa o Novo RH e só pergunta a fonte uma vez", async () => {
    const resolve = vi.fn(async () => "novo_rh" as const);
    const api = new ModeAwarePortalApiAdapter(fakeApi("legacy"), fakeApi("novo"), resolve);
    expect(await api.listMyRequests()).toEqual([{ id: "novo" }]);
    await api.listMyRequests();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("se a leitura da fonte falhar, fica o sistema de sempre", async () => {
    const api = new ModeAwarePortalApiAdapter(fakeApi("legacy"), fakeApi("novo"), async () => {
      throw new Error("offline");
    });
    expect(await api.listMyRequests()).toEqual([{ id: "legacy" }]);
  });
});
