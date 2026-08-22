import { Outlet, useLocation } from "react-router-dom";

export function CrmLayout() {
  const location = useLocation();
  const customersTable = location.pathname === "/crm/customers";

  return (
    <div className="min-h-full bg-[#FAF6F3]">
      {!customersTable && <div className="border-b border-[#F5C992]/40 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold text-stone-900">CRM</h1>
        </div>
      </div>}
      <Outlet />
    </div>
  );
}
