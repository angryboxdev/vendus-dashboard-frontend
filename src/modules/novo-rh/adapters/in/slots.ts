import { createContext, useContext, type ReactNode } from "react";

/**
 * Ecrãs de outros módulos encaixados no Novo RH pela raiz de composição
 * (`novo-rh.module.tsx`): os adapters do Novo RH não os importam. Sem slot
 * (ex.: nos testes), cada ecrã mostra a alternativa simples.
 */
export interface NovoRhSlots {
  /** Documentos da ficha (motor de documentos do módulo `hr`, FE-022). */
  personDocuments?: (personId: string) => ReactNode;
  /** Documentos da empresa (módulo `documents`, FE-065). */
  companyDocuments?: () => ReactNode;
}

export const NovoRhSlotsContext = createContext<NovoRhSlots>({});

export const useNovoRhSlots = () => useContext(NovoRhSlotsContext);
