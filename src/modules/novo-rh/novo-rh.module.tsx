import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { Route, Routes, useParams } from "react-router-dom";
import { setRequestHeaderProvider } from "../../lib/api.ts";
import { HttpDemoApiAdapter, SessionDataModeStore, novoRhModeHeaders } from "./adapters/out/http-demo-api.adapter.ts";
import { DemoModeBanner, DemoAccessNotice } from "./adapters/in/DemoMode.tsx";
import type { DataMode } from "./domain/entities/roadmap.ts";
import type { DataModeStorePort, DemoApiPort } from "./domain/ports/out/demo-api.port.ts";
import type { OverviewApiPort } from "./domain/ports/out/overview-api.port.ts";
import type { DashboardApiPort } from "./domain/ports/out/dashboard-api.port.ts";
import type { AssistantApiPort } from "./domain/ports/out/assistant-api.port.ts";
import { HttpAssistantApiAdapter } from "./adapters/out/http-assistant-api.adapter.ts";
import { HttpDashboardApiAdapter } from "./adapters/out/http-dashboard-api.adapter.ts";
import { HttpOverviewApiAdapter } from "./adapters/out/http-overview-api.adapter.ts";
import type { RemindersApiPort } from "./domain/ports/out/reminders-api.port.ts";
import { HttpRemindersApiAdapter } from "./adapters/out/http-reminders-api.adapter.ts";
import type { InboxApiPort } from "./domain/ports/out/inbox-api.port.ts";
import { HttpInboxApiAdapter } from "./adapters/out/http-inbox-api.adapter.ts";
import { InboxView } from "./adapters/in/inbox/InboxView.tsx";
import { I18nProvider } from "../../i18n/I18nProvider.tsx";
import { HttpSettingsApiAdapter } from "./adapters/out/http-settings-api.adapter.ts";
import { SupabaseMfaAdapter } from "./adapters/out/supabase-mfa.adapter.ts";
import { MfaGate } from "./adapters/in/MfaGate.tsx";
import type { MfaPort } from "./domain/ports/out/mfa.port.ts";
import type { AccessGovernanceApiPort, AuditApiPort, NotificationsApiPort, StructureApiPort } from "./domain/ports/out/governance-api.port.ts";
import { HttpAccessGovernanceApiAdapter, HttpAuditApiAdapter, HttpNotificationsApiAdapter, HttpStructureApiAdapter } from "./adapters/out/http-governance-api.adapters.ts";
import { StructureView } from "./adapters/in/structure/StructureView.tsx";
import { AccessView } from "./adapters/in/access/AccessView.tsx";
import { AuditView } from "./adapters/in/audit/AuditView.tsx";
import { UserMenu } from "./adapters/in/UserMenu.tsx";
import { useAuth } from "../../contexts/AuthContext.tsx";
import type { PeopleApiPort } from "./domain/ports/out/people-api.port.ts";
import { HttpPeopleApiAdapter } from "./adapters/out/http-people-api.adapter.ts";
import { PeopleListView } from "./adapters/in/people/PeopleListView.tsx";
import { PersonView } from "./adapters/in/people/PersonView.tsx";
import type { TimeApiPort } from "./domain/ports/out/time-api.port.ts";
import { HttpTimeApiAdapter } from "./adapters/out/http-time-api.adapter.ts";
import { TimeView } from "./adapters/in/time/TimeView.tsx";
import type { AttendanceApiPort, MyClockApiPort } from "./domain/ports/out/attendance-api.port.ts";
import { HttpAttendanceApiAdapter, HttpMyClockApiAdapter, LocalStoragePunchQueue } from "./adapters/out/http-attendance-api.adapter.ts";
import { PunchQueue } from "./domain/services/attendance.service.ts";
import { AttendanceView } from "./adapters/in/attendance/AttendanceView.tsx";
import type { AbsencesApiPort, MyAbsencesApiPort } from "./domain/ports/out/absences-api.port.ts";
import { HttpAbsencesApiAdapter, HttpMyAbsencesApiAdapter } from "./adapters/out/http-absences-api.adapter.ts";
import { AbsencesView } from "./adapters/in/absences/AbsencesView.tsx";
import type { TimeBankApiPort } from "./domain/ports/out/time-bank-api.port.ts";
import { HttpTimeBankApiAdapter } from "./adapters/out/http-time-bank-api.adapter.ts";
import { TimeBankView } from "./adapters/in/time-bank/TimeBankView.tsx";
import type { RostersApiPort } from "./domain/ports/out/rosters-api.port.ts";
import { HttpRostersApiAdapter } from "./adapters/out/http-rosters-api.adapter.ts";
import { RostersView } from "./adapters/in/rosters/RostersView.tsx";
import type { PeriodsApiPort } from "./domain/ports/out/periods-api.port.ts";
import { HttpPeriodsApiAdapter } from "./adapters/out/http-periods-api.adapter.ts";
import { PeriodsView } from "./adapters/in/periods/PeriodsView.tsx";
import type { AlertsApiPort, AnnouncementsApiPort, ReportsApiPort, WorkspaceApiPort } from "./domain/ports/out/engagement-api.port.ts";
import { HttpAlertsApiAdapter, HttpAnnouncementsApiAdapter, HttpReportsApiAdapter, HttpWorkspaceApiAdapter } from "./adapters/out/http-engagement-api.adapters.ts";
import { AnnouncementsView } from "./adapters/in/engagement/AnnouncementsView.tsx";
import type { DistributionsApiPort } from "./domain/ports/out/distributions-api.port.ts";
import { HttpDistributionsApiAdapter } from "./adapters/out/http-distributions-api.adapter.ts";
import { DocumentsView } from "./adapters/in/documents/DocumentsView.tsx";
import type { LegalEntitiesApiPort } from "./domain/ports/out/legal-entities-api.port.ts";
import { HttpLegalEntitiesApiAdapter } from "./adapters/out/http-legal-entities-api.adapter.ts";
import { LegalEntitiesView } from "./adapters/in/structure/LegalEntitiesView.tsx";
import type { InvitationsApiPort } from "./domain/ports/out/invitations-api.port.ts";
import { HttpInvitationsApiAdapter, HttpJoinApiAdapter } from "./adapters/out/http-invitations-api.adapter.ts";
import { InvitationsView } from "./adapters/in/people/InvitationsView.tsx";
import { JoinView } from "./adapters/in/people/JoinView.tsx";
import { NovoRhSlotsContext, type NovoRhSlots } from "./adapters/in/slots.ts";
import { ClockWidget } from "./adapters/in/attendance/ClockWidget.tsx";
import { CompanyDocumentsSlot, EmployeeArchiveSlot, PayslipImportSlot, PersonDocumentsSlot } from "./novo-rh.slots.tsx";

/** Ecrãs de outros módulos encaixados no Novo RH (ver `slots.ts`). */
const SLOTS: NovoRhSlots = {
  personDocuments: (personId) => <PersonDocumentsSlot personId={personId} />,
  employeeArchive: () => <EmployeeArchiveSlot />,
  companyDocuments: () => <CompanyDocumentsSlot />,
  payslipImport: () => <PayslipImportSlot />,
};
import { NotificationsView } from "./adapters/in/NotificationsView.tsx";
import { TransfersView } from "./adapters/in/TransfersView.tsx";
import { NotFoundView } from "./adapters/in/common/NotFoundView.tsx";
import { OfflineBanner } from "./adapters/in/common/OfflineBanner.tsx";
import { AlertsView } from "./adapters/in/engagement/AlertsView.tsx";
import { WorkspaceView } from "./adapters/in/engagement/WorkspaceView.tsx";
import { ReportsView } from "./adapters/in/engagement/ReportsView.tsx";
import { NovoRhHomeView, PreviousOverviewView } from "./adapters/in/NovoRhHomeView.tsx";
import { NovoRhLayout } from "./adapters/in/NovoRhLayout.tsx";
import { LegacyRedirect } from "./adapters/in/common/LegacyRedirect.tsx";
import { LEGACY_REDIRECTS, REPORT_GROUPS } from "./domain/services/screens.registry.ts";
import { SettingsHubView } from "./adapters/in/settings/SettingsHubView.tsx";
import type { SettingsApiPort } from "./domain/ports/out/settings-api.port.ts";

export interface NovoRhModule {
  overview: OverviewApiPort;
  dashboard: DashboardApiPort;
  assistant: AssistantApiPort;
  reminders: RemindersApiPort;
  inbox: InboxApiPort;
  demo: DemoApiPort;
  settings: SettingsApiPort;
  mfa: MfaPort;
  structure: StructureApiPort;
  access: AccessGovernanceApiPort;
  audit: AuditApiPort;
  notifications: NotificationsApiPort;
  people: PeopleApiPort;
  time: TimeApiPort;
  attendance: AttendanceApiPort;
  myClock: MyClockApiPort;
  punchQueue: PunchQueue;
  absences: AbsencesApiPort;
  myAbsences: MyAbsencesApiPort;
  timeBank: TimeBankApiPort;
  rosters: RostersApiPort;
  periods: PeriodsApiPort;
  announcements: AnnouncementsApiPort;
  distributions: DistributionsApiPort;
  legalEntities: LegalEntitiesApiPort;
  invitations: InvitationsApiPort;
  alerts: AlertsApiPort;
  workspace: WorkspaceApiPort;
  reports: ReportsApiPort;
}

const NovoRhContext = createContext<NovoRhModule | null>(null);

interface DataModeValue {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
}
const DataModeContext = createContext<DataModeValue>({ mode: "real", setMode: () => {} });

/** Modo de dados do Novo RH: Real (organização real) ou Demonstração (organização fictícia, ADR-0034). */
// eslint-disable-next-line react-refresh/only-export-components
export function useDataMode(): DataModeValue {
  return useContext(DataModeContext);
}

/**
 * Composition root do Novo RH: o único sítio que conhece os adapters
 * concretos. Nos testes passa-se `module` com fakes.
 *
 * Modo Demonstração: os pedidos a /api/novo-rh/* levam `X-Novo-RH-Mode: demo`
 * (o backend troca para a organização fictícia). O cabeçalho é ligado já
 * aqui, de forma síncrona, para que nenhum pedido dos ecrãs saia sem ele.
 */
export function NovoRhProvider({ children, module: mod, modeStore }: { children: ReactNode; module?: NovoRhModule; modeStore?: DataModeStorePort }) {
  const qc = useContext(QueryClientContext);
  const [store] = useState<DataModeStorePort>(() => modeStore ?? new SessionDataModeStore());
  const [mode, setModeState] = useState<DataMode>(() => {
    const initial = store.load();
    setRequestHeaderProvider(novoRhModeHeaders(initial));
    return initial;
  });
  useEffect(() => {
    setRequestHeaderProvider(novoRhModeHeaders(mode));
    return () => setRequestHeaderProvider(null);
  }, [mode]);
  const setMode = useCallback(
    (next: DataMode) => {
      store.save(next);
      setRequestHeaderProvider(novoRhModeHeaders(next));
      // Nada do outro modo fica em cache: os ecrãs voltam a montar e a pedir.
      qc?.removeQueries({ queryKey: ["novo-rh"] });
      setModeState(next);
    },
    [store, qc],
  );
  const modeValue = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  const [value] = useState<NovoRhModule>(
    () =>
      mod ?? {
        overview: new HttpOverviewApiAdapter(),
        dashboard: new HttpDashboardApiAdapter(),
        assistant: new HttpAssistantApiAdapter(),
        reminders: new HttpRemindersApiAdapter(),
        inbox: new HttpInboxApiAdapter(),
        demo: new HttpDemoApiAdapter(),
        settings: new HttpSettingsApiAdapter(() => store.load()),
        mfa: new SupabaseMfaAdapter(),
        structure: new HttpStructureApiAdapter(),
        access: new HttpAccessGovernanceApiAdapter(),
        audit: new HttpAuditApiAdapter(),
        notifications: new HttpNotificationsApiAdapter(),
        people: new HttpPeopleApiAdapter(),
        time: new HttpTimeApiAdapter(),
        attendance: new HttpAttendanceApiAdapter(),
        myClock: new HttpMyClockApiAdapter(),
        punchQueue: new PunchQueue(new LocalStoragePunchQueue(), () => crypto.randomUUID()),
        absences: new HttpAbsencesApiAdapter(),
        myAbsences: new HttpMyAbsencesApiAdapter(),
        timeBank: new HttpTimeBankApiAdapter(),
        rosters: new HttpRostersApiAdapter(),
        periods: new HttpPeriodsApiAdapter(),
        announcements: new HttpAnnouncementsApiAdapter(),
        distributions: new HttpDistributionsApiAdapter(),
        legalEntities: new HttpLegalEntitiesApiAdapter(),
        invitations: new HttpInvitationsApiAdapter(),
        alerts: new HttpAlertsApiAdapter(),
        workspace: new HttpWorkspaceApiAdapter(),
        reports: new HttpReportsApiAdapter(),
      },
  );
  return (
    <NovoRhContext.Provider value={value}>
      <DataModeContext.Provider value={modeValue}>{children}</DataModeContext.Provider>
    </NovoRhContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNovoRh(): NovoRhModule {
  const ctx = useContext(NovoRhContext);
  if (!ctx) throw new Error("useNovoRh fora de NovoRhProvider");
  return ctx;
}

/** Rota pública `/aderir/:code` (FE-054): pedido de adesão sem sessão. */
export function NovoRhJoinPage() {
  const { code = "" } = useParams();
  const api = useMemo(() => new HttpJoinApiAdapter(), []);
  return (
    <I18nProvider locale="pt-PT">
      <JoinView code={code} api={api} />
    </I18nProvider>
  );
}

/** Rota `/hr/novo/*`: Visão geral | Configurações | Estrutura | Acessos | Auditoria. Só Admin e com MFA (TK-3). */
export function NovoRhPage() {
  return (
    <I18nProvider locale="pt-PT">
      <NovoRhProvider>
        <NovoRhSlotsContext.Provider value={SLOTS}>
          {/* Design System Mezza só aqui dentro (classe `ds`); o resto da aplicação mantém o aspeto anterior. */}
          <div className="ds">
            <NovoRhLayout extraActions={<ClockWidget />} userMenu={<AccountMenu />}>
              <MfaGate>
                <NovoRhRoutes />
              </MfaGate>
            </NovoRhLayout>
          </div>
        </NovoRhSlotsContext.Provider>
      </NovoRhProvider>
    </I18nProvider>
  );
}

/** Conta na barra de topo (sessão da aplicação). */
function AccountMenu() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return <UserMenu email={user.email} onSignOut={() => void signOut()} />;
}

/** Rotas do Novo RH; voltam a montar ao trocar de modo (sem estado do outro modo). */
function NovoRhRoutes() {
  const { mode } = useDataMode();
  return (
    <div key={mode} className="space-y-4">
      <DemoModeBanner />
      <OfflineBanner />
      <Routes>
        <Route index element={<NovoRhHomeView />} />
        <Route path="painel-anterior" element={<PreviousOverviewView />} />
        <Route path="pedidos" element={<InboxView />} />
        <Route path="pessoas" element={<PeopleListView />} />
        <Route path="pessoas/:id" element={<PersonView />} />
        <Route path="pessoas/transferencias" element={<TransfersView />} />
        <Route path="pessoas/relatorios" element={<ReportsView groups={REPORT_GROUPS.people} />} />
        <Route path="assiduidade" element={<AttendanceView />} />
        <Route path="assiduidade/registos" element={<TimeView />} />
        <Route path="assiduidade/banco-de-horas" element={<TimeBankView />} />
        <Route path="assiduidade/fecho" element={<PeriodsView />} />
        <Route path="assiduidade/relatorios" element={<ReportsView groups={REPORT_GROUPS.attendance} />} />
        <Route path="ausencias" element={<AbsencesView />} />
        <Route path="ausencias/relatorios" element={<ReportsView groups={REPORT_GROUPS.absences} />} />
        <Route path="escalas" element={<RostersView />} />
        <Route path="comunicados" element={<AnnouncementsView />} />
        <Route path="documentos" element={<DocumentsView />} />
        <Route path="notificacoes" element={<NotificationsView />} />
        {/* Caminhos antigos (bookmarks, notificações): redirecionam mantendo query e hash. */}
        {Object.keys(LEGACY_REDIRECTS).map((p) => (
          <Route key={p} path={`${p.slice("/hr/novo/".length)}/*`} element={<LegacyRedirect />} />
        ))}
        <Route path="alertas" element={<AlertsView />} />
        <Route path="tarefas" element={<WorkspaceView />} />
        <Route path="relatorios" element={<ReportsView />} />
        <Route path="configuracoes" element={<SettingsHubView />} />
        <Route path="estrutura" element={<StructureView />} />
        <Route path="entidades" element={<LegalEntitiesView />} />
        <Route path="convites" element={<InvitationsView />} />
        <Route path="acessos" element={mode === "demo" ? <DemoAccessNotice /> : <AccessView />} />
        <Route path="auditoria" element={<AuditView />} />
        <Route path="*" element={<NotFoundView />} />
      </Routes>
    </div>
  );
}
