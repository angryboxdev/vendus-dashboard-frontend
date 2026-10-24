import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Dialog, FIELD, LABEL, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";
import type { DocumentReviewDecision } from "../../domain/entities/employee-document.ts";
import { useEmployeeDocuments } from "../../documents.module.tsx";

const PENDING_DOCUMENTS_KEY = ["novo-rh", "employee-documents", "pending"];
const ddmmyyyy = (iso: string) => new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Validar / Rejeitar um envio do colaborador (Portal). Rejeitar pede o motivo,
 * que o colaborador vê no Portal. O servidor só aceita gerente ou acima.
 */
export function ReviewActions({ employeeId, documentId, label, onDone }: { employeeId: string; documentId: string; label: string; onDone?: () => void }) {
  const api = useEmployeeDocuments();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  // Estável: o Dialog volta a pôr o foco no 1.º botão sempre que `onClose` muda (cada tecla, se fosse inline).
  const close = useCallback(() => setRejecting(false), []);
  const review = useMutation({
    mutationFn: (d: { decision: DocumentReviewDecision; note?: string }) => api.reviewEmployeeDocument(employeeId, documentId, d.decision, d.note),
    onSuccess: () => {
      setRejecting(false);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["novo-rh", "employee-documents"] });
      onDone?.();
    },
  });
  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="primary" disabled={review.isPending} onClick={() => review.mutate({ decision: "approve" })} aria-label={`Validar ${label}`}>
          Validar
        </Button>
        <Button size="sm" variant="danger" disabled={review.isPending} onClick={() => setRejecting(true)} aria-label={`Rejeitar ${label}`}>
          Rejeitar
        </Button>
      </div>
      {review.isError && !rejecting && (
        <p role="alert" className="mt-1 text-right text-xs text-red-700">
          {review.error instanceof Error ? review.error.message : "Não foi possível guardar."}
        </p>
      )}
      <Dialog
        open={rejecting}
        title={`Rejeitar ${label}`}
        description="O colaborador vê o motivo no Portal e pode enviar outra vez."
        onClose={close}
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={!note.trim() || review.isPending} onClick={() => review.mutate({ decision: "reject", note: note.trim() })}>
              Rejeitar
            </Button>
          </>
        }
      >
        <label className={LABEL} htmlFor={`reject-${documentId}`}>
          Motivo
        </label>
        <textarea id={`reject-${documentId}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`${FIELD} h-auto w-full py-2`} placeholder="Ex.: foto ilegível, documento fora da validade" />
        {review.isError && (
          <p role="alert" className="text-xs text-red-700">
            {review.error instanceof Error ? review.error.message : "Não foi possível guardar."}
          </p>
        )}
      </Dialog>
    </>
  );
}

/** Novo RH → Mais → Documentos: envios do Portal por validar (aparece só quando há). */
export function PendingDocumentsSection({ personHref }: { personHref: (employeeId: string) => string }) {
  const api = useEmployeeDocuments();
  const pending = useQuery({ queryKey: PENDING_DOCUMENTS_KEY, queryFn: () => api.listPendingDocuments() });
  const [error, setError] = useState<string | null>(null);
  if (!pending.data || pending.data.length === 0) return null;
  const open = (employeeId: string, id: string) => {
    setError(null);
    const win = window.open("", "_blank");
    api
      .getEmployeeDocumentDownloadUrl(employeeId, id)
      .then((url) => (win ? (win.location.href = url) : (window.location.href = url)))
      .catch(() => {
        win?.close();
        setError("Não foi possível abrir o documento.");
      });
  };
  return (
    <section aria-label="Por validar" className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
        Por validar
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{pending.data.length}</span>
      </h2>
      <p className="text-xs text-ink-secondary">Documentos enviados pelos colaboradores no Portal. Só contam depois de validados.</p>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className={`${SURFACE} overflow-x-auto`}>
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Colaborador</th>
              <th className={TH}>Documento</th>
              <th className={TH}>Enviado</th>
              <th className={`${TH} text-right`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pending.data.map((d) => (
              <tr key={d.id} className={TR}>
                <td className={TD}>
                  <Link to={personHref(d.employeeId)} className="font-medium text-navy-900 hover:text-brand-600 hover:underline">
                    {d.employeeName}
                  </Link>
                </td>
                <td className={TD}>
                  <button type="button" onClick={() => open(d.employeeId, d.id)} className="text-left text-brand-600 hover:underline" title="Ver o ficheiro">
                    {d.categoryLabel}
                  </button>
                  <span className="block text-xs text-ink-secondary">{d.fileName}</span>
                </td>
                <td className={`${TD} tabular-nums text-ink-secondary`}>{ddmmyyyy(d.submittedAt)}</td>
                <td className={`${TD} text-right`}>
                  <ReviewActions employeeId={d.employeeId} documentId={d.id} label={`${d.categoryLabel} de ${d.employeeName}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
