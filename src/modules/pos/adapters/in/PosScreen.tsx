import { FileText, LayoutDashboard, LayoutGrid, List, Lock, Printer, ScanBarcode, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { formatEuros, type CartLine, type Discount, type PosEmployee, type PosProduct, type PosSale, type PosView, type ReceiptDocument } from "../../domain/entities/pos.ts";
import {
  addProduct,
  categoriesOf,
  changedStock,
  changeQuantity,
  EMPTY_PAYMENT,
  EMPTY_SCAN,
  findByCode,
  paymentReady,
  priceCart,
  scanKey,
  searchProducts,
  setLineDiscount,
  stockShortages,
  type PaymentState,
} from "../../domain/services/cart.service.ts";
import { usePosModule } from "../../pos.module.tsx";
import { CategoryChips, CategorySidebar, ProductGrid, ProductTable, SearchBox } from "./PosCatalog.tsx";
import { PosDashboard } from "./PosDashboard.tsx";
import { PosDocuments } from "./PosDocuments.tsx";
import { PaymentPanel } from "./PosPayment.tsx";
import { PosPinPad } from "./PosPinPad.tsx";
import { PosReceipt } from "./PosReceipt.tsx";
import { PosTicket } from "./PosTicket.tsx";
import { errorText, usePosConfig, usePosDocuments, usePosProducts, usePosStockDay, usePosSummary } from "./use-pos.ts";
import { POS, TOUCH } from "./pos-theme.ts";

type Panel = "sale" | "documents" | "dashboard";
/** Depois de uma venda ou devolução, o indicador de stock pisca ~4 s. */
const FLASH_MS = 4000;

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

function Overlay({ title, onClose, children, wide = false }: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2420]/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`${POS.page} ${POS.radius} flex max-h-[95vh] w-full ${wide ? "max-w-4xl" : "max-w-xl"} flex-col overflow-hidden shadow-xl`}>
        <div className={`flex items-center justify-between border-b ${POS.border} px-5 py-3`}>
          <h2 className="text-lg font-semibold">{title}</h2>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Fechar" className={`${POS.secondary} flex h-10 w-10 items-center justify-center rounded-xl`}>
              <X aria-hidden className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * POS do Mezza em ecrã inteiro. Entra-se com o PIN do quiosque de ponto (abre
 * a vista lembrada do funcionário); sai-se para a gestão só com PIN de gestor.
 * Stock por artigo com aviso antes de faturar, e leitor de código de barras.
 * As faturas são documentos de formação — o Vendus continua a ser o oficial.
 */
export function PosScreen() {
  const { pos } = usePosModule();
  const navigate = useNavigate();
  const [session, setSession] = useState<{ employee: PosEmployee; pin: string } | null>(null);
  const [view, setView] = useState<PosView>("A");
  const [panel, setPanel] = useState<Panel>("sale");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleDiscount, setSaleDiscount] = useState<Discount | undefined>(undefined);
  const [payment, setPayment] = useState<PaymentState>(EMPTY_PAYMENT);
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<{ sale: PosSale; doc: ReceiptDocument | null; error?: string } | null>(null);
  const [exiting, setExiting] = useState(false);
  /** Aviso de stock antes de faturar: «pay» abre o pagamento, «charge» fatura (vista B). */
  const [stockWarning, setStockWarning] = useState<"pay" | "charge" | null>(null);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const attemptKey = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const scan = useRef(EMPTY_SCAN);
  const lastProducts = useRef<PosProduct[] | null>(null);

  const { data: products, error: productsError, reload: reloadProducts } = usePosProducts(true);
  const documents = usePosDocuments();
  const summary = usePosSummary();
  const stockDay = usePosStockDay();
  const config = usePosConfig();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const categories = useMemo(() => categoriesOf(products), [products]);
  const visible = useMemo(() => searchProducts(products, query, category), [products, query, category]);
  const priced = useMemo(() => priceCart(cart, byId, saleDiscount), [cart, byId, saleDiscount]);
  const quantities = useMemo(() => new Map(cart.map((l) => [l.productId, l.quantity])), [cart]);
  const shortages = useMemo(() => stockShortages(cart, byId), [cart, byId]);

  // Um pedido diferente (talão, desconto ou pagamento mudou) leva uma chave nova.
  useEffect(() => {
    attemptKey.current = null;
  }, [cart, saleDiscount, payment]);

  // O stock mudou (venda, devolução, entrada): anel laranja ~4 s nos artigos tocados.
  useEffect(() => {
    const before = lastProducts.current;
    lastProducts.current = products;
    if (!before) return;
    const ids = changedStock(before, products);
    if (ids.length === 0) return;
    setFlashing(new Set(ids));
    const t = setTimeout(() => setFlashing(new Set()), FLASH_MS);
    return () => clearTimeout(t);
  }, [products]);

  const afterDocument = () => {
    void documents.reload();
    void summary.reload();
    void stockDay.reload();
    void reloadProducts();
  };

  const add = (productId: string) => {
    setCart((c) => addProduct(c, productId));
    setErrors([]);
    setScanNotice(null);
  };

  /** Código lido (leitor) ou escrito na pesquisa com Enter: o código exato; senão o 1.º resultado. */
  const addByCode = (code: string, fallback?: PosProduct) => {
    const found = findByCode(products, code) ?? fallback ?? null;
    if (found) add(found.id);
    else setScanNotice(`Código ${code} não encontrado`);
    return found !== null;
  };

  // Leitor de código de barras (teclado): só no ecrã de venda, fora dos campos de texto.
  const scanning = session !== null && panel === "sale" && !paying && !receipt && !exiting && stockWarning === null;
  const scanRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    scanRef.current = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const out = scanKey(scan.current, e.key, e.timeStamp);
      scan.current = out.state;
      if (out.code) {
        e.preventDefault();
        addByCode(out.code);
      }
    };
  });
  useEffect(() => {
    if (!scanning) return;
    const onKey = (e: KeyboardEvent) => scanRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scanning]);

  const clearSale = () => {
    setCart([]);
    setSaleDiscount(undefined);
    setPayment(EMPTY_PAYMENT);
    setErrors([]);
  };

  /** Cobrar (A) ou faturar (B): com artigos sem stock suficiente, primeiro o aviso. */
  const goPay = (next: "pay" | "charge", confirmed = false) => {
    if (!confirmed && shortages.length > 0) return setStockWarning(next);
    setStockWarning(null);
    if (next === "pay") {
      setErrors([]);
      setPaying(true);
    } else void charge();
  };

  const charge = async () => {
    if (!session) return;
    setBusy(true);
    setErrors([]);
    attemptKey.current ??= pos.newAttemptKey();
    try {
      const out = await pos.checkout(
        {
          pin: session.pin,
          lines: cart,
          ...(saleDiscount ? { saleDiscount } : {}),
          payment: { method: payment.method!, ...(payment.method === "cash" ? { givenCents: payment.givenCents } : {}) },
          customer: payment.customer.taxId ? payment.customer : null,
          totalCents: priced.totalCents,
        },
        attemptKey.current,
      );
      if (out.kind === "invalid") {
        setErrors(out.errors);
        return;
      }
      attemptKey.current = null;
      setPaying(false);
      clearSale();
      setReceipt({ sale: out.sale, doc: null });
      afterDocument();
      try {
        setReceipt({ sale: out.sale, doc: await pos.receipt(out.sale.documentId) });
      } catch (e) {
        setReceipt({ sale: out.sale, doc: null, error: errorText(e) });
      }
    } catch (e) {
      // Falha de rede/servidor: a chave mantém-se — tentar de novo não emite outra fatura.
      setErrors([errorText(e)]);
    } finally {
      setBusy(false);
    }
  };

  const openDocument = async (sale: PosSale) => {
    setReceipt({ sale, doc: null });
    try {
      setReceipt({ sale, doc: await pos.receipt(sale.documentId) });
    } catch (e) {
      setReceipt({ sale, doc: null, error: errorText(e) });
    }
  };

  // Sem gestores marcados ninguém teria PIN de gestor: sai-se sem PIN para os configurar.
  const noManagers = config.data !== null && config.data.managerEmployeeIds.length === 0;
  const exitBody = noManagers ? (
    <div className="space-y-4 text-center">
      <p className="text-sm">Ainda não há gestores marcados no POS, por isso pode sair sem PIN. Marque-os em «Vendas → Caixa (POS)»: depois disso, sair do POS pede o PIN de um gestor.</p>
      <button type="button" onClick={() => navigate("/vendas/caixa")} className={`${TOUCH} ${POS.primary} h-14 w-full`}>
        Ir para Caixa (POS)
      </button>
    </div>
  ) : (
    <div className="flex justify-center">
      <PosPinPad title="PIN de gestor" subtitle="Só um gestor pode sair do POS" requireManager onCancel={() => setExiting(false)} onSuccess={() => navigate("/vendas/emitir")} />
    </div>
  );

  if (!session) {
    return (
      <main className={`${POS.page} flex min-h-screen flex-col items-center justify-center gap-6 p-4`}>
        <p className={`text-sm font-semibold uppercase tracking-wide ${POS.primaryText}`}>Mezza POS</p>
        <PosPinPad
          title="Introduza o seu PIN"
          subtitle="O PIN do registo de ponto"
          keyboard={!exiting}
          onSuccess={(employee, pin) => {
            setSession({ employee, pin });
            setView(employee.view ?? "A");
            setPanel("sale");
          }}
        />
        <button type="button" onClick={() => setExiting(true)} className={`text-sm underline ${POS.mutedText}`}>
          Voltar à gestão
        </button>
        {exiting && (
          <Overlay title="Voltar à gestão" onClose={() => setExiting(false)}>
            {exitBody}
          </Overlay>
        )}
      </main>
    );
  }

  const { employee } = session;
  const totalLabel = formatEuros(priced.totalCents);
  const errorBox = errors.length > 0 && (
    <ul role="alert" className={`${POS.red} list-disc space-y-1 rounded-xl py-3 pl-8 pr-3 text-sm font-medium`}>
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
  const scanBar = scanNotice && (
    <p role="status" className={`${POS.red} mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium`}>
      <ScanBarcode aria-hidden className="h-4 w-4" />
      {scanNotice}
    </p>
  );
  const ticket = (
    <PosTicket
      priced={priced}
      saleDiscount={saleDiscount}
      onQuantity={(id, d) => setCart((c) => changeQuantity(c, id, d))}
      onLineDiscount={(id, d) => setCart((c) => setLineDiscount(c, id, d))}
      onSaleDiscount={(d) => setSaleDiscount(d ?? undefined)}
      onClear={clearSale}
    />
  );

  return (
    <div className={`${POS.page} flex h-screen flex-col`}>
      <header className={`flex flex-wrap items-center gap-2 border-b ${POS.border} ${POS.card} px-3 py-2`}>
        <span className={`mr-2 font-bold ${POS.primaryText}`}>Mezza POS</span>
        <span className={`${POS.red} rounded-full px-3 py-1 text-xs font-bold`}>TESTE — sem valor fiscal</span>
        <div role="group" aria-label="Vista" className={`ml-2 flex overflow-hidden rounded-xl border ${POS.border}`}>
          {(["A", "B"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v && panel === "sale"}
              onClick={() => {
                setView(v);
                setPanel("sale");
                // Lembrada no servidor para a próxima entrada; uma falha não impede de vender.
                if (v !== view) void pos.setView(session.pin, v).catch(() => undefined);
              }}
              className={`flex h-11 items-center gap-2 px-3 text-sm font-medium ${view === v && panel === "sale" ? POS.accent : POS.card}`}
            >
              {v === "A" ? <LayoutGrid aria-hidden className="h-4 w-4" /> : <List aria-hidden className="h-4 w-4" />}
              {v === "A" ? "Grelha" : "Lista"}
            </button>
          ))}
        </div>
        <button type="button" aria-pressed={panel === "documents"} onClick={() => setPanel(panel === "documents" ? "sale" : "documents")} className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium ${panel === "documents" ? POS.accent : POS.secondary}`}>
          <FileText aria-hidden className="h-4 w-4" />
          Documentos
        </button>
        <button type="button" aria-pressed={panel === "dashboard"} onClick={() => {
            if (panel !== "dashboard") afterDocument();
            setPanel(panel === "dashboard" ? "sale" : "dashboard");
          }} className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium ${panel === "dashboard" ? POS.accent : POS.secondary}`}>
          <LayoutDashboard aria-hidden className="h-4 w-4" />
          Painel
        </button>
        <span className="ml-auto flex items-center gap-2 text-sm">
          <span className="font-semibold">{employee.name}</span>
          <span className={`${POS.accent} rounded-full px-2 py-0.5 text-xs font-semibold`}>{employee.isManager ? "Gestor" : "Funcionário"}</span>
        </span>
        <button type="button" onClick={() => (clearSale(), setSession(null))} className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium ${POS.secondary}`}>
          <Users aria-hidden className="h-4 w-4" />
          Trocar de funcionário
        </button>
        <button type="button" onClick={() => setExiting(true)} className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium ${POS.secondary}`}>
          <Lock aria-hidden className="h-4 w-4" />
          Gestão
        </button>
      </header>

      {productsError && <p className={`${POS.red} m-3 rounded-xl p-3 text-sm`}>Não foi possível carregar os produtos: {productsError}</p>}

      {panel === "documents" && (
        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl">
            <h1 className="mb-3 text-xl font-semibold">Documentos de hoje</h1>
            {documents.error && <p className={`${POS.red} mb-3 rounded-xl p-3 text-sm`}>{documents.error}</p>}
            <PosDocuments
              documents={documents.data}
              employee={employee}
              onOpen={(s) => void openDocument(s)}
              onRefunded={(nc) => {
                afterDocument();
                void openDocument(nc);
              }}
            />
          </div>
        </main>
      )}

      {panel === "dashboard" && (
        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl">
            <h1 className="mb-3 text-xl font-semibold">Mezza · hoje</h1>
            <PosDashboard summary={summary.data} stock={stockDay.data} />
          </div>
        </main>
      )}

      {panel === "sale" && view === "A" && (
        <main className="flex min-h-0 flex-1">
          <CategorySidebar categories={categories} active={category} onChange={setCategory} />
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="p-3 pb-0">
              <SearchBox value={query} onChange={setQuery} onEnter={() => query.trim() && addByCode(query, visible[0]) && setQuery("")} />
              {scanBar}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ProductGrid products={visible} quantities={quantities} onAdd={(p) => add(p.id)} flashing={flashing} />
            </div>
          </section>
          <aside className={`flex w-[320px] shrink-0 flex-col border-l ${POS.border} ${POS.card} p-4 xl:w-[400px]`} aria-label="Talão">
            <div className="min-h-0 flex-1 overflow-y-auto">{ticket}</div>
            <button type="button" disabled={priced.lines.length === 0} onClick={() => goPay("pay")} className={`${TOUCH} ${POS.primary} mt-3 h-16 text-lg ${POS.num}`}>
              Cobrar {totalLabel}
            </button>
          </aside>
        </main>
      )}

      {panel === "sale" && view === "B" && (
        <main className="flex min-h-0 flex-1">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-3">
            <SearchBox
              large
              value={query}
              onChange={setQuery}
              inputRef={searchRef}
              onEnter={() => query.trim() && addByCode(query, visible[0]) && setQuery("")}
            />
            {scanBar}
            <CategoryChips categories={categories} active={category} onChange={setCategory} />
            <div className={`min-h-0 flex-1 overflow-y-auto rounded-2xl border ${POS.border} ${POS.card}`}>
              <ProductTable products={visible} quantities={quantities} onAdd={(p) => add(p.id)} flashing={flashing} />
            </div>
          </section>
          <aside className={`w-[40%] min-w-[360px] shrink-0 space-y-4 overflow-y-auto border-l ${POS.border} ${POS.card} px-4 pt-4`} aria-label="Talão e pagamento">
            {ticket}
            {priced.lines.length > 0 && <PaymentPanel compact totalCents={priced.totalCents} value={payment} onChange={setPayment} />}
            {errorBox}
            <div className={`sticky bottom-0 -mx-4 flex gap-2 border-t ${POS.border} ${POS.card} px-4 py-3`}>
              <button type="button" onClick={clearSale} className={`${TOUCH} ${POS.secondary} h-14`}>
                Limpar
              </button>
              <button type="button" disabled={busy || priced.lines.length === 0 || !paymentReady(payment, priced.totalCents)} onClick={() => goPay("charge")} className={`${TOUCH} ${POS.primary} h-14 flex-1 text-lg ${POS.num}`}>
                {busy ? "A faturar…" : `Faturar ${totalLabel}`}
              </button>
            </div>
          </aside>
        </main>
      )}

      {stockWarning && (
        <Overlay title="Stock insuficiente" onClose={() => setStockWarning(null)}>
          <div className="space-y-4">
            <p className="text-sm">Estes artigos não têm stock suficiente. Pode vender na mesma: o stock fica negativo e fica registado um alerta de stock.</p>
            <ul className={`divide-y rounded-xl border ${POS.border} divide-[#e7d9c6]`} aria-label="Artigos em falta">
              {shortages.map((s) => (
                <li key={s.product.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="font-medium">{s.product.name}</span>
                  <span className={`${POS.amber} rounded-full px-2 text-sm font-semibold ${POS.num}`}>
                    {s.quantity} no talão · {s.stock < 0 ? `Stock −${-s.stock}` : `${s.stock} em stock`}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStockWarning(null)} className={`${TOUCH} ${POS.secondary} h-14 flex-1`}>
                Rever venda
              </button>
              <button type="button" onClick={() => goPay(stockWarning, true)} className={`${TOUCH} ${POS.primary} h-14 flex-1`}>
                Vender na mesma
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {paying && (
        <Overlay title={`Pagamento — ${totalLabel}`} onClose={busy ? undefined : () => setPaying(false)}>
          <div className="space-y-4">
            <PaymentPanel totalCents={priced.totalCents} value={payment} onChange={setPayment} />
            {errorBox}
            <button type="button" disabled={busy || !paymentReady(payment, priced.totalCents)} onClick={() => void charge()} className={`${TOUCH} ${POS.primary} h-16 w-full text-lg`}>
              {busy ? "A faturar…" : "Confirmar pagamento e faturar"}
            </button>
          </div>
        </Overlay>
      )}

      {receipt && (
        <Overlay title={receipt.sale.kind === "refund" ? "Nota de crédito emitida" : "Fatura-recibo emitida"} onClose={() => setReceipt(null)}>
          <div className="space-y-4">
            {receipt.sale.changeCents !== null && receipt.sale.changeCents > 0 && (
              <p className={`${POS.green} flex justify-between rounded-xl px-4 py-3 text-2xl font-bold ${POS.num}`}>
                <span className="text-base font-semibold">Troco a dar</span>
                {formatEuros(receipt.sale.changeCents)}
              </p>
            )}
            {receipt.doc ? <PosReceipt doc={receipt.doc} sale={receipt.sale} /> : <p className={`text-center text-sm ${POS.mutedText}`}>{receipt.error ?? "A carregar o documento…"}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={!receipt.doc} onClick={() => window.print()} className={`${TOUCH} ${POS.secondary} flex h-14 flex-1 items-center justify-center gap-2`}>
                <Printer aria-hidden className="h-5 w-5" />
                Imprimir talão
              </button>
              <button type="button" onClick={() => (setReceipt(null), setPanel("sale"), searchRef.current?.focus())} className={`${TOUCH} ${POS.primary} h-14 flex-1`}>
                Nova venda
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {exiting && (
        <Overlay title="Sair para a gestão" onClose={() => setExiting(false)}>
          {exitBody}
        </Overlay>
      )}
    </div>
  );
}
