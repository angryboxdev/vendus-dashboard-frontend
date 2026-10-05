import { createContext, useContext, type ReactNode } from "react";
import { HttpCalendarApiAdapter } from "./adapters/out/http-calendar-api.adapter.ts";
import { CalendarUseCases } from "./application/use-cases/calendar.use-cases.ts";

export interface CalendarModule {
  calendar: CalendarUseCases;
}

/** Composition root — único sítio que conhece o adapter concreto; nos testes passa-se outro `module`. */
function buildModule(): CalendarModule {
  return { calendar: new CalendarUseCases(new HttpCalendarApiAdapter()) };
}

const CalendarContext = createContext<CalendarModule | null>(null);

export function CalendarProvider({ children, module: mod }: { children: ReactNode; module?: CalendarModule }) {
  const value = mod ?? buildModule();
  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendarModule(): CalendarModule {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendarModule must be used inside CalendarProvider");
  return ctx;
}
