import { Navigate, Route, Routes } from "react-router-dom";

import { CustosFixosPage } from "./pages/dre/CustosFixosPage";
import { CustosVariaveisPage } from "./pages/dre/CustosVariaveisPage";
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
import { HrLayout } from "./pages/hr/HrLayout";
import { HrAuditLogPage } from "./pages/hr/HrAuditLogPage";
import { HrLeavePage } from "./pages/hr/HrLeavePage";
import { AttendanceView } from "./modules/hr/adapters/in/AttendanceView.tsx";
import { AttendanceEmployeeDetailView } from "./modules/hr/adapters/in/AttendanceEmployeeDetailView.tsx";
import { HrProvider } from "./modules/hr/hr.module.tsx";
import { PeopleListView } from "./modules/hr/adapters/in/PeopleListView.tsx";
import { PeopleDocumentsView } from "./modules/hr/adapters/in/PeopleDocumentsView.tsx";
import { PositionsView } from "./modules/hr/adapters/in/PositionsView.tsx";
import { EmployeeProfileView } from "./modules/hr/adapters/in/EmployeeProfileView.tsx";
import { OverviewView } from "./modules/hr/adapters/in/OverviewView.tsx";
import { ShiftsToReviewView } from "./modules/hr/adapters/in/ShiftsToReviewView.tsx";
import { SchedulesView } from "./modules/hr/adapters/in/SchedulesView.tsx";
import { KioskDisplayPage } from "./pages/kiosk/KioskDisplayPage";
import { KioskCheckinPage } from "./pages/kiosk/KioskCheckinPage";
import { CashClosingPage } from "./pages/cashClosing/CashClosingPage";
import { CashClosingsProvider } from "./modules/cash-closings/cash-closings.module.tsx";
import { CashClosingsHubView } from "./modules/cash-closings/adapters/in/CashClosingsHubView.tsx";
import { TerminalPage } from "./pages/terminal/TerminalPage";
import { KdsPage } from "./pages/kds/KdsPage";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { PrintOrdersPage } from "./pages/orders/PrintOrdersPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CrmLayout } from "./pages/crm/CrmLayout";
import { CrmDashboardPage } from "./pages/crm/CrmDashboardPage";
import { CrmCustomersPage } from "./modules/crm/adapters/in/CrmCustomersPage";
import { CrmCustomerDetailPage } from "./pages/crm/CrmCustomerDetailPage";
import { CrmParametersPage } from "./pages/crm/CrmParametersPage";
import { FinancialBaseProvider } from "./modules/financial-base/financial-base.module.tsx";
import { CostCentersView } from "./modules/financial-base/adapters/in/CostCentersView.tsx";
import { SuppliersView } from "./modules/financial-base/adapters/in/SuppliersView.tsx";
import { SupplierDetailView } from "./modules/financial-base/adapters/in/SupplierDetailView.tsx";
import { InvoicesProvider } from "./modules/invoices/invoices.module.tsx";
import { InvoicesView } from "./modules/invoices/adapters/in/InvoicesView.tsx";
import { AccountingProvider } from "./modules/accounting/accounting.module.tsx";
import { AccountingView } from "./modules/accounting/adapters/in/AccountingView.tsx";
import { PayableEntriesProvider } from "./modules/payable-entries/payable-entries.module.tsx";
import { PayableEntriesView } from "./modules/payable-entries/adapters/in/PayableEntriesView.tsx";
import { BankStatementsProvider } from "./modules/bank-statements/bank-statements.module.tsx";
import { BankAccountCalendarView } from "./modules/bank-statements/adapters/in/BankAccountCalendarView.tsx";
import { MonthDetailView } from "./modules/bank-statements/adapters/in/MonthDetailView.tsx";
import { BankAccountsProvider } from "./modules/bank-accounts/bank-accounts.module.tsx";
import { BanksView } from "./modules/bank-accounts/adapters/in/BanksView.tsx";
import { BankAccountsView } from "./modules/bank-accounts/adapters/in/BankAccountsView.tsx";
import { PayableRecurrencesProvider } from "./modules/payable-recurrences/payable-recurrences.module.tsx";
import { RecurrenceDetailView } from "./modules/payable-recurrences/adapters/in/RecurrenceDetailView.tsx";
import { RecurrencesView } from "./modules/payable-recurrences/adapters/in/RecurrencesView.tsx";
import { RecurrencesMonthlyView } from "./modules/payable-recurrences/adapters/in/RecurrencesMonthlyView.tsx";
import { AirMenuProvider } from "./modules/air-menu/air-menu.module.tsx";
import { AirMenuView } from "./modules/air-menu/adapters/in/AirMenuView.tsx";
import { VendusProvider } from "./modules/vendus/vendus.module.tsx";
import { VendusView } from "./modules/vendus/adapters/in/VendusView.tsx";
import { DevicePairingGate } from "./modules/location-credentials/adapters/in/DevicePairingGate.tsx";
import { OrganizationProvider } from "./modules/organization/organization.module.tsx";
import { OrganizationProfileView } from "./modules/organization/adapters/in/OrganizationProfileView.tsx";
import { CompanyStructureLayout } from "./modules/organization/adapters/in/CompanyStructureLayout.tsx";
import { LocationsAdminView } from "./modules/locations/adapters/in/LocationsAdminView.tsx";
import { DocumentsProvider } from "./modules/documents/documents.module.tsx";
import { CalendarProvider } from "./modules/calendar/calendar.module.tsx";
import { CalendarView } from "./modules/calendar/adapters/in/CalendarView.tsx";
import { CompanyDocumentsView } from "./modules/documents/adapters/in/CompanyDocumentsView.tsx";
import { LocationCredentialsAdminView } from "./modules/location-credentials/adapters/in/LocationCredentialsAdminView.tsx";
import { StockPurchaseReviewProvider } from "./modules/stock-purchase-review/stock-purchase-review.module.tsx";
import { StockPurchaseReviewsListView } from "./modules/stock-purchase-review/adapters/in/StockPurchaseReviewsListView.tsx";
import { StockPurchaseReviewDetailView } from "./modules/stock-purchase-review/adapters/in/StockPurchaseReviewDetailView.tsx";
import { StockCountProvider } from "./modules/stock-count/stock-count.module.tsx";
import { StockCountSessionsListView } from "./modules/stock-count/adapters/in/StockCountSessionsListView.tsx";
import { StockCountSessionDetailView } from "./modules/stock-count/adapters/in/StockCountSessionDetailView.tsx";
import { StockPlanningProvider } from "./modules/stock-planning/stock-planning.module.tsx";
import { PlanningMainView } from "./modules/stock-planning/adapters/in/PlanningMainView.tsx";
import { PlanningAlertsView } from "./modules/stock-planning/adapters/in/PlanningAlertsView.tsx";
import { SuggestedPurchaseListView } from "./modules/stock-planning/adapters/in/SuggestedPurchaseListView.tsx";
import { ForecastHistoryView } from "./modules/stock-planning/adapters/in/ForecastHistoryView.tsx";

export default function App() {
  return (
    <Routes>
      {/* Página de login (pública) */}
      <Route path="/login" element={<LoginPage />} />

      {/* Páginas standalone sem sidebar (kiosk) */}
      <Route
        path="/kiosk"
        element={
          <DevicePairingGate>
            <KioskDisplayPage />
          </DevicePairingGate>
        }
      />
      <Route
        path="/kiosk/checkin"
        element={
          <DevicePairingGate>
            <KioskCheckinPage />
          </DevicePairingGate>
        }
      />

      {/* Impressão de pedidos — standalone sem auth (uso interno cozinha) */}
      <Route path="/print-orders" element={<PrintOrdersPage />} />

      {/* Terminal — launcher standalone para funcionários */}
      <Route path="/terminal" element={<TerminalPage />} />

      {/* Fecho de caixa — standalone sem auth */}
      <Route
        path="/fecho"
        element={
          <DevicePairingGate>
            <CashClosingPage />
          </DevicePairingGate>
        }
      />

      {/* KDS — ecrã de cozinha standalone sem auth */}
      <Route
        path="/kds"
        element={
          <DevicePairingGate>
            <KdsPage />
          </DevicePairingGate>
        }
      />

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
                <Route path="/" element={<Navigate to="/vendus" replace />} />
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
                  <Route
                    path="/stock/compras-por-rever"
                    element={
                      <FinancialBaseProvider>
                        <StockPurchaseReviewProvider>
                          <StockPurchaseReviewsListView />
                        </StockPurchaseReviewProvider>
                      </FinancialBaseProvider>
                    }
                  />
                  <Route
                    path="/stock/compras-por-rever/:id"
                    element={
                      <FinancialBaseProvider>
                        <StockPurchaseReviewProvider>
                          <StockPurchaseReviewDetailView />
                        </StockPurchaseReviewProvider>
                      </FinancialBaseProvider>
                    }
                  />
                  <Route
                    path="/stock/contagens"
                    element={
                      <StockCountProvider>
                        <StockCountSessionsListView />
                      </StockCountProvider>
                    }
                  />
                  <Route
                    path="/stock/contagens/:id"
                    element={
                      <StockCountProvider>
                        <StockCountSessionDetailView />
                      </StockCountProvider>
                    }
                  />
                  <Route
                    path="/stock/planeamento"
                    element={
                      <FinancialBaseProvider>
                        <StockPlanningProvider>
                          <PlanningMainView />
                        </StockPlanningProvider>
                      </FinancialBaseProvider>
                    }
                  />
                  <Route
                    path="/stock/planeamento/alertas"
                    element={
                      <StockPlanningProvider>
                        <PlanningAlertsView />
                      </StockPlanningProvider>
                    }
                  />
                  <Route
                    path="/stock/planeamento/lista-compras"
                    element={
                      <StockPlanningProvider>
                        <SuggestedPurchaseListView />
                      </StockPlanningProvider>
                    }
                  />
                  <Route
                    path="/stock/planeamento/historico"
                    element={
                      <StockPlanningProvider>
                        <ForecastHistoryView />
                      </StockPlanningProvider>
                    }
                  />
                </Route>
                <Route
                  path="/angrybox/hr"
                  element={<Navigate to="/hr" replace />}
                />
                <Route element={<HrLayout />}>
                  <Route path="/hr" element={<Navigate to="/hr/overview" replace />} />
                  <Route
                    path="/hr/overview"
                    element={
                      <HrProvider>
                        <OverviewView />
                      </HrProvider>
                    }
                  />
                  <Route
                    path="/hr/overview/shifts-to-review"
                    element={
                      <HrProvider>
                        <ShiftsToReviewView />
                      </HrProvider>
                    }
                  />
                  <Route
                    path="/hr/people"
                    element={
                      <HrProvider>
                        <PeopleListView />
                      </HrProvider>
                    }
                  />
                  <Route
                    path="/hr/people/cargos"
                    element={
                      <HrProvider>
                        <PositionsView />
                      </HrProvider>
                    }
                  />
                  <Route
                    path="/hr/people/documentos"
                    element={
                      <HrProvider>
                        <PeopleDocumentsView />
                      </HrProvider>
                    }
                  />
                  <Route
                    path="/hr/people/:id"
                    element={
                      <HrProvider>
                        <EmployeeProfileView />
                      </HrProvider>
                    }
                  />
                  <Route
                    path="/hr/schedules"
                    element={
                      <HrProvider>
                        <SchedulesView />
                      </HrProvider>
                    }
                  />
                  <Route path="/hr/calendar" element={<HrCalendarPage />} />
                  <Route path="/hr/ferias" element={<HrLeavePage />} />
                  <Route path="/hr/relatorio" element={<Navigate to="/hr/assiduidade" replace />} />
                  <Route
                    path="/hr/assiduidade"
                    element={
                      <HrProvider>
                        <AttendanceView />
                      </HrProvider>
                    }
                  />
                  <Route
                    path="/hr/assiduidade/colaborador/:employeeId"
                    element={
                      <HrProvider>
                        <AttendanceEmployeeDetailView />
                      </HrProvider>
                    }
                  />
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
                        <AccountingProvider>
                          <PayableEntriesProvider>
                            <PayableRecurrencesProvider>
                              <BankStatementsProvider>
                                <BankAccountsProvider>
                                  <Routes>
                                    <Route path="cost-centers" element={<CostCentersView />} />
                                    <Route path="suppliers" element={<SuppliersView />} />
                                    <Route path="suppliers/:id" element={<SupplierDetailView />} />
                                    <Route path="invoices" element={<InvoicesView />} />
                                    <Route path="accounting" element={<AccountingView />} />
                                    <Route path="payable-entries" element={<PayableEntriesView />} />
                                    <Route path="recurrences" element={<RecurrencesView />} />
                                    <Route path="recurrences/monthly/:year/:month" element={<RecurrencesMonthlyView />} />
                                    <Route path="recurrences/:id" element={<RecurrenceDetailView />} />
                                    <Route path="bank-statements" element={<BanksView />} />
                                    <Route path="bank-statements/banks/:bankId" element={<BankAccountsView />} />
                                    <Route path="bank-statements/banks/:bankId/accounts/:accountId" element={<BankAccountCalendarView />} />
                                    <Route path="bank-statements/banks/:bankId/accounts/:accountId/:year/:month" element={<MonthDetailView />} />
                                  </Routes>
                                </BankAccountsProvider>
                              </BankStatementsProvider>
                            </PayableRecurrencesProvider>
                          </PayableEntriesProvider>
                        </AccountingProvider>
                      </InvoicesProvider>
                    </FinancialBaseProvider>
                  }
                />
                <Route
                  path="/air-menu"
                  element={
                    <AirMenuProvider>
                      <AirMenuView />
                    </AirMenuProvider>
                  }
                />
                <Route
                  path="/vendus"
                  element={
                    <VendusProvider>
                      <VendusView />
                    </VendusProvider>
                  }
                />
                <Route
                  path="/empresa"
                  element={
                    <OrganizationProvider>
                      <CompanyStructureLayout />
                    </OrganizationProvider>
                  }
                >
                  <Route index element={<OrganizationProfileView />} />
                  <Route path="locais" element={<LocationsAdminView />} />
                  <Route
                    path="calendario"
                    element={
                      <CalendarProvider>
                        <CalendarView />
                      </CalendarProvider>
                    }
                  />
                  <Route
                    path="documentos"
                    element={
                      <DocumentsProvider>
                        <CompanyDocumentsView />
                      </DocumentsProvider>
                    }
                  />
                </Route>
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/location-tokens" element={<LocationCredentialsAdminView />} />
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
