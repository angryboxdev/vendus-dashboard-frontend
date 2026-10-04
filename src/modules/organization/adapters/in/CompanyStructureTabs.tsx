import { NavLink } from "react-router-dom";

/**
 * Abas de "Empresa & Estrutura". Só aparecem as abas já implementadas —
 * Locais, Calendário & Eventos e Documentos entram à medida que cada
 * ticket da Base Organizacional fica pronto (a task proíbe preparar UI
 * sem funcionalidade).
 */
export function CompanyStructureTabs() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "border-[#ED5C32] text-[#ED5C32]" : "border-transparent text-stone-500 hover:text-stone-700"
    }`;

  return (
    <div className="flex gap-1 border-b border-transparent">
      <NavLink to="/empresa" end className={linkClass}>
        Empresa
      </NavLink>
    </div>
  );
}
