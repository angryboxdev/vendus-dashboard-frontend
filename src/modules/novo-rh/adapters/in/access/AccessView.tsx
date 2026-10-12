import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, FIELD, IconDownload, IconPlus, LABEL, SECTION_TITLE, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { FieldPrivacyRow, ScopeKind, ScopeType } from "../../../domain/entities/governance.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { downloadBlob } from "../download.ts";

const KEY = ["novo-rh", "access"] as const;

function ProfilePanel({ profileId, isAdminProfile }: { profileId: string; isAdminProfile: boolean }) {
  const { t } = useI18n();
  const { access } = useNovoRh();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...KEY, "profile", profileId], queryFn: () => access.profileGovernance(profileId) });
  const [draft, setDraft] = useState<Record<string, { view: boolean; edit: boolean }>>({});
  const refresh = () => void qc.invalidateQueries({ queryKey: [...KEY, "profile", profileId] });
  const kind = useMutation({ mutationFn: (k: ScopeKind) => access.setScopeKind(profileId, k), onSuccess: refresh });
  const save = useMutation({
    mutationFn: () => access.setFieldPrivacy(profileId, Object.entries(draft).map(([fieldKey, v]) => ({ fieldKey, canView: v.view, canEdit: v.view && v.edit }))),
    onSuccess: () => (setDraft({}), refresh()),
  });
  if (!q.data) return <p className="text-sm text-stone-400">{t("common.loading")}</p>;
  const cell = (f: FieldPrivacyRow) => draft[f.key] ?? { view: f.view, edit: f.edit };
  const set = (f: FieldPrivacyRow, patch: Partial<{ view: boolean; edit: boolean }>) => {
    const next = { ...cell(f), ...patch };
    if (!next.view) next.edit = false;
    setDraft({ ...draft, [f.key]: next });
  };

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className={LABEL}>{t("access.profile.kind")}</legend>
        <div className="flex flex-col gap-1 text-sm">
          {(["general", "specific"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="radio" name={`kind-${profileId}`} checked={q.data.scopeKind === k} disabled={isAdminProfile || kind.isPending} onChange={() => kind.mutate(k)} />
              {t(k === "general" ? "access.profile.kind.general" : "access.profile.kind.specific")}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <h3 className={SECTION_TITLE}>{t("access.fields.title")}</h3>
        <p className="text-xs text-stone-500">{isAdminProfile ? t("access.fields.adminAll") : t("access.fields.hint")}</p>
        <table className={`${TABLE} mt-2`}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("common.name")}</th>
              <th className={TH}>{t("access.fields.view")}</th>
              <th className={TH}>{t("access.fields.edit")}</th>
            </tr>
          </thead>
          <tbody>
            {q.data.fields.map((f) => (
              <tr key={f.key} className={TR}>
                <td className={TD}>
                  {f.label} {f.sensitive && <StatusBadge tone="warning">{t("access.fields.sensitive")}</StatusBadge>}
                </td>
                <td className={TD}>
                  <input type="checkbox" aria-label={`${t("access.fields.view")} ${f.label}`} checked={cell(f).view} disabled={isAdminProfile} onChange={(e) => set(f, { view: e.target.checked })} />
                </td>
                <td className={TD}>
                  <input
                    type="checkbox"
                    aria-label={`${t("access.fields.edit")} ${f.label}`}
                    checked={cell(f).edit}
                    disabled={isAdminProfile || !cell(f).view}
                    onChange={(e) => set(f, { edit: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isAdminProfile && (
          <div className="mt-2 flex justify-end">
            <Button variant="primary" disabled={Object.keys(draft).length === 0 || save.isPending} onClick={() => save.mutate()}>
              {t("common.save")}
            </Button>
          </div>
        )}
      </div>
      {(kind.isError || save.isError) && (
        <AlertBanner tone="danger" title={t("common.error")}>
          {(kind.error ?? save.error) instanceof Error ? (kind.error ?? save.error)!.message : ""}
        </AlertBanner>
      )}
    </div>
  );
}

function UserScopes({ userId }: { userId: string }) {
  const { t } = useI18n();
  const { access, structure, settings } = useNovoRh();
  const qc = useQueryClient();
  const [scopeType, setScopeType] = useState<ScopeType>("location");
  const [scopeId, setScopeId] = useState("");
  const [validFrom, setValidFrom] = useState(todayIn());
  const scopes = useQuery({ queryKey: [...KEY, "scopes", userId], queryFn: () => access.listScopes(userId) });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const deps = useQuery({ queryKey: ["novo-rh", "structure", "departments"], queryFn: () => structure.listDepartments() });
  const groups = useQuery({ queryKey: ["novo-rh", "structure", "groups"], queryFn: () => structure.listGroups() });
  const options =
    scopeType === "location"
      ? (locations.data ?? []).map((l) => ({ id: l.id, label: l.label }))
      : scopeType === "department"
        ? (deps.data ?? []).filter((d) => !d.archived).map((d) => ({ id: d.id, label: d.name }))
        : scopeType === "group"
          ? (groups.data ?? []).filter((g) => !g.archived).map((g) => ({ id: g.id, label: g.name }))
          : [];
  const labelOf = (type: ScopeType, id: string | null) => {
    if (type === "self") return t("access.scopes.self");
    const all = [...(locations.data ?? []).map((l) => ({ id: l.id, label: l.label })), ...(deps.data ?? []).map((d) => ({ id: d.id, label: d.name })), ...(groups.data ?? []).map((g) => ({ id: g.id, label: g.name }))];
    return all.find((o) => o.id === id)?.label ?? id ?? "";
  };
  const refresh = () => void qc.invalidateQueries({ queryKey: [...KEY, "scopes", userId] });
  const add = useMutation({ mutationFn: () => access.addScope(userId, { scopeType, scopeId: scopeType === "self" ? null : scopeId, validFrom, validTo: null }), onSuccess: () => (setScopeId(""), refresh()) });
  const end = useMutation({ mutationFn: (id: string) => access.endScope(userId, id, todayIn()), onSuccess: refresh });
  const typeLabel = (k: ScopeType) => (k === "self" ? t("access.scopes.self") : t(k === "location" ? "settings.target.location" : k === "department" ? "settings.target.department" : "settings.target.group"));

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto_auto]">
        <select aria-label={t("access.scopes.type")} className={FIELD} value={scopeType} onChange={(e) => (setScopeType(e.target.value as ScopeType), setScopeId(""))}>
          {(["location", "department", "group", "self"] as const).map((k) => (
            <option key={k} value={k}>
              {typeLabel(k)}
            </option>
          ))}
        </select>
        <select aria-label={t("access.scopes.target")} className={FIELD} value={scopeId} onChange={(e) => setScopeId(e.target.value)} disabled={scopeType === "self"}>
          <option value="">{t("common.choose")}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <input aria-label={t("common.from")} type="date" className={FIELD} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        <Button variant="primary" icon={<IconPlus />} disabled={(scopeType !== "self" && !scopeId) || add.isPending} onClick={() => add.mutate()}>
          {t("common.add")}
        </Button>
      </div>
      {(scopes.data ?? []).length === 0 ? (
        <p className="text-sm text-stone-500">{t("access.scopes.empty")}</p>
      ) : (
        <ul className="divide-y divide-[#F5C992]/40 text-sm">
          {scopes.data!.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span>
                {typeLabel(s.scopeType)}: {labelOf(s.scopeType, s.scopeId)} · {s.validFrom}
                {s.validTo ? ` → ${s.validTo}` : ""}
              </span>
              {!s.validTo && (
                <Button size="sm" variant="tertiary" onClick={() => end.mutate(s.id)}>
                  {t("common.end")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(add.isError || end.isError) && (
        <AlertBanner tone="danger" title={t("common.error")}>
          {(add.error ?? end.error) instanceof Error ? (add.error ?? end.error)!.message : ""}
        </AlertBanner>
      )}
    </div>
  );
}

/** Novo RH → Acessos (ticket 08): tipo de perfil, privacidade por campo, âmbitos e histórico. */
export function AccessView() {
  const { t } = useI18n();
  const { access } = useNovoRh();
  const [profileId, setProfileId] = useState("");
  const [userId, setUserId] = useState("");
  const profiles = useQuery({ queryKey: [...KEY, "profiles"], queryFn: () => access.listProfiles() });
  const users = useQuery({ queryKey: [...KEY, "users"], queryFn: () => access.listUsers() });
  const history = useQuery({ queryKey: [...KEY, "history"], queryFn: () => access.roleHistory() });
  const selected = profiles.data?.find((p) => p.id === profileId);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${SURFACE} p-4`} aria-labelledby="acc-profile">
          <h2 id="acc-profile" className={SECTION_TITLE}>
            {t("access.profile.title")}
          </h2>
          <select aria-label={t("access.profile.title")} className={`${FIELD} mt-2 w-full`} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">{t("common.choose")}</option>
            {(profiles.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {profileId && (
            <div className="mt-3">
              <ProfilePanel key={profileId} profileId={profileId} isAdminProfile={selected?.systemKey === "admin"} />
            </div>
          )}
        </section>
        <section className={`${SURFACE} p-4`} aria-labelledby="acc-scopes">
          <h2 id="acc-scopes" className={SECTION_TITLE}>
            {t("access.scopes.title")}
          </h2>
          <p className="text-xs text-stone-500">{t("access.scopes.hint")}</p>
          <select aria-label={t("access.scopes.title")} className={`${FIELD} mt-2 w-full`} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">{t("common.choose")}</option>
            {(users.data ?? []).map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.label}
              </option>
            ))}
          </select>
          {userId && (
            <div className="mt-3">
              <UserScopes key={userId} userId={userId} />
            </div>
          )}
        </section>
      </div>

      <section className={`${SURFACE} p-4`} aria-labelledby="acc-history">
        <div className="flex items-center justify-between gap-2">
          <h2 id="acc-history" className={SECTION_TITLE}>
            {t("access.history.title")}
          </h2>
          <Button size="sm" icon={<IconDownload />} onClick={() => void access.downloadRoleHistoryCsv().then((b) => downloadBlob(b, "historico-papeis.csv"))}>
            {t("common.exportCsv")}
          </Button>
        </div>
        {(history.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">{t("access.history.empty")}</p>
        ) : (
          <div className="mt-2 max-h-80 overflow-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>{t("settings.history.when")}</th>
                  <th className={TH}>{t("settings.history.who")}</th>
                  <th className={TH}>{t("audit.action")}</th>
                </tr>
              </thead>
              <tbody>
                {history.data!.slice(0, 100).map((h, i) => (
                  <tr key={`${h.at}-${i}`} className={TR}>
                    <td className={TD}>{new Date(h.at).toLocaleString("pt-PT")}</td>
                    <td className={TD}>{h.actor}</td>
                    <td className={TD}>
                      {h.entityType} · {h.action}
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
