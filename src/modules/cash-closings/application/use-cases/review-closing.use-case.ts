import type { CashClosing } from "../../domain/entities/cash-closing.ts";
import type { ReviewClosingPort, ReviewClosingCommand } from "../../domain/ports/in/review-closing.port.ts";
import type { CashClosingApiPort } from "../../domain/ports/out/cash-closing-api.port.ts";

export class ReviewClosingUseCase implements ReviewClosingPort {
  private readonly api: CashClosingApiPort;
  constructor(api: CashClosingApiPort) {
    this.api = api;
  }

  async execute(command: ReviewClosingCommand): Promise<CashClosing> {
    const { id, ...patch } = command;
    return this.api.reviewClosing(id, patch);
  }
}
