import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, FIELD, LABEL, SECTION_TITLE, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR, Tabs, type StatusTone } from "../../../../../components/ui/index.ts";
import { joinLink, type InvitationState, type JoinPrefill, type JoinRequest } from "../../../domain/entities/invitations.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { ErrorPanel } from "../common/ErrorPanel.tsx";
import { NewPersonDrawer } from "./NewPersonDrawer.tsx";

const KEY = ["novo-rh", "invitations"];
const TONE: Record<InvitationState, StatusTone> = { active: "success", expired: "neutral", exhausted: "neutral", revoked: "danger" };
const day = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Novo RH → Convites e pedidos de adesão (FE-054). */
export function InvitationsView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"requests" | "invitations">("requests");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "requests", label: t("inv.tab.requests") },
          { key: "invitations", label: t("inv.tab.invitations") },
        ]}
      />
      {tab === "requests" ? <RequestsPanel /> : <InvitationsPanel />}
    </div>
  );
}

function InvitationsPanel() {
  const { t } = useI18n();
  const { invitations, settings, structure } = useNovoRh();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: [...KEY, "list"], queryFn: () => invitations.list() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const departments = useQuery({ queryKey: ["novo-rh", "structure", "departments"], queryFn: () => structure.listDepartments() });
  const [v, setV] = useState({ locationId: "", departmentId: "", expiresInDays: "14", maxUses: "" });
  const [created, setCreated] = useState<{ code: string; link: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => invitations.create({ locationId: v.locationId || null, departmentId: v.departmentId || null, expiresInDays: Number(v.expiresInDays), maxUses: v.maxUses ? Number(v.maxUses) : null }),
    onSuccess: async (r) => {
      setCreated({ code: r.code, link: joinLink(window.location.origin, r.code) });
      setCopied(null);
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const revoke = useMutation({ mutationFn: (id: string) => invitations.revoke(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const copy = async (what: "code" | "link") => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(what === "code" ? created.code : created.link);
      setCopied(what);
    } catch {
      setCopied(null);
    }
  };
  const label = (id: string | null, opts: { id: string; label: string }[] | undefined) => (id ? (opts?.find((o) => o.id === id)?.label ?? "—") : t("inv.any"));
  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("inv.new")}>
        <h3 className={SECTION_TITLE}>{t("inv.new")}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className={LABEL}>{t("inv.field.location")}</span>
            <select className={FIELD} value={v.locationId} onChange={(e) => setV({ ...v, locationId: e.target.value })}>
              <option value="">{t("inv.any")}</option>
              {(locations.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>{t("inv.field.department")}</span>
            <select className={FIELD} value={v.departmentId} onChange={(e) => setV({ ...v, departmentId: e.target.value })}>
              <option value="">{t("inv.any")}</option>
              {(departments.data ?? [])
                .filter((d) => !d.archived)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>{t("inv.field.days")}</span>
            <input type="number" min={1} max={90} className={`${FIELD} w-24`} value={v.expiresInDays} onChange={(e) => setV({ ...v, expiresInDays: e.target.value })} />
          </label>
          <label>
            <span className={LABEL}>{t("inv.field.maxUses")}</span>
            <input type="number" min={1} max={500} className={`${FIELD} w-24`} placeholder="∞" value={v.maxUses} onChange={(e) => setV({ ...v, maxUses: e.target.value })} />
          </label>
          <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
            {t("inv.create")}
          </Button>
        </div>
        {create.isError && <ErrorPanel error={create.error} route="/hr/novo/convites" />}
        {created && (
          <AlertBanner tone="success" title={t("inv.created")}>
            <p className="text-sm">{t("inv.createdHint")}</p>
            <p className="mt-1 font-mono text-sm">{created.code}</p>
            <p className="break-all font-mono text-xs">{created.link}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => void copy("code")}>
                {copied === "code" ? t("errors.copied") : t("inv.copyCode")}
              </Button>
              <Button size="sm" onClick={() => void copy("link")}>
                {copied === "link" ? t("errors.copied") : t("inv.copyLink")}
              </Button>
            </div>
          </AlertBanner>
        )}
      </section>
      <section className={`${SURFACE} space-y-2 p-4`} aria-label={t("inv.tab.invitations")}>
        {list.isError && <ErrorPanel error={list.error} route="/hr/novo/convites" onRetry={() => void list.refetch()} />}
        {list.data && list.data.length === 0 && <p className="text-sm text-stone-500">{t("inv.none")}</p>}
        {list.data && list.data.length > 0 && (
          <div className="overflow-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>{t("inv.col.code")}</th>
                  <th className={TH}>{t("inv.field.location")}</th>
                  <th className={TH}>{t("inv.col.uses")}</th>
                  <th className={TH}>{t("inv.col.expires")}</th>
                  <th className={TH}>{t("inv.col.state")}</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {list.data.map((i) => (
                  <tr key={i.id} className={TR}>
                    <td className={`${TD} font-mono`}>{i.maskedCode}</td>
                    <td className={TD}>{label(i.locationId, locations.data)}</td>
                    <td className={TD}>
                      {i.uses}
                      {i.maxUses !== null && `/${i.maxUses}`}
                    </td>
                    <td className={TD}>{day(i.expiresAt)}</td>
                    <td className={TD}>
                      <StatusBadge tone={TONE[i.state]}>{t(`inv.state.${i.state}` as MessageKey)}</StatusBadge>
                    </td>
                    <td className={TD}>
                      {i.state === "active" && (
                        <Button size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(i.id)}>
                          {t("inv.revoke")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function RequestsPanel() {
  const { t } = useI18n();
  const { invitations, settings } = useNovoRh();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: [...KEY, "requests"], queryFn: () => invitations.requests() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const [status, setStatus] = useState<JoinRequest["status"]>("pending");
  const [prefill, setPrefill] = useState<JoinPrefill | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const accept = useMutation({ mutationFn: (id: string) => invitations.accept(id), onSuccess: setPrefill, onError: refresh });
  const rows = (list.data ?? []).filter((r) => r.status === status);
  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("inv.tab.requests")}>
      <Tabs
        value={status}
        onChange={setStatus}
        items={[
          { key: "pending", label: t("inv.req.pending") },
          { key: "accepted", label: t("inv.req.accepted") },
          { key: "rejected", label: t("inv.req.rejected") },
        ]}
      />
      {list.isError && <ErrorPanel error={list.error} route="/hr/novo/convites" onRetry={() => void list.refetch()} />}
      {accept.isError && <ErrorPanel error={accept.error} route="/hr/novo/convites" />}
      {list.data && rows.length === 0 && <p className="text-sm text-stone-500">{t("inv.req.none")}</p>}
      <ul className="divide-y divide-stone-100">
        {rows.map((r) => (
          <RequestRow key={r.id} r={r} onAccept={() => accept.mutate(r.id)} accepting={accept.isPending} />
        ))}
      </ul>
      {prefill && (
        <NewPersonDrawer
          key={prefill.requestId}
          open
          locations={locations.data ?? []}
          initial={{ firstName: prefill.firstName, lastName: prefill.lastName, email: prefill.email, ...(prefill.locationId && { primaryLocationId: prefill.locationId }) }}
          onCreated={async (employeeId) => {
            await invitations.complete(prefill.requestId, employeeId);
            await refresh();
          }}
          onClose={() => {
            setPrefill(null);
            void refresh();
          }}
        />
      )}
    </section>
  );
}

function RequestRow({ r, onAccept, accepting }: { r: JoinRequest; onAccept: () => void; accepting: boolean }) {
  const { t } = useI18n();
  const { invitations } = useNovoRh();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const reject = useMutation({ mutationFn: () => invitations.reject(r.id, reason), onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
  return (
    <li className="space-y-1 py-2" aria-label={`${r.firstName} ${r.lastName}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-stone-900">
            {r.firstName} {r.lastName}
          </p>
          <p className="text-xs text-stone-500">
            {r.email} · {day(r.createdAt)}
            {r.invitationState === "revoked" && ` · ${t("inv.req.revokedInvitation")}`}
          </p>
          {r.possibleDuplicate && <p className="text-xs text-amber-700">{t("inv.req.duplicate")}</p>}
          {r.status === "rejected" && r.rejectReason && <p className="text-xs text-stone-500">{t("inv.req.reason", { reason: r.rejectReason })}</p>}
          {r.status === "accepted" && r.employeeId && (
            <Link to={`/hr/novo/pessoas/${r.employeeId}`} className="text-xs text-[#C2410C] hover:underline">
              {t("inv.req.openPerson")}
            </Link>
          )}
        </div>
        {r.status === "pending" && (
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={accepting} onClick={onAccept}>
              {t("inv.req.accept")}
            </Button>
            <Button size="sm" onClick={() => setRejecting(!rejecting)}>
              {t("inv.req.reject")}
            </Button>
          </div>
        )}
      </div>
      {rejecting && r.status === "pending" && (
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className={LABEL}>{t("inv.req.reasonLabel")}</span>
            <input className={FIELD} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <Button size="sm" disabled={reason.trim().length < 5 || reject.isPending} onClick={() => reject.mutate()}>
            {t("inv.req.confirmReject")}
          </Button>
        </div>
      )}
      {reject.isError && <ErrorPanel error={reject.error} route="/hr/novo/convites" />}
    </li>
  );
}
