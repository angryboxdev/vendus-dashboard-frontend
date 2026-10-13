import type { ReactNode } from "react";

/**
 * Estrutura de página da área de gestão: faixa branca com título, descrição
 * curta e a ação principal à direita; tabs por baixo; conteúdo sobre o
 * fundo off-white. Mesma hierarquia em todos os módulos.
 */
export function PageShell({
  title,
  description,
  actions,
  tabs,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Ação principal (e, no máximo, ações secundárias discretas). */
  actions?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-surface-app">
      <header className="border-b border-line bg-white px-4 pt-4 sm:px-6">
        <div className={`flex flex-wrap items-start justify-between gap-3 ${tabs ? "pb-2" : "pb-4"}`}>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-navy-900">{title}</h1>
            {description && <p className="mt-0.5 text-sm text-ink-secondary">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {tabs}
      </header>
      <div className="flex-1 space-y-4 p-4 sm:p-6">{children}</div>
    </div>
  );
}
