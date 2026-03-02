import { Navigate, Route, Routes } from "react-router-dom";

import { CustosFixosPage } from "./pages/dre/CustosFixosPage";
import { CustosVariaveisPage } from "./pages/dre/CustosVariaveisPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DemonstrativoPage } from "./pages/dre/DemonstrativoPage";
import { DreLayout } from "./pages/dre/DreLayout";
import { ReceitaBrutaPage } from "./pages/dre/ReceitaBrutaPage";
import { MovimentacoesPage } from "./pages/stock/MovimentacoesPage";
import { PizzasPage } from "./pages/stock/PizzasPage";
import { StockLayout } from "./pages/stock/StockLayout";
import { StockPage } from "./pages/stock/StockPage";
import { Sidebar } from "./components/Sidebar";

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/dre"
            element={<Navigate to="/dre/demonstrativo" replace />}
          />
          <Route element={<DreLayout />}>
            <Route path="/dre/demonstrativo" element={<DemonstrativoPage />} />
            <Route path="/dre/receita-bruta" element={<ReceitaBrutaPage />} />
            <Route path="/dre/custos-fixos" element={<CustosFixosPage />} />
            <Route
              path="/dre/custos-variaveis"
              element={<CustosVariaveisPage />}
            />
          </Route>
          <Route
            path="/stock"
            element={<Navigate to="/stock/movimentacoes" replace />}
          />
          <Route element={<StockLayout />}>
            <Route path="/stock/movimentacoes" element={<MovimentacoesPage />} />
            <Route path="/stock/stock" element={<StockPage />} />
            <Route path="/stock/pizzas" element={<PizzasPage />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}
