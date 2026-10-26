import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { appMainClass } from "./lib/app-main";

import { CustosFixosPage } from "./pages/dre/CustosFixosPage";
import { CustosVariaveisPage } from "./pages/dre/CustosVariaveisPage";
import { DemonstrativoPage } from "./pages/dre/DemonstrativoPage";
import { DreLayout } from "./pages/dre/DreLayout";
import { ReceitaBrutaPage } from "./pages/dre/ReceitaBrutaPage";
import { MovimentacoesPage } from "./pages/stock/MovimentacoesPage";
import { PizzasPage } from "./pages/stock/PizzasPage";
import { StockLayout } from "./pages/stock/StockLayout";
import { InventoryIndexRedirect, InventoryLayout } from "./pages/stock/InventoryLayout";
import { StockMovementHistoryPage } from "./pages/stock/StockMovementHistoryPage";
import { StockPage } from "./pages/stock/StockPage";
import { Sidebar } from "./modules/sidebar/adapters/in/SidebarView.tsx";
import { SidebarProvider } from "./modules/sidebar/sidebar.module.tsx";
import { NovoRhJoinPage, NovoRhPage } from "./modules/novo-rh/novo-rh.module.tsx";
import { KioskDisplayPage } from "./pages/kiosk/KioskDisplayPage";
import { KioskCheckinPage } from "./pages/kiosk/KioskCheckinPage";
import { CashClosingPage } from "./pages/cashClosing/CashClosingPage";
import { CashClosingsProvider } from "./modules/cash-closings/cash-closings.module.tsx";
import { CashClosingsHubView } from "./modules/cash-closings/adapters/in/CashClosingsHubView.tsx";
import { TerminalPage } from "./pages/terminal/TerminalPage";
import { KdsPage } from "./pages/kds/KdsPage";
import { LoginPage } from "./pages/LoginPage";
import { AccessProvider } from "./modules/access/access.module.tsx";
import { UsersView } from "./modules/access/adapters/in/UsersView.tsx";
import { UserEditorView } from "./modules/access/adapters/in/UserEditorView.tsx";
import { ProfilesView } from "./modules/access/adapters/in/ProfilesView.tsx";
import { HomeRedirect } from "./modules/access/adapters/in/HomeRedirect.tsx";
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
import { RecurringMovementsView } from "./modules/bank-statements/adapters/in/RecurringMovementsView.tsx";
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
import { SalesDeclarationProvider } from "./modules/sales-declaration/sales-declaration.module.tsx";
import { SalesDeclarationView } from "./modules/sales-declaration/adapters/in/SalesDeclarationView.tsx";
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
import { EmployeePortalProvider } from "./modules/employee-portal/employee-portal.module.tsx";
import { PortalLayout } from "./modules/employee-portal/adapters/in/PortalLayout.tsx";
import { PortalScheduleView } from "./modules/employee-portal/adapters/in/PortalScheduleView.tsx";
import { PortalDocumentsView } from "./modules/employee-portal/adapters/in/PortalDocumentsView.tsx";
import { PortalLeaveView } from "./modules/employee-portal/adapters/in/PortalLeaveView.tsx";
import { PortalHomeView } from "./modules/employee-portal/adapters/in/PortalHomeView.tsx";
import { PortalProfileView } from "./modules/employee-portal/adapters/in/PortalProfileView.tsx";
import { PortalMoreView } from "./modules/employee-portal/adapters/in/PortalMoreView.tsx";
import { PortalNewsView } from "./modules/employee-portal/adapters/in/PortalNewsView.tsx";
import { PortalCustomRequestsView, PortalTasksView, PortalTeamView } from "./modules/employee-portal/adapters/in/PortalWorkViews.tsx";

/** Área principal ao lado da sidebar (ver `appMainClass`). */
function AppMain({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <main className={appMainClass(pathname)}>{children}</main>;
}

export default function App() {
  return (
    <Routes>
      {/* Página de login (pública) */}
      <Route path="/login" element={<LoginPage />} />
      {/* Pedido de adesão por convite (FE-054) — público, sem sessão */}
      <Route path="/aderir/:code" element={<NovoRhJoinPage />} />

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

      {/* Portal do Colaborador — mobile, sem a barra lateral de gestão */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute allowEmployee>
            <EmployeePortalProvider>
              <PortalLayout />
            </EmployeePortalProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<PortalHomeView />} />
        <Route path="escala" element={<PortalScheduleView />} />
        <Route path="documentos" element={<PortalDocumentsView />} />
        <Route path="ausencias" element={<PortalLeaveView />} />
        <Route path="perfil" element={<PortalProfileView />} />
        <Route path="mais" element={<PortalMoreView />} />
        <Route path="comunicados" element={<PortalNewsView />} />
        <Route path="tarefas" element={<PortalTasksView />} />
        <Route path="solicitacoes" element={<PortalCustomRequestsView />} />
        <Route path="equipa" element={<PortalTeamView />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Route>

      {/* Layout principal com sidebar */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <SidebarProvider>
            <div className="flex min-h-screen bg-[#FAF6F3]">
              {/* A barra lateral fica como estava (fonte e aspeto anteriores ao Design System). */}
              <div className="contents font-legacy">
                <Sidebar />
              </div>
              <AppMain>
                <Routes>
                <Route path="/" element={<HomeRedirect />} />
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
                  <Route path="/stock/inventario" element={<InventoryIndexRedirect />} />
                  <Route
                    element={
                      <StockPurchaseReviewProvider>
                        <InventoryLayout />
                      </StockPurchaseReviewProvider>
                    }
                  >
                  <Route path="/stock/movimentacoes" element={<MovimentacoesPage />} />
                  <Route
                    path="/stock/historico-movimentos"
                    element={<StockMovementHistoryPage />}
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
                    path="/stock/compras-por-rever"
                    element={
                      <FinancialBaseProvider>
                        <StockPurchaseReviewProvider>
                          <StockPurchaseReviewsListView />
                        </StockPurchaseReviewProvider>
                      </FinancialBaseProvider>
                    }
                  />
                  </Route>
                  <Route path="/stock/stock" element={<StockPage />} />
                  <Route path="/stock/pizzas" element={<PizzasPage />} />
                  {/* Detalhe de uma compra: fora dos separadores do Inventário, em largura total. */}
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
                {/* RH antigo retirado do menu (2026-10-22): os caminhos antigos abrem o ecrã equivalente do Novo RH. O código
                    antigo só se apaga quando o quiosque existir no Novo RH (ADR-0040, fases 3–4). */}
                <Route path="/hr" element={<Navigate to="/hr/novo" replace />} />
                <Route path="/hr/antigo" element={<Navigate to="/hr/novo" replace />} />
                <Route path="/hr/overview/*" element={<Navigate to="/hr/novo" replace />} />
                <Route path="/hr/people/cargos" element={<Navigate to="/hr/novo/estrutura" replace />} />
                <Route path="/hr/people/documentos" element={<Navigate to="/hr/novo/documentos" replace />} />
                <Route path="/hr/people/*" element={<Navigate to="/hr/novo/pessoas" replace />} />
                <Route path="/hr/employees/*" element={<Navigate to="/hr/novo/pessoas" replace />} />
                <Route path="/hr/schedules" element={<Navigate to="/hr/novo/escalas" replace />} />
                <Route path="/hr/calendar" element={<Navigate to="/hr/novo/escalas" replace />} />
                <Route path="/hr/ferias" element={<Navigate to="/hr/novo/ausencias" replace />} />
                <Route path="/hr/relatorio" element={<Navigate to="/hr/novo/assiduidade" replace />} />
                <Route path="/hr/assiduidade/*" element={<Navigate to="/hr/novo/assiduidade" replace />} />
                <Route path="/hr/pedidos" element={<Navigate to="/hr/novo/pedidos" replace />} />
                <Route path="/hr/historico" element={<Navigate to="/hr/novo/auditoria" replace />} />
                <Route path="/hr/novo/*" element={<NovoRhPage />} />
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
                                    <Route
                                      path="sales-declaration"
                                      element={
                                        <SalesDeclarationProvider>
                                          <SalesDeclarationView />
                                        </SalesDeclarationProvider>
                                      }
                                    />
                                    <Route path="payable-entries" element={<PayableEntriesView />} />
                                    <Route path="recurrences" element={<RecurrencesView />} />
                                    <Route path="recurrences/monthly/:year/:month" element={<RecurrencesMonthlyView />} />
                                    <Route path="recurrences/:id" element={<RecurrenceDetailView />} />
                                    <Route path="bank-statements" element={<BanksView />} />
                                    <Route path="bank-statements/recurring" element={<RecurringMovementsView />} />
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
                <Route path="/admin/users" element={<AccessProvider><UsersView /></AccessProvider>} />
                <Route path="/admin/users/:userId" element={<AccessProvider><UserEditorView /></AccessProvider>} />
                <Route path="/admin/access-profiles" element={<AccessProvider><ProfilesView /></AccessProvider>} />
                <Route path="/admin/location-tokens" element={<LocationCredentialsAdminView />} />
              </Routes>
            </AppMain>
          </div>
          </SidebarProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
