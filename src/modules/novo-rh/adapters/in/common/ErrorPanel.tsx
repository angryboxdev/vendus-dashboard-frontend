import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button } from "../../../../../components/ui/index.ts";
import { describeError, errorDetails } from "../../../domain/services/errors.service.ts";

/**
 * FE-006: erro numa região da página — mensagem, ID de correlação, "Tentar de
 * novo" e "Copiar detalhes" (ID, hora e modelo da rota, sem parâmetros).
 */
export function ErrorPanel({ error, context, route, onRetry }: { error: unknown; context?: string; route?: string; onRetry?: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const info = describeError(error, t("common.error"));
  const forbidden = info.status === 403;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(errorDetails(info, route ?? "—", new Date()));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p className="font-medium">{forbidden ? t("errors.forbidden") : (context ?? t("errors.unexpected"))}</p>
      {!forbidden && <p>{info.message}</p>}
      {info.correlationId && <p className="text-xs text-red-700">{t("errors.correlation", { id: info.correlationId })}</p>}
      <div className="flex flex-wrap gap-2">
        {onRetry && !forbidden && (
          <Button size="sm" onClick={onRetry}>
            {t("errors.retry")}
          </Button>
        )}
        <Button size="sm" onClick={() => void copy()}>
          {copied ? t("errors.copied") : t("errors.copy")}
        </Button>
      </div>
    </div>
  );
}
