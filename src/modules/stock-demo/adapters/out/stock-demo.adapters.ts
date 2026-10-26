import { apiGet, apiPost } from "../../../../lib/api.ts";
import { isStockDemoScenario, type StockDemoScenario, type StockDemoSeedResultDTO, type StockDemoStatusDTO } from "../../domain/entities/stock-demo.ts";
import type { StockDemoApiPort, StockDemoModeStorePort } from "../../domain/ports/out/stock-demo.port.ts";

export class HttpStockDemoApiAdapter implements StockDemoApiPort {
  getStatus(): Promise<StockDemoStatusDTO> {
    return apiGet<StockDemoStatusDTO>("/api/stock-demo");
  }

  create(scenario: StockDemoScenario): Promise<StockDemoSeedResultDTO> {
    return apiPost<StockDemoSeedResultDTO>(`/api/stock-demo/${scenario}`, {});
  }

  reset(scenario: StockDemoScenario): Promise<StockDemoSeedResultDTO> {
    return apiPost<StockDemoSeedResultDTO>(`/api/stock-demo/${scenario}/reset`, {});
  }
}

const KEY = "mezza.stockDemoScenario";

/** localStorage com try/catch: navegação privada ou armazenamento bloqueado → sem demonstração. */
export class LocalStorageStockDemoModeStore implements StockDemoModeStorePort {
  get(): StockDemoScenario | null {
    try {
      const v = window.localStorage.getItem(KEY);
      return isStockDemoScenario(v) ? v : null;
    } catch {
      return null;
    }
  }

  set(scenario: StockDemoScenario | null): void {
    try {
      if (scenario) window.localStorage.setItem(KEY, scenario);
      else window.localStorage.removeItem(KEY);
    } catch {
      // Sem armazenamento: o modo dura só até recarregar a página.
    }
  }
}
