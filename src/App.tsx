import { Routes, Route } from "react-router-dom";

import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { DrePage } from "./pages/DrePage";

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dre" element={<DrePage />} />
        </Routes>
      </main>
    </div>
  );
}
