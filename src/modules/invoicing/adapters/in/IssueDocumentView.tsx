import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertBanner, Button, Dialog, FIELD, IconPlus, LABEL, NUMERIC, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";
import { DOCUMENT_TYPE_LABELS, PAYMENT_MECHANISM_LABELS } from "../../domain/entities/invoicing.ts";
import { emptyLine, estimateLineGross, type IssueForm, type IssueFormLine } from "../../domain/services/issue-form.service.ts";
import { useInvoicingMeta, useIssueDocument, useSeries } from "./use-invoicing.ts";

const TAX_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "INT", label: "13 % (refeições, bebidas não alcoólicas)" },
  { value: "NOR", label: "23 % (alcoólicas, refrigerantes)" },
  { value: "RED", label: "6 %" },
];

const emptyForm = (): IssueForm => ({ seriesRef: "", documentType: "", customerTaxId: "", customerName: "", paymentMechanism: "", lines: [emptyLine()] });

/** Emitir documento (testes): série, cliente (opcional) e linhas com preço com IVA. */
export function IssueDocumentView() {
  const { data: meta } = useInvoicingMeta();
  const { data: series } = useSeries();
  const issue = useIssueDocument();
  const [form, setForm] = useState<IssueForm>(emptyForm);

  const usable = useMemo(() => series.filter((s) => s.validationCode && (s.status ?? "active") === "active" && s.documentType !== "NC" && s.documentType !== "ND"), [series]);
  const exemptions = meta?.exemptions ?? [];

  const update = (patch: Partial<IssueForm>) => {
    issue.formChanged();
    setForm((f) => ({ ...f, ...patch }));
  };
  const updateLine = (i: number, patch: Partial<IssueFormLine>) => update({ lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const total = form.lines.reduce((sum, l) => sum + Number(estimateLineGross(l) ?? 0), 0);

  if (issue.issued) {
    return (
      <div className={`${SURFACE} space-y-3 p-6`}>
        <AlertBanner tone="success" title={`Documento ${issue.issued.documentNumber} emitido`}>
          ATCUD {issue.issued.atcud}
        </AlertBanner>
        <div className="flex gap-2">
          <Link to={`/vendas/documentos?abrir=${issue.issued.documentId}`} className="text-sm font-medium text-brand-600 underline">
            Ver o documento
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              issue.reset();
              setForm(emptyForm());
            }}
          >
            Emitir outro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void issue.submit(form);
      }}
    >
      <section className={`${SURFACE} grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4`}>
        <label className="sm:col-span-2">
          <span className={LABEL}>Série</span>
          <select
            className={FIELD}
            value={form.seriesRef}
            onChange={(e) => update({ seriesRef: e.target.value, documentType: usable.find((s) => s.ref === e.target.value)?.documentType ?? "" })}
          >
            <option value="">Escolher…</option>
            {usable.map((s) => (
              <option key={s.ref} value={s.ref}>
                {DOCUMENT_TYPE_LABELS[s.documentType]} — {s.seriesId}
                {s.mode === "training" ? " (formação)" : ""}
              </option>
            ))}
          </select>
          {usable.length === 0 && <span className="mt-1 block text-xs text-ink-secondary">Sem séries comunicadas à AT. Crie uma em «Séries».</span>}
        </label>
        <label>
          <span className={LABEL}>NIF do cliente (opcional)</span>
          <input className={FIELD} inputMode="numeric" value={form.customerTaxId} onChange={(e) => update({ customerTaxId: e.target.value })} placeholder="Consumidor final" />
        </label>
        <label>
          <span className={LABEL}>Nome do cliente</span>
          <input className={FIELD} value={form.customerName} onChange={(e) => update({ customerName: e.target.value })} disabled={!form.customerTaxId.trim()} />
        </label>
        {form.documentType === "FR" && (
          <label>
            <span className={LABEL}>Meio de pagamento</span>
            <select className={FIELD} value={form.paymentMechanism} onChange={(e) => update({ paymentMechanism: e.target.value })}>
              <option value="">Escolher…</option>
              {Object.entries(PAYMENT_MECHANISM_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className={`${SURFACE} overflow-x-auto`}>
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Código</th>
              <th className={TH}>Descrição</th>
              <th className={TH}>Qtd.</th>
              <th className={TH}>Preço c/ IVA</th>
              <th className={TH}>Desc. %</th>
              <th className={TH}>IVA</th>
              <th className={`${TH} text-right`}>Total</th>
              <th className={TH} aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {form.lines.map((l, i) => (
              <tr key={i} className={TR}>
                <td className={TD}>
                  <input aria-label={`Código da linha ${i + 1}`} className={`${FIELD} w-24`} value={l.productCode} onChange={(e) => updateLine(i, { productCode: e.target.value })} />
                </td>
                <td className={TD}>
                  <input aria-label={`Descrição da linha ${i + 1}`} className={`${FIELD} min-w-48`} value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                </td>
                <td className={TD}>
                  <input aria-label={`Quantidade da linha ${i + 1}`} className={`${FIELD} w-20`} inputMode="decimal" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                </td>
                <td className={TD}>
                  <input aria-label={`Preço da linha ${i + 1}`} className={`${FIELD} w-24`} inputMode="decimal" value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} />
                </td>
                <td className={TD}>
                  <input aria-label={`Desconto da linha ${i + 1}`} className={`${FIELD} w-20`} inputMode="decimal" value={l.discountPct} onChange={(e) => updateLine(i, { discountPct: e.target.value })} />
                </td>
                <td className={TD}>
                  <select aria-label={`IVA da linha ${i + 1}`} className={FIELD} value={l.tax} onChange={(e) => updateLine(i, { tax: e.target.value })}>
                    {TAX_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                    {exemptions.map((x) => (
                      <option key={x.code} value={x.code}>
                        Isento — {x.code} {x.mention}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${TD} ${NUMERIC} text-right`}>{estimateLineGross(l) ?? "—"}</td>
                <td className={TD}>
                  {form.lines.length > 1 && (
                    <Button variant="tertiary" size="sm" onClick={() => update({ lines: form.lines.filter((_, j) => j !== i) })}>
                      Remover
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-line-subtle p-4">
          <Button variant="secondary" icon={<IconPlus />} onClick={() => update({ lines: [...form.lines, emptyLine()] })}>
            Acrescentar linha
          </Button>
          <p className={`${NUMERIC} text-sm text-ink-secondary`}>
            Total estimado <span className="ml-2 text-lg font-semibold text-navy-900">{total.toFixed(2)} €</span>
          </p>
        </div>
      </section>

      {issue.errors.length > 0 && (
        <AlertBanner tone="danger" title="Não foi possível emitir">
          <ul className="list-disc pl-5">
            {issue.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </AlertBanner>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={issue.submitting} disabled={meta?.signingAvailable === false}>
          Emitir documento
        </Button>
      </div>

      <Dialog
        open={issue.warnings.length > 0}
        title="Confirmar emissão"
        onClose={() => issue.reset()}
        actions={
          <>
            <Button variant="secondary" onClick={() => issue.reset()}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void issue.submit(form, true)}>
              Emitir mesmo assim
            </Button>
          </>
        }
      >
        <ul className="list-disc pl-5 text-sm">
          {issue.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </Dialog>
    </form>
  );
}
