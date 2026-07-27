import {
  apiGet,
  apiPost,
  apiPatch,
  apiPatchNoContent,
  apiDeleteNoContent,
} from "../../../../lib/api.ts";
import type {
  BankAccountsApiPort,
  CreateBankAccountPayload,
  CreateBankPayload,
  UpdateBankAccountPayload,
  UpdateBankPayload,
} from "../../domain/ports/out/bank-accounts-api.port.ts";
import type {
  BankAccountDTO,
  BankDTO,
  BankDetailDTO,
  BankLogoKey,
  StatementFormat,
} from "../../domain/entities/bank-account.ts";

const BASE = "/api/bank-accounts";

export class HttpBankAccountsApiAdapter implements BankAccountsApiPort {
  async listLogoKeys(): Promise<BankLogoKey[]> {
    return apiGet(`${BASE}/logos`);
  }

  async listFormats(): Promise<StatementFormat[]> {
    return apiGet(`${BASE}/formats`);
  }

  async listBanks(): Promise<BankDTO[]> {
    return apiGet(`${BASE}/banks`);
  }

  async createBank(payload: CreateBankPayload): Promise<BankDTO> {
    return apiPost(`${BASE}/banks`, payload);
  }

  async getBank(bankId: string): Promise<BankDetailDTO> {
    return apiGet(`${BASE}/banks/${encodeURIComponent(bankId)}`);
  }

  async updateBank(bankId: string, payload: UpdateBankPayload): Promise<BankDTO> {
    return apiPatch(`${BASE}/banks/${encodeURIComponent(bankId)}`, payload);
  }

  async deleteBank(bankId: string): Promise<void> {
    await apiDeleteNoContent(`${BASE}/banks/${encodeURIComponent(bankId)}`);
  }

  async createAccount(bankId: string, payload: CreateBankAccountPayload): Promise<BankAccountDTO> {
    return apiPost(`${BASE}/banks/${encodeURIComponent(bankId)}/accounts`, payload);
  }

  async getAccount(accountId: string): Promise<BankAccountDTO> {
    return apiGet(`${BASE}/${encodeURIComponent(accountId)}`);
  }

  async updateAccount(accountId: string, payload: UpdateBankAccountPayload): Promise<BankAccountDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(accountId)}`, payload);
  }

  async deleteAccount(accountId: string): Promise<void> {
    await apiDeleteNoContent(`${BASE}/${encodeURIComponent(accountId)}`);
  }

  async linkStatement(statementId: string, bankAccountId: string): Promise<void> {
    await apiPatchNoContent(`/api/bank-statements/${encodeURIComponent(statementId)}/link-account`, {
      bankAccountId,
    });
  }
}
