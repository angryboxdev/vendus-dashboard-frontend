import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "../../contexts/AuthContext.tsx";
import { ReactAuthAdapter } from "./adapters/out/react-auth.adapter.ts";
import { GetNavStateUseCase } from "./application/use-cases/get-nav-state.use-case.ts";
import { SignOutUseCase } from "./application/use-cases/sign-out.use-case.ts";
import type { GetNavStatePort } from "./domain/ports/in/get-nav-state.port.ts";
import type { SignOutPort } from "./domain/ports/in/sign-out.port.ts";

export interface SidebarModule {
  getNavState: GetNavStatePort;
  signOut: SignOutPort;
}

const SidebarContext = createContext<SidebarModule | null>(null);

/**
 * Composition root: wires the ReactAuthAdapter into the use cases.
 * The adapter uses a ref so the module instance is stable across renders
 * while always reading the latest auth values.
 */
export function SidebarProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  /** Override the module (useful for tests). */
  module?: SidebarModule;
}) {
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;

  const module = useMemo<SidebarModule>(() => {
    if (mod) return mod;
    const adapter = new ReactAuthAdapter(
      () => authRef.current.user,
      () => authRef.current.signOut(),
    );
    return {
      getNavState: new GetNavStateUseCase(adapter),
      signOut: new SignOutUseCase(adapter),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod]);

  return (
    <SidebarContext.Provider value={module}>{children}</SidebarContext.Provider>
  );
}

export function useSidebarModule(): SidebarModule {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebarModule must be used inside SidebarProvider");
  return ctx;
}
