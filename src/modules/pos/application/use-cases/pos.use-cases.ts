import type { CartLine, Customer, Discount, PaymentMethod, PosSettings, PosView, ProductPatch, StockAdjustment } from "../../domain/entities/pos.ts";
import { PosError } from "../../domain/errors.ts";
import type { CheckoutOutcome, PosPort } from "../../domain/ports/in/pos.port.ts";
import type { PosApiPort, PosIdGeneratorPort } from "../../domain/ports/out/pos-api.port.ts";

const NIF = /^\d{9}$/;

/** Casos de uso do POS: validação do ecrã antes de chamar a API; as regras fiscais ficam no servidor. */
export class PosUseCases implements PosPort {
  private readonly api: PosApiPort;
  private readonly ids: PosIdGeneratorPort;

  constructor(api: PosApiPort, ids: PosIdGeneratorPort) {
    this.api = api;
    this.ids = ids;
  }

  products(activeOnly: boolean) {
    return this.api.products(activeOnly);
  }
  updateProduct(id: string, patch: ProductPatch) {
    return this.api.updateProduct(id, patch);
  }
  adjustStock(productId: string, a: StockAdjustment) {
    if (a.kind === "entry" && (!Number.isInteger(a.qty) || a.qty < 1)) return Promise.reject(new PosError("Entrada: quantidade inteira, 1 ou mais", "rule"));
    if (a.kind === "count" && (!Number.isInteger(a.countTo) || a.countTo < 0)) return Promise.reject(new PosError("Contagem: quantidade inteira, 0 ou mais", "rule"));
    return this.api.adjustStock(productId, a);
  }
  stockDay(date?: string) {
    return this.api.stockDay(date);
  }
  previewImport(csv: string) {
    return this.api.previewImport(csv);
  }
  importProducts(csv: string) {
    return this.api.importProducts(csv);
  }
  settings() {
    return this.api.settings();
  }
  saveSettings(s: PosSettings) {
    return this.api.saveSettings(s);
  }
  employees() {
    return this.api.employees();
  }
  series() {
    return this.api.series();
  }
  login(pin: string) {
    if (!/^\d{4,8}$/.test(pin)) return Promise.reject(new PosError("PIN inválido", "pin"));
    return this.api.login(pin);
  }
  setView(pin: string, view: PosView) {
    return this.api.setView(pin, view);
  }
  newAttemptKey() {
    return this.ids.next();
  }

  async checkout(
    q: { pin: string; lines: CartLine[]; saleDiscount?: Discount; payment: { method: PaymentMethod; givenCents?: number }; customer: Customer | null; totalCents: number },
    attemptKey: string,
  ): Promise<CheckoutOutcome> {
    const errors: string[] = [];
    if (q.lines.length === 0) errors.push("O talão está vazio");
    if (q.payment.method === "cash" && (q.payment.givenCents ?? 0) < q.totalCents) errors.push("O valor entregue é menor do que o total");
    const taxId = q.customer?.taxId.trim() ?? "";
    if (taxId && !NIF.test(taxId)) errors.push("NIF do cliente com 9 dígitos");
    if (errors.length > 0) return { kind: "invalid", errors };
    try {
      const sale = await this.api.checkout(
        {
          pin: q.pin,
          lines: q.lines,
          ...(q.saleDiscount && q.saleDiscount.value > 0 ? { saleDiscount: q.saleDiscount } : {}),
          payment: q.payment,
          customer: taxId ? { taxId, name: q.customer?.name.trim() ?? "" } : null,
        },
        attemptKey,
      );
      return { kind: "done", sale };
    } catch (e) {
      if (e instanceof PosError) return { kind: "invalid", errors: [e.message] };
      throw e;
    }
  }

  refund(saleId: string, q: { pin: string; lines: Array<{ lineNumber: number; quantity: number }>; reason: string }) {
    return this.api.refund(saleId, q, this.ids.next());
  }
  documents(date?: string) {
    return this.api.documents(date);
  }
  summary(date?: string) {
    return this.api.summary(date);
  }
  receipt(documentId: string) {
    return this.api.receipt(documentId);
  }
}
