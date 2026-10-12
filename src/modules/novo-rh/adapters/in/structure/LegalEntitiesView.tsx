import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import {
  Button,
  FIELD,
  LABEL,
  SECTION_TITLE,
  StatusBadge,
  SURFACE,
  TABLE,
  TD,
  TH,
  THEAD,
  TR,
  Tabs,
} from "../../../../../components/ui/index.ts";
import type {
  CountryCatalog,
  LegalEntity,
  LegalEntityInput,
} from "../../../domain/entities/legal-entities.ts";
import { legalEntityErrors } from "../../../domain/services/legal-entities.service.ts";
import { describeError } from "../../../domain/services/errors.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { ErrorPanel } from "../common/ErrorPanel.tsx";

const KEY = ["novo-rh", "legal-entities"];
const EMPTY: LegalEntityInput = {
  name: "",
  country: "PT",
  taxIdType: "nif",
  taxId: "",
  socialSecurityId: "",
  billingEmail: "",
  street: "",
  postalCode: "",
  city: "",
  region: "",
  phone: null,
};

/** Novo RH → Entidades legais (FE-092) e a entidade de cada centro (FE-093). */
export function LegalEntitiesView() {
  const { t } = useI18n();
  const { legalEntities } = useNovoRh();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");
  const [editing, setEditing] = useState<LegalEntity | "new" | null>(null);
  const catalog = useQuery({
    queryKey: [...KEY, "catalog"],
    queryFn: () => legalEntities.catalog(),
  });
  const list = useQuery({
    queryKey: [...KEY, "list", q, status],
    queryFn: () => legalEntities.list({ q, status }),
  });
  const countryOf = (c: string) => catalog.data?.find((x) => x.code === c);
  return (
    <div className="space-y-4">
      <section
        className={`${SURFACE} space-y-3 p-4`}
        aria-label={t("le.title")}
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className={SECTION_TITLE}>{t("le.title")}</h3>
          <Button variant="primary" onClick={() => setEditing("new")}>
            {t("le.new")}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className={LABEL}>{t("le.search")}</span>
            <input
              type="search"
              className={FIELD}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <Tabs
            value={status}
            onChange={setStatus}
            items={[
              { key: "active", label: t("le.status.active") },
              { key: "archived", label: t("le.status.archived") },
              { key: "all", label: t("le.status.all") },
            ]}
          />
        </div>
        {list.isError && (
          <ErrorPanel
            error={list.error}
            route="/hr/novo/entidades"
            onRetry={() => void list.refetch()}
          />
        )}
        {list.data && list.data.length === 0 && (
          <p className="text-sm text-stone-500">{t("le.none")}</p>
        )}
        {list.data && list.data.length > 0 && (
          <div className="overflow-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>{t("le.field.name")}</th>
                  <th className={TH}>{t("le.field.country")}</th>
                  <th className={TH}>{t("le.field.taxId")}</th>
                  <th className={TH}>{t("le.col.locations")}</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {list.data.map((e) => (
                  <tr key={e.id} className={TR}>
                    <td className={TD}>
                      {e.name}
                      {e.status === "archived" && (
                        <span className="ml-2">
                          <StatusBadge tone="neutral">
                            {t("le.status.archived")}
                          </StatusBadge>
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      {countryOf(e.country)?.label ?? e.country}
                    </td>
                    <td className={TD}>{e.taxId}</td>
                    <td className={TD}>{e.locations}</td>
                    <td className={TD}>
                      <Button size="sm" onClick={() => setEditing(e)}>
                        {t("le.open")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && catalog.data && (
        <EntityEditor
          key={editing === "new" ? "new" : editing.id}
          entity={editing === "new" ? null : editing}
          catalog={catalog.data}
          onClose={() => setEditing(null)}
        />
      )}
      <LocationsPanel />
    </div>
  );
}

function EntityEditor({
  entity,
  catalog,
  onClose,
}: {
  entity: LegalEntity | null;
  catalog: CountryCatalog[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { legalEntities } = useNovoRh();
  const qc = useQueryClient();
  const initial: LegalEntityInput = entity
    ? {
        name: entity.name,
        country: entity.country,
        taxIdType: entity.taxIdType,
        taxId: entity.taxId,
        socialSecurityId: entity.socialSecurityId,
        billingEmail: entity.billingEmail,
        street: entity.street,
        postalCode: entity.postalCode,
        city: entity.city,
        region: entity.region,
        phone: entity.phone,
      }
    : EMPTY;
  const [v, setV] = useState<LegalEntityInput>(initial);
  const [touched, setTouched] = useState<
    Partial<Record<keyof LegalEntityInput, boolean>>
  >({});
  const [reason, setReason] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const country = catalog.find((c) => c.code === v.country) ?? catalog[0]!;
  const errors = legalEntityErrors(v, country.regionLabel);
  const usage = useQuery({
    queryKey: [...KEY, "usage", entity?.id],
    queryFn: () => legalEntities.usage(entity!.id),
    enabled: !!entity,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const changed = (Object.keys(v) as (keyof LegalEntityInput)[]).filter(
    (k) => v[k] !== initial[k],
  );
  const save = useMutation({
    mutationFn: () =>
      entity
        ? legalEntities.update(
            entity,
            Object.fromEntries(changed.map((k) => [k, v[k]])),
            reason,
          )
        : legalEntities.create(v),
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  const archive = useMutation({
    mutationFn: () => legalEntities.archive(entity!.id, archiveReason),
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  const restore = useMutation({
    mutationFn: () => legalEntities.restore(entity!.id),
    onSuccess: refresh,
  });
  const serverError = save.error
    ? describeError(save.error, t("common.error"))
    : null;
  const serverField = (save.error as { data?: { field?: string } } | null)?.data
    ?.field;
  const inUse =
    !!usage.data && (usage.data.locations > 0 || usage.data.contracts > 0);
  const fiscalChanged = changed.some(
    (k) => k === "taxId" || k === "taxIdType" || k === "socialSecurityId",
  );
  const ok =
    Object.keys(errors).length === 0 &&
    (!entity || (changed.length > 0 && reason.trim().length >= 5));
  const fieldError = (k: keyof LegalEntityInput) =>
    ((touched[k] || serverField === k) &&
      (errors[k] || (serverField === k ? serverError?.message : undefined))) ||
    null;
  const field = (
    k: keyof LegalEntityInput,
    label: string,
    extra: { type?: string; placeholder?: string } = {},
  ) => (
    <div>
      <label className="block">
        <span className={LABEL}>{label}</span>
        <input
          className={`${FIELD} w-full`}
          type={extra.type ?? "text"}
          placeholder={extra.placeholder}
          aria-invalid={!!fieldError(k)}
          aria-describedby={fieldError(k) ? `le-err-${k}` : undefined}
          value={v[k] ?? ""}
          disabled={entity?.status === "archived"}
          onChange={(e) =>
            setV({
              ...v,
              [k]: k === "phone" ? e.target.value || null : e.target.value,
            })
          }
          onBlur={() => setTouched({ ...touched, [k]: true })}
        />
      </label>
      {fieldError(k) && (
        <p id={`le-err-${k}`} className="text-xs text-red-700">
          {fieldError(k)}
        </p>
      )}
    </div>
  );
  return (
    <section
      className={`${SURFACE} space-y-3 p-4`}
      aria-label={entity ? entity.name : t("le.new")}
    >
      <div className="flex items-center justify-between">
        <h3 className={SECTION_TITLE}>{entity ? entity.name : t("le.new")}</h3>
        <Button size="sm" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
      {entity && usage.data && (
        <p className="text-xs text-stone-600">
          {t("le.usage", {
            locations: usage.data.locations,
            contracts: usage.data.contracts,
          })}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {field("name", t("le.field.name"))}
        <label className="block">
          <span className={LABEL}>{t("le.field.country")}</span>
          <select
            className={`${FIELD} w-full`}
            value={v.country}
            disabled={entity?.status === "archived" || (!!entity && inUse)}
            onChange={(e) => {
              const c = catalog.find((x) => x.code === e.target.value)!;
              setV({ ...v, country: c.code, taxIdType: c.taxIdTypes[0]!.key });
            }}
          >
            {catalog.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {entity && inUse && (
          <p className="-mt-2 text-xs text-stone-500 md:col-span-2">
            {t("le.countryLocked")}
          </p>
        )}
        <label className="block">
          <span className={LABEL}>{t("le.field.taxIdType")}</span>
          <select
            className={`${FIELD} w-full`}
            value={v.taxIdType}
            disabled={entity?.status === "archived"}
            onChange={(e) =>
              setV({
                ...v,
                taxIdType: e.target.value as LegalEntityInput["taxIdType"],
              })
            }
          >
            {country.taxIdTypes.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        {field("taxId", t("le.field.taxId"))}
        {field("socialSecurityId", country.socialSecurityLabel)}
        {field("billingEmail", t("le.field.billingEmail"), { type: "email" })}
        {field("street", t("le.field.street"))}
        {field("postalCode", t("le.field.postalCode"), {
          placeholder: v.country === "PT" ? "0000-000" : "00000",
        })}
        {field("city", t("le.field.city"))}
        {field("region", country.regionLabel)}
        {field("phone", t("le.field.phone"), { placeholder: "+351…" })}
      </div>
      {entity && entity.status === "active" && (
        <label className="block">
          <span className={LABEL}>{t("le.field.reason")}</span>
          <input
            className={`${FIELD} w-full`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
      {entity && fiscalChanged && inUse && (
        <p className="text-sm text-amber-700">
          {t("le.fiscalWarning", {
            locations: usage.data!.locations,
            contracts: usage.data!.contracts,
          })}
        </p>
      )}
      {serverError && !serverField && (
        <ErrorPanel error={save.error} route="/hr/novo/entidades" />
      )}
      {entity?.status !== "archived" && (
        <Button
          variant="primary"
          disabled={!ok || save.isPending}
          onClick={() => save.mutate()}
        >
          {entity ? t("le.save") : t("le.create")}
        </Button>
      )}
      {entity && entity.status === "active" && (
        <div className="space-y-2 border-t border-stone-100 pt-3">
          <p className="text-xs text-stone-500">{t("le.archiveHint")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className={LABEL}>{t("le.archiveReason")}</span>
              <input
                className={FIELD}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
              />
            </label>
            <Button
              disabled={archiveReason.trim().length < 5 || archive.isPending}
              onClick={() => archive.mutate()}
            >
              {t("le.archive")}
            </Button>
          </div>
          {archive.isError && <ArchiveError error={archive.error} />}
        </div>
      )}
      {entity && entity.status === "archived" && (
        <Button disabled={restore.isPending} onClick={() => restore.mutate()}>
          {t("le.restore")}
        </Button>
      )}
    </section>
  );
}

/** 409 com as contagens que impedem arquivar. */
function ArchiveError({ error }: { error: unknown }) {
  const { t } = useI18n();
  const data = (error as { data?: { locations?: number; contracts?: number } })
    .data;
  if (data && typeof data.locations === "number")
    return (
      <p className="text-sm text-red-700">
        {t("le.archiveBlocked", {
          locations: data.locations,
          contracts: data.contracts ?? 0,
        })}
      </p>
    );
  return <ErrorPanel error={error} route="/hr/novo/entidades" />;
}

/** FE-093: entidade de cada centro (só entidades ativas). */
function LocationsPanel() {
  const { t } = useI18n();
  const { legalEntities } = useNovoRh();
  const qc = useQueryClient();
  const locations = useQuery({
    queryKey: [...KEY, "locations"],
    queryFn: () => legalEntities.locations(),
  });
  const active = useQuery({
    queryKey: [...KEY, "list", "", "active"],
    queryFn: () => legalEntities.list({ q: "", status: "active" }),
  });
  const set = useMutation({
    mutationFn: (x: { locationId: string; legalEntityId: string | null }) =>
      legalEntities.setLocationEntity(x.locationId, x.legalEntityId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  return (
    <section
      className={`${SURFACE} space-y-2 p-4`}
      aria-label={t("le.locations")}
    >
      <h3 className={SECTION_TITLE}>{t("le.locations")}</h3>
      {(locations.data ?? []).map((l) => (
        <label
          key={l.id}
          className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-700"
        >
          <span>{l.name}</span>
          <select
            className={FIELD}
            aria-label={t("le.locationEntity", { name: l.name })}
            value={l.legalEntityId ?? ""}
            disabled={set.isPending}
            onChange={(e) =>
              set.mutate({
                locationId: l.id,
                legalEntityId: e.target.value || null,
              })
            }
          >
            <option value="">{t("le.noEntity")}</option>
            {(active.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      {set.isError && (
        <ErrorPanel error={set.error} route="/hr/novo/entidades" />
      )}
    </section>
  );
}
