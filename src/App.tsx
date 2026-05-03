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
import { StockMovementHistoryPage } from "./pages/stock/StockMovementHistoryPage";
import { StockPage } from "./pages/stock/StockPage";
import { Sidebar } from "./components/Sidebar";
import { HrCalendarPage } from "./pages/hr/HrCalendarPage";
import { HrEmployeeDetailPage } from "./pages/hr/HrEmployeeDetailPage";
import { HrEmployeesPage } from "./pages/hr/HrEmployeesPage";
import { HrLayout } from "./pages/hr/HrLayout";
import { HrAuditLogPage } from "./pages/hr/HrAuditLogPage";
import { HrLeavePage } from "./pages/hr/HrLeavePage";
import { HrReportPage } from "./pages/hr/HrReportPage";
import { KioskDisplayPage } from "./pages/kiosk/KioskDisplayPage";
import { KioskCheckinPage } from "./pages/kiosk/KioskCheckinPage";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { PrintOrdersPage } from "./pages/orders/PrintOrdersPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      {/* Página de login (pública) */}
      <Route path="/login" element={<LoginPage />} />

      {/* Páginas standalone sem sidebar (kiosk) */}
      <Route path="/kiosk" element={<KioskDisplayPage />} />
      <Route path="/kiosk/checkin" element={<KioskCheckinPage />} />

      {/* Impressão de pedidos — standalone sem auth (uso interno cozinha) */}
      <Route path="/print-orders" element={<PrintOrdersPage />} />

      {/* Layout principal com sidebar */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
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
                  <Route
                    path="/stock/historico-movimentos"
                    element={<StockMovementHistoryPage />}
                  />
                  <Route path="/stock/stock" element={<StockPage />} />
                  <Route path="/stock/pizzas" element={<PizzasPage />} />
                </Route>
                <Route
                  path="/angrybox/hr"
                  element={<Navigate to="/hr" replace />}
                />
                <Route element={<HrLayout />}>
                  <Route path="/hr" element={<HrEmployeesPage />} />
                  <Route path="/hr/calendar" element={<HrCalendarPage />} />
                  <Route path="/hr/ferias" element={<HrLeavePage />} />
                  <Route path="/hr/relatorio" element={<HrReportPage />} />
                  <Route path="/hr/historico" element={<HrAuditLogPage />} />
                  <Route
                    path="/hr/employees/:id"
                    element={<HrEmployeeDetailPage />}
                  />
                </Route>
                <Route path="/admin/users" element={<UsersPage />} />
              </Routes>
            </main>
          </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
