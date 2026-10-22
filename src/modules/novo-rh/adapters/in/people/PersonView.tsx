import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import {
  AlertBanner,
  Avatar,
  Button,
  Dialog,
  DropdownMenu,
  FIELD,
  IconChevronDown,
  IconChevronLeft,
  IconMore,
  LABEL,
  StatusBadge,
  SURFACE,
} from "../../../../../components/ui/index.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { PersonDataTab } from "./PersonDataTab.tsx";
import { DocumentsTab, ManagersTab } from "./PersonTabs.tsx";
import { PersonContractsTab } from "./PersonContractsTab.tsx";
import { PersonAbsencesTab } from "./PersonAbsencesTab.tsx";
import { PersonHistoryTab, PersonStatsTab } from "./PersonInsightTabs.tsx";
import { DaysPanel } from "../attendance/DaysPanel.tsx";
import { LedgerPanel } from "../time-bank/TimeBankView.tsx";

// A ficha junta tudo da pessoa (FE-014…023): ponto, ausências e banco de horas são os mesmos
// ecrãs das áreas, fixados nesta pessoa. Organização e Remuneração vivem dentro de Contratos;
// Horário, Campos da empresa, Regras pessoais e Acesso saíram da ficha (redesign premium,
// decisão do utilizador — o acesso gere-se em Utilizadores).
const MAIN_TABS = ["data", "contracts", "attendance", "absences", "stats", "timeBank", "documents"] as const;
const MORE_TABS = ["managers", "history"] as const;
type Tab = (typeof MAIN_TABS)[number] | (typeof MORE_TABS)[number];
const TAB_LABEL: Record<Tab, MessageKey> = {
  data: "people.tab.data",
  contracts: "people.tab.contracts",
  attendance: "people.tab.attendance",
  absences: "people.tab.absencesVacation",
  stats: "people.tab.stats",
  timeBank: "people.tab.timeBank",
  documents: "people.tab.documents",
  managers: "people.tab.managers",
  history: "people.tab.history",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join("");
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const tabClass = (active: boolean) =>
  `-mb-px inline-flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
    active ? "border-brand-600 text-brand-600" : "border-transparent text-ink-secondary hover:text-ink"
  }`;

/** Novo RH → Pessoas → ficha (`/hr/novo/pessoas/:id`). Uma ficha por pessoa: trocar de pessoa recomeça o estado. */
export function PersonView() {
  const { id = "" } = useParams();
  return <PersonFile key={id} id={id} />;
}

function PersonFile({ id }: { id: string }) {
  const { t } = useI18n();
  const { people, settings } = useNovoRh();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(() => {
    const asked = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    return asked && asked in TAB_LABEL ? asked : "data";
  });
  const [dataDirty, setDataDirty] = useState(false);
  const [reason, setReason] = useState("");
  const [toggleOpen, setToggleOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const q = useQuery({ queryKey: ["novo-rh", "person", id], queryFn: () => people.get(id) });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const everyone = useQuery({ queryKey: ["novo-rh", "people", "all", ""], queryFn: () => people.list({ status: "all" }), enabled: tab === "managers" });
  const positions = useQuery({ queryKey: ["novo-rh", "catalog", "positions"], queryFn: () => people.listPositions() });
  // O PIN só aparece com o quiosque ligado; o banco de horas some com a funcionalidade desligada.
  const features = useQuery({ queryKey: ["me", "features"], queryFn: () => settings.features(), staleTime: 5 * 60_000, retry: false });
  const kiosk = features.data?.["time_tracking.kiosk.enabled"] === true;
  const bankOff = features.data?.["time_tracking.bank.enabled"] === false;
  const savePin = useMutation({
    mutationFn: () => people.setKioskPin(id, pin),
    onSuccess: () => {
      setPinOpen(false);
      setPin("");
      setPinSaved(true);
    },
  });
  const closePin = () => {
    setPinOpen(false);
    setPin("");
    savePin.reset();
  };
  const toggle = useMutation({
    mutationFn: () => (q.data!.person.status === "active" ? people.deactivate(id, q.data!.etag, reason) : people.reactivate(id, q.data!.etag, reason)),
    onSuccess: (next) => {
      qc.setQueryData(["novo-rh", "person", id], next);
      void qc.invalidateQueries({ queryKey: ["novo-rh", "people"] });
      setReason("");
      setToggleOpen(false);
    },
  });
  const closeToggle = () => {
    setToggleOpen(false);
    setReason("");
    toggle.reset();
  };

  if (q.isLoading) return <p className="text-sm text-stone-400">{t("common.loading")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-red-700">{t("common.loadError")}</p>;
  const p = q.data.person;
  const active = p.status === "active";
  const mainTabs = MAIN_TABS.filter((k) => k !== "timeBank" || !bankOff);
  const inMore = (MORE_TABS as readonly Tab[]).includes(tab);
  const meta = [
    positions.data?.find((x) => x.id === p.positionId)?.name,
    locations.data?.find((l) => l.id === p.primaryLocationId)?.label,
    p.hireDate ? t("people.header.since", { date: ddmmyyyy(p.hireDate) }) : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <header className={`${SURFACE} px-4 py-3 sm:px-5`}>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <Link to="/hr/novo/pessoas" aria-label={t("people.back")} title={t("people.back")} className="-ml-1 rounded-lg p-1.5 text-ink-secondary hover:bg-surface-soft hover:text-ink">
            <IconChevronLeft />
          </Link>
          {p.photoUrl ? (
            <Avatar name={p.fullName} photoUrl={p.photoUrl} size="lg" />
          ) : (
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ED5C32] to-[#F08A4B] text-base font-semibold text-white">
              {initials(p.fullName)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-navy-900">{p.fullName}</h2>
              <StatusBadge tone={active ? "success" : "neutral"}>{active ? t("people.active") : t("people.inactive")}</StatusBadge>
              {p.missing.length > 0 && <StatusBadge tone="warning">{t("people.toComplete")}</StatusBadge>}
            </div>
            <p className="truncate text-sm text-ink-secondary">{meta.length ? meta.join(" · ") : t("people.header.noWork")}</p>
          </div>
          <DropdownMenu
            label={t("people.actions")}
            items={[
              ...(kiosk && active ? [{ label: t("people.kioskPin"), onSelect: () => (setPinSaved(false), setPinOpen(true)) }] : []),
              { label: active ? t("people.deactivate") : t("people.reactivate"), danger: active, onSelect: () => setToggleOpen(true) },
            ]}
            trigger={({ toggle: open }) => (
              <Button variant="secondary" onClick={open} icon={<IconMore size={16} />}>
                {t("people.actions")}
              </Button>
            )}
          />
        </div>
        {p.missing.length > 0 && (
          <div role="status" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>{t("people.missingList", { fields: p.missing.map((f) => t(`people.field.${f}` as MessageKey)).join(", ") })}</span>
            {tab !== "data" && (
              <button type="button" onClick={() => setTab("data")} className="font-medium underline">
                {t("people.complete")}
              </button>
            )}
          </div>
        )}
      </header>

      {pinSaved && <AlertBanner tone="success" title={t("people.kioskPin.saved")} />}
      <Dialog
        open={pinOpen}
        title={t("people.kioskPin.title")}
        description={t("people.kioskPin.description")}
        onClose={closePin}
        actions={
          <>
            <Button variant="secondary" onClick={closePin}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!/^\d{4}$/.test(pin) || savePin.isPending} onClick={() => savePin.mutate()}>
              {t("people.kioskPin.save")}
            </Button>
          </>
        }
      >
        <input
          aria-label={t("people.kioskPin.field")}
          placeholder={t("people.kioskPin.field")}
          className={FIELD}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
        {savePin.isError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {savePin.error instanceof Error ? savePin.error.message : t("common.error")}
          </p>
        )}
      </Dialog>
      <Dialog
        open={toggleOpen}
        title={active ? t("people.toggle.deactivateTitle") : t("people.toggle.reactivateTitle")}
        description={active ? t("people.deactivateHint") : undefined}
        onClose={closeToggle}
        actions={
          <>
            <Button variant="secondary" onClick={closeToggle}>
              {t("common.cancel")}
            </Button>
            <Button variant={active ? "danger" : "primary"} disabled={!reason.trim() || toggle.isPending} onClick={() => toggle.mutate()}>
              {active ? t("people.deactivate") : t("people.reactivate")}
            </Button>
          </>
        }
      >
        <label htmlFor="person-toggle-reason" className={LABEL}>
          {t("people.toggleReason")}
        </label>
        <input id="person-toggle-reason" className={`${FIELD} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
        {toggle.isError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {toggle.error instanceof Error ? toggle.error.message : t("common.error")}
          </p>
        )}
      </Dialog>

      <div className="flex items-end gap-1 border-b border-line-subtle">
        <div role="tablist" aria-label={p.fullName} className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mainTabs.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={tabClass(tab === k)}>
              {t(TAB_LABEL[k])}
              {k === "data" && dataDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title={t("people.unsavedTab")} aria-label={t("people.unsavedTab")} />}
            </button>
          ))}
        </div>
        <DropdownMenu
          label={t("people.tab.more")}
          items={MORE_TABS.map((k) => ({ label: t(TAB_LABEL[k]), onSelect: () => setTab(k) }))}
          trigger={({ toggle: open }) => (
            <button type="button" onClick={open} aria-haspopup="menu" className={tabClass(inMore)}>
              {inMore ? t(TAB_LABEL[tab]) : t("people.tab.more")}
              <IconChevronDown size={14} />
            </button>
          )}
        />
      </div>

      {/* Os Dados ficam montados (escondidos) ao mudar de aba: o rascunho não se perde. */}
      <div hidden={tab !== "data"}>
        <PersonDataTab key={q.data.etag ?? p.version} data={q.data} locations={locations.data ?? []} onDirtyChange={setDataDirty} />
      </div>
      {tab === "contracts" && <PersonContractsTab person={p} locations={locations.data ?? []} />}
      {tab === "attendance" && <DaysPanel fixedEmployeeId={id} />}
      {tab === "absences" && <PersonAbsencesTab personId={id} />}
      {tab === "stats" && <PersonStatsTab personId={id} />}
      {tab === "timeBank" && <LedgerPanel fixedEmployeeId={id} />}
      {tab === "documents" && <DocumentsTab personId={id} />}
      {tab === "managers" && <ManagersTab personId={id} people={(everyone.data ?? []).map((e) => ({ id: e.id, label: e.fullName }))} />}
      {tab === "history" && <PersonHistoryTab personId={id} />}
    </div>
  );
}
