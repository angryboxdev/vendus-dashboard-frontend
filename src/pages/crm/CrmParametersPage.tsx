import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchParameters, patchParameter } from "./crmApi";
import { crmQueryKeys } from "./crmQueryKeys";
import type { CrmParameter } from "./crm.types";

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ParamRow({ param }: { param: CrmParameter }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(param.value);

  const mutation = useMutation({
    mutationFn: () => patchParameter(param.key, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crmQueryKeys.parameters() });
      setEditing(false);
    },
  });

  function handleCancel() {
    setValue(param.value);
    setEditing(false);
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3 align-top">
        <p className="font-mono text-xs text-slate-700">{param.key}</p>
        {param.description && (
          <p className="mt-0.5 text-xs text-slate-400">{param.description}</p>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm font-mono focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") mutation.mutate();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {mutation.isPending ? "..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group flex items-center gap-2"
          >
            <span className="font-mono text-sm text-slate-900">
              {param.value}
            </span>
            <span className="invisible text-xs text-slate-400 group-hover:visible">
              Editar
            </span>
          </button>
        )}
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">{String(mutation.error)}</p>
        )}
      </td>
      <td className="hidden px-4 py-3 text-xs text-slate-400 lg:table-cell">
        {formatDate(param.updatedAt)}
      </td>
    </tr>
  );
}

export function CrmParametersPage() {
  const { data: params = [], isLoading } = useQuery({
    queryKey: crmQueryKeys.parameters(),
    queryFn: fetchParameters,
    staleTime: 60 * 1000,
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <p className="mb-4 text-sm text-slate-500">
        Parâmetros de segmentação e comportamento do CRM. Clique num valor para
        editar.
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                Parâmetro
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                Valor
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium text-slate-500 lg:table-cell">
                Última alteração
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  A carregar...
                </td>
              </tr>
            ) : (
              params.map((p) => <ParamRow key={p.key} param={p} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
