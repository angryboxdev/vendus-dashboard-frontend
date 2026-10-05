import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import {
  PAYSLIP_DUPLICATE_MESSAGE,
  PAYSLIP_MATCH_REASON_LABELS,
  PAYSLIP_OUTCOME_LABELS,
  PAYSLIP_REVIEW_REASON_LABELS,
  PAYSLIP_STATUS_LABELS,
  type PayslipImportResult,
  type PayslipPreviewRow,
} from "../../domain/entities/payslip-import.ts";
import {
  buildPayslipMapping,
  defaultPayslipPeriod,
  formatPeriod,
  initialPayslipDecision,
  type PayslipDecision,
} from "../../domain/services/payslip-import.service.ts";

const MAX_FILES = 100;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const inputCls = "rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

/**
 * Colaboradores → Documentos → "Importar recibos" (Base Organizacional,
 * ticket 10, task §24): período → vários PDFs → pré-visualização com o
 * colaborador identificado → confirmar → gravar. Um ficheiro em "Rever"
 * nunca é associado sem o utilizador escolher; um recibo já existente só é
 * substituído com "Substituir versão".
 */
export function ImportPayslipsModal({ onClose }: { onClose: () => void }) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [period, setPeriod] = useState(() => defaultPayslipPeriod(new Date().toISOString().slice(0, 10)));
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<PayslipPreviewRow[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, PayslipDecision>>({});
  const [results, setResults] = useState<PayslipImportResult[] | null>(null);

  const employeesQuery = useQuery({
    queryKey: ["hr-people-list", "payslip-import"],
    queryFn: () => api.listEmployees({ status: "all", page: 1, pageSize: 100 }),
    enabled: rows !== null,
  });
  const employees = [...(employeesQuery.data?.items ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName, "pt"));
  const nameById = new Map(employees.map((e) => [e.id, e.fullName]));
  for (const r of rows ?? []) {
    if (r.employeeId && r.employeeName) nameById.set(r.employeeId, r.employeeName);
    for (const c of r.candidates) nameById.set(c.id, c.name);
  }
  const employeeName = (id: string) => nameById.get(id) ?? "Colaborador";

  const previewMutation = useMutation({
    mutationFn: () => api.previewPayslipImport(period, files),
    onSuccess: (data) => {
      setRows(data);
      setDecisions(Object.fromEntries(data.map((r) => [r.fileName, initialPayslipDecision(r)])));
    },
  });

  const { mapping, errors } = rows ? buildPayslipMapping(rows, decisions, employeeName) : { mapping: [], errors: [] };

  const importMutation = useMutation({
    mutationFn: () => api.importPayslips(period, files, mapping),
    onSuccess: (data) => {
      setResults(data);
      void qc.invalidateQueries({ queryKey: ["hr-document-overview"] });
      void qc.invalidateQueries({ queryKey: ["hr-people-documents"] });
      void qc.invalidateQueries({ queryKey: ["hr-people-history"] });
    },
  });

  function handleFiles(list: FileList | null) {
    setFileError(null);
    const picked = [...(list ?? [])];
    if (picked.some((f) => f.type !== "application/pdf")) return setFileError("Só são aceites ficheiros PDF.");
    if (picked.some((f) => f.size > MAX_SIZE_BYTES)) return setFileError("Cada recibo pode ter no máximo 10 MB.");
    if (picked.length > MAX_FILES) return setFileError(`No máximo ${MAX_FILES} ficheiros por importação.`);
    if (new Set(picked.map((f) => f.name)).size !== picked.length) return setFileError("Há ficheiros com o mesmo nome.");
    setFiles(picked);
  }

  function decide(fileName: string, patch: Partial<PayslipDecision>) {
    setDecisions((d) => ({ ...d, [fileName]: { ...d[fileName]!, ...patch } }));
  }

  const busy = previewMutation.isPending || importMutation.isPending;
  const mutationError = (previewMutation.error ?? importMutation.error) as Error | null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="import-payslips-title">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h2 id="import-payslips-title" className="text-base font-semibold text-stone-900">
              Importar recibos
            </h2>
            <p className="text-xs text-stone-500">Recibos de vencimento em PDF — o colaborador é identificado pelo NIF, nome ou nome do ficheiro.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar janela" className="rounded-md px-2 py-1 text-stone-400 hover:text-stone-700">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {rows === null && (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-xs font-medium text-stone-600">
                  Período
                  <input type="month" aria-label="Período" value={period} onChange={(e) => setPeriod(e.target.value)} className={`mt-1 block ${inputCls}`} />
                </label>
                <label className="text-xs font-medium text-stone-600">
                  Recibos (PDF)
                  <input
                    type="file"
                    aria-label="Recibos (PDF)"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={(e) => handleFiles(e.target.files)}
                    className="mt-1 block text-sm text-stone-600"
                  />
                </label>
              </div>
              {files.length > 0 && <p className="text-sm text-stone-600">{files.length} ficheiro(s) selecionado(s).</p>}
              {fileError && <p className="text-sm text-red-600">{fileError}</p>}
            </>
          )}

          {rows !== null && results === null && (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="min-w-full text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-3 py-2">Arquivo</th>
                    <th className="px-3 py-2">Colaborador</th>
                    <th className="px-3 py-2">Período</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((row) => {
                    const d = decisions[row.fileName]!;
                    const status = PAYSLIP_STATUS_LABELS[row.status];
                    return (
                      <tr key={row.fileName} className="align-top">
                        <td className="px-3 py-2.5 text-stone-700">{row.fileName}</td>
                        <td className="px-3 py-2.5">
                          {row.status === "review" ? (
                            <select
                              aria-label={`Colaborador de ${row.fileName}`}
                              value={d.employeeId ?? ""}
                              onChange={(e) => decide(row.fileName, { employeeId: e.target.value || null, action: e.target.value ? "create" : "skip" })}
                              className={inputCls}
                            >
                              <option value="">— Escolher colaborador —</option>
                              {row.candidates.length > 0 && (
                                <optgroup label="Possíveis">
                                  {row.candidates.map((c) => (
                                    <option key={`c-${c.id}`} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="Todos">
                                {employees.map((e) => (
                                  <option key={e.id} value={e.id}>
                                    {e.fullName}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          ) : (
                            <>
                              <p className="text-stone-800">{row.employeeName}</p>
                              {row.matchReason && <p className="text-xs text-stone-400">Identificado {PAYSLIP_MATCH_REASON_LABELS[row.matchReason]}</p>}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-stone-600">{formatPeriod(row.period)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                          {row.status === "review" && row.reviewReason && (
                            <p className="mt-1 text-xs text-stone-500">
                              {PAYSLIP_REVIEW_REASON_LABELS[row.reviewReason]}
                              {!row.hasText && " — PDF sem texto"}
                            </p>
                          )}
                          {row.status === "duplicate" && (
                            <div className="mt-1 space-y-1">
                              <p className="text-xs text-amber-700">{PAYSLIP_DUPLICATE_MESSAGE}</p>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => decide(row.fileName, { action: "skip" })}
                                  aria-pressed={d.action === "skip"}
                                  className={`rounded-md border px-2 py-0.5 text-xs ${d.action === "skip" ? "border-stone-700 bg-stone-700 text-white" : "border-stone-200 text-stone-600"}`}
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => decide(row.fileName, { action: "replace" })}
                                  aria-pressed={d.action === "replace"}
                                  className={`rounded-md border px-2 py-0.5 text-xs ${d.action === "replace" ? "border-[#ED5C32] bg-[#ED5C32] text-white" : "border-stone-200 text-stone-600"}`}
                                >
                                  Substituir versão
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {results !== null && (
            <ul className="space-y-1.5 text-sm">
              {results.map((r) => (
                <li key={r.fileName} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 px-3 py-2">
                  <span className="text-stone-700">
                    {r.fileName} → {employeeName(r.employeeId)}
                  </span>
                  <span className={r.outcome === "created" || r.outcome === "replaced" ? "text-emerald-700" : "text-red-600"}>
                    {PAYSLIP_OUTCOME_LABELS[r.outcome]}
                    {r.outcome === "failed" && r.message ? ` — ${r.message}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {errors.map((e) => (
            <p key={e} className="text-sm text-red-600">
              {e}
            </p>
          ))}
          {mutationError && <p className="text-sm text-red-600">{mutationError.message}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-5 py-3">
          <p className="text-xs text-stone-500">
            {rows !== null && results === null && `${mapping.length} de ${rows.length} recibo(s) serão gravados.`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
              {results ? "Fechar" : "Cancelar"}
            </button>
            {rows === null && (
              <button
                type="button"
                disabled={files.length === 0 || !period || busy}
                onClick={() => previewMutation.mutate()}
                className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
              >
                {previewMutation.isPending ? "A analisar…" : "Pré-visualizar"}
              </button>
            )}
            {rows !== null && results === null && (
              <button
                type="button"
                disabled={mapping.length === 0 || errors.length > 0 || busy}
                onClick={() => importMutation.mutate()}
                className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
              >
                {importMutation.isPending ? "A gravar…" : `Confirmar e gravar ${mapping.length}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
