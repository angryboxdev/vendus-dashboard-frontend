import { useState, useEffect } from "react";
import { NumericInput } from "../../../../components/NumericInput.tsx";
import { createPortal } from "react-dom";
import { useBankStatementsModule } from "../../bank-statements.module.tsx";
import type { StatementPreview } from "../../domain/ports/out/bank-statements-api.port.ts";

export function ImportModal({
  open,
  saving,
  onClose,
  onSubmit,
  contextBankName,
  contextAccountIdentifier,
  bankAccountId,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
  contextBankName?: string;
  contextAccountIdentifier?: string;
  /** When provided, appended to FormData so the backend links movements directly. */
  bankAccountId?: string;
}) {
  const { api } = useBankStatementsModule();
  const inAccountContext = !!contextBankName && !!contextAccountIdentifier;

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [detectedAccount, setDetectedAccount] = useState<string | null>(null);

  const [bankName, setBankName] = useState(contextBankName ?? "");
  const [accountNumber, setAccountNumber] = useState(contextAccountIdentifier ?? "");
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [movementsCount, setMovementsCount] = useState<number | null>(null);

  useEffect(() => {
    if (contextBankName) setBankName(contextBankName);
  }, [contextBankName]);

  useEffect(() => {
    if (contextAccountIdentifier) setAccountNumber(contextAccountIdentifier);
  }, [contextAccountIdentifier]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedFile(null);
      setPreviewing(false);
      setPreviewError(null);
      setDetectedAccount(null);
      setBankName(contextBankName ?? "");
      setAccountNumber(contextAccountIdentifier ?? "");
      setOpeningBalance("");
      setClosingBalance("");
      setPeriodStart("");
      setPeriodEnd("");
      setMovementsCount(null);
    }
  }, [open]);

  if (!open) return null;

  const accountMismatch =
    inAccountContext &&
    detectedAccount != null &&
    detectedAccount !== "" &&
    detectedAccount !== contextAccountIdentifier;

  async function handleAnalyse() {
    if (!selectedFile) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const preview: StatementPreview = await api.previewStatement(selectedFile);
      if (!inAccountContext) {
        if (preview.bankName) setBankName(preview.bankName);
        if (preview.accountNumber) setAccountNumber(preview.accountNumber);
      }
      setDetectedAccount(preview.accountNumber ?? null);
      if (preview.openingBalance != null)
        setOpeningBalance((preview.openingBalance / 100).toFixed(2));
      if (preview.closingBalance != null)
        setClosingBalance((preview.closingBalance / 100).toFixed(2));
      if (preview.periodStart) setPeriodStart(preview.periodStart);
      if (preview.periodEnd) setPeriodEnd(preview.periodEnd);
      setMovementsCount(preview.movementsCount);
      setStep(2);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Erro ao analisar o ficheiro.");
    } finally {
      setPreviewing(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    const fd = new FormData();
    fd.append("file", selectedFile);
    if (bankName) fd.append("bankName", bankName);
    if (accountNumber) fd.append("accountNumber", accountNumber);
    if (openingBalance)
      fd.append("openingBalance", String(Math.round(parseFloat(openingBalance) * 100)));
    if (closingBalance)
      fd.append("closingBalance", String(Math.round(parseFloat(closingBalance) * 100)));
    if (periodStart) fd.append("periodStart", periodStart);
    if (periodEnd) fd.append("periodEnd", periodEnd);
    fd.append("currency", "EUR");
    if (bankAccountId) fd.append("bankAccountId", bankAccountId);
    onSubmit(fd);
  }

  const labelCls = "block text-xs font-medium text-stone-500 mb-1";
  const inputCls =
    "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-800">Importar Extrato Bancário</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {step === 1 ? "Passo 1 de 2 — selecionar ficheiro" : "Passo 2 de 2 — confirmar dados"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {step === 1 && (
          <div className="px-6 py-6 space-y-5">
            {inAccountContext && (
              <div className="flex items-center gap-2 rounded-lg border border-[#F5C992]/40 bg-[#FDF8F5] px-4 py-2.5">
                <svg className="h-4 w-4 shrink-0 text-[#ED5C32]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm7 5a1 1 0 10-2 0v1H8a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-stone-700">
                  <span className="font-semibold">{contextBankName}</span>
                  <span className="mx-1 text-stone-400">·</span>
                  <span className="font-mono">{contextAccountIdentifier}</span>
                </span>
              </div>
            )}
            <div>
              <label className={labelCls}>Ficheiro CSV ou XLSX</label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="w-full text-sm text-stone-600"
                onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setPreviewError(null); }}
              />
              <p className="mt-1 text-xs text-stone-400">
                Suporta CSV (Millennium BCP ou genérico PT) e Excel (.xlsx / .xls).
              </p>
            </div>
            {previewError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{previewError}</p>
            )}
            <div className="flex gap-3 border-t border-[#F5C992]/40 pt-4">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                Cancelar
              </button>
              <button type="button" disabled={!selectedFile || previewing} onClick={handleAnalyse}
                className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                {previewing ? "A analisar…" : "Analisar ficheiro →"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {movementsCount != null && (
              <div className="flex items-center gap-2 rounded-lg bg-[#FDF8F5] border border-[#F5C992]/40 px-4 py-2.5">
                <svg className="h-4 w-4 text-[#ED5C32] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-stone-700">
                  <span className="font-semibold">{movementsCount}</span> movimentos detetados em{" "}
                  <span className="font-semibold">{selectedFile?.name}</span>
                </span>
              </div>
            )}
            {accountMismatch && (
              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <svg className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <div className="text-xs text-amber-800">
                  <p className="font-semibold">Conta diferente detetada no ficheiro</p>
                  <p className="mt-0.5">
                    O ficheiro indica a conta <span className="font-mono font-semibold">{detectedAccount}</span>,
                    mas estás a importar para <span className="font-mono font-semibold">{contextAccountIdentifier}</span>.
                    O extrato será associado à conta selecionada.
                  </p>
                </div>
              </div>
            )}
            {inAccountContext ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#F5C992]/40 bg-stone-50 px-4 py-2.5">
                <svg className="h-4 w-4 shrink-0 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm7 5a1 1 0 10-2 0v1H8a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-stone-600">
                  <span className="font-semibold">{contextBankName}</span>
                  <span className="mx-1 text-stone-400">·</span>
                  <span className="font-mono">{contextAccountIdentifier}</span>
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Banco *{!bankName && <span className="ml-1 text-amber-500">(não detetado)</span>}</label>
                  <input type="text" required value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputCls} placeholder="ex: Millennium BCP" />
                </div>
                <div>
                  <label className={labelCls}>Conta / IBAN *{!accountNumber && <span className="ml-1 text-amber-500">(não detetado)</span>}</label>
                  <input type="text" required value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputCls} placeholder="ex: PT50..." />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Saldo inicial (€) *</label>
                <NumericInput required value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>Saldo final extrato (€) *</label>
                <NumericInput required value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Período início</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Período fim</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 border-t border-[#F5C992]/40 pt-4">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                ← Voltar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                {saving ? "A importar…" : "Importar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
