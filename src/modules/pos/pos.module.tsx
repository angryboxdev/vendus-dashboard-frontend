import { createContext, useContext, useState, type ReactNode } from "react";
import { CryptoPosIdGenerator, HttpPosApiAdapter } from "./adapters/out/http-pos-api.adapter.ts";
import { PosUseCases } from "./application/use-cases/pos.use-cases.ts";
import type { PosPort } from "./domain/ports/in/pos.port.ts";

export interface PosModule {
  pos: PosPort;
}

/** Composition root: único sítio que conhece os adapters concretos. */
function buildModule(): PosModule {
  return { pos: new PosUseCases(new HttpPosApiAdapter(), new CryptoPosIdGenerator()) };
}

const PosContext = createContext<PosModule | null>(null);

export function PosProvider({ children, module: mod }: { children: ReactNode; module?: PosModule }) {
  // Uma instância por montagem: os hooks dependem dela.
  const [built] = useState(() => mod ?? buildModule());
  return <PosContext.Provider value={built}>{children}</PosContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePosModule(): PosModule {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePosModule must be used inside PosProvider");
  return ctx;
}
