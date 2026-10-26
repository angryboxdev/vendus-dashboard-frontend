import { useState } from "react";
import { useStockPurchaseReviewModule } from "../../stock-purchase-review.module.tsx";
import {
  CONTENT_UNIT_OPTIONS,
  PACKAGE_UNIT_OPTIONS,
  type ContentUnit,
  type PresentationForm,
  type StockItemOptionDTO,
  type StockPurchaseReviewDTO,
  type StockReviewLineDTO,
} from "../../domain/entities/stock-purchase-review.ts";
import { countedUnit, invoiceQuantityUnit, plural, previewLine, previewSentences, unitFactor } from "../../domain/services/presentation.ts";

const eur = (cents: number) => (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
const qty = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });
const num = (s: string) => parseFloat(s.replace(",", "."));
const inputCls = "w-full rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 outline-none focus:border-[#ED5C32]";

/** Proposta inicial a partir da descrição («Tomate … 5 kg bolsa» → saco de 5 kg) — só preenche, nunca grava. */
export function guessPresentation(line: StockReviewLineDTO): PresentationForm {
  const d = line.description.toLowerCase();
  const m = d.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|lt|ml|cl)\b/);
  const content = m ? { contentQuantity: num(m[1]!), contentUnit: (m[2] === "lt" ? "l" : m[2]) as ContentUnit } : { contentQuantity: 1, contentUnit: "kg" as ContentUnit };
  const pkg = /\b(saco|bolsa)\b/.test(d) ? "saco" : /\blata\b/.test(d) ? "lata" : /\b(garrafa|gf)\b/.test(d) ? "garrafa" : /\b(cx|caixa)\b/.test(d) ? "caixa" : "saco";
  // Linha faturada em kg/L (preço por kg) → a fatura conta o conteúdo; senão conta embalagens.
  const invoicedBy = (["kg", "g", "l", "ml", "cl"] as string[]).includes(line.purchaseUnit.toLowerCase()) || /\bkg$/.test(d.trim()) ? "content" : "package";
  return { packageUnit: pkg, ...content, invoicedBy, minOrderPackages: 1, orderIncrementPackages: 1 };
}

interface Props {
  review: StockPurchaseReviewDTO;
  line: StockReviewLineDTO;
  /** Artigo escolhido no formulário (ou o já associado). */
  stockItemId: string | null;
  stockItems: StockItemOptionDTO[];
  readOnly: boolean;
  /** Embalagem gravada: o fator para esta linha e pedido para recarregar a revisão. */
  onSaved(conversionFactor: number | null): void;
}

/**
 * «Embalagem de compra» de uma linha (task «embalagens e conversões»): mostra, de forma legível,
 * a fatura, a embalagem confirmada (1 saco = 2,5 kg → 8 sacos), o que entra no Stock e o custo
 * líquido por kg/saco; ou «Embalagem por configurar». O editor mostra as equivalências antes de
 * gravar e nunca pede um fator opaco.
 */
export function PackagingPanel({ review, line, stockItemId, stockItems, readOnly, onSaved }: Props) {
  const { api } = useStockPurchaseReviewModule();
  const presentation = line.packaging?.presentation ?? null;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PresentationForm>(() => presentation ?? guessPresentation(line));
  const [noPackage, setNoPackage] = useState(presentation ? presentation.packageUnit === null : false);
  const [contentText, setContentText] = useState(String(form.contentQuantity).replace(".", ","));
  const [minText] = useState(String(form.minOrderPackages));
  const [incText] = useState(String(form.orderIncrementPackages));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemId = stockItemId ?? presentation?.stockItemId ?? null;
  const baseUnit = stockItems.find((i) => i.id === itemId)?.baseUnit ?? line.packaging?.baseUnit ?? null;
  const net = line.netAmount ?? Math.round(line.unitCostWithoutVat * line.purchaseQuantity);

  const effective: PresentationForm = {
    ...form,
    packageUnit: noPackage ? null : form.packageUnit,
    invoicedBy: noPackage ? "content" : form.invoicedBy,
    contentQuantity: num(contentText),
    minOrderPackages: num(minText),
    orderIncrementPackages: num(incText),
  };
  const shown = editing ? effective : presentation;
  const lineInvoiceUnit = invoiceQuantityUnit(line.purchaseUnit, line.description);
  const preview = shown && baseUnit ? previewLine(shown, line.purchaseQuantity, net, baseUnit, lineInvoiceUnit) : null;
  const incompatible = shown && baseUnit ? unitFactor(shown.contentUnit, baseUnit) === null : false;

  if (line.resolutionType === "no_stock_effect") return null;

  async function save() {
    setError(null);
    if (!review.decisionSupplierId) return setError("Esta fatura não tem fornecedor associado.");
    if (!itemId) return setError("Escolha primeiro o artigo de stock.");
    if (!(effective.contentQuantity > 0)) return setError("Indique quanto tem cada embalagem.");
    if (!(effective.minOrderPackages > 0) || !(effective.orderIncrementPackages > 0)) return setError("Encomenda mínima e incremento têm de ser positivos.");
    if (incompatible) return setError(`O conteúdo em ${effective.contentUnit} não se converte na unidade do artigo (${baseUnit}).`);
    setSaving(true);
    try {
      await api.savePresentation({ ...effective, supplierId: review.decisionSupplierId, supplierReference: line.supplierItemCode, description: line.description, stockItemId: itemId });
      setEditing(false);
      onSaved(preview?.conversionFactor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gravar a embalagem.");
    } finally {
      setSaving(false);
    }
  }

  const invoiceUnit = (p: PresentationForm) => (p.invoicedBy === "package" && p.packageUnit ? plural(p.packageUnit, line.purchaseQuantity) : countedUnit(p, lineInvoiceUnit));
  const sentences = shown && preview && baseUnit ? previewSentences(shown, preview, baseUnit) : null;

  return (
    <div className={`mt-2 rounded-md border px-3 py-2 text-xs ${presentation || editing ? "border-stone-200 bg-stone-50 text-stone-700" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      {!editing && !presentation && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <span className="font-semibold">Embalagem por configurar</span> — vem em saco (ou caixa, lata…)? Quanto tem cada um?
          </span>
          {!readOnly && (
            <button type="button" onClick={() => setEditing(true)} className="rounded border border-amber-300 bg-white px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-100">
              Configurar
            </button>
          )}
        </div>
      )}

      {shown && (
        <div className="space-y-0.5 tabular-nums">
          <p>
            <span className="font-medium">Fatura:</span> {qty(line.purchaseQuantity)} {invoiceUnit(shown)} × {eur(line.unitCostWithoutVat)}/{shown.invoicedBy === "package" && shown.packageUnit ? shown.packageUnit : countedUnit(shown, lineInvoiceUnit)}
            {line.discountAmount ? ` − ${eur(line.discountAmount)} desconto` : ""} = <span className="font-semibold">{eur(net)}</span> (sem IVA)
          </p>
          {sentences ? (
            <>
              <p><span className="font-medium">{editing ? "Embalagem:" : "Embalagem confirmada:"}</span> {sentences.packaging}</p>
              <p><span className="font-medium">Stock após confirmar:</span> {sentences.stock} · <span className="font-medium">custo líquido:</span> {sentences.cost}</p>
            </>
          ) : incompatible ? (
            <p className="font-medium text-red-700">O conteúdo em {shown.contentUnit} não se converte na unidade do artigo ({baseUnit}).</p>
          ) : (
            <p className="text-stone-500">Escolha o artigo de stock para ver quanto entra no Stock e o custo.</p>
          )}
          {!editing && presentation && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {/* Encomenda mínima/incremento ficam em Reposição e planeamento (task V5 §2.3). */}
              <span />
              {!readOnly && (
                <button type="button" onClick={() => setEditing(true)} className="rounded border border-stone-300 bg-white px-2 py-0.5 font-medium text-stone-700 hover:bg-stone-100">
                  Alterar embalagem
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="mt-2 space-y-2 border-t border-stone-200 pt-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="mb-0.5 block text-[11px] text-stone-500">Vem em</span>
              <select
                aria-label="Vem em"
                value={noPackage ? "" : form.packageUnit ?? "saco"}
                onChange={(e) => {
                  setNoPackage(e.target.value === "");
                  if (e.target.value) setForm({ ...form, packageUnit: e.target.value });
                }}
                className={inputCls}
              >
                {PACKAGE_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                <option value="">não vem em embalagem</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] text-stone-500">{noPackage ? "Vende-se ao" : `Cada ${form.packageUnit ?? "embalagem"} tem`}</span>
              <span className="flex gap-1">
                {!noPackage && <input aria-label="Conteúdo de cada embalagem" type="text" inputMode="decimal" value={contentText} onChange={(e) => setContentText(e.target.value)} className={`${inputCls} w-16`} />}
                <select aria-label="Unidade do conteúdo" value={form.contentUnit} onChange={(e) => setForm({ ...form, contentUnit: e.target.value as ContentUnit })} className={inputCls}>
                  {CONTENT_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </span>
            </label>
            {!noPackage && (
              <label className="block">
                <span className="mb-0.5 block text-[11px] text-stone-500">A fatura conta</span>
                <select aria-label="A fatura conta" value={form.invoicedBy} onChange={(e) => setForm({ ...form, invoicedBy: e.target.value as "package" | "content" })} className={inputCls}>
                  <option value="package">{plural(form.packageUnit ?? "embalagem", 2)}</option>
                  <option value="content">{form.contentUnit}</option>
                </select>
              </label>
            )}
          </div>
          {noPackage && <p className="text-stone-500">Sem embalagem: a fatura conta {form.contentUnit}.</p>}
          <p className="text-[11px] text-stone-500">Vale para as próximas faturas deste fornecedor; o que já entrou no Stock não muda. Encomenda mínima em Reposição e planeamento.</p>
          {error && <p className="text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void save()} disabled={saving} className="rounded-md bg-stone-800 px-3 py-1 font-medium text-white hover:opacity-90 disabled:opacity-50">
              {saving ? "A gravar…" : "Confirmar embalagem"}
            </button>
            <button type="button" onClick={() => { setEditing(false); setError(null); }} className="rounded-md border border-stone-300 px-3 py-1 font-medium text-stone-600 hover:bg-stone-100">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
