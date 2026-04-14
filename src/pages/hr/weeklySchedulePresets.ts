import type {
  HrEmploymentType,
  JobRole,
  WeeklySchedule,
} from "./hr.types";

/** Presets iniciais na criação do funcionário (editáveis depois na ficha). */
export function defaultWeeklyScheduleFor(
  jobRole: JobRole,
  employmentType: HrEmploymentType,
): WeeklySchedule | null {
  if (jobRole === "prep") {
    return {
      days: [0, 1, 2, 3, 4].map((weekday) => ({
        weekday,
        segments: [
          { startTime: "11:30", endTime: "15:30" },
          { startTime: "19:00", endTime: "23:00" },
        ],
      })),
    };
  }

  if (jobRole === "service" && employmentType === "extra") {
    return {
      days: [5, 6].map((weekday) => ({
        weekday,
        segments: [
          { startTime: "12:00", endTime: "15:00" },
          { startTime: "18:00", endTime: "23:00" },
        ],
      })),
    };
  }

  if (jobRole === "service") {
    return {
      days: [0, 1, 2, 3, 4].map((weekday) => ({
        weekday,
        segments: [
          { startTime: "12:00", endTime: "15:00" },
          { startTime: "18:00", endTime: "23:00" },
        ],
      })),
    };
  }

  if (jobRole === "manager") {
    return {
      days: [0, 1, 2, 3, 4].map((weekday) => ({
        weekday,
        segments: [{ startTime: "09:00", endTime: "18:00" }],
      })),
    };
  }

  return null;
}
