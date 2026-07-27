import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankAccountsModule } from "../../bank-accounts.module.tsx";
import type { BankDTO } from "../../domain/entities/bank-account.ts";
import {
  BANK_LOGO_KEYS,
  BANK_LOGO_LABELS,
  BANK_LOGO_ABBREVS,
  STATEMENT_FORMAT_LABELS,
  type BankLogoKey,
  type StatementFormat,
} from "../../domain/entities/bank-account.ts";
import { AccountFormDrawer } from "./BankAccountsView.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { useToast, ToastContainer } from "../../../../components/Toast.tsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

function BankBadge({
  logoKey,
  color,
  size = "md",
}: {
  logoKey: BankLogoKey;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-14 w-14 text-base"
      : size === "sm"
        ? "h-8 w-8 text-[10px]"
        : "h-11 w-11 text-xs";
  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-xl font-bold text-white`}
      style={{ backgroundColor: color }}
    >
      {BANK_LOGO_ABBREVS[logoKey]}
    </div>
  );
}


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
                <BankBadge logoKey={logoKey} color={color} size="sm" />
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

  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["bank-accounts:banks"],
    queryFn: () => api.listBanks(),
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

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">
              Conciliação Bancária
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">Bancos configurados</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Adicionar banco
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-stone-400">
            A carregar bancos…
          </div>
        ) : banks.length === 0 ? (
          <div className="py-16 text-center">
            <p className="mb-1 text-sm font-medium text-stone-700">
              Nenhum banco configurado
            </p>
            <p className="mb-6 text-sm text-stone-400">
              Adiciona um banco para começar a importar extratos.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Adicionar primeiro banco
            </button>
          </div>
        ) : (
          <>
            <div className="max-w-3xl space-y-4">
              {banks.map((bank) => (
                <div
                  key={bank.id}
                  className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white shadow-sm"
                >
                  {/* Bank header */}
                  <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <BankBadge
                        logoKey={bank.logoKey}
                        color={bank.color}
                        size="sm"
                      />
                      <span className="font-semibold text-stone-900">
                        {bank.name}
                      </span>
                      <span className="text-xs text-stone-400">
                        {STATEMENT_FORMAT_LABELS[bank.statementFormat]}
                      </span>
                    </div>
                    <button
                      onClick={() => setCreatingForBankId(bank.id)}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#ED5C32] hover:bg-orange-50"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                      </svg>
                      Adicionar conta
                    </button>
                  </div>

                  {/* Account rows */}
                  {bank.accountPreviews.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-stone-400">
                      Sem contas configuradas
                    </div>
                  ) : (
                    bank.accountPreviews.map((preview, idx) => {
                      const isCard = preview.type === "credit_card";
                      const title =
                        preview.nickname ??
                        (isCard
                          ? preview.lastFourDigits
                            ? `Cartão ···· ${preview.lastFourDigits}`
                            : "Cartão sem identificador"
                          : (preview.iban ??
                            preview.accountNumber ??
                            "Conta sem identificador"));
                      const sub = isCard
                        ? preview.lastFourDigits
                          ? `**** **** **** ${preview.lastFourDigits}`
                          : null
                        : (preview.iban ?? preview.accountNumber ?? null);
                      return (
                        <div
                          key={preview.id}
                          className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-stone-50 ${idx < bank.accountPreviews.length - 1 ? "border-b border-stone-100" : ""} ${!preview.isActive ? "opacity-50" : ""}`}
                          onClick={() =>
                            navigate(
                              `/financial/bank-statements/banks/${bank.id}/accounts/${preview.id}`,
                            )
                          }
                        >
                          {/* type icon */}
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isCard ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600"}`}
                          >
                            {isCard ? (
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6zM3 13.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm4.75-.75a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" />
                              </svg>
                            ) : (
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm7 5a1 1 0 10-2 0v1H8a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V9z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>

                          {/* info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-stone-900">
                                {title}
                              </p>
                              {!preview.isActive && (
                                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-400">
                                  Inativa
                                </span>
                              )}
                            </div>
                            {sub && (
                              <p className="mt-0.5 font-mono text-xs text-stone-500">
                                {sub}
                              </p>
                            )}
                          </div>

                          {/* right side: badge + limit + chevron */}
                          <div className="flex shrink-0 items-center gap-2">
                            {isCard && preview.creditLimitCents != null && (
                              <span className="text-xs text-stone-400">
                                Limite:{" "}
                                {(
                                  preview.creditLimitCents / 100
                                ).toLocaleString("pt-PT", {
                                  style: "currency",
                                  currency: "EUR",
                                })}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isCard ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}
                            >
                              {isCard ? "Cartão" : "Conta"}
                            </span>
                            <svg
                              className="h-4 w-4 text-stone-300"
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
                        </div>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

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
