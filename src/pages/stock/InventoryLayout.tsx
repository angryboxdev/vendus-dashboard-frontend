import { Navigate, Outlet } from "react-router-dom";
import { TabNav } from "../../components/ui/index.ts";
import { useAuth } from "../../contexts/AuthContext";
import { canOpenPath } from "../../modules/access/domain/services/access-ui.service.ts";

/** Separadores do Inventário: um só item no menu, os três ecrãs aqui dentro (mesmas rotas). */
export const INVENTORY_TABS = [
  { to: "/stock/movimentacoes", label: "Stock atual" },
  { to: "/stock/historico-movimentos", label: "Movimentos" },
  { to: "/stock/contagens", label: "Contagens" },
] as const;

function useInventoryTabs() {
  const { user } = useAuth();
  const access = user?.access;
  return INVENTORY_TABS.filter((t) => !access || canOpenPath(access, t.to));
}

export function InventoryLayout() {
  const tabs = useInventoryTabs();
  return (
    <div>
      <div className="border-b border-slate-200 bg-white px-6 pt-4">
        <h1 className="text-lg font-semibold text-slate-800">Inventário</h1>
        <div className="mt-2">
          <TabNav label="Inventário" items={tabs.map((t) => ({ to: t.to, label: t.label }))} />
        </div>
      </div>
      <Outlet />
    </div>
  );
}

/** `/stock/inventario` → primeiro separador a que a pessoa tem acesso. */
export function InventoryIndexRedirect() {
  const tabs = useInventoryTabs();
  return <Navigate to={tabs[0]?.to ?? "/stock/stock"} replace />;
}
