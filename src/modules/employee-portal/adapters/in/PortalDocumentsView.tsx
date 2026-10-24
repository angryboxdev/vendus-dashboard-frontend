import { useState, type DragEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppIcon, Dialog, FOCUS_RING, IconChevronLeft, buttonClass, type AppIconKey } from "../../../../components/ui";
import type { MyDocument, SubmittableCategory } from "../../domain/entities/portal.ts";
import { dateLabel, expiryState, periodLabel } from "../../domain/services/portal-text.service.ts";
import { fileKind, folderOfCategory, needsAttention, portalFolders, uploadProblem, type PortalFolder } from "../../domain/services/portal-documents.service.ts";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { todayLisbon } from "./portal-today.ts";

const CARD = "rounded-2.5xl border border-line bg-surface-card shadow-card";
const SMALL_BTN = `inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-medium disabled:opacity-50 ${FOCUS_RING}`;
const FIELD = `min-h-11 w-full rounded-xl border border-line bg-surface-card px-3 text-base text-ink sm:text-sm ${FOCUS_RING}`;
const FOLDER_ICON: Record<PortalFolder["key"], AppIconKey> = { personal: "identity", work: "work", payslips: "pay", health: "documents", other: "folder" };
const DOCS_KEY = ["portal-documents"];
const CHECKLIST_KEY = ["portal-documents-checklist"];
const PORTAL_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/**
 * Abre o ficheiro numa nova janela (visualizador do browser: ver e descarregar).
 * A janela é aberta **no toque** (antes do pedido do URL) — o Safari do iPhone
 * bloqueia `window.open` depois de um `await`. Sem janela (bloqueada), navega na própria página.
 */
async function openSigned(getUrl: () => Promise<string>): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const url = await getUrl();
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (e) {
    win?.close();
    throw e;
  }
}

/** Escolher ficheiro: toque (no telemóvel abre câmara ou ficheiros) ou arrastar (computador). */
function FilePicker({ id, label, accepts, file, onFile }: { id: string; label: string; accepts: string[]; file: File | null; onFile: (f: File | null) => void }) {
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFile(e.dataTransfer.files?.[0] ?? null);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`rounded-2xl border border-dashed p-3 ${over ? "border-brand-500 bg-brand-50" : "border-line bg-surface-card"}`}
    >
      <label className="block text-xs font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept={accepts.join(",")}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="mt-1 block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-line file:bg-surface-card file:px-3 file:text-sm file:font-medium file:text-navy-900"
      />
      <p className="mt-1 text-xs text-ink-secondary">
        {file
          ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`
          : `${accepts.includes("image/jpeg") ? "PDF ou foto (JPG/PNG)" : "PDF"}, até 10 MB. No computador, pode arrastar o ficheiro para aqui.`}
      </p>
    </div>
  );
}

/** Enviar um documento novo para uma pasta: fica «Em validação» até o RH ou o gerente aprovar. */
function SubmitForm({ folderLabel, options, initial, onDone, onCancel }: { folderLabel: string; options: SubmittableCategory[]; initial?: string; onDone: () => void; onCancel: () => void }) {
  const { selfService } = useEmployeePortalModule();
  const qc = useQueryClient();
  const [slug, setSlug] = useState(initial ?? options[0]?.slug ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const target = options.find((c) => c.slug === slug) ?? null;
  const send = useMutation({
    mutationFn: () => selfService.submitDocument({ category: slug, file: file!, period: target?.requiresPeriod ? period : null, expiresAt: target?.requiresPeriod ? null : expiresAt || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DOCS_KEY });
      void qc.invalidateQueries({ queryKey: CHECKLIST_KEY });
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!target || !file) return;
    const p = uploadProblem(file, target.accepts);
    setProblem(p);
    if (!p) send.mutate();
  };
  return (
    <form onSubmit={submit} className={`${CARD} space-y-3 p-4`} aria-label="Enviar documento">
      <p className="text-base font-semibold text-navy-900">Enviar documento</p>
      {options.length > 1 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor="submit-category">
            Documento
          </label>
          <select id="submit-category" value={slug} onChange={(e) => setSlug(e.target.value)} className={FIELD}>
            {options.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
                {c.mandatory ? " (obrigatório)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="text-xs text-ink-secondary">
        Destino: <strong className="font-medium text-navy-900">{folderLabel}</strong> › <strong className="font-medium text-navy-900">{target?.label}</strong>
      </p>
      {target?.lastRejection && <p className="text-xs text-red-700">Último envio rejeitado: {target.lastRejection.note}</p>}
      {target?.requiresPeriod ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor="submit-period">
            Mês a que se refere
          </label>
          <input id="submit-period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={FIELD} />
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor="submit-expiry">
            Data de validade (se tiver)
          </label>
          <input id="submit-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={FIELD} />
        </div>
      )}
      <FilePicker id="submit-file" label="Ficheiro" accepts={target?.accepts ?? []} file={file} onFile={setFile} />
      {(problem || send.isError) && (
        <p role="alert" className="text-sm text-red-700">
          {problem ?? (send.error instanceof Error ? send.error.message : "Não foi possível enviar.")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!target || !file || (target.requiresPeriod && !period) || send.isPending} className={`${SMALL_BTN} bg-brand-600 px-4 text-white`}>
          {send.isPending ? "A enviar…" : "Enviar para validação"}
        </button>
        <button type="button" onClick={onCancel} className={`${SMALL_BTN} border border-line text-ink-secondary`}>
          Cancelar
        </button>
      </div>
      <p className="text-xs text-ink-secondary">Fica «Em validação» até o RH ou o seu gerente aprovar.</p>
    </form>
  );
}

/** Substituir um documento vencido / a vencer: PDF ou foto (no telemóvel abre a câmara ou os ficheiros). */
function ReplaceForm({ doc, onDone, onCancel }: { doc: MyDocument; onDone: () => void; onCancel: () => void }) {
  const { selfService } = useEmployeePortalModule();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => selfService.replaceDocument(doc.id, file!, expiresAt || null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DOCS_KEY });
      void qc.invalidateQueries({ queryKey: CHECKLIST_KEY });
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const p = uploadProblem(file, PORTAL_TYPES);
    setProblem(p);
    if (!p) send.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-2 border-t border-line-subtle bg-surface-soft/60 px-4 py-3">
      <p className="text-xs text-ink-secondary">
        Destino: <strong className="font-medium text-navy-900">{doc.categoryLabel}</strong>
      </p>
      <FilePicker id={`file-${doc.id}`} label="Novo ficheiro (PDF ou foto)" accepts={PORTAL_TYPES} file={file} onFile={setFile} />
      <label className="block text-xs font-medium text-ink" htmlFor={`exp-${doc.id}`}>
        Nova data de validade (se souber)
      </label>
      <input id={`exp-${doc.id}`} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={FIELD} />
      {(problem || send.isError) && (
        <p role="alert" className="text-xs text-red-700">
          {problem ?? (send.error instanceof Error ? send.error.message : "Não foi possível enviar.")}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={!file || send.isPending} className={`${SMALL_BTN} bg-brand-600 text-white`}>
          {send.isPending ? "A enviar…" : "Enviar"}
        </button>
        <button type="button" onClick={onCancel} className={`${SMALL_BTN} border border-line text-ink-secondary`}>
          Cancelar
        </button>
      </div>
      <p className="text-xs text-ink-secondary">Depois de enviado, fica a aguardar validação do RH e não pode ser removido.</p>
    </form>
  );
}

/** Data mostrada: período nos recibos, senão emissão, senão o envio. */
function docDate(d: MyDocument): string | null {
  if (d.period) return periodLabel(d.period);
  if (d.issuedAt) return dateLabel(d.issuedAt.slice(0, 10));
  return d.uploadedAt ? dateLabel(d.uploadedAt.slice(0, 10)) : null;
}

function DocumentRow({ doc, title, today, onOpen, busy }: { doc: MyDocument; title: string; today: string; onOpen: () => void; busy: boolean }) {
  const expiry = expiryState(doc, today);
  const [replacing, setReplacing] = useState(false);
  const [sent, setSent] = useState(false);
  const pending = doc.status === "pending_validation";
  const meta = [fileKind(doc), docDate(doc)].filter(Boolean).join(" · ");
  return (
    <li>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-navy-900">{title}</p>
          <p className="truncate text-xs text-ink-secondary">{meta}</p>
          {pending ? (
            <p className="text-xs font-medium text-sky-700">Em validação pelo RH</p>
          ) : (
            <>
              {expiry === "expired" && <p className="text-xs font-medium text-red-700">Vencido a {dateLabel(doc.expiresAt!)}</p>}
              {expiry === "expiring" && <p className="text-xs font-medium text-amber-700">Vence a {dateLabel(doc.expiresAt!)}</p>}
              {expiry === "ok" && doc.expiresAt && <p className="text-xs text-ink-secondary">Válido até {dateLabel(doc.expiresAt)}</p>}
            </>
          )}
          {doc.lastRejection && !pending && <p className="text-xs text-red-700">Envio rejeitado: {doc.lastRejection.note}</p>}
          {sent && <p className="text-xs text-emerald-700">Enviado ✓ — aguarda validação.</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {doc.canReplace && !replacing && (
            <button type="button" onClick={() => setReplacing(true)} className={`${SMALL_BTN} bg-brand-600 text-white`}>
              Substituir
            </button>
          )}
          <button type="button" onClick={onOpen} disabled={busy} className={`${SMALL_BTN} border border-line text-navy-900`}>
            {busy ? "A abrir…" : "Abrir"}
          </button>
        </div>
      </div>
      {replacing && (
        <ReplaceForm
          doc={doc}
          onCancel={() => setReplacing(false)}
          onDone={() => {
            setReplacing(false);
            setSent(true);
          }}
        />
      )}
    </li>
  );
}

const titleOf = (d: MyDocument) => (d.isPayslip ? `${d.period ? periodLabel(d.period) : ""} · ${d.categoryLabel}` : d.categoryLabel);
const countLabel = (n: number) => `${n} ${n === 1 ? "documento" : "documentos"}`;

/** Número laranja: quantas coisas pedem ação. */
function CountBadge({ n, label }: { n: number; label: string }) {
  if (n <= 0) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white" aria-label={label}>
      {n}
    </span>
  );
}

function FolderCard({ folder, onOpen }: { folder: PortalFolder; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={`${CARD} flex h-full min-h-28 w-full flex-col items-start gap-3 p-4 text-left transition-colors hover:bg-surface-soft ${FOCUS_RING}`}>
        <span className="flex w-full items-start justify-between gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <AppIcon name={FOLDER_ICON[folder.key]} size={20} />
          </span>
          <CountBadge n={folder.attention} label={`${folder.attention} a tratar`} />
        </span>
        <span>
          <span className="block text-sm font-semibold text-navy-900">{folder.label}</span>
          <span className="block text-xs text-ink-secondary">{countLabel(folder.docs.length)}</span>
        </span>
      </button>
    </li>
  );
}

/** Em falta (obrigatório ou não) com o atalho para enviar. */
function MissingRow({ label, mandatory, rejection, onSend }: { label: string; mandatory: boolean; rejection?: string | null; onSend?: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy-900">{label}</p>
        <p className={`text-xs font-medium ${mandatory ? "text-red-700" : "text-ink-secondary"}`}>{mandatory ? "Obrigatório · em falta" : "Em falta"}</p>
        {rejection && <p className="text-xs text-red-700">Envio rejeitado: {rejection}</p>}
      </div>
      {onSend && (
        <button type="button" onClick={onSend} className={`${SMALL_BTN} gap-1.5 bg-brand-600 text-white`} aria-label={`Enviar ${label}`}>
          <AppIcon name="upload" size={16} />
          Enviar
        </button>
      )}
    </li>
  );
}

type Submitting = { folder: PortalFolder["key"]; slug?: string; only?: string[] };

/**
 * Documentos do próprio, nas mesmas pastas da ficha do RH. Ver/descarregar
 * pelo URL assinado de curta duração; enviar para as categorias permitidas
 * (fica «Em validação» até o RH ou o gerente aprovar); obrigatórios em falta
 * e vencidos no topo. Os documentos enviados pela empresa estão em Mais → Comunicados.
 */
export function PortalDocumentsView() {
  const { selfService } = useEmployeePortalModule();
  const today = todayLisbon();
  const docs = useQuery({ queryKey: DOCS_KEY, queryFn: () => selfService.listDocuments(), retry: false });
  const checklist = useQuery({ queryKey: CHECKLIST_KEY, queryFn: () => selfService.documentChecklist(), retry: false });
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderKey, setFolderKey] = useState<PortalFolder["key"] | null>(null);
  const [submitting, setSubmitting] = useState<Submitting | null>(null);
  const [sentNotice, setSentNotice] = useState(false);
  const [image, setImage] = useState<{ title: string; url: string } | null>(null);

  const open = (d: MyDocument) => {
    setError(null);
    setOpening(d.id);
    // Fotos: pré-visualização aqui mesmo; PDF e outros: o visualizador do browser (ver e descarregar).
    const task =
      fileKind(d) === "Imagem" ? selfService.documentUrl(d.id).then((url) => setImage({ title: titleOf(d), url })) : openSigned(() => selfService.documentUrl(d.id));
    task.catch(() => setError("Não foi possível abrir o documento. Tente novamente.")).finally(() => setOpening(null));
  };

  if (docs.isLoading)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true">
        <p className="sr-only">A carregar…</p>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2.5xl bg-surface-soft motion-reduce:animate-none" />
        ))}
      </div>
    );
  if (docs.isError || !docs.data)
    return (
      <section role="alert" className={`${CARD} p-5 text-center text-sm`}>
        <p className="text-red-700">Não foi possível carregar os documentos.</p>
        <button type="button" onClick={() => void docs.refetch()} disabled={docs.isFetching} className={`${SMALL_BTN} mt-2 border border-line text-navy-900`}>
          Tentar novamente
        </button>
      </section>
    );

  const list = checklist.data ?? null;
  const folders = portalFolders(docs.data, list);
  const folder = folders.find((f) => f.key === folderKey) ?? null;
  const categories = list?.categories ?? [];
  const attentionDocs = docs.data.filter(needsAttention);
  const missingRequired = (list?.missingMandatory ?? []).filter((m) => m.status === "missing");
  const attentionTotal = missingRequired.length + attentionDocs.length;
  const row = (d: MyDocument) => <DocumentRow key={d.id} doc={d} title={titleOf(d)} today={today} onOpen={() => open(d)} busy={opening === d.id} />;
  const startSubmit = (s: Submitting) => {
    setSentNotice(false);
    setSubmitting(s);
  };
  const submitOptions = submitting ? categories.filter((c) => c.canSubmit && (submitting.only ? submitting.only.includes(c.slug) : folderOfCategory(c) === submitting.folder)) : [];

  const submitForm = submitting && submitOptions.length > 0 && (
    <SubmitForm
      key={`${submitting.folder}-${submitting.slug ?? ""}`}
      folderLabel={folders.find((f) => f.key === submitting.folder)?.label ?? ""}
      options={submitOptions}
      {...(submitting.slug ? { initial: submitting.slug } : {})}
      onCancel={() => setSubmitting(null)}
      onDone={() => {
        setSubmitting(null);
        setSentNotice(true);
      }}
    />
  );
  const notice = sentNotice && (
    <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      Documento enviado. Fica «Em validação» até o RH ou o seu gerente aprovar.
    </p>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {folder ? (
        <section className="space-y-3" aria-label={folder.label}>
          <button
            type="button"
            onClick={() => {
              setFolderKey(null);
              setSubmitting(null);
            }}
            className={`${SMALL_BTN} -ml-2 gap-1 text-ink-secondary`}
          >
            <IconChevronLeft size={18} />
            Pastas
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-navy-900">{folder.label}</h1>
              <p className="text-xs text-ink-secondary">
                {countLabel(folder.docs.length)} · {folder.hint}
              </p>
            </div>
            {folder.submittable.length > 0 && !submitting && (
              <button type="button" onClick={() => startSubmit({ folder: folder.key })} className={`${SMALL_BTN} gap-1.5 bg-brand-600 px-4 text-white`}>
                <AppIcon name="upload" size={16} />
                Enviar documento
              </button>
            )}
          </div>
          {notice}
          {submitForm}
          {folder.missing.length > 0 && (
            <ul className={`${CARD} divide-y divide-line-subtle`} aria-label="Em falta nesta pasta">
              {folder.missing.map((c) => (
                <MissingRow key={c.slug} label={c.label} mandatory={c.mandatory} rejection={c.lastRejection?.note ?? null} {...(c.canSubmit ? { onSend: () => startSubmit({ folder: folder.key, slug: c.slug }) } : {})} />
              ))}
            </ul>
          )}
          {folder.docs.length > 0 ? (
            <ul className={`${CARD} divide-y divide-line-subtle`} aria-label={`Documentos em ${folder.label}`}>
              {folder.docs.map(row)}
            </ul>
          ) : (
            <p className={`${CARD} p-5 text-center text-sm text-ink-secondary`}>Esta pasta ainda não tem documentos.</p>
          )}
        </section>
      ) : (
        <>
          <div>
            <h1 className="text-lg font-bold text-navy-900">Documentos</h1>
            <p className="text-sm text-ink-secondary">Consulte, descarregue e envie os seus documentos.</p>
          </div>
          {notice}

          {attentionTotal > 0 && (
            <section aria-label="Precisa da sua atenção" className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                Precisa da sua atenção
                <CountBadge n={attentionTotal} label={`${attentionTotal} a tratar`} />
              </h2>
              {submitForm}
              <ul className={`${CARD} divide-y divide-line-subtle`}>
                {missingRequired.map((m) => {
                  const slugs = m.categories.filter((s) => categories.some((c) => c.slug === s && c.canSubmit));
                  const first = categories.find((c) => slugs.includes(c.slug));
                  const rejection = categories.find((c) => m.categories.includes(c.slug) && c.lastRejection)?.lastRejection?.note ?? null;
                  return (
                    <MissingRow key={m.id} label={m.label} mandatory rejection={rejection} {...(first ? { onSend: () => startSubmit({ folder: folderOfCategory(first), slug: first.slug, only: slugs }) } : {})} />
                  );
                })}
                {attentionDocs.map(row)}
              </ul>
            </section>
          )}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Pastas">
            {folders.map((f) => (
              <FolderCard
                key={f.key}
                folder={f}
                onOpen={() => {
                  setSubmitting(null);
                  setFolderKey(f.key);
                }}
              />
            ))}
          </ul>
          {checklist.isError && <p className="text-xs text-ink-secondary">Não foi possível ver o que está em falta. Os seus documentos continuam disponíveis.</p>}
        </>
      )}

      <Dialog
        open={image !== null}
        title={image?.title ?? ""}
        onClose={() => setImage(null)}
        actions={
          <>
            <a href={image?.url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
              Abrir em nova janela
            </a>
            <button type="button" onClick={() => setImage(null)} className={buttonClass("primary")}>
              Fechar
            </button>
          </>
        }
      >
        {image && <img src={image.url} alt={image.title} className="max-h-[60vh] w-full rounded-xl object-contain" />}
      </Dialog>
    </div>
  );
}
