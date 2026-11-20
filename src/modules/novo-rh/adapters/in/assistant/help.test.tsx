import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { showsHelpButton } from "../../../domain/services/assistant.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { HelpButtonHost } from "./HelpButtonHost.tsx";

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function setup(path: string, over: (m: NovoRhModule) => void = () => {}) {
  const m = fakeNovoRhModule();
  over(m);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="*" element={<><HelpButtonHost /><Where /></>} />
          </Routes>
        </MemoryRouter>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
  return m;
}

describe("Ajuda do RH — regras", () => {
  it("aparece em todo o RH menos em Escalas (que tem o assistente da escala)", () => {
    expect(showsHelpButton("/hr/novo")).toBe(true);
    expect(showsHelpButton("/hr/novo/pessoas")).toBe(true);
    expect(showsHelpButton("/hr/novo/escalas")).toBe(false);
    expect(showsHelpButton("/hr/novo/escalas/abc")).toBe(false);
    expect(showsHelpButton("/hr/novo/escalasx")).toBe(true);
    expect(showsHelpButton("/financeiro")).toBe(false);
  });
});

describe("Ajuda do RH — bolinha e chat", () => {
  it("pergunta → resposta com atalho para o ecrã; o ecrã atual vai no pedido", async () => {
    const m = setup("/hr/novo", (x) => {
      x.assistant.help = vi.fn(async () => ({ status: "answer" as const, text: "1. Abra «Colaboradores».\n2. Clique em «Novo colaborador».", sources: [{ id: "criar-colaborador", title: "Criar um colaborador", path: "/hr/novo/pessoas" }] }));
    });
    await userEvent.click(await screen.findByRole("button", { name: "Assistente Mezza" }));
    expect(await screen.findByText("Ajuda do RH")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Como crio um colaborador novo/ }));
    expect(m.assistant.help).toHaveBeenCalledWith({ history: [], message: "Como crio um colaborador novo?", page: "/hr/novo" });
    expect(await screen.findByText(/Clique em «Novo colaborador»/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Abrir: Criar um colaborador/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/hr/novo/pessoas");
    expect(m.assistant.chat).not.toHaveBeenCalled();
  });

  it("sem acesso ou sem IA → a bolinha não aparece; em Escalas também não", async () => {
    const m = setup("/hr/novo/pessoas", (x) => {
      x.assistant.helpStatus = vi.fn(async () => {
        throw new Error("403");
      });
    });
    await waitFor(() => expect(m.assistant.helpStatus).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Assistente Mezza" })).toBeNull();
  });

  it("em Escalas não pede o estado da ajuda nem mostra a segunda bolinha", async () => {
    const m = setup("/hr/novo/escalas");
    await screen.findByTestId("where");
    expect(m.assistant.helpStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Assistente Mezza" })).toBeNull();
  });

  it("falha da IA → mensagem de indisponível (não rebenta)", async () => {
    setup("/hr/novo", (x) => {
      x.assistant.help = vi.fn(async () => {
        throw new TypeError("rede");
      });
    });
    await userEvent.click(await screen.findByRole("button", { name: "Assistente Mezza" }));
    await userEvent.type(await screen.findByLabelText("Pergunta para o Assistente Mezza"), "Como peço férias?{Enter}");
    expect(await screen.findByText(/temporariamente indisponível/)).toBeInTheDocument();
  });
});
