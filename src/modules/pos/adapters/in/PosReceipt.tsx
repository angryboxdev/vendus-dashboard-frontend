import { QRCodeSVG } from "qrcode.react";
import { PAYMENT_LABELS, formatEuros, type PosSale, type ReceiptDocument } from "../../domain/entities/pos.ts";

const eur = (v: string) => formatEuros(Math.round(Number(v) * 100));
const DASH = "border-t border-dashed border-black/60";

/**
 * Talão de 80 mm (impressora térmica ou browser): dados do documento gravado
 * (2.ª via), com o ATCUD imediatamente acima do QR (Portaria 195/2020, art. 4.º;
 * QR nível M, versão ≥ 9, 30 mm) e as menções fiscais — incluindo
 * «DOCUMENTO DE TESTE – SEM VALOR FISCAL» enquanto não há certificado.
 */
export function PosReceipt({ doc, sale }: { doc: ReceiptDocument; sale: PosSale }) {
  const isCredit = sale.kind === "refund";
  return (
    <article className="pos-print mx-auto w-[80mm] bg-white p-3 font-mono text-[11px] leading-snug text-black" aria-label={`Documento ${doc.documentNumber}`}>
      {doc.printed.mentions.filter((m) => m.startsWith("DOCUMENTO DE TESTE")).map((m) => (
        <p key={m} className="mb-2 border-2 border-dashed border-red-600 px-1 py-1 text-center font-bold text-red-700">
          {m}
        </p>
      ))}
      <header className="text-center">
        <p className="text-[13px] font-bold">{doc.issuer.name}</p>
        <p>NIF {doc.issuer.taxId}</p>
        <p>{doc.issuer.address.street}</p>
        <p>
          {doc.issuer.address.postalCode} {doc.issuer.address.city}
        </p>
      </header>
      <div className={`${DASH} my-2`} />
      <p className="font-bold">{isCredit ? "NOTA DE CRÉDITO" : "FATURA-RECIBO"}</p>
      <p>{doc.documentNumber}</p>
      <p>{doc.systemEntryDate.replace("T", " ")}</p>
      <p>
        Cliente: {doc.customer.name}
        {doc.customer.taxId !== "999999990" && ` · NIF ${doc.customer.taxId}`}
      </p>
      <p>Atendido por: {sale.employeeName}</p>
      {doc.referencesTo.length > 0 && (
        <p>
          Retifica: {doc.referencesTo.map((r) => r.documentNumber).join(", ")}
          {sale.reason && ` — ${sale.reason}`}
        </p>
      )}
      <div className={`${DASH} my-2`} />
      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th className="font-normal">Artigo</th>
            <th className="text-right font-normal">IVA</th>
            <th className="text-right font-normal">Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l) => (
            <tr key={l.lineNumber} className="align-top">
              <td className="pr-1">
                {l.description}
                <br />
                {l.quantity} × {eur(l.unitPrice)}
                {l.discountPct && Number(l.discountPct) > 0 && ` −${Number(l.discountPct).toLocaleString("pt-PT", { maximumFractionDigits: 2 })} %`}
                <span className="text-black/60"> · {l.productCode}</span>
              </td>
              <td className="text-right">{Number(l.taxPercentage)}%</td>
              <td className="text-right">{eur(l.lineAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`${DASH} my-2`} />
      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th className="font-normal">Taxa</th>
            <th className="text-right font-normal">Base</th>
            <th className="text-right font-normal">IVA</th>
          </tr>
        </thead>
        <tbody>
          {doc.taxes.map((t) => (
            <tr key={t.taxPercentage}>
              <td>{Number(t.taxPercentage)} %</td>
              <td className="text-right">{eur(t.taxableBase)}</td>
              <td className="text-right">{eur(t.taxAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex justify-between text-[14px] font-bold">
        <span>TOTAL</span>
        <span>{eur(doc.grossTotal)}</span>
      </p>
      <p className="flex justify-between">
        <span>{isCredit ? "Reembolso" : "Pagamento"}</span>
        <span>{PAYMENT_LABELS[sale.paymentMethod]}</span>
      </p>
      {sale.givenCents !== null && (
        <>
          <p className="flex justify-between">
            <span>Entregue</span>
            <span>{formatEuros(sale.givenCents)}</span>
          </p>
          <p className="flex justify-between">
            <span>Troco</span>
            <span>{formatEuros(sale.changeCents ?? 0)}</span>
          </p>
        </>
      )}
      <div className={`${DASH} my-2`} />
      <div className="flex flex-col items-center">
        <p className="mb-1">{doc.printed.atcud}</p>
        <QRCodeSVG value={doc.qrPayload} level="M" minVersion={9} marginSize={2} style={{ width: "30mm", height: "30mm" }} aria-label="Código QR do documento" />
      </div>
      <ul className="mt-2 space-y-0.5 text-center">
        {doc.printed.mentions
          .filter((m) => !m.startsWith("DOCUMENTO DE TESTE"))
          .map((m) => (
            <li key={m}>{m}</li>
          ))}
      </ul>
      <style>{`@media print { @page { size: 80mm auto; margin: 0 } body * { visibility: hidden !important } .pos-print, .pos-print * { visibility: visible !important } .pos-print { position: absolute; left: 0; top: 0 } }`}</style>
    </article>
  );
}
