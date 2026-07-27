import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankStatementsModule } from "../../bank-statements.module.tsx";
import { useBankAccountsModule } from "../../../bank-accounts/bank-accounts.module.tsx";
import type { AccountMonthStatDTO } from "../../domain/entities/bank-statement.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { ImportModal } from "./ImportModal.tsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function pctColor(pct: number): string {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}

function pctBarColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-400";
  if (pct >= 50) return "bg-amber-400";
  return "bg-red-400";
}

// ── MonthCard ─────────────────────────────────────────────────────────────────

function MonthCard({
  stat,
  monthIndex,
  onClick,
}: {
  stat: AccountMonthStatDTO | null;
  monthIndex: number; // 0-based
  onClick: () => void;
}) {
  const name = MONTH_NAMES[monthIndex];

  if (!stat) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 flex flex-col gap-2 opacity-50">
        <p className="text-sm font-semibold text-stone-400">{name}</p>
        <p className="text-xs text-stone-300">Sem dados</p>
      </div>
    );
  }

  const coverage = Math.round(stat.coveragePercent);
  const reconciliation = Math.round(stat.reconciliationPercent);

  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-[#F5C992]/40 bg-white p-4 flex flex-col gap-3 text-left hover:border-[#ED5C32]/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">{name}</p>
        <span className="text-xs text-stone-400">{stat.totalMovements} mov.</span>
      </div>

      <div className="space-y-1.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-stone-400">Cobertura</span>
            <span className={`text-[10px] font-semibold ${pctColor(coverage)}`}>{coverage}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-stone-100">
            <div
              className={`h-1.5 rounded-full ${pctBarColor(coverage)}`}
              style={{ width: `${coverage}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-stone-400">Conciliação</span>
            <span className={`text-[10px] font-semibold ${pctColor(reconciliation)}`}>{reconciliation}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-stone-100">
            <div
              className={`h-1.5 rounded-full ${pctBarColor(reconciliation)}`}
              style={{ width: `${reconciliation}%` }}
            />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-stone-400">
        {stat.coveredDays}/{stat.totalDays} dias · {stat.reconciledMovements}/{stat.totalMovements} conciliados
      </p>
    </button>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function BankAccountCalendarView() {
  const { api } = useBankStatementsModule();
  const bankAccountsApi = useBankAccountsModule().api;
  const { bankId, accountId } = useParams<{ bankId: string; accountId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showImport, setShowImport] = useState(false);

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

  // Build a map month→stat for quick lookup
  const statByMonth = new Map<number, AccountMonthStatDTO>();
  for (const s of calendar ?? []) {
    statByMonth.set(s.month, s);
  }

  // Months to show: 1-12 for past years, 1-currentMonth for current year
  const visibleMonths =
    year < currentYear
      ? Array.from({ length: 12 }, (_, i) => i + 1)
      : Array.from({ length: new Date().getMonth() + 1 }, (_, i) => i + 1);

  const accountLabel =
    accountDetail?.nickname ??
    accountDetail?.iban ??
    accountDetail?.accountNumber ??
    "Conta";

  const contextIdentifier =
    accountDetail?.iban ?? accountDetail?.accountNumber ?? undefined;

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-stone-400 mb-1">
              <button
                onClick={() => navigate("/financial/bank-statements")}
                className="hover:text-stone-600"
              >
                Bancos
              </button>
              <span>/</span>
              <button
                onClick={() => navigate(`/financial/bank-statements/banks/${bankId}`)}
                className="hover:text-stone-600"
              >
                {bankDetail?.name ?? "…"}
              </button>
              <span>/</span>
              <span className="text-stone-600 font-medium">{accountLabel}</span>
            </nav>
            <h1 className="text-xl font-bold text-stone-900">{accountLabel}</h1>
            {contextIdentifier && (
              <p className="text-xs text-stone-400 font-mono mt-0.5">{contextIdentifier}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Year picker */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setYear((y) => y - 1)}
                disabled={year <= 2020}
                className="rounded-md p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-30"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-stone-700 w-12 text-center">{year}</span>
              <button
                onClick={() => setYear((y) => y + 1)}
                disabled={year >= currentYear}
                className="rounded-md p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-30"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Importar extrato
            </button>
          </div>
        </div>
      </div>

      {/* Month grid */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-stone-400 text-sm">
            A carregar calendário…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleMonths.map((month) => (
              <MonthCard
                key={month}
                monthIndex={month - 1}
                stat={statByMonth.get(month) ?? null}
                onClick={() =>
                  navigate(
                    `/financial/bank-statements/banks/${bankId}/accounts/${accountId}/${year}/${month}`,
                  )
                }
              />
            ))}
          </div>
        )}
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
