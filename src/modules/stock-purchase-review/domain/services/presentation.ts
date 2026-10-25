/**
 * Contas da apresentação de compra no ecrã (pré-visualização antes de gravar) — as mesmas regras do
 * servidor (`kernel/units/purchase-presentation.ts`): só converte dentro da mesma dimensão
 * (massa, volume, unidades); a quantidade faturada nunca é arredondada.
 */
import type { PresentationForm } from "../entities/stock-purchase-review.ts";

const UNITS: Record<string, { dimension: "mass" | "volume" | "count"; toSmallest: number }> = {
  g: { dimension: "mass", toSmallest: 1 },
  kg: { dimension: "mass", toSmallest: 1000 },
  ml: { dimension: "volume", toSmallest: 1 },
  cl: { dimension: "volume", toSmallest: 10 },
  l: { dimension: "volume", toSmallest: 1000 },
  un: { dimension: "count", toSmallest: 1 },
};

const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

export function unitFactor(from: string, to: string): number | null {
  const a = UNITS[from.trim().toLowerCase()], b = UNITS[to.trim().toLowerCase()];
  if (!a || !b || a.dimension !== b.dimension) return null;
  return round6(a.toSmallest / b.toSmallest);
}

export interface LinePreview {
  conversionFactor: number;
  stockQuantity: number;
  packages: number | null;
  netCostPerBaseUnit: number;
  netCostPerContentUnit: number;
  netCostPerPackage: number | null;
}

const MEASURE_ALIASES: Record<string, string> = { g: "g", gr: "g", grs: "g", kg: "kg", kgs: "kg", ml: "ml", cl: "cl", l: "l", lt: "l", lts: "l" };

/** Unidade em que a fatura conta (unidade da linha, ou unidade solta no fim da descrição — «…Eurial kg»); igual ao servidor. */
export function invoiceQuantityUnit(purchaseUnit: string | null, description: string): string | null {
  const own = MEASURE_ALIASES[(purchaseUnit ?? "").trim().toLowerCase().replace(/\.$/, "")];
  if (own) return own;
  const tokens = description.trim().toLowerCase().split(/\s+/);
  const last = MEASURE_ALIASES[(tokens[tokens.length - 1] ?? "").replace(/\.$/, "")];
  const before = tokens[tokens.length - 2] ?? "";
  if (!last || tokens.length < 2 || /^[\d.,x×]+$/.test(before)) return null;
  return last;
}

/** Unidade em que a quantidade faturada está quando a fatura conta o conteúdo. */
export function countedUnit(p: PresentationForm, invoiceUnit: string | null): string {
  return invoiceUnit && unitFactor(invoiceUnit, p.contentUnit) !== null ? invoiceUnit : p.contentUnit;
}

/** 20 kg (fatura em kg), saco de 2,5 kg (ou 2500 g), artigo em g → fator 1000, +20 000 g, 8 sacos, 5,58 €/kg. */
export function previewLine(p: PresentationForm, invoicedQuantity: number, lineNetCents: number, baseUnit: string, invoiceUnit: string | null = null): LinePreview | null {
  const contentToBase = unitFactor(p.contentUnit, baseUnit);
  if (contentToBase === null || !(invoicedQuantity > 0) || !(p.contentQuantity > 0)) return null;
  const counted = countedUnit(p, invoiceUnit);
  const conversionFactor = p.invoicedBy === "package" ? round6(p.contentQuantity * contentToBase) : unitFactor(counted, baseUnit)!;
  const stockQuantity = round6(invoicedQuantity * conversionFactor);
  const contentQuantity = p.invoicedBy === "package" ? invoicedQuantity * p.contentQuantity : invoicedQuantity * unitFactor(counted, p.contentUnit)!;
  const packages = p.packageUnit ? round6(p.invoicedBy === "package" ? invoicedQuantity : contentQuantity / p.contentQuantity) : null;
  return {
    conversionFactor,
    stockQuantity,
    packages,
    netCostPerBaseUnit: round6(lineNetCents / stockQuantity),
    netCostPerContentUnit: round6(lineNetCents / contentQuantity),
    netCostPerPackage: packages ? round6(lineNetCents / packages) : null,
  };
}

const qty = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });
const eur = (cents: number, digits = 2) => (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) });

/** «1 saco = 2,5 kg» ou «ao kg (sem embalagem)». */
export function presentationLabel(p: PresentationForm): string {
  return p.packageUnit ? `1 ${p.packageUnit} = ${qty(p.contentQuantity)} ${p.contentUnit}` : `ao ${p.contentUnit} (sem embalagem)`;
}

/** Plural simples para unidades de compra («sacos», «caixas», «latas», «garrafões»…). */
export function plural(unit: string, n: number): string {
  if (Math.abs(n - 1) < 1e-9) return unit;
  if (/ão$/i.test(unit)) return unit.replace(/ão$/i, "ões");
  if (/[aeiou]$/i.test(unit)) return `${unit}s`;
  if (/[rsz]$/i.test(unit)) return `${unit}es`;
  if (/l$/i.test(unit)) return unit.replace(/l$/i, "is");
  return `${unit}s`;
}

/** Linhas legíveis da associação: embalagem, Stock e custos (para o utilizador confirmar). */
export function previewSentences(p: PresentationForm, preview: LinePreview, baseUnit: string): { packaging: string; stock: string; cost: string } {
  const pk = p.packageUnit;
  // Preço como as pessoas o pensam: saco em g/ml/cl → €/kg ou €/l.
  const priceUnit = p.contentUnit === "g" ? "kg" : p.contentUnit === "ml" || p.contentUnit === "cl" ? "l" : p.contentUnit;
  const perPriceUnit = preview.netCostPerContentUnit * (unitFactor(priceUnit, p.contentUnit) ?? 1);
  return {
    packaging: pk && preview.packages != null ? `${presentationLabel(p)} → ${qty(preview.packages)} ${plural(pk, preview.packages)}` : presentationLabel(p),
    stock: `+${qty(preview.stockQuantity)} ${baseUnit}`,
    cost: [
      `${eur(perPriceUnit)}/${priceUnit}`,
      pk && preview.netCostPerPackage != null ? `${eur(preview.netCostPerPackage)}/${pk}` : null,
      baseUnit !== priceUnit ? `${eur(preview.netCostPerBaseUnit, 5)}/${baseUnit}` : null,
    ].filter(Boolean).join(" · "),
  };
}
