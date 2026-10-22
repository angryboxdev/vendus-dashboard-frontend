import { createContext, useContext, type ReactNode } from "react";

/**
 * Ecrãs de outros módulos encaixados no Novo RH pela raiz de composição
 * (`novo-rh.module.tsx`): os adapters do Novo RH não os importam. Sem slot
 * (ex.: nos testes), cada ecrã mostra a alternativa simples.
 */
export interface NovoRhSlots {
  /** Documentos da ficha (módulo `documents`, FE-022; ADR-0040 fase 1). */
  personDocuments?: (personId: string) => ReactNode;
  /** Documentos dos colaboradores por pastas (módulo `documents`, Mais → Documentos). */
  employeeArchive?: () => ReactNode;
  /** Documentos da empresa (módulo `documents`, FE-065). */
  companyDocuments?: () => ReactNode;
  /** «Importar recibos» (módulo `documents`). */
  payslipImport?: () => ReactNode;
}

export const NovoRhSlotsContext = createContext<NovoRhSlots>({});

export const useNovoRhSlots = () => useContext(NovoRhSlotsContext);
