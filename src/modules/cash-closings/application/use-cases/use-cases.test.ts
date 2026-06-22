import { describe, expect, it } from "vitest";
import type { CashClosingApiPort, ListClosingsParams, ReviewPatch } from "../../domain/ports/out/cash-closing-api.port.ts";
import type { CashClosing } from "../../domain/entities/cash-closing.ts";
import { ListClosingsUseCase } from "./list-closings.use-case.ts";
import { ReviewClosingUseCase } from "./review-closing.use-case.ts";

function makeClosing(overrides: Partial<CashClosing> = {}): CashClosing {
  return {
    id: "closing-1",
    closingDate: "2026-06-15",
    employeeId: "emp-1",
    employeeName: "Ana",
    tpa: 0,
    uber: 0,
    glovo: 0,
    bolt: 0,
    eatz: 0,
    cashSales: 0,
    cashIn: 0,
    cashOut: 0,
    cashDrawerOpen: 0,
    cashDrawerTotal: 0,
    totalCalculated: 0,
    vendusTotal: null,
    sangriaAmount: 0,
    notes: null,
    status: "pending",
    managerNotes: null,
    reviewedAt: null,
    submittedAt: "2026-06-15T23:00:00Z",
    ...overrides,
  };
}

class FakeCashClosingApi implements CashClosingApiPort {
  lastListParams: ListClosingsParams | null = null;
  lastReviewId: string | null = null;
  lastReviewPatch: ReviewPatch | null = null;

  private closings: CashClosing[] = [];

  seed(closings: CashClosing[]) {
    this.closings = closings;
  }

  async listClosings(params: ListClosingsParams) {
    this.lastListParams = params;
    return { closings: this.closings, total: this.closings.length };
  }

  async getClosing(id: string) {
    return this.closings.find((c) => c.id === id) ?? makeClosing({ id });
  }

  async reviewClosing(id: string, patch: ReviewPatch) {
    this.lastReviewId = id;
    this.lastReviewPatch = patch;
    return makeClosing({ id, ...patch });
  }

  async verifyPin(_pin: string) {
    return { employeeId: "emp-1", fullName: "Ana" };
  }

  async getVendusTotal(_date: string) {
    return 0;
  }

  async submitClosing() {
    return makeClosing();
  }
}

describe("ListClosingsUseCase", () => {
  it("delegates to api.listClosings with the given query", async () => {
    const api = new FakeCashClosingApi();
    api.seed([makeClosing({ id: "c1" }), makeClosing({ id: "c2" })]);
    const useCase = new ListClosingsUseCase(api);

    const result = await useCase.execute({ from: "2026-06-01", to: "2026-06-30" });

    expect(result.closings).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(api.lastListParams).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });

  it("returns empty list when no closings exist", async () => {
    const api = new FakeCashClosingApi();
    const useCase = new ListClosingsUseCase(api);
    const result = await useCase.execute({});
    expect(result.closings).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe("ReviewClosingUseCase", () => {
  it("passes id and patch correctly to api.reviewClosing", async () => {
    const api = new FakeCashClosingApi();
    const useCase = new ReviewClosingUseCase(api);

    await useCase.execute({ id: "closing-99", status: "approved", managerNotes: "OK" });

    expect(api.lastReviewId).toBe("closing-99");
    expect(api.lastReviewPatch).toEqual({ status: "approved", managerNotes: "OK" });
  });

  it("id is NOT present in the patch passed to the api", async () => {
    const api = new FakeCashClosingApi();
    const useCase = new ReviewClosingUseCase(api);

    await useCase.execute({ id: "closing-99", status: "rejected" });

    expect(api.lastReviewPatch).not.toHaveProperty("id");
  });

  it("returns the updated closing from the api", async () => {
    const api = new FakeCashClosingApi();
    const useCase = new ReviewClosingUseCase(api);

    const result = await useCase.execute({ id: "closing-99", status: "approved" });
    expect(result.status).toBe("approved");
  });
});
