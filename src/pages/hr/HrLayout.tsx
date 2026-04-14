import { Outlet } from "react-router-dom";

export function HrLayout() {
  return (
    <div className="min-h-full bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Gestão de funcionários
          </h1>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
