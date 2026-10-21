import { describe, expect, it } from "vitest";
import type { DataModeStorePort } from "../../domain/ports/out/demo-api.port.ts";
import { SessionDataModeStore } from "./http-demo-api.adapter.ts";

describe("SessionDataModeStore", () => {
  it("abre sempre em Real, mesmo que a Demonstração tenha ficado guardada antes, e limpa a chave antiga", () => {
    localStorage.setItem("novo-rh.data-mode", "demo");
    const store: DataModeStorePort = new SessionDataModeStore();
    expect(store.load()).toBe("real");
    expect(localStorage.getItem("novo-rh.data-mode")).toBeNull();
    store.save("demo");
    expect(new SessionDataModeStore().load()).toBe("real");
  });
});
