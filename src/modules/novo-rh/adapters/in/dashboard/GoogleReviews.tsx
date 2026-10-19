import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, SearchInput, Skeleton } from "../../../../../components/ui/index.ts";
import { ApiError } from "../../../../../lib/api.ts";
import type { GoogleLocationRating, GoogleReviewsOverview } from "../../../domain/entities/dashboard.ts";
import { formatRating } from "../../../domain/services/dashboard.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { WidgetMessage, WidgetSkeleton } from "./DashboardWidget.tsx";

const KEY = ["novo-rh", "google-reviews"] as const;
const errText = (e: unknown, fallback: string) =>
  e instanceof ApiError && e.status === 403 ? "Sem permissão para gerir os locais." : e instanceof ApiError && e.status === 502 ? "O Google não respondeu agora. Tente mais tarde." : e instanceof ApiError && e.status < 500 ? e.message : fallback;

function Stars({ rating }: { rating: number | null }) {
  const full = Math.round(rating ?? 0);
  return (
    <span aria-hidden="true" className="tracking-tight">
      <span className="text-amber-400">{"★".repeat(full)}</span>
      <span className="text-line-subtle">{"★".repeat(5 - full)}</span>
    </span>
  );
}

function useGoogleOverview() {
  const { dashboard } = useNovoRh();
  return useQuery({ queryKey: KEY, queryFn: () => dashboard.googleReviews(), staleTime: 10 * 60_000, retry: false });
}

/**
 * Widget "Avaliações Google": média ponderada e nota por local ligado. Com
 * `locationId` (detalhe da unidade) mostra só esse local e as avaliações.
 */
export function GoogleReviewsBody({ locationId }: { locationId?: string }) {
  const q = useGoogleOverview();
  const [manage, setManage] = useState(false);
  const [open, setOpen] = useState<GoogleLocationRating | null>(null);
  if (q.isLoading) return <WidgetSkeleton />;
  if (q.isError) return <WidgetMessage text="Não foi possível carregar as avaliações Google." />;
  const o = q.data!;
  // O detalhe técnico (chave em falta) fica nos logs do servidor; aqui só o estado operacional.
  if (!o.configured) return <WidgetMessage text="As avaliações Google ainda não estão ativas nesta conta. Para as ativar, contacte o suporte." />;
  const manageBtn = (
    <Button size="sm" variant="tertiary" onClick={() => setManage(true)}>
      Ligar locais ao Google
    </Button>
  );
  const drawers = (
    <>
      <GoogleLinkDrawer open={manage} overview={o} onClose={() => setManage(false)} />
      <GoogleLocationReviewsDrawer location={open} onClose={() => setOpen(null)} />
    </>
  );

  if (locationId) {
    const row = o.locations.find((l) => l.locationId === locationId);
    if (!row)
      return (
        <>
          <WidgetMessage text="Este local ainda não está ligado ao Google." action={manageBtn} />
          {drawers}
        </>
      );
    return <GoogleLocationReviewsList location={row} />;
  }

  if (!o.locations.length)
    return (
      <>
        <WidgetMessage text="Nenhum local ligado ao Google ainda." action={manageBtn} />
        {drawers}
      </>
    );
  return (
    <div className="space-y-3">
      {o.average.rating !== null && (
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-navy-900">{formatRating(o.average.rating)}</span>
          <Stars rating={o.average.rating} />
          <span className="text-xs text-ink-secondary">{o.average.count} avaliações</span>
        </div>
      )}
      <ul className="divide-y divide-line-subtle rounded-xl border border-line-subtle">
        {o.locations.map((l) => (
          <li key={l.locationId}>
            <button type="button" onClick={() => setOpen(l)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-soft">
              <span className="min-w-0 flex-1 truncate font-medium text-navy-900">{l.locationName}</span>
              {l.unavailable ? (
                <span className="text-xs text-ink-secondary">indisponível</span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
                  <span className="font-semibold tabular-nums text-navy-900">{formatRating(l.rating)}</span>
                  <span className="text-amber-400" aria-hidden="true">★</span>
                  <span className="tabular-nums">({l.userRatingCount ?? 0})</span>
                </span>
              )}
              <span className="sr-only">Ver avaliações</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-secondary">{o.unlinked.length ? `${o.unlinked.length} local(is) por ligar` : "Dados do Google"}</span>
        {manageBtn}
      </div>
      {drawers}
    </div>
  );
}

function GoogleLocationReviewsList({ location }: { location: GoogleLocationRating }) {
  const { dashboard } = useNovoRh();
  const q = useQuery({ queryKey: [...KEY, "reviews", location.locationId], queryFn: () => dashboard.googleLocationReviews(location.locationId), staleTime: 10 * 60_000, retry: false });
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums text-navy-900">{formatRating(location.rating)}</span>
        <Stars rating={location.rating} />
        <span className="text-xs text-ink-secondary">{location.userRatingCount ?? 0} avaliações</span>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : q.isError ? (
        <p className="text-sm text-ink-secondary">{errText(q.error, "Não foi possível carregar as avaliações.")}</p>
      ) : !q.data?.reviews.length ? (
        <p className="text-sm text-ink-secondary">Sem avaliações com texto.</p>
      ) : (
        <ul className="space-y-2">
          {q.data.reviews.map((r, i) => (
            <li key={i} className="rounded-xl border border-line-subtle px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                {r.authorUri ? (
                  <a href={r.authorUri} target="_blank" rel="noreferrer" className="font-medium text-navy-900 hover:underline">
                    {r.author}
                  </a>
                ) : (
                  <span className="font-medium text-navy-900">{r.author}</span>
                )}
                <span className="text-ink-secondary">
                  <Stars rating={r.rating} /> {r.relativeTime}
                </span>
              </div>
              {r.text && <p className="mt-1.5 whitespace-pre-line text-sm text-ink">{r.text}</p>}
            </li>
          ))}
        </ul>
      )}
      {(q.data?.googleMapsUri ?? location.googleMapsUri) && (
        <a href={(q.data?.googleMapsUri ?? location.googleMapsUri)!} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-brand-600 hover:underline">
          Ver no Google ›
        </a>
      )}
      <p className="text-[11px] text-ink-secondary">Avaliações fornecidas pelo Google.</p>
    </div>
  );
}

export function GoogleLocationReviewsDrawer({ location, onClose }: { location: GoogleLocationRating | null; onClose: () => void }) {
  return (
    <Drawer open={!!location} title={location?.locationName ?? ""} description={location ? `Google · ${location.placeName}` : undefined} onClose={onClose}>
      {location && <GoogleLocationReviewsList location={location} />}
    </Drawer>
  );
}

/** Ligar cada local ao seu lugar no Google: pesquisa pelo nome e escolhe o candidato certo. */
export function GoogleLinkDrawer({ open, overview, onClose }: { open: boolean; overview: GoogleReviewsOverview; onClose: () => void }) {
  const { dashboard } = useNovoRh();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ locationId: string; locationName: string } | null>(null);
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const search = useQuery({ queryKey: [...KEY, "search", term], queryFn: () => dashboard.googleSearch(term), enabled: term.trim().length >= 3, staleTime: 5 * 60_000, retry: false });
  const save = (o: GoogleReviewsOverview) => (qc.setQueryData(KEY, o), setEditing(null), setTerm(""));
  const link = useMutation({ mutationFn: (v: { locationId: string; placeId: string; placeName: string }) => dashboard.googleLink(v.locationId, { placeId: v.placeId, placeName: v.placeName }), onSuccess: save });
  const unlink = useMutation({ mutationFn: (locationId: string) => dashboard.googleUnlink(locationId), onSuccess: save });
  const start = (l: { locationId: string; locationName: string }) => (setEditing(l), setText(l.locationName), setTerm(l.locationName));
  const rows = [...overview.locations.map((l) => ({ locationId: l.locationId, locationName: l.locationName, placeName: l.placeName as string | null })), ...overview.unlinked.map((u) => ({ ...u, placeName: null }))].sort((a, b) =>
    a.locationName.localeCompare(b.locationName, "pt"),
  );
  const error = link.error ?? unlink.error;
  return (
    <Drawer open={open} title="Ligar locais ao Google" description="Escolha o lugar no Google de cada local para mostrar a nota e as avaliações." onClose={() => (setEditing(null), onClose())} width="max-w-xl">
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.locationId} className="rounded-xl border border-line-subtle px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy-900">{r.locationName}</p>
                <p className="truncate text-xs text-ink-secondary">{r.placeName ? `Ligado a: ${r.placeName}` : "Por ligar"}</p>
              </div>
              {r.placeName && (
                <Button size="sm" variant="tertiary" disabled={unlink.isPending} onClick={() => unlink.mutate(r.locationId)}>
                  Desligar
                </Button>
              )}
              <Button size="sm" onClick={() => start(r)}>
                {r.placeName ? "Alterar" : "Ligar"}
              </Button>
            </div>
            {editing?.locationId === r.locationId && (
              <div className="mt-2 space-y-2">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setTerm(text);
                  }}
                >
                  <SearchInput label="Pesquisar no Google" value={text} onChange={(e) => setText(e.target.value)} className="flex-1" />
                  <Button size="sm" type="submit">
                    Pesquisar
                  </Button>
                </form>
                {search.isLoading ? (
                  <Skeleton className="h-16 w-full rounded-xl" />
                ) : search.isError ? (
                  <p className="text-xs text-red-700">{errText(search.error, "Falha na pesquisa.")}</p>
                ) : search.data && !search.data.length ? (
                  <p className="text-xs text-ink-secondary">Sem resultados. Experimente o nome e a cidade.</p>
                ) : (
                  <ul className="space-y-1">
                    {(search.data ?? []).map((c) => (
                      <li key={c.placeId}>
                        <button
                          type="button"
                          disabled={link.isPending}
                          onClick={() => link.mutate({ locationId: r.locationId, placeId: c.placeId, placeName: c.name })}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-soft"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-navy-900">{c.name}</span>
                            {c.address && <span className="block truncate text-xs text-ink-secondary">{c.address}</span>}
                          </span>
                          {c.rating !== null && (
                            <span className="text-xs tabular-nums text-ink-secondary">
                              {formatRating(c.rating)} <span className="text-amber-400">★</span> ({c.userRatingCount ?? 0})
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        ))}
        {!rows.length && <p className="text-sm text-ink-secondary">Sem locais na empresa.</p>}
      </ul>
      {error && <p className="mt-3 text-xs text-red-700">{errText(error, "Não foi possível guardar.")}</p>}
    </Drawer>
  );
}
