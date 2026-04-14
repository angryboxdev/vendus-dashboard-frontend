import "./styles/index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { DashboardStoreProvider } from "./pages/DashboardStoreContext";
import { DrePeriodProvider } from "./pages/dre/DrePeriodContext";
import { DreStoreProvider } from "./pages/dre/DreStoreContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DashboardStoreProvider>
        <DrePeriodProvider>
          <DreStoreProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </DreStoreProvider>
        </DrePeriodProvider>
      </DashboardStoreProvider>
    </QueryClientProvider>
  </StrictMode>,
);
