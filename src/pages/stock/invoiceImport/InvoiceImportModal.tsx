import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import type { StockItem } from "../stock.types";
import { ConfirmImportModal } from "./components/ConfirmImportModal";
import { ImportResultSummary } from "./components/ImportResultSummary";
import { InvoiceHeaderSummary } from "./components/InvoiceHeaderSummary";
import { InvoiceLinesReviewTable } from "./components/InvoiceLinesReviewTable";
import { UploadCard } from "./components/UploadCard";
import {
  confirmInvoiceImport,
  createInvoiceImport,
  getInvoiceImport,
  updateInvoiceImport,
} from "./invoiceImportApi";
import type {
  ConfirmInvoiceImportPayload,
  ConfirmInvoiceImportResponse,
  InvoiceImportDetail,
  ReviewableInvoiceLine,
  UpdateInvoiceImportPayload,
} from "./invoiceImport.types";
import {
  defaultInvoiceImportHeader,
  toReviewableLines,
} from "./invoiceImport.types";
import {
  defaultMovementDateForConfirm,
  invoiceLinePricesWereCorrected,
  unitNetToGrossForConfirm,
} from "./invoiceImport.utils";
import { validateInvoiceImportForConfirm } from "./invoiceImport.validation";

function allowedFile(f: File): boolean {
  return (
    f.type === "application/pdf" ||
    f.type === "image/jpeg" ||
    f.type === "image/png" ||
    f.type === "image/webp"
  );
}

export function InvoiceImportModal({
  open,
  onClose,
  stockItems,
  initialImportId,
  onImportIdChange,
  onCreateItemFromLine,
  linkStockItemToImportLineRef,
}: {
  open: boolean;
  onClose: () => void;
  stockItems: StockItem[];
  initialImportId: string | null;
  onImportIdChange: (id: string | null) => void;
  onCreateItemFromLine?: (line: ReviewableInvoiceLine) => void;
  linkStockItemToImportLineRef?: MutableRefObject<
    ((lineId: string, itemId: string) => void) | null
  >;
}) {
  const [importId, setImportId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InvoiceImportDetail | null>(null);
  const [draftLines, setDraftLines] = useState<ReviewableInvoiceLine[]>([]);
  const linesInitFor = useRef<string | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAcknowledged, setConfirmAcknowledged] = useState(false);
  const [overrideDuplicateAck, setOverrideDuplicateAck] = useState(false);
  const [confirmMovementDate, setConfirmMovementDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [confirmResult, setConfirmResult] =
    useState<ConfirmInvoiceImportResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setImportId(initialImportId);
    if (!initialImportId) {
      setDetail(null);
      setDraftLines([]);
      linesInitFor.current = null;
      setLoadError(null);
      setUploadError(null);
      setConfirmResult(null);
      setConfirmOpen(false);
      setConfirmAcknowledged(false);
      setOverrideDuplicateAck(false);
    }
  }, [open, initialImportId]);

  useEffect(() => {
    if (!open || !importId) return;
    const activeImportId = importId;

    let cancelled = false;

    async function pollLoop() {
      while (!cancelled) {
        try {
          const d = await getInvoiceImport(activeImportId);
          if (cancelled) return;
          setDetail(d);
          setLoadError(null);
          if (d.status !== "processing") break;
        } catch (e) {
          if (!cancelled) {
            setLoadError(
              e instanceof Error ? e.message : "Erro ao carregar importação",
            );
          }
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    void pollLoop();
    return () => {
      cancelled = true;
    };
  }, [open, importId]);

  useEffect(() => {
    if (!detail || detail.status !== "ready_for_review") return;
    if (linesInitFor.current === detail.import_id) return;
    setDraftLines(toReviewableLines(detail.lines));
    linesInitFor.current = detail.import_id;
  }, [detail]);

  const validation = useMemo(() => {
    if (!detail || detail.status !== "ready_for_review") {
      return { errors: [] as string[], warnings: [] as string[], canConfirm: false };
    }
    return validateInvoiceImportForConfirm(detail.header, draftLines);
  }, [detail, draftLines]);

  const activeLinesCount = useMemo(
    () => draftLines.filter((l) => !l.ignored).length,
    [draftLines],
  );

  const updateLine = useCallback(
    (lineId: string, patch: Partial<ReviewableInvoiceLine>) => {
      setDraftLines((prev) =>
        prev.map((l) => (l.line_id === lineId ? { ...l, ...patch } : l)),
      );
    },
    [],
  );

  useEffect(() => {
    if (!linkStockItemToImportLineRef) return;
    linkStockItemToImportLineRef.current = (lineId, itemId) => {
      updateLine(lineId, { stock_item_id: itemId, ignored: false });
    };
    return () => {
      linkStockItemToImportLineRef.current = null;
    };
  }, [linkStockItemToImportLineRef, updateLine]);

  const handleFile = async (file: File) => {
    setUploadError(null);
    if (!allowedFile(file)) {
      setUploadError("Formato inválido. Use PDF, JPG, PNG ou WebP.");
      return;
    }
    setUploading(true);
    try {
      const res = await createInvoiceImport(file);
      setImportId(res.import_id);
      onImportIdChange(res.import_id);
      setConfirmResult(null);
      linesInitFor.current = null;

      if (res.status === "failed") {
        setDetail({
          import_id: res.import_id,
          status: "failed",
          header: res.header ?? defaultInvoiceImportHeader(),
          lines: res.lines ?? [],
          message: res.message ?? null,
          filename: res.filename ?? null,
          duplicate_warning: res.duplicate_warning,
          duplicate_of_import_id: res.duplicate_of_import_id,
          parse_error: res.parse_error,
        });
        return;
      }

      if (res.status === "ready_for_review") {
        setDetail({
          import_id: res.import_id,
          status: "ready_for_review",
          header: res.header ?? defaultInvoiceImportHeader(),
          lines: res.lines ?? [],
          duplicate_warning: res.duplicate_warning,
          duplicate_of_import_id: res.duplicate_of_import_id,
          parse_error: res.parse_error,
          message: res.message ?? null,
          filename: res.filename ?? null,
        });
        return;
      }

      setDetail(null);
    } catch (e) {
      setUploadError(
        e instanceof Error
          ? e.message
          : "Não foi possível enviar o ficheiro. Tente novamente.",
      );
    } finally {
      setUploading(false);
    }
  };

  const buildConfirmPayload = useCallback(
    (
      override_duplicate: boolean,
      movement_date: string,
    ): ConfirmInvoiceImportPayload => {
      const md = movement_date.trim().slice(0, 10);
      return {
        override_duplicate,
        ...(md ? { movement_date: md } : {}),
        lines: draftLines.map((l) => {
          const base = {
            line_id: l.line_id,
            stock_item_id: l.ignored ? null : l.stock_item_id,
            ignored: l.ignored,
            quantity: l.quantity,
          };
          if (invoiceLinePricesWereCorrected(l)) {
            return {
              ...base,
              unit_price: unitNetToGrossForConfirm(
                l.unit_price,
                l.vat_rate_pct,
              ),
              vat_rate_pct: l.vat_rate_pct ?? 0,
            };
          }
          return base;
        }),
      };
    },
    [draftLines],
  );

  const handleUpdateHeader = async (patch: UpdateInvoiceImportPayload) => {
    if (!importId) return;
    const updated = await updateInvoiceImport(importId, patch);
    setDetail(updated);
  };

  const handleConfirmApply = async () => {
    if (!importId || !validation.canConfirm) return;
    if (detail?.duplicate_warning && !overrideDuplicateAck) return;
    setConfirming(true);
    try {
      const override_duplicate = Boolean(
        detail?.duplicate_warning && overrideDuplicateAck,
      );
      const payload = buildConfirmPayload(
        override_duplicate,
        confirmMovementDate,
      );
      const result = await confirmInvoiceImport(importId, payload);
      setConfirmResult(result);
      setConfirmOpen(false);
      const refreshed = await getInvoiceImport(importId);
      setDetail(refreshed);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Erro ao confirmar importação",
      );
      setConfirmOpen(false);
    } finally {
      setConfirming(false);
    }
  };

  const restart = () => {
    setImportId(null);
    onImportIdChange(null);
    setDetail(null);
    setDraftLines([]);
    linesInitFor.current = null;
    setUploadError(null);
    setLoadError(null);
    setConfirmResult(null);
    setConfirmOpen(false);
    setConfirmAcknowledged(false);
    setOverrideDuplicateAck(false);
    setConfirmMovementDate(new Date().toISOString().slice(0, 10));
  };

  if (!open) return null;

  const processing = Boolean(importId && detail?.status === "processing");
  const failed = detail?.status === "failed";
  const cancelled = detail?.status === "cancelled";
  const confirmedDone = Boolean(confirmResult);
  const review =
    detail?.status === "ready_for_review" && confirmResult == null;
  const loadingDetail = Boolean(importId && !detail && !loadError);
  const showInitialUpload =
    !importId && !confirmResult && !uploading;
  const showRetryUpload =
    Boolean(failed && importId && !confirmResult && !uploading);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div
        className="relative mt-0 w-full max-w-6xl rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-import-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="invoice-import-title"
              className="text-lg font-semibold text-slate-900"
            >
              Importar fatura de fornecedor
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              O stock só é atualizado depois de rever as linhas e confirmar
              explicitamente.
              {importId ? (
                <span className="ml-1 font-mono text-slate-600">
                  ID: {importId.slice(0, 8)}…
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {(importId || detail) && !uploading && (
              <button
                type="button"
                onClick={restart}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Nova importação
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-5rem)] overflow-y-auto p-5">
          {loadError && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {loadError}
            </div>
          )}

          {failed && detail?.message && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {detail.message}
            </div>
          )}

          {cancelled && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {detail?.message ?? "Esta importação foi cancelada."}
            </div>
          )}

          {confirmedDone && confirmResult && (
            <ImportResultSummary
              movementsCreated={confirmResult.movements_created}
              itemsUpdated={confirmResult.items_updated}
              message={confirmResult.message}
              onClose={onClose}
            />
          )}

          {!confirmedDone &&
            detail?.status === "confirmed" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p>Esta importação já foi confirmada anteriormente.</p>
                <button
                  type="button"
                  onClick={restart}
                  className="mt-3 text-sm font-medium text-slate-800 underline"
                >
                  Iniciar nova importação
                </button>
              </div>
            )}

          {loadingDetail && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              A carregar importação…
            </div>
          )}

          {showInitialUpload && (
            <>
              <p className="mb-3 text-sm text-slate-600">
                Envie a fatura: <strong>PDF com texto selecionável</strong>, ou{" "}
                <strong>JPG / PNG / WebP</strong>. PDF digitalizado sem texto pode
                ser rejeitado — nesse caso use imagem. Nada é aplicado ao stock
                nesta etapa.
              </p>
              <UploadCard
                disabled={false}
                error={uploadError}
                onFileSelected={handleFile}
              />
            </>
          )}

          {uploading && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              A enviar e a processar o ficheiro…
            </div>
          )}

          {processing && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-8 text-center">
              <p className="text-sm font-medium text-blue-900">
                A extrair dados da fatura…
              </p>
              <p className="mt-2 text-xs text-blue-800">
                Pode demorar alguns segundos. Pode fechar e voltar mais tarde —
                use o mesmo link da página (parâmetro na URL). No modo
                demonstração, os dados ficam na sessão do browser
                (sessionStorage).
              </p>
            </div>
          )}

          {review && detail && (
            <div className="space-y-5">
              {detail.duplicate_warning && (
                <div
                  className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
                  role="status"
                >
                  <p className="font-medium">Possível fatura em duplicado</p>
                  <p className="mt-1 text-amber-900">
                    O servidor detetou uma importação já confirmada para o mesmo
                    fornecedor, número e data. Para aplicar esta importação terá de
                    confirmar a <strong>substituição</strong> no passo final (reverte
                    movimentos da importação anterior).
                  </p>
                </div>
              )}
              <InvoiceHeaderSummary header={detail.header} onSave={handleUpdateHeader} />

              {validation.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <p className="font-medium">Corrija antes de confirmar</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.warnings.length > 0 && validation.errors.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">Avisos</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {validation.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <InvoiceLinesReviewTable
                lines={draftLines}
                stockItems={stockItems}
                currency={detail.header.currency || "EUR"}
                onUpdateLine={updateLine}
                onCreateItemFromLine={onCreateItemFromLine}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500">
                  Serão criadas compras no stock apenas para linhas com item
                  associado e não ignoradas.
                </p>
                <button
                  type="button"
                  disabled={!validation.canConfirm}
                  onClick={() => {
                    setConfirmAcknowledged(false);
                    setOverrideDuplicateAck(false);
                    setConfirmMovementDate(
                      defaultMovementDateForConfirm(detail.header.invoice_date),
                    );
                    setConfirmOpen(true);
                  }}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
                >
                  Confirmar e aplicar no stock
                </button>
              </div>
            </div>
          )}

          {showRetryUpload && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-slate-600">
                Envie outro ficheiro para tentar de novo.
              </p>
              <UploadCard
                disabled={false}
                error={uploadError}
                onFileSelected={handleFile}
              />
            </div>
          )}
        </div>
      </div>

      {detail && review && (
        <ConfirmImportModal
          open={confirmOpen}
          header={detail.header}
          validation={validation}
          activeLinesCount={activeLinesCount}
          duplicateWarning={Boolean(detail.duplicate_warning)}
          overrideDuplicateAcknowledged={overrideDuplicateAck}
          onOverrideDuplicateAcknowledgedChange={setOverrideDuplicateAck}
          movementDate={confirmMovementDate}
          onMovementDateChange={setConfirmMovementDate}
          acknowledged={confirmAcknowledged}
          onAcknowledgedChange={setConfirmAcknowledged}
          onCancel={() => {
            setConfirmOpen(false);
            setOverrideDuplicateAck(false);
          }}
          onConfirm={handleConfirmApply}
          confirming={confirming}
        />
      )}
    </div>
  );
}
