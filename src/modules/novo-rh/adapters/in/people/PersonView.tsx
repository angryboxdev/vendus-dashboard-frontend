import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import {
  AlertBanner,
  Button,
  FIELD,
  IconChevronLeft,
  StatusBadge,
  Tabs,
} from "../../../../../components/ui/index.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { PersonDataTab } from "./PersonDataTab.tsx";
import {
  ContractsTab,
  CustomFieldsTab,
  DocumentsTab,
  ManagersTab,
  OrganizationTab,
  PayTab,
  PersonalRulesTab,
} from "./PersonTabs.tsx";
import { PersonAccessTab, PersonFieldHistory, PersonHistoryTab, PersonStatsTab } from "./PersonInsightTabs.tsx";
import { DaysPanel } from "../attendance/DaysPanel.tsx";
import { BalancesPanel, RequestsPanel } from "../absences/RequestPanels.tsx";
import { TheoreticalPanel } from "../time/TheoreticalPanel.tsx";
import { LedgerPanel } from "../time-bank/TimeBankView.tsx";

// A ficha junta tudo da pessoa (FE-014…023): os separadores de ponto, ausências, horário e banco
// de horas são os mesmos ecrãs das áreas, fixados nesta pessoa.
const TABS = [
  "data",
  "contracts",
  "organization",
  "managers",
  "pay",
  "attendance",
  "absences",
  "schedule",
  "timeBank",
  "stats",
  "custom",
  "rules",
  "documents",
  "access",
  "history",
] as const;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join("");
type Tab = (typeof TABS)[number];

/** Novo RH → Pessoas → ficha (`/hr/novo/pessoas/:id`). */
export function PersonView() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const { people, settings } = useNovoRh();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("data");
  const [reason, setReason] = useState("");
  const q = useQuery({
    queryKey: ["novo-rh", "person", id],
    queryFn: () => people.get(id),
  });
  const locations = useQuery({
    queryKey: ["novo-rh", "settings", "locations"],
    queryFn: () => settings.listLocations(),
  });
  const everyone = useQuery({
    queryKey: ["novo-rh", "people", "all", ""],
    queryFn: () => people.list({ status: "all" }),
  });
  const positions = useQuery({
    queryKey: ["novo-rh", "catalog", "positions"],
    queryFn: () => people.listPositions(),
  });
  const toggle = useMutation({
    mutationFn: () =>
      q.data!.person.status === "active"
        ? people.deactivate(id, q.data!.etag, reason)
        : people.reactivate(id, q.data!.etag, reason),
    onSuccess: (next) => {
      qc.setQueryData(["novo-rh", "person", id], next);
      void qc.invalidateQueries({ queryKey: ["novo-rh", "people"] });
      setReason("");
    },
  });

  if (q.isLoading)
    return <p className="text-sm text-stone-400">{t("common.loading")}</p>;
  if (q.isError || !q.data)
    return <p className="text-sm text-red-700">{t("common.loadError")}</p>;
  const p = q.data.person;

  return (
    <div className="space-y-4">
      <Link
        to="/hr/novo/pessoas"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"
      >
        <IconChevronLeft /> {t("people.back")}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ED5C32] to-[#F08A4B] text-base font-semibold text-white"
          >
            {initials(p.fullName)}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              {p.fullName}
            </h2>
            <p className="text-sm text-stone-600">
              {[
                positions.data?.find((x) => x.id === p.positionId)?.name,
                locations.data?.find((l) => l.id === p.primaryLocationId)
                  ?.label,
                p.hireDate
                  ? t("people.header.since", { date: p.hireDate })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || t("people.header.noWork")}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              <StatusBadge tone={p.status === "active" ? "success" : "neutral"}>
                {p.status === "active"
                  ? t("people.active")
                  : t("people.inactive")}
              </StatusBadge>
              {p.missing.length > 0 && (
                <StatusBadge tone="warning">
                  {t("people.toComplete")}
                </StatusBadge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label={t("people.toggleReason")}
            placeholder={t("people.toggleReason")}
            className={FIELD}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant={p.status === "active" ? "danger" : "secondary"}
            disabled={!reason.trim() || toggle.isPending}
            onClick={() => toggle.mutate()}
          >
            {p.status === "active"
              ? t("people.deactivate")
              : t("people.reactivate")}
          </Button>
        </div>
      </div>
      {p.status === "active" && (
        <p className="text-xs text-stone-500">{t("people.deactivateHint")}</p>
      )}
      {toggle.isError && (
        <AlertBanner tone="danger" title={t("common.error")}>
          {toggle.error instanceof Error ? toggle.error.message : ""}
        </AlertBanner>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={TABS.map((k) => ({
          key: k,
          label: t(`people.tab.${k}` as MessageKey),
        }))}
      />
      {tab === "data" && (
        <PersonDataTab
          key={q.data.etag ?? p.version}
          data={q.data}
          locations={locations.data ?? []}
        />
      )}
      {tab === "contracts" && <ContractsTab personId={id} />}
      {tab === "organization" && (
        <div className="space-y-4">
          <OrganizationTab personId={id} locations={locations.data ?? []} />
          <PersonFieldHistory person={p} field="positionId" title={t("people.history.position")} />
        </div>
      )}
      {tab === "managers" && (
        <ManagersTab
          personId={id}
          people={(everyone.data ?? []).map((e) => ({
            id: e.id,
            label: e.fullName,
          }))}
        />
      )}
      {tab === "pay" && (
        <div className="space-y-4">
          <PayTab personId={id} />
          <PersonFieldHistory person={p} field="baseSalary" title={t("people.history.salary")} />
        </div>
      )}
      {tab === "custom" && <CustomFieldsTab personId={id} />}
      {tab === "rules" && <PersonalRulesTab personId={id} />}
      {tab === "documents" && <DocumentsTab personId={id} />}
      {tab === "attendance" && <DaysPanel fixedEmployeeId={id} />}
      {tab === "absences" && (
        <div className="space-y-4">
          <BalancesPanel fixedEmployeeId={id} />
          <RequestsPanel fixedEmployeeId={id} />
        </div>
      )}
      {tab === "schedule" && <TheoreticalPanel fixedEmployeeId={id} />}
      {tab === "timeBank" && <LedgerPanel fixedEmployeeId={id} />}
      {tab === "stats" && <PersonStatsTab personId={id} />}
      {tab === "history" && <PersonHistoryTab personId={id} />}
      {tab === "access" && <PersonAccessTab person={p} />}
    </div>
  );
}
