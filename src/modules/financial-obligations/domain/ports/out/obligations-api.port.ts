import type {
  FinancialObligationDTO,
  CreateManualObligationPayload,
  MarkObligationAsPaidPayload,
  ListObligationsParams,
} from "../../entities/financial-obligation.ts";

export interface ObligationsApiPort {
  listObligations(params?: ListObligationsParams): Promise<FinancialObligationDTO[]>;
  createManualObligation(payload: CreateManualObligationPayload): Promise<FinancialObligationDTO>;
  markAsPaid(id: string, payload: MarkObligationAsPaidPayload): Promise<FinancialObligationDTO>;
}
