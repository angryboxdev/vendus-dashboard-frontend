import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { AlertBanner, Button, Drawer, FIELD, LABEL, NUMERIC, StatusBadge, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";
import { DOCUMENT_TYPE_LABELS, PAYMENT_MECHANISM_LABELS, STATUS_LABELS, type DocumentView } from "../../domain/entities/invoicing.ts";
import { useDocument, useInvoicingMeta } from "./use-invoicing.ts";

const statusTone = (s: DocumentView["status"]) => (s === "A" ? "danger" : s === "F" ? "neutral" : "success");

/** Representação impressa: ATCUD imediatamente acima do QR (Portaria 195/2020 art. 4.º; QR ECC M, versão ≥ 9, ≥ 30 mm). */
function FiscalFooter({ doc }: { doc: DocumentView }) {
  return (
    <div className="flex items-end gap-4 border-t border-line-subtle pt-4">
      <div className="text-center">
        <p className="mb-1 font-mono text-xs text-ink">{doc.printed.atcud}</p>
        <QRCodeSVG value={doc.qrPayload} level="M" minVersion={9} marginSize={2} style={{ width: "30mm", height: "30mm" }} aria-label="Código QR do documento" />
      </div>
      <ul className="space-y-1 text-xs text-ink-secondary">
        {doc.printed.mentions.map((m) => (
          <li key={m} className={m.startsWith("DOCUMENTO DE TESTE") ? "font-semibold text-red-700" : ""}>
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocumentDetail({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { doc, loading, error, cancel } = useDocument(id);
  const { data: meta } = useInvoicingMeta();
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const doCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancel(reasonCode, note || undefined);
      setReasonCode("");
      setNote("");
      onChanged();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Erro ao anular");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Drawer open={id !== null} onClose={onClose} title={doc ? `${DOCUMENT_TYPE_LABELS[doc.documentType]} ${doc.documentNumber}` : "Documento"} width="max-w-2xl">
      {loading && <p className="text-sm text-ink-secondary">A carregar…</p>}
      {error && <AlertBanner tone="danger" title="Não foi possível abrir o documento">{error}</AlertBanner>}
      {doc && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone(doc.status)}>{STATUS_LABELS[doc.status]}</StatusBadge>
            {doc.seriesMode === "training" && <StatusBadge tone="warning">Formação</StatusBadge>}
            <span className="text-ink-secondary">
              {doc.documentDate} · emitido {doc.systemEntryDate.replace("T", " ")}
            </span>
          </div>
          {doc.status === "A" && doc.statusReason && <AlertBanner tone="danger" title="Anulado">{doc.statusReason}</AlertBanner>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className={LABEL}>Emitente</p>
              <p className="font-medium text-ink">{doc.issuer.name}</p>
              <p className="text-ink-secondary">NIF {doc.issuer.taxId}</p>
            </div>
            <div>
              <p className={LABEL}>Cliente</p>
              <p className="font-medium text-ink">{doc.customer.name}</p>
              <p className="text-ink-secondary">NIF {doc.customer.taxId}</p>
            </div>
          </div>

          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Descrição</th>
                <th className={`${TH} text-right`}>Qtd.</th>
                <th className={`${TH} text-right`}>Preço</th>
                <th className={`${TH} text-right`}>IVA</th>
                <th className={`${TH} text-right`}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l) => (
                <tr key={l.lineNumber} className={TR}>
                  <td className={TD}>
                    {l.description}
                    {l.exemptionReason && <span className="block text-xs text-ink-secondary">{l.exemptionCode} — {l.exemptionReason}</span>}
                  </td>
                  <td className={`${TD} ${NUMERIC} text-right`}>{l.quantity}</td>
                  <td className={`${TD} ${NUMERIC} text-right`}>{l.unitPrice}</td>
                  <td className={`${TD} ${NUMERIC} text-right`}>{l.taxCode === "ISE" ? "Isento" : `${l.taxPercentage} %`}</td>
                  <td className={`${TD} ${NUMERIC} text-right`}>{l.lineAmount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className={`${NUMERIC} ml-auto grid w-64 grid-cols-2 gap-1`}>
            {doc.taxes.map((t) => (
              <div key={`${t.taxCode}${t.taxPercentage}${t.exemptionCode ?? ""}`} className="contents">
                <dt className="text-ink-secondary">{t.taxCode === "ISE" ? `Isento (${t.exemptionCode})` : `Base ${t.taxPercentage} %`}</dt>
                <dd className="text-right">
                  {t.taxableBase}
                  {t.taxCode !== "ISE" && <span className="text-ink-secondary"> + {t.taxAmount}</span>}
                </dd>
              </div>
            ))}
            <dt className="text-ink-secondary">Sem IVA</dt>
            <dd className="text-right">{doc.netTotal}</dd>
            <dt className="text-ink-secondary">IVA</dt>
            <dd className="text-right">{doc.taxPayable}</dd>
            <dt className="font-semibold text-navy-900">Total</dt>
            <dd className="text-right font-semibold text-navy-900">{doc.grossTotal} €</dd>
          </dl>
          {doc.paymentMechanism && <p className="text-ink-secondary">Pagamento: {PAYMENT_MECHANISM_LABELS[doc.paymentMechanism] ?? doc.paymentMechanism}</p>}
          {doc.referencesTo.length > 0 && <p className="text-ink-secondary">Retifica: {doc.referencesTo.map((r) => r.documentNumber).join(", ")}</p>}
          {doc.orderReferences.length > 0 && <p className="text-ink-secondary">Consultas de mesa: {doc.orderReferences.map((r) => r.documentNumber).join(", ")}</p>}

          <FiscalFooter doc={doc} />

          {doc.status === "N" && meta && (
            <section className="space-y-2 rounded-xl border border-line p-4">
              <p className="font-medium text-navy-900">Anular documento</p>
              <p className="text-xs text-ink-secondary">Só para erros que não mexem em valores nem no IVA. Para corrigir valores, emita uma nota de crédito.</p>
              <label>
                <span className={LABEL}>Motivo</span>
                <select className={FIELD} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                  <option value="">Escolher…</option>
                  {meta.cancelReasons.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={LABEL}>Nota (opcional)</span>
                <input className={FIELD} value={note} maxLength={40} onChange={(e) => setNote(e.target.value)} />
              </label>
              {cancelError && <p className="text-xs text-red-700">{cancelError}</p>}
              <Button variant="danger" disabled={!reasonCode} loading={cancelling} onClick={() => void doCancel()}>
                Anular
              </Button>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
