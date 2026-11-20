import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Button, Drawer, IconSend } from "../../../../../components/ui/index.ts";
import { ApiError } from "../../../../../lib/api.ts";
import type { ChatTurn, HelpSource } from "../../../domain/entities/assistant.ts";
import { HELP_SUGGESTIONS, historyForServer } from "../../../domain/services/assistant.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { MezzaIcon } from "./MezzaIcon.tsx";

const UNAVAILABLE = "O Assistente Mezza está temporariamente indisponível. Tente de novo daqui a pouco.";

interface Turn extends ChatTurn {
  id: number;
  sources?: HelpSource[];
  error?: boolean;
}

/**
 * Ajuda do RH (carregada só ao abrir): responde a «como faço…?» com o guia
 * do RH e mostra atalhos para os ecrãs. Não vê dados nem altera nada.
 */
export default function HelpPanel({ open, onClose, onBusy, onReply }: { open: boolean; onClose: () => void; onBusy: (busy: boolean) => void; onReply: () => void }) {
  const { assistant } = useNovoRh();
  const { pathname } = useLocation();
  const status = useQuery({ queryKey: ["novo-rh", "assistant", "help-status"], queryFn: () => assistant.helpStatus(), staleTime: 5 * 60_000, retry: false });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const unavailable = status.isError || status.data?.available === false;

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [turns, busy]);
  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);
  useEffect(() => onBusy(busy), [busy, onBusy]);

  const push = (t: Omit<Turn, "id">) => setTurns((list) => [...list, { ...t, id: ++seq.current }]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const history = historyForServer(turns.filter((t) => !t.error).map(({ role, text }) => ({ role, text })));
    push({ role: "user", text: message });
    setInput("");
    setBusy(true);
    try {
      const r = await assistant.help({ history, message, page: pathname });
      push({ role: "assistant", text: r.text, sources: r.sources.filter((s) => s.path && s.path !== pathname), error: r.status === "unavailable" });
      onReply();
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
            <span className="block text-xs font-normal text-ink-secondary">Ajuda do RH</span>
          </span>
        </span>
      }
      footer={
        <form
          className="flex w-full items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
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
            placeholder="Pergunte como fazer algo no RH..."
            aria-label="Pergunta para o Assistente Mezza"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-surface-soft"
          />
          <Button type="submit" variant="primary" disabled={!input.trim() || busy || unavailable} aria-label="Enviar" className="h-11 w-11 shrink-0 !px-0">
            <IconSend size={18} />
          </Button>
        </form>
      }
    >
      <div className="space-y-3" aria-live="polite">
        {!turns.length && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-2xl bg-surface-soft px-3.5 py-3 text-sm text-ink">
              <span aria-hidden="true" className="text-[#C9643A]">✦</span>
              <p>{unavailable ? UNAVAILABLE : "Olá! Sou o Assistente Mezza. Pergunte-me como fazer algo no RH e eu explico o passo a passo."}</p>
            </div>
            {!unavailable && (
              <div className="space-y-1.5">
                {HELP_SUGGESTIONS.map((s) => (
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
              {!!t.sources?.length && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {t.sources.map((s) => (
                    <Link key={s.id} to={s.path!} onClick={onClose} className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-medium text-navy-900 hover:bg-brand-50">
                      Abrir: {s.title} ›
                    </Link>
                  ))}
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
