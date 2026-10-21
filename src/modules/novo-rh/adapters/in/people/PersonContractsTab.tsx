import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { Person } from "../../../domain/entities/people.ts";
import type { Option } from "../../../domain/ports/out/settings-api.port.ts";
import { ContractsTab, OrganizationTab, PayTab } from "./PersonTabs.tsx";
import { PersonFieldHistory } from "./PersonInsightTabs.tsx";

/**
 * Ficha → Contratos: contratos, organização (centro e transferências) e
 * remuneração num só sítio — os mesmos painéis de antes, agrupados por decisão
 * do utilizador (redesign premium da ficha).
 */
export function PersonContractsTab({ person, locations }: { person: Person; locations: Option[] }) {
  const { t } = useI18n();
  const heading = (id: string, title: string, hint: string) => (
    <div>
      <h2 id={id} className="text-lg font-semibold text-navy-900">
        {title}
      </h2>
      <p className="text-sm text-ink-secondary">{hint}</p>
    </div>
  );
  return (
    <div className="space-y-8">
      <ContractsTab personId={person.id} />
      <section className="space-y-3" aria-labelledby="person-org">
        {heading("person-org", t("contracts.org"), t("contracts.orgHint"))}
        <OrganizationTab personId={person.id} locations={locations} />
        <PersonFieldHistory person={person} field="positionId" title={t("people.history.position")} />
      </section>
      <section className="space-y-3" aria-labelledby="person-pay">
        {heading("person-pay", t("contracts.pay"), t("contracts.payHint"))}
        <PayTab personId={person.id} />
        <PersonFieldHistory person={person} field="baseSalary" title={t("people.history.salary")} />
      </section>
    </div>
  );
}
