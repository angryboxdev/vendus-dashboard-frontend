import { useState } from "react";
import { Button, PageShell } from "../../../../components/ui/index.ts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { PeopleTabs } from "./PeopleTabs.tsx";
import { DocumentCategoriesModal } from "./DocumentCategoriesModal.tsx";
import { ImportPayslipsModal } from "./ImportPayslipsModal.tsx";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { formatPeriod } from "../../domain/services/payslip-import.service.ts";
import {
  matchesValidityFilter,
  VALIDITY_FILTER_LABELS,
  type ValidityFilter,
} from "../../domain/services/document-applicability.service.ts";
import { DOCUMENT_OVERVIEW_STATUS_LABELS, type DocumentOverviewRow } from "../../domain/entities/employee-document.ts";
import { MOTION_ROW_HOVER, MotionPresence } from "../../../../components/motion/index.ts";

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function StatusBadge({ status }: { status: DocumentOverviewRow["status"] }) {
  const info = DOCUMENT_OVERVIEW_STATUS_LABELS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${info.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

/**
 * "Pessoas > Documentos" — única fonte de verdade da gestão documental
 * (task "Melhorar Visão Geral e reorganizar Pessoas", secção 4): 1 linha
 * por (colaborador × requisito), cobrindo válidos/a expirar/expirados/em
 * falta, não só pendências. Upload/substituição continuam a viver só no
 * perfil do colaborador (`EmployeeDocumentsTab`) — "Adicionar"/"Ver"
 * aqui nunca reimplementam essa lógica, só a reaproveitam (Ver = download
 * direto; Adicionar = abre o perfil já na categoria certa).
 */
export function PeopleDocumentsView() {
  const { api } = useHrModule();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") as DocumentOverviewRow["status"] | null) ?? "";
  const requirementId = searchParams.get("requirement") ?? "";
  const validity = (searchParams.get("validity") as ValidityFilter | null) ?? "";
  const period = searchParams.get("period") ?? "";
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, isLoading, isError } = useQuery({
    queryKey: ["hr-document-overview"],
    queryFn: () => api.getDocumentOverview(),
  });

  function updateParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next);
  }

  const allRows = rows ?? [];
  const counts = {
    ok: allRows.filter((r) => r.status === "ok").length,
    expiring: allRows.filter((r) => r.status === "expiring").length,
    expired: allRows.filter((r) => r.status === "expired").length,
    missing: allRows.filter((r) => r.status === "missing").length,
  };

  const requirementOptions = [...new Map(allRows.map((r) => [r.requirementId, r.requirementLabel])).entries()];
  // Ticket 10: só os recibos (categorias periódicas) têm período.
  const periodOptions = [...new Set(allRows.map((r) => r.period).filter((p): p is string => p !== null))].sort().reverse();

  const filtered = allRows.filter((r) => {
    if (search && !r.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
    if (status && r.status !== status) return false;
    if (requirementId && r.requirementId !== requirementId) return false;
    if (!matchesValidityFilter(r.expiresAt, validity, today)) return false;
    if (period && r.period !== period) return false;
    return true;
  });

  async function handleView(row: DocumentOverviewRow) {
    if (!row.documentId) return;
    try {
      setDownloadError(null);
      const url = await api.getEmployeeDocumentDownloadUrl(row.employeeId, row.documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Erro ao abrir o documento");
    }
  }

  function handleAdd(row: DocumentOverviewRow) {
    navigate(`/hr/people/${row.employeeId}?tab=documentos&category=${encodeURIComponent(row.requirementId)}`);
  }

  return (
    <PageShell
      title="Colaboradores"
      description="Gestão de colaboradores e documentação."
      actions={
        <>
          {/* Recibos têm dados salariais — importação só para admin (ticket 10). */}
          {user?.role === "admin" && <Button onClick={() => setImportOpen(true)}>Importar recibos</Button>}
          <Button onClick={() => setCategoriesModalOpen(true)}>Categorias de documentos</Button>
        </>
      }
      tabs={<PeopleTabs />}
    >
      <div className="space-y-4">
        {/* KPIs — clicáveis, funcionam como filtro de estado (secção 11) */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            type="button"
            onClick={() => updateParams({ status: status === "ok" ? undefined : "ok" })}
            className={`rounded-xl border px-4 py-2.5 text-left shadow-sm transition-colors ${
              status === "ok" ? "border-emerald-300 bg-emerald-50" : "border-[#F5C992]/40 bg-white hover:bg-[#FDF8F5]"
            }`}
          >
            <p className="text-xs font-medium text-stone-500">Válidos</p>
            <p className="mt-0.5 text-lg font-bold text-emerald-600">{counts.ok}</p>
          </button>
          <button
            type="button"
            onClick={() => updateParams({ status: status === "expiring" ? undefined : "expiring" })}
            className={`rounded-xl border px-4 py-2.5 text-left shadow-sm transition-colors ${
              status === "expiring" ? "border-amber-300 bg-amber-50" : "border-[#F5C992]/40 bg-white hover:bg-[#FDF8F5]"
            }`}
          >
            <p className="text-xs font-medium text-stone-500">A expirar</p>
            <p className="mt-0.5 text-lg font-bold text-amber-600">{counts.expiring}</p>
          </button>
          <button
            type="button"
            onClick={() => updateParams({ status: status === "expired" ? undefined : "expired" })}
            className={`rounded-xl border px-4 py-2.5 text-left shadow-sm transition-colors ${
              status === "expired" ? "border-red-300 bg-red-50" : "border-[#F5C992]/40 bg-white hover:bg-[#FDF8F5]"
            }`}
          >
            <p className="text-xs font-medium text-stone-500">Expirados</p>
            <p className="mt-0.5 text-lg font-bold text-red-600">{counts.expired}</p>
          </button>
          <button
            type="button"
            onClick={() => updateParams({ status: status === "missing" ? undefined : "missing" })}
            className={`rounded-xl border px-4 py-2.5 text-left shadow-sm transition-colors ${
              status === "missing" ? "border-stone-400 bg-stone-100" : "border-[#F5C992]/40 bg-white hover:bg-[#FDF8F5]"
            }`}
          >
            <p className="text-xs font-medium text-stone-500">Em falta</p>
            <p className="mt-0.5 text-lg font-bold text-stone-700">{counts.missing}</p>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => updateParams({ search: e.target.value || undefined })}
            placeholder="Pesquisar por colaborador..."
            className="w-64 rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
          />
          <select
            value={requirementId}
            onChange={(e) => updateParams({ requirement: e.target.value || undefined })}
            className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
          >
            <option value="">Documento: Todos</option>
            {requirementOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Estado"
            value={status}
            onChange={(e) => updateParams({ status: e.target.value || undefined })}
            className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
          >
            <option value="">Estado: Todos</option>
            <option value="ok">Válido</option>
            <option value="expiring">A expirar</option>
            <option value="expired">Expirado</option>
            <option value="missing">Em falta</option>
          </select>
          <select
            aria-label="Validade"
            value={validity}
            onChange={(e) => updateParams({ validity: e.target.value || undefined })}
            className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
          >
            <option value="">Validade: Todas</option>
            {Object.entries(VALIDITY_FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {periodOptions.length > 0 && (
            <select
              aria-label="Período"
              value={period}
              onChange={(e) => updateParams({ period: e.target.value || undefined })}
              className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
            >
              <option value="">Período: Todos</option>
              {periodOptions.map((p) => (
                <option key={p} value={p}>
                  {formatPeriod(p)}
                </option>
              ))}
            </select>
          )}
          {(search || status || requirementId || validity || period) && (
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams())}
              className="text-sm text-stone-400 transition-colors hover:text-stone-600"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {downloadError && <p className="text-sm text-red-600">{downloadError}</p>}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-stone-400">A carregar…</div>
          ) : isError ? (
            <div className="flex items-center justify-center py-16 text-sm text-red-500">
              Não foi possível carregar os documentos.
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-stone-400">
              {allRows.length === 0 ? "Ainda não há documentos a mostrar." : "Sem resultados para os filtros aplicados."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Colaborador</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Documento</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Período</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Estado</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Validade</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5C992]/30">
                  {filtered.map((row) => (
                    <tr key={`${row.employeeId}:${row.requirementId}:${row.period ?? ""}`} className={MOTION_ROW_HOVER}>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/hr/people/${row.employeeId}`)}
                          className="text-left font-medium text-stone-800 hover:text-[#ED5C32]"
                        >
                          {row.employeeName}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-stone-700">{row.requirementLabel}</p>
                        {row.mandatory && <span className="text-xs text-stone-400">Obrigatório</span>}
                      </td>
                      <td className="px-3 py-2.5 text-stone-500">{formatPeriod(row.period)}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2.5 text-stone-500">{formatDate(row.expiresAt)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {row.documentId ? (
                          <button type="button" onClick={() => handleView(row)} className="text-sm font-medium text-stone-500 hover:text-stone-800">
                            Ver
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleAdd(row)} className="text-sm font-medium text-[#ED5C32] hover:underline">
                            Adicionar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <MotionPresence show={categoriesModalOpen}>
        <DocumentCategoriesModal onClose={() => setCategoriesModalOpen(false)} />
      </MotionPresence>
      <MotionPresence show={importOpen}>
        <ImportPayslipsModal onClose={() => setImportOpen(false)} />
      </MotionPresence>
    </PageShell>
  );
}
