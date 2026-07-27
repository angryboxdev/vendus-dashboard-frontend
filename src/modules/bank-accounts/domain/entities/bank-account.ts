export type BankLogoKey =
  | "millennium_bcp"
  | "cgd"
  | "santander"
  | "bpi"
  | "novo_banco"
  | "banco_ctt"
  | "activobank"
  | "montepio"
  | "bankinter"
  | "eurobic"
  | "abanca"
  | "credito_agricola"
  | "bbva"
  | "ing"
  | "revolut"
  | "wise"
  | "other";

export const BANK_LOGO_KEYS: BankLogoKey[] = [
  "millennium_bcp",
  "cgd",
  "santander",
  "bpi",
  "novo_banco",
  "banco_ctt",
  "activobank",
  "montepio",
  "bankinter",
  "eurobic",
  "abanca",
  "credito_agricola",
  "bbva",
  "ing",
  "revolut",
  "wise",
  "other",
];

export const BANK_LOGO_LABELS: Record<BankLogoKey, string> = {
  millennium_bcp: "Millennium BCP",
  cgd: "Caixa Geral de Depósitos",
  santander: "Santander",
  bpi: "BPI",
  novo_banco: "Novo Banco",
  banco_ctt: "Banco CTT",
  activobank: "ActivoBank",
  montepio: "Montepio",
  bankinter: "Bankinter",
  eurobic: "EuroBic",
  abanca: "Abanca",
  credito_agricola: "Crédito Agrícola",
  bbva: "BBVA",
  ing: "ING",
  revolut: "Revolut",
  wise: "Wise",
  other: "Outro",
};

export const BANK_LOGO_ABBREVS: Record<BankLogoKey, string> = {
  millennium_bcp: "BCP",
  cgd: "CGD",
  santander: "SAN",
  bpi: "BPI",
  novo_banco: "NB",
  banco_ctt: "CTT",
  activobank: "ACT",
  montepio: "MPO",
  bankinter: "BKI",
  eurobic: "EUR",
  abanca: "ABA",
  credito_agricola: "CA",
  bbva: "BBV",
  ing: "ING",
  revolut: "REV",
  wise: "WSE",
  other: "?",
};

export type StatementFormat =
  | "millennium_bcp_csv"
  | "generic_xlsx"
  | "generic_csv"
  | "cgd_csv"
  | "bpi_csv"
  | "santander_csv";

export const STATEMENT_FORMAT_LABELS: Record<StatementFormat, string> = {
  millennium_bcp_csv: "Millennium BCP (CSV)",
  generic_xlsx: "Genérico (XLSX)",
  generic_csv: "Genérico (CSV)",
  cgd_csv: "CGD (CSV)",
  bpi_csv: "BPI (CSV)",
  santander_csv: "Santander (CSV)",
};

export type BankAccountType = "account" | "credit_card";
export type CheckingAccountType = "corrente" | "poupança" | "ordenado";

export interface AccountPreviewDTO {
  id: string;
  type: BankAccountType;
  label: string;
  isActive: boolean;
  nickname: string | null;
  accountNumber: string | null;
  iban: string | null;
  lastFourDigits: string | null;
  creditLimitCents: number | null;
  accountType: CheckingAccountType | null;
}

export interface BankDTO {
  id: string;
  name: string;
  logoKey: BankLogoKey;
  color: string;
  country: string;
  bic: string | null;
  statementFormat: StatementFormat;
  accountPreviews: AccountPreviewDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface BankAccountDTO {
  id: string;
  bankId: string;
  type: BankAccountType;
  nickname: string | null;
  iban: string | null;
  accountNumber: string | null;
  accountType: CheckingAccountType | null;
  lastFourDigits: string | null;
  cardName: string | null;
  creditLimitCents: number | null;
  billingCycleDay: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankDetailDTO {
  id: string;
  name: string;
  logoKey: BankLogoKey;
  color: string;
  country: string;
  bic: string | null;
  statementFormat: StatementFormat;
  accounts: BankAccountDTO[];
  createdAt: string;
  updatedAt: string;
}
