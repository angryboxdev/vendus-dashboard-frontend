import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";

/**
 * "Acesso ao Portal" na ficha do colaborador (Portal do Colaborador, ticket
 * 02). Dar acesso liga a conta existente com o mesmo email (gestor que também
 * é colaborador) ou cria uma conta só do Portal com palavra-passe temporária,
 * mostrada uma única vez. Nunca cria um colaborador.
 */
export function PortalAccessCard({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const queryKey = ["hr-portal-access", employeeId];
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const { data: access, isLoading } = useQuery({ queryKey, queryFn: () => api.getPortalAccess(employeeId) });

  const grant = useMutation({
    mutationFn: () => api.grantPortalAccess(employeeId),
    onSuccess: (result) => {
      setTemporaryPassword(result.temporaryPassword);
      qc.setQueryData(queryKey, { hasAccess: result.hasAccess, email: result.email, accountKind: result.accountKind });
    },
  });

  const revoke = useMutation({
    mutationFn: () => api.revokePortalAccess(employeeId),
    onSuccess: () => {
      setTemporaryPassword(null);
      void qc.invalidateQueries({ queryKey });
    },
  });

  function handleRevoke() {
    const message =
      access?.accountKind === "employee"
        ? `Retirar o acesso ao Portal a ${employeeName}? A conta do Portal é apagada.`
        : `Retirar o acesso ao Portal a ${employeeName}? A conta de gestão mantém-se, só deixa de estar ligada a esta ficha.`;
    if (window.confirm(message)) revoke.mutate();
  }

  const error = grant.error ?? revoke.error;

  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white p-5" aria-label="Acesso ao Portal">
      <h3 className="text-sm font-semibold text-stone-800">Acesso ao Portal do Colaborador</h3>
      <p className="mt-1 text-xs text-stone-500">Turnos, picagem pelo telemóvel, documentos e ausências do próprio colaborador.</p>

      {isLoading ? (
        <p className="mt-3 text-xs text-stone-400">A carregar…</p>
      ) : access?.hasAccess ? (
        <div className="mt-3 space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Com acesso · {access.email}
            {access.accountKind === "staff" && " (conta de gestão)"}
          </span>
          {temporaryPassword && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Palavra-passe temporária (só é mostrada agora):</p>
              <p className="mt-1 select-all font-mono text-base tracking-wider">{temporaryPassword}</p>
              <p className="mt-1">Entregue-a ao colaborador em mão. No primeiro acesso terá de a mudar.</p>
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={revoke.isPending}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-stone-50 disabled:opacity-50"
            >
              Retirar acesso
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => grant.mutate()}
            disabled={grant.isPending}
            className="rounded-lg bg-[#ED5C32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#d94f28] disabled:opacity-50"
          >
            {grant.isPending ? "A dar acesso…" : "Dar acesso ao Portal"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error instanceof Error ? error.message : "Erro"}</p>}
    </div>
  );
}
