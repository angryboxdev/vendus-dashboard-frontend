import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { ClockWidget } from "./ClockWidget.tsx";

function renderWith(m: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <MemoryRouter>
          <ClockWidget />
        </MemoryRouter>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

const DAY = { workedSeconds: 3 * 3600 + 15 * 60, theoreticalSeconds: 8 * 3600 } as never;

describe("Ponto no cabeçalho (FE-003)", () => {
  it("estado e total de hoje do servidor; a ação seguinte com um toque e uma só marcação", async () => {
    const m = fakeNovoRhModule();
    m.myClock.status = vi.fn(async () => ({ employeeId: "e1", timeZone: "Europe/Lisbon", state: "off" as const, since: null, today: DAY, refusable: [] }));
    m.myClock.punch = vi.fn(async () => ({ event: {} as never, duplicate: false }));
    renderWith(m);
    const user = userEvent.setup();
    expect(await screen.findByText("Fora")).toBeInTheDocument();
    expect(screen.getByText(/hoje 3h ?15/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Trabalho" }));
    expect(m.myClock.punch).toHaveBeenCalledTimes(1);
    expect(m.myClock.punch).toHaveBeenCalledWith(expect.objectContaining({ segmentType: "work", clientEventId: expect.any(String) }));
    expect(screen.queryByRole("link", { name: "O meu ponto" })).not.toBeInTheDocument();
  });

  it("sem ficha ligada (erro do servidor), o widget não aparece", async () => {
    const m = fakeNovoRhModule();
    const status = vi.fn(async () => Promise.reject(new Error("sem ficha")));
    m.myClock.status = status;
    renderWith(m);
    await vi.waitFor(() => expect(status).toHaveBeenCalled());
    expect(screen.queryByRole("group", { name: "O meu ponto" })).not.toBeInTheDocument();
  });
});
