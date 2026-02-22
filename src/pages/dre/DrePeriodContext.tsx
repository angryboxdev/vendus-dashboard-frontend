import { createContext, useCallback, useContext, useState } from "react";

export type DrePeriod = {
  year: number;
  month: number;
};

const DEFAULT_PERIOD: DrePeriod = (() => {
  const now = new Date();
  const currentMonth1Based = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  if (currentMonth1Based === 1) {
    return { year: currentYear - 1, month: 12 };
  }
  return { year: currentYear, month: currentMonth1Based - 1 };
})();

type DrePeriodContextValue = {
  period: DrePeriod;
  setPeriod: (next: DrePeriod) => void;
  setYear: (year: number) => void;
  setMonth: (month: number) => void;
};

const DrePeriodContext = createContext<DrePeriodContextValue | null>(null);

export function DrePeriodProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriodState] = useState<DrePeriod>(DEFAULT_PERIOD);

  const setPeriod = useCallback((next: DrePeriod) => {
    setPeriodState(next);
  }, []);

  const setYear = useCallback((year: number) => {
    setPeriodState((p) => ({ ...p, year }));
  }, []);

  const setMonth = useCallback((month: number) => {
    setPeriodState((p) => ({ ...p, month }));
  }, []);

  const value: DrePeriodContextValue = {
    period,
    setPeriod,
    setYear,
    setMonth,
  };

  return (
    <DrePeriodContext.Provider value={value}>
      {children}
    </DrePeriodContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDrePeriod(): DrePeriodContextValue {
  const ctx = useContext(DrePeriodContext);
  if (!ctx) {
    throw new Error("useDrePeriod must be used within DrePeriodProvider");
  }
  return ctx;
}
