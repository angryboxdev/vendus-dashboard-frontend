import { describe, expect, it } from "vitest";
import { SetEmployeeKioskPinUseCase } from "./set-employee-kiosk-pin.use-case.ts";
import { InvalidKioskPinError } from "../../domain/entities/kiosk-pin.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";

function makeFakeApi(fail?: Error) {
  const calls: Array<[string, string]> = [];
  const api = {
    setEmployeeKioskPin: async (id: string, pin: string) => {
      if (fail) throw fail;
      calls.push([id, pin]);
    },
  } as unknown as HrApiPort;
  return { api, calls };
}

describe("SetEmployeeKioskPinUseCase", () => {
  it("sends a valid 4-digit pin to the api", async () => {
    const { api, calls } = makeFakeApi();
    await new SetEmployeeKioskPinUseCase(api).execute("emp-1", "0123");
    expect(calls).toEqual([["emp-1", "0123"]]);
  });

  it.each(["", "123", "12345", "12a4", " 123"])("rejects invalid pin %j without calling the api", async (pin) => {
    const { api, calls } = makeFakeApi();
    await expect(new SetEmployeeKioskPinUseCase(api).execute("emp-1", pin)).rejects.toBeInstanceOf(InvalidKioskPinError);
    expect(calls).toHaveLength(0);
  });

  it("propagates api errors (e.g. pin already in use)", async () => {
    const { api } = makeFakeApi(new Error("Este PIN já está em uso por outro funcionário"));
    await expect(new SetEmployeeKioskPinUseCase(api).execute("emp-1", "1234")).rejects.toThrow("já está em uso");
  });
});
