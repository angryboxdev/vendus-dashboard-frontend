import { useEffect, useState, type ReactNode } from "react";
import {
  verifyPin,
  getSessions,
  submitClosing,
  getAirMenuTotals,
  type VerifyPinResult,
  type CashClosing,
  type RegisterSessionDto,
  type DrawerDenominations,
  type AirMenuTotals,
} from "./cashClosingApi";
import { PageFooter } from "../../components/PageFooter.tsx";

// ---------- denomination constants (drawer end-of-day count) ----------

const BILL_DENOMS = [50, 20, 10, 5];
const COIN_DENOMS = [2, 1, 0.5, 0.2, 0.1, 0.01];
const ALL_DENOMS = [...BILL_DENOMS, ...COIN_DENOMS];

// ---------- helpers ----------

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtEur(n: number): string {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDateLabel(ymd: string): string {
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("pt-PT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return iso.slice(11, 16);
}

function fmtDenom(d: number): string {
  const cents = Math.round(d * 100);
  if (cents >= 100) return `${cents / 100} €`;
  return `${cents} cênt.`;
}

/** Maps the component's denomQty Record to the typed DrawerDenominations shape. */
function toDenominations(q: Record<string, number>): DrawerDenominations {
  return {
    notes50: q["50"] ?? 0,
    notes20: q["20"] ?? 0,
    notes10: q["10"] ?? 0,
    notes5: q["5"] ?? 0,
    coins200: q["2"] ?? 0,
    coins100: q["1"] ?? 0,
    coins50: q["0.5"] ?? 0,
    coins20: q["0.2"] ?? 0,
    coins10: q["0.1"] ?? 0,
    coins1: q["0.01"] ?? 0,
  };
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
          className={`h-3.5 w-3.5 rounded-full transition-all duration-150 ${
            i < count ? "scale-110 bg-[#ED5C32]" : "bg-stone-200"
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
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-stone-500">{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 pr-10 text-right text-lg font-semibold text-stone-800 placeholder-stone-300 focus:border-[#ED5C32] focus:outline-none focus:ring-2 focus:ring-[#ED5C32]/10"
          placeholder="0.00"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
          €
        </span>
      </div>
    </div>
  );
}

// ---------- Denomination column (compact, for 2-col grid) ----------

function DenomCol({
  title,
  denoms,
  denomQty,
  setDenom,
}: {
  title: string;
  denoms: number[];
  denomQty: Record<string, number>;
  setDenom: (d: number, qty: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">{title}</p>
      <div className="space-y-1.5">
        {denoms.map((d) => {
          const qty = denomQty[String(d)] ?? 0;
          const subtotal = Math.round(d * qty * 100) / 100;
          return (
            <div key={d} className="rounded-xl bg-stone-50 px-2 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700">{fmtDenom(d)}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDenom(d, qty - 1)}
                    disabled={qty === 0}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white text-sm font-bold text-stone-500 transition-all hover:bg-stone-100 disabled:opacity-30 active:scale-90"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-bold tabular-nums text-stone-800">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setDenom(d, qty + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ED5C32]/10 text-sm font-bold text-[#ED5C32] transition-all hover:bg-[#ED5C32]/20 active:scale-90"
                  >
                    +
                  </button>
                </div>
              </div>
              {subtotal > 0 && (
                <p className="mt-0.5 text-right text-xs tabular-nums text-stone-400">{fmtEur(subtotal)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Step types ----------

type Step = "pin" | "date" | "session" | "tpa" | "delivery" | "cash" | "drawer" | "review" | "done";

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

  // Sessions
  const [sessions, setSessions] = useState<RegisterSessionDto[]>([]);
  const [selectedSession, setSelectedSession] = useState<RegisterSessionDto | null>(null);
  const [airMenuTotals, setAirMenuTotals] = useState<AirMenuTotals | null>(null);

  // Denomination state — for end-of-day drawer count (cashDrawerTotal)
  const [denomQty, setDenomQty] = useState<Record<string, number>>({});

  function setDenom(d: number, qty: number) {
    setDenomQty((prev) => ({ ...prev, [String(d)]: Math.max(0, qty) }));
  }

  const totalSteps = 7;

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
  // cashDrawerTotal is computed from the denomination count
  const cashDrawerTotal = Math.round(
    ALL_DENOMS.reduce((sum, d) => sum + d * (denomQty[String(d)] ?? 0), 0) * 100,
  ) / 100;

  const vendusCalculated = Math.round((tpa + eatz + cashSales) * 100) / 100;
  const airMenuCalculated = Math.round((uber + glovo + bolt) * 100) / 100;
  const totalCalculated = Math.round((vendusCalculated + airMenuCalculated) * 100) / 100;
  const expectedCash = Math.round((cashDrawerOpen + cashSales + cashIn - cashOut) * 100) / 100;
  const cashDiff =
    cashDrawerTotal > 0 || expectedCash > 0
      ? Math.round((cashDrawerTotal - expectedCash) * 100) / 100
      : null;
  const sangriaAmount =
    cashDrawerTotal > 100 ? Math.round((cashDrawerTotal - 100) * 100) / 100 : 0;
  const diff =
    form.vendusTotal != null
      ? Math.round((vendusCalculated - form.vendusTotal) * 100) / 100
      : null;

  function resetAll() {
    setStep("pin");
    setForm(INITIAL_FORM);
    setPinDigits([]);
    setResult(null);
    setError("");
    setSessions([]);
    setSelectedSession(null);
    setAirMenuTotals(null);
    setDenomQty({});
  }

  // ---- PIN ----
  async function handlePinKey(key: string) {
    if (loading) return;
    if (key === "⌫") { setPinDigits((d) => d.slice(0, -1)); setError(""); return; }
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

  // ---- Date → sessions ----
  async function goFromDate() {
    setLoading(true);
    setError("");
    try {
      const fetched = await getSessions(form.closingDate);
      setSessions(fetched);
      setSelectedSession(null);
      setStep("session");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar sessões");
    } finally {
      setLoading(false);
    }
  }

  // ---- Drawer → review ----
  async function goToReview() {
    setField("vendusTotal", selectedSession?.total ?? null);
    const totals = await getAirMenuTotals(form.closingDate).catch(() => null);
    setAirMenuTotals(totals);
    setStep("review");
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
        tpa, uber, glovo, bolt, eatz, cashSales, cashIn, cashOut,
        cashDrawerOpen, cashDrawerTotal,
        notes: form.notes.trim() || null,
        sessionOpenedAt: selectedSession?.openedAt ?? null,
        drawerDenominations: toDenominations(denomQty),
      });
      setResult(closing);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao submeter");
    } finally {
      setLoading(false);
    }
  }

  // ========== PIN screen ==========
  if (step === "pin") {
    return (
      <StepShell>
        <div className="flex w-full max-w-xs flex-col items-center gap-8">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Angry Box</p>
            <p className="mt-2 text-2xl font-bold text-stone-800">Fecho de Caixa</p>
            <p className="mt-1 text-sm text-stone-400">Introduz o teu PIN</p>
          </div>
          {error && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
          )}
          <PinDots count={pinDigits.length} />
          {loading ? (
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-[#ED5C32]" />
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
                    className="flex h-16 items-center justify-center rounded-2xl border border-stone-100 bg-white text-xl font-semibold text-stone-800 shadow-sm transition-all hover:bg-stone-50 active:scale-95"
                  >
                    {key}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </StepShell>
    );
  }

  // ========== Date step ==========
  if (step === "date") {
    return (
      <StepShell>
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Angry Box</p>
            <p className="mt-2 text-2xl font-bold text-stone-800">Fecho de Caixa</p>
            <p className="mt-1 text-sm text-stone-400">
              Olá, <span className="font-medium text-stone-700">{form.employee?.fullName}</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm font-medium text-stone-500">Data do fecho</p>
            <input
              type="date"
              value={form.closingDate}
              onChange={(e) => setField("closingDate", e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-[#FAF6F3] px-4 py-3 text-lg text-stone-800 focus:border-[#ED5C32] focus:outline-none focus:ring-2 focus:ring-[#ED5C32]/10"
            />
            <p className="mt-2 text-center text-sm capitalize text-stone-400">
              {fmtDateLabel(form.closingDate)}
            </p>
          </div>
          {error && (
            <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => void goFromDate()}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#ED5C32] to-[#F1A93F] py-4 text-lg font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 active:scale-95"
          >
            {loading ? "A carregar…" : "Continuar"}
          </button>
        </div>
      </StepShell>
    );
  }

  // ========== Session step ==========
  if (step === "session") {
    return (
      <StepShell>
        <div className="w-full max-w-sm">
          <StepHeader step={2} total={7} title="Sessão de Caixa" />
          {sessions.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-stone-400">
                Nenhuma sessão encontrada para {fmtDateLabel(form.closingDate)}.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((s) => {
                const isSelected = selectedSession?.openedAt === s.openedAt;
                return (
                  <button
                    key={s.openedAt}
                    type="button"
                    disabled={s.alreadySubmitted}
                    onClick={() => setSelectedSession(s)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      s.alreadySubmitted
                        ? "cursor-not-allowed border-stone-100 bg-white opacity-40"
                        : isSelected
                          ? "border-[#ED5C32]/40 bg-[#ED5C32]/5 ring-1 ring-[#ED5C32]/40"
                          : "border-stone-100 bg-white shadow-sm hover:border-stone-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">
                          {fmtTime(s.openedAt)} → {s.closedAt ? fmtTime(s.closedAt) : "Em aberto"}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-400">
                          {s.alreadySubmitted ? "Já submetido" : "Disponível"}
                        </p>
                      </div>
                      <p className="text-lg font-bold tabular-nums text-stone-800">{fmtEur(s.total)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <StepActions
            onBack={() => setStep("date")}
            onNext={() => setStep("tpa")}
            nextDisabled={selectedSession === null}
          />
        </div>
      </StepShell>
    );
  }

  // ========== TPA step ==========
  if (step === "tpa") {
    return (
      <StepShell>
        <div className="w-full max-w-sm">
          <StepHeader step={3} total={totalSteps} title="Multibanco / TPA" />
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <AmountInput label="Total TPA" value={form.tpa} onChange={(v) => setField("tpa", v)} />
          </div>
          <StepActions
            onBack={() => setStep("session")}
            onNext={() => setStep("delivery")}
          />
        </div>
      </StepShell>
    );
  }

  // ========== Delivery step ==========
  if (step === "delivery") {
    return (
      <StepShell>
        <div className="w-full max-w-sm">
          <StepHeader step={4} total={totalSteps} title="Apps de Entrega" />
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
            <AmountInput label="Uber Eats" value={form.uber} onChange={(v) => setField("uber", v)} />
            <AmountInput label="Glovo" value={form.glovo} onChange={(v) => setField("glovo", v)} />
            <AmountInput label="Bolt Food" value={form.bolt} onChange={(v) => setField("bolt", v)} />
            <AmountInput label="Eatz" value={form.eatz} onChange={(v) => setField("eatz", v)} />
          </div>
          <StepActions onBack={() => setStep("tpa")} onNext={() => setStep("cash")} />
        </div>
      </StepShell>
    );
  }

  // ========== Cash step — simple text input ==========
  if (step === "cash") {
    return (
      <StepShell>
        <div className="w-full max-w-sm">
          <StepHeader step={5} total={totalSteps} title="Vendas a Dinheiro" />
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <AmountInput
              label="Total de vendas a dinheiro"
              value={form.cashSales}
              onChange={(v) => setField("cashSales", v)}
            />
          </div>
          <StepActions onBack={() => setStep("delivery")} onNext={() => setStep("drawer")} />
        </div>
      </StepShell>
    );
  }

  // ========== Drawer step — cash movements + denomination count ==========
  if (step === "drawer") {
    return (
      <StepShell align="start">
        <div className="w-full max-w-sm">
          <StepHeader step={6} total={totalSteps} title="Movimentos de Caixa" />
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
            <AmountInput label="Entradas de dinheiro" value={form.cashIn} onChange={(v) => setField("cashIn", v)} />
            <p className="text-xs text-stone-400">Ex: fundo de caixa adicionado, trocos recebidos</p>
            <AmountInput label="Saídas de dinheiro" value={form.cashOut} onChange={(v) => setField("cashOut", v)} />
            <p className="text-xs text-stone-400">Ex: despesas pagas a dinheiro, sangrias intermédias</p>
            <div className="border-t border-stone-100 pt-4">
              <AmountInput
                label="Total contado na gaveta (início do dia)"
                value={form.cashDrawerOpen}
                onChange={(v) => setField("cashDrawerOpen", v)}
              />
            </div>
            {/* Denomination count — 2-column grid */}
            <div className="border-t border-stone-100 pt-4">
              <p className="mb-3 text-sm font-medium text-stone-500">
                Total contado na gaveta (fim do dia)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <DenomCol title="Notas" denoms={BILL_DENOMS} denomQty={denomQty} setDenom={setDenom} />
                <DenomCol title="Moedas" denoms={COIN_DENOMS} denomQty={denomQty} setDenom={setDenom} />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
                <span className="text-sm font-semibold text-stone-600">Total da gaveta (fim)</span>
                <span className={`text-xl font-bold tabular-nums ${cashDrawerTotal > 0 ? "text-stone-900" : "text-stone-300"}`}>
                  {fmtEur(cashDrawerTotal)}
                </span>
              </div>
            </div>
          </div>
          <StepActions
            onBack={() => setStep("cash")}
            onNext={goToReview}
            nextLabel="Rever"
          />
        </div>
      </StepShell>
    );
  }

  // ========== Review step ==========
  if (step === "review") {
    return (
      <StepShell align="start">
        <div className="w-full max-w-sm">
          <StepHeader step={7} total={totalSteps} title="Resumo do Fecho" />
          <div className="divide-y divide-stone-100 rounded-2xl bg-white shadow-sm">
            <ReviewRow label="Data" value={fmtDateLabel(form.closingDate)} />
            {selectedSession && (
              <ReviewRow
                label="Sessão"
                value={`${fmtTime(selectedSession.openedAt)} → ${selectedSession.closedAt ? fmtTime(selectedSession.closedAt) : "Em aberto"}`}
              />
            )}
            <ReviewRow label="Funcionário" value={form.employee?.fullName ?? ""} />

            {/* Canal Próprio (Vendus) */}
            <div className="bg-stone-50 px-5 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Canal Próprio</span>
            </div>
            <ReviewRow label="TPA" value={fmtEur(tpa)} />
            <ReviewRow label="Eatz" value={fmtEur(eatz)} />
            <ReviewRow label="Vendas a dinheiro" value={fmtEur(cashSales)} />
            <ReviewRow label="Subtotal Vendus" value={fmtEur(vendusCalculated)} highlight />
            {form.vendusTotal != null && <ReviewRow label="Total Vendus" value={fmtEur(form.vendusTotal)} />}
            {diff != null && (
              <ReviewRow
                label="Diferença Vendus"
                value={(diff >= 0 ? "+" : "") + fmtEur(diff)}
                diffColor={diff === 0 ? "green" : diff > 0 ? "blue" : "red"}
              />
            )}

            {/* Canais Externos (AirMenu) */}
            <div className="bg-stone-50 px-5 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Canais Externos</span>
            </div>
            <ReviewRow label="Uber Eats" value={fmtEur(uber)} />
            <ReviewRow label="Glovo" value={fmtEur(glovo)} />
            <ReviewRow label="Bolt Food" value={fmtEur(bolt)} />
            <ReviewRow label="Subtotal AirMenu" value={fmtEur(airMenuCalculated)} highlight />
            {airMenuTotals != null && (() => {
              const airMenuRefTotal = Math.round((airMenuTotals.uber + airMenuTotals.glovo + airMenuTotals.bolt) * 100) / 100;
              const airMenuDiff = Math.round((airMenuCalculated - airMenuRefTotal) * 100) / 100;
              return (
                <>
                  <ReviewRow label="Total AirMenu" value={fmtEur(airMenuRefTotal)} />
                  <ReviewRow
                    label="Diferença AirMenu"
                    value={(airMenuDiff >= 0 ? "+" : "") + fmtEur(airMenuDiff)}
                    diffColor={airMenuDiff === 0 ? "green" : airMenuDiff > 0 ? "blue" : "red"}
                  />
                </>
              );
            })()}

            {/* Total geral */}
            <ReviewRow label="Total Calculado" value={fmtEur(totalCalculated)} highlight />

            {/* Movimentos de Caixa */}
            <div className="bg-stone-50 px-5 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Movimentos de Caixa</span>
            </div>
            <ReviewRow label="Gaveta (início)" value={fmtEur(cashDrawerOpen)} />
            {cashIn > 0 && <ReviewRow label="Entradas" value={fmtEur(cashIn)} />}
            {cashOut > 0 && <ReviewRow label="Saídas" value={fmtEur(cashOut)} />}
            <ReviewRow label="Gaveta (fim)" value={fmtEur(cashDrawerTotal)} />
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

          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <label className="text-sm font-medium text-stone-500">Observações (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-[#FAF6F3] px-3 py-2 text-sm text-stone-800 placeholder-stone-300 focus:border-[#ED5C32] focus:outline-none focus:ring-2 focus:ring-[#ED5C32]/10"
              placeholder="Alguma nota adicional?"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("drawer")}
              className="flex-1 rounded-2xl border border-stone-200 bg-white py-4 text-sm font-semibold text-stone-600 hover:bg-stone-50 active:scale-95"
            >
              Corrigir
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSubmit()}
              className="flex-[2] rounded-2xl bg-gradient-to-r from-[#ED5C32] to-[#F1A93F] py-4 text-lg font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 active:scale-95"
            >
              {loading ? "A submeter…" : "Confirmar Fecho"}
            </button>
          </div>
        </div>
      </StepShell>
    );
  }

  // ========== Done screen ==========
  void result;
  const firstName = form.employee?.fullName?.split(" ")[0] ?? "";
  return (
    <StepShell>
      <div className="w-full max-w-xs">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <span className="text-3xl text-emerald-600">✓</span>
          </div>
          <p className="text-2xl font-bold text-stone-800">Fecho submetido!</p>
          <p className="mt-1 text-stone-500">{firstName}, obrigado pelo registo.</p>
        </div>

        <div className="space-y-3">
          {sangriaAmount > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Lembrete · Sangria
              </p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-amber-700">
                {fmtEur(sangriaAmount)}
              </p>
              <p className="mt-0.5 text-sm text-amber-600">
                Coloca no envelope de sangria antes de sair
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-[#ED5C32]/30 bg-[#ED5C32]/5 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#A3211A]">
              Lembrete · Vendus
            </p>
            <p className="mt-1.5 text-sm font-medium text-[#A3211A]">
              Não te esqueças de concluir o fecho de caixa no Vendus
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetAll}
          className="mt-8 w-full rounded-2xl bg-gradient-to-r from-[#ED5C32] to-[#F1A93F] py-4 text-lg font-semibold text-white shadow-sm hover:opacity-90 active:scale-95"
        >
          Novo fecho
        </button>
      </div>
    </StepShell>
  );
}

// ---------- sub-components ----------

/**
 * Wrapper comum a todos os ecrãs do kiosk.
 * Inclui a barra de acento no topo, a área de conteúdo (centrada ou alinhada ao topo)
 * e o PageFooter no fundo.
 */
function StepShell({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF6F3]">
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-gradient-to-r from-[#ED5C32] to-[#F1A93F]" />
      <div
        className={`flex flex-1 flex-col items-center px-6 py-12 ${
          align === "center" ? "justify-center" : "justify-start"
        }`}
      >
        {children}
      </div>
      <PageFooter />
    </div>
  );
}

function StepHeader({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div className="mb-6 text-center">
      <p className="text-xs font-medium text-stone-400">Passo {step} de {total}</p>
      <p className="mt-1 text-xl font-bold text-stone-800">{title}</p>
      <div className="mt-3 flex justify-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 w-6 rounded-full transition-colors ${i < step ? "bg-[#ED5C32]" : "bg-stone-200"}`}
          />
        ))}
      </div>
    </div>
  );
}

function StepActions({
  onBack, onNext, nextLabel = "Continuar", nextDisabled = false,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-5 flex gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex-1 rounded-2xl border border-stone-200 bg-white py-4 text-sm font-semibold text-stone-600 hover:bg-stone-50 active:scale-95"
      >
        Voltar
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-[2] rounded-2xl bg-gradient-to-r from-[#ED5C32] to-[#F1A93F] py-4 text-lg font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40 active:scale-95"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function ReviewRow({
  label, value, highlight, amber, diffColor,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  amber?: boolean;
  diffColor?: "green" | "blue" | "red";
}) {
  const valueClass = diffColor
    ? diffColor === "green" ? "text-emerald-600" : diffColor === "blue" ? "text-blue-600" : "text-red-500"
    : amber
      ? "font-semibold text-amber-600"
      : highlight
        ? "text-lg font-bold text-stone-900"
        : "text-stone-700";

  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className={`text-sm ${highlight ? "font-semibold text-stone-600" : "text-stone-400"}`}>
        {label}
      </span>
      <span className={`text-sm tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
