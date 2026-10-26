import { Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { StockDemoProvider, useStockDemo } from "../../modules/stock-demo/stock-demo.module.tsx";
import { StockDemoBanner } from "../../modules/stock-demo/adapters/in/StockDemoControls.tsx";

/** Os ecrãs do Stock remontam ao trocar de cenário de demonstração (voltam a ler os dados certos). */
function StockOutlet() {
  const { scenario, version } = useStockDemo();
  return <Outlet key={`${scenario ?? "real"}:${version}`} />;
}

export function StockLayout() {
  const { user } = useAuth();
  return (
    <StockDemoProvider isAdmin={user?.access?.isAdmin === true}>
      <div className="min-h-full bg-slate-50">
        <StockDemoBanner />
        <StockOutlet />
      </div>
    </StockDemoProvider>
  );
}
