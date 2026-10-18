import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Archive,
  ArrowLeftRight,
  Building2,
  CalendarDays,
  CalendarOff,
  ChartColumn,
  ChartPie,
  CircleAlert,
  Clock,
  Columns3,
  Download,
  FileText,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  Mail,
  MapPinOff,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  Receipt,
  Store,
  Upload,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Ícones Lucide (ISC; ver THIRD_PARTY_NOTICES.md) — único ponto de entrada da
 * aplicação: nunca importar de `lucide-react` diretamente. Mesmo estilo do kit
 * (`icons.tsx`): traço 1.75, `currentColor`, 20 px por omissão (18–22),
 * decorativos (`aria-hidden`) — o texto ao lado ou o `aria-label` do botão diz
 * o que fazem. Só os ícones em uso entram no bundle.
 */
export type AppIconProps = Omit<LucideProps, "ref"> & { size?: number };

function wrap(Icon: LucideIcon) {
  const C = ({ size = 20, strokeWidth = 1.75, ...rest }: AppIconProps) => <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...rest} />;
  return C;
}

/** Catálogo por chave (a sidebar guarda só a chave no domínio, sem React). */
export const APP_ICONS = {
  profitability: wrap(ChartPie),
  stock: wrap(Package),
  people: wrap(Users),
  crm: wrap(HeartHandshake),
  financial: wrap(Wallet),
  cashClosings: wrap(Receipt),
  airMenu: wrap(QrCode),
  vendus: wrap(Store),
  company: wrap(Building2),
  users: wrap(UserCog),
  deviceTokens: wrap(KeyRound),
  overview: wrap(LayoutDashboard),
  rosters: wrap(CalendarDays),
  attendance: wrap(Clock),
  absences: wrap(CalendarOff),
  documents: wrap(FileText),
  legacy: wrap(Archive),
  transfers: wrap(ArrowLeftRight),
  reports: wrap(ChartColumn),
  personAdd: wrap(UserPlus),
  invite: wrap(Mail),
  download: wrap(Download),
  upload: wrap(Upload),
  columns: wrap(Columns3),
  incomplete: wrap(CircleAlert),
  noLocation: wrap(MapPinOff),
  collapse: wrap(PanelLeftClose),
  expand: wrap(PanelLeftOpen),
  logout: wrap(LogOut),
} as const;

export type AppIconKey = keyof typeof APP_ICONS;

export function AppIcon({ name, ...props }: AppIconProps & { name: AppIconKey }) {
  const C = APP_ICONS[name];
  return <C {...props} />;
}
