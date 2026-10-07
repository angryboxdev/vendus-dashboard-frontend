import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { PortalNotLinkedError, PunchRefusedError, type PunchKind } from "../../domain/entities/portal.ts";
import {
  dayLabel,
  LOCATION_NOTICE,
  punchStateLabel,
  punchSuccessMessage,
  refusalMessage,
  shiftHours,
} from "../../domain/services/portal-text.service.ts";
import { PORTAL_HOME_QUERY_KEY, usePortalHome } from "./use-portal-home.ts";
import { DocumentsAlert } from "./DocumentsAlert.tsx";

function todayLisbon(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}

type Feedback = { tone: "success" | "warning" | "error"; text: string } | null;

/** Início do Portal: próximo turno, estado da picagem e o botão principal (ticket 03/04/05). */
export function PortalHomeView() {
  const { registerPunch, newIdempotencyKey } = useEmployeePortalModule();
  const qc = useQueryClient();
  const { data: home, isLoading, error, refetch } = usePortalHome();
  const [busy, setBusy] = useState<null | "locating" | "sending">(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // Uma chave por intenção: se a resposta se perder e o colaborador tocar de novo, o servidor reconhece o pedido.
  const pendingKey = useRef<{ kind: PunchKind; key: string } | null>(null);

  if (isLoading) return <p className="py-16 text-center text-sm text-stone-500">A carregar…</p>;
  if (error || !home) {
    const notLinked = error instanceof PortalNotLinkedError;
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm text-stone-600">
          {notLinked ? "Esta conta ainda não está ligada a uma ficha de colaborador. Fale com o seu gestor." : "Não foi possível carregar o Portal."}
        </p>
        {!notLinked && (
          <button onClick={() => void refetch()} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700">
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  const { punch, nextShift } = home;
  const action = punch.action;
  const blocked = punch.blockedReason;
  const today = todayLisbon();

  async function handlePunch() {
    if (!action || busy) return;
    if (!pendingKey.current || pendingKey.current.kind !== action) pendingKey.current = { kind: action, key: newIdempotencyKey() };
    setFeedback(null);
    setBusy(punch.geofencePolicy === "off" ? "sending" : "locating");
    try {
      const result = await registerPunch.execute({ kind: action, geofencePolicy: punch.geofencePolicy, idempotencyKey: pendingKey.current.key });
      pendingKey.current = null;
      setFeedback({ tone: result.flagged ? "warning" : "success", text: punchSuccessMessage(result) });
      await qc.invalidateQueries({ queryKey: PORTAL_HOME_QUERY_KEY });
    } catch (e) {
      // Recusa de negócio: a intenção acabou (um novo toque é uma nova tentativa). Falha de rede: mantém a chave.
      if (e instanceof PunchRefusedError) pendingKey.current = null;
      setFeedback({ tone: "error", text: e instanceof Error ? e.message : "Não foi possível registar." });
      void qc.invalidateQueries({ queryKey: PORTAL_HOME_QUERY_KEY });
    } finally {
      setBusy(null);
    }
  }

  const buttonLabel = busy === "locating" ? "A obter localização…" : busy === "sending" ? "A registar…" : action === "out" ? "Registar saída" : "Registar entrada";
  const disabled = !action || !!blocked || !!busy;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-stone-900">Olá, {home.employee.shortName}</h1>

      <DocumentsAlert />
      <section className="rounded-2xl border border-[#F5C992]/50 bg-white p-5 shadow-sm" aria-label="Próximo turno">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Próximo turno</p>
        {nextShift ? (
          <>
            <p className="mt-1 text-2xl font-semibold text-stone-900">
              {dayLabel(nextShift.workDate, today)} · {shiftHours(nextShift)}
            </p>
            <p className="text-sm text-stone-600">{nextShift.locationName}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-stone-600">Sem turnos publicados nos próximos dias.</p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-[#F5C992]/50 bg-white p-5 shadow-sm" aria-label="Picagem">
        <p className="text-sm font-medium text-stone-700" data-testid="punch-state">
          {punchStateLabel(punch)}
        </p>

        {action && (
          <button
            onClick={() => void handlePunch()}
            disabled={disabled}
            className={`w-full rounded-xl px-4 py-4 text-lg font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${
              action === "out" ? "bg-stone-800 active:bg-stone-900" : "bg-[#ED5C32] active:bg-[#d94f28]"
            }`}
          >
            {buttonLabel}
          </button>
        )}

        {blocked && <p className="text-sm text-stone-600">{refusalMessage(blocked)}</p>}

        {feedback && (
          <p
            role="status"
            className={`rounded-lg px-3 py-2 text-sm ${
              feedback.tone === "success" ? "bg-emerald-50 text-emerald-800" : feedback.tone === "warning" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"
            }`}
          >
            {feedback.text}
          </p>
        )}

        {action && punch.geofencePolicy !== "off" && <p className="text-xs text-stone-400">{LOCATION_NOTICE}</p>}
      </section>
    </div>
  );
}
