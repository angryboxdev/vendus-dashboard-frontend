import { useMemo } from "react";
import { FIELD } from "../../../../../components/ui/index.ts";
import {
  compactIban,
  countryName,
  DIAL_CODES,
  formatIban,
  GENDERS,
  IBAN_DEFAULT_PREFIX,
  ibanStatus,
  joinPhone,
  nationalities,
  splitPhone,
  withCurrent,
} from "../../../domain/services/person-fields.service.ts";

/** Campos com controlo próprio; os restantes usam o `<input>` normal. */
export const SPECIAL_FIELDS = new Set(["iban", "phone", "gender", "nationality"]);

/**
 * Controlo de um campo especial da ficha: IBAN (PT50 sugerido, agrupado,
 * dígito de controlo), telefone com indicativo à escolha, género e
 * nacionalidade em lista. `value`/`onChange` trabalham com o valor a gravar.
 */
export function PersonFieldInput({ field, id, value, onChange, invalid = false }: { field: string; id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const countries = useMemo(() => nationalities(), []);
  const border = invalid ? "border-amber-400" : "";

  if (field === "iban") {
    const status = ibanStatus(value);
    return (
      <>
        <input
          id={id}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={`${IBAN_DEFAULT_PREFIX} 0000 0000 0000 0000 0000 0`}
          className={`${FIELD} w-full font-mono tracking-wide ${status === "invalid" ? "border-red-400" : border}`}
          value={formatIban(value)}
          // Vazio → já começa por PT50 (pode apagar-se e escrever outro país).
          onFocus={() => !value && onChange(IBAN_DEFAULT_PREFIX)}
          onBlur={() => compactIban(value) === IBAN_DEFAULT_PREFIX && onChange("")}
          onChange={(e) => onChange(compactIban(e.target.value).replace(/[^A-Z0-9]/g, "").slice(0, 34))}
          aria-invalid={status === "invalid" || undefined}
          aria-describedby={status ? `${id}-status` : undefined}
        />
        {status && (
          <p id={`${id}-status`} className={`mt-1 text-xs ${status === "valid" ? "text-emerald-700" : "text-red-700"}`}>
            {status === "valid" ? "IBAN válido." : "IBAN inválido — confirme os dígitos."}
          </p>
        )}
      </>
    );
  }

  if (field === "phone") {
    const { code, number } = splitPhone(value);
    const codes = DIAL_CODES.some((d) => d.code === code) ? DIAL_CODES : [{ country: "", code }, ...DIAL_CODES];
    return (
      <div className="flex gap-2">
        <select
          aria-label="Indicativo do país"
          className={`${FIELD} w-[7.5rem] shrink-0`}
          value={code}
          onChange={(e) => onChange(joinPhone(e.target.value, number))}
        >
          {codes.map((d) => (
            <option key={`${d.country}${d.code}`} value={d.code} title={d.country ? countryName(d.country) : undefined}>
              {d.country ? `${d.country} ${d.code}` : d.code}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          className={`${FIELD} min-w-0 flex-1 ${border}`}
          value={number}
          onChange={(e) => onChange(joinPhone(code, e.target.value))}
        />
      </div>
    );
  }

  const options = field === "gender" ? withCurrent(GENDERS, value) : withCurrent(countries, value);
  return (
    <select id={id} className={`${FIELD} w-full ${border}`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
