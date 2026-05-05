import { useState } from "react";
import {
  verifyPin,
  getVendusTotal,
  submitClosing,
  type VerifyPinResult,
  type CashClosing,
} from "./cashClosingApi";

// ---------- helpers ----------

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtEur(n: number): string {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDateLabel(ymd: string): string {
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------- PIN keypad ----------

const KEYPAD: (string | null)[] = [
  "1", "2", "3",
  "4", "5", "6",
  "7", "8", "9",
  null, "0", "⌫",
];

function PinDots({ count }: { count: number }) {
  return (
    <div className="flex gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-4 w-4 rounded-full transition-colors ${
            i < count ? "bg-indigo-400" : "bg-slate-600"
          }`}
        />
      ))}
    </div>
  );
}

// ---------- Amount input ----------

function AmountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 pr-10 text-right text-lg font-semibold text-white placeholder-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          placeholder="0.00"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          €
        </span>
      </div>
    </div>
  );
}

// ---------- Step types ----------

type Step =
  | "pin"
  | "date"
  | "tpa"
  | "delivery"
  | "cash"
  | "drawer"
  | "review"
  | "done";

type FormData = {
  employee: VerifyPinResult | null;
  closingDate: string;
  tpa: string;
  uber: string;
  glovo: string;
  bolt: string;
  eatz: string;
  cashSales: string;
  cashIn: string;
  cashOut: string;
  cashDrawerOpen: string;
  cashDrawerTotal: string;
  notes: string;
  vendusTotal: number | null;
};

const INITIAL_FORM: FormData = {
  employee: null,
  closingDate: todayYmd(),
  tpa: "",
  uber: "",
  glovo: "",
  bolt: "",
  eatz: "",
  cashSales: "",
  cashIn: "",
  cashOut: "",
  cashDrawerOpen: "",
  cashDrawerTotal: "",
  notes: "",
  vendusTotal: null,
};

// ---------- Main component ----------

export function CashClosingPage() {
  useEffect(() => { document.title = "Fecho de Caixa · Angry Box"; }, []);
  const [step, setStep] = useState<Step>("pin");
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [result, setResult] = useState<CashClosing | null>(null);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toNum(s: string): number {
    const n = parseFloat(s);
    return isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100;
  }

  const tpa = toNum(form.tpa);
  const uber = toNum(form.uber);
  const glovo = toNum(form.glovo);
  const bolt = toNum(form.bolt);
  const eatz = toNum(form.eatz);
  const cashSales = toNum(form.cashSales);
  const cashIn = toNum(form.cashIn);
  const cashOut = toNum(form.cashOut);
  const cashDrawerOpen = toNum(form.cashDrawerOpen);
  const cashDrawerTotal = toNum(form.cashDrawerTotal);
  const totalCalculated = tpa + uber + glovo + bolt + eatz + cashSales;
  const expectedCash = Math.round((cashDrawerOpen + cashSales + cashIn - cashOut) * 100) / 100;
  const cashDiff = cashDrawerTotal > 0 || expectedCash > 0
    ? Math.round((cashDrawerTotal - expectedCash) * 100) / 100
    : null;
  const sangriaAmount = cashDrawerTotal > 100 ? Math.round((cashDrawerTotal - 100) * 100) / 100 : 0;
  const diff =
    form.vendusTotal != null
      ? Math.round((totalCalculated - form.vendusTotal) * 100) / 100
      : null;

  // ---- PIN step ----
  async function handlePinKey(key: string) {
    if (loading) return;
    if (key === "⌫") {
      setPinDigits((d) => d.slice(0, -1));
      setError("");
      return;
    }
    if (pinDigits.length >= 4) return;
    const next = [...pinDigits, key];
    setPinDigits(next);
    if (next.length === 4) {
      setLoading(true);
      setError("");
      try {
        const emp = await verifyPin(next.join(""));
        setField("employee", emp);
        setStep("date");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro ao verificar PIN");
      } finally {
        setLoading(false);
        setPinDigits([]);
      }
    }
  }

  // ---- Drawer step → fetch Vendus total then go to review ----
  async function goToReview() {
    setLoading(true);
    setError("");
    try {
      const vt = await getVendusTotal(form.closingDate);
      setField("vendusTotal", vt);
      setStep("review");
    } catch {
      setField("vendusTotal", null);
      setStep("review");
    } finally {
      setLoading(false);
    }
  }

  // ---- Submit ----
  async function handleSubmit() {
    if (!form.employee) return;
    setLoading(true);
    setError("");
    try {
      const closing = await submitClosing({
        employeeId: form.employee.employeeId,
        closingDate: form.closingDate,
        tpa,
        uber,
        glovo,
        bolt,
        eatz,
        cashSales,
        cashIn,
        cashOut,
        cashDrawerOpen,
        cashDrawerTotal,
        notes: form.notes.trim() || null,
      });
      setResult(closing);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao submeter");
    } finally {
      setLoading(false);
    }
  }

  // ---- PIN screen ----
  if (step === "pin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 py-12">
        <div className="flex w-full max-w-xs flex-col items-center gap-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">Fecho de Caixa</p>
            <p className="mt-1 text-sm text-slate-400">Introduz o teu PIN</p>
          </div>
          {error && (
            <p className="rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{error}</p>
          )}
          <PinDots count={pinDigits.length} />
          {loading ? (
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-indigo-400" />
          ) : (
            <div className="grid w-full grid-cols-3 gap-3">
              {KEYPAD.map((key, i) =>
                key === null ? (
                  <div key={i} />
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void handlePinKey(key)}
                    className="flex h-16 items-center justify-center rounded-2xl bg-slate-700 text-xl font-semibold text-white transition-colors hover:bg-slate-600 active:scale-95"
                  >
                    {key}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Date step ----
  if (step === "date") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-2xl font-bold text-white">Fecho de Caixa</p>
            <p className="mt-1 text-sm text-slate-400">
              Olá, <span className="text-white">{form.employee?.fullName}</span>
            </p>
          </div>
          <div className="rounded-2xl bg-slate-800 p-6">
            <p className="mb-4 text-sm font-medium text-slate-300">Data do fecho</p>
            <input
              type="date"
              value={form.closingDate}
              onChange={(e) => setField("closingDate", e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-lg text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <p className="mt-2 text-center text-sm capitalize text-slate-400">
              {fmtDateLabel(form.closingDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep("tpa")}
            className="mt-6 w-full rounded-2xl bg-indigo-600 py-4 text-lg font-semibold text-white hover:bg-indigo-500 active:scale-95"
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // ---- TPA step ----
  if (step === "tpa") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 py-12">
        <div className="w-full max-w-sm">
          <StepHeader step={2} total={6} title="Multibanco / TPA" />
          <div className="rounded-2xl bg-slate-800 p-6">
            <AmountInput label="Total TPA" value={form.tpa} onChange={(v) => setField("tpa", v)} />
          </div>
          <StepActions
            onBack={() => setStep("date")}
            onNext={() => setStep("delivery")}
          />
        </div>
      </div>
    );
  }

  // ---- Delivery step ----
  if (step === "delivery") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 py-12">
        <div className="w-full max-w-sm">
          <StepHeader step={3} total={6} title="Apps de Entrega" />
          <div className="rounded-2xl bg-slate-800 p-6 space-y-4">
            <AmountInput label="Uber Eats" value={form.uber} onChange={(v) => setField("uber", v)} />
            <AmountInput label="Glovo" value={form.glovo} onChange={(v) => setField("glovo", v)} />
            <AmountInput label="Bolt Food" value={form.bolt} onChange={(v) => setField("bolt", v)} />
            <AmountInput label="Eatz" value={form.eatz} onChange={(v) => setField("eatz", v)} />
          </div>
          <StepActions
            onBack={() => setStep("tpa")}
            onNext={() => setStep("cash")}
          />
        </div>
      </div>
    );
  }

  // ---- Cash step ----
  if (step === "cash") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 py-12">
        <div className="w-full max-w-sm">
          <StepHeader step={4} total={6} title="Vendas a Dinheiro" />
          <div className="rounded-2xl bg-slate-800 p-6 space-y-4">
            <AmountInput
              label="Total de vendas a dinheiro"
              value={form.cashSales}
              onChange={(v) => setField("cashSales", v)}
            />
          </div>
          <StepActions
            onBack={() => setStep("delivery")}
            onNext={() => setStep("drawer")}
          />
        </div>
      </div>
    );
  }

  // ---- Drawer step ----
  if (step === "drawer") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 py-12">
        <div className="w-full max-w-sm">
          <StepHeader step={5} total={6} title="Movimentos de Caixa" />
          <div className="rounded-2xl bg-slate-800 p-6 space-y-4">
            <AmountInput
              label="Entradas de dinheiro"
              value={form.cashIn}
              onChange={(v) => setField("cashIn", v)}
            />
            <p className="text-xs text-slate-500">
              Ex: fundo de caixa adicionado, trocos recebidos
            </p>
            <AmountInput
              label="Saídas de dinheiro"
              value={form.cashOut}
              onChange={(v) => setField("cashOut", v)}
            />
            <p className="text-xs text-slate-500">
              Ex: despesas pagas a dinheiro, sangrias intermédias
            </p>
            <div className="border-t border-slate-700 pt-4">
              <AmountInput
                label="Total contado na gaveta (início do dia)"
                value={form.cashDrawerOpen}
                onChange={(v) => setField("cashDrawerOpen", v)}
              />
              <div className="mt-4">
                <AmountInput
                  label="Total contado na gaveta (fim do dia)"
                  value={form.cashDrawerTotal}
                  onChange={(v) => setField("cashDrawerTotal", v)}
                />
              </div>
            </div>
          </div>
          <StepActions
            onBack={() => setStep("cash")}
            onNext={() => void goToReview()}
            nextLabel={loading ? "A carregar…" : "Rever"}
            nextDisabled={loading}
          />
        </div>
      </div>
    );
  }

  // ---- Review step ----
  if (step === "review") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-start bg-slate-900 px-6 py-12">
        <div className="w-full max-w-sm">
          <StepHeader step={6} total={6} title="Resumo do Fecho" />
          <div className="rounded-2xl bg-slate-800 divide-y divide-slate-700">
            <ReviewRow label="Data" value={fmtDateLabel(form.closingDate)} />
            <ReviewRow label="Funcionário" value={form.employee?.fullName ?? ""} />
            <ReviewRow label="TPA" value={fmtEur(tpa)} />
            <ReviewRow label="Uber Eats" value={fmtEur(uber)} />
            <ReviewRow label="Glovo" value={fmtEur(glovo)} />
            <ReviewRow label="Bolt Food" value={fmtEur(bolt)} />
            <ReviewRow label="Eatz" value={fmtEur(eatz)} />
            <ReviewRow label="Vendas a dinheiro" value={fmtEur(cashSales)} />
            {cashIn > 0 && <ReviewRow label="Entradas" value={fmtEur(cashIn)} />}
            {cashOut > 0 && <ReviewRow label="Saídas" value={fmtEur(cashOut)} />}
            <ReviewRow label="Gaveta (início do dia)" value={fmtEur(cashDrawerOpen)} />
            <ReviewRow label="Gaveta (fim do dia)" value={fmtEur(cashDrawerTotal)} />
            <ReviewRow label="Total Calculado" value={fmtEur(totalCalculated)} highlight />
            {form.vendusTotal != null && (
              <ReviewRow label="Total Vendus" value={fmtEur(form.vendusTotal)} />
            )}
            {diff != null && (
              <ReviewRow
                label="Diferença Vendus"
                value={(diff >= 0 ? "+" : "") + fmtEur(diff)}
                diffColor={diff === 0 ? "green" : diff > 0 ? "blue" : "red"}
              />
            )}
            <ReviewRow label="Total contado em caixa" value={fmtEur(cashDrawerTotal)} />
            <ReviewRow label="Total esperado em caixa" value={fmtEur(expectedCash)} />
            {cashDiff !== null && (
              <ReviewRow
                label="Diferença de caixa"
                value={(cashDiff >= 0 ? "+" : "") + fmtEur(cashDiff)}
                diffColor={cashDiff === 0 ? "green" : cashDiff > 0 ? "blue" : "red"}
              />
            )}
            {sangriaAmount > 0 && (
              <ReviewRow label="Sangria (envelope)" value={fmtEur(sangriaAmount)} amber />
            )}
          </div>

          <div className="mt-4 rounded-2xl bg-slate-800 p-4">
            <label className="text-sm font-medium text-slate-300">Observações (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="Alguma nota adicional?"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{error}</p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("drawer")}
              className="flex-1 rounded-2xl border border-slate-600 py-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              Corrigir
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSubmit()}
              className="flex-[2] rounded-2xl bg-emerald-600 py-4 text-lg font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 active:scale-95"
            >
              {loading ? "A submeter…" : "Confirmar Fecho"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Done screen ----
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-800 px-6">
      <div className="max-w-xs text-center">
        <p className="text-6xl">✓</p>
        <p className="mt-6 text-2xl font-bold text-white">Fecho submetido!</p>
        <p className="mt-2 text-lg text-emerald-200">
          {form.employee?.fullName?.split(" ")[0]}, obrigado pelo registo.
        </p>
        {result && sangriaAmount > 0 && (
          <div className="mt-6 rounded-2xl bg-emerald-700 px-6 py-4">
            <p className="text-sm font-semibold text-emerald-100">Lembra-te da sangria:</p>
            <p className="mt-1 text-2xl font-bold text-white">{fmtEur(sangriaAmount)}</p>
            <p className="mt-1 text-xs text-emerald-300">para colocar no envelope</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setStep("pin");
            setForm(INITIAL_FORM);
            setPinDigits([]);
            setResult(null);
            setError("");
          }}
          className="mt-8 rounded-2xl border border-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-700"
        >
          Novo fecho
        </button>
      </div>
    </div>
  );
}

// ---------- sub-components ----------

function StepHeader({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div className="mb-6 text-center">
      <p className="text-xs font-medium text-slate-500">
        Passo {step} de {total}
      </p>
      <p className="mt-1 text-xl font-bold text-white">{title}</p>
      <div className="mt-3 flex gap-1 justify-center">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 w-8 rounded-full transition-colors ${
              i < step ? "bg-indigo-400" : "bg-slate-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function StepActions({
  onBack,
  onNext,
  nextLabel = "Continuar",
  nextDisabled = false,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-6 flex gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex-1 rounded-2xl border border-slate-600 py-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"
      >
        Voltar
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-[2] rounded-2xl bg-indigo-600 py-4 text-lg font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 active:scale-95"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  highlight,
  amber,
  diffColor,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  amber?: boolean;
  diffColor?: "green" | "blue" | "red";
}) {
  const valueClass = diffColor
    ? diffColor === "green"
      ? "text-emerald-400"
      : diffColor === "blue"
        ? "text-blue-400"
        : "text-red-400"
    : amber
      ? "text-amber-300 font-semibold"
      : highlight
        ? "text-white font-bold text-lg"
        : "text-slate-200";

  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className={`text-sm ${highlight ? "font-semibold text-slate-200" : "text-slate-400"}`}>
        {label}
      </span>
      <span className={`text-sm tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
