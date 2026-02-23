import { DrePeriodProvider } from "./DrePeriodContext";
import { DreStoreProvider } from "./DreStoreContext";
import { DrePeriodSelector } from "./DrePeriodSelector";
import { Outlet } from "react-router-dom";

export function DreLayout() {
  return (
    <DrePeriodProvider>
      <DreStoreProvider>
        <div className="min-h-full bg-slate-50">
          <DrePeriodSelector />
          <Outlet />
        </div>
      </DreStoreProvider>
    </DrePeriodProvider>
  );
}
