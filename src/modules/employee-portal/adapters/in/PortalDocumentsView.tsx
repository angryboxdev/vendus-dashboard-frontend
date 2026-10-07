import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MyDocument } from "../../domain/entities/portal.ts";
import { dateLabel, expiryState, periodLabel, splitDocuments } from "../../domain/services/portal-text.service.ts";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { todayLisbon } from "./portal-today.ts";

/**
 * Abre o ficheiro numa nova janela. A janela é aberta **no toque** (antes do
 * pedido do URL) — o Safari do iPhone bloqueia `window.open` depois de um
 * `await`. Sem janela (bloqueada), navega na própria página.
 */
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

/** Substituir um documento vencido / a vencer: PDF ou foto (no telemóvel abre a câmara ou os ficheiros). */
function ReplaceForm({ doc, onDone, onCancel }: { doc: MyDocument; onDone: () => void; onCancel: () => void }) {
  const { selfService } = useEmployeePortalModule();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const send = useMutation({
    mutationFn: () => selfService.replaceDocument(doc.id, file!, expiresAt || null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["portal-documents"] });
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (file) send.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-2 border-t border-stone-100 bg-stone-50/60 px-4 py-3">
      <label className="block text-xs font-medium text-stone-700" htmlFor={`file-${doc.id}`}>
        Novo ficheiro (PDF ou foto)
      </label>
      <input id={`file-${doc.id}`} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-xs" />
      <label className="block text-xs font-medium text-stone-700" htmlFor={`exp-${doc.id}`}>
        Nova data de validade (se souber)
      </label>
      <input id={`exp-${doc.id}`} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm" />
      {send.isError && (
        <p role="alert" className="text-xs text-red-700">
          {send.error instanceof Error ? send.error.message : "Não foi possível enviar."}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={!file || send.isPending} className="rounded-lg bg-[#ED5C32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {send.isPending ? "A enviar…" : "Enviar"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600">
          Cancelar
        </button>
      </div>
      <p className="text-xs text-stone-500">Depois de enviado, fica a aguardar validação do RH e não pode ser removido.</p>
    </form>
  );
}

function DocumentRow({ doc, title, today, onOpen, busy }: { doc: MyDocument; title: string; today: string; onOpen: () => void; busy: boolean }) {
  const expiry = expiryState(doc, today);
  const [replacing, setReplacing] = useState(false);
  const [sent, setSent] = useState(false);
  const pending = doc.status === "pending_validation";
  return (
    <li>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-900">{title}</p>
          {pending ? (
            <p className="text-xs font-medium text-sky-700">Em validação pelo RH</p>
          ) : (
            <>
              {expiry === "expired" && <p className="text-xs font-medium text-red-700">Vencido a {dateLabel(doc.expiresAt!)}</p>}
              {expiry === "expiring" && <p className="text-xs font-medium text-amber-700">Vence a {dateLabel(doc.expiresAt!)}</p>}
              {expiry === "ok" && doc.expiresAt && <p className="text-xs text-stone-500">Válido até {dateLabel(doc.expiresAt)}</p>}
            </>
          )}
          {doc.lastRejection && !pending && <p className="text-xs text-red-700">Envio rejeitado: {doc.lastRejection.note}</p>}
          {sent && <p className="text-xs text-emerald-700">Enviado ✓ — aguarda validação.</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {doc.canReplace && !replacing && (
            <button type="button" onClick={() => setReplacing(true)} className="rounded-lg bg-[#ED5C32] px-3 py-1.5 text-xs font-medium text-white">
              Substituir
            </button>
          )}
          <button type="button" onClick={onOpen} disabled={busy} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 disabled:opacity-50">
            {busy ? "A abrir…" : "Abrir"}
          </button>
        </div>
      </div>
      {replacing && (
        <ReplaceForm
          doc={doc}
          onCancel={() => setReplacing(false)}
          onDone={() => {
            setReplacing(false);
            setSent(true);
          }}
        />
      )}
    </li>
  );
}

/** Documentos e recibos do próprio (ticket 08) — só consulta. */
export function PortalDocumentsView() {
  const { selfService } = useEmployeePortalModule();
  const today = todayLisbon();
  const { data, isLoading, isError } = useQuery({ queryKey: ["portal-documents"], queryFn: () => selfService.listDocuments(), retry: false });
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = (id: string) => {
    setError(null);
    setOpening(id);
    openSigned(() => selfService.documentUrl(id))
      .catch(() => setError("Não foi possível abrir o documento. Tente novamente."))
      .finally(() => setOpening(null));
  };

  if (isLoading) return <p className="text-sm text-stone-500">A carregar…</p>;
  if (isError || !data) return <p className="text-sm text-red-700">Não foi possível carregar os documentos.</p>;
  const { payslips, others } = splitDocuments(data);

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <section>
        <h1 className="mb-2 text-base font-semibold text-stone-900">Recibos</h1>
        {payslips.length === 0 ? (
          <p className="rounded-2xl border border-[#F5C992]/50 bg-white p-4 text-sm text-stone-600">Ainda não há recibos.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-2xl border border-[#F5C992]/50 bg-white shadow-sm" aria-label="Recibos">
            {payslips.map((d) => (
              <DocumentRow key={d.id} doc={d} title={`${d.period ? periodLabel(d.period) : ""} · ${d.categoryLabel}`} today={today} onOpen={() => open(d.id)} busy={opening === d.id} />
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-stone-900">Documentos</h2>
        {others.length === 0 ? (
          <p className="rounded-2xl border border-[#F5C992]/50 bg-white p-4 text-sm text-stone-600">Sem documentos.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-2xl border border-[#F5C992]/50 bg-white shadow-sm" aria-label="Documentos">
            {others.map((d) => (
              <DocumentRow key={d.id} doc={d} title={d.categoryLabel} today={today} onOpen={() => open(d.id)} busy={opening === d.id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
