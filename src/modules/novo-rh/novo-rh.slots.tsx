import { useState } from "react";
import { Button } from "../../components/ui/index.ts";
import { CompanyDocumentsView } from "../documents/adapters/in/CompanyDocumentsView.tsx";
import { EmployeeDocumentsPanel } from "../documents/adapters/in/EmployeeDocumentsPanel.tsx";
import { EmployeeArchiveView } from "../documents/adapters/in/EmployeeArchiveView.tsx";
import { ImportPayslipsModal } from "../documents/adapters/in/ImportPayslipsModal.tsx";
import { DocumentsProvider, EmployeeDocumentsProvider } from "../documents/documents.module.tsx";
import { useQuery } from "@tanstack/react-query";
import { OrganizationProvider, useOrganizationModule } from "../organization/organization.module.tsx";

/** Documentos da ficha: módulo `documents` (requisitos, validade, versões) — ADR-0040, fase 1 (já sem o RH antigo). */
export function PersonDocumentsSlot({ personId }: { personId: string }) {
  return (
    <EmployeeDocumentsProvider>
      <EmployeeDocumentsPanel employeeId={personId} />
    </EmployeeDocumentsProvider>
  );
}

/** Documentos dos colaboradores por pastas; o nome abre a ficha no separador Documentos. */
export function EmployeeArchiveSlot() {
  return (
    <EmployeeDocumentsProvider>
      <EmployeeArchiveView personHref={(id) => `/hr/novo/pessoas/${encodeURIComponent(id)}?tab=documents`} />
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

function CompanyNameInner() {
  const { getProfile } = useOrganizationModule();
  const q = useQuery({ queryKey: ["organization-profile"], queryFn: () => getProfile.execute(), staleTime: 10 * 60_000, retry: false });
  return <>{q.data?.name || "Empresa"}</>;
}

/** Nome comercial da empresa (módulo `organization`) para o topo do organograma. */
export function CompanyNameSlot() {
  return (
    <OrganizationProvider>
      <CompanyNameInner />
    </OrganizationProvider>
  );
}
