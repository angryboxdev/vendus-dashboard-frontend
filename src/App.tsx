import { Navigate, Route, Routes } from "react-router-dom";

import { CustosFixosPage } from "./pages/dre/CustosFixosPage";
import { CustosVariaveisPage } from "./pages/dre/CustosVariaveisPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AnalyticsDashboardPage } from "./pages/AnalyticsDashboardPage";
import { DemonstrativoPage } from "./pages/dre/DemonstrativoPage";
import { DreLayout } from "./pages/dre/DreLayout";
import { ReceitaBrutaPage } from "./pages/dre/ReceitaBrutaPage";
import { MovimentacoesPage } from "./pages/stock/MovimentacoesPage";
import { PizzasPage } from "./pages/stock/PizzasPage";
import { StockLayout } from "./pages/stock/StockLayout";
import { StockMovementHistoryPage } from "./pages/stock/StockMovementHistoryPage";
import { StockPage } from "./pages/stock/StockPage";
import { Sidebar } from "./modules/sidebar/adapters/in/SidebarView.tsx";
import { SidebarProvider } from "./modules/sidebar/sidebar.module.tsx";
import { HrCalendarPage } from "./pages/hr/HrCalendarPage";
import { HrEmployeeDetailPage } from "./pages/hr/HrEmployeeDetailPage";
import { HrEmployeesPage } from "./pages/hr/HrEmployeesPage";
import { HrLayout } from "./pages/hr/HrLayout";
import { HrAuditLogPage } from "./pages/hr/HrAuditLogPage";
import { HrLeavePage } from "./pages/hr/HrLeavePage";
import { HrReportPage } from "./pages/hr/HrReportPage";
import { KioskDisplayPage } from "./pages/kiosk/KioskDisplayPage";
import { KioskCheckinPage } from "./pages/kiosk/KioskCheckinPage";
import { CashClosingPage } from "./pages/cashClosing/CashClosingPage";
import { CashClosingsProvider } from "./modules/cash-closings/cash-closings.module.tsx";
import { CashClosingsHubView } from "./modules/cash-closings/adapters/in/CashClosingsHubView.tsx";
import { TerminalPage } from "./pages/terminal/TerminalPage";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { PrintOrdersPage } from "./pages/orders/PrintOrdersPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CrmLayout } from "./pages/crm/CrmLayout";
import { CrmDashboardPage } from "./pages/crm/CrmDashboardPage";
import { CrmCustomersPage } from "./pages/crm/CrmCustomersPage";
import { CrmCustomerDetailPage } from "./pages/crm/CrmCustomerDetailPage";
import { CrmParametersPage } from "./pages/crm/CrmParametersPage";
import { FinancialBaseProvider } from "./modules/financial-base/financial-base.module.tsx";
import { CostCentersView } from "./modules/financial-base/adapters/in/CostCentersView.tsx";
import { SuppliersView } from "./modules/financial-base/adapters/in/SuppliersView.tsx";
import { InvoicesProvider } from "./modules/invoices/invoices.module.tsx";
import { InvoicesView } from "./modules/invoices/adapters/in/InvoicesView.tsx";
import { PayableEntriesProvider } from "./modules/payable-entries/payable-entries.module.tsx";
import { PayableEntriesView } from "./modules/payable-entries/adapters/in/PayableEntriesView.tsx";
import { BankStatementsProvider } from "./modules/bank-statements/bank-statements.module.tsx";
import { BankStatementsView } from "./modules/bank-statements/adapters/in/BankStatementsView.tsx";

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

      {/* Terminal — launcher standalone para funcionários */}
      <Route path="/terminal" element={<TerminalPage />} />

      {/* Fecho de caixa — standalone sem auth */}
      <Route path="/fecho" element={<CashClosingPage />} />

      {/* Layout principal com sidebar */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <SidebarProvider>
            <div className="flex min-h-screen bg-[#FAF6F3]">
              <Sidebar />
              <main className="min-w-0 flex-1 overflow-auto pt-12 md:pt-0">
                <Routes>
                <Route path="/" element={<AnalyticsDashboardPage />} />
                <Route path="/analytics" element={<DashboardPage />} />
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
                <Route element={<CrmLayout />}>
                  <Route path="/crm" element={<CrmDashboardPage />} />
                  <Route path="/crm/customers" element={<CrmCustomersPage />} />
                  <Route
                    path="/crm/customers/:id"
                    element={<CrmCustomerDetailPage />}
                  />
                  <Route path="/crm/parameters" element={<CrmParametersPage />} />
                </Route>
                <Route
                  path="/cash-closings"
                  element={
                    <CashClosingsProvider>
                      <CashClosingsHubView />
                    </CashClosingsProvider>
                  }
                />
                <Route
                  path="/financial/*"
                  element={
                    <FinancialBaseProvider>
                      <InvoicesProvider>
                        <PayableEntriesProvider>
                          <BankStatementsProvider>
                            <Routes>
                              <Route path="cost-centers" element={<CostCentersView />} />
                              <Route path="suppliers" element={<SuppliersView />} />
                              <Route path="invoices" element={<InvoicesView />} />
                              <Route path="payable-entries" element={<PayableEntriesView />} />
                              <Route path="bank-statements" element={<BankStatementsView />} />
                            </Routes>
                          </BankStatementsProvider>
                        </PayableEntriesProvider>
                      </InvoicesProvider>
                    </FinancialBaseProvider>
                  }
                />
                <Route path="/admin/users" element={<UsersPage />} />
              </Routes>
            </main>
          </div>
          </SidebarProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
