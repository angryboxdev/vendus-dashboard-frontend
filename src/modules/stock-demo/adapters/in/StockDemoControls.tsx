import { useCallback, useEffect, useRef, useState } from "react";
import { STOCK_DEMO_LABELS, type StockDemoScenario, type StockDemoStatusDTO } from "../../domain/entities/stock-demo.ts";
import { useStockDemo } from "../../stock-demo.module.tsx";

const eur0 = (cents: number) => (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function usePreparing() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível preparar a demonstração.");
    } finally {
      setBusy(null);
    }
  }, []);
  return { busy, error, run };
}

function Preparing({ label }: { label: string }) {
  return (
    <div role="status" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="rounded-xl bg-surface-card px-6 py-5 text-center shadow-pop">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-1 text-xs text-ink-muted">A gerar artigos, compras, fichas técnicas e vendas fictícias — pode demorar até um minuto.</p>
      </div>
    </div>
  );
}

/** Botão «Demonstração» (Artigos e ingredientes, só Admins): escolher, criar ou sair de um cenário fictício. */
export function StockDemoMenu() {
  const { api, scenario, isAdmin, setScenario } = useStockDemo();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StockDemoStatusDTO | null>(null);
  const { busy, error, run } = usePreparing();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.getStatus().then((s) => !cancelled && setStatus(s)).catch(() => !cancelled && setStatus(null));
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, api]);

  if (!isAdmin) return null;

  const choose = (s: StockDemoScenario, created: boolean) =>
    run(`A preparar a demonstração «${STOCK_DEMO_LABELS[s]}»…`, async () => {
      if (!created) await api.create(s);
      setOpen(false);
      setScenario(s);
    });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`rounded-md border px-3 py-1.5 text-sm font-medium ${scenario ? "border-amber-300 bg-amber-50 text-amber-900" : "border-line bg-surface-card text-ink hover:bg-surface-soft"}`}
      >
        Demonstração{scenario ? `: ${STOCK_DEMO_LABELS[scenario]}` : ""}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-line bg-surface-card p-1 text-sm shadow-pop">
          <p className="px-3 pb-1 pt-2 text-[11px] text-ink-muted">Dados fictícios para conhecer o Stock. Não mexe nos dados reais.</p>
          {(status?.scenarios ?? []).map((s) => (
            <button
              key={s.scenario}
              type="button"
              role="menuitemradio"
              aria-checked={scenario === s.scenario}
              onClick={() => void choose(s.scenario, s.created)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-surface-soft"
            >
              <span>
                <span className="font-medium text-ink">{s.label}</span>
                <span className="block text-[11px] text-ink-muted">{s.created ? `Pronta · ~${eur0(s.monthlySalesTargetCents ?? 0)}/mês em vendas` : "Criar (cerca de 30 s)"}</span>
              </span>
              {scenario === s.scenario && <span aria-hidden="true" className="text-brand-600">✓</span>}
            </button>
          ))}
          {!status && <p className="px-3 py-2 text-xs text-ink-muted">A carregar…</p>}
          {scenario && (
            <button type="button" role="menuitem" onClick={() => { setScenario(null); setOpen(false); }} className="mt-1 w-full rounded-md border-t border-line px-3 py-2 text-left text-ink-secondary hover:bg-surface-soft">
              Voltar aos dados reais
            </button>
          )}
          {error && <p className="px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>
      )}
      {busy && <Preparing label={busy} />}
    </div>
  );
}

/** Faixa fixa no topo da Gestão de Stock enquanto um cenário está ativo. */
export function StockDemoBanner() {
  const { api, scenario, setScenario, refresh } = useStockDemo();
  const [hint, setHint] = useState<string | null>(null);
  const { busy, error, run } = usePreparing();

  useEffect(() => {
    if (!scenario) return;
    let cancelled = false;
    api.getStatus().then((s) => !cancelled && setHint(s.scenarios.find((x) => x.scenario === scenario)?.posApiKeyHint ?? null)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, scenario]);

  if (!scenario) return null;
  return (
    <div role="status" className="sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
      <span>
        <b className="font-semibold">Demonstração: {STOCK_DEMO_LABELS[scenario]}</b> — dados fictícios. Vendas do CaixaFlow POS (fictício){hint ? ` · chave ${hint}` : ""}.
      </span>
      <span className="ml-auto flex gap-3">
        <button
          type="button"
          className="font-medium underline"
          onClick={() =>
            void run(`A recomeçar a demonstração «${STOCK_DEMO_LABELS[scenario]}»…`, async () => {
              await api.reset(scenario);
              refresh();
            })
          }
        >
          Recomeçar demonstração
        </button>
        <button type="button" className="font-medium underline" onClick={() => setScenario(null)}>
          Sair da demonstração
        </button>
      </span>
      {error && <span className="w-full text-red-700">{error}</span>}
      {busy && <Preparing label={busy} />}
    </div>
  );
}
