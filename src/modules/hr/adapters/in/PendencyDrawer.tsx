import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import type { PriorityPendency } from "../../domain/entities/employee.ts";

export type PendencyPanelKind = "missing-fields" | "missing-documents" | "expiring-documents";

const KIND_BY_PANEL: Record<PendencyPanelKind, PriorityPendency["kind"]> = {
  "missing-fields": "missing_field",
  "missing-documents": "missing_document",
  "expiring-documents": "expiring_document",
};

const TITLE_BY_PANEL: Record<PendencyPanelKind, string> = {
  "missing-fields": "Dados incompletos",
  "missing-documents": "Pendências documentais",
  "expiring-documents": "Documentos a expirar",
};

const SEE_ALL_HREF_BY_PANEL: Record<PendencyPanelKind, string> = {
  "missing-fields": "/hr/people?profileComplete=incomplete",
  "missing-documents": "/hr/people/documentos?status=missing",
  "expiring-documents": "/hr/people/documentos?status=expiring",
};

function daysRemaining(expiresAt: string): number {
  const ms = new Date(`${expiresAt}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

/**
 * Drawer lateral sobreposto — explica rapidamente uma pendência da Visão
 * Geral sem sair dela (task "Melhorar Visão Geral e reorganizar Pessoas",
 * secções 6/7/8/10/12: "Visão Geral identifica. Drawer explica.").
 * Reaproveita `api.getKpis()` (`priorityPendencies`) — a MESMA fonte já
 * usada por "Pessoas" antes de o painel lateral duplicado ser removido de
 * lá; nunca uma 2ª agregação. Agrupado por `detail` (o mesmo agrupamento
 * que a API já devolve), não por colaborador — ver README, "Design
 * decisions", para a troca face ao mockup (que agrupa por colaborador).
 */
export function PendencyDrawer({ panel, onClose }: { panel: PendencyPanelKind; onClose: () => void }) {
  const { api } = useHrModule();
  const navigate = useNavigate();

  const { data: kpis, isLoading, isError } = useQuery({
    queryKey: ["hr-people-kpis"],
    queryFn: () => api.getKpis(),
  });

  const kind = KIND_BY_PANEL[panel];
  const groups = (kpis?.priorityPendencies ?? []).filter((g) => g.kind === kind);

  function openProfile(employeeId: string) {
    navigate(`/hr/people/${employeeId}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-5 py-4">
          <h2 className="text-base font-semibold text-stone-800">{TITLE_BY_PANEL[panel]}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600" title="Fechar">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {isLoading ? (
            <p className="text-sm text-stone-400">A carregar…</p>
          ) : isError ? (
            <p className="text-sm text-red-500">Não foi possível carregar esta pendência.</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-stone-400">Sem pendências no momento.</p>
          ) : (
            groups.map((group, i) => (
              <div key={i} className="rounded-xl border border-stone-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-800">{group.detail}</p>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                    {group.employees.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {group.employees.map((e) => (
                    <li key={e.employeeId} className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openProfile(e.employeeId)}
                        className="text-left text-sm text-stone-700 hover:text-[#ED5C32] hover:underline"
                      >
                        {e.employeeName}
                      </button>
                      {kind === "expiring_document" && e.expiresAt && (
                        <span className="shrink-0 text-xs text-amber-600">Expira em {daysRemaining(e.expiresAt)} dias</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[#F5C992]/40 p-4">
          <button
            type="button"
            onClick={() => navigate(SEE_ALL_HREF_BY_PANEL[panel])}
            className="w-full rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Ver todos em Pessoas →
          </button>
        </div>
      </div>
    </div>
  );
}
