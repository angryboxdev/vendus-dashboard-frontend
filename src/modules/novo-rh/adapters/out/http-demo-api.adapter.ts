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
    return (await apiWrite<{ punches: number; scenario: boolean; running?: boolean }>(`${P}/refresh`, {})).data;
  }
}

/** Chave antiga: o modo ficava guardado no navegador e a Demonstração voltava em cada visita. */
const LEGACY_STORAGE_KEY = "novo-rh.data-mode";

/**
 * O Novo RH abre sempre com os dados Reais (decisão do utilizador,
 * 2026-10-21); a Demonstração só se ativa à mão e vale enquanto a página
 * estiver aberta — recarregar ou voltar a entrar volta a Real.
 */
export class SessionDataModeStore implements DataModeStorePort {
  load(): DataMode {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Sem armazenamento: nada a limpar.
    }
    return "real";
  }
  save() {
    // Não se guarda: o modo vive só no estado da página.
  }
}

/** Em Demonstração, só os pedidos do Novo RH levam o cabeçalho (o backend ignora-o fora de /api/novo-rh). */
export function novoRhModeHeaders(mode: DataMode) {
  return (path: string): Record<string, string> =>
    mode === "demo" && /^(https?:\/\/[^/]+)?\/api\/novo-rh\//.test(path)
      ? { "X-Novo-RH-Mode": "demo" }
      : {};
}
