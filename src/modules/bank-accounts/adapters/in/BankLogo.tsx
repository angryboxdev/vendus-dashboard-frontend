import { BANK_BRAND_COLORS, BANK_LOGO_ABBREVS, BANK_LOGO_MARKS, type BankLogoKey } from "../../domain/entities/bank-account.ts";

const SIZE = { sm: "h-8 w-8 rounded-lg text-[10px]", md: "h-11 w-11 rounded-xl text-xs", lg: "h-14 w-14 rounded-xl text-base" } as const;
const MARK = { sm: "h-5 w-5", md: "h-7 w-7", lg: "h-9 w-9" } as const;

/** Avatar do banco: marca oficial em branco sobre a cor do banco (Millennium, CGD) ou as iniciais. */
export function BankLogo({ logoKey, color, size = "md", name }: { logoKey: BankLogoKey; color: string; size?: keyof typeof SIZE; name?: string }) {
  const mark = BANK_LOGO_MARKS[logoKey];
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-bold text-white ${SIZE[size]}`}
      style={{ backgroundColor: BANK_BRAND_COLORS[logoKey] ?? color }}
      role={name ? "img" : undefined}
      aria-label={name}
    >
      {mark ? <img src={mark} alt="" className={`${MARK[size]} object-contain`} /> : BANK_LOGO_ABBREVS[logoKey]}
    </span>
  );
}
