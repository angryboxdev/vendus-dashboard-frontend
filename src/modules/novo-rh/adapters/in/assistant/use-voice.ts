import { useCallback, useEffect, useRef, useState } from "react";

const MAX_MS = 60_000;

/**
 * Voz → texto: grava no browser (MediaRecorder) e devolve o áudio para
 * transcrever; o texto vai para a caixa (editável) — nunca é executado
 * diretamente. Nada fica guardado no browser.
 */
export function useVoice(transcribe: (audio: Blob) => Promise<string>, onText: (text: string) => void) {
  const supported = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        rec.current = null;
        const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
        if (!blob.size) return setState("idle");
        setState("transcribing");
        try {
          const text = await transcribe(blob);
          if (text) onText(text);
          else setError("Não percebi. Tente de novo.");
        } catch {
          setError("Não foi possível transcrever agora. Pode escrever o pedido.");
        } finally {
          setState("idle");
        }
      };
      rec.current = r;
      r.start();
      setState("recording");
      timer.current = window.setTimeout(stop, MAX_MS);
    } catch {
      setError("Sem acesso ao microfone.");
      setState("idle");
    }
  }, [transcribe, onText, stop]);

  useEffect(() => () => stop(), [stop]);

  return { supported, state, error, start, stop };
}
