import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionNumber, MotionPresence, MotionProgress, MotionStagger, prefersReducedMotion, staggerDelay } from "./index.ts";

/** Simula um browser com animações (ou com "reduzir movimento"); o jsdom não tem `matchMedia`. */
function mockMatchMedia(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error — repõe o jsdom sem matchMedia
  delete window.matchMedia;
});

describe("UI Motion", () => {
  it("sem matchMedia (testes/browsers antigos) nada anima e o valor real aparece logo — teste 10", () => {
    expect(prefersReducedMotion()).toBe(true);
    render(<MotionNumber value={168} format={(n) => `${n}h`} />);
    expect(screen.getByText("168h")).toBeInTheDocument();
  });

  it("prefers-reduced-motion: valor final imediato, sem contagem — teste 7", () => {
    mockMatchMedia(true);
    render(<MotionNumber value={12} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("KPI anima de 0 até ao valor e termina sempre no valor real; depois parte do anterior — teste 2", () => {
    mockMatchMedia(false);
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "setTimeout"] });
    const { rerender } = render(<MotionNumber value={12} />);
    expect(screen.getByText("0")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(300));
    const mid = Number(screen.getByText(/^\d+$/).textContent);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(12);

    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByText("12")).toBeInTheDocument();

    rerender(<MotionNumber value={9} />);
    act(() => vi.advanceTimersByTime(50));
    const next = Number(screen.getByText(/^\d+$/).textContent);
    expect(next).toBeGreaterThanOrEqual(9);
    expect(next).toBeLessThanOrEqual(12); // parte de 12, não de 0
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("progresso expõe sempre o valor real (aria) e limita a 0–100", () => {
    render(<MotionProgress value={140} label="Dados do perfil" />);
    expect(screen.getByRole("progressbar", { name: "Dados do perfil" })).toHaveAttribute("aria-valuenow", "100");
  });

  it("stagger limitado: listas grandes nunca acumulam atraso — teste 4", () => {
    expect(staggerDelay(0)).toBe("0ms");
    expect(staggerDelay(3)).toBe("150ms");
    expect(staggerDelay(500)).toBe("350ms");
    render(
      <MotionStagger className="grid">
        <p>A</p>
        <p>B</p>
      </MotionStagger>,
    );
    expect(screen.getByText("B").parentElement).toHaveStyle({ animationDelay: "50ms" });
  });

  it("modal com animação fica montado só durante a saída (~180 ms) — teste 6", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    const { rerender } = render(
      <MotionPresence show>
        <div role="dialog">Modal</div>
      </MotionPresence>,
    );
    rerender(
      <MotionPresence show={false}>
        <div role="dialog">Modal</div>
      </MotionPresence>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sem animação o modal fecha de imediato", () => {
    const { rerender } = render(
      <MotionPresence show>
        <div role="dialog">Modal</div>
      </MotionPresence>,
    );
    rerender(
      <MotionPresence show={false}>
        <div role="dialog">Modal</div>
      </MotionPresence>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
