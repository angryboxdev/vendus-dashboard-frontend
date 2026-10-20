import { useState } from "react";
import { Button } from "../../components/ui/index.ts";
import { CompanyDocumentsView } from "../documents/adapters/in/CompanyDocumentsView.tsx";
import { EmployeeDocumentsPanel } from "../documents/adapters/in/EmployeeDocumentsPanel.tsx";
import { ImportPayslipsModal } from "../documents/adapters/in/ImportPayslipsModal.tsx";
import { DocumentsProvider, EmployeeDocumentsProvider } from "../documents/documents.module.tsx";

/** Documentos da ficha: módulo `documents` (requisitos, validade, versões) — ADR-0040, fase 1 (já sem o RH antigo). */
export function PersonDocumentsSlot({ personId }: { personId: string }) {
  return (
    <EmployeeDocumentsProvider>
      <EmployeeDocumentsPanel employeeId={personId} />
    </EmployeeDocumentsProvider>
  );
}

/** Documentos da empresa: o módulo `documents` (categorias, visibilidade, versões), dentro do Novo RH. */
export function CompanyDocumentsSlot() {
  return (
    <DocumentsProvider>
      <CompanyDocumentsView />
    </DocumentsProvider>
  );
}

/** «Importar recibos» (módulo `documents`): botão que abre a importação em massa. */
export function PayslipImportSlot() {
  const [open, setOpen] = useState(false);
  return (
    <EmployeeDocumentsProvider>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Importar recibos
      </Button>
      {open && <ImportPayslipsModal onClose={() => setOpen(false)} />}
    </EmployeeDocumentsProvider>
  );
}
