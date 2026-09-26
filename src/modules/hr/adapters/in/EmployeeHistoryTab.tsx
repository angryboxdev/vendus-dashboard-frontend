import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { HISTORY_ACTION_LABELS } from "../../domain/entities/employee.ts";

const PAGE_SIZE = 20;

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmployeeHistoryTab({ employeeId }: { employeeId: string }) {
  const { api } = useHrModule();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-people-history", employeeId, page],
    queryFn: () => api.getEmployeeHistory(employeeId, page, PAGE_SIZE),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (isLoading) return <p className="py-8 text-center text-sm text-stone-400">A carregar…</p>;

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-stone-400">Sem eventos registados ainda.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-stone-100 rounded-xl border border-[#F5C992]/40 bg-white">
        {items.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                entry.entityType === "employee_document" ? "bg-violet-400" : "bg-[#ED5C32]"
              }`}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-stone-800">
                {HISTORY_ACTION_LABELS[entry.action] ?? entry.action}
              </p>
              <p className="text-xs text-stone-500">{entry.description}</p>
            </div>
            <div className="shrink-0 text-right text-xs text-stone-400">
              <p>{formatDateTime(entry.createdAt)}</p>
              <p>{entry.actor}</p>
            </div>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm text-stone-500">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg px-2 py-1 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ←
          </button>
          <span className="tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg px-2 py-1 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
