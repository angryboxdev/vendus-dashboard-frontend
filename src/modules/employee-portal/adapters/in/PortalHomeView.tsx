import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AppIcon, FOCUS_RING } from "../../../../components/ui";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { PortalNotLinkedError, PunchRefusedError, type PunchKind } from "../../domain/entities/portal.ts";
import {
  dayLabel,
  longDateLabel,
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

  if (isLoading) return <p className="py-16 text-center text-sm text-ink-secondary">A carregar…</p>;
  if (error || !home) {
    const notLinked = error instanceof PortalNotLinkedError;
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm text-ink-secondary">
          {notLinked ? "Esta conta ainda não está ligada a uma ficha de colaborador. Fale com o seu gestor." : "Não foi possível carregar o Portal."}
        </p>
        {!notLinked && (
          <button onClick={() => void refetch()} className="min-h-11 rounded-xl border border-line bg-surface-card px-4 text-sm font-medium text-navy-900">
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

  const working = punch.state === "in";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Olá, {home.employee.shortName}</h1>
        <p className="mt-0.5 text-sm text-ink-secondary">{longDateLabel(today)}</p>
      </div>

      <DocumentsAlert />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2.5xl border border-line bg-surface-card p-5 shadow-card" aria-label="Próximo turno">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            <AppIcon name="rosters" size={16} />
            Próximo turno
          </p>
          {nextShift ? (
            <>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-900">
                {dayLabel(nextShift.workDate, today)} · {shiftHours(nextShift)}
              </p>
              {nextShift.endsNextDay && <p className="text-xs text-ink-secondary">Termina no dia seguinte</p>}
              {nextShift.locationName && <p className="mt-1 text-sm text-ink-secondary">{nextShift.locationName}</p>}
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-secondary">Sem turnos publicados nos próximos dias.</p>
          )}
          <Link to="/portal/escala" className={`mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-600 ${FOCUS_RING} rounded-lg`}>
            Ver a minha escala
            <AppIcon name="chevronRight" size={16} />
          </Link>
        </section>

        <section className="space-y-4 rounded-2.5xl border border-line bg-surface-card p-5 shadow-card" aria-label="Picagem">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${working ? "bg-emerald-500" : "bg-line"}`} />
            <span data-testid="punch-state">{punchStateLabel(punch)}</span>
          </p>

          {action && (
            <button
              onClick={() => void handlePunch()}
              disabled={disabled}
              className={`h-14 w-full rounded-2xl px-4 text-lg font-semibold text-white transition-colors disabled:opacity-50 ${FOCUS_RING} ${
                action === "out" ? "bg-navy-900 active:bg-navy-950" : "bg-brand-600 active:bg-brand-500"
              }`}
            >
              {buttonLabel}
            </button>
          )}

          {blocked && <p className="text-sm text-ink-secondary">{refusalMessage(blocked)}</p>}

          {feedback && (
            <p
              role="status"
              className={`rounded-xl px-3 py-2 text-sm ${
                feedback.tone === "success" ? "bg-emerald-50 text-emerald-800" : feedback.tone === "warning" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"
              }`}
            >
              {feedback.text}
            </p>
          )}

          {action && punch.geofencePolicy !== "off" && (
            <p className="flex items-start gap-1.5 text-xs text-ink-secondary">
              <AppIcon name="address" size={14} className="mt-0.5 shrink-0" />
              {LOCATION_NOTICE}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
