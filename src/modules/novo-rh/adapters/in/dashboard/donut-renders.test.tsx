import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TeamCounts } from "../../../domain/entities/dashboard.ts";
import * as service from "../../../domain/services/dashboard.service.ts";
import { TeamStatusDonut } from "./TeamStatusDonut.tsx";

// Cada desenho real do donut calcula os arcos uma vez: contar chamadas = contar renders.
vi.mock("../../../domain/services/dashboard.service.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../domain/services/dashboard.service.ts")>();
  return { ...real, donutSegments: vi.fn(real.donutSegments) };
});

const TEAM: TeamCounts = { total: 10, working: 5, remote: 1, break: 1, finished: 1, not_started: 1, vacation: 1, absent: 0, late: 0, missing: 0 };
const noop = () => {};

describe("TeamStatusDonut — renders (perf)", () => {
  it("o pai volta a desenhar com os mesmos números → o donut não", () => {
    const calls = () => vi.mocked(service.donutSegments).mock.calls.length;
    const tree = (team: TeamCounts, tick: number) => (
      <div data-tick={tick}>
        <TeamStatusDonut team={team} onSelect={noop} />
      </div>
    );
    const { rerender } = render(tree(TEAM, 0));
    const first = calls();
    rerender(tree(TEAM, 1));
    rerender(tree(TEAM, 2));
    expect(calls()).toBe(first);
    rerender(tree({ ...TEAM, working: 6, total: 11 }, 3));
    expect(calls()).toBeGreaterThan(first);
  });
});
