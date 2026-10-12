import { afterEach, describe, expect, it, vi } from "vitest";
import { startIdleTimer } from "./AuthContext.tsx";

describe("fim de sessão por inatividade", () => {
  afterEach(() => vi.useRealTimers());

  it("chama onIdle só depois do tempo sem atividade; atividade reinicia a contagem", () => {
    vi.useFakeTimers();
    const target = new EventTarget() as unknown as Window;
    const onIdle = vi.fn();
    const stop = startIdleTimer(1000, onIdle, target);
    vi.advanceTimersByTime(900);
    target.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(900);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onIdle).toHaveBeenCalledTimes(1);
    stop();
    vi.advanceTimersByTime(5000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});
