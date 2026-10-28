import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertBanner, Button, Drawer, FIELD, LABEL, SECTION_TITLE, Skeleton, SlideSwitch } from "../../../../components/ui/index.ts";
import { useOptionalAuth } from "../../../../contexts/AuthContext";
import { hasLevel } from "../../../access/domain/services/access-ui.service.ts";
import { parseEuroToCents } from "../../../bank-statements/domain/services/recurring-rules-overview.ts";
import { useCashFlowModule } from "../../cash-flow.module.tsx";
import { DELIVERY_RATE_KEYS, deliveryParametersUse, platformLabel } from "../../domain/services/dre-view.ts";
import type { DreReport } from "../../domain/entities/dre.ts";
import { euros } from "./cash-flow-format.ts";
import { fromForm, PCT_FIELDS, toForm, type DreParametersForm } from "../../domain/services/sales-reconciliation-view.ts";
import { monthName } from "../../domain/services/cash-flow-view.ts";

/** Pode gravar: Admin ou «Mapa» com gestão. */
function useCanManage(): boolean {
  const user = useOptionalAuth()?.user;
  const access = user?.access;
  return !!access && !access.portalOnly && (access.isAdmin || hasLevel(access.permissions, "dre.statement", "MANAGE"));
}

const SOURCE_TEXT = {
  month: "Valores deste mês.",
  inherited: "Taxas herdadas do último mês com valores (o marketing começa a zero). Gravar fixa-as neste mês.",
  default: "Valores de omissão. Gravar fixa-os neste mês.",
} as const;

/**
 * Parâmetros da DRE do mês: taxas para reconstituir o delivery em bruto, taxa do TPA, IVA teórico dos
 * gastos e marketing das plataformas (sem IVA). Gravar recalcula o Mapa e a conferência de vendas.
 * Plataformas com extratos importados no mês (`costs`, a DRE já carregada) usam os valores reais: o
 * marketing aparece só para leitura e as taxas de delivery dizem a que plataformas ainda se aplicam.
 */
export function DreParametersDrawer({
  year,
  month,
  open,
  onClose,
  costs = null,
}: {
  year: number;
  month: number;
  open: boolean;
  onClose: () => void;
  costs?: DreReport | null;
}) {
  const delivery = deliveryParametersUse(costs);
  const fromStatements = new Map(delivery.fromStatements.map((p) => [p.platform, p.marketingNetCents]));
  const { getDreParameters, saveDreParameters } = useCashFlowModule();
  const qc = useQueryClient();
  const canManage = useCanManage();
  const query = useQuery({
    queryKey: ["dre-parameters", year, month],
    queryFn: () => getDreParameters.execute(year, month),
    enabled: open,
    retry: false,
  });
  // O que o utilizador já alterou; sem alterações, o formulário mostra os valores carregados.
  const [edited, setForm] = useState<DreParametersForm | null>(null);
  const [invalid, setInvalid] = useState<string[]>([]);
  const form = edited ?? (query.data ? toForm(query.data) : null);

  const close = () => {
    setForm(null);
    setInvalid([]);
    onClose();
  };

  const save = useMutation({
    mutationFn: (p: Parameters<typeof saveDreParameters.execute>[2]) => saveDreParameters.execute(year, month, p),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dre-parameters", year, month] });
      void qc.invalidateQueries({ queryKey: ["dre", year, month] });
      void qc.invalidateQueries({ queryKey: ["sales-reconciliation", year, month] });
      close();
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const parsed = fromForm(form, parseEuroToCents);
    if (!parsed.ok) {
      setInvalid(parsed.invalid);
      return;
    }
    setInvalid([]);
    save.mutate(parsed.value);
  };

  const fieldCls = (key: string) => `${FIELD} ${invalid.includes(key) ? "border-rose-500" : ""}`;

  return (
    <Drawer
      open={open}
      onClose={close}
      as="form"
      onSubmit={submit}
      title="Parâmetros do mês"
      description={`${monthName(month)} ${year} · usados no Mapa e na conferência de vendas`}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={close}>Cancelar</Button>
          {canManage && (
            <Button type="submit" variant="primary" loading={save.isPending} disabled={!form}>
              Gravar
            </Button>
          )}
        </div>
      }
    >
      {query.error ? (
        <AlertBanner tone="danger" title="Não foi possível carregar os parâmetros">
          {query.error instanceof Error ? query.error.message : "Erro ao carregar"}
        </AlertBanner>
      ) : !form || !query.data ? (
        <Skeleton className="h-96" />
      ) : (
        <fieldset disabled={!canManage} className="space-y-6">
          <p className="text-sm text-ink-secondary">{SOURCE_TEXT[query.data.source]}</p>
          {save.error && (
            <AlertBanner tone="danger" title="Não foi possível gravar">
              {save.error instanceof Error ? save.error.message : "Erro ao gravar"}
            </AlertBanner>
          )}
          {invalid.length > 0 && (
            <AlertBanner tone="warning" title="Há valores inválidos">
              Percentagens entre 0 e 100; marketing em euros (ex.: 120,50); comissão com IVA abaixo de 100%.
            </AlertBanner>
          )}

          <section className="space-y-3">
            <h3 className={SECTION_TITLE}>Taxas (%)</h3>
            {delivery.ratesNote && (
              <AlertBanner tone="info" title="Delivery pelos extratos importados">
                {delivery.ratesNote} As taxas de IVA das vendas, comissão, IVA da comissão e IVA do marketing só servem para as plataformas
                sem extratos.
              </AlertBanner>
            )}
            {PCT_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className={LABEL}>{f.label}</span>
                <input
                  className={fieldCls(f.key)}
                  inputMode="decimal"
                  value={form.pct[f.key]}
                  onChange={(e) => setForm({ ...form, pct: { ...form.pct, [f.key]: e.target.value } })}
                  aria-invalid={invalid.includes(f.key)}
                />
                <span className="mt-1 block text-xs text-ink-secondary">
                  {f.hint}
                  {delivery.ratesNote && DELIVERY_RATE_KEYS.has(f.key) ? " · só plataformas sem extratos" : ""}
                </span>
              </label>
            ))}
            <div>
              <span className={LABEL}>A comissão incide sobre a venda</span>
              <SlideSwitch
                label="Base da comissão"
                options={[
                  { key: "gross", label: "Com IVA" },
                  { key: "net", label: "Sem IVA" },
                ]}
                value={form.commissionOnGross ? "gross" : "net"}
                onChange={(v) => setForm({ ...form, commissionOnGross: v === "gross" })}
              />
              <span className="mt-1 block text-xs text-ink-secondary">Confirmar no extrato da plataforma.</span>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className={SECTION_TITLE}>Marketing das plataformas (€, sem IVA)</h3>
            {(["uber_eats", "glovo", "bolt_food"] as const).map((k) =>
              fromStatements.has(k) ? (
                <div key={k}>
                  <span className={LABEL}>{platformLabel(k)}</span>
                  <p className="text-sm font-medium tabular-nums text-ink">{euros(fromStatements.get(k)!)}</p>
                  <span className="mt-1 block text-xs text-ink-secondary">
                    Pelos extratos importados (Plataformas de delivery) — o valor manual não conta.
                  </span>
                </div>
              ) : (
                <label key={k} className="block">
                  <span className={LABEL}>{platformLabel(k)}</span>
                  <input
                    className={fieldCls(`marketing.${k}`)}
                    inputMode="decimal"
                    value={form.marketing[k]}
                    onChange={(e) => setForm({ ...form, marketing: { ...form.marketing, [k]: e.target.value } })}
                    aria-invalid={invalid.includes(`marketing.${k}`)}
                  />
                </label>
              ),
            )}
            <p className="text-xs text-ink-secondary">Descontado na liquidação: aumenta a venda bruta e entra como custo da plataforma.</p>
          </section>
        </fieldset>
      )}
    </Drawer>
  );
}
