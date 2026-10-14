import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Drawer, IconSend } from "../../../../../components/ui/index.ts";
import { ApiError } from "../../../../../lib/api.ts";
import type { AppliedBatch, AssistantReply, ChatTurn } from "../../../domain/entities/assistant.ts";
import { SUGGESTIONS, historyForServer, periodLabel, rosterStateLabel } from "../../../domain/services/assistant.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import type { AssistantHostContext } from "./MezzaAssistantButton.tsx";
import { MezzaIcon } from "./MezzaIcon.tsx";
import { useVoice } from "./use-voice.ts";

const UNAVAILABLE = "O Assistente Mezza está temporariamente indisponível. Pode continuar a editar a escala normalmente.";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Turn extends ChatTurn {
  id: number;
  facts?: string[];
  confirmation?: { token: string; summary: string; state: "open" | "confirmed" | "cancelled" };
  undoHint?: boolean;
  error?: boolean;
}

/**
 * Chat do Assistente Mezza (carregado só ao abrir). Texto e voz seguem o
 * mesmo caminho; cada envio tem a sua Idempotency-Key (retry = mesma chave,
 * nunca duplica). O que a IA alterou entra no Desfazer da escala.
 */
export default function AssistantPanel({
  open,
  onClose,
  context,
  onApplied,
  onTemplatesChanged,
  onPublishFlow,
  onBusy,
  onReply,
}: {
  open: boolean;
  onClose: () => void;
  context: AssistantHostContext;
  onApplied: (a: AppliedBatch) => void;
  onTemplatesChanged: () => void;
  onPublishFlow: () => void;
  onBusy: (busy: boolean) => void;
  onReply: () => void;
}) {
  const { assistant } = useNovoRh();
  const status = useQuery({ queryKey: ["novo-rh", "assistant", "status"], queryFn: () => assistant.status(), staleTime: 5 * 60_000, retry: false });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const voice = useVoice(
    (a) => assistant.transcribe(a),
    useCallback((t: string) => {
      setInput((cur) => (cur ? `${cur} ${t}` : t));
      box.current?.focus();
    }, []),
  );
  const unavailable = status.isError || status.data?.available === false;

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [turns, busy]);
  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);
  useEffect(() => onBusy(busy), [busy, onBusy]);

  const push = (t: Omit<Turn, "id">) => setTurns((list) => [...list, { ...t, id: ++seq.current }]);

  /** Mesmo pedido em caso de falha de rede ou "ainda a processar": a mesma chave devolve a mesma resposta. */
  const withRetry = async (fn: (key: string) => Promise<AssistantReply>): Promise<AssistantReply> => {
    const key = crypto.randomUUID();
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn(key);
      } catch (e) {
        const retriable = (e instanceof ApiError && e.status === 409) || e instanceof TypeError;
        if (!retriable || attempt >= 3) throw e;
        await wait(1500 * (attempt + 1));
      }
    }
  };

  const handle = (r: AssistantReply) => {
    if (r.applied) onApplied(r.applied);
    if (r.templatesChanged) onTemplatesChanged();
    push({
      role: "assistant",
      text: r.text,
      facts: r.status === "needs_confirmation" ? undefined : r.facts.filter((f) => !r.text.includes(f)),
      undoHint: !!r.applied,
      ...(r.confirmation && { confirmation: { ...r.confirmation, state: "open" as const } }),
    });
    onReply();
    if (r.status === "publish_flow") {
      onClose();
      onPublishFlow();
    }
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const history = historyForServer(turns.filter((t) => !t.error).map(({ role, text }) => ({ role, text })));
    push({ role: "user", text: message });
    setInput("");
    setBusy(true);
    try {
      handle(await withRetry((key) => assistant.chat({ context: { rosterId: context.rosterId, from: context.from, to: context.to }, history, message }, key)));
    } catch (e) {
      push({ role: "assistant", text: e instanceof ApiError && e.status < 500 && e.status !== 409 ? e.message : UNAVAILABLE, error: true });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (turn: Turn, ok: boolean) => {
    if (!turn.confirmation || busy) return;
    const token = turn.confirmation.token;
    setTurns((list) => list.map((t) => (t.id === turn.id ? { ...t, confirmation: { ...t.confirmation!, state: ok ? "confirmed" : "cancelled" } } : t)));
    if (!ok) {
      await assistant.cancel(token, crypto.randomUUID());
      push({ role: "assistant", text: "Cancelado. Nada foi alterado." });
      return;
    }
    setBusy(true);
    try {
      handle(await withRetry((key) => assistant.confirm(token, key)));
    } catch (e) {
      push({ role: "assistant", text: e instanceof ApiError && e.status < 500 ? e.message : UNAVAILABLE, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-[440px]"
      label="Assistente Mezza"
      title={
        <span className="flex items-center gap-2.5">
          <MezzaIcon size={32} />
          <span className="leading-tight">
            Assistente Mezza
            <span className="block text-xs font-normal text-ink-secondary">Escalas & Turnos</span>
          </span>
        </span>
      }
      description={
        <span className="mt-1 flex flex-wrap gap-x-2 text-xs">
          <span className="font-medium text-navy-900">{context.rosterName}</span>
          <span aria-hidden="true">·</span>
          <span>{periodLabel(context.from, context.to)}</span>
          <span aria-hidden="true">·</span>
          <span>{rosterStateLabel(context.pending)}</span>
        </span>
      }
      footer={
        <form
          className="w-full space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={box}
              rows={2}
              maxLength={1000}
              value={input}
              disabled={unavailable}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Escreva ou diga o que pretende..."
              aria-label="Mensagem para o Assistente Mezza"
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-surface-soft"
            />
            {status.data?.voice && voice.supported && (
              <button
                type="button"
                onClick={() => (voice.state === "recording" ? voice.stop() : void voice.start())}
                disabled={voice.state === "transcribing" || busy}
                aria-pressed={voice.state === "recording"}
                aria-label={voice.state === "recording" ? "Parar gravação" : "Falar"}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${voice.state === "recording" ? "border-red-300 bg-red-50 text-red-600" : "border-line text-ink-secondary hover:text-navy-900"} disabled:opacity-50`}
              >
                <MicIcon />
              </button>
            )}
            <Button type="submit" variant="primary" disabled={!input.trim() || busy || unavailable} aria-label="Enviar" className="h-11 w-11 shrink-0 !px-0">
              <IconSend size={18} />
            </Button>
          </div>
          {(voice.state !== "idle" || voice.error) && (
            <p role="status" className="text-xs text-ink-secondary">
              {voice.state === "recording" ? "A ouvir… toque de novo para parar." : voice.state === "transcribing" ? "A transcrever…" : voice.error}
            </p>
          )}
        </form>
      }
    >
      <div className="space-y-3" aria-live="polite">
        {!turns.length && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-2xl bg-surface-soft px-3.5 py-3 text-sm text-ink">
              <span aria-hidden="true" className="text-[#C9643A]">✦</span>
              <p>{unavailable ? UNAVAILABLE : "Olá! Sou o Assistente Mezza. Posso consultar e alterar os turnos por publicar desta escala."}</p>
            </div>
            {!unavailable && (
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="flex w-full items-center justify-between rounded-xl border border-line-subtle px-3 py-2 text-left text-sm text-ink hover:bg-surface-soft">
                    {s}
                    <span aria-hidden="true" className="text-ink-muted">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {turns.map((t) =>
          t.role === "user" ? (
            <p key={t.id} className="ml-auto max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-navy-900 px-3.5 py-2 text-sm text-white">
              {t.text}
            </p>
          ) : (
            <div key={t.id} className={`max-w-[92%] space-y-2 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm ${t.error ? "bg-red-50 text-red-800" : "bg-surface-soft text-ink"}`}>
              <p className="whitespace-pre-line">{t.text}</p>
              {!!t.facts?.length && (
                <ul className="space-y-0.5 text-xs text-ink-secondary">
                  {t.facts.map((f) => (
                    <li key={f}>{f.startsWith("Não feito") ? "•" : "✓"} {f}</li>
                  ))}
                </ul>
              )}
              {t.undoHint && <p className="text-xs text-ink-secondary">Pode desfazer com ↶ na barra da escala.</p>}
              {t.confirmation?.state === "open" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => void decide(t, true)}>
                    Confirmar
                  </Button>
                  <Button size="sm" variant="tertiary" disabled={busy} onClick={() => void decide(t, false)}>
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          ),
        )}
        {busy && (
          <p role="status" className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="h-2 w-2 rounded-full bg-[#C9643A] motion-safe:animate-pulse" /> A pensar…
          </p>
        )}
        <div ref={end} />
      </div>
    </Drawer>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
