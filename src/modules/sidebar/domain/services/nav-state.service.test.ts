import { describe, expect, it } from "vitest";
import {
  buildTree,
  isItemActive,
  resolveActiveGroup,
} from "./nav-state.service.ts";

describe("buildTree", () => {
  it("returns 10 entries for a non-admin user", () => {
    const tree = buildTree({ email: "a@b.com", role: "manager" });
    expect(tree).toHaveLength(10);
  });

  it("returns 12 entries for admin (includes Utilizadores + Tokens de dispositivo)", () => {
    const tree = buildTree({ email: "a@b.com", role: "admin" });
    expect(tree).toHaveLength(12);
    const last = tree[tree.length - 1];
    expect(last?.kind).toBe("item");
    expect(last?.kind === "item" && last.path).toBe("/admin/location-tokens");
  });

  it("admin entries are not present for non-admin roles", () => {
    for (const role of ["manager", "hr_viewer"]) {
      const tree = buildTree({ email: "a@b.com", role });
      const hasAdmin = tree.some(
        (e) => e.kind === "item" && (e.path === "/admin/users" || e.path === "/admin/location-tokens"),
      );
      expect(hasAdmin).toBe(false);
    }
  });
});

describe("resolveActiveGroup", () => {
  const tree = buildTree({ email: "a@b.com", role: "manager" });

  it.each([
    ["/dre/demonstrativo", "dre"],
    ["/dre/receita-bruta", "dre"],
    ["/stock/movimentacoes", "stock"],
    ["/hr", "hr"],
    ["/hr/calendar", "hr"],
    ["/crm", "crm"],
    ["/crm/customers", "crm"],
    ["/financial/cost-centers", "financial"],
    ["/financial/suppliers", "financial"],
    ["/financial/invoices", "financial"],
    ["/financial/payable-entries", "financial"],
  ])("path %s → group %s", (path, expected) => {
    expect(resolveActiveGroup(tree, path)).toBe(expected);
  });

  it.each(["/", "/analytics", "/cash-closings", "/admin/users"])(
    "top-level path %s → null",
    (path) => {
      expect(resolveActiveGroup(tree, path)).toBeNull();
    },
  );
});

describe("isItemActive", () => {
  it("matches exact path when end=true", () => {
    expect(isItemActive("/", "/", true)).toBe(true);
    expect(isItemActive("/", "/analytics", true)).toBe(false);
  });

  it("matches exact path or sub-path when end=false", () => {
    expect(isItemActive("/analytics", "/analytics")).toBe(true);
    expect(isItemActive("/analytics", "/analytics/sub")).toBe(true);
  });

  it("does not match partial prefix", () => {
    expect(isItemActive("/analytics", "/analytics-new")).toBe(false);
  });

  it("dashboard with end=true does not match sub-paths", () => {
    expect(isItemActive("/", "/analytics", true)).toBe(false);
  });
});
