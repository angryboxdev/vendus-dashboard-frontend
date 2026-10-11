import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, Drawer, FIELD, IconCheck, LABEL } from "../../../../../components/ui/index.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const COLUMNS = "nome; apelido; nif; data_admissao; centro (código ou id); email; telefone; iban; niss";

/** Importar CSV: simulação primeiro (erros por linha); só grava se tudo estiver certo. */
export function ImportPeopleDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const [csv, setCsv] = useState("");
  const simulate = useMutation({ mutationFn: () => people.importCsv(csv, true) });
  const commit = useMutation({
    mutationFn: () => people.importCsv(csv, false),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["novo-rh", "people"] }),
  });
  const sim = simulate.data;
  const allValid = !!sim && sim.valid === sim.total;

  return (
    <Drawer
      open={open}
      title={t("import.title")}
      onClose={() => {
        setCsv("");
        simulate.reset();
        commit.reset();
        onClose();
      }}
      width="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => simulate.mutate()} disabled={!csv.trim() || simulate.isPending}>
            {t("import.simulate")}
          </Button>
          <Button variant="primary" onClick={() => commit.mutate()} disabled={!allValid || commit.isPending || !!commit.data}>
            {t("import.confirm", { count: sim?.valid ?? 0 })}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-stone-500">{t("import.hint", { columns: COLUMNS })}</p>
        <div>
          <label htmlFor="import-file" className={LABEL}>
            {t("import.file")}
          </label>
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            className={FIELD}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void f.text().then((txt) => (setCsv(txt), simulate.reset(), commit.reset()));
            }}
          />
        </div>
        {sim && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-800">{t("import.summary", { valid: sim.valid, total: sim.total })}</p>
            <ul className="max-h-72 space-y-1 overflow-auto text-sm">
              {sim.rows.map((r) => (
                <li key={r.line} className={`flex items-start gap-1 ${r.ok ? "text-stone-600" : "text-red-700"}`}>
                  {r.line}. {r.name} {r.ok ? <IconCheck className="mt-0.5 text-green-700" /> : `— ${r.errors.join(" ")}`}
                </li>
              ))}
            </ul>
          </div>
        )}
        {commit.data && (
          <AlertBanner tone="success" title={t("import.done", { count: commit.data.created })}>
            {""}
          </AlertBanner>
        )}
        {(simulate.isError || commit.isError) && (
          <AlertBanner tone="danger" title={t("common.error")}>
            {(simulate.error ?? commit.error) instanceof Error ? (simulate.error ?? commit.error)!.message : ""}
          </AlertBanner>
        )}
      </div>
    </Drawer>
  );
}
