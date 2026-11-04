import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertBanner, EmptyState, FIELD, LABEL, NUMERIC, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";
import { DOCUMENT_TYPE_LABELS, STATUS_LABELS, type DocumentStatus, type FiscalDocumentType } from "../../domain/entities/invoicing.ts";
import { DocumentDetail } from "./DocumentDetail.tsx";
import { useDocuments } from "./use-invoicing.ts";

/** Documentos emitidos: filtros por tipo e estado; abrir mostra a 2.ª via e permite anular. */
export function DocumentsView() {
  const [params, setParams] = useSearchParams();
  const [type, setType] = useState<FiscalDocumentType | "">("");
  const [status, setStatus] = useState<DocumentStatus | "">("");
  const { data: docs, loading, error, reload } = useDocuments({ ...(type ? { type } : {}), ...(status ? { status } : {}) });
  const openId = params.get("abrir");
  const open = (id: string | null) => setParams(id ? { abrir: id } : {}, { replace: true });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label>
          <span className={LABEL}>Tipo</span>
          <select className={FIELD} value={type} onChange={(e) => setType(e.target.value as FiscalDocumentType | "")}>
            <option value="">Todos</option>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={LABEL}>Estado</span>
          <select className={FIELD} value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus | "")}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <AlertBanner tone="danger" title="Não foi possível carregar os documentos">{error}</AlertBanner>}
      {!loading && !error && docs.length === 0 ? (
        <EmptyState title="Ainda não há documentos" description="Os documentos emitidos em «Emitir documento» aparecem aqui." />
      ) : (
        <div className={`${SURFACE} overflow-x-auto`}>
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Número</th>
                <th className={TH}>Tipo</th>
                <th className={TH}>Data</th>
                <th className={TH}>Cliente (NIF)</th>
                <th className={TH}>Estado</th>
                <th className={`${TH} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className={`${TR} cursor-pointer`} onClick={() => open(d.id)}>
                  <td className={`${TD} font-medium`}>
                    <button type="button" className="underline-offset-2 hover:underline" onClick={() => open(d.id)}>
                      {d.documentNumber}
                    </button>
                  </td>
                  <td className={TD}>
                    {DOCUMENT_TYPE_LABELS[d.documentType]}
                    {d.seriesMode === "training" && <span className="ml-1 text-xs text-ink-secondary">(formação)</span>}
                  </td>
                  <td className={TD}>{d.documentDate}</td>
                  <td className={TD}>{d.customerTaxId}</td>
                  <td className={TD}>
                    <StatusBadge tone={d.status === "A" ? "danger" : d.status === "F" ? "neutral" : "success"}>{STATUS_LABELS[d.status]}</StatusBadge>
                  </td>
                  <td className={`${TD} ${NUMERIC} text-right`}>{d.grossTotal} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DocumentDetail id={openId} onClose={() => open(null)} onChanged={() => void reload()} />
    </div>
  );
}
