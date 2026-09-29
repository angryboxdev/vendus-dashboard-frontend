import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccountingModule } from "../../accounting.module.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import { AccountingDuplicateError } from "../../domain/errors.ts";
import {
  ACCOUNTING_DOCUMENT_TYPES,
  ACCOUNTING_FUNDING_SOURCES,
  ACCOUNTING_SETTLEMENT_METHODS,
  DOCUMENT_TYPE_LABELS,
  FUNDING_SOURCE_LABELS,
  SETTLEMENT_METHOD_LABELS,
  STATUS_LABELS,
  STATUS_TEXT_COLOR,
  type AccountingDocumentType,
  type AccountingDuplicateCandidate,
  type AccountingFundingSource,
  type AccountingSettlementMethod,
} from "../../domain/entities/accounting-document.ts";

function eurosToCents(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centsToEuros(v: number): string {
  return (v / 100).toFixed(2);
}

function formatDateTime(s: string): string {
  return new Date(s).toLocaleString("pt-PT");
}

const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

/**
 * "Novo/editar documento" — o único formulário de criação genuinamente novo
 * do módulo Contabilidade (faturas continuam a criar-se/editar-se em
 * Faturas). Ao editar, mostra o estado e as ações de transição disponíveis
 * (só a partir de "pending_review" — "closed" ainda não tem endpoint).
 */
export function AccountingDocumentDrawer({
  documentId,
  onClose,
  onSaved,
}: {
  documentId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useAccountingModule();
  const fbModule = useFinancialBaseModule();
  const qc = useQueryClient();
  const isEdit = documentId !== null;

  const { data: existing } = useQuery({
    queryKey: ["accounting-document", documentId],
    queryFn: () => api.getAccountingDocument(documentId!),
    enabled: isEdit,
  });

  const { data: groups = [] } = useQuery({ queryKey: ["cost-center-groups"], queryFn: () => fbModule.api.listCostCenterGroups() });
  const { data: categories = [] } = useQuery({ queryKey: ["cost-center-categories"], queryFn: () => fbModule.api.listCostCenterCategories() });

  const [documentType, setDocumentType] = useState<AccountingDocumentType>(existing?.documentType ?? "manual");
  const [fundingSource, setFundingSource] = useState<AccountingFundingSource>(existing?.fundingSource ?? "partner");
  const [entityName, setEntityName] = useState(existing?.entityName ?? "");
  const [nif, setNif] = useState(existing?.nif ?? "");
  const [documentNumber, setDocumentNumber] = useState(existing?.documentNumber ?? "");
  const [issueDate, setIssueDate] = useState(existing?.issueDate ?? new Date().toISOString().slice(0, 10));
  const [receivedDate, setReceivedDate] = useState(existing?.receivedDate ?? "");
  const [competenceDate, setCompetenceDate] = useState(existing?.competenceDate ?? "");
  const [subtotal, setSubtotal] = useState(existing ? centsToEuros(existing.subtotalWithoutVat) : "");
  const [vat, setVat] = useState(existing ? centsToEuros(existing.vatAmount) : "");
  const [total, setTotal] = useState(existing ? centsToEuros(existing.totalWithVat) : "");
  const [groupId, setGroupId] = useState("");
  const [categoryId, setCategoryId] = useState(existing?.costCenterCategoryId ?? "");
  const [deductiblePercentageInput, setDeductiblePercentageInput] = useState(
    existing?.deductiblePercentage != null ? String(existing.deductiblePercentage) : "",
  );
  const [deductibilityOverrideReason, setDeductibilityOverrideReason] = useState(
    existing?.deductibilityOverrideReason ?? "",
  );
  const [settlementMethod, setSettlementMethod] = useState<AccountingSettlementMethod>(
    existing?.settlementMethod ?? "reimbursement",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [duplicateCandidate, setDuplicateCandidate] = useState<AccountingDuplicateCandidate | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Reidrata o formulário assim que o documento existente chega (query resolve depois do 1º render).
  const [hydrated, setHydrated] = useState(false);
  if (existing && !hydrated) {
    setDocumentType(existing.documentType);
    setFundingSource(existing.fundingSource);
    setEntityName(existing.entityName);
    setNif(existing.nif ?? "");
    setDocumentNumber(existing.documentNumber ?? "");
    setIssueDate(existing.issueDate);
    setReceivedDate(existing.receivedDate ?? "");
    setCompetenceDate(existing.competenceDate ?? "");
    setSubtotal(centsToEuros(existing.subtotalWithoutVat));
    setVat(centsToEuros(existing.vatAmount));
    setTotal(centsToEuros(existing.totalWithVat));
    setCategoryId(existing.costCenterCategoryId ?? "");
    setDeductiblePercentageInput(existing.deductiblePercentage != null ? String(existing.deductiblePercentage) : "");
    setDeductibilityOverrideReason(existing.deductibilityOverrideReason ?? "");
    setSettlementMethod(existing.settlementMethod);
    setNotes(existing.notes ?? "");
    setHydrated(true);
  }

  const deductiblePercentage = deductiblePercentageInput.trim() === "" ? null : Number(deductiblePercentageInput);
  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const deductibilityReasonRequired = deductiblePercentage !== null;

  const saveMutation = useMutation({
    mutationFn: async (vars: { confirmDuplicate: boolean }) => {
      const payload = {
        documentType,
        fundingSource,
        entityName,
        nif: nif || null,
        documentNumber: documentNumber || null,
        issueDate,
        receivedDate: receivedDate || null,
        competenceDate: competenceDate || null,
        subtotalWithoutVat: eurosToCents(subtotal),
        vatAmount: eurosToCents(vat),
        totalWithVat: eurosToCents(total),
        costCenterCategoryId: categoryId || null,
        deductiblePercentage,
        deductibilityOverrideReason: deductiblePercentage !== null ? deductibilityOverrideReason || null : null,
        settlementMethod,
        notes: notes || null,
        confirmDuplicate: vars.confirmDuplicate,
      };
      if (isEdit) return api.updateAccountingDocument(documentId!, payload);
      return api.createAccountingDocument(payload);
    },
    onSuccess: () => {
      setDuplicateCandidate(null);
      void qc.invalidateQueries({ queryKey: ["accounting-documents"] });
      onSaved();
    },
    onError: (err) => {
      if (err instanceof AccountingDuplicateError) {
        setDuplicateCandidate(err.candidate);
      }
    },
  });

  const validateMutation = useMutation({
    mutationFn: () => api.validateAccountingDocument(documentId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["accounting-document", documentId] });
      void qc.invalidateQueries({ queryKey: ["accounting-documents"] });
    },
  });

  const markPendencyMutation = useMutation({
    mutationFn: () => api.markAccountingDocumentPendency(documentId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["accounting-document", documentId] });
      void qc.invalidateQueries({ queryKey: ["accounting-documents"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelAccountingDocument(documentId!, cancelReason),
    onSuccess: () => {
      setShowCancelForm(false);
      void qc.invalidateQueries({ queryKey: ["accounting-document", documentId] });
      void qc.invalidateQueries({ queryKey: ["accounting-documents"] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadAccountingDocumentAttachment(documentId!, file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["accounting-document", documentId] }),
  });

  const categoriesForGroup = groupId ? categories.filter((c) => c.groupId === groupId) : categories;
  const attachmentsNewestFirst = [...(existing?.attachments ?? [])].sort((a, b) => b.version - a.version);

  function handleConfirmDuplicate() {
    setDuplicateCandidate(null);
    saveMutation.mutate({ confirmDuplicate: true });
  }

  const canSave =
    !!entityName &&
    !!issueDate &&
    (!deductibilityReasonRequired || deductibilityOverrideReason.trim().length > 0);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-800">
              {isEdit ? "Editar documento" : "Novo documento"}
            </h2>
            <p className="text-xs text-stone-400">Documento de acompanhamento (sócio, funcionário, plataforma, regularização…)</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        <div className="flex-1 space-y-5 p-6">
          {existing && (
            <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <span className={`text-xs font-medium ${STATUS_TEXT_COLOR[existing.status]}`}>
                {STATUS_LABELS[existing.status]}
              </span>
              {existing.status === "pending_review" && !showCancelForm && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => markPendencyMutation.mutate()}
                    disabled={markPendencyMutation.isPending}
                    className="rounded-md border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                  >
                    Marcar com pendência
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelForm(true)}
                    className="rounded-md border border-stone-200 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => validateMutation.mutate()}
                    disabled={validateMutation.isPending}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {validateMutation.isPending ? "A validar…" : "Validar"}
                  </button>
                </div>
              )}
            </div>
          )}

          {showCancelForm && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <label className={labelCls}>Motivo do cancelamento *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="Ex: documento duplicado, emitido por engano…"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCancelForm(false)} className="rounded-md border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50">
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={!cancelReason.trim() || cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                  className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelMutation.isPending ? "A cancelar…" : "Confirmar cancelamento"}
                </button>
              </div>
            </div>
          )}

          {existing?.status === "cancelled" && existing.cancellationReason && (
            <p className="text-xs text-stone-500">Motivo do cancelamento: {existing.cancellationReason}</p>
          )}

          {duplicateCandidate && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">
                Possível documento duplicado: {duplicateCandidate.label} ({duplicateCandidate.source === "invoice" ? "Fatura" : "Documento de acompanhamento"})
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDuplicateCandidate(null)} className="rounded-md border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50">
                  Cancelar
                </button>
                <button type="button" onClick={handleConfirmDuplicate} className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700">
                  Criar mesmo assim
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Origem e pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tipo de documento</label>
                <select value={documentType} onChange={(e) => setDocumentType(e.target.value as AccountingDocumentType)} className={inputCls}>
                  {ACCOUNTING_DOCUMENT_TYPES.map((value) => (
                    <option key={value} value={value}>{DOCUMENT_TYPE_LABELS[value]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Origem dos fundos</label>
                <select value={fundingSource} onChange={(e) => setFundingSource(e.target.value as AccountingFundingSource)} className={inputCls}>
                  {ACCOUNTING_FUNDING_SOURCES.map((value) => (
                    <option key={value} value={value}>{FUNDING_SOURCE_LABELS[value]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>Forma de tratamento</label>
              <select value={settlementMethod} onChange={(e) => setSettlementMethod(e.target.value as AccountingSettlementMethod)} className={inputCls}>
                {ACCOUNTING_SETTLEMENT_METHODS.map((value) => (
                  <option key={value} value={value}>{SETTLEMENT_METHOD_LABELS[value]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Detalhes</p>
            <label className={labelCls}>Entidade</label>
            <input value={entityName} onChange={(e) => setEntityName(e.target.value)} className={inputCls} placeholder="Ex: João Silva" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>NIF (opcional)</label>
                <input value={nif} onChange={(e) => setNif(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nº documento (opcional)</label>
                <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Data de emissão</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Data de receção</label>
                <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Data de competência</label>
                <input type="date" value={competenceDate} onChange={(e) => setCompetenceDate(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Subtotal (€)</label>
                <input value={subtotal} onChange={(e) => setSubtotal(e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>IVA (€)</label>
                <input value={vat} onChange={(e) => setVat(e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>Total (€)</label>
                <input value={total} onChange={(e) => setTotal(e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Classificação</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Centro de custo</label>
                <select
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    setCategoryId("");
                  }}
                  className={inputCls}
                >
                  <option value="">— todos —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Subcategoria</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                  <option value="">— nenhuma —</option>
                  {categoriesForGroup.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>% dedutível (IVA)</label>
                <input
                  value={deductiblePercentageInput}
                  onChange={(e) => setDeductiblePercentageInput(e.target.value)}
                  className={inputCls}
                  placeholder={
                    selectedCategory
                      ? `Sugestão da subcategoria: ${selectedCategory.vatDeductible ? "100%" : "0%"}`
                      : "Sugestão da subcategoria"
                  }
                />
                <p className="mt-1 text-[11px] text-stone-400">
                  Em branco = usa a sugestão da subcategoria
                  {selectedCategory ? ` (${selectedCategory.vatDeductible ? "dedutível" : "não dedutível"})` : ""}.
                </p>
              </div>
              {deductibilityReasonRequired && (
                <div>
                  <label className={labelCls}>Motivo do desvio *</label>
                  <input
                    value={deductibilityOverrideReason}
                    onChange={(e) => setDeductibilityOverrideReason(e.target.value)}
                    className={inputCls}
                    placeholder="Obrigatório quando diverge da sugestão"
                  />
                </div>
              )}
            </div>
            {existing && (
              <p className="mt-2 text-[11px] text-stone-400">
                IVA dedutível: {(existing.vatDeductibleAmount / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                {" · "}
                IVA não dedutível: {(existing.vatNonDeductibleAmount / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Observações</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
          </div>

          {isEdit && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Anexos</p>
              {attachmentsNewestFirst.length === 0 ? (
                <p className="text-sm text-stone-400">Sem anexos.</p>
              ) : (
                <ul className="space-y-1">
                  {attachmentsNewestFirst.map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-xs text-stone-500">
                      <span>v{a.version} — {a.fileType}</span>
                      <span>{formatDateTime(a.uploadedAt)} · {a.uploadedBy}</span>
                    </li>
                  ))}
                </ul>
              )}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMutation.mutate(file);
                }}
                className="mt-2 block text-xs text-stone-500"
              />
              {uploadMutation.isPending && <p className="mt-1 text-xs text-stone-400">A enviar…</p>}
            </div>
          )}

          {saveMutation.isError && !duplicateCandidate && (
            <p className="text-xs text-red-600">
              {saveMutation.error instanceof Error ? saveMutation.error.message : "Erro ao guardar"}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saveMutation.isPending || !canSave}
            onClick={() => saveMutation.mutate({ confirmDuplicate: false })}
            className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saveMutation.isPending ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </aside>
    </>
  );
}
