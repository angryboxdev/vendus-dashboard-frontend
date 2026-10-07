import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { REQUEST_KIND_LABEL, type InboxRequest, type PendingDocument } from "../../domain/entities/portal-requests.ts";

const HR_REQUESTS_QUERY_KEY = ["hr-requests-inbox"];

const fmtDate = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Abre o ficheiro numa janela aberta no clique (o Safari bloqueia `window.open` depois de um `await`). */
async function openSigned(getUrl: () => Promise<string>): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const url = await getUrl();
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (e) {
    win?.close();
    throw e;
  }
}

const btn = "rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50";
const approveCls = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`;
const rejectCls = `${btn} border border-red-200 text-red-700 hover:bg-red-50`;
const ghostCls = `${btn} border border-stone-200 text-stone-600 hover:bg-stone-50`;

/** Rejeitar pede sempre o motivo (o colaborador vê-o no Portal). */
function RejectBox({ busy, onConfirm, onCancel }: { busy: boolean; onConfirm: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-red-100 bg-red-50/50 p-3">
      <label className="block text-xs font-medium text-stone-700" htmlFor="reject-note">
        Motivo da rejeição (o colaborador vai vê-lo)
      </label>
      <textarea id="reject-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-md border border-stone-300 p-2 text-sm" />
      <div className="flex gap-2">
        <button type="button" disabled={busy || !note.trim()} onClick={() => onConfirm(note)} className={rejectCls}>
          Confirmar rejeição
        </button>
        <button type="button" onClick={onCancel} className={ghostCls}>
          Voltar
        </button>
      </div>
    </div>
  );
}

function RequestCard({ r }: { r: InboxRequest }) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: (p: { decision: "approve" | "reject"; note: string | null }) => api.decidePortalRequest(r.id, p.decision, p.note),
    onSuccess: () => void qc.invalidateQueries({ queryKey: HR_REQUESTS_QUERY_KEY }),
    onError: (e) => setError(e instanceof Error ? e.message : "Não foi possível decidir."),
  });
  const period = r.startDate === r.endDate ? fmtDate(r.startDate) : `${fmtDate(r.startDate)} a ${fmtDate(r.endDate)}`;

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-900">
            {REQUEST_KIND_LABEL[r.kind]} · {r.employeeName}
          </p>
          <p className="text-sm text-stone-600">
            {period}
            {r.shiftHours && ` · turno ${r.shiftHours}`}
          </p>
          <p className="mt-1 text-sm text-stone-700">
            {r.reasonLabel}
            {r.reasonText && <span className="text-stone-500"> — {r.reasonText}</span>}
          </p>
          <p className="mt-1 text-xs text-stone-400">Enviado {fmtWhen(r.createdAt)}</p>
        </div>
        {r.attachmentName && (
          <button
            type="button"
            className={ghostCls}
            onClick={() => openSigned(() => api.getRequestAttachmentUrl(r.id)).catch(() => setError("Não foi possível abrir o anexo."))}
          >
            Ver anexo
          </button>
        )}
      </div>

      {!rejecting && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)"
            aria-label="Nota da aprovação"
            className="min-w-0 flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-xs"
          />
          <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ decision: "approve", note: note || null })} className={approveCls}>
            Aprovar
          </button>
          <button type="button" onClick={() => setRejecting(true)} className={rejectCls}>
            Rejeitar
          </button>
        </div>
      )}
      {rejecting && <RejectBox busy={decide.isPending} onCancel={() => setRejecting(false)} onConfirm={(n) => decide.mutate({ decision: "reject", note: n })} />}
      {r.kind === "day_off" && !rejecting && (
        <p className="mt-2 text-xs text-stone-500">Ao aprovar, fica registada uma ausência autorizada. Ajuste a escala desses dias à mão.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}

function DocumentCard({ d }: { d: PendingDocument }) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [expiresAt, setExpiresAt] = useState(d.expiresAt ?? "");
  const [error, setError] = useState<string | null>(null);
  const review = useMutation({
    mutationFn: (p: { decision: "approve" | "reject"; note?: string; expiresAt?: string | null }) => api.reviewEmployeeDocument(d.employeeId, d.id, p),
    onSuccess: () => void qc.invalidateQueries({ queryKey: HR_REQUESTS_QUERY_KEY }),
    onError: (e) => setError(e instanceof Error ? e.message : "Não foi possível guardar."),
  });

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-900">
            {d.categoryLabel} · {d.employeeName}
          </p>
          <p className="text-sm text-stone-600">{d.fileName}</p>
          <p className="mt-1 text-xs text-stone-400">Enviado no Portal {fmtWhen(d.submittedAt)}</p>
        </div>
        <button
          type="button"
          className={ghostCls}
          onClick={() => openSigned(() => api.getEmployeeDocumentDownloadUrl(d.employeeId, d.id)).catch(() => setError("Não foi possível abrir o ficheiro."))}
        >
          Ver ficheiro
        </button>
      </div>
      {!rejecting && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-stone-600" htmlFor={`exp-${d.id}`}>
            Válido até
          </label>
          <input id={`exp-${d.id}`} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-xs" />
          <button type="button" disabled={review.isPending} onClick={() => review.mutate({ decision: "approve", expiresAt: expiresAt || null })} className={approveCls}>
            Validar
          </button>
          <button type="button" onClick={() => setRejecting(true)} className={rejectCls}>
            Rejeitar
          </button>
        </div>
      )}
      {rejecting && <RejectBox busy={review.isPending} onCancel={() => setRejecting(false)} onConfirm={(n) => review.mutate({ decision: "reject", note: n })} />}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * Caixa de pedidos (Portal ticket 13) — o que os colaboradores enviaram no
 * Portal e aguarda decisão. O backend só devolve o que as permissões de
 * quem pede cobrem (documentos, faltas, folgas).
 */
export function HrRequestsView() {
  const { api } = useHrModule();
  const { data, isLoading, isError } = useQuery({ queryKey: HR_REQUESTS_QUERY_KEY, queryFn: () => api.getRequestsInbox(), refetchInterval: 60_000 });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Caixa de pedidos</h1>
        <p className="text-sm text-stone-500">Pedidos e documentos enviados pelos colaboradores no Portal.</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-stone-400">A carregar…</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-700">Não foi possível carregar os pedidos.</p>
      ) : data.total === 0 ? (
        <section className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">Nada por decidir. ✓</section>
      ) : (
        <>
          {data.requests.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase text-stone-500">Pedidos ({data.requests.length})</h2>
              <ul className="space-y-3">
                {data.requests.map((r) => (
                  <RequestCard key={r.id} r={r} />
                ))}
              </ul>
            </section>
          )}
          {data.documents.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase text-stone-500">Documentos por validar ({data.documents.length})</h2>
              <ul className="space-y-3">
                {data.documents.map((d) => (
                  <DocumentCard key={d.id} d={d} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
