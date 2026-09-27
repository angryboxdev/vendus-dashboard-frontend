import { NavLink } from "react-router-dom";

/**
 * Navegação por abas do módulo "Pessoas" (task "Melhorar Visão Geral e
 * reorganizar Pessoas" — Pessoas & Documentos vira só "Pessoas", com
 * Colaboradores/Documentos como abas internas). Admissão fica de fora por
 * pedido do utilizador ("para já ignora a criação de admissão").
 * `/hr/people` continua a ser a rota da aba Colaboradores (não um
 * redirect) para não partir nenhum dos muitos deep-links existentes
 * (`/hr/people?documentSituation=missing`, cards da Visão Geral, etc.).
 */
export function PeopleTabs() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "border-[#ED5C32] text-[#ED5C32]" : "border-transparent text-stone-500 hover:text-stone-700"
    }`;

  return (
    <div className="flex gap-1 border-b border-transparent">
      <NavLink to="/hr/people" end className={linkClass}>
        Colaboradores
      </NavLink>
      <NavLink to="/hr/people/documentos" className={linkClass}>
        Documentos
      </NavLink>
    </div>
  );
}
