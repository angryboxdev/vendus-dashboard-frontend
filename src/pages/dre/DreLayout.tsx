import { Outlet } from "react-router-dom";

export function DreLayout() {
  return (
    <div className="min-h-full bg-slate-50">
      <Outlet />
    </div>
  );
}
