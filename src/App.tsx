import { Navigate, Route, Routes } from "react-router-dom";

import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { DreLayout } from "./pages/dre/DreLayout";
import { DemonstrativoPage } from "./pages/dre/DemonstrativoPage";
import { KpisPage } from "./pages/dre/KpisPage";
import { ReceitaBrutaPage } from "./pages/dre/ReceitaBrutaPage";
import { CustosFixosPage } from "./pages/dre/CustosFixosPage";
import { CustosVariaveisPage } from "./pages/dre/CustosVariaveisPage";

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dre" element={<Navigate to="/dre/demonstrativo" replace />} />
          <Route element={<DreLayout />}>
            <Route path="/dre/demonstrativo" element={<DemonstrativoPage />} />
            <Route path="/dre/kpis" element={<KpisPage />} />
            <Route path="/dre/receita-bruta" element={<ReceitaBrutaPage />} />
            <Route path="/dre/custos-fixos" element={<CustosFixosPage />} />
            <Route path="/dre/custos-variaveis" element={<CustosVariaveisPage />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}
