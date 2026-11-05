import { Delete } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PosEmployee } from "../../domain/entities/pos.ts";
import { usePosModule } from "../../pos.module.tsx";
import { errorText } from "./use-pos.ts";
import { POS, TOUCH } from "./pos-theme.ts";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

/**
 * PIN de 4 dígitos (o do quiosque de ponto). Valida no servidor ao 4.º dígito;
 * com `requireManager`, recusa quem não é gestor. O PIN errado mostra-se e limpa.
 */
export function PosPinPad({
  title,
  subtitle,
  requireManager = false,
  keyboard = true,
  fallbackPin,
  onSuccess,
  onCancel,
}: {
  title: string;
  subtitle?: string;
  requireManager?: boolean;
  /** PIN aceite sem ir ao servidor (provisório, só para a saída do POS). */
  fallbackPin?: string;
  /** Ouvir o teclado físico (desligar quando há outro teclado de PIN à frente). */
  keyboard?: boolean;
  onSuccess: (employee: PosEmployee, pin: string) => void;
  onCancel?: () => void;
}) {
  const { pos } = usePosModule();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pin.length !== 4) return;
    if (fallbackPin && pin === fallbackPin) {
      onSuccess({ id: "", name: "Gestão", isManager: true }, pin);
      return;
    }
    let alive = true;
    setBusy(true);
    pos
      .login(pin)
      .then((employee) => {
        if (!alive) return;
        if (requireManager && !employee.isManager) throw new Error("Este PIN não é de um gestor.");
        onSuccess(employee, pin);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(errorText(e));
        setTimeout(() => {
          setPin("");
          setError(null);
        }, 1200);
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // onSuccess muda a cada render do pai; só o PIN completo dispara a validação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pos, requireManager, fallbackPin]);

  const press = (k: string) => {
    if (busy || error) return;
    if (k === "back") setPin((p) => p.slice(0, -1));
    else if (k && pin.length < 4) setPin((p) => p + k);
  };

  // Teclado físico: algarismos, apagar e Esc (cancelar). Só o teclado da janela da frente ouve.
  const pressRef = useRef(press);
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    pressRef.current = press;
    cancelRef.current = onCancel;
  });
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === "Backspace") pressRef.current("back");
      else if (e.key === "Escape" && cancelRef.current) cancelRef.current();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard]);

  return (
    <div className={`${POS.card} ${POS.border} ${POS.radius} w-full max-w-sm border p-6 shadow-sm`}>
      <h2 className="text-center text-xl font-semibold">{title}</h2>
      {subtitle && <p className={`mt-1 text-center text-sm ${POS.mutedText}`}>{subtitle}</p>}
      <div className="my-6 flex justify-center gap-3" aria-label="PIN" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 ${error ? "border-red-600 bg-red-600" : i < pin.length ? "border-[#2b2420] bg-[#2b2420]" : "border-[#7d6b5a]"}`} />
        ))}
      </div>
      <p className="mb-3 h-5 text-center text-sm font-medium text-red-700" role="alert">
        {error}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              aria-label={k === "back" ? "Apagar" : k}
              onClick={() => press(k)}
              className={`${TOUCH} ${POS.secondary} flex h-16 items-center justify-center text-2xl ${POS.num} active:brightness-95`}
            >
              {k === "back" ? <Delete aria-hidden className="h-6 w-6" /> : k}
            </button>
          ),
        )}
      </div>
      {onCancel && (
        <button type="button" onClick={onCancel} className={`mt-4 w-full text-sm underline ${POS.mutedText}`}>
          Cancelar
        </button>
      )}
    </div>
  );
}
