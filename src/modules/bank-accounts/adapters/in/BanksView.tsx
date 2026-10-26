import { useState, useEffect } from "react";
import { BankLogo } from "./BankLogo.tsx";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankAccountsModule } from "../../bank-accounts.module.tsx";
import type { BankDTO } from "../../domain/entities/bank-account.ts";
import {
  BANK_LOGO_KEYS,
  BANK_LOGO_LABELS,
  STATEMENT_FORMAT_LABELS,
  type BankLogoKey,
  type StatementFormat,
} from "../../domain/entities/bank-account.ts";
import { AccountFormDrawer } from "./BankAccountsView.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { useToast, ToastContainer } from "../../../../components/Toast.tsx";
import { AppIcon, Button, DropdownMenu, EmptyState, IconButton, IconCard, IconCheck, IconChevronRight, IconClock, IconClose, IconCopy, IconFile, IconInfo, IconMore, IconPlus, IconRepeat, NUMERIC, PAGE_BG, PAGE_TITLE, StatusBadge, SURFACE, TABLE, TR, IconBuilding } from "../../../../components/ui/index.ts";
import { formatEUR, formatIsoDatePt } from "../../../../lib/format.ts";
import { KpiCard } from "../../../bank-statements/adapters/in/BankUi.tsx";
import { maskIban } from "../../../bank-statements/domain/services/statement-account.ts";
import { shortMonthLabel } from "../../../bank-statements/domain/services/account-year.ts";
import { statementsOverview } from "../../../bank-statements/domain/services/statement-overview.ts";
import { ImportModal } from "../../../bank-statements/adapters/in/ImportModal.tsx";
import { useBankStatementsModule } from "../../../bank-statements/bank-statements.module.tsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Bank Form ─────────────────────────────────────────────────────────────────

const STATEMENT_FORMATS = Object.keys(
  STATEMENT_FORMAT_LABELS,
) as StatementFormat[];

const labelCls = "block text-xs font-medium text-stone-600 mb-1";
const inputCls =
  "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[#ED5C32] focus:outline-none";

function BankFormDrawer({
  open,
  initial,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: BankDTO;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    logoKey: BankLogoKey;
    color: string;
    country: string;
    bic: string | null;
    statementFormat: StatementFormat;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [logoKey, setLogoKey] = useState<BankLogoKey>(
    initial?.logoKey ?? "other",
  );
  const [color, setColor] = useState(initial?.color ?? "#A3211A");
  const [country, setCountry] = useState(initial?.country ?? "PT");
  const [bic, setBic] = useState(initial?.bic ?? "");
  const [format, setFormat] = useState<StatementFormat>(
    initial?.statementFormat ?? "generic_csv",
  );

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setLogoKey(initial.logoKey);
      setColor(initial.color);
      setCountry(initial.country);
      setBic(initial.bic ?? "");
      setFormat(initial.statementFormat);
    }
  }, [initial?.id]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      logoKey,
      color,
      country: country.trim().toUpperCase(),
      bic: bic.trim() || null,
      statementFormat: format,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl bg-white shadow-2xl md:rounded-2xl">
        <div className="border-b border-[#F5C992]/40 px-6 py-4">
          <h2 className="text-base font-bold text-stone-900">
            {initial ? "Editar banco" : "Adicionar banco"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="ex: Millennium BCP"
            />
          </div>

          <div>
            <label className={labelCls}>Logo / Banco</label>
            <select
              value={logoKey}
              onChange={(e) => setLogoKey(e.target.value as BankLogoKey)}
              className={inputCls}
            >
              {BANK_LOGO_KEYS.map((k) => (
                <option key={k} value={k}>
                  {BANK_LOGO_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cor</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-stone-300 p-0.5"
                />
                <BankLogo logoKey={logoKey} color={color} size="sm" />
                <span className="text-xs text-stone-500">{color}</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>País (ISO)</label>
              <input
                type="text"
                maxLength={2}
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="PT"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Formato de extrato</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as StatementFormat)}
              className={inputCls}
            >
              {STATEMENT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {STATEMENT_FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>BIC / SWIFT (opcional)</label>
            <input
              type="text"
              value={bic}
              onChange={(e) => setBic(e.target.value)}
              className={inputCls}
              placeholder="ex: BCOMPTPL"
            />
          </div>

          <div className="flex gap-3 border-t border-[#F5C992]/40 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "A guardar…" : initial ? "Guardar" : "Criar banco"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function BanksView() {
  const { api } = useBankAccountsModule();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toasts, show: showToast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<BankDTO | null>(null);
  const [creatingForBankId, setCreatingForBankId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const statementsApi = useBankStatementsModule().api;

  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["bank-accounts:banks"],
    queryFn: () => api.listBanks(),
  });

  // V2 (F3): importar sem escolher conta — o banco e a conta são reconhecidos ou criados pelo extrato.
  const importMut = useMutation({
    mutationFn: (fd: FormData) => statementsApi.importStatement(fd),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["bank-accounts:banks"] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
      setShowImport(false);
      const r = result.accountResolution;
      showToast(
        r?.status === "created"
          ? `Extrato importado: ${r.bankIsNew ? `banco «${r.bankName}» e ` : ""}conta «${r.accountName}» criados (${result.importedMovementsCount} movimentos).`
          : `Extrato importado: ${result.importedMovementsCount} movimentos${result.skippedDuplicates ? `, ${result.skippedDuplicates} já existiam` : ""}.`,
      );
      if (r?.bankId && r.accountId) navigate(`/financial/bank-statements/banks/${r.bankId}/accounts/${r.accountId}`);
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof api.createBank>[0]) =>
      api.createBank(payload),
    onSuccess: (bank) => {
      void qc.invalidateQueries({ queryKey: ["bank-accounts:banks"] });
      setShowCreate(false);
      showToast(`Banco "${bank.name}" criado com sucesso`);
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof api.updateBank>[1];
    }) => api.updateBank(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-accounts:banks"] });
      setEditing(null);
      showToast("Banco atualizado");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const createAccountMut = useMutation({
    mutationFn: ({
      bankId,
      payload,
    }: {
      bankId: string;
      payload: Parameters<typeof api.createAccount>[1];
    }) => api.createAccount(bankId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-accounts:banks"] });
      setCreatingForBankId(null);
      showToast("Conta criada com sucesso");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const statementsQuery = useQuery({
    queryKey: ["bank-statements", "overview"],
    queryFn: () => statementsApi.listStatements(),
  });
  const overview = statementsOverview(statementsQuery.data ?? [], new Date());
  const accountsCount = banks.reduce((s, b) => s + b.accountPreviews.length, 0);
  const [bannerOpen, setBannerOpen] = useState(true);

  const addAccountItems = [
    ...banks.map((b) => ({ label: `Conta em ${b.name}`, onSelect: () => setCreatingForBankId(b.id) })),
    { label: "Novo banco…", onSelect: () => setShowCreate(true) },
  ];

  return (
    <div className={`flex min-h-full flex-col ${PAGE_BG}`}>
      <div className="space-y-6 px-4 py-6 sm:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4 motion-safe:animate-motion-fade-up">
          <div>
            <h1 className={PAGE_TITLE}>Bancos</h1>
            <p className="mt-1.5 text-[15px] text-ink-secondary">Contas configuradas e extratos importados.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {banks.length === 0 ? (
              <Button icon={<IconPlus size={16} />} onClick={() => setShowCreate(true)}>Adicionar conta manualmente</Button>
            ) : (
              <DropdownMenu label="Adicionar conta" items={addAccountItems} trigger={({ toggle }) => <Button icon={<IconPlus size={16} />} onClick={toggle}>Adicionar conta manualmente</Button>} />
            )}
            <Button variant="primary" icon={<AppIcon name="upload" size={16} />} onClick={() => setShowImport(true)}>Importar extrato</Button>
          </div>
        </header>

        <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard tone="blue" icon={<IconBuilding size={22} />} label="Bancos" value={String(banks.length)} />
          <KpiCard tone="green" icon={<IconCard size={22} />} label="Contas" value={String(accountsCount)} />
          <KpiCard tone="amber" icon={<IconFile size={22} />} label="Extratos importados este mês" value={String(overview.importedThisMonth)} />
          <KpiCard tone="violet" icon={<IconClock size={22} />} label="Última importação" value={overview.lastImportAt ? formatIsoDatePt(overview.lastImportAt.slice(0, 10)) : "—"} />
        </section>

        {isLoading ? (
          <p className="py-16 text-center text-sm text-ink-secondary">A carregar bancos…</p>
        ) : banks.length === 0 ? (
          <div className={SURFACE}>
            <EmptyState
              icon={<IconBuilding size={28} />}
              title="Ainda não há bancos"
              description="Importe o primeiro extrato (PDF do Millennium BCP): o banco e a conta são criados automaticamente."
              action={<Button variant="primary" icon={<AppIcon name="upload" size={16} />} onClick={() => setShowImport(true)}>Importar extrato</Button>}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {banks.map((bank) => {
              const recognised = bank.statementFormat === "millennium_bcp_pdf";
              return (
                <section key={bank.id} className={`${SURFACE} overflow-hidden`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="flex items-center gap-4">
                      <BankLogo logoKey={bank.logoKey} color={bank.color} size="lg" name={bank.name} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-navy-900">{bank.name}</h2>
                          {recognised ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                              <IconCheck size={12} /> Parser reconhecido
                            </span>
                          ) : (
                            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">{STATEMENT_FORMAT_LABELS[bank.statementFormat]}</span>
                          )}
                        </div>
                        <p className="text-[13px] text-ink-secondary">
                          {bank.accountPreviews.length} {bank.accountPreviews.length === 1 ? "conta configurada" : "contas configuradas"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" onClick={() => navigate(`/financial/bank-statements/banks/${bank.id}`)}>
                        Ver contas <IconChevronRight size={14} />
                      </Button>
                      <DropdownMenu
                        label={`Ações de ${bank.name}`}
                        items={[
                          { label: "Movimentos recorrentes", icon: <IconRepeat size={14} />, onSelect: () => navigate(`/financial/bank-statements/banks/${bank.id}/recurring`) },
                          "separator",
                          { label: "Adicionar conta", icon: <IconPlus size={14} />, onSelect: () => setCreatingForBankId(bank.id) },
                          { label: "Editar banco", icon: <AppIcon name="edit" size={14} />, onSelect: () => setEditing(bank) },
                        ]}
                        trigger={({ toggle }) => (
                          <IconButton label={`Ações de ${bank.name}`} onClick={toggle}>
                            <IconMore size={16} />
                          </IconButton>
                        )}
                      />
                    </div>
                  </div>

                  {bank.accountPreviews.length === 0 ? (
                    <p className="border-t border-line-subtle px-5 py-4 text-sm text-ink-secondary">Sem contas configuradas.</p>
                  ) : (
                    <div className="overflow-x-auto px-3 pb-3">
                      <table className={TABLE}>
                        <thead className="bg-surface-soft/70">
                          <tr>
                            {["Conta", "IBAN / Número", "Moeda", "Último extrato", "Saldo mais recente", "Estado"].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-secondary first:rounded-l-lg">{h}</th>
                            ))}
                            <th className="rounded-r-lg" aria-label="Abrir" />
                          </tr>
                        </thead>
                        <tbody>
                          {bank.accountPreviews.map((preview) => {
                            const isCard = preview.type === "credit_card";
                            const last = overview.byAccount.get(preview.id);
                            const name = preview.nickname ?? (isCard ? (preview.lastFourDigits ? `Cartão •••• ${preview.lastFourDigits}` : "Cartão") : "Conta");
                            const ident = isCard ? (preview.lastFourDigits ? `•••• •••• •••• ${preview.lastFourDigits}` : "—") : preview.iban ? maskIban(preview.iban) : (preview.accountNumber ?? "—");
                            const copyValue = isCard ? null : (preview.iban ?? preview.accountNumber);
                            return (
                              <tr
                                key={preview.id}
                                onClick={() => navigate(`/financial/bank-statements/banks/${bank.id}/accounts/${preview.id}`)}
                                className={`${TR} cursor-pointer ${preview.isActive ? "" : "opacity-60"}`}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isCard ? "bg-violet-50 text-violet-600" : "bg-sky-50 text-sky-600"}`}>
                                      {isCard ? <IconCard size={18} /> : <IconBuilding size={18} />}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold text-navy-900">{name}</p>
                                      <p className="text-xs text-ink-secondary">{isCard ? "Cartão de crédito" : "Conta à ordem"}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-2 text-ink ${NUMERIC}`}>
                                    {ident}
                                    {copyValue && (
                                      <button
                                        type="button"
                                        aria-label="Copiar IBAN / número"
                                        className="rounded p-1 text-ink-muted hover:bg-surface-soft hover:text-navy-900"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void navigator.clipboard?.writeText(copyValue).then(() => showToast("Copiado"));
                                        }}
                                      >
                                        <IconCopy size={14} />
                                      </button>
                                    )}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-ink">EUR</td>
                                <td className="px-4 py-3">
                                  {last ? (
                                    <>
                                      <p className="text-ink">{shortMonthLabel(last.periodEnd)}</p>
                                      <p className="text-xs text-ink-secondary">{last.movementsCount} movimentos</p>
                                    </>
                                  ) : (
                                    <span className="text-ink-muted">—</span>
                                  )}
                                </td>
                                <td className={`px-4 py-3 font-semibold ${NUMERIC} ${last ? (last.closingBalanceCents < 0 ? "text-red-600" : "text-navy-900") : "text-ink-muted"}`}>
                                  {last ? formatEUR(last.closingBalanceCents / 100) : "—"}
                                </td>
                                <td className="px-4 py-3">
                                  {!preview.isActive ? (
                                    <StatusBadge tone="neutral">Inativa</StatusBadge>
                                  ) : last ? (
                                    <StatusBadge tone="success">Extrato importado</StatusBadge>
                                  ) : (
                                    <StatusBadge tone="neutral">Sem extratos</StatusBadge>
                                  )}
                                </td>
                                <td className="px-2 py-3 text-right text-ink-muted">
                                  <IconChevronRight size={16} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {bannerOpen && (
          <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white"><IconInfo size={14} /></span>
            <p className="flex-1">O Mezza cria automaticamente o banco e a conta ao importar o primeiro extrato reconhecido.</p>
            <button type="button" aria-label="Fechar aviso" onClick={() => setBannerOpen(false)} className="rounded p-1 text-sky-700 hover:bg-sky-100">
              <IconClose size={14} />
            </button>
          </div>
        )}
      </div>
      <ImportModal open={showImport} saving={importMut.isPending} onClose={() => setShowImport(false)} onSubmit={(fd) => importMut.mutate(fd)} />

      <PageFooter />

      <BankFormDrawer
        open={showCreate}
        saving={createMut.isPending}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMut.mutate(data)}
      />

      {editing && (
        <BankFormDrawer
          open
          initial={editing}
          saving={updateMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(data) =>
            updateMut.mutate({ id: editing.id, payload: data })
          }
        />
      )}

      {creatingForBankId && (
        <AccountFormDrawer
          open
          saving={createAccountMut.isPending}
          onClose={() => setCreatingForBankId(null)}
          onSubmit={(data) =>
            createAccountMut.mutate({ bankId: creatingForBankId, payload: data })
          }
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
