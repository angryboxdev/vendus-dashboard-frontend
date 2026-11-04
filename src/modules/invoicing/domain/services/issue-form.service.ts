import type { FiscalDocumentType, IssueDocumentInput, ProductType, TaxRateCode } from "../entities/invoicing.ts";

/** Estado do formulário de emissão (texto como o utilizador escreve; vírgula decimal aceite). */
export interface IssueFormLine {
  productCode: string;
  productType: ProductType;
  unit: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  /** Taxa (RED/INT/NOR) ou código de isenção (ex.: M99). */
  tax: TaxRateCode | string;
}

export interface IssueForm {
  seriesRef: string;
  documentType: FiscalDocumentType | "";
  customerTaxId: string;
  customerName: string;
  paymentMechanism: string;
  lines: IssueFormLine[];
}

/** Restauração: preço com IVA, taxa intermédia (13 %) por omissão. */
export const emptyLine = (): IssueFormLine => ({
  productCode: "",
  productType: "P",
  unit: "UN",
  description: "",
  quantity: "1",
  unitPrice: "",
  discountPct: "",
  tax: "INT",
});

const normalize = (v: string) => v.trim().replace(/\s/g, "").replace(",", ".");
const DECIMAL = /^\d+(\.\d{1,6})?$/;
const RATES = new Set(["RED", "INT", "NOR"]);

/** Valor da linha com IVA incluído, a 2 casas — só para mostrar; o total oficial é o do servidor. */
export function estimateLineGross(line: IssueFormLine): string | null {
  const q = normalize(line.quantity);
  const p = normalize(line.unitPrice);
  const d = normalize(line.discountPct) || "0";
  if (!DECIMAL.test(q) || !DECIMAL.test(p) || !DECIMAL.test(d)) return null;
  const cents = Math.round(Number(q) * Number(p) * (100 - Number(d)));
  return (cents / 100).toFixed(2);
}

export function validateIssueForm(form: IssueForm): string[] {
  const errors: string[] = [];
  if (!form.seriesRef) errors.push("Escolha a série");
  if (form.lines.length === 0) errors.push("Acrescente pelo menos uma linha");
  form.lines.forEach((l, i) => {
    const at = `Linha ${i + 1}`;
    if (!l.productCode.trim() || !l.description.trim()) errors.push(`${at}: falta o código ou a descrição`);
    const q = normalize(l.quantity);
    if (!DECIMAL.test(q) || Number(q) <= 0) errors.push(`${at}: quantidade inválida`);
    if (!DECIMAL.test(normalize(l.unitPrice))) errors.push(`${at}: preço inválido`);
    const d = normalize(l.discountPct);
    if (d && (!DECIMAL.test(d) || Number(d) > 100)) errors.push(`${at}: desconto entre 0 e 100`);
  });
  if (form.documentType === "FR" && !form.paymentMechanism) errors.push("Escolha o meio de pagamento");
  if (form.customerTaxId.trim() && !form.customerName.trim()) errors.push("Indique o nome do cliente");
  return errors;
}

export function toIssueInput(form: IssueForm): IssueDocumentInput {
  const taxId = form.customerTaxId.replace(/\s/g, "");
  return {
    seriesRef: form.seriesRef,
    customer: taxId ? { taxId, name: form.customerName.trim(), country: "PT" } : null,
    lines: form.lines.map((l) => ({
      productCode: l.productCode.trim(),
      productType: l.productType,
      unit: l.unit.trim() || "UN",
      description: l.description.trim(),
      quantity: normalize(l.quantity),
      unitPrice: normalize(l.unitPrice),
      ...(normalize(l.discountPct) ? { discountPct: normalize(l.discountPct) } : {}),
      tax: RATES.has(l.tax) ? { region: "PT" as const, rate: l.tax as TaxRateCode } : { region: "PT" as const, exemptionCode: l.tax },
    })),
    ...(form.paymentMechanism ? { paymentMechanism: form.paymentMechanism } : {}),
  };
}
