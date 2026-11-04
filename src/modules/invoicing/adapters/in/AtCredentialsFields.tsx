import { FIELD, LABEL } from "../../../../components/ui/index.ts";
import type { AtCredentialsInput } from "../../domain/entities/invoicing.ts";

/** Utilizador (NIF/n.º) e senha de um subutilizador do Portal das Finanças. A senha nunca é guardada no browser. */
export function AtCredentialsFields({ value, onChange, hint }: { value: AtCredentialsInput; onChange: (v: AtCredentialsInput) => void; hint?: string }) {
  return (
    <>
      <label>
        <span className={LABEL}>Subutilizador (NIF/n.º)</span>
        <input
          className={FIELD}
          value={value.username}
          onChange={(e) => onChange({ ...value, username: e.target.value })}
          placeholder={hint ?? "Ex.: 599999999/1"}
          autoComplete="off"
          inputMode="numeric"
        />
      </label>
      <label>
        <span className={LABEL}>Senha</span>
        <input className={FIELD} type="password" value={value.password} onChange={(e) => onChange({ ...value, password: e.target.value })} autoComplete="new-password" />
      </label>
    </>
  );
}
