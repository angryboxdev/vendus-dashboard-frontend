import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useAccountingModule } from "../../accounting.module.tsx";
import { AccountingDocumentsView } from "./AccountingDocumentsView.tsx";
import { VatControlView } from "./VatControlView.tsx";

type Tab = "overview" | "documents" | "vat" | "submissions";

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function quarterOfMonth(month: number): number {
  return Math.ceil(month / 3);
}

/**
 * "Visão geral" — resumo leve, reaproveita as mesmas chamadas já usadas
 * pelas abas Documentos/IVA (nunca uma 3ª agregação). Simplificada face ao
 * mockup original de 6 telas — só o essencial para orientar para as
 * outras abas.
 */
function AccountingOverviewTab({ onGoTo }: { onGoTo: (tab: Tab) => void }) {
  const { api } = useAccountingModule();
  const now = new Date();
  const year = now.getFullYear();

  const { data: settings } = useQuery({
    queryKey: ["accounting-settings"],
    queryFn: () => api.getAccountingSettings(),
  });
  const periodicity = settings?.vatPeriodicity ?? "quarterly";
  const period = periodicity === "monthly" ? now.getMonth() + 1 : quarterOfMonth(now.getMonth() + 1);

  const { data: documents, isLoading: docsLoading, isError: docsError } = useQuery({
    queryKey: ["accounting-documents"],
    queryFn: () => api.listAccountingDocuments(),
  });

  const { data: vat, isLoading: vatLoading, isError: vatError } = useQuery({
    queryKey: ["vat-overview", year, period, periodicity],
    queryFn: () => api.getVatOverview(year, period),
    enabled: !!settings,
  });

  const pendingCount = useMemo(
    () =>
      (documents ?? []).filter(
        (d) => d.source === "accounting_document" && (d.status === "pending_review" || d.status === "with_pendency"),
      ).length,
    [documents],
  );

  return (
    <div className="space-y-4 p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onGoTo("documents")}
          className="rounded-xl border border-stone-200 bg-white p-4 text-left hover:bg-stone-50"
        >
          <p className="text-xs font-medium text-stone-500">Documentos</p>
          <p className="mt-1 text-xl font-bold text-stone-800">
            {docsLoading ? "…" : docsError ? "Indisponível" : (documents?.length ?? 0)}
          </p>
          {!docsLoading && !docsError && (
            <p className="mt-0.5 text-xs text-amber-600">
              {pendingCount > 0 ? `${pendingCount} documento(s) por rever` : "Tudo revisto"}
            </p>
          )}
        </button>

        <button
          type="button"
          onClick={() => onGoTo("vat")}
          className="rounded-xl border border-stone-200 bg-white p-4 text-left hover:bg-stone-50"
        >
          <p className="text-xs font-medium text-stone-500">
            Saldo de IVA — {periodicity === "monthly" ? `${period}/${year}` : `${period}º Trimestre ${year}`}
          </p>
          <p className={`mt-1 text-xl font-bold ${vat && vat.balance >= 0 ? "text-red-600" : "text-emerald-600"}`}>
            {vatLoading ? "…" : vatError || !vat ? "Indisponível" : fromCents(vat.balance)}
          </p>
          <p className="mt-0.5 text-xs text-stone-400">Ver Apuramento de IVA →</p>
        </button>

        <div className="rounded-xl border border-dashed border-stone-200 bg-white p-4">
          <p className="text-xs font-medium text-stone-500">Envio ao contabilista</p>
          <p className="mt-1 text-sm text-stone-400">Em construção — próxima fase.</p>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="text-sm text-stone-600">
          Acesso rápido:{" "}
          <button type="button" onClick={() => onGoTo("documents")} className="font-medium text-[#ED5C32] hover:underline">
            Documentos
          </button>
          {" · "}
          <button type="button" onClick={() => onGoTo("vat")} className="font-medium text-[#ED5C32] hover:underline">
            IVA
          </button>
          {" · "}
          <Link to="/financial/invoices" className="font-medium text-[#ED5C32] hover:underline">
            Faturas
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * "Contabilidade" — módulo único, com 4 abas internas (Visão geral/
 * Documentos/IVA/Envios), nunca 3 entradas separadas na sidebar. Cada aba
 * mantém o seu próprio título de página (ex: "Apuramento de IVA" na aba
 * IVA) — só a navegação de topo é partilhada.
 */
export function AccountingView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "overview";

  function goTo(next: Tab) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params);
  }

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="flex gap-1 border-b border-stone-200 bg-white px-6 pt-3">
        {(
          [
            { key: "overview" as const, label: "Visão geral" },
            { key: "documents" as const, label: "Documentos" },
            { key: "vat" as const, label: "IVA" },
            { key: "submissions" as const, label: "Envios" },
          ]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => goTo(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === key ? "border-[#ED5C32] text-[#ED5C32]" : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <AccountingOverviewTab onGoTo={goTo} />}
      {tab === "documents" && <AccountingDocumentsView />}
      {tab === "vat" && <VatControlView />}
      {tab === "submissions" && (
        <div className="p-6">
          <div className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
            Envios ao contabilista — em construção (próxima fase).
          </div>
        </div>
      )}
    </div>
  );
}
