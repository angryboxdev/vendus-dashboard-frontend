import { describe, expect, it } from "vitest";
import type { PosProduct } from "../entities/pos.ts";
import { addProduct, categoriesOf, changedStock, changeQuantity, distribute, EMPTY_SCAN, findByCode, keypadPress, priceCart, quickCashAmounts, scanKey, searchProducts, setLineDiscount, stockBadge, stockShortages, type ScanState } from "./cart.service.ts";

const p = (over: Partial<PosProduct>): PosProduct => ({ id: "p1", ref: "VPIZ1", name: "Pizza Teste", category: "Grandes", priceCents: 1850, vatRate: 13, productType: "P", trackStock: false, stockQty: 0, barcode: null, imageUrl: null, active: true, ...over });
const PIZZA = p({});
const REFRI = p({ id: "p2", ref: "VREF2", name: "Refrigerante Açaí", category: "Bebidas", priceCents: 250, vatRate: 23 });
const byId = new Map([PIZZA, REFRI].map((x) => [x.id, x]));

describe("stock", () => {
  it("indicador só nos artigos que controlam stock: normal, ≤ 2 baixo, 0 sem stock, negativo", () => {
    expect(stockBadge(p({ trackStock: false, stockQty: 0 }))).toBeNull();
    expect(stockBadge(p({ trackStock: true, stockQty: 12 }))).toEqual({ tone: "ok", label: "12 em stock" });
    expect(stockBadge(p({ trackStock: true, stockQty: 2 }))).toEqual({ tone: "low", label: "2 em stock" });
    expect(stockBadge(p({ trackStock: true, stockQty: 0 }))).toEqual({ tone: "out", label: "Sem stock" });
    expect(stockBadge(p({ trackStock: true, stockQty: -3 }))).toEqual({ tone: "out", label: "Stock −3" });
  });

  it("faltas: quantidade do talão acima do stock (só quem controla stock)", () => {
    const drink = p({ id: "d", name: "Água", trackStock: true, stockQty: 1 });
    const map = new Map([PIZZA, drink].map((x) => [x.id, x]));
    expect(stockShortages([{ productId: "p1", quantity: 9 }, { productId: "d", quantity: 1 }], map)).toEqual([]);
    expect(stockShortages([{ productId: "d", quantity: 3 }], map)).toEqual([{ product: drink, quantity: 3, stock: 1 }]);
  });

  it("stock que mudou entre duas leituras", () => {
    const a = p({ id: "d", trackStock: true, stockQty: 5 });
    expect(changedStock([a, PIZZA], [{ ...a, stockQty: 4 }, PIZZA])).toEqual(["d"]);
  });
});

describe("código de barras", () => {
  const AGUA = p({ id: "a", ref: "VAGU1", name: "Água Teste", barcode: "5601234567890" });
  const list = [PIZZA, REFRI, AGUA];

  it("procura pelo código de barras e depois pela referência exata", () => {
    expect(findByCode(list, "5601234567890")).toBe(AGUA);
    expect(findByCode(list, "vref2")).toBe(REFRI);
    expect(findByCode(list, "560123")).toBeNull();
  });

  it("pesquisa: o código exato vem em primeiro (Enter adiciona-o)", () => {
    expect(searchProducts(list, "5601234567890", "Grandes")[0]).toBe(AGUA);
  });

  it("leitor: teclas rápidas + Enter dão o código; escrever devagar não", () => {
    let st: ScanState = EMPTY_SCAN;
    let code: string | null = null;
    "56012345".split("").forEach((k, i) => ({ state: st, code } = scanKey(st, k, 1000 + i * 10)));
    ({ code } = scanKey(st, "Enter", 1090));
    expect(code).toBe("56012345");
    st = EMPTY_SCAN;
    "5601".split("").forEach((k, i) => ({ state: st } = scanKey(st, k, 1000 + i * 300)));
    expect(scanKey(st, "Enter", 2000).code).toBeNull();
  });
});

describe("carrinho", () => {
  it("adicionar soma 1; − até zero remove a linha", () => {
    let cart = addProduct([], "p1");
    cart = addProduct(cart, "p1");
    expect(cart).toEqual([{ productId: "p1", quantity: 2 }]);
    cart = changeQuantity(cart, "p1", -2);
    expect(cart).toEqual([]);
  });

  it("total igual ao do servidor: desconto por linha e na venda repartido ao cêntimo", () => {
    // Mesmo cenário do teste do backend (pos-domain.test.ts): 18,50 + 2,50 − 1 € = 20,00 €.
    const priced = priceCart([{ productId: "p1", quantity: 1 }, { productId: "p2", quantity: 1 }], byId, { kind: "eur", value: 1 });
    expect(priced.totalCents).toBe(2000);
    expect(priced.lines.map((l) => l.totalCents)).toEqual([1762, 238]);
    const withLine = priceCart(setLineDiscount([{ productId: "p1", quantity: 2 }], "p1", { kind: "pct", value: 10 }), byId);
    expect(withLine.totalCents).toBe(3330);
  });

  it("IVA por taxa com preços com IVA incluído", () => {
    const priced = priceCart([{ productId: "p1", quantity: 1 }, { productId: "p2", quantity: 2 }], byId);
    expect(priced.vat).toEqual([
      { rate: 13, baseCents: 1637, vatCents: 213 },
      { rate: 23, baseCents: 407, vatCents: 93 },
    ]);
  });

  it("repartição: maior resto, empates pela ordem (como o kernel do backend)", () => {
    expect(distribute(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(distribute(0, [5, 5])).toEqual([0, 0]);
  });
});

describe("dinheiro", () => {
  it("valores rápidos: total certo e arredondamentos", () => {
    expect(quickCashAmounts(1270)).toEqual([1270, 1300, 1500, 2000]);
    expect(quickCashAmounts(2000)).toEqual([2000, 5000, 10000, 20000]);
  });

  it("teclado em cêntimos: 7, 5 → 0,75 €; 00 multiplica; apagar", () => {
    let v = keypadPress(0, "7");
    v = keypadPress(v, "5");
    expect(v).toBe(75);
    expect(keypadPress(v, "00")).toBe(7500);
    expect(keypadPress(7500, "back")).toBe(750);
  });
});

describe("pesquisa e categorias", () => {
  it("sem maiúsculas nem acentos; a pesquisa ignora a categoria", () => {
    expect(searchProducts([PIZZA, REFRI], "acai", "Grandes").map((x) => x.id)).toEqual(["p2"]);
    expect(searchProducts([PIZZA, REFRI], "vpiz", null).map((x) => x.id)).toEqual(["p1"]);
    expect(searchProducts([PIZZA, REFRI], "", "Bebidas").map((x) => x.id)).toEqual(["p2"]);
  });

  it("categorias na ordem do catálogo, as desconhecidas no fim", () => {
    expect(categoriesOf([p({ category: "Focaccia" }), REFRI, PIZZA, p({ category: "Pequenas" })])).toEqual(["Pequenas", "Grandes", "Bebidas", "Focaccia"]);
  });
});
