import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { needsAction, type MyAnnouncement, type MyDistribution } from "../../domain/entities/portal-engagement.ts";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";

const CARD = "rounded-2xl border border-[#F5C992]/50 bg-white p-4 shadow-sm";
const BTN = "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 disabled:opacity-50";
const PRIMARY = "rounded-xl bg-[#ED5C32] px-3 py-2 text-sm font-medium text-white disabled:opacity-50";
const day = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const message = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

/** Comunicados e documentos enviados pela empresa, com confirmação de leitura (FE-074). */
export function PortalNewsView() {
  const { engagement } = useEmployeePortalModule();
  const { data, isLoading, isError } = useQuery({ queryKey: ["portal-news"], queryFn: () => engagement.inbox(), retry: false });
  if (isLoading) return <p className="text-sm text-stone-500">A carregar…</p>;
  if (isError || !data) return <p className="text-sm text-red-700">Não foi possível carregar os comunicados.</p>;
  return (
    <div className="space-y-5">
      <section className="space-y-2" aria-label="Documentos enviados">
        <h2 className="text-sm font-semibold text-stone-900">Documentos enviados</h2>
        {data.distributions.length === 0 && <p className="text-sm text-stone-500">Sem documentos enviados.</p>}
        {data.distributions.map((d) => (
          <DistributionCard key={d.id} d={d} />
        ))}
      </section>
      <section className="space-y-2" aria-label="Comunicados">
        <h2 className="text-sm font-semibold text-stone-900">Comunicados</h2>
        {data.announcements.length === 0 && <p className="text-sm text-stone-500">Sem comunicados.</p>}
        {data.announcements.map((a) => (
          <AnnouncementCard key={`${a.id}-${a.version}`} a={a} />
        ))}
      </section>
    </div>
  );
}

function Status({ x }: { x: { requiresConfirmation: boolean; readAt: string | null; confirmedAt: string | null } }) {
  if (x.confirmedAt) return <span className="text-xs text-emerald-700">Confirmado em {day(x.confirmedAt)}</span>;
  if (needsAction(x)) return <span className="text-xs font-medium text-[#C2410C]">{x.requiresConfirmation ? "Por confirmar" : "Por abrir"}</span>;
  return <span className="text-xs text-stone-500">Aberto em {day(x.readAt)}</span>;
}

function useRefreshNews() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["portal-news"] }), qc.invalidateQueries({ queryKey: ["portal-pending"] })]);
}

function DistributionCard({ d }: { d: MyDistribution }) {
  const { engagement } = useEmployeePortalModule();
  const refresh = useRefreshNews();
  const open = useMutation({
    mutationFn: async () => {
      // A janela abre-se já no toque (bloqueadores de popups); o URL assinado chega depois.
      const w = window.open("", "_blank");
      const url = await engagement.openDistribution(d.id);
      if (w) {
        w.opener = null;
        w.location.href = url;
      } else window.location.assign(url);
    },
    onSuccess: refresh,
  });
  const confirm = useMutation({ mutationFn: () => engagement.confirmDistribution(d.id), onSuccess: refresh });
  const opened = !!d.readAt;
  return (
    <article className={`${CARD} space-y-2`} aria-label={d.title}>
      <div>
        <p className="text-sm font-semibold text-stone-900">{d.title}</p>
        <p className="text-xs text-stone-500">
          {d.fileName} · {day(d.createdAt)}
        </p>
        <Status x={d} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} disabled={open.isPending} onClick={() => open.mutate()}>
          Abrir documento
        </button>
        {d.requiresConfirmation && !d.confirmedAt && (
          <button type="button" className={PRIMARY} disabled={!opened || confirm.isPending} onClick={() => confirm.mutate()}>
            Confirmo que li
          </button>
        )}
      </div>
      {d.requiresConfirmation && !opened && <p className="text-xs text-stone-500">Abra o documento antes de confirmar a leitura.</p>}
      {(open.isError || confirm.isError) && <p className="text-sm text-red-700">{message(open.error ?? confirm.error)}</p>}
    </article>
  );
}

function AnnouncementCard({ a }: { a: MyAnnouncement }) {
  const { engagement } = useEmployeePortalModule();
  const refresh = useRefreshNews();
  const [expanded, setExpanded] = useState(false);
  const read = useMutation({ mutationFn: () => engagement.openAnnouncement(a.id), onSuccess: refresh });
  const confirm = useMutation({ mutationFn: () => engagement.confirmAnnouncement(a.id), onSuccess: refresh });
  const toggle = () => {
    setExpanded(!expanded);
    if (!expanded && !a.readAt) read.mutate();
  };
  return (
    <article className={`${CARD} space-y-2`} aria-label={a.title}>
      <button type="button" onClick={toggle} aria-expanded={expanded} className="w-full text-left">
        <span className="block text-sm font-semibold text-stone-900">{a.title}</span>
        <span className="block text-xs text-stone-500">{day(a.publishedAt)}</span>
      </button>
      <Status x={a} />
      {expanded && <p className="whitespace-pre-line text-sm text-stone-700">{a.body}</p>}
      {expanded && a.requiresConfirmation && !a.confirmedAt && (
        <button type="button" className={PRIMARY} disabled={confirm.isPending} onClick={() => confirm.mutate()}>
          Confirmo que li
        </button>
      )}
      {(read.isError || confirm.isError) && <p className="text-sm text-red-700">{message(read.error ?? confirm.error)}</p>}
    </article>
  );
}
