import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankStatementsModule } from "../../bank-statements.module.tsx";
import { useBankAccountsModule } from "../../../bank-accounts/bank-accounts.module.tsx";
import {
  type BankMovementDTO,
  type ClassifyMovementPayload,
  type ReconciliationStatus,
  RECONCILIATION_STATUS_LABELS,
} from "../../domain/entities/bank-statement.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { useToast, ToastContainer } from "../../../../components/Toast.tsx";
import { ImportModal } from "./ImportModal.tsx";
import { ClassifyDrawer } from "./ClassifyDrawer.tsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDay(dateStr: string): string {
  const parts = dateStr.slice(0, 10).split("-");
  return `${parts[2]}/${parts[1]}`;
}

// ── Badges ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ReconciliationStatus, string> = {
  conciliado_com_fatura: "bg-emerald-50 text-emerald-700",
  conciliado_parcial: "bg-yellow-50 text-yellow-700",
  conciliado_sem_fatura: "bg-teal-50 text-teal-700",
  sugestao: "bg-blue-50 text-blue-700",
  pendente_de_documento: "bg-amber-50 text-amber-700",
  saida_nao_justificada: "bg-red-50 text-red-700",
  transferencia_interna: "bg-violet-50 text-violet-700",
  divergente: "bg-orange-50 text-orange-700",
  ignorado_com_motivo: "bg-stone-100 text-stone-500",
};

function ReconciliationBadge({ status }: { status: ReconciliationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[status]}`}
    >
      {RECONCILIATION_STATUS_LABELS[status]}
    </span>
  );
}

// ── Movement Row ──────────────────────────────────────────────────────────────

function MovementRow({
  movement,
  onClick,
}: {
  movement: BankMovementDTO;
  onClick: () => void;
}) {
  const isDebit = movement.movementType === "debit";
  const displayStatus =
    !isDebit && movement.reconciliationStatus === "pendente_de_documento"
      ? "conciliado_sem_fatura"
      : movement.reconciliationStatus;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:border-[#ED5C32]/30 hover:bg-[#FDF8F5] ${
        movement.isResolved
          ? "border-emerald-100 bg-stone-50"
          : "border-stone-200 bg-white"
      }`}
    >
      {/* Type indicator */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isDebit ? "bg-red-50" : "bg-emerald-50"
        }`}
      >
        <svg
          className={`h-4 w-4 ${isDebit ? "text-red-500" : "text-emerald-500"}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          {isDebit ? (
            <path
              fillRule="evenodd"
              d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
              clipRule="evenodd"
            />
          ) : (
            <path
              fillRule="evenodd"
              d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
              clipRule="evenodd"
            />
          )}
        </svg>
      </div>

      {/* Description + status */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-800">
          {movement.description}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <ReconciliationBadge status={displayStatus} />
          {movement.notes && (
            <span className="truncate text-xs text-stone-400">
              {movement.notes}
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-semibold ${isDebit ? "text-red-700" : "text-emerald-700"}`}
        >
          {isDebit ? "−" : "+"}
          {fromCents(movement.amount)}
        </p>
        <p className="text-xs text-stone-400">
          {fromCents(movement.balanceAfter)}
        </p>
      </div>

      {/* Chevron */}
      <svg
        className="h-4 w-4 shrink-0 text-stone-300"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function MonthDetailView() {
  const { api } = useBankStatementsModule();
  const bankAccountsApi = useBankAccountsModule().api;
  const {
    bankId,
    accountId,
    year: yearStr,
    month: monthStr,
  } = useParams<{
    bankId: string;
    accountId: string;
    year: string;
    month: string;
  }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toasts, show: showToast } = useToast();

  const year = Number(yearStr);
  const month = Number(monthStr);

  const [classifying, setClassifying] = useState<BankMovementDTO | null>(null);
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

  const { data: days, isLoading } = useQuery({
    queryKey: ["bank-month", accountId, year, month],
    queryFn: () => api.getAccountMonthDetail(accountId!, year, month),
    enabled: !!accountId && !!year && !!month,
  });

  const importMut = useMutation({
    mutationFn: (fd: FormData) => api.importStatement(fd),
    onSuccess: async (result) => {
      void qc.invalidateQueries({
        queryKey: ["bank-month", accountId, year, month],
      });
      void qc.invalidateQueries({
        queryKey: ["bank-calendar", accountId, year],
      });
      setShowImport(false);
      if (accountId && result.bankAccountId !== accountId) {
        try {
          await bankAccountsApi.linkStatement(result.id, accountId);
          void qc.invalidateQueries({
            queryKey: ["bank-month", accountId, year, month],
          });
        } catch {
          // non-critical
        }
      }
    },
    onError: (e: Error) => alert(`Erro ao importar: ${e.message}`),
  });

  const classifyMut = useMutation({
    mutationFn: (args: {
      movementId: string;
      payload: ClassifyMovementPayload;
    }) => api.classifyMovement(args.movementId, args.payload),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["bank-month", accountId, year, month],
      });
      void qc.invalidateQueries({
        queryKey: ["bank-calendar", accountId, year],
      });
      setClassifying(null);
      showToast("Movimento classificado com sucesso");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const reconcileMut = useMutation({
    mutationFn: (args: {
      movementId: string;
      entityLinks: Array<{
        entityType: "invoice" | "payable_entry";
        entityId: string;
        allocatedAmountCents: number;
        supplierId: string | null;
      }>;
    }) => api.reconcileMovement(args.movementId, args.entityLinks),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["bank-month", accountId, year, month],
      });
      void qc.invalidateQueries({
        queryKey: ["bank-calendar", accountId, year],
      });
      setClassifying(null);
      showToast("Movimento conciliado com sucesso");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const accountLabel =
    accountDetail?.nickname ??
    accountDetail?.iban ??
    accountDetail?.accountNumber ??
    "Conta";

  const contextIdentifier =
    accountDetail?.iban ?? accountDetail?.accountNumber ?? undefined;

  const monthName = MONTH_NAMES[month - 1] ?? "";

  const totalMovements = days?.reduce((s, d) => s + d.totalMovements, 0) ?? 0;
  const resolvedMovements =
    days?.reduce((s, d) => s + d.reconciledCount, 0) ?? 0;
  const totalDebit = days?.reduce((s, d) => s + d.totalDebitCents, 0) ?? 0;
  const totalCredit = days?.reduce((s, d) => s + d.totalCreditCents, 0) ?? 0;

  // Responsive: use inline panel on large screens, portal drawer on small screens
  const [isLargeScreen, setIsLargeScreen] = useState(
    () => window.matchMedia("(min-width: 1280px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const handler = (e: MediaQueryListEvent) => setIsLargeScreen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const drawerProps = classifying
    ? {
        movement: classifying,
        onClose: () => setClassifying(null),
        onSave: (payload: ClassifyMovementPayload) =>
          classifyMut.mutate({ movementId: classifying.id, payload }),
        onReconcile: (
          entityLinks: Array<{
            entityType: "invoice" | "payable_entry";
            entityId: string;
            allocatedAmountCents: number;
            supplierId: string | null;
          }>,
        ) => reconcileMut.mutate({ movementId: classifying.id, entityLinks }),
        saving: classifyMut.isPending || reconcileMut.isPending,
      }
    : null;

  // ── Timeline content (shared between layouts) ──────────────────────────────

  const timeline = (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-stone-400 text-sm">
          A carregar movimentos…
        </div>
      ) : !days || days.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="rounded-full bg-stone-100 p-4">
            <svg
              className="h-8 w-8 text-stone-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"
              />
            </svg>
          </div>
          <div>
            <p className="text-stone-600 font-medium">
              Sem movimentos para {monthName} {year}
            </p>
            <p className="text-stone-400 text-sm mt-1">
              Importe um extrato para ver os movimentos deste mês.
            </p>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Importar extrato
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day.date}>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-stone-700">
                    {formatDay(day.date)}
                  </span>
                  <span className="text-xs text-stone-400">
                    {day.totalMovements} mov.
                    {day.totalDebitCents > 0 && (
                      <span className="ml-1 text-red-500">
                        −{fromCents(day.totalDebitCents)}
                      </span>
                    )}
                    {day.totalCreditCents > 0 && (
                      <span className="ml-1 text-emerald-600">
                        +{fromCents(day.totalCreditCents)}
                      </span>
                    )}
                  </span>
                </div>
                {day.reconciledCount === day.totalMovements &&
                  day.totalMovements > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                      Completo
                    </span>
                  )}
              </div>
              <div className="space-y-2">
                {day.movements.map((m) => (
                  <MovementRow
                    key={m.id}
                    movement={m}
                    onClick={() => setClassifying(m)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ── Header ─────────────────────────────────────────────────────────────────

  const header = (
    <div className="shrink-0 border-b border-[#F5C992]/40 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-stone-400 mb-1">
            <button onClick={() => navigate("/financial/bank-statements")} className="hover:text-stone-600">Bancos</button>
            <span>/</span>
            <button onClick={() => navigate(`/financial/bank-statements/banks/${bankId}`)} className="hover:text-stone-600">{bankDetail?.name ?? "…"}</button>
            <span>/</span>
            <button onClick={() => navigate(`/financial/bank-statements/banks/${bankId}/accounts/${accountId}`)} className="hover:text-stone-600">{accountLabel}</button>
            <span>/</span>
            <span className="text-stone-600 font-medium">{monthName} {year}</span>
          </nav>
          <h1 className="text-xl font-bold text-stone-900">{monthName} {year}</h1>
          {contextIdentifier && (
            <p className="text-xs text-stone-400 font-mono mt-0.5">{contextIdentifier}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && totalMovements > 0 && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-stone-500 border-r border-stone-200 pr-3">
              <span><span className="font-semibold text-stone-700">{totalMovements}</span> mov.</span>
              <span><span className="font-semibold text-emerald-600">{resolvedMovements}</span> conciliados</span>
              <span className="text-red-600 font-semibold">−{fromCents(totalDebit)}</span>
              <span className="text-emerald-600 font-semibold">+{fromCents(totalCredit)}</span>
            </div>
          )}
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
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-[#FAF6F3] overflow-hidden">
      {header}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: scrollable timeline */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          {timeline}
          <PageFooter />
        </div>

        {/* Right: inline classify panel (large screens only) */}
        {isLargeScreen && (
          <div className="w-[500px] shrink-0 border-l border-[#F5C992]/40 bg-white overflow-hidden flex flex-col">
            {drawerProps ? (
              <ClassifyDrawer inline {...drawerProps} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-stone-400">
                <svg className="h-10 w-10 text-stone-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                <p className="text-sm font-medium text-stone-500">Seleciona um movimento</p>
                <p className="text-xs">Clica numa linha para conciliar ou classificar</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Small screen: portal drawer */}
      {!isLargeScreen && drawerProps && (
        <ClassifyDrawer {...drawerProps} />
      )}

      <ImportModal
        open={showImport}
        saving={importMut.isPending}
        onClose={() => setShowImport(false)}
        onSubmit={(fd) => importMut.mutate(fd)}
        contextBankName={bankDetail?.name}
        contextAccountIdentifier={contextIdentifier}
        bankAccountId={accountId}
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
}
