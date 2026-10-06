import { describe, expect, it } from "vitest";
import {
  emptyShiftTemplateForm,
  endsNextDayFor,
  formatMinutes,
  formWorkMinutes,
  templateDurationLabel,
  templateTimeLabel,
  toShiftTemplatePayload,
} from "./shift-template.service.ts";

describe("shift-template.service (RH 2.0)", () => {
  it("formata durações e horários", () => {
    expect(formatMinutes(480)).toBe("8h");
    expect(formatMinutes(450)).toBe("7h 30min");
    expect(formatMinutes(30)).toBe("30min");
    expect(templateTimeLabel({ startTime: "12:00", endTime: "16:00", secondStartTime: "18:00", secondEndTime: "23:00" })).toBe("12:00 – 16:00 · 18:00 – 23:00");
    expect(templateDurationLabel({ kind: "split", workMinutes: 540, spanMinutes: 660 })).toBe("11h (9h trabalho)");
  });

  it("turno direto com fim antes do início termina no dia seguinte", () => {
    expect(endsNextDayFor("16:00", "00:00")).toBe(true);
    expect(endsNextDayFor("08:00", "16:00")).toBe(false);
    const result = toShiftTemplatePayload({ ...emptyShiftTemplateForm(), name: "Noite", startTime: "16:00", endTime: "00:00" });
    expect(result).toMatchObject({ payload: { endsNextDay: true, secondStartTime: null } });
    expect(formWorkMinutes({ ...emptyShiftTemplateForm(), startTime: "16:00", endTime: "00:00" })).toBe(480);
  });

  it("valida o repartido como o backend", () => {
    const base = { ...emptyShiftTemplateForm(), name: "Repartido", kind: "split" as const, startTime: "12:00", endTime: "16:00" };
    expect(toShiftTemplatePayload({ ...base, secondStartTime: "15:00", secondEndTime: "18:00" })).toEqual({ error: "O 2.º período não pode sobrepor o 1.º." });
    expect(toShiftTemplatePayload({ ...base, secondStartTime: "18:00", secondEndTime: "23:00" })).toMatchObject({
      payload: { endsNextDay: false, secondStartTime: "18:00", secondEndTime: "23:00" },
    });
    expect(toShiftTemplatePayload({ ...base, name: " " })).toEqual({ error: "Indique o nome do modelo." });
  });
});
