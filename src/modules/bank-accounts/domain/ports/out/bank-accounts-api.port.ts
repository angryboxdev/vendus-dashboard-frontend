import type {
  BankAccountDTO,
  BankAccountType,
  BankDTO,
  BankDetailDTO,
  BankLogoKey,
  CheckingAccountType,
  StatementFormat,
} from "../../entities/bank-account.ts";

export interface CreateBankPayload {
  name: string;
  logoKey: BankLogoKey;
  color: string;
  country: string;
  bic?: string | null;
  statementFormat: StatementFormat;
}

export interface UpdateBankPayload {
  name?: string;
  logoKey?: BankLogoKey;
  color?: string;
  country?: string;
  bic?: string | null;
  statementFormat?: StatementFormat;
}

export interface CreateBankAccountPayload {
  type: BankAccountType;
  nickname?: string | null;
  iban?: string | null;
  accountNumber?: string | null;
  accountType?: CheckingAccountType | null;
  lastFourDigits?: string | null;
  cardName?: string | null;
  creditLimitCents?: number | null;
  billingCycleDay?: number | null;
}

export interface UpdateBankAccountPayload {
  nickname?: string | null;
  iban?: string | null;
  accountNumber?: string | null;
  accountType?: CheckingAccountType | null;
  lastFourDigits?: string | null;
  cardName?: string | null;
  creditLimitCents?: number | null;
  billingCycleDay?: number | null;
  isActive?: boolean;
}

export interface BankAccountsApiPort {
  listLogoKeys(): Promise<BankLogoKey[]>;
  listFormats(): Promise<StatementFormat[]>;
  listBanks(): Promise<BankDTO[]>;
  createBank(payload: CreateBankPayload): Promise<BankDTO>;
  getBank(bankId: string): Promise<BankDetailDTO>;
  updateBank(bankId: string, payload: UpdateBankPayload): Promise<BankDTO>;
  deleteBank(bankId: string): Promise<void>;
  createAccount(bankId: string, payload: CreateBankAccountPayload): Promise<BankAccountDTO>;
  getAccount(accountId: string): Promise<BankAccountDTO>;
  updateAccount(accountId: string, payload: UpdateBankAccountPayload): Promise<BankAccountDTO>;
  deleteAccount(accountId: string): Promise<void>;
  linkStatement(statementId: string, bankAccountId: string): Promise<void>;
}
