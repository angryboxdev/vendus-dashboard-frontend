import { useState } from "react";
import { AlertBanner, Button, EmptyState, FIELD, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";
import { formatEuros, type ImportPreview, type PosProduct } from "../../domain/entities/pos.ts";
import { usePosModule } from "../../pos.module.tsx";
import { errorText, usePosProducts } from "./use-pos.ts";

/** Lê o ficheiro como texto (UTF-8; a exportação do Vendus sai em UTF-8). */
const readFile = (file: File) => file.text();

function ImportCsv({ onImported }: { onImported: () => Promise<void> }) {
  const { pos } = usePosModule();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <h2 className="text-base font-semibold text-ink">Importar produtos (exportação do Vendus, CSV)</h2>
      <p className="text-sm text-ink-secondary">
        Pré-visualiza antes de gravar. Ficam de fora as linhas a 0 € (modificadores, cupões, ofertas) e os duplicados pelo nome. Um produto com a mesma referência é atualizado. Nada muda no Vendus.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        aria-label="Ficheiro CSV"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          setPreview(null);
          setResult(null);
          setError(null);
          if (!file) return;
          setFileName(file.name);
          setBusy(true);
          try {
            const text = await readFile(file);
            setCsv(text);
            setPreview(await pos.previewImport(text));
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
        className="block text-sm"
      />
      {error && <AlertBanner tone="danger" title="Não foi possível ler o ficheiro">{error}</AlertBanner>}
      {result && <AlertBanner tone="success" title="Importação concluída">{result}</AlertBanner>}
      {preview && (
        <>
          <p className="text-sm text-ink">
            <strong>{fileName}</strong>: {preview.toImport} para importar · {preview.skipped} ignoradas ·{" "}
            {preview.rows.filter((r) => r.status === "import" && r.warnings.length > 0).length} com avisos
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showSkipped} onChange={(e) => setShowSkipped(e.target.checked)} />
            Mostrar também as linhas ignoradas
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Substituir o catálogo: os produtos que não estão neste ficheiro deixam de estar à venda (não se apagam — têm vendas e stock)
          </label>
          <div className="max-h-96 overflow-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Linha</th>
                  <th className={TH}>Referência</th>
                  <th className={TH}>Nome</th>
                  <th className={TH}>Categoria</th>
                  <th className={`${TH} text-right`}>Preço</th>
                  <th className={`${TH} text-right`}>IVA</th>
                  <th className={TH}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows
                  .filter((r) => showSkipped || r.status === "import")
                  .map((r) => (
                    <tr key={r.line} className={TR}>
                      <td className={TD}>{r.line}</td>
                      <td className={TD}>{r.ref}</td>
                      <td className={`${TD} font-medium`}>{r.name}</td>
                      <td className={TD}>{r.category ?? "—"}</td>
                      <td className={`${TD} text-right tabular-nums`}>{formatEuros(r.priceCents)}</td>
                      <td className={`${TD} text-right`}>{r.vatRate ?? "—"} %</td>
                      <td className={TD}>
                        {r.status === "skip" ? (
                          <span className="text-xs text-ink-secondary">Ignorada — {r.reason}</span>
                        ) : r.warnings.length > 0 ? (
                          <StatusBadge tone="warning">{r.warnings.join(" · ")}</StatusBadge>
                        ) : (
                          <StatusBadge tone="success">OK</StatusBadge>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Button
            variant="primary"
            loading={busy}
            disabled={!csv || preview.toImport === 0}
            onClick={async () => {
              if (!csv) return;
              setBusy(true);
              setError(null);
              try {
                const r = await pos.importProducts(csv, { replace });
                setResult(`${r.created} criados, ${r.updated} atualizados, ${r.skipped} linhas ignoradas${r.deactivated > 0 ? `, ${r.deactivated} tirados da venda` : ""}.`);
                setPreview(null);
                setCsv(null);
                await onImported();
              } catch (err) {
                setError(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Importar {preview.toImport} produtos
          </Button>
        </>
      )}
    </section>
  );
}

/** Entrada (chegou mercadoria: +N) ou contagem (o stock passa a N), com nota opcional. */
function StockAdjust({ p, onDone }: { p: PosProduct; onDone: () => Promise<void> }) {
  const { pos } = usePosModule();
  const [kind, setKind] = useState<"entry" | "count" | null>(null);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tone = p.stockQty <= 0 ? "danger" : p.stockQty <= 2 ? "warning" : "neutral";
  if (!p.trackStock) return <span className="text-xs text-ink-secondary">—</span>;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <StatusBadge tone={tone}>{p.stockQty}</StatusBadge>
        {(["entry", "count"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => (setKind(kind === k ? null : k), setError(null))} className="text-xs font-medium text-ink underline">
            {k === "entry" ? "Entrada" : "Contagem"}
          </button>
        ))}
      </div>
      {kind && (
        <form
          className="flex flex-wrap items-center gap-1"
          onSubmit={async (e) => {
            e.preventDefault();
            const n = Number(qty);
            setBusy(true);
            setError(null);
            try {
              await pos.adjustStock(p.id, kind === "entry" ? { kind, qty: n, note } : { kind, countTo: n, note });
              setKind(null);
              setQty("");
              setNote("");
              await onDone();
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            aria-label={kind === "entry" ? `Entrada de ${p.name}` : `Contagem de ${p.name}`}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
            placeholder={kind === "entry" ? "+ qtd." : "contado"}
            className={`${FIELD} w-20 text-right tabular-nums`}
          />
          <input aria-label="Nota" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" maxLength={200} className={`${FIELD} w-36`} />
          <Button type="submit" variant="primary" loading={busy} disabled={qty === ""}>
            Gravar
          </Button>
          {error && <span className="block w-full text-xs text-red-700">{error}</span>}
        </form>
      )}
    </div>
  );
}

function ProductRow({ p, onSaved, onStock }: { p: PosProduct; onSaved: (p: PosProduct) => void; onStock: () => Promise<void> }) {
  const { pos } = usePosModule();
  const [price, setPrice] = useState((p.priceCents / 100).toFixed(2).replace(".", ","));
  const [barcode, setBarcode] = useState(p.barcode ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: Parameters<typeof pos.updateProduct>[1]) => {
    setError(null);
    try {
      onSaved(await pos.updateProduct(p.id, patch));
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <tr className={TR}>
      <td className={TD}>{p.ref}</td>
      <td className={`${TD} font-medium`}>
        {p.name}
        {error && <span className="block text-xs text-red-700">{error}</span>}
      </td>
      <td className={TD}>{p.category ?? "—"}</td>
      <td className={`${TD} text-right`}>
        <input
          aria-label={`Preço de ${p.name}`}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => {
            const cents = Math.round(Number(price.replace(",", ".")) * 100);
            if (Number.isFinite(cents) && cents !== p.priceCents) void save({ priceCents: cents });
          }}
          className={`${FIELD} w-24 text-right tabular-nums`}
        />
      </td>
      <td className={`${TD} text-right`}>
        <select aria-label={`IVA de ${p.name}`} value={p.vatRate} onChange={(e) => void save({ vatRate: Number(e.target.value) as PosProduct["vatRate"] })} className={`${FIELD} w-24`}>
          {[6, 13, 23].map((v) => (
            <option key={v} value={v}>
              {v} %
            </option>
          ))}
        </select>
      </td>
      <td className={TD}>
        <input
          aria-label={`Código de barras de ${p.name}`}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value.trim())}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
          onBlur={() => {
            if (barcode !== (p.barcode ?? "")) void save({ barcode: barcode || null });
          }}
          placeholder="Ler ou escrever"
          className={`${FIELD} w-36 tabular-nums`}
        />
      </td>
      <td className={TD}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.trackStock} onChange={(e) => void save({ trackStock: e.target.checked })} />
          {p.trackStock ? "Sim" : "Não"}
        </label>
      </td>
      <td className={TD}>
        <StockAdjust p={p} onDone={onStock} />
      </td>
      <td className={TD}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.active} onChange={(e) => void save({ active: e.target.checked })} />
          {p.active ? "À venda" : "Fora"}
        </label>
      </td>
    </tr>
  );
}

/**
 * Vendas → Produtos: os produtos do POS (importar do Vendus; editar preço, IVA,
 * código de barras, se controla stock e se está à venda; entradas e contagens de stock).
 */
export function PosProductsView() {
  const { data: products, error, reload, loading } = usePosProducts(false);
  const [list, setList] = useState<PosProduct[] | null>(null);
  const shown = list ?? products;
  return (
    <div className="space-y-4">
      <ImportCsv
        onImported={async () => {
          setList(null);
          await reload();
        }}
      />
      {error && <AlertBanner tone="danger" title="Não foi possível carregar os produtos">{error}</AlertBanner>}
      {!loading && shown.length === 0 ? (
        <EmptyState title="Ainda não há produtos" />
      ) : (
        <div className={`${SURFACE} overflow-x-auto`}>
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Referência</th>
                <th className={TH}>Nome</th>
                <th className={TH}>Categoria</th>
                <th className={`${TH} text-right`}>Preço c/ IVA (€)</th>
                <th className={`${TH} text-right`}>IVA</th>
                <th className={TH}>Código de barras</th>
                <th className={TH}>Controla stock</th>
                <th className={TH}>Stock</th>
                <th className={TH}>No POS</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <ProductRow
                  key={p.id}
                  p={p}
                  onSaved={(saved) => setList(shown.map((x) => (x.id === saved.id ? saved : x)))}
                  onStock={async () => {
                    setList(null);
                    await reload();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
