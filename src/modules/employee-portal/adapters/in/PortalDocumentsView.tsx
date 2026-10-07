import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

function DocumentRow({ doc, title, today, onOpen, busy }: { doc: MyDocument; title: string; today: string; onOpen: () => void; busy: boolean }) {
  const expiry = expiryState(doc, today);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-stone-900">{title}</p>
        {expiry === "expired" && <p className="text-xs font-medium text-red-700">Vencido a {dateLabel(doc.expiresAt!)}</p>}
        {expiry === "expiring" && <p className="text-xs font-medium text-amber-700">Vence a {dateLabel(doc.expiresAt!)}</p>}
        {expiry === "ok" && doc.expiresAt && <p className="text-xs text-stone-500">Válido até {dateLabel(doc.expiresAt)}</p>}
      </div>
      <button type="button" onClick={onOpen} disabled={busy} className="shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 disabled:opacity-50">
        {busy ? "A abrir…" : "Abrir"}
      </button>
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
