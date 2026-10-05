import { NavLink } from "react-router-dom";

/**
 * Abas de "Empresa & Estrutura" (task §2): Empresa | Locais | Calendário &
 * Eventos | Documentos.
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
      <NavLink to="/empresa/locais" className={linkClass}>
        Locais
      </NavLink>
      <NavLink to="/empresa/calendario" className={linkClass}>
        Calendário & Eventos
      </NavLink>
      <NavLink to="/empresa/documentos" className={linkClass}>
        Documentos
      </NavLink>
    </div>
  );
}
