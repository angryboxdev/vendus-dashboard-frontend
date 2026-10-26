import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { RecipeCostingProvider } from "../../modules/recipe-costing/recipe-costing.module.tsx";
import { TechnicalSheetsView, type SheetsTab } from "../../modules/recipe-costing/adapters/in/TechnicalSheetsView.tsx";

// Separador no endereço (?separador=preparacoes), para voltar ao mesmo sítio e partilhar o link.
const TAB_PARAM: Record<SheetsTab, string> = { dishes: "pratos", preparations: "preparacoes", analysis: "analise" };
const fromParam = (v: string | null): SheetsTab => (Object.entries(TAB_PARAM).find(([, p]) => p === v)?.[0] as SheetsTab | undefined) ?? "dishes";

/** «Fichas técnicas» (V7): página própria no menu; os custos dos ingredientes corrigem-se em Artigos e ingredientes. */
export function FichasTecnicasPage() {
  const { user } = useAuth();
  const access = user?.access;
  const canManage = !access || access.isAdmin || access.permissions["stock.recipes"] === "MANAGE";
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = fromParam(params.get("separador"));

  return (
    <div className="min-h-full bg-surface-app">
      <RecipeCostingProvider>
        <TechnicalSheetsView
          tab={tab}
          onTab={(t) => setParams(t === "dishes" ? {} : { separador: TAB_PARAM[t] }, { replace: true })}
          canManage={canManage}
          onOpenArticle={(id) => navigate(`/stock/stock?artigo=${encodeURIComponent(id)}&painel=precos`)}
          onResolveMissing={() => navigate("/stock/stock?custo=sem")}
        />
      </RecipeCostingProvider>
    </div>
  );
}
