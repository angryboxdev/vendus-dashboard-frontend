import { useQuery } from "@tanstack/react-query";
import { CompanyDocumentsView } from "../documents/adapters/in/CompanyDocumentsView.tsx";
import { DocumentsProvider } from "../documents/documents.module.tsx";
import { EmployeeDocumentsTab } from "../hr/adapters/in/EmployeeDocumentsTab.tsx";
import { HrProvider, useHrModule } from "../hr/hr.module.tsx";

/** Documentos da ficha: o motor do módulo `hr` (requisitos, validade, versões), dentro do Novo RH. */
export function PersonDocumentsSlot({ personId }: { personId: string }) {
  return (
    <HrProvider>
      <PersonDocuments personId={personId} />
    </HrProvider>
  );
}

function PersonDocuments({ personId }: { personId: string }) {
  const { api } = useHrModule();
  const profile = useQuery({ queryKey: ["hr-people-profile", personId], queryFn: () => api.getEmployeeProfile(personId) });
  if (profile.isLoading) return <p className="text-sm text-stone-400">A carregar…</p>;
  if (profile.isError || !profile.data) return <p className="text-sm text-red-700">Não foi possível carregar os documentos.</p>;
  return <EmployeeDocumentsTab employeeId={personId} profile={profile.data} onViewFullHistory={() => undefined} />;
}

/** Documentos da empresa: o módulo `documents` (categorias, visibilidade, versões), dentro do Novo RH. */
export function CompanyDocumentsSlot() {
  return (
    <DocumentsProvider>
      <CompanyDocumentsView />
    </DocumentsProvider>
  );
}
