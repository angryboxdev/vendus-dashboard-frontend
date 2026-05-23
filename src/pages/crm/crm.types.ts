export type CrmSegment =
  | "SEG-01"
  | "SEG-02"
  | "SEG-03"
  | "SEG-04"
  | "SEG-05"
  | "SEG-06"
  | "SEG-07"
  | "INATIVO";

export type CrmChannel = "WhatsApp" | "Email" | "SMS";
export type CrmOptIn = "Pendente" | "Sim" | "Não";
export type CrmHowFound =
  | "Instagram"
  | "TikTok"
  | "Passou"
  | "Indicação"
  | "Evento"
  | "Outro";
export type CrmSeg07Path = "A" | "B";

export type CrmCustomer = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  preferredChannel: CrmChannel;
  birthday: string | null;
  howFound: CrmHowFound | null;
  optIn: CrmOptIn;
  notes: string | null;
  inactive: boolean;
  referredBy: string | null;
  seg07Path: CrmSeg07Path | null;
  manualFollowupDate: string | null;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmNextFollowUp = {
  date: string;
  scriptCode: string;
  reason: string;
  isOverdue: boolean;
  daysUntil: number;
};

export type CrmCustomerEnriched = CrmCustomer & {
  segment: CrmSegment;
  orderCount: number;
  ltv: number;
  avgTicket: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
  tags: string[];
  nextFollowUp: CrmNextFollowUp | null;
};

export type CrmOrder = {
  id: string;
  customerId: string;
  orderDate: string;
  amount: number;
  channel: string | null;
  notes: string | null;
  createdAt: string;
};

export type CrmContact = {
  id: string;
  customerId: string;
  contactedAt: string;
  scriptCode: string | null;
  direction: "Enviado" | "Recebido";
  channel: CrmChannel;
  status: "Sem resposta" | "Respondeu" | "Recusou";
  response: string | null;
  notes: string | null;
  tagsAdded: string[];
  tagsRemoved: string[];
  createdAt: string;
};

export type CrmScriptVariant = {
  label: string;
  body: string;
};

export type CrmScript = {
  code: string;
  name: string;
  segment: string | null;
  body: string;
  variants: CrmScriptVariant[] | null;
  channel: string | null;
  triggerTiming: string | null;
  oneShot: boolean;
  cooldownDays: number | null;
  active: boolean;
};

export type CrmParameter = {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
};

export type BirthdayEntry = {
  customerId: string;
  name: string;
  birthday: string; // MM-DD
};

export type CrmDashboardData = {
  attention: {
    overdue: CrmCustomerEnriched[];
    today: CrmCustomerEnriched[];
    next3days: number;
    birthdays: BirthdayEntry[];
  };
  bySegment: Record<string, number>;
  contacts: {
    sentThisWeek: number;
    responseRate: number;
    prevResponseRate: number;
  };
};
