import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContact,
  fetchScript,
  fetchScripts,
  type CreateContactBody,
} from "../crmApi";
import { crmQueryKeys } from "../crmQueryKeys";
import type { CrmCustomerEnriched, CrmScript } from "../crm.types";

type Props = {
  customer: CrmCustomerEnriched;
  onClose: () => void;
};

const ALL_TAGS = [
  "elogiou",
  "reclamou",
  "feedback_neutro",
  "review_solicitada",
  "promotor",
  "social_follower",
  "veio_indicado",
  "indicou_alguem",
  "fez_evento",
  "cliente_internacional",
  "frequencia_em_queda",
  "cancelou",
  "hesitou_1a_compra",
  "problema_tecnico",
  "lead_frio",
  "inativo_definitivo",
  "ausencia_justificada",
  "so_nao_pedi",
  "consultou_e_respondeu",
] as const;

export function ContactModal({ customer, onClose }: Props) {
  const qc = useQueryClient();

  const [direction, setDirection] = useState<"Enviado" | "Recebido">("Enviado");
  const [channel, setChannel] = useState<string>(customer.preferredChannel);
  const [scriptCode, setScriptCode] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<number>(0);
  const [response, setResponse] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsAdded, setTagsAdded] = useState<string[]>([]);
  const [tagsRemoved, setTagsRemoved] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const { data: scripts = [] } = useQuery({
    queryKey: crmQueryKeys.scripts(false),
    queryFn: () => fetchScripts(false),
    staleTime: 10 * 60 * 1000,
  });

  const selectedScript: CrmScript | undefined = scripts.find(
    (s) => s.code === scriptCode,
  );

  const { data: renderedScript } = useQuery({
    queryKey: ["crm", "script-render", scriptCode, customer.firstName],
    queryFn: () =>
      fetchScript(scriptCode, { nome: customer.firstName }),
    enabled: !!scriptCode,
    staleTime: 5 * 60 * 1000,
  });

  // Pre-select suggested script from nextFollowUp
  useEffect(() => {
    const suggested = customer.nextFollowUp?.scriptCode;
    if (
      suggested &&
      !suggested.startsWith("→") &&
      suggested !== "dormir"
    ) {
      setScriptCode(suggested);
    }
  }, [customer.nextFollowUp?.scriptCode]);

  const bodyToShow =
    selectedScript?.variants && selectedScript.variants.length > 0
      ? (renderedScript?.variants?.[selectedVariant]?.body ??
          selectedScript.variants[selectedVariant]?.body ??
          renderedScript?.renderedBody ??
          "")
      : (renderedScript?.renderedBody ?? "");

  function handleCopy() {
    void navigator.clipboard.writeText(bodyToShow).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toggleTag(tag: string, list: "add" | "remove") {
    if (list === "add") {
      setTagsAdded((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
      );
      setTagsRemoved((prev) => prev.filter((t) => t !== tag));
    } else {
      setTagsRemoved((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
      );
      setTagsAdded((prev) => prev.filter((t) => t !== tag));
    }
  }

  const mutation = useMutation({
    mutationFn: (body: CreateContactBody) => createContact(body),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: crmQueryKeys.customer(customer.id),
      });
      void qc.invalidateQueries({ queryKey: crmQueryKeys.dashboard() });
      void qc.invalidateQueries({
        queryKey: crmQueryKeys.contacts({ customerId: customer.id }),
      });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      customerId: customer.id,
      scriptCode: scriptCode || null,
      direction,
      channel,
      status: direction === "Recebido" ? "Respondeu" : "Sem resposta",
      response: response.trim() || null,
      notes: notes.trim() || null,
      tagsAdded,
      tagsRemoved,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4">
      <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Registar Contacto
            </h2>
            <p className="text-sm text-slate-500">
              {customer.firstName} {customer.lastName ?? ""} · {customer.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[70vh] overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            {/* Direction + Channel */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Direção
                </label>
                <select
                  value={direction}
                  onChange={(e) => {
                    const d = e.target.value as "Enviado" | "Recebido";
                    setDirection(d);
                    if (d === "Recebido") {
                      setScriptCode("");
                      setSelectedVariant(0);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                >
                  <option value="Enviado">Enviado</option>
                  <option value="Recebido">Recebido</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Canal
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                >
                  <option>WhatsApp</option>
                  <option>Email</option>
                  <option>SMS</option>
                </select>
              </div>
            </div>

            {/* Script picker, variante e preview — só para mensagens enviadas */}
            {direction === "Enviado" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Script{" "}
                    {customer.nextFollowUp?.scriptCode &&
                      !customer.nextFollowUp.scriptCode.startsWith("→") &&
                      customer.nextFollowUp.scriptCode !== "dormir" && (
                        <span className="ml-1 text-xs text-amber-600">
                          (sugerido: {customer.nextFollowUp.scriptCode})
                        </span>
                      )}
                  </label>
                  <select
                    value={scriptCode}
                    onChange={(e) => {
                      setScriptCode(e.target.value);
                      setSelectedVariant(0);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                  >
                    <option value="">— sem script —</option>
                    {scripts.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} · {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedScript?.variants && selectedScript.variants.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Variante
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedScript.variants.map((v, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedVariant(i)}
                          className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                            selectedVariant === i
                              ? "border-slate-800 bg-slate-800 text-white"
                              : "border-slate-300 text-slate-600 hover:border-slate-400"
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {scriptCode && bodyToShow && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">
                        Texto do script
                      </span>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        {copied ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {bodyToShow}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Response — só visível quando direção é Recebido */}
            {direction === "Recebido" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Resposta recebida
                </label>
                <input
                  type="text"
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Resumo da resposta..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Notas internas
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Observações..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-slate-400 focus:outline-none"
              />
            </div>

            {/* Tags — só quando recebemos uma resposta */}
            {direction === "Recebido" && <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Tags (toque para adicionar / remover)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TAGS.map((tag) => {
                  const isAdd = tagsAdded.includes(tag);
                  const isRem = tagsRemoved.includes(tag);
                  const isExisting = customer.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        toggleTag(tag, isExisting ? "remove" : "add")
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        isAdd
                          ? "border-green-600 bg-green-100 text-green-700"
                          : isRem
                            ? "border-red-400 bg-red-100 text-red-600 line-through"
                            : isExisting
                              ? "border-slate-400 bg-slate-200 text-slate-700"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
                      }`}
                    >
                      {isAdd ? "+ " : isRem ? "− " : isExisting ? "" : ""}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>}
          </div>

          {mutation.isError && (
            <p className="px-6 pb-2 text-xs text-red-600">
              {String(mutation.error)}
            </p>
          )}

          <div className="flex gap-3 border-t border-slate-200 px-4 sm:px-6 py-4 pb-safe">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {mutation.isPending ? "A guardar..." : "Guardar contacto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
