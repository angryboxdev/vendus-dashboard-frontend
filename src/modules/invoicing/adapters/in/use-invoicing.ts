import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentSummary, DocumentView, InvoicingMeta, IssueResult, NewSeriesInput, Series } from "../../domain/entities/invoicing.ts";
import type { DocumentFilter, LegalEntityOption } from "../../domain/ports/out/invoicing-api.port.ts";
import type { IssueForm } from "../../domain/services/issue-form.service.ts";
import { useInvoicingModule } from "../../invoicing.module.tsx";

const message = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

/** Carrega um recurso com estado de carregamento/erro e permite recarregar. */
function useResource<T>(load: () => Promise<T>, initial: T) {
  const [state, setState] = useState<{ data: T; loading: boolean; error: string | null }>({ data: initial, loading: true, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await load();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: message(e) }));
    }
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { ...state, reload };
}

export function useInvoicingMeta() {
  const { invoicing } = useInvoicingModule();
  const load = useCallback(() => invoicing.meta(), [invoicing]);
  return useResource<InvoicingMeta | null>(load, null);
}

export function useSeries() {
  const { invoicing } = useInvoicingModule();
  const load = useCallback(() => invoicing.listSeries(), [invoicing]);
  const res = useResource<Series[]>(load, []);
  const create = useCallback(
    async (input: NewSeriesInput) => {
      await invoicing.createSeries(input);
      await res.reload();
    },
    [invoicing, res],
  );
  const setValidationCode = useCallback(
    async (seriesRef: string, code: string) => {
      await invoicing.setValidationCode(seriesRef, code);
      await res.reload();
    },
    [invoicing, res],
  );
  return { ...res, create, setValidationCode };
}

export function useLegalEntities() {
  const { invoicing } = useInvoicingModule();
  const load = useCallback(() => invoicing.legalEntities(), [invoicing]);
  return useResource<LegalEntityOption[]>(load, []);
}

export function useDocuments(filter: DocumentFilter) {
  const { invoicing } = useInvoicingModule();
  // O filtro entra pela chave serializada (um objeto novo por render não recarrega).
  const key = JSON.stringify(filter);
  const load = useCallback(() => invoicing.listDocuments(JSON.parse(key) as DocumentFilter), [invoicing, key]);
  return useResource<DocumentSummary[]>(load, []);
}

/** Documento aberto; o estado guarda o id a que pertence, e «a carregar» deriva daí. */
export function useDocument(id: string | null) {
  const { invoicing } = useInvoicingModule();
  const [state, setState] = useState<{ id: string | null; doc: DocumentView | null; error: string | null }>({ id: null, doc: null, error: null });
  useEffect(() => {
    if (!id) return;
    let alive = true;
    invoicing.getDocument(id).then(
      (doc) => alive && setState({ id, doc, error: null }),
      (e: unknown) => alive && setState({ id, doc: null, error: message(e) }),
    );
    return () => {
      alive = false;
    };
  }, [invoicing, id]);
  const cancel = useCallback(
    async (reasonCode: string, note?: string) => {
      if (!id) return;
      const doc = await invoicing.cancel(id, reasonCode, note);
      setState({ id, doc, error: null });
    },
    [invoicing, id],
  );
  const current = id !== null && state.id === id;
  return { doc: current ? state.doc : null, error: current ? state.error : null, loading: id !== null && !current, cancel };
}

/**
 * Emissão. A chave de idempotência vive enquanto o pedido é o mesmo: reenviar
 * depois de uma falha de rede usa a mesma chave (nunca duplica); confirmar
 * avisos ou mudar o formulário é um pedido novo, com chave nova.
 */
export function useIssueDocument() {
  const { invoicing } = useInvoicingModule();
  const attemptKey = useRef<string | null>(null);
  const [state, setState] = useState<{ submitting: boolean; errors: string[]; warnings: string[]; issued: IssueResult | null }>({
    submitting: false,
    errors: [],
    warnings: [],
    issued: null,
  });

  const formChanged = useCallback(() => {
    attemptKey.current = null;
  }, []);

  const submit = useCallback(
    async (form: IssueForm, confirmWarnings = false) => {
      if (confirmWarnings) attemptKey.current = null;
      attemptKey.current ??= invoicing.newAttemptKey();
      setState((s) => ({ ...s, submitting: true, errors: [], warnings: [] }));
      try {
        const out = await invoicing.issue(form, { attemptKey: attemptKey.current, confirmWarnings });
        attemptKey.current = null;
        if (out.kind === "issued") setState({ submitting: false, errors: [], warnings: [], issued: out.result });
        else if (out.kind === "invalid") setState({ submitting: false, errors: out.errors, warnings: [], issued: null });
        else setState({ submitting: false, errors: [], warnings: out.warnings, issued: null });
      } catch (e) {
        // Falha de rede/servidor: mantém a chave — tentar de novo não duplica.
        setState({ submitting: false, errors: [message(e)], warnings: [], issued: null });
      }
    },
    [invoicing],
  );

  const reset = useCallback(() => {
    attemptKey.current = null;
    setState({ submitting: false, errors: [], warnings: [], issued: null });
  }, []);

  return { ...state, submit, formChanged, reset };
}
