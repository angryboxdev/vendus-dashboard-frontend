import { useEffect, type ReactNode } from "react";
import { MotionLayer, MotionPresence } from "../motion/index.ts";
import { IconClose } from "./icons.tsx";

/**
 * Painel lateral do Mezza ERP (consultas e edições contextuais): cabeçalho
 * fixo, conteúdo com um só scroll, rodapé fixo com as ações. Entra/sai com o
 * padrão global de animação (respeita movimento reduzido). Esc fecha.
 */
export function Drawer({
  open,
  title,
  description,
  onClose,
  footer,
  children,
  width = "max-w-md",
  as = "div",
  onSubmit,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  /** Classe Tailwind de largura máxima (ex.: "max-w-xl"). */
  width?: string;
  /** "form" quando o rodapé tem o botão de submeter. */
  as?: "div" | "form";
  onSubmit?: (e: React.FormEvent) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <MotionPresence show={open}>
      <MotionLayer kind="overlay" className="fixed inset-0 z-40 bg-black/25" onClick={onClose} aria-hidden="true" />
      <MotionLayer
        as={as}
        kind="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        {...(as === "form" ? { onSubmit } : {})}
        className={`fixed inset-y-0 right-0 z-50 flex w-full ${width} flex-col bg-white shadow-xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#F5C992]/40 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-stone-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-stone-400 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-600">
            <IconClose />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-[#F5C992]/40 px-6 py-4">{footer}</div>}
      </MotionLayer>
    </MotionPresence>
  );
}
