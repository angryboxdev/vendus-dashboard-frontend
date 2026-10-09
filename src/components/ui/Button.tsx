import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonClass, type ButtonVariant } from "./ui-classes.ts";

/**
 * Botões do Mezza ERP. Primário = gradiente laranja da marca (decisão
 * 2026-10-08) — um por zona de ação; secundário = branco com borda;
 * terciário = texto; perigo = só para ações destrutivas.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md"; icon?: ReactNode }) {
  return (
    <button type={type} className={`${buttonClass(variant, size)} ${className}`.trim()} {...rest}>
      {icon}
      {children}
    </button>
  );
}
