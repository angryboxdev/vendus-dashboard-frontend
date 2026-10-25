import type { PaymentDocumentImportDTO } from "../../domain/entities/payment-document.ts";
import { MATCH_REASON_LABELS, PAYMENT_DOCUMENT_TITLES } from "../../domain/entities/payment-document.ts";

const eur = (cents: number | null) =>
  cents === null ? "—" : (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
const date = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const period = (p: string | null) => (p ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : "—");
/** Referência de pagamento ao Estado em grupos de 3 (como impressa); MB em 3+3+3. */
const groups = (ref: string | null) => (ref ? ref.replace(/(\d{3})(?=\d)/g, "$1 ") : "—");

const STATUS_LABELS: Record<string, string> = { paid: "paga", pending: "por pagar", overdue: "em atraso", draft_ai: "rascunho", pending_review: "por rever" };

interface Props {
  result: PaymentDocumentImportDTO;
  busy: boolean;
  onOpenExisting(invoiceId: string): void;
  /** Ligar este documento ao registo existente (em vez de criar outro). */
  onLinkExisting?(invoiceId: string): void;
  /** `force`: a pessoa confirmou que quer criar outro apesar do registo parecido. */
  onCreateDraft(force: boolean): void;
  onClose(): void;
}

/**
 * Revisão de um documento de cobrança (Finanças / Segurança Social): mostra os
 * campos lidos e a origem, o estado do código de barras, avisos e as obrigações
 * já registadas que parecem ser a mesma. Nada é gravado aqui.
 */
export function PaymentDocumentReview({ result, busy, onOpenExisting, onLinkExisting, onCreateDraft, onClose }: Props) {
  const p = result.payment;
  const strong = result.matches.filter((m) => m.strength === "strong");
  const src = (k: keyof typeof p.fieldSources) => (p.fieldSources[k] === "barcode" ? "código de barras" : "texto do documento");

  const fields: [label: string, value: string, hint?: string][] = p.issuer === "AT"
    ? [
        ["Nº do documento", p.documentNumber ?? "—", src("documentNumber")],
        ["NIF", p.taxpayerNif ?? "—", src("taxpayerNif")],
        ["Período", period(p.period), src("period")],
        ["Imposto", p.lines.map((l) => l.description).join(" · ") || "—"],
        ["Referência para pagamento", groups(p.paymentReference), src("paymentReference")],
        ["Valor a pagar", eur(p.totalCents), src("totalCents")],
        ["Data limite", date(p.dueDate), src("dueDate")],
        ["Receção da declaração", p.declarationReceivedAt ?? "—", "não é prova de pagamento"],
      ]
    : [
        ["NIF", p.taxpayerNif ?? "—", src("taxpayerNif")],
        ["Período contributivo", period(p.period), src("period")],
        ["Entidade (Multibanco)", p.mbEntity ?? "—", src("mbEntity")],
        ["Referência (Multibanco)", groups(p.paymentReference), src("paymentReference")],
        ["Contribuições", eur(p.amountCents)],
        ["Juros", eur(p.interestCents)],
        ["Total a pagar", eur(p.totalCents), src("totalCents")],
        ["Emissão", date(p.issueDate)],
        ["Validade", date(p.dueDate), src("dueDate")],
      ];

  const barcode =
    p.barcode.status === "decoded"
      ? { tone: "text-emerald-700 bg-emerald-50", text: `Código de barras CODE128 lido (${p.barcode.payload.length} dígitos)${p.barcodePrintedText ? " — igual ao valor impresso" : ""}` }
      : p.barcode.status === "unreadable"
        ? { tone: "text-amber-700 bg-amber-50", text: "Código de barras visível mas ilegível — campos lidos do texto" }
        : { tone: "text-stone-500 bg-stone-100", text: "Sem código de barras (não é necessário)" };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Documento de cobrança</p>
        <h3 className="mt-0.5 text-sm font-semibold text-stone-900">{PAYMENT_DOCUMENT_TITLES[p.subtype]}</h3>
        <p className="mt-1 text-xs text-stone-500">
          Não é uma fatura de fornecedor: IVA não aplicável, sem linhas nem Stock. A leitura não cria dívida nem marca como pago — o rascunho só passa a conta a pagar quando o confirmar.
        </p>
      </div>

      {strong.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Esta obrigação parece já estar registada.</p>
          <p className="mt-0.5">Abra o registo existente em vez de lançar outra vez.</p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-xl border border-stone-100 bg-stone-50/60 p-4">
        {fields.map(([label, value, hint]) => (
          <div key={label}>
            <dt className="text-[11px] text-stone-400">{label}</dt>
            <dd className="text-sm font-medium tabular-nums text-stone-800">{value}</dd>
            {hint && <dd className="text-[10px] text-stone-400">{hint}</dd>}
          </div>
        ))}
        <div>
          <dt className="text-[11px] text-stone-400">IVA</dt>
          <dd className="text-sm font-medium text-stone-800">Não aplicável</dd>
        </div>
      </dl>

      <p className={`rounded-md px-3 py-1.5 text-xs ${barcode.tone}`}>{barcode.text}</p>

      {p.issues.length > 0 && (
        <ul className="space-y-1">
          {p.issues.map((i) => (
            <li key={i.code + i.detail} className={`rounded-md px-3 py-1.5 text-xs ${i.blocking ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
              {i.detail}
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Já registado no Financeiro</p>
        {result.matches.length === 0 ? (
          <p className="text-xs text-stone-500">Nenhuma obrigação parecida encontrada.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-100">
            {result.matches.map((m) => (
              <li key={m.existing.source + m.existing.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-stone-800">
                    {m.existing.supplierName} · {m.existing.label || "sem número"}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    {eur(m.existing.amountCents)} · prazo {date(m.existing.dueDate)} · {STATUS_LABELS[m.existing.status] ?? m.existing.status} ·{" "}
                    <span className={m.strength === "strong" ? "font-medium text-amber-700" : ""}>{m.reasons.map((r) => MATCH_REASON_LABELS[r]).join(", ")}</span>
                  </p>
                </div>
                {m.existing.invoiceId && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onOpenExisting(m.existing.invoiceId!)}
                      className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                    >
                      Abrir
                    </button>
                    {onLinkExisting && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onLinkExisting(m.existing.invoiceId!)}
                        title="Este registo passa a obrigação (referência e período) e fica com o PDF; não cria outro nem mexe em valores ou pagamentos"
                        className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        Ligar este documento
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {result.supplierSuggestion && (
          <p className="mt-2 text-[11px] text-stone-500">Fornecedor habitual para este organismo: {result.supplierSuggestion.name}.</p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-stone-100 pt-3">
        <p className="text-[10px] text-stone-400">Lido no servidor em {(result.metrics.totalMs / 1000).toFixed(1)} s, sem IA.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-50">
            Fechar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (strong.length && !window.confirm("Já existe um registo que parece ser esta obrigação. Criar outro mesmo assim?")) return;
              onCreateDraft(strong.length > 0);
            }}
            className="rounded-md bg-[#ED5C32] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            title="Cria um rascunho com o valor, o prazo e a referência; a conta a pagar nasce quando confirmar a revisão"
          >
            {busy ? "A processar…" : "Criar rascunho de obrigação"}
          </button>
        </div>
      </div>
    </div>
  );
}
