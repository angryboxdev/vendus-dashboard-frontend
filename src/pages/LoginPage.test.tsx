import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./LoginPage";

const signIn = vi.fn();
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ signIn }) }));

/** Simula um ecrã de desktop (o jsdom não tem `matchMedia`). */
function mockDesktop(matches: boolean) {
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia;
  return listeners;
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Aplicação</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  signIn.mockReset();
  // @ts-expect-error — repõe o jsdom sem matchMedia
  delete window.matchMedia;
});

describe("LoginPage com cenário decorativo", () => {
  it("o formulário aparece logo, sem esperar pelo cenário", () => {
    mockDesktop(true);
    renderLogin();
    expect(screen.getByLabelText("Email")).toBeEnabled();
    expect(screen.getByLabelText("Password")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("no desktop mostra os seis painéis, escondidos das tecnologias assistivas e sem nada focável", async () => {
    mockDesktop(true);
    const { container } = renderLogin();
    await waitFor(() => expect(container.querySelectorAll(".ls-panel")).toHaveLength(6));
    const root = container.querySelector(".ls-root")!;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.querySelectorAll("a, button, input, select, textarea, [tabindex]")).toHaveLength(0);
    // só há um botão acessível: o do formulário
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("clicar nos painéis não submete nem chama a autenticação", async () => {
    mockDesktop(true);
    const { container } = renderLogin();
    await waitFor(() => expect(container.querySelectorAll(".ls-panel")).toHaveLength(6));
    container.querySelectorAll(".ls-panel").forEach((p) => fireEvent.click(p));
    expect(signIn).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("em ecrãs pequenos não monta os painéis (nem pede as suas imagens)", async () => {
    mockDesktop(false);
    const { container } = renderLogin();
    await waitFor(() => expect(container.querySelector(".ls-bg--mobile")).toBeInTheDocument());
    expect(container.querySelectorAll(".ls-panel")).toHaveLength(0);
    expect(container.querySelectorAll("img[src*='dish-'], img[src*='ing-'], img[src*='rider']")).toHaveLength(0);
  });

  it("ao sair da rota remove o listener do media query", async () => {
    const listeners = mockDesktop(true);
    const { container, unmount } = renderLogin();
    await waitFor(() => expect(container.querySelectorAll(".ls-panel")).toHaveLength(6));
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it("submete com as credenciais e redireciona (comportamento inalterado)", async () => {
    mockDesktop(true);
    signIn.mockResolvedValue(undefined);
    renderLogin();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "teste@demo.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "segredo-ficticio" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(signIn).toHaveBeenCalledWith("teste@demo.invalid", "segredo-ficticio");
    expect(await screen.findByText("Aplicação")).toBeInTheDocument();
  });

  it("mostra o erro da autenticação", async () => {
    signIn.mockRejectedValue(new Error("Credenciais inválidas"));
    renderLogin();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "teste@demo.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "errada" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
  });
});
