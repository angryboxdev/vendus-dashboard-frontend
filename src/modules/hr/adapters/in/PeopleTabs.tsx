import { TabNav } from "../../../../components/ui/index.ts";

/**
 * Navegação por abas de "Colaboradores" (antes "Pessoas" — renomeada na
 * Base Organizacional, task §14): Lista | Cargos | Documentos. Admissão
 * fica de fora por pedido do utilizador. `/hr/people` continua a ser a rota
 * da aba Lista (não um redirect) para não partir nenhum dos muitos
 * deep-links existentes (`/hr/people?documentSituation=missing`, cards da
 * Visão Geral, etc.).
 */
export function PeopleTabs() {
  return (
    <TabNav
      label="Colaboradores"
      items={[
        { to: "/hr/people", label: "Lista", end: true },
        { to: "/hr/people/cargos", label: "Cargos" },
        { to: "/hr/people/documentos", label: "Documentos" },
      ]}
    />
  );
}
