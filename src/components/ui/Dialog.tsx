import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Diálogo central curto (escolha rápida, ex.: "Mover ou copiar?"): fundo
 * escurecido, foco no primeiro botão, Esc ou clique fora fecham.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-navy-950/30 motion-safe:animate-motion-fade" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm rounded-2.5xl border border-line bg-surface-card p-5 shadow-pop motion-safe:animate-motion-pop-in"
      >
        <h2 id={titleId} className="text-base font-semibold text-navy-900">
          {title}
        </h2>
        {description && <div className="mt-1 text-sm text-ink-secondary">{description}</div>}
        {children && <div className="mt-3 space-y-3">{children}</div>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}
