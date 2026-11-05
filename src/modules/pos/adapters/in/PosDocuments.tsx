import { useMemo, useState } from "react";
import { PAYMENT_LABELS, formatEuros, type PosEmployee, type PosSale } from "../../domain/entities/pos.ts";
import { usePosModule } from "../../pos.module.tsx";
import { PosPinPad } from "./PosPinPad.tsx";
import { errorText } from "./use-pos.ts";
import { POS, TOUCH } from "./pos-theme.ts";

const REASONS = ["Devolução do cliente", "Artigo com defeito", "Erro no registo"];
const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

/**
 * Nota de crédito de uma venda: quantidades por linha (até ao que falta
 * creditar), motivo obrigatório, confirmação e PIN de gestor. Nunca se anula.
 */
function RefundFlow({ sale, refunds, employee, onDone, onCancel }: { sale: PosSale; refunds: PosSale[]; employee: PosEmployee; onDone: (nc: PosSale) => void; onCancel: () => void }) {
  const { pos } = usePosModule();
  const left = useMemo(() => {
    const done = new Map<number, number>();
    for (const r of refunds) for (const l of r.lines) done.set(l.lineNumber, (done.get(l.lineNumber) ?? 0) + l.quantity);
    return new Map(sale.lines.map((l) => [l.lineNumber, l.quantity - (done.get(l.lineNumber) ?? 0)]));
  }, [sale, refunds]);
  const [qty, setQty] = useState<Map<number, number>>(new Map());
  const [reason, setReason] = useState(REASONS[0]!);
  const [other, setOther] = useState("");
  const [step, setStep] = useState<"edit" | "confirm" | "pin">("edit");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const finalReason = reason === "Outro" ? other.trim() : reason;
  const chosen = sale.lines.filter((l) => (qty.get(l.lineNumber) ?? 0) > 0);
  const estimate = chosen.reduce((s, l) => s + Math.round((l.totalCents * (qty.get(l.lineNumber) ?? 0)) / l.quantity), 0);

  const issue = async (pin: string) => {
    setBusy(true);
    setError(null);
    try {
      onDone(await pos.refund(sale.id, { pin, lines: chosen.map((l) => ({ lineNumber: l.lineNumber, quantity: qty.get(l.lineNumber)! })), reason: finalReason }));
    } catch (e) {
      setError(errorText(e));
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  };

  if (step === "pin") {
    return (
      <div className="flex justify-center">
        <PosPinPad title="PIN de gestor" subtitle={`Nota de crédito de ${formatEuros(estimate)}`} requireManager onCancel={() => setStep("confirm")} onSuccess={(_, pin) => void issue(pin)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Nota de crédito — {sale.documentNumber}</h3>
      {!employee.isManager && <p className={`${POS.amber} rounded-xl p-3 text-sm font-medium`}>Só um gestor pode emitir notas de crédito — no fim é pedido o PIN de um gestor.</p>}
      <ul className="space-y-2">
        {sale.lines.map((l) => {
          const max = left.get(l.lineNumber) ?? 0;
          const q = qty.get(l.lineNumber) ?? 0;
          return (
            <li key={l.lineNumber} className={`flex items-center gap-3 rounded-xl border ${POS.border} ${POS.card} p-3`}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.name}</span>
                <span className={`text-xs ${POS.mutedText}`}>
                  vendido {l.quantity} · por creditar {max}
                </span>
              </span>
              <button type="button" aria-label={`Menos ${l.name}`} disabled={q === 0 || step !== "edit"} onClick={() => setQty(new Map(qty).set(l.lineNumber, q - 1))} className={`${POS.secondary} h-11 w-11 rounded-xl text-xl disabled:opacity-40`}>
                −
              </button>
              <span className={`w-6 text-center font-bold ${POS.num}`}>{q}</span>
              <button type="button" aria-label={`Mais ${l.name}`} disabled={q >= max || step !== "edit"} onClick={() => setQty(new Map(qty).set(l.lineNumber, q + 1))} className={`${POS.secondary} h-11 w-11 rounded-xl text-xl disabled:opacity-40`}>
                +
              </button>
            </li>
          );
        })}
      </ul>
      <fieldset className="space-y-2" disabled={step !== "edit"}>
        <legend className="mb-1 text-sm font-medium">Motivo (obrigatório)</legend>
        <div className="flex flex-wrap gap-2">
          {[...REASONS, "Outro"].map((r) => (
            <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={`h-10 rounded-full border px-4 text-sm ${POS.border} ${reason === r ? POS.accent : POS.card}`}>
              {r}
            </button>
          ))}
        </div>
        {reason === "Outro" && <input aria-label="Outro motivo" value={other} maxLength={200} onChange={(e) => setOther(e.target.value)} className={`h-11 w-full rounded-xl border ${POS.border} ${POS.card} px-3`} />}
      </fieldset>
      {error && (
        <p role="alert" className={`${POS.red} rounded-xl p-3 text-sm font-medium`}>
          {error}
        </p>
      )}
      {step === "edit" ? (
        <div className="flex gap-2">
          <button type="button" disabled={chosen.length === 0 || finalReason.length < 3} onClick={() => setStep("confirm")} className={`${TOUCH} ${POS.primary}`}>
            Continuar
          </button>
          <button type="button" onClick={onCancel} className={`${TOUCH} ${POS.secondary}`}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className={`${POS.muted} space-y-3 rounded-xl p-4`}>
          <p className="font-medium">
            Emitir nota de crédito de <span className={POS.num}>{formatEuros(estimate)}</span> ({PAYMENT_LABELS[sale.paymentMethod]}), motivo «{finalReason}»? Uma nota de crédito não se pode anular.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => setStep("pin")} className={`${TOUCH} ${POS.primary}`}>
              Confirmar com PIN de gestor
            </button>
            <button type="button" disabled={busy} onClick={() => setStep("edit")} className={`${TOUCH} ${POS.secondary}`}>
              Rever
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Faturas e notas de crédito do dia; nunca se editam nem se apagam. */
export function PosDocuments({ documents, employee, onOpen, onRefunded }: { documents: PosSale[]; employee: PosEmployee; onOpen: (s: PosSale) => void; onRefunded: (nc: PosSale) => void }) {
  const [refunding, setRefunding] = useState<PosSale | null>(null);
  if (refunding) {
    return <RefundFlow sale={refunding} refunds={documents.filter((d) => d.refundOf === refunding.id)} employee={employee} onCancel={() => setRefunding(null)} onDone={(nc) => (setRefunding(null), onRefunded(nc))} />;
  }
  if (documents.length === 0) return <p className={`py-10 text-center ${POS.mutedText}`}>Ainda não há documentos hoje.</p>;
  return (
    <ul className="space-y-2">
      {[...documents].reverse().map((d) => (
        <li key={d.id} className={`flex items-center gap-3 rounded-xl border ${POS.border} ${POS.card} p-3`}>
          <span className={`w-14 text-sm ${POS.mutedText} ${POS.num}`}>{time(d.createdAt)}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{d.documentNumber}</span>
            <span className={`text-xs ${POS.mutedText}`}>
              {d.kind === "refund" ? `Nota de crédito · ${d.reason}` : `${PAYMENT_LABELS[d.paymentMethod]} · ${d.employeeName}`}
            </span>
          </span>
          <span className={`font-semibold ${POS.num} ${d.kind === "refund" ? "text-red-700" : ""}`}>{d.kind === "refund" ? "−" : ""}{formatEuros(d.totalCents)}</span>
          <button type="button" onClick={() => onOpen(d)} className={`${POS.secondary} h-10 rounded-lg px-3 text-sm font-medium`}>
            Ver
          </button>
          {d.kind === "sale" && (
            <button type="button" onClick={() => setRefunding(d)} className={`${POS.secondary} h-10 rounded-lg px-3 text-sm font-medium`}>
              Nota de crédito
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
