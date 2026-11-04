import { useState } from "react";
import { Button, FIELD, LABEL } from "../../../../components/ui/index.ts";
import { EMPTY_AT_CREDENTIALS, type AtCredentialsInput, type Series } from "../../domain/entities/invoicing.ts";
import { useInvoicingModule } from "../../invoicing.module.tsx";
import { AtCredentialsFields } from "./AtCredentialsFields.tsx";

type Action = "register" | "finalize" | "cancel";

const LABELS: Record<Action, string> = { register: "Registar na AT", finalize: "Finalizar na AT", cancel: "Anular na AT" };

/**
 * Operações da série no webservice da AT, com o subutilizador WSE pedido no
 * momento (nunca guardado — manual de Séries, Aspetos genéricos §2).
 */
export function AtSeriesActions({ series, onDone }: { series: Series; onDone: () => Promise<void> }) {
  const { invoicing } = useInvoicingModule();
  const [action, setAction] = useState<Action | null>(null);
  const [creds, setCreds] = useState<AtCredentialsInput>(EMPTY_AT_CREDENTIALS);
  const [justification, setJustification] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const available: Action[] = series.validationCode === null ? ["register"] : series.status === "active" || !series.status ? [series.lastSequence > 0 ? "finalize" : "cancel"] : [];
  if (available.length === 0) return null;

  if (!action) {
    return (
      <div className="flex gap-2">
        {available.map((a) => (
          <Button key={a} size="sm" onClick={() => setAction(a)}>
            {LABELS[a]}
          </Button>
        ))}
      </div>
    );
  }

  const close = () => {
    setAction(null);
    setCreds(EMPTY_AT_CREDENTIALS);
    setJustification("");
    setErrors([]);
  };

  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const out =
            action === "register"
              ? await invoicing.registerSeriesAt(series.ref, creds)
              : action === "finalize"
                ? await invoicing.finalizeSeriesAt(series.ref, creds, justification)
                : await invoicing.cancelSeriesAt(series.ref, creds);
          setErrors(out);
          if (out.length === 0) {
            close();
            await onDone();
          }
        } catch (err) {
          setErrors([err instanceof Error ? err.message : "Erro inesperado"]);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-xs text-ink-secondary sm:col-span-2">Subutilizador com a autorização «WSE – Comunicação e gestão de séries». A senha não é guardada.</p>
      <AtCredentialsFields value={creds} onChange={setCreds} />
      {action === "finalize" && (
        <label className="sm:col-span-2">
          <span className={LABEL}>Justificação (opcional)</span>
          <input className={FIELD} value={justification} maxLength={4000} onChange={(e) => setJustification(e.target.value)} />
        </label>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" variant="primary" loading={busy}>
          {LABELS[action]}
        </Button>
        <Button type="button" size="sm" onClick={close}>
          Cancelar
        </Button>
      </div>
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-red-700 sm:col-span-2">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
