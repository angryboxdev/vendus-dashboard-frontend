import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBankStatementsModule } from "../../bank-statements.module.tsx";
import { useBankAccountsModule } from "../../../bank-accounts/bank-accounts.module.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { useToast, ToastContainer } from "../../../../components/Toast.tsx";
import { formatEUR, formatIsoDatePt } from "../../../../lib/format.ts";
import {
  Button,
  Dialog,
  Drawer,
  DropdownMenu,
  EmptyState,
  FIELD,
  IconButton,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconInfo,
  IconMore,
  IconRepeat,
  LABEL,
  NUMERIC,
  PAGE_BG,
  PAGE_TITLE,
  SearchInput,
  SegmentedControl,
  StatusBadge,
  SURFACE,
} from "../../../../components/ui/index.ts";
import { KpiCard } from "./BankUi.tsx";
import { BankLogo } from "../../../bank-accounts/adapters/in/BankLogo.tsx";
import {
  JUSTIFICATION_TYPE_LABELS,
  type JustificationType,
  type ReconciliationRuleDTO,
  type UpdateRulePayload,
} from "../../domain/entities/bank-statement.ts";
import { canBeRecurring, recurringMatchPreview } from "../../domain/services/recurring-rule.ts";
import {
  filterRules,
  groupRulesByAccount,
  parseEuroToCents,
  ruleAmountLabel,
  summarizeRules,
  type RuleStatusFilter,
} from "../../domain/services/recurring-rules-overview.ts";

const RULE_JUSTIFICATIONS = (Object.keys(JUSTIFICATION_TYPE_LABELS) as JustificationType[]).filter(canBeRecurring);
const VAT_RATES = [6, 13, 23];

/**
 * «Movimentos recorrentes» de um banco (cada banco tem a sua nomenclatura e as suas despesas): as regras
 * que conciliam sozinhas taxas TPA, despesas bancárias e outros movimentos sem fatura nas contas desse
 * banco. Criam-se no painel do movimento («Classificar sempre assim»); aqui editam-se, pausam-se e apagam-se.
 * Abre-se no menu «⋯» do banco na página Bancos.
 */
export function RecurringMovementsView() {
  const { bankId } = useParams<{ bankId: string }>();
  const { api } = useBankStatementsModule();
  const bankAccountsApi = useBankAccountsModule().api;
  const fbApi = useFinancialBaseModule().api;
  const qc = useQueryClient();
  const { toasts, show: showToast } = useToast();

  const [status, setStatus] = useState<RuleStatusFilter>("active");
  const [accountId, setAccountId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ReconciliationRuleDTO | null>(null);
  const [deleting, setDeleting] = useState<ReconciliationRuleDTO | null>(null);

  const { data: rules = [], isLoading, isError, error, refetch } = useQuery({ queryKey: ["bank-rules"], queryFn: () => api.listRules() });
  const { data: banks = [] } = useQuery({ queryKey: ["bank-accounts:banks"], queryFn: () => bankAccountsApi.listBanks() });
  const { data: groups = [] } = useQuery({
    queryKey: ["cost-center-groups"],
    queryFn: () => fbApi.listCostCenterGroups({ isActive: true }),
    staleTime: 300_000,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["cost-center-categories", "all"],
    queryFn: () => fbApi.listCostCenterCategories({ isActive: true }),
    staleTime: 300_000,
  });

  const bank = banks.find((b) => b.id === bankId);
  const accounts = useMemo(() => (bank?.accountPreviews ?? []).map((a) => ({ id: a.id, label: a.label })), [bank]);
  const bankAccountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);
  const accountLabel = (id: string) => accounts.find((a) => a.id === id)?.label ?? "Conta";
  const bankRules = useMemo(
    () => (bank ? filterRules(rules, { status: "all", accountId: null, search: "", bankAccountIds }) : []),
    [rules, bank, bankAccountIds],
  );
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const summary = summarizeRules(bankRules);
  const visible = groupRulesByAccount(filterRules(bankRules, { status, accountId: accountId || null, search }), accountLabel);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["bank-rules"] });
    void qc.invalidateQueries({ queryKey: ["bank-month"] });
    void qc.invalidateQueries({ queryKey: ["bank-calendar"] });
    void qc.invalidateQueries({ queryKey: ["bank-month-suggestions"] });
  };

  const updateMut = useMutation({
    mutationFn: (args: { id: string; payload: UpdateRulePayload }) => api.updateRule(args.id, args.payload),
    onSuccess: (rule, args) => {
      invalidate();
      setEditing(null);
      const n = rule.appliedCount;
      const what =
        args.payload.isActive === false ? "pausado" : args.payload.isActive === true ? "reativado" : "guardado";
      showToast(
        n > 0
          ? `«${rule.name}» ${what} — ${n} movimento${n === 1 ? "" : "s"} por classificar conciliado${n === 1 ? "" : "s"}`
          : `«${rule.name}» ${what}`,
      );
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteRule(id),
    onSuccess: () => {
      invalidate();
      showToast(`Movimento recorrente «${deleting?.name ?? ""}» apagado`);
      setDeleting(null);
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  return (
    <div className={`flex min-h-full flex-col ${PAGE_BG}`}>
      <div className="space-y-6 px-4 py-6 sm:px-8">
        <header className="space-y-2 motion-safe:animate-motion-fade-up">
          <nav aria-label="Caminho" className="flex items-center gap-1.5 text-[13px] text-ink-secondary">
            <Link to="/financial/bank-statements" className="hover:text-navy-900">Bancos</Link>
            <IconChevronRight size={12} />
            {bank && (
              <>
                <Link to={`/financial/bank-statements/banks/${bank.id}`} className="hover:text-navy-900">{bank.name}</Link>
                <IconChevronRight size={12} />
              </>
            )}
            <span className="text-navy-900">Movimentos recorrentes</span>
          </nav>
          <div className="flex items-center gap-4">
            {bank && <BankLogo logoKey={bank.logoKey} color={bank.color} size="lg" name={bank.name} />}
            <div>
              <h1 className={PAGE_TITLE}>Movimentos recorrentes</h1>
              {bank && <p className="text-[15px] font-medium text-navy-900">{bank.name}</p>}
            </div>
          </div>
          <p className="max-w-3xl text-[15px] text-ink-secondary">
            Taxas TPA, despesas bancárias e outros movimentos sem fatura que se repetem neste banco: ficam conciliados
            sozinhos ao importar o extrato, com a classificação que lhes deste uma vez.
          </p>
        </header>

        <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-3">
          <KpiCard tone="violet" icon={<IconRepeat size={22} />} label="Ativos" value={String(summary.active)} />
          <KpiCard tone="green" icon={<IconCheck size={22} />} label="Movimentos conciliados automaticamente" value={String(summary.autoMovements)} />
          <KpiCard tone="neutral" icon={<IconClock size={22} />} label="Em pausa" value={String(summary.paused)} />
        </section>

        <section className={`${SURFACE} p-4 sm:p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              label="Estado"
              size="sm"
              value={status}
              onChange={setStatus}
              items={[
                { key: "active", label: `Ativos (${summary.active})` },
                { key: "paused", label: `Em pausa (${summary.paused})` },
                { key: "all", label: "Todos" },
              ]}
            />
            {accounts.length > 1 && (
            <select aria-label="Conta" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${FIELD} w-auto min-w-[14rem]`}>
              <option value="">Todas as contas do banco</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            )}
            <SearchInput label="Pesquisar nome ou descrição" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-[16rem] flex-1" />
          </div>
        </section>

        {isLoading || (!bank && banks.length === 0) ? (
          <p className="py-16 text-center text-sm text-ink-secondary">A carregar…</p>
        ) : isError ? (
          <section className={SURFACE}>
            <EmptyState
              icon={<IconInfo size={28} />}
              title="Não foi possível carregar os movimentos recorrentes"
              description={error instanceof Error ? error.message : "Erro desconhecido."}
              action={<Button onClick={() => void refetch()}>Tentar de novo</Button>}
            />
          </section>
        ) : visible.length === 0 ? (
          <section className={SURFACE}>
            <EmptyState
              icon={<IconRepeat size={28} />}
              title={bankRules.length === 0 ? `Ainda não há movimentos recorrentes${bank ? ` no ${bank.name}` : ""}` : "Nenhum movimento recorrente com estes filtros"}
              description={
                bankRules.length === 0
                  ? "Abre um movimento por conciliar (ex.: uma taxa TPA), classifica-o em «Justificar despesa» e marca «Classificar sempre assim»."
                  : "Muda o estado, a conta ou a pesquisa."
              }
            />
          </section>
        ) : (
          visible.map((g) => (
            <section key={g.accountId ?? "all"} className={`${SURFACE} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-line-subtle px-5 py-3">
                <h2 className="text-sm font-semibold text-navy-900">{g.label}</h2>
                <span className="text-xs text-ink-secondary">{g.rules.length} regra{g.rules.length === 1 ? "" : "s"}</span>
              </div>
              <ul className="divide-y divide-line-subtle">
                {g.rules.map((r) => (
                  <RuleRow
                    key={r.id}
                    rule={r}
                    category={[r.costCenterGroupId && groupName.get(r.costCenterGroupId), r.costCenterCategoryId && categoryName.get(r.costCenterCategoryId)]
                      .filter(Boolean)
                      .join(" › ")}
                    busy={updateMut.isPending || deleteMut.isPending}
                    onEdit={() => setEditing(r)}
                    onToggle={() =>
                      updateMut.mutate({ id: r.id, payload: r.isActive ? { isActive: false } : { isActive: true, applyToExisting: true } })
                    }
                    onDelete={() => setDeleting(r)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}

        <p className="flex items-center gap-1.5 text-[13px] text-ink-secondary">
          <IconInfo size={14} /> As regras só tocam em movimentos por classificar: nunca mudam o que classificaste à mão nem
          os movimentos conciliados com fatura.
        </p>
      </div>

      <PageFooter />

      {editing && (
        <RuleEditDrawer
          key={editing.id}
          rule={editing}
          groups={groups}
          saving={updateMut.isPending}
          onClose={() => setEditing(null)}
          onSave={(payload) => updateMut.mutate({ id: editing.id, payload })}
        />
      )}

      <Dialog
        open={!!deleting}
        title="Apagar movimento recorrente?"
        description={
          deleting && (
            <>
              «{deleting.name}» deixa de conciliar os próximos movimentos. Os {deleting.usage?.movementsCount ?? 0} movimentos já
              conciliados mantêm a classificação.
            </>
          )
        }
        onClose={() => setDeleting(null)}
        actions={
          <>
            <Button onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleting && deleteMut.mutate(deleting.id)}>
              Apagar
            </Button>
          </>
        }
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
}

function RuleRow({
  rule,
  category,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  rule: ReconciliationRuleDTO;
  category: string;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const uses = rule.usage?.movementsCount ?? 0;
  return (
    <li className={`flex flex-wrap items-center gap-4 px-5 py-4 ${rule.isActive ? "" : "opacity-70"}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${rule.isActive ? "bg-violet-50 text-violet-600" : "bg-surface-soft text-ink-muted"}`}>
        <IconRepeat size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-navy-900">{rule.name}</p>
          {rule.isActive ? <StatusBadge tone="success">Ativo</StatusBadge> : <StatusBadge tone="neutral">Em pausa</StatusBadge>}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-ink-secondary">
          Reconhece «{recurringMatchPreview(rule.descriptionContains) || rule.descriptionContains}»
          {rule.movementType === "credit" ? " · entradas" : rule.movementType === "debit" ? " · saídas" : ""}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted">
          <span>{JUSTIFICATION_TYPE_LABELS[rule.justificationType]}</span>
          {category && <span>{category}</span>}
          <span className={NUMERIC}>{ruleAmountLabel(rule, (cents) => formatEUR(cents / 100))}</span>
          {rule.vatRate != null && <span>IVA {rule.vatRate}%{rule.vatIncluded ? " incluído" : ""}</span>}
        </p>
      </div>
      <div className="w-44 shrink-0 text-right">
        <p className={`text-sm font-semibold text-navy-900 ${NUMERIC}`}>
          {uses} movimento{uses === 1 ? "" : "s"}
        </p>
        <p className="text-xs text-ink-muted">
          {rule.usage?.lastBookingDate ? `último ${formatIsoDatePt(rule.usage.lastBookingDate)}` : "ainda sem movimentos"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={onEdit} disabled={busy}>Editar</Button>
        <DropdownMenu
          label={`Mais ações para ${rule.name}`}
          items={[
            { label: rule.isActive ? "Pausar" : "Reativar e aplicar aos por classificar", onSelect: onToggle, disabled: busy },
            "separator",
            { label: "Apagar", onSelect: onDelete, danger: true, disabled: busy },
          ]}
          trigger={({ toggle }) => (
            <IconButton label="Mais ações" size="sm" onClick={toggle}>
              <IconMore size={16} />
            </IconButton>
          )}
        />
      </div>
    </li>
  );
}

function RuleEditDrawer({
  rule,
  groups,
  saving,
  onClose,
  onSave,
}: {
  rule: ReconciliationRuleDTO;
  groups: Array<{ id: string; name: string }>;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: UpdateRulePayload) => void;
}) {
  const fbApi = useFinancialBaseModule().api;
  const [name, setName] = useState(rule.name);
  const [text, setText] = useState(rule.descriptionContains);
  const [justification, setJustification] = useState<JustificationType>(
    canBeRecurring(rule.justificationType) ? rule.justificationType : "despesa_bancaria_automatica",
  );
  const [groupId, setGroupId] = useState(rule.costCenterGroupId ?? "");
  const [categoryId, setCategoryId] = useState(rule.costCenterCategoryId ?? "");
  const [fixed, setFixed] = useState(rule.amountCents !== null);
  const [amount, setAmount] = useState(rule.amountCents !== null ? (rule.amountCents / 100).toFixed(2).replace(".", ",") : "");
  const [tolerance, setTolerance] = useState((rule.amountToleranceCents / 100).toFixed(2).replace(".", ","));
  const [vat, setVat] = useState<string>(rule.vatRate != null ? `${rule.vatRate}|${rule.vatIncluded ? "in" : "ex"}` : "");
  const [applyToExisting, setApplyToExisting] = useState(true);

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-center-categories", groupId],
    queryFn: () => fbApi.listCostCenterCategories({ groupId, isActive: true }),
    enabled: !!groupId,
    staleTime: 300_000,
  });

  const preview = recurringMatchPreview(text);
  const amountCents = fixed ? parseEuroToCents(amount) : null;
  const toleranceCents = parseEuroToCents(tolerance);
  const errors = [
    !name.trim() ? "nome" : null,
    !preview ? "texto reconhecido (precisa de palavras sem números)" : null,
    fixed && amountCents === null ? "valor" : null,
    fixed && toleranceCents === null ? "margem" : null,
  ].filter((x): x is string => x !== null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (errors.length > 0) return;
    const [rate, inc] = vat ? vat.split("|") : [];
    onSave({
      name: name.trim(),
      descriptionContains: text.trim(),
      justificationType: justification,
      costCenterGroupId: groupId || null,
      costCenterCategoryId: groupId ? categoryId || null : null,
      amountCents,
      ...(fixed && toleranceCents !== null && { amountToleranceCents: toleranceCents }),
      vatRate: rate ? Number(rate) : null,
      vatIncluded: rate ? inc === "in" : null,
      applyToExisting: rule.isActive && applyToExisting,
    });
  }

  return (
    <Drawer
      open
      as="form"
      onSubmit={submit}
      title="Editar movimento recorrente"
      description="As alterações valem para os próximos movimentos; os já conciliados ficam como estão."
      onClose={onClose}
      width="max-w-lg"
      footer={
        <div className="flex w-full flex-col gap-2">
          {errors.length > 0 && <p className="text-xs text-amber-700">Falta: {errors.join(", ")}.</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={saving} disabled={errors.length > 0}>Guardar</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL} htmlFor="rule-name">Nome</label>
          <input id="rule-name" className={`${FIELD} w-full`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="rule-text">Descrição do banco</label>
          <input id="rule-text" className={`${FIELD} w-full`} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="mt-1.5 text-xs text-ink-secondary">
            Reconhece movimentos com <span className="font-semibold text-navy-900">«{preview || "—"}»</span> (números e referências são ignorados).
          </p>
        </div>
        <div>
          <label className={LABEL} htmlFor="rule-just">Justificação</label>
          <select id="rule-just" className={`${FIELD} w-full`} value={justification} onChange={(e) => setJustification(e.target.value as JustificationType)}>
            {RULE_JUSTIFICATIONS.map((j) => (
              <option key={j} value={j}>{JUSTIFICATION_TYPE_LABELS[j]}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="rule-group">Categoria</label>
            <select id="rule-group" className={`${FIELD} w-full`} value={groupId} onChange={(e) => { setGroupId(e.target.value); setCategoryId(""); }}>
              <option value="">Sem categoria</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="rule-cat">Subcategoria</label>
            <select id="rule-cat" className={`${FIELD} w-full`} value={categoryId} disabled={!groupId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{groupId ? "Sem subcategoria" : "Escolhe a categoria"}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <p className={LABEL}>Valor</p>
          <SegmentedControl
            label="Valor"
            size="sm"
            value={fixed ? "fixed" : "any"}
            onChange={(k) => setFixed(k === "fixed")}
            items={[{ key: "any", label: "Qualquer valor" }, { key: "fixed", label: "Valor fixo" }]}
          />
          {fixed && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor="rule-amount">Valor (€)</label>
                <input id="rule-amount" inputMode="decimal" className={`${FIELD} w-full ${NUMERIC}`} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className={LABEL} htmlFor="rule-tol">Margem (± €)</label>
                <input id="rule-tol" inputMode="decimal" className={`${FIELD} w-full ${NUMERIC}`} value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <div>
          <label className={LABEL} htmlFor="rule-vat">IVA</label>
          <select id="rule-vat" className={`${FIELD} w-full`} value={vat} onChange={(e) => setVat(e.target.value)}>
            <option value="">Isento / não aplicável</option>
            {VAT_RATES.flatMap((r) => [
              <option key={`${r}in`} value={`${r}|in`}>{r}% incluído</option>,
              <option key={`${r}ex`} value={`${r}|ex`}>{r}% não incluído</option>,
            ])}
          </select>
        </div>
        {rule.isActive && (
          <label className="flex items-start gap-2 text-sm text-ink-secondary">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-500" checked={applyToExisting} onChange={(e) => setApplyToExisting(e.target.checked)} />
            Aplicar já aos movimentos por classificar desta conta nos meses importados
          </label>
        )}
      </div>
    </Drawer>
  );
}
