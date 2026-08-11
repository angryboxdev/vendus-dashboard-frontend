import { useState } from "react";
import { NumericInput } from "../../../../components/NumericInput.tsx";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankAccountsModule } from "../../bank-accounts.module.tsx";
import type { BankAccountDTO } from "../../domain/entities/bank-account.ts";
import {
  BANK_LOGO_ABBREVS,
  type BankAccountType,
  type CheckingAccountType,
} from "../../domain/entities/bank-account.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { useToast, ToastContainer } from "../../../../components/Toast.tsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
  });
}

const labelCls = "block text-xs font-medium text-stone-600 mb-1";
const inputCls =
  "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[#ED5C32] focus:outline-none";

// ── Account Card ──────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onClick,
  onEdit,
  onDelete,
}: {
  account: BankAccountDTO;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCard = account.type === "credit_card";
  const label =
    account.nickname ??
    (isCard
      ? (account.cardName ?? `Cartão …${account.lastFourDigits ?? ""}`)
      : (account.iban ?? account.accountNumber ?? "Conta sem identificador"));

  const sub = isCard
    ? account.lastFourDigits
      ? `**** **** **** ${account.lastFourDigits}`
      : null
    : (account.iban ?? account.accountNumber);

  return (
    <div
      className="group relative cursor-pointer rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* type icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            isCard ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600"
          }`}
        >
          {isCard ? (
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6zM3 13.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm4.75-.75a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm7 5a1 1 0 10-2 0v1H8a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V9z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-stone-900">{label}</p>
            {!account.isActive && (
              <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-400">
                Inativa
              </span>
            )}
          </div>
          {sub && (
            <p className="mt-0.5 font-mono text-xs text-stone-500">{sub}</p>
          )}
          <div className="mt-1 flex gap-2">
            {isCard && account.creditLimitCents != null && (
              <span className="text-xs text-stone-400">
                Limite: {fromCents(account.creditLimitCents)}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isCard
                  ? "bg-violet-50 text-violet-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              {isCard ? "Cartão" : "Conta"}
            </span>
          </div>
        </div>

        <svg
          className="h-4 w-4 shrink-0 text-stone-300 transition-colors group-hover:text-[#ED5C32]"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Actions */}
      <div
        className="absolute right-3 top-3 hidden gap-1 group-hover:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          title="Editar conta"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500"
          title="Eliminar conta"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Account Form ──────────────────────────────────────────────────────────────

export function AccountFormDrawer({
  open,
  initial,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: BankAccountDTO;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: BankAccountType;
    nickname: string | null;
    iban: string | null;
    accountNumber: string | null;
    accountType: CheckingAccountType | null;
    lastFourDigits: string | null;
    cardName: string | null;
    creditLimitCents: number | null;
    billingCycleDay: number | null;
    isActive?: boolean;
  }) => void;
}) {
  const [type, setType] = useState<BankAccountType>(initial?.type ?? "account");
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [iban, setIban] = useState(initial?.iban ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initial?.accountNumber ?? "",
  );
  const [accountType, setAccountType] = useState<CheckingAccountType>(
    initial?.accountType ?? "corrente",
  );
  const [lastFourDigits, setLastFourDigits] = useState(
    initial?.lastFourDigits ?? "",
  );
  const [cardName, setCardName] = useState(initial?.cardName ?? "");
  const [creditLimit, setCreditLimit] = useState(
    initial?.creditLimitCents != null
      ? (initial.creditLimitCents / 100).toFixed(2)
      : "",
  );
  const [billingDay, setBillingDay] = useState(
    initial?.billingCycleDay?.toString() ?? "",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      type,
      nickname: nickname.trim() || null,
      iban: type === "account" ? iban.trim() || null : null,
      accountNumber: type === "account" ? accountNumber.trim() || null : null,
      accountType: type === "account" ? accountType : null,
      lastFourDigits:
        type === "credit_card" ? lastFourDigits.trim() || null : null,
      cardName: type === "credit_card" ? cardName.trim() || null : null,
      creditLimitCents:
        type === "credit_card" && creditLimit
          ? Math.round(parseFloat(creditLimit.replace(",", ".")) * 100)
          : null,
      billingCycleDay:
        type === "credit_card" && billingDay ? parseInt(billingDay, 10) : null,
      ...(initial ? { isActive } : {}),
    });
  }

  const isCard = type === "credit_card";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl bg-white shadow-2xl md:rounded-2xl">
        <div className="border-b border-[#F5C992]/40 px-6 py-4">
          <h2 className="text-base font-bold text-stone-900">
            {initial ? "Editar conta" : "Adicionar conta"}
          </h2>
        </div>
        <form
          onSubmit={handleSubmit}
          className="max-h-[80vh] space-y-4 overflow-y-auto px-6 py-4"
        >
          {/* Type toggle */}
          {!initial && (
            <div>
              <label className={labelCls}>Tipo</label>
              <div className="flex gap-2">
                {(
                  [
                    ["account", "Conta bancária"],
                    ["credit_card", "Cartão de crédito"],
                  ] as [BankAccountType, string][]
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setType(v)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      type === v
                        ? "border-[#ED5C32] bg-[#FDF8F5] text-[#ED5C32]"
                        : "border-stone-200 text-stone-500 hover:border-stone-300"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Alcunha / Apelido (opcional)</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={inputCls}
              placeholder={
                isCard ? "ex: Cartão pessoal" : "ex: Conta corrente principal"
              }
            />
          </div>

          {!isCard && (
            <>
              <div>
                <label className={labelCls}>IBAN</label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  className={inputCls}
                  placeholder="PT50..."
                />
              </div>
              <div>
                <label className={labelCls}>
                  Nº de conta (alternativo ao IBAN)
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className={inputCls}
                  placeholder="ex: 00123456789"
                />
              </div>
              <div>
                <label className={labelCls}>Tipo de conta</label>
                <select
                  value={accountType}
                  onChange={(e) =>
                    setAccountType(e.target.value as CheckingAccountType)
                  }
                  className={inputCls}
                >
                  <option value="corrente">À ordem</option>
                  <option value="poupança">Poupança</option>
                  <option value="ordenado">Ordenado</option>
                </select>
              </div>
            </>
          )}

          {isCard && (
            <>
              <div>
                <label className={labelCls}>Nome no cartão</label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className={inputCls}
                  placeholder="ex: JOAO A SILVA"
                />
              </div>
              <div>
                <label className={labelCls}>Últimos 4 dígitos</label>
                <input
                  type="text"
                  maxLength={4}
                  value={lastFourDigits}
                  onChange={(e) =>
                    setLastFourDigits(e.target.value.replace(/\D/g, ""))
                  }
                  className={inputCls}
                  placeholder="1234"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Limite de crédito (€)</label>
                  <NumericInput
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className={inputCls}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Dia de fecho (1–31)</label>
                  <NumericInput
                    decimals={0}
                    value={billingDay}
                    onChange={(e) => setBillingDay(e.target.value)}
                    className={inputCls}
                    placeholder="25"
                  />
                </div>
              </div>
            </>
          )}

          {initial && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-[#ED5C32]"
              />
              <label htmlFor="isActive" className="text-sm text-stone-700">
                Conta ativa
              </label>
            </div>
          )}

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
              {saving ? "A guardar…" : initial ? "Guardar" : "Criar conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function BankAccountsView() {
  const { bankId } = useParams<{ bankId: string }>();
  const { api } = useBankAccountsModule();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toasts, show: showToast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<BankAccountDTO | null>(null);

  const { data: bank, isLoading } = useQuery({
    queryKey: ["bank-accounts:bank", bankId],
    queryFn: () => api.getBank(bankId!),
    enabled: !!bankId,
  });

  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof api.createAccount>[1]) =>
      api.createAccount(bankId!, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-accounts:bank", bankId] });
      void qc.invalidateQueries({ queryKey: ["bank-accounts:banks"] });
      setShowCreate(false);
      showToast("Conta criada com sucesso");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof api.updateAccount>[1];
    }) => api.updateAccount(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-accounts:bank", bankId] });
      setEditing(null);
      showToast("Conta atualizada");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteAccount(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-accounts:bank", bankId] });
      void qc.invalidateQueries({ queryKey: ["bank-accounts:banks"] });
      showToast("Conta eliminada");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  function handleDelete(account: BankAccountDTO) {
    const label =
      account.nickname ?? account.iban ?? account.accountNumber ?? "esta conta";
    if (
      !window.confirm(
        `Eliminar "${label}"? Apenas é possível se não tiver extratos.`,
      )
    )
      return;
    deleteMut.mutate(account.id);
  }

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/financial/bank-statements")}
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700"
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
            {bank && (
              <>
                <span className="text-stone-300">/</span>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                    style={{ backgroundColor: bank.color }}
                  >
                    {BANK_LOGO_ABBREVS[bank.logoKey]}
                  </div>
                  <h1 className="text-xl font-bold text-stone-900">
                    {bank.name}
                  </h1>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex shrink-0 items-center gap-2 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Adicionar conta
          </button>
        </div>
        {!isLoading && bank && (
          <p className="mt-1 text-sm text-stone-500">
            {bank.accounts.length === 0
              ? "Sem contas — adiciona a primeira"
              : bank.accounts.length === 1
                ? "1 conta / cartão"
                : `${bank.accounts.length} contas / cartões`}
          </p>
        )}
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-stone-400">
            A carregar contas…
          </div>
        ) : !bank ? (
          <div className="py-16 text-center text-sm text-stone-400">
            Banco não encontrado.
          </div>
        ) : bank.accounts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="mb-1 text-sm font-medium text-stone-700">
              Nenhuma conta configurada
            </p>
            <p className="mb-6 text-sm text-stone-400">
              Adiciona uma conta ou cartão para começar a importar extratos.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Adicionar primeira conta
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {bank.accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onClick={() =>
                  navigate(
                    `/financial/bank-statements/banks/${bankId}/accounts/${account.id}`,
                  )
                }
                onEdit={() => setEditing(account)}
                onDelete={() => handleDelete(account)}
              />
            ))}
          </div>
        )}
      </div>

      <PageFooter />

      <AccountFormDrawer
        open={showCreate}
        saving={createMut.isPending}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMut.mutate(data)}
      />

      {editing && (
        <AccountFormDrawer
          open
          initial={editing}
          saving={updateMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(data) =>
            updateMut.mutate({ id: editing.id, payload: data })
          }
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
