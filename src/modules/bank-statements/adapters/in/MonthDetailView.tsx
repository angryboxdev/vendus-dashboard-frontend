import { Fragment, useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankStatementsModule } from "../../bank-statements.module.tsx";
import { useBankAccountsModule } from "../../../bank-accounts/bank-accounts.module.tsx";
import {
  type BankMovementDTO,
  type ClassifyMovementPayload,
  type GroupedEntityLinkInput,
  type MonthlyEntityMatchSuggestionDTO,
  type RepeatJustificationSuggestionDTO,
  type ReconciliationStatus,
  JUSTIFICATION_TYPE_LABELS,
  RECONCILIATION_STATUS_LABELS,
} from "../../domain/entities/bank-statement.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { useToast, ToastContainer } from "../../../../components/Toast.tsx";
import { ApiError } from "../../../../lib/api.ts";
import { ImportModal } from "./ImportModal.tsx";
import { MOVEMENT_KIND_LABELS } from "../../domain/services/movement-kind.ts";
import { rowStatus, visibleMonthDays, type MonthChip, type MonthSort, type MonthTab, type RowStatus } from "../../domain/services/month-movements.ts";
import { maskIban } from "../../domain/services/statement-account.ts";
import { buildRecurringRulePayload, type RecurringRuleDraft } from "../../domain/services/recurring-rule.ts";
import { bulkReconcileItems, type BulkReconcileItem } from "../../domain/services/suggestions.ts";
import { KpiCard } from "./BankUi.tsx";
import {
  AppIcon,
  Button,
  Dialog,
  EmptyState,
  FIELD,
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconChart,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconFile,
  IconRepeat,
  DropdownMenu,
  NUMERIC,
  PAGE_BG,
  PAGE_TITLE,
  SearchInput,
  SURFACE,
  Tabs,
} from "../../../../components/ui/index.ts";
import { ClassifyDrawer, type ClassifyDrawerSuggestion } from "./ClassifyDrawer.tsx";

function isVersionConflict(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 409;
}

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

// ── Movement Row ──────────────────────────────────────────────────────────────

const ROW_STATUS: Record<RowStatus, { label: string; chip: string }> = {
  pending: { label: "Por conciliar", chip: "bg-amber-50 text-amber-700" },
  partial: { label: "Parcial", chip: "bg-amber-50 text-amber-700" },
  reconciled: { label: "Conciliado", chip: "bg-emerald-50 text-emerald-700" },
};

/** Linha do mês (mockup V2): seta de entrada/saída, descritivo, tipo, estado, valor e saldo. */
function MovementRow({
  movement,
  selected,
  onClick,
}: {
  movement: BankMovementDTO;
  selected: boolean;
  onClick: () => void;
}) {
  const isDebit = movement.movementType === "debit";
  const status = rowStatus(movement);
  const s = ROW_STATUS[status];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected || undefined}
      title={RECONCILIATION_STATUS_LABELS[movement.reconciliationStatus as ReconciliationStatus]}
      className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
        selected ? "border-brand-500/60 bg-brand-50/60" : "border-line bg-surface-card hover:border-brand-500/30 hover:bg-surface-soft/50"
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isDebit ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
        {isDebit ? <IconArrowDown size={16} /> : <IconArrowUp size={16} />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-navy-900">{movement.description}</span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-secondary">
          {movement.movementKind ? MOVEMENT_KIND_LABELS[movement.movementKind] : (movement.notes ?? " ")}
        </span>
      </span>

      {movement.classifiedByRuleId && (
        <span
          title="Conciliado automaticamente por um movimento recorrente"
          className="hidden shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 sm:inline-flex"
        >
          <IconRepeat size={12} /> Auto
        </span>
      )}

      <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${s.chip}`}>
        {status === "reconciled" ? <IconCheck size={12} /> : <IconClock size={12} />}
        {s.label}
      </span>

      <span className="w-32 shrink-0 text-right">
        <span className={`block text-sm font-bold ${NUMERIC} ${isDebit ? "text-red-600" : "text-emerald-600"}`}>
          {isDebit ? "−" : "+"}
          {fromCents(movement.amount)}
        </span>
        <span className={`block text-xs text-ink-muted ${NUMERIC}`}>Saldo: {fromCents(movement.balanceAfter)}</span>
      </span>

      <IconChevronRight size={16} className="shrink-0 text-ink-muted" />
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
  const [classifyingSuggestion, setClassifyingSuggestion] = useState<ClassifyDrawerSuggestion | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [viewTab, setViewTab] = useState<MonthTab>("movements");
  const [chip, setChip] = useState<MonthChip>("pending");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<MonthSort>("priority");
  const [collapsedDays, setCollapsedDays] = useState<ReadonlySet<string>>(new Set());
  const toggleDay = (date: string) =>
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

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

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["bank-month-suggestions", accountId, year, month],
    queryFn: () => api.getMonthlySuggestions(accountId!, year, month),
    enabled: !!accountId && !!year && !!month,
  });

  const movementsById = useMemo(() => {
    const map = new Map<string, BankMovementDTO>();
    for (const day of days ?? []) {
      for (const m of day.movements) map.set(m.id, m);
    }
    return map;
  }, [days]);

  // Movimentos com sugestão (faturas/contas a pagar que batem, ou classificação repetida).
  const suggestedIds = useMemo(
    () => new Set([...(suggestions?.entityMatches ?? []).map((s) => s.movementId), ...(suggestions?.repeatJustifications ?? []).map((s) => s.movementId)]),
    [suggestions],
  );
  const visibleDays = useMemo(
    () => visibleMonthDays(days ?? [], { tab: viewTab, chip: viewTab === "reconciled" && chip === "pending" ? "all" : chip, search, sort, suggestedIds }),
    [days, viewTab, chip, search, sort, suggestedIds],
  );

  const suggestionsCount =
    (suggestions?.entityMatches.length ?? 0) + (suggestions?.repeatJustifications.length ?? 0);

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
    mutationFn: async (args: {
      movement: BankMovementDTO;
      payload: ClassifyMovementPayload;
      recurring?: RecurringRuleDraft | null;
    }) => {
      await api.classifyMovement(args.movement.id, args.payload);
      if (!args.recurring || !accountId) return { rule: null };
      // «Classificar sempre assim»: a classificação já está gravada; se a regra falhar, avisa sem a perder.
      try {
        const rule = await api.createRule(buildRecurringRulePayload(args.movement, accountId, args.payload, args.recurring));
        return { rule };
      } catch (e) {
        return { rule: null, ruleError: e instanceof Error ? e.message : "erro desconhecido" };
      }
    },
    onSuccess: (result) => {
      // Uma regra aplicada aos meses anteriores mexe noutros meses da conta: invalida a conta toda.
      const scope = result.rule ? ["bank-month", accountId] : ["bank-month", accountId, year, month];
      void qc.invalidateQueries({ queryKey: scope });
      void qc.invalidateQueries({
        queryKey: result.rule ? ["bank-calendar", accountId] : ["bank-calendar", accountId, year],
      });
      void qc.invalidateQueries({
        queryKey: result.rule ? ["bank-month-suggestions", accountId] : ["bank-month-suggestions", accountId, year, month],
      });
      if (result.rule) void qc.invalidateQueries({ queryKey: ["bank-rules"] });
      setClassifying(null);
      setClassifyingSuggestion(null);
      if ("ruleError" in result && result.ruleError) {
        showToast(`Movimento classificado, mas o movimento recorrente não foi criado: ${result.ruleError}`, "error");
      } else if (result.rule) {
        const n = result.rule.appliedCount;
        showToast(
          n > 0
            ? `Movimento recorrente «${result.rule.name}» criado — ${n} movimento${n === 1 ? "" : "s"} de outros meses conciliado${n === 1 ? "" : "s"}`
            : `Movimento recorrente «${result.rule.name}» criado — os próximos ficam conciliados ao importar`,
        );
      } else {
        showToast("Movimento classificado com sucesso");
      }
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
      void qc.invalidateQueries({
        queryKey: ["bank-month-suggestions", accountId, year, month],
      });
      setClassifying(null);
      setClassifyingSuggestion(null);
      showToast("Movimento conciliado com sucesso");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  // «Conciliar todas» (sugestões de faturas/contas a pagar): a mesma conciliação do painel, uma a uma; se
  // alguma falhar (ex.: a fatura entretanto foi paga), as outras seguem e o aviso diz quantas ficaram.
  const [confirmBulk, setConfirmBulk] = useState<BulkReconcileItem[] | null>(null);
  const bulkMut = useMutation({
    mutationFn: async (items: BulkReconcileItem[]) => {
      let ok = 0;
      const failed: string[] = [];
      for (const item of items) {
        try {
          await api.reconcileMovement(item.movementId, item.entityLinks);
          ok += 1;
        } catch (e) {
          failed.push(e instanceof Error ? e.message : "erro");
        }
      }
      return { ok, failed };
    },
    onSuccess: ({ ok, failed }) => {
      void qc.invalidateQueries({ queryKey: ["bank-month", accountId, year, month] });
      void qc.invalidateQueries({ queryKey: ["bank-calendar", accountId, year] });
      void qc.invalidateQueries({ queryKey: ["bank-month-suggestions", accountId, year, month] });
      setConfirmBulk(null);
      if (failed.length === 0) showToast(`${ok} movimento${ok === 1 ? "" : "s"} conciliado${ok === 1 ? "" : "s"} com a fatura sugerida`);
      else showToast(`${ok} conciliado${ok === 1 ? "" : "s"}, ${failed.length} não: ${failed[0]}`, "error");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  // "Liquidação agrupada" — settles one or more invoices/credit notes at
  // once. `ClassifyDrawer` calls this via `mutateAsync` and catches the 409
  // itself (to show its own stale-document modal), so this mutation's
  // `onError` only needs to toast for anything that isn't that conflict.
  const groupedSettlementMut = useMutation({
    mutationFn: (args: { movementId: string; entityLinks: GroupedEntityLinkInput[] }) =>
      api.confirmGroupedSettlement(args.movementId, args.entityLinks),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["bank-month", accountId, year, month],
      });
      void qc.invalidateQueries({
        queryKey: ["bank-calendar", accountId, year],
      });
      void qc.invalidateQueries({
        queryKey: ["bank-month-suggestions", accountId, year, month],
      });
      setClassifying(null);
      setClassifyingSuggestion(null);
      showToast("Movimento conciliado com sucesso");
    },
    onError: (e: unknown) => {
      if (isVersionConflict(e)) return; // ClassifyDrawer shows its own stale-document modal
      showToast(e instanceof Error ? e.message : "Erro ao confirmar liquidação", "error");
    },
  });

  // Opens the drawer with the reconciliation/classification already filled in
  // from the suggestion, so the user reviews (and can still change) it before
  // confirming — nothing is applied until they submit the drawer's form.
  function openEntityMatchSuggestion(s: MonthlyEntityMatchSuggestionDTO) {
    const movement = movementsById.get(s.movementId);
    if (!movement) return;
    setClassifying(movement);
    setClassifyingSuggestion({
      kind: "entity_match",
      entityType: s.entityType,
      entityId: s.entityId,
      entityLabel: s.entityLabel,
      supplierId: s.supplierId,
      amountCents: s.amountCents,
      openBalanceCents: s.openBalanceCents,
    });
  }

  function openRepeatJustificationSuggestion(s: RepeatJustificationSuggestionDTO) {
    const movement = movementsById.get(s.movementId);
    if (!movement) return;
    setClassifying(movement);
    setClassifyingSuggestion({
      kind: "repeat_justification",
      justificationType: s.justificationType,
      costCenterGroupId: s.costCenterGroupId,
      costCenterCategoryId: s.costCenterCategoryId,
      supplierId: s.supplierId,
      notes: s.notes,
      vatRate: s.vatRate,
      vatIncluded: s.vatIncluded,
    });
  }

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
        suggestion: classifyingSuggestion,
        onClose: () => {
          setClassifying(null);
          setClassifyingSuggestion(null);
        },
        onSave: (payload: ClassifyMovementPayload, recurring?: RecurringRuleDraft | null) =>
          classifyMut.mutate({ movement: classifying, payload, recurring }),
        onReconcile: (
          entityLinks: Array<{
            entityType: "invoice" | "payable_entry";
            entityId: string;
            allocatedAmountCents: number;
            supplierId: string | null;
          }>,
        ) => reconcileMut.mutate({ movementId: classifying.id, entityLinks }),
        onConfirmGroupedSettlement: (entityLinks: GroupedEntityLinkInput[]) =>
          groupedSettlementMut.mutateAsync({ movementId: classifying.id, entityLinks }),
        onUnreconcile: () => {
          void qc.invalidateQueries({ queryKey: ["bank-month", accountId, year, month] });
          void qc.invalidateQueries({ queryKey: ["bank-calendar", accountId, year] });
        },
        saving: classifyMut.isPending || reconcileMut.isPending || groupedSettlementMut.isPending,
      }
    : null;

  // ── Timeline content (shared between layouts) ──────────────────────────────

  const timeline = (
    <>
      {isLoading ? (
        <p className="py-20 text-center text-sm text-ink-secondary">A carregar movimentos…</p>
      ) : !days || days.length === 0 ? (
        <div className={SURFACE}>
          <EmptyState
            icon={<IconCalendar size={28} />}
            title={`Sem movimentos em ${monthName} ${year}`}
            description="Importe o extrato deste mês para ver e conciliar os movimentos."
            action={<Button variant="primary" icon={<AppIcon name="upload" size={16} />} onClick={() => setShowImport(true)}>Importar extrato</Button>}
          />
        </div>
      ) : visibleDays.length === 0 ? (
        <div className={SURFACE}>
          <EmptyState
            icon={<IconCheck size={28} />}
            title={chip === "pending" ? "Sem movimentos por conciliar" : "Nenhum movimento com estes filtros"}
            action={<Button size="sm" onClick={() => { setChip("all"); setSearch(""); }}>Ver todos os movimentos do mês</Button>}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {visibleDays.map((day) => {
            const open = !collapsedDays.has(day.date);
            const inflow = day.movements.filter((m) => m.movementType === "credit").reduce((s, m) => s + m.amount, 0);
            const outflow = day.movements.filter((m) => m.movementType === "debit").reduce((s, m) => s + m.amount, 0);
            return (
              <section key={day.date} className={`${SURFACE} p-3 sm:p-4`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleDay(day.date)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 py-1 text-left text-[13px] text-ink-secondary hover:bg-surface-soft/60"
                >
                  <span className="text-lg font-bold text-navy-900">{formatDay(day.date)}</span>
                  <span>{day.movements.length} {day.movements.length === 1 ? "movimento" : "movimentos"}</span>
                  {inflow > 0 && <span>· Entradas <span className={`font-semibold text-emerald-600 ${NUMERIC}`}>+{fromCents(inflow)}</span></span>}
                  {outflow > 0 && <span>· Saídas <span className={`font-semibold text-red-600 ${NUMERIC}`}>−{fromCents(outflow)}</span></span>}
                  <IconChevronDown size={16} className={`ml-auto shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
                </button>
                {open && (
                  <div className="mt-3 space-y-2">
                    {day.movements.map((m) => (
                      <MovementRow key={m.id} movement={m} selected={classifying?.id === m.id} onClick={() => setClassifying(m)} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );

  // ── Suggestions tab ────────────────────────────────────────────────────────

  const suggestionsContent = (
    <>
      {suggestionsLoading ? (
        <div className="flex items-center justify-center py-20 text-stone-400 text-sm">
          A procurar sugestões…
        </div>
      ) : suggestionsCount === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="rounded-full bg-stone-100 p-4">
            <svg className="h-8 w-8 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>
          <p className="text-stone-600 font-medium">Sem sugestões para {monthName} {year}</p>
          <p className="text-stone-400 text-sm max-w-xs">
            Aparecem aqui faturas/contas a pagar que batem certo com um movimento, e movimentos recorrentes iguais a classificações de meses anteriores.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {suggestions!.entityMatches.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Faturas / contas a pagar ({suggestions!.entityMatches.length})
                </h3>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<IconCheck size={14} />}
                  disabled={bulkMut.isPending}
                  onClick={() =>
                    setConfirmBulk(
                      bulkReconcileItems(
                        suggestions!.entityMatches,
                        new Map([...movementsById.values()].map((m) => [m.id, m.amount])),
                      ),
                    )
                  }
                >
                  Conciliar todas ({suggestions!.entityMatches.length})
                </Button>
              </div>
              <div className="space-y-2">
                {suggestions!.entityMatches.map((s) => {
                  const movement = movementsById.get(s.movementId);
                  return (
                    <button
                      key={`${s.movementId}-${s.entityId}`}
                      onClick={() => openEntityMatchSuggestion(s)}
                      className="w-full flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#ED5C32]/30 hover:bg-[#FDF8F5]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-800">
                          {movement?.description ?? "Movimento"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-stone-500">
                          Corresponde a <span className="font-medium text-stone-700">{s.entityLabel}</span>
                          {movement && <> — {fromCents(movement.amount)}</>}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                        {Math.round(s.confidence * 100)}% confiança
                      </span>
                      <svg className="h-4 w-4 shrink-0 text-stone-300" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {suggestions!.repeatJustifications.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Movimentos recorrentes ({suggestions!.repeatJustifications.length})
              </h3>
              <div className="space-y-2">
                {suggestions!.repeatJustifications.map((s) => {
                  const movement = movementsById.get(s.movementId);
                  return (
                    <button
                      key={s.movementId}
                      onClick={() => openRepeatJustificationSuggestion(s)}
                      className="w-full flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#ED5C32]/30 hover:bg-[#FDF8F5]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-800">
                          {movement?.description ?? s.sourceDescription}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-stone-500">
                          Igual a {formatDay(s.sourceDate)} — classificado como{" "}
                          <span className="font-medium text-stone-700">
                            {JUSTIFICATION_TYPE_LABELS[s.justificationType]}
                          </span>
                          {s.notes && <> ({s.notes})</>}. Repetir?
                        </p>
                      </div>
                      <svg className="h-4 w-4 shrink-0 text-stone-300" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  // ── Header ─────────────────────────────────────────────────────────────────

  const crumbs: [string, (() => void) | null][] = [
    ["Bancos", () => navigate("/financial/bank-statements")],
    [bankDetail?.name ?? "…", () => navigate(`/financial/bank-statements/banks/${bankId}`)],
    [accountLabel, () => navigate(`/financial/bank-statements/banks/${bankId}/accounts/${accountId}`)],
    [`${monthName} ${year}`, null],
  ];
  const pendingCount = totalMovements - resolvedMovements;
  const net = totalCredit - totalDebit;

  const header = (
    <div className="shrink-0 space-y-5 px-4 pb-2 pt-6 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <nav aria-label="Localização" className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-secondary">
            {crumbs.map(([label, go], i) => (
              <Fragment key={i}>
                {i > 0 && <IconChevronRight size={12} className="text-ink-muted" />}
                {go ? (
                  <button type="button" onClick={go} className="hover:text-navy-900">{label}</button>
                ) : (
                  <span className="text-navy-900">{label}</span>
                )}
              </Fragment>
            ))}
          </nav>
          <h1 className={PAGE_TITLE}>{monthName} {year}</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {[accountDetail?.accountNumber ?? (accountDetail?.iban ? maskIban(accountDetail.iban) : null), bankDetail?.name, accountLabel].filter(Boolean).join("  •  ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button icon={<IconCalendar size={16} />} onClick={() => navigate(`/financial/bank-statements/banks/${bankId}/accounts/${accountId}`)}>
            Vista anual
          </Button>
          <Button variant="primary" icon={<AppIcon name="upload" size={16} />} onClick={() => setShowImport(true)}>
            Importar extrato
          </Button>
        </div>
      </header>

      {/* Com o painel aberto há menos largura: os indicadores passam a 3 por linha (6 só com a largura toda). */}
      <section
        aria-label="Resumo do mês"
        className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${drawerProps && isLargeScreen ? "min-[1900px]:grid-cols-6" : "xl:grid-cols-6"}`}
      >
        <KpiCard compact tone="neutral" icon={<IconFile size={18} />} label="Movimentos do mês" value={String(totalMovements)} />
        <KpiCard compact tone="green" icon={<IconCheck size={18} />} label="Conciliados" value={String(resolvedMovements)} valueClass="text-emerald-600" />
        <KpiCard compact tone="amber" icon={<IconClock size={18} />} label="Por conciliar" value={String(pendingCount)} valueClass={pendingCount > 0 ? "text-amber-600" : "text-navy-900"} />
        <KpiCard compact tone="green" icon={<IconArrowUp size={18} />} label="Entradas" value={`+${fromCents(totalCredit)}`} valueClass="text-emerald-600" />
        <KpiCard compact tone="red" icon={<IconArrowDown size={18} />} label="Saídas" value={`−${fromCents(totalDebit)}`} valueClass="text-red-600" />
        <KpiCard compact tone={net < 0 ? "red" : "navy"} icon={<IconChart size={18} />} label="Resultado líquido" value={`${net >= 0 ? "+" : "−"}${fromCents(Math.abs(net))}`} valueClass={net < 0 ? "text-red-600" : "text-emerald-600"} />
      </section>
    </div>
  );

  // Filtro dos movimentos: «Por conciliar» por defeito; ao clicar abre Todos / Entradas / Saídas / Transferências.
  const FILTERS: { key: MonthChip; label: string }[] = [
    { key: "pending", label: "Por conciliar" },
    { key: "all", label: "Todos" },
    { key: "inflows", label: "Entradas" },
    { key: "outflows", label: "Saídas" },
    { key: "transfers", label: "Transferências" },
  ];
  const activeChip: MonthChip = viewTab === "reconciled" && chip === "pending" ? "all" : chip;
  const filterOptions = FILTERS.filter((c) => viewTab === "movements" || c.key !== "pending");
  const activeFilterLabel = FILTERS.find((c) => c.key === activeChip)?.label ?? "Todos";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`flex h-screen flex-col overflow-hidden ${PAGE_BG}`}>
      <div className="flex flex-1 overflow-hidden">
        {/* Esquerda: cabeçalho, filtros e movimentos (rola) */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {header}
          <div className="space-y-4 px-4 pb-6 pt-3 sm:px-8">
            <div className={`${SURFACE} px-4 pt-2`}>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-subtle">
                <Tabs
                  label="Vista do mês"
                  value={viewTab}
                  onChange={setViewTab}
                  items={[
                    { key: "movements", label: "Movimentos" },
                    { key: "suggestions", label: "Sugestões", ...(suggestionsCount > 0 && { count: suggestionsCount }) },
                    { key: "reconciled", label: "Conciliados", count: resolvedMovements },
                  ]}
                />
              </div>
              {viewTab !== "suggestions" && (
                <div className="flex flex-wrap items-center gap-2 py-3">
                  <DropdownMenu
                    label="Filtrar movimentos"
                    align="left"
                    items={filterOptions.map((c) => ({
                      label: c.label,
                      icon: activeChip === c.key ? <IconCheck size={14} /> : <span className="inline-block w-3.5" />,
                      onSelect: () => setChip(c.key),
                    }))}
                    trigger={({ open, toggle }) => (
                      <button
                        type="button"
                        onClick={toggle}
                        aria-haspopup="menu"
                        aria-expanded={open}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-700"
                      >
                        {activeFilterLabel}
                        <IconChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  />
                  <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                    <SearchInput label="Pesquisar descrição ou valor" placeholder="Pesquisar descrição ou valor…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
                    <select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as MonthSort)} className={`${FIELD} h-9 w-auto pr-8`}>
                      <option value="priority">Mais prioritários</option>
                      <option value="date">Ordem do extrato</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {viewTab === "suggestions" ? suggestionsContent : timeline}
          </div>
          <PageFooter />
        </div>

        {/* Direita: painel de conciliação — só com um movimento selecionado; sem seleção a lista usa a largura toda. */}
        {isLargeScreen && drawerProps && (
          <aside className="flex w-[500px] shrink-0 flex-col overflow-hidden border-l border-line bg-surface-card motion-safe:animate-motion-fade">
            <ClassifyDrawer key={drawerProps.movement.id} inline {...drawerProps} />
          </aside>
        )}
      </div>

      {/* Ecrãs pequenos: painel em gaveta */}
      {!isLargeScreen && drawerProps && (
        <ClassifyDrawer key={drawerProps.movement.id} {...drawerProps} />
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

      <Dialog
        open={!!confirmBulk}
        title={`Conciliar ${confirmBulk?.length ?? 0} movimento${confirmBulk?.length === 1 ? "" : "s"}?`}
        description={
          confirmBulk && (
            <>
              Cada movimento fica conciliado com a fatura / conta a pagar sugerida (total{" "}
              {fromCents(confirmBulk.reduce((s, i) => s + i.amountCents, 0))}). Podes anular qualquer uma depois, no movimento.
            </>
          )
        }
        onClose={() => !bulkMut.isPending && setConfirmBulk(null)}
        actions={
          <>
            <Button onClick={() => setConfirmBulk(null)} disabled={bulkMut.isPending}>Cancelar</Button>
            <Button variant="primary" loading={bulkMut.isPending} onClick={() => confirmBulk && bulkMut.mutate(confirmBulk)}>
              Conciliar todas
            </Button>
          </>
        }
      />
      <ToastContainer toasts={toasts} />
    </div>
  );
}
