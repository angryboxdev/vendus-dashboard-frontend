import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MfaPort } from "../../domain/ports/out/mfa.port.ts";
import type { SettingsApiPort } from "../../domain/ports/out/settings-api.port.ts";
import { NovoRhProvider } from "../../novo-rh.module.tsx";
import { MfaGate } from "./MfaGate.tsx";

function renderGate(mfa: MfaPort) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={{ settings: {} as SettingsApiPort, mfa }}>
        <MfaGate>
          <p>conteúdo protegido</p>
        </MfaGate>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

describe("Novo RH — MFA (TK-3)", () => {
  it("sessão aal2 → mostra o conteúdo", async () => {
    renderGate({ status: vi.fn(async () => ({ level: "aal2" as const, factorId: "f1" })), enroll: vi.fn(), verify: vi.fn() });
    expect(await screen.findByText("conteúdo protegido")).toBeInTheDocument();
  });

  it("sem fator → ativar (QR) e confirmar o código; depois abre", async () => {
    let level: "aal1" | "aal2" = "aal1";
    const mfa: MfaPort = {
      status: vi.fn(async () => ({ level, factorId: level === "aal2" ? "f9" : null })),
      enroll: vi.fn(async () => ({ factorId: "f9", qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "ABCDEF" })),
      verify: vi.fn(async () => {
        level = "aal2";
      }),
    };
    renderGate(mfa);
    const user = userEvent.setup();
    expect(await screen.findByRole("heading", { name: "Ative a autenticação de dois fatores" })).toBeInTheDocument();
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ativar agora" }));
    expect(await screen.findByAltText("Código QR para a app autenticadora")).toBeInTheDocument();
    expect(screen.getByText("ABCDEF")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Código de 6 dígitos"), "12a3456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(mfa.verify).toHaveBeenCalledWith("f9", "123456");
    expect(await screen.findByText("conteúdo protegido")).toBeInTheDocument();
  });

  it("com fator mas sessão aal1 → pede o código; código errado mostra erro", async () => {
    renderGate({
      status: vi.fn(async () => ({ level: "aal1" as const, factorId: "f1" })),
      enroll: vi.fn(),
      verify: vi.fn(async () => {
        throw new Error("Invalid TOTP code");
      }),
    });
    const user = userEvent.setup();
    expect(await screen.findByRole("heading", { name: "Confirme que é você" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Código de 6 dígitos"), "000000");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Código inválido ou expirado. Tente o código atual da app.")).toBeInTheDocument();
  });
});
