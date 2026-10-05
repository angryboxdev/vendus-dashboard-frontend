import { Outlet } from "react-router-dom";
import { CompanyStructureTabs } from "./CompanyStructureTabs.tsx";

/**
 * Moldura da área "Empresa & Estrutura" (`/empresa/*`): cabeçalho + abas,
 * com o conteúdo de cada aba vindo da rota filha. Cada aba vive no módulo
 * dono do conceito (Empresa → `organization`, Locais → `locations`, …) —
 * nenhuma vista de outro módulo precisa de importar esta moldura.
 */
export function CompanyStructureLayout() {
  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-stone-900">Empresa & Estrutura</h1>
        <p className="text-xs text-stone-500">Dados da entidade legal e estrutura da organização.</p>
        <CompanyStructureTabs />
      </div>
      <Outlet />
    </div>
  );
}
