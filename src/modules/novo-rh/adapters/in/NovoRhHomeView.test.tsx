import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../../../i18n/I18nProvider.tsx";
import { ROADMAP, roadmapProgress } from "../../domain/services/roadmap.service.ts";
import { NovoRhHomeView } from "./NovoRhHomeView.tsx";
import { NovoRhLayout } from "./NovoRhLayout.tsx";

const inLayout = (ui: ReactNode) => (
  <MemoryRouter initialEntries={["/hr/novo"]}>
    <NovoRhLayout>{ui}</NovoRhLayout>
  </MemoryRouter>
);

describe("Novo RH — entrada", () => {
  it("mostra o título, o aviso de área separada e as 10 fases", () => {
    render(inLayout(<NovoRhHomeView />));
    expect(screen.getByRole("heading", { level: 1, name: "Novo RH" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Área separada do RH atual");
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute("href", "/hr/novo/configuracoes");
    expect(screen.getByText("Preparação")).toBeInTheDocument();
    expect(screen.getByText("5 de 10 fases concluídas")).toBeInTheDocument();
  });

  it("modo Real ativo; Demonstração ainda indisponível", () => {
    render(inLayout(<NovoRhHomeView />));
    expect(screen.getByRole("radio", { name: "Real" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Demonstração" })).toHaveAttribute("aria-disabled", "true");
  });

  it("em es-ES usa o que já está traduzido e pt-PT no resto", () => {
    render(
      <I18nProvider locale="es-ES">{inLayout(<NovoRhHomeView />)}</I18nProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Nuevo RR. HH." })).toBeInTheDocument();
    expect(screen.getByText("Preparação")).toBeInTheDocument();
  });

  it("progresso: fase atual é a primeira em curso", () => {
    expect(roadmapProgress(ROADMAP).current?.number).toBe(5);
    expect(roadmapProgress([{ number: 0, status: "done" }, { number: 1, status: "planned" }])).toEqual({ done: 1, total: 2, current: { number: 1, status: "planned" } });
  });
});
