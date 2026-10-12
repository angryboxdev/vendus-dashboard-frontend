import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type { DataMode } from "../../domain/entities/roadmap.ts";
import type {
  DataModeStorePort,
  DemoApiPort,
  DemoStatus,
} from "../../domain/ports/out/demo-api.port.ts";

const P = "/api/novo-rh/demo";

export class HttpDemoApiAdapter implements DemoApiPort {
  status() {
    return apiGet<DemoStatus>(P);
  }
  async create() {
    return (await apiWrite<DemoStatus>(P, {})).data;
  }
  async refresh() {
    return (await apiWrite<{ punches: number; scenario: boolean }>(`${P}/refresh`, {})).data;
  }
}

const STORAGE_KEY = "novo-rh.data-mode";

export class LocalStorageDataModeStore implements DataModeStorePort {
  load(): DataMode {
    try {
      return localStorage.getItem(STORAGE_KEY) === "demo" ? "demo" : "real";
    } catch {
      return "real";
    }
  }
  save(mode: DataMode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Sem armazenamento: o modo vale só para esta página.
    }
  }
}

/** Em Demonstração, só os pedidos do Novo RH levam o cabeçalho (o backend ignora-o fora de /api/novo-rh). */
export function novoRhModeHeaders(mode: DataMode) {
  return (path: string): Record<string, string> =>
    mode === "demo" && /^(https?:\/\/[^/]+)?\/api\/novo-rh\//.test(path)
      ? { "X-Novo-RH-Mode": "demo" }
      : {};
}
