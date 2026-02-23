import "./styles/index.css";

import App from "./App.tsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { DashboardStoreProvider } from "./pages/DashboardStoreContext";
import { DrePeriodProvider } from "./pages/dre/DrePeriodContext";
import { DreStoreProvider } from "./pages/dre/DreStoreContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DashboardStoreProvider>
      <DrePeriodProvider>
        <DreStoreProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </DreStoreProvider>
      </DrePeriodProvider>
    </DashboardStoreProvider>
  </StrictMode>
);
