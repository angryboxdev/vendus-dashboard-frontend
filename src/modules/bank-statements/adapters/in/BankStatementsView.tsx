import { useState, useMemo, useRef } from "react";
import { NumericInput } from "../../../../components/NumericInput.tsx";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankStatementsModule } from "../../bank-statements.module.tsx";
import { useBankAccountsModule } from "../../../bank-accounts/bank-accounts.module.tsx";
import {
  type BankMovementDTO,
  type BankStatementSummaryDTO,
  type ClassifyMovementPayload,
  type ReconciliationStatus,
  type RiskLevel,
  type StatementStatus,
  RECONCILIATION_STATUS_LABELS,
  RISK_LEVEL_LABELS,
  STATEMENT_STATUS_LABELS,
} from "../../domain/entities/bank-statement.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { useToast, ToastContainer } from "../../../../components/Toast.tsx";
import { ImportModal } from "./ImportModal.tsx";
import { ClassifyDrawer } from "./ClassifyDrawer.tsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(s: string): string {
  if (!s) return "—";
  const parts = s.slice(0, 10).split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function diffClass(diff: number): string {
  if (diff === 0) return "text-emerald-600";
  if (Math.abs(diff) < 100) return "text-amber-600";
  return "text-red-600";
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

const RISK_COLORS: Record<RiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
  critical: "bg-red-100 text-red-800 font-bold",
};

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_COLORS[level]}`}
    >
      Risco {RISK_LEVEL_LABELS[level]}
    </span>
  );
}

const STMT_STATUS_COLORS: Record<StatementStatus, string> = {
  draft: "bg-stone-100 text-stone-500",
  in_review: "bg-amber-50 text-amber-700",
  completed: "bg-blue-50 text-blue-700",
  closed: "bg-emerald-50 text-emerald-700",
};

function StatementStatusBadge({ status }: { status: StatementStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STMT_STATUS_COLORS[status]}`}
    >
      {STATEMENT_STATUS_LABELS[status]}
    </span>
  );
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  valueClass = "text-stone-800",
}: {
  label: string;
  value: string | number;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

// ── EditableBalanceCard ────────────────────────────────────────────────────────

function EditableBalanceCard({
  label,
  valueCents,
  disabled,
  onSave,
}: {
  label: string;
  valueCents: number;
  disabled: boolean;
  onSave: (cents: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (disabled) return;
    setDraft((valueCents / 100).toFixed(2));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const v = parseFloat(draft.replace(",", "."));
    if (!isNaN(v)) onSave(Math.round(v * 100));
    setEditing(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  return (
    <div
      className={`rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm ${!disabled ? "cursor-pointer hover:border-[#ED5C32]/40" : ""}`}
      onClick={() => !editing && startEdit()}
      title={disabled ? undefined : "Clique para editar"}
    >
      <p className="text-xs font-medium text-stone-500 flex items-center gap-1">
        {label}
        {!disabled && !editing && (
          <svg
            className="h-3 w-3 text-stone-300"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
          </svg>
        )}
      </p>
      {editing ? (
        <NumericInput
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 w-full border-b border-[#ED5C32] bg-transparent text-xl font-bold text-stone-800 outline-none"
        />
      ) : (
        <p className="mt-1 text-xl font-bold text-stone-800">
          {fromCents(valueCents)}
        </p>
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct === 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-stone-600">{pct}%</span>
    </div>
  );
}


// ── Statement Detail ──────────────────────────────────────────────────────────

type MovementTab =
  | "all"
  | "unresolved"
  | "suggestions"
  | "high_risk"
  | "partial";

function StatementDetail({
  statementId,
  onBack,
  onDelete,
}: {
  statementId: string;
  onBack: () => void;
  onDelete: () => void;
}) {
  const { api } = useBankStatementsModule();
  const qc = useQueryClient();
  const { toasts, show: showToast } = useToast();
  const [movTab, setMovTab] = useState<MovementTab>("all");
  const [classifying, setClassifying] = useState<BankMovementDTO | null>(null);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["bank-statement", statementId],
    queryFn: () => api.getStatement(statementId),
  });

  const updateBalancesMut = useMutation({
    mutationFn: ({ opening, closing }: { opening: number; closing: number }) =>
      api.updateStatementBalances(statementId, opening, closing),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
    },
    onError: (e: Error) => alert(`Erro ao guardar saldos: ${e.message}`),
  });

  const applyRulesMut = useMutation({
    mutationFn: () => api.applyAutoRules(statementId),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
      alert(
        `Regras aplicadas: ${res.appliedCount} movimento(s) classificado(s). Progresso: ${res.reconciliationProgress}%`,
      );
    },
    onError: (e: Error) => alert(`Erro: ${e.message}`),
  });

  const suggestMut = useMutation({
    mutationFn: () => api.suggestMatches(statementId),
    onSuccess: (suggestions) => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      alert(`${suggestions.length} sugestão(ões) gerada(s).`);
    },
    onError: (e: Error) => alert(`Erro: ${e.message}`),
  });

  const closeMut = useMutation({
    mutationFn: () => api.closeStatement(statementId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
    },
    onError: (e: Error) => alert(`Não é possível fechar: ${e.message}`),
  });

  const classifyMut = useMutation({
    mutationFn: (args: {
      movementId: string;
      payload: ClassifyMovementPayload;
    }) => api.classifyMovement(args.movementId, args.payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
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
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
      setClassifying(null);
      showToast("Movimento conciliado com sucesso");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const filteredMovements = useMemo(() => {
    if (!detail) return [];
    switch (movTab) {
      case "unresolved":
        return detail.movements.filter((m) => !m.isResolved);
      case "suggestions":
        return detail.movements.filter(
          (m) => m.reconciliationStatus === "sugestao",
        );
      case "high_risk":
        return detail.movements.filter(
          (m) => m.riskLevel === "high" || m.riskLevel === "critical",
        );
      case "partial":
        return detail.movements.filter(
          (m) => m.reconciliationStatus === "conciliado_parcial",
        );
      default:
        return detail.movements;
    }
  }, [detail, movTab]);

  const unresolvedCount =
    detail?.movements.filter((m) => !m.isResolved).length ?? 0;
  const suggestionCount =
    detail?.movements.filter((m) => m.reconciliationStatus === "sugestao")
      .length ?? 0;
  const highRiskCount =
    detail?.movements.filter(
      (m) =>
        (m.riskLevel === "high" || m.riskLevel === "critical") && !m.isResolved,
    ).length ?? 0;
  const partialCount =
    detail?.movements.filter(
      (m) => m.reconciliationStatus === "conciliado_parcial",
    ).length ?? 0;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-stone-400">A carregar extrato…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">Extrato não encontrado.</p>
      </div>
    );
  }

  const isClosed = detail.status === "closed";

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} />
      {/* Breadcrumb / back */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-sm text-[#ED5C32] hover:underline flex items-center gap-1"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Extratos
        </button>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-700">
          {detail.bankName}
        </span>
        <span className="text-stone-300">/</span>
        <span className="text-sm text-stone-500">{detail.accountNumber}</span>
      </div>

      {/* Header info */}
      <div className="rounded-xl border border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-stone-900">
                {detail.bankName}
              </h2>
              <StatementStatusBadge status={detail.status} />
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {detail.accountNumber} · {formatDate(detail.periodStart)} –{" "}
              {formatDate(detail.periodEnd)}
            </p>
            {detail.sourceFileName && (
              <p className="mt-0.5 text-xs text-stone-400">
                Ficheiro: {detail.sourceFileName}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyRulesMut.mutate()}
              disabled={applyRulesMut.isPending || isClosed}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              {applyRulesMut.isPending ? "A aplicar…" : "Aplicar regras"}
            </button>
            <button
              onClick={() => suggestMut.mutate()}
              disabled={suggestMut.isPending || isClosed}
              className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40"
            >
              {suggestMut.isPending ? "A sugerir…" : "Sugerir conciliações"}
            </button>
            {!isClosed && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Fechar a conciliação? Esta ação valida que o saldo fecha e não há pendências críticas.",
                    )
                  ) {
                    closeMut.mutate();
                  }
                }}
                disabled={closeMut.isPending}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {closeMut.isPending ? "A fechar…" : "Fechar conciliação"}
              </button>
            )}
            <button
              onClick={onDelete}
              title="Eliminar extrato"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              Eliminar extrato
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-stone-500">
              Progresso da conciliação
            </span>
            <span className="text-xs text-stone-400">
              {detail.importedMovementsCount - unresolvedCount} /{" "}
              {detail.importedMovementsCount} movimentos resolvidos
            </span>
          </div>
          <ProgressBar value={detail.reconciliationProgress} />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <EditableBalanceCard
          label="Saldo inicial"
          valueCents={detail.openingBalance}
          disabled={isClosed || updateBalancesMut.isPending}
          onSave={(v) =>
            updateBalancesMut.mutate({
              opening: v,
              closing: detail.closingBalance,
            })
          }
        />
        <EditableBalanceCard
          label="Saldo extrato"
          valueCents={detail.closingBalance}
          disabled={isClosed || updateBalancesMut.isPending}
          onSave={(v) =>
            updateBalancesMut.mutate({
              opening: detail.openingBalance,
              closing: v,
            })
          }
        />
        <KpiCard
          label="Saldo calculado"
          value={fromCents(detail.calculatedClosingBalance)}
          valueClass={diffClass(detail.balanceDifference)}
        />
        <KpiCard
          label="Diferença de saldo"
          value={fromCents(detail.balanceDifference)}
          sub={
            detail.balanceDifference === 0 ? "Saldo fecha ✓" : "Saldo não fecha"
          }
          valueClass={diffClass(detail.balanceDifference)}
        />
      </div>

      {/* Movements */}
      <div className="rounded-xl border border-[#F5C992]/40 bg-white overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[#F5C992]/40 px-4 pt-1">
          {(
            [
              {
                key: "all" as MovementTab,
                label: "Todos",
                count: detail.importedMovementsCount,
              },
              {
                key: "unresolved" as MovementTab,
                label: "Não resolvidos",
                count: unresolvedCount,
              },
              {
                key: "suggestions" as MovementTab,
                label: "Sugestões",
                count: suggestionCount,
              },
              {
                key: "high_risk" as MovementTab,
                label: "Alto risco",
                count: highRiskCount,
              },
              {
                key: "partial" as MovementTab,
                label: "Parciais",
                count: partialCount,
              },
            ] as { key: MovementTab; label: string; count: number }[]
          ).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setMovTab(key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                movTab === key
                  ? "border-[#ED5C32] text-[#ED5C32]"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    movTab === key
                      ? "bg-[#ED5C32]/10 text-[#ED5C32]"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {filteredMovements.length === 0 ? (
          <div className="py-12 text-center text-sm text-stone-400">
            Nenhum movimento nesta categoria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50/60">
                <tr>
                  {(
                    [
                      { label: "Data", align: "left" },
                      { label: "Descrição", align: "left" },
                      { label: "Tipo", align: "left" },
                      { label: "Valor", align: "right" },
                      { label: "Saldo após", align: "right" },
                      { label: "Estado", align: "left" },
                      { label: "Ações", align: "center" },
                    ] as { label: string; align: "left" | "right" | "center" }[]
                  ).map(({ label, align }) => (
                    <th
                      key={label}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5C992]/30">
                {filteredMovements.map((m) => (
                  <tr
                    key={m.id}
                    className={`hover:bg-[#FDF8F5] ${
                      (m.riskLevel === "high" || m.riskLevel === "critical") &&
                      !m.isResolved
                        ? "bg-red-50/20"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-stone-500 whitespace-nowrap">
                      {formatDate(m.bookingDate)}
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <span className="block truncate text-stone-800 font-medium">
                        {m.description}
                      </span>
                      {m.notes && (
                        <span className="text-xs text-stone-400 truncate block">
                          {m.notes}
                        </span>
                      )}
                      {m.matchedEntityId &&
                        m.reconciliationStatus === "sugestao" && (
                          <span className="text-xs text-blue-500 truncate block">
                            Sugestão: {m.matchedEntityId.slice(0, 8)}…{" "}
                            {m.confidenceScore != null &&
                              `(${Math.round(m.confidenceScore * 100)}%)`}
                          </span>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${
                          m.movementType === "debit"
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {m.movementType === "debit" ? "Débito" : "Crédito"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      <span
                        className={
                          m.movementType === "debit"
                            ? "text-red-700"
                            : "text-emerald-700"
                        }
                      >
                        {m.movementType === "debit" ? "−" : "+"}
                        {fromCents(m.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-stone-500 whitespace-nowrap">
                      {fromCents(m.balanceAfter)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ReconciliationBadge
                          status={
                            m.movementType === "credit" &&
                            m.reconciliationStatus === "pendente_de_documento"
                              ? "conciliado_sem_fatura"
                              : m.reconciliationStatus
                          }
                        />
                        {m.reconciliationStatus === "conciliado_parcial" &&
                          m.reconciliationAmountDiff != null && (
                            <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-yellow-100 text-yellow-800">
                              Δ{" "}
                              {fromCents(Math.abs(m.reconciliationAmountDiff))}
                            </span>
                          )}
                        {m.movementType === "debit" ? (
                          <RiskBadge level={m.riskLevel} />
                        ) : (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-stone-100 text-stone-400">
                            Sem Risco
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {m.movementType === "debit" &&
                        (m.reconciliationStatus === "sugestao" ? (
                          <button
                            onClick={() => setClassifying(m)}
                            disabled={isClosed}
                            className="rounded-md px-2 py-1 text-xs font-medium text-[#ED5C32] hover:bg-orange-50 disabled:opacity-40"
                          >
                            Classificar
                          </button>
                        ) : !m.isResolved ? (
                          <button
                            onClick={() => setClassifying(m)}
                            disabled={isClosed}
                            className="rounded-md px-2 py-1 text-xs font-medium text-[#ED5C32] hover:bg-orange-50 disabled:opacity-40"
                          >
                            Classificar
                          </button>
                        ) : (
                          <button
                            onClick={() => setClassifying(m)}
                            disabled={isClosed}
                            className="rounded-md px-2 py-1 text-xs font-medium text-stone-400 hover:bg-stone-50 disabled:opacity-40"
                          >
                            Editar
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Classify drawer */}
      {classifying && (
        <ClassifyDrawer
          movement={classifying}
          onClose={() => setClassifying(null)}
          onSave={(payload) =>
            classifyMut.mutate({ movementId: classifying.id, payload })
          }
          onReconcile={(entityLinks) =>
            reconcileMut.mutate({ movementId: classifying.id, entityLinks })
          }
          onUnreconcile={() => {
            void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
            void qc.invalidateQueries({ queryKey: ["bank-statements"] });
          }}
          saving={classifyMut.isPending || reconcileMut.isPending}
        />
      )}
    </div>
  );
}

// ── Statements List ───────────────────────────────────────────────────────────

function StatementsList({
  onSelect,
  onImport,
  onDelete,
  bankAccountId,
  accountNumbers,
}: {
  onSelect: (id: string) => void;
  onImport: () => void;
  onDelete: (id: string) => void;
  bankAccountId?: string | null;
  /** IBAN / accountNumber to also match legacy statements (bankAccountId = null) */
  accountNumbers?: string[];
}) {
  const { api } = useBankStatementsModule();
  const { data: allStatements = [], isLoading } = useQuery({
    queryKey: ["bank-statements"],
    queryFn: () => api.listStatements(),
  });
  const statements =
    bankAccountId || accountNumbers?.length
      ? allStatements.filter((s) => {
          // Explicitly linked to this account
          if (s.bankAccountId === bankAccountId) return true;
          // Legacy statement (no bankAccountId) matching by account number
          if (s.bankAccountId === null && accountNumbers?.length) {
            return accountNumbers.some(
              (n) => n && s.accountNumber === n,
            );
          }
          return false;
        })
      : allStatements;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="py-16 text-center text-sm text-stone-400">
          A carregar extratos…
        </div>
      ) : statements.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-stone-400 mb-4">
            Nenhum extrato importado ainda.
          </p>
          <button
            onClick={onImport}
            className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Importar primeiro extrato
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statements.map((s) => (
            <StatementCard
              key={s.id}
              statement={s}
              onClick={() => onSelect(s.id)}
              onDelete={() => onDelete(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatementCard({
  statement: s,
  onClick,
  onDelete,
}: {
  statement: BankStatementSummaryDTO;
  onClick: () => void;
  onDelete: () => void;
}) {
  const diffOk = s.balanceDifference === 0;
  return (
    <div className="relative rounded-xl border border-[#F5C992]/40 bg-white shadow-sm hover:shadow-md hover:border-[#ED5C32]/30 transition-all">
      <button onClick={onClick} className="text-left w-full p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold text-stone-800">{s.bankName}</p>
            <p className="text-xs text-stone-400 mt-0.5">{s.accountNumber}</p>
          </div>
          <StatementStatusBadge status={s.status} />
        </div>

        <p className="text-xs text-stone-500 mb-3">
          {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
        </p>

        <ProgressBar value={s.reconciliationProgress} />

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-stone-400">Movimentos</span>
            <p className="font-semibold text-stone-700">
              {s.importedMovementsCount}
            </p>
          </div>
          <div>
            <span className="text-stone-400">Diferença</span>
            <p
              className={`font-semibold ${diffOk ? "text-emerald-600" : "text-red-600"}`}
            >
              {fromCents(s.balanceDifference)}
            </p>
          </div>
        </div>
      </button>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Eliminar extrato"
        className="absolute top-3 right-3 rounded-md p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-500 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function BankStatementsView() {
  const { api } = useBankStatementsModule();
  const bankAccountsApi = useBankAccountsModule().api;
  const { bankId, accountId } = useParams<{ bankId: string; accountId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const importMut = useMutation({
    mutationFn: (fd: FormData) => api.importStatement(fd),
    onSuccess: async (result) => {
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
      setShowImport(false);
      // If in account context and statement wasn't auto-linked, link it now
      if (accountId && result.bankAccountId !== accountId) {
        try {
          await bankAccountsApi.linkStatement(result.id, accountId);
          void qc.invalidateQueries({ queryKey: ["bank-statements"] });
        } catch {
          // non-critical, continue
        }
      }
      setSelectedId(result.id);
    },
    onError: (e: Error) => alert(`Erro ao importar: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteStatement(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
      setSelectedId(null);
    },
    onError: (e: Error) => alert(`Erro ao eliminar: ${e.message}`),
  });

  function handleDelete(id: string) {
    if (
      !window.confirm(
        "Tens a certeza que queres eliminar este extrato e todos os seus movimentos? Esta ação não pode ser desfeita.",
      )
    )
      return;
    deleteMut.mutate(id);
  }

  const accountLabel =
    accountDetail?.nickname ??
    accountDetail?.iban ??
    accountDetail?.accountNumber ??
    (accountDetail?.lastFourDigits
      ? `*${accountDetail.lastFourDigits}`
      : null) ??
    "Conta";

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        {/* Breadcrumb when in account context */}
        {accountId && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-stone-500">
            <button
              onClick={() => navigate("/financial/bank-statements")}
              className="hover:text-stone-700"
            >
              Bancos
            </button>
            <span className="text-stone-300">/</span>
            <span className="font-medium text-stone-700">{accountLabel}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            {accountId && (
              <button
                onClick={() => navigate("/financial/bank-statements")}
                className="mb-1 flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                    clipRule="evenodd"
                  />
                </svg>
                Bancos
              </button>
            )}
            <h1 className="text-xl font-bold text-stone-900">
              {accountId ? accountLabel : "Conciliação Bancária"}
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {selectedId
                ? "Espelho do banco — movimentos e conciliação"
                : accountId
                  ? "Extratos desta conta"
                  : "Extratos importados"}
            </p>
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

      <div className="p-6">
        {selectedId ? (
          <StatementDetail
            statementId={selectedId}
            onBack={() => setSelectedId(null)}
            onDelete={() => handleDelete(selectedId)}
          />
        ) : (
          <StatementsList
            onSelect={setSelectedId}
            onImport={() => setShowImport(true)}
            onDelete={handleDelete}
            bankAccountId={accountId}
            accountNumbers={
              accountDetail
                ? [accountDetail.iban, accountDetail.accountNumber].filter(
                    Boolean,
                  ) as string[]
                : undefined
            }
          />
        )}
      </div>

      <ImportModal
        open={showImport}
        saving={importMut.isPending}
        onClose={() => setShowImport(false)}
        onSubmit={(fd) => importMut.mutate(fd)}
        contextBankName={bankDetail?.name}
        contextAccountIdentifier={
          accountDetail?.iban ?? accountDetail?.accountNumber ?? undefined
        }
      />

      <PageFooter />
    </div>
  );
}
