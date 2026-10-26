import { Fragment, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankStatementsModule } from "../../bank-statements.module.tsx";
import { useBankAccountsModule } from "../../../bank-accounts/bank-accounts.module.tsx";
import { latestImportedMonth, MONTH_NAMES_PT, shiftMonth, summarizeYear } from "../../domain/services/account-year.ts";
import { maskIban } from "../../domain/services/statement-account.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import {
  AppIcon,
  Button,
  IconChevronLeft,
  IconChevronRight,
  IconLayers,
  IconMenu,
  IconRepeat,
  NUMERIC,
  PAGE_BG,
  PAGE_TITLE,
  SegmentedControl,
  SURFACE,
} from "../../../../components/ui/index.ts";
import { ImportModal } from "./ImportModal.tsx";
import { MonthSummary, MonthsBoard, MonthsTable, YearMetricsStrip } from "./AccountYearViews.tsx";
import { eur } from "./money.ts";

type Layout = "table" | "board";
const LAYOUT_STORAGE_KEY = "mezza.bank-account.months-layout";

/** Tabela por defeito; a escolha fica no browser (mesmo padrão das colunas dos fornecedores). */
function loadLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_STORAGE_KEY) === "board" ? "board" : "table";
  } catch {
    return "table";
  }
}

function saveLayout(layout: Layout) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  } catch {
    // localStorage indisponível (ex: modo privado) — a preferência simplesmente não persiste.
  }
}

/** «12345678903» → «•••• 8903» (o número completo não aparece no cabeçalho). */
function maskAccountNumber(n: string): string {
  return n.length > 4 ? `•••• ${n.slice(-4)}` : n;
}

/**
 * Vista da conta (task «Bancos V3»): cabeçalho único, uma faixa de indicadores, os 12 meses em Tabela
 * (predefinida) ou Quadro, e o resumo de um mês (com ou sem extrato) no mesmo contentor. Os saldos
 * continuam nos dados — na página só o último saldo conhecido, datado, no cabeçalho.
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
  const [layout, setLayoutState] = useState<Layout>(loadLayout);
  /** `null` = visão anual; um número = resumo desse mês. */
  const [openMonth, setOpenMonth] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);

  const setLayout = (l: Layout) => {
    setLayoutState(l);
    saveLayout(l);
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

  const { data: calendar, isLoading, isError } = useQuery({
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

  // Um único agregado para a faixa, a Tabela, o Quadro e o resumo do mês.
  const months = calendar ?? [];
  const statByMonth = new Map(months.map((s) => [s.month, s]));
  const summary = summarizeYear(months);
  const lastMonth = latestImportedMonth(months);
  const lastWithBalance = [...months].filter((m) => m.statementImported && m.closingBalanceCents !== null).sort((a, b) => b.month - a.month)[0];

  const accountLabel = accountDetail?.nickname ?? accountDetail?.iban ?? accountDetail?.accountNumber ?? "Conta";
  const contextIdentifier = accountDetail?.iban ?? accountDetail?.accountNumber ?? undefined;
  const identifier = accountDetail?.iban
    ? `IBAN ${maskIban(accountDetail.iban)}`
    : accountDetail?.accountNumber
      ? `Conta ${maskAccountNumber(accountDetail.accountNumber)}`
      : null;
  const monthUrl = (y: number, m: number) => `/financial/bank-statements/banks/${bankId}/accounts/${accountId}/${y}/${m}`;

  // Navegação mês a mês no resumo (passa de ano; não vai além do mês corrente).
  const isAfterNow = (y: number, m: number) => y * 12 + m > currentYear * 12 + currentMonth;
  const goMonth = (delta: number) => {
    if (openMonth === null) return;
    const n = shiftMonth(year, openMonth, delta);
    setYear(n.year);
    setOpenMonth(n.month);
  };

  const crumbs: [string, (() => void) | null][] = [
    ["Financeiro", null],
    ["Bancos", () => navigate("/financial/bank-statements")],
    [bankDetail?.name ?? "…", () => navigate(`/financial/bank-statements/banks/${bankId}`)],
    [accountLabel, null],
  ];

  return (
    <div className={`flex min-h-full flex-col ${PAGE_BG}`}>
      <div className="min-w-0 space-y-5 px-4 py-6 sm:px-8">
        {/* Cabeçalho (igual em todas as vistas) */}
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
            <p className="mt-1.5 text-[15px] text-ink-secondary">{[bankDetail?.name, identifier, "EUR"].filter(Boolean).join("  ·  ")}</p>
            {lastWithBalance && (
              <p className={`mt-1 text-[13px] text-ink-muted ${NUMERIC}`}>
                Último saldo conhecido: <span className="font-medium text-navy-900">{eur(lastWithBalance.closingBalanceCents!)}</span> · fim do extrato de{" "}
                {MONTH_NAMES_PT[lastWithBalance.month - 1]!.toLowerCase()} {year}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <Button icon={<IconRepeat size={16} />} onClick={() => navigate(`/financial/bank-statements/banks/${bankId}/recurring`)}>
              Movimentos recorrentes
            </Button>
            <Button disabled={lastMonth === null} onClick={() => lastMonth !== null && navigate(monthUrl(year, lastMonth))}>
              Ver movimentos
            </Button>
            <Button variant="primary" icon={<AppIcon name="upload" size={16} />} onClick={() => setShowImport(true)}>
              Importar extrato
            </Button>
          </div>
        </header>

        {/* Faixa única de indicadores */}
        <YearMetricsStrip summary={summary} year={year} />

        {/* Resumo mensal: Tabela | Quadro | um mês */}
        <section className={`${SURFACE} p-5 sm:p-6`}>
          {openMonth === null && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-navy-900">Resumo mensal</h2>
                <p className="text-[13px] text-ink-secondary">Movimentos, fluxo bancário e conciliação de cada mês.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  label="Vista dos meses"
                  size="sm"
                  value={layout}
                  onChange={setLayout}
                  items={[
                    { key: "table", label: <span className="inline-flex items-center gap-1.5"><IconMenu size={14} /> Tabela</span> },
                    { key: "board", label: <span className="inline-flex items-center gap-1.5"><IconLayers size={14} /> Quadro</span> },
                  ]}
                />
                <div className="flex items-center gap-1 rounded-xl border border-line px-1 py-0.5">
                  <button type="button" onClick={() => setYear((y) => y - 1)} disabled={year <= 2020} aria-label="Ano anterior" className="rounded-lg p-1.5 text-ink-secondary hover:bg-surface-soft disabled:opacity-30">
                    <IconChevronLeft size={16} />
                  </button>
                  <span className={`min-w-[3.5rem] text-center text-sm font-semibold text-navy-900 ${NUMERIC}`}>{year}</span>
                  <button type="button" onClick={() => setYear((y) => y + 1)} disabled={year >= currentYear} aria-label="Ano seguinte" className="rounded-lg p-1.5 text-ink-secondary hover:bg-surface-soft disabled:opacity-30">
                    <IconChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="py-16 text-center text-sm text-ink-secondary">A carregar…</p>
          ) : isError ? (
            <p className="py-16 text-center text-sm text-red-600">Não foi possível carregar os meses desta conta.</p>
          ) : openMonth !== null ? (
            <MonthSummary
              stat={statByMonth.get(openMonth)}
              year={year}
              month={openMonth}
              canPrev={year * 12 + openMonth > 2020 * 12 + 1}
              canNext={(() => {
                const next = shiftMonth(year, openMonth, 1);
                return !isAfterNow(next.year, next.month);
              })()}
              onPrev={() => goMonth(-1)}
              onNext={() => goMonth(1)}
              onBack={() => setOpenMonth(null)}
              onOpenMovements={() => navigate(monthUrl(year, openMonth))}
              onImport={() => setShowImport(true)}
            />
          ) : layout === "table" ? (
            <MonthsTable months={statByMonth} summary={summary} onOpen={setOpenMonth} onImport={() => setShowImport(true)} />
          ) : (
            <MonthsBoard months={statByMonth} onOpen={setOpenMonth} onImport={() => setShowImport(true)} />
          )}
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
