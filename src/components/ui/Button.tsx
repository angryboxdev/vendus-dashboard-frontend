import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonClass, iconButtonClass, type ButtonVariant } from "./ui-classes.ts";

/** Indicador de carregamento discreto dentro de um botão. */
function Spinner() {
  return <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

/**
 * Botões do Mezza ERP. Primário = cobre preenchido — um dominante por zona
 * de ação; secundário = contorno navy; terciário = texto; perigo = só para
 * ações destrutivas. `loading` desativa o botão e anuncia `aria-busy`.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md"; icon?: ReactNode; loading?: boolean }) {
  return (
    <button type={type} className={`${buttonClass(variant, size)} ${className}`.trim()} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

/** Botão só com ícone — `aria-label` obrigatório (o ícone é decorativo). */
export function IconButton({
  label,
  size = "md",
  className = "",
  type = "button",
  children,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string; size?: "sm" | "md"; children: ReactNode }) {
  return (
    <button type={type} aria-label={label} title={label} className={`${iconButtonClass(size)} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
