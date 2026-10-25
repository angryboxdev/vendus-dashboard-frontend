import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { TabNav } from "../../components/ui/index.ts";
import { useAuth } from "../../contexts/AuthContext";
import { canOpenPath, hasLevel } from "../../modules/access/domain/services/access-ui.service.ts";
import { useOpenReviewsCount } from "../../modules/stock-purchase-review/adapters/in/use-open-reviews-count.ts";
import { StockImportInvoiceModal } from "../../modules/stock-purchase-review/adapters/in/StockImportInvoiceModal.tsx";

export const PURCHASE_REVIEWS_TAB = "/stock/compras-por-rever";

/**
 * Separadores do Inventário: um só item no menu, os ecrãs aqui dentro (mesmas rotas).
 * «Compras por rever» é a entrada do stock (faturas → movimentos); o detalhe de uma
 * compra abre fora dos separadores, em largura total.
 */
export const INVENTORY_TABS = [
  { to: "/stock/movimentacoes", label: "Stock atual" },
  { to: "/stock/historico-movimentos", label: "Movimentos" },
  { to: "/stock/contagens", label: "Contagens" },
  { to: PURCHASE_REVIEWS_TAB, label: "Compras por rever" },
] as const;

function useInventoryTabs() {
  const { user } = useAuth();
  const access = user?.access;
  return INVENTORY_TABS.filter((t) => !access || canOpenPath(access, t.to));
}

/** «Importar fatura» no cabeçalho: o servidor exige Gerir em Compras por rever. */
function useCanImportInvoice(): boolean {
  const { user } = useAuth();
  const access = user?.access;
  if (!access) return false;
  if (access.portalOnly) return false;
  return access.isAdmin || hasLevel(access.permissions, "stock.purchase_reviews", "MANAGE");
}

/** Precisa de `StockPurchaseReviewProvider` por cima (contador e importação de faturas). */
export function InventoryLayout() {
  const tabs = useInventoryTabs();
  const openReviews = useOpenReviewsCount(tabs.some((t) => t.to === PURCHASE_REVIEWS_TAB));
  const canImport = useCanImportInvoice();
  const [importOpen, setImportOpen] = useState(false);
  return (
    <div>
      <div className="border-b border-slate-200 bg-white px-6 pt-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-slate-800">Inventário</h1>
          {canImport && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="shrink-0 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Importar fatura
            </button>
          )}
        </div>
        <div className="mt-2">
          <TabNav
            label="Inventário"
            items={tabs.map((t) => ({ to: t.to, label: t.label, count: t.to === PURCHASE_REVIEWS_TAB && openReviews ? openReviews : undefined }))}
          />
        </div>
      </div>
      {importOpen && <StockImportInvoiceModal onClose={() => setImportOpen(false)} />}
      <Outlet />
    </div>
  );
}

/** `/stock/inventario` → primeiro separador a que a pessoa tem acesso. */
export function InventoryIndexRedirect() {
  const tabs = useInventoryTabs();
  return <Navigate to={tabs[0]?.to ?? "/stock/stock"} replace />;
}
