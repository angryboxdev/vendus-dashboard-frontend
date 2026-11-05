import { Beer, CakeSlice, Coffee, CupSoda, Droplet, Package, Pizza, Search, Soup, UtensilsCrossed } from "lucide-react";
import type { RefObject } from "react";
import { formatEuros, type PosProduct } from "../../domain/entities/pos.ts";
import { POS } from "./pos-theme.ts";

/** Ícone da categoria (o mapa é fixo; nada se cria durante o render). */
function CategoryIcon({ category, className }: { category: string | null; className: string }) {
  switch (category ?? "Outros") {
    case "Pequenas":
    case "Grandes":
      return <Pizza aria-hidden className={className} />;
    case "XS":
      return <CakeSlice aria-hidden className={className} />;
    case "Entradas":
      return <Soup aria-hidden className={className} />;
    case "Menus":
    case "Todos":
      return <UtensilsCrossed aria-hidden className={className} />;
    case "Molhos Extras":
      return <Droplet aria-hidden className={className} />;
    case "Bebidas":
      return <CupSoda aria-hidden className={className} />;
    case "Cervejas S":
    case "Cervejas L":
      return <Beer aria-hidden className={className} />;
    case "Outros":
      return <Package aria-hidden className={className} />;
    default:
      return <Coffee aria-hidden className={className} />;
  }
}

/** Foto do produto (inteira, sobre branco) ou o ícone da categoria. */
export function ProductThumb({ product, size }: { product: PosProduct; size: "sm" | "md" }) {
  const box = size === "md" ? "h-20 w-full xl:h-24" : "h-10 w-10";
  return product.imageUrl ? (
    <img src={product.imageUrl} alt="" loading="lazy" className={`${box} rounded-lg bg-white object-contain`} />
  ) : (
    <span className={`${box} flex items-center justify-center rounded-lg bg-white ${POS.mutedText}`}>
      <CategoryIcon category={product.category} className={size === "md" ? "h-9 w-9" : "h-5 w-5"} />
    </span>
  );
}

export function SearchBox({ value, onChange, inputRef, onEnter, large = false }: { value: string; onChange: (v: string) => void; inputRef?: RefObject<HTMLInputElement | null>; onEnter?: () => void; large?: boolean }) {
  return (
    <label className={`${POS.card} ${POS.border} flex items-center gap-2 rounded-xl border px-3 ${large ? "h-14 text-lg" : "h-12"}`}>
      <Search aria-hidden className={`h-5 w-5 ${POS.mutedText}`} />
      <span className="sr-only">Pesquisar artigo</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder="Pesquisar por nome ou referência"
        className="h-full w-full bg-transparent outline-none placeholder:text-[#7d6b5a]"
      />
    </label>
  );
}

/** Vista A: barra de categorias à esquerda. */
export function CategorySidebar({ categories, active, onChange }: { categories: string[]; active: string | null; onChange: (c: string | null) => void }) {
  return (
    <nav aria-label="Categorias" className="flex w-[88px] shrink-0 flex-col gap-1 overflow-y-auto p-2 xl:w-[210px]">
      {[null, ...categories].map((c) => {
        const on = c === active;
        return (
          <button
            key={c ?? "todas"}
            type="button"
            onClick={() => onChange(c)}
            aria-pressed={on}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-2 text-center text-xs font-medium xl:flex-row xl:justify-start xl:gap-3 xl:px-3 xl:text-sm ${on ? POS.accent : "hover:bg-[#f0e6d8]"}`}
          >
            <CategoryIcon category={c ?? "Todos"} className="h-6 w-6 shrink-0" />
            <span className="leading-tight">{c ?? "Todos"}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Vista B: categorias em chips. */
export function CategoryChips({ categories, active, onChange }: { categories: string[]; active: string | null; onChange: (c: string | null) => void }) {
  return (
    <div role="toolbar" aria-label="Categorias" className="flex gap-2 overflow-x-auto pb-1">
      {[null, ...categories].map((c) => (
        <button
          key={c ?? "todas"}
          type="button"
          aria-pressed={c === active}
          onClick={() => onChange(c)}
          className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${POS.border} ${c === active ? POS.accent : POS.card}`}
        >
          {c ?? "Todos"}
        </button>
      ))}
    </div>
  );
}

/** Vista A: grelha de artigos com foto; contador laranja quando já está no talão. */
export function ProductGrid({ products, quantities, onAdd }: { products: PosProduct[]; quantities: Map<string, number>; onAdd: (p: PosProduct) => void }) {
  if (products.length === 0) return <p className={`p-6 text-center ${POS.mutedText}`}>Nenhum artigo encontrado.</p>;
  return (
    <div className="grid grid-cols-3 gap-3 p-3 xl:grid-cols-4 2xl:grid-cols-5">
      {products.map((p) => {
        const qty = quantities.get(p.id) ?? 0;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onAdd(p)}
            className={`${POS.card} ${POS.border} relative flex flex-col gap-2 rounded-2xl border p-2 text-left transition active:scale-[0.98] ${qty > 0 ? POS.primaryRing : ""}`}
          >
            {qty > 0 && <span className={`${POS.primary} absolute right-2 top-2 z-10 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold ${POS.num}`}>{qty}</span>}
            <ProductThumb product={p} size="md" />
            <span className="line-clamp-2 min-h-10 text-sm font-semibold leading-tight">{p.name}</span>
            <span className="flex items-end justify-between gap-1">
              <span className={`text-xs ${POS.mutedText}`}>{p.ref}</span>
              <span className={`font-semibold ${POS.num}`}>{formatEuros(p.priceCents)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Vista B: tabela rápida (referência, nome, preço). */
export function ProductTable({ products, quantities, onAdd }: { products: PosProduct[]; quantities: Map<string, number>; onAdd: (p: PosProduct) => void }) {
  if (products.length === 0) return <p className={`p-6 text-center ${POS.mutedText}`}>Nenhum artigo encontrado.</p>;
  return (
    <table className="w-full text-left">
      <thead className={`sticky top-0 ${POS.secondary} text-xs uppercase ${POS.mutedText}`}>
        <tr>
          <th className="px-3 py-2 font-semibold">Ref.</th>
          <th className="px-3 py-2 font-semibold">Artigo</th>
          <th className="px-3 py-2 text-right font-semibold">Preço</th>
          <th className="px-3 py-2 text-right font-semibold">No talão</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p.id} onClick={() => onAdd(p)} className={`cursor-pointer border-b ${POS.border} hover:bg-[#f0e6d8]`}>
            <td className={`px-3 py-3 text-sm ${POS.mutedText}`}>{p.ref}</td>
            <td className="px-3 py-3 font-medium">
              <button type="button" className="text-left" onClick={(e) => (e.stopPropagation(), onAdd(p))}>
                {p.name}
              </button>
            </td>
            <td className={`px-3 py-3 text-right font-semibold ${POS.num}`}>{formatEuros(p.priceCents)}</td>
            <td className={`px-3 py-3 text-right ${POS.num}`}>{quantities.get(p.id) ? <span className={`${POS.accent} rounded-full px-2 py-0.5 text-sm font-bold`}>{quantities.get(p.id)}</span> : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
