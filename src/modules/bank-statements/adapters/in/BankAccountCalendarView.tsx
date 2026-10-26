import { Fragment, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankStatementsModule } from "../../bank-statements.module.tsx";
import { useBankAccountsModule } from "../../../bank-accounts/bank-accounts.module.tsx";
import type { AccountMonthStatDTO } from "../../domain/entities/bank-statement.ts";
import { latestImportedMonth, MONTH_NAMES_PT, shiftMonth, summarizeYear } from "../../domain/services/account-year.ts";
import { maskIban } from "../../domain/services/statement-account.ts";
import { formatEUR } from "../../../../lib/format.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import {
  Button,
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconChart,
  IconChevronLeft,
  IconRepeat,
  IconChevronRight,
  IconFile,
  IconInfo,
  IconPie,
  AppIcon,
  IconWallet,
  NUMERIC,
  PAGE_BG,
  PAGE_TITLE,
  SegmentedControl,
  SURFACE,
} from "../../../../components/ui/index.ts";
import { ImportModal } from "./ImportModal.tsx";
import { KpiCard, MonthStatusPill, ReconciliationBar } from "./BankUi.tsx";

const eur = (cents: number) => formatEUR(cents / 100);
const signed = (cents: number) => `${cents > 0 ? "+ " : cents < 0 ? "− " : ""}${formatEUR(Math.abs(cents) / 100)}`;
const netClass = (cents: number) => (cents > 0 ? "text-emerald-600" : cents < 0 ? "text-red-600" : "text-navy-900");

function Figure({ label, value, valueClass = "text-navy-900" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className={`font-medium ${NUMERIC} ${valueClass}`}>{value}</dd>
    </div>
  );
}

/** Um mês da grelha: «Sem extrato» neutro (nunca 100% inventado) ou estado, fluxo e conciliação real. */
function MonthCard({ stat, month, onOpen }: { stat: AccountMonthStatDTO | undefined; month: number; onOpen: () => void }) {
  const name = MONTH_NAMES_PT[month - 1]!;
  const imported = !!stat?.statementImported;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-navy-900">{name}</p>
          {imported && <p className="mt-0.5 text-[13px] text-ink-secondary">{stat!.totalMovements} movimentos</p>}
        </div>
        <MonthStatusPill status={stat?.status ?? "no_statement"} />
      </div>
      <dl className="mt-3 space-y-1">
        {!imported && <Figure label="Movimentos" value="—" valueClass="text-ink-muted" />}
        <Figure label="Entradas" value={imported ? eur(stat!.inflowCents) : "—"} valueClass={imported ? "text-navy-900" : "text-ink-muted"} />
        <Figure label="Saídas" value={imported ? eur(stat!.outflowCents) : "—"} valueClass={imported ? "text-navy-900" : "text-ink-muted"} />
        <Figure label="Resultado" value={imported ? signed(stat!.netCents) : "—"} valueClass={imported ? `font-semibold ${netClass(stat!.netCents)}` : "text-ink-muted"} />
      </dl>
      {imported && stat!.reconciledPercent !== null && (
        <div className="mt-3">
          <ReconciliationBar status={stat!.status} percent={stat!.reconciledPercent} />
        </div>
      )}
    </>
  );
  if (!imported) return <div className="rounded-xl border border-line bg-surface-card px-4 py-3.5">{body}</div>;
  return (
    <button type="button" onClick={onOpen} className="rounded-xl border border-line bg-surface-card px-4 py-3.5 text-left transition hover:border-brand-500/40 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
      {body}
    </button>
  );
}

/** O mês em destaque: estado, fluxo de caixa, saldos e conciliação, com o acesso aos movimentos. */
function MonthFocus({ stat, label, onOpen, onImport }: { stat: AccountMonthStatDTO | undefined; label: string; onOpen: () => void; onImport: () => void }) {
  if (!stat?.statementImported) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
        <MonthStatusPill status="no_statement" />
        <p className="text-base font-semibold text-navy-900">Ainda não há extrato de {label}</p>
        <p className="max-w-md text-sm text-ink-secondary">Importe o extrato deste mês para ver as entradas, as saídas e o estado da conciliação.</p>
        <Button variant="primary" icon={<AppIcon name="upload" size={16} />} onClick={onImport}>Importar extrato</Button>
      </div>
    );
  }
  const items: { label: string; value: string; cls?: string }[] = [
    { label: "Entradas", value: eur(stat.inflowCents), cls: "text-emerald-600" },
    { label: "Saídas", value: eur(stat.outflowCents), cls: "text-red-600" },
    { label: "Resultado", value: signed(stat.netCents), cls: netClass(stat.netCents) },
    { label: "Saldo inicial", value: stat.openingBalanceCents === null ? "—" : eur(stat.openingBalanceCents) },
    { label: "Saldo final", value: stat.closingBalanceCents === null ? "—" : eur(stat.closingBalanceCents) },
  ];
  return (
    <div className="rounded-xl border border-line p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-lg font-bold text-navy-900">{label}</p>
          <MonthStatusPill status={stat.status} />
          <span className="text-[13px] text-ink-secondary">{stat.totalMovements} movimentos</span>
        </div>
        <Button variant="primary" onClick={onOpen}>
          Ver movimentos <IconChevronRight size={14} />
        </Button>
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl bg-surface-soft/60 px-4 py-3">
            <dt className="text-xs text-ink-secondary">{i.label}</dt>
            <dd className={`mt-0.5 text-lg font-bold ${NUMERIC} ${i.cls ?? "text-navy-900"}`}>{i.value}</dd>
          </div>
        ))}
      </dl>
      {stat.reconciledPercent !== null && (
        <div className="mt-5">
          <p className="mb-1.5 text-xs text-ink-secondary">
            {stat.reconciledMovements} de {stat.reconcilableMovements} movimentos conciliados
          </p>
          <ReconciliationBar status={stat.status} percent={stat.reconciledPercent} />
        </div>
      )}
    </div>
  );
}

/**
 * Vista anual da conta (task «Conciliação bancária V2», mockup do utilizador): resumo do ano, grelha dos
 * 12 meses com o estado do extrato e a conciliação real, e os saldos conhecidos.
 */
export function BankAccountCalendarView() {
  const { api } = useBankStatementsModule();
  const bankAccountsApi = useBankAccountsModule().api;
  const { bankId, accountId } = useParams<{ bankId: string; accountId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const [year, setYear] = useState(currentYear);
  // Abre no mês corrente; «2026» mostra o ano inteiro (as setas passam a mudar de ano).
  const [month, setMonth] = useState(currentMonth);
  const [view, setView] = useState<"month" | "year">("month");
  const [showImport, setShowImport] = useState(false);

  const atCurrent = view === "month" ? year * 12 + month >= currentYear * 12 + currentMonth : year >= currentYear;
  const canNext = !atCurrent;
  const canPrev = year > 2020 || (view === "month" && month > 1);
  const goPrev = () => {
    if (view === "year") return setYear((y) => y - 1);
    const p = shiftMonth(year, month, -1);
    setYear(p.year);
    setMonth(p.month);
  };
  const goNext = () => {
    if (view === "year") return setYear((y) => y + 1);
    const n = shiftMonth(year, month, 1);
    setYear(n.year);
    setMonth(n.month);
  };

  const { data: accountDetail } = useQuery({
    queryKey: ["bank-accounts:account", accountId],
    queryFn: () => bankAccountsApi.getAccount(accountId!),
    enabled: !!accountId,
  });

  const { data: bankDetail } = useQuery({
    queryKey: ["bank-accounts:bank", bankId],
    queryFn: () => bankAccountsApi.getBank(bankId!),
    enabled: !!bankId,
  });

  const { data: calendar, isLoading } = useQuery({
    queryKey: ["bank-calendar", accountId, year],
    queryFn: () => api.getAccountCalendar(accountId!, year),
    enabled: !!accountId,
  });

  const importMut = useMutation({
    mutationFn: (fd: FormData) => api.importStatement(fd),
    onSuccess: async (result) => {
      void qc.invalidateQueries({ queryKey: ["bank-calendar", accountId] });
      setShowImport(false);
      if (accountId && result.bankAccountId !== accountId) {
        try {
          await bankAccountsApi.linkStatement(result.id, accountId);
          void qc.invalidateQueries({ queryKey: ["bank-calendar", accountId] });
        } catch {
          // non-critical
        }
      }
    },
    onError: (e: Error) => alert(`Erro ao importar: ${e.message}`),
  });

  const months = calendar ?? [];
  const statByMonth = new Map(months.map((s) => [s.month, s]));
  const summary = summarizeYear(months);
  const lastMonth = latestImportedMonth(months);
  const lastImported = [...months].filter((m) => m.statementImported).sort((a, b) => b.month - a.month)[0];

  const accountLabel = accountDetail?.nickname ?? accountDetail?.iban ?? accountDetail?.accountNumber ?? "Conta";
  const contextIdentifier = accountDetail?.iban ?? accountDetail?.accountNumber ?? undefined;
  const identifier = accountDetail?.iban ? `IBAN ${maskIban(accountDetail.iban)}` : accountDetail?.accountNumber ? `N.º ${accountDetail.accountNumber}` : null;
  const monthUrl = (m: number) => `/financial/bank-statements/banks/${bankId}/accounts/${accountId}/${year}/${m}`;

  const crumbs: [string, (() => void) | null][] = [
    ["Financeiro", null],
    ["Bancos", () => navigate("/financial/bank-statements")],
    [bankDetail?.name ?? "…", () => navigate(`/financial/bank-statements/banks/${bankId}`)],
    [accountLabel, null],
  ];

  return (
    <div className={`flex min-h-full flex-col ${PAGE_BG}`}>
      <div className="space-y-6 px-4 py-6 sm:px-8">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-start justify-between gap-4 motion-safe:animate-motion-fade-up">
          <div className="min-w-0">
            <nav aria-label="Localização" className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-secondary">
              {crumbs.map(([label, go], i) => (
                <Fragment key={i}>
                  {i > 0 && <IconChevronRight size={12} className="text-ink-muted" />}
                  {go ? (
                    <button type="button" onClick={go} className="hover:text-navy-900">{label}</button>
                  ) : (
                    <span className={i === crumbs.length - 1 ? "text-navy-900" : ""}>{label}</span>
                  )}
                </Fragment>
              ))}
            </nav>
            <h1 className={PAGE_TITLE}>{accountLabel}</h1>
            <p className="mt-1.5 text-[15px] text-ink-secondary">
              {[bankDetail?.name, identifier, "EUR"].filter(Boolean).join("  ·  ")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button icon={<IconRepeat size={16} />} onClick={() => navigate("/financial/bank-statements/recurring")}>
              Movimentos recorrentes
            </Button>
            <Button disabled={lastMonth === null} onClick={() => lastMonth !== null && navigate(monthUrl(lastMonth))}>
              Ver movimentos
            </Button>
            <Button variant="primary" icon={<AppIcon name="upload" size={16} />} onClick={() => setShowImport(true)}>
              Importar extrato
            </Button>
          </div>
        </header>

        {/* Resumo do ano */}
        <section aria-label={`Resumo de ${year}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <KpiCard tone="green" icon={<IconArrowDown size={22} />} label="Entradas do ano" value={eur(summary.inflowCents)} />
          <KpiCard tone="red" icon={<IconArrowUp size={22} />} label="Saídas do ano" value={eur(summary.outflowCents)} />
          <KpiCard tone={summary.netCents < 0 ? "red" : "green"} icon={<IconChart size={22} />} label="Resultado líquido" value={signed(summary.netCents)} valueClass={netClass(summary.netCents)} />
          <KpiCard tone="violet" icon={<IconFile size={22} />} label="Meses importados" value={`${summary.importedMonths} / 12`} />
          <KpiCard tone="blue" icon={<IconPie size={22} />} label="Conciliação do ano" value={summary.reconciledPercent === null ? "—" : `${summary.reconciledPercent}%`} />
        </section>

        {/* Resumo mensal */}
        <section className={`${SURFACE} p-5 sm:p-6`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-navy-900">Resumo mensal</h2>
              <div className="flex items-center gap-1 rounded-xl border border-line px-1 py-0.5">
                <button type="button" onClick={goPrev} disabled={!canPrev} aria-label={view === "month" ? "Mês anterior" : "Ano anterior"} className="rounded-lg p-1.5 text-ink-secondary hover:bg-surface-soft disabled:opacity-30">
                  <IconChevronLeft size={16} />
                </button>
                <span className={`min-w-[8.5rem] text-center text-sm font-semibold text-navy-900 ${NUMERIC}`}>
                  {view === "month" ? `${MONTH_NAMES_PT[month - 1]} ${year}` : year}
                </span>
                <button type="button" onClick={goNext} disabled={!canNext} aria-label={view === "month" ? "Mês seguinte" : "Ano seguinte"} className="rounded-lg p-1.5 text-ink-secondary hover:bg-surface-soft disabled:opacity-30">
                  <IconChevronRight size={16} />
                </button>
              </div>
              <SegmentedControl
                label="Período"
                size="sm"
                value={view}
                onChange={setView}
                items={[
                  { key: "month", label: "Mês" },
                  { key: "year", label: String(year) },
                ]}
              />
            </div>
            <p className="flex items-center gap-1.5 text-[13px] text-ink-secondary">
              <IconInfo size={14} /> Meses sem extrato importado não exibem percentagem de conciliação.
            </p>
          </div>

          {isLoading ? (
            <p className="py-16 text-center text-sm text-ink-secondary">A carregar…</p>
          ) : view === "month" ? (
            <MonthFocus
              stat={statByMonth.get(month)}
              label={`${MONTH_NAMES_PT[month - 1]} ${year}`}
              onOpen={() => navigate(monthUrl(month))}
              onImport={() => setShowImport(true)}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <MonthCard
                  key={m}
                  month={m}
                  stat={statByMonth.get(m)}
                  onOpen={() => {
                    setMonth(m);
                    setView("month");
                  }}
                />
              ))}
            </div>
          )}

          {/* Saldos conhecidos */}
          <div className="mt-5 grid gap-3 rounded-xl border border-line bg-surface-card p-4 sm:grid-cols-3 sm:divide-x sm:divide-line-subtle">
            {[
              { icon: <IconWallet size={20} />, label: "Saldo inicial conhecido", value: summary.openingBalanceCents === null ? "—" : eur(summary.openingBalanceCents) },
              { icon: <IconChart size={20} />, label: "Saldo final mais recente", value: summary.closingBalanceCents === null ? "—" : eur(summary.closingBalanceCents) },
              { icon: <IconCalendar size={20} />, label: "Último extrato", value: lastImported ? `${MONTH_NAMES_PT[lastImported.month - 1]!.slice(0, 3)} ${year}` : "—" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 sm:px-4 first:sm:pl-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-soft text-navy-900">{item.icon}</span>
                <div>
                  <p className="text-xs text-ink-secondary">{item.label}</p>
                  <p className={`text-lg font-bold text-navy-900 ${NUMERIC}`}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ImportModal
        open={showImport}
        saving={importMut.isPending}
        onClose={() => setShowImport(false)}
        onSubmit={(fd) => importMut.mutate(fd)}
        contextBankName={bankDetail?.name}
        contextAccountIdentifier={contextIdentifier}
        bankAccountId={accountId}
      />

      <PageFooter />
    </div>
  );
}
