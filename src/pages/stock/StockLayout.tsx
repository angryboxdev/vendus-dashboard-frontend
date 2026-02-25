import { Outlet } from "react-router-dom";

export function StockLayout() {
  return (
    <div className="min-h-full bg-slate-50">
      <Outlet />
    </div>
  );
}
