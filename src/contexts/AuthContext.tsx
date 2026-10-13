import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { apiGet } from "../lib/api";

/** `employee` = conta só do Portal do Colaborador (sem acesso à área de gestão). */
export type OrgRole = "admin" | "manager" | "hr_viewer" | "employee";

export interface AuthUser {
  id: string;
  email: string;
  role: OrgRole;
  /** The user's organization, from the `org_id` claim. Null until the token hook migration ships. */
  organizationId: string | null;
  /** Conta criada com palavra-passe temporária (Portal do Colaborador) — tem de a mudar antes de continuar. */
  mustChangePassword: boolean;
  /**
   * Acesso efetivo (Utilizadores & Perfis 2.0, `GET /api/me/access`) — só
   * adapta menus e ecrãs; o backend decide cada pedido. null enquanto não
   * carregou (ou se falhou): a UI comporta-se como antes.
   */
  access: UserAccess | null;
}

export interface UserAccess {
  isAdmin: boolean;
  portalOnly: boolean;
  permissions: Record<string, "NONE" | "READ" | "MANAGE">;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** true while the initial session is being resolved */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Muda a palavra-passe da conta autenticada e limpa o aviso de palavra-passe temporária. */
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface TokenClaims {
  /** Post-migration shape: a role scoped to org_id. */
  org_role?: OrgRole;
  /** Pre-migration shape. Fallback only — remove once the hook migration has shipped. */
  app_role?: OrgRole;
  org_id?: string;
}

function decodeClaims(session: Session | null): TokenClaims | null {
  if (!session) return null;
  try {
    const parts = session.access_token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(
      atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as TokenClaims;
  } catch {
    return null;
  }
}

function parseRole(session: Session | null): OrgRole | null {
  const claims = decodeClaims(session);
  // The custom_access_token_hook injects org_role into the JWT payload; app_role
  // is what pre-migration tokens carry, and is read here only as a fallback.
  return claims?.org_role ?? claims?.app_role ?? null;
}

function sessionToUser(session: Session | null): AuthUser | null {
  if (!session) return null;
  const role = parseRole(session);
  if (!role) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role,
    organizationId: decodeClaims(session)?.org_id ?? null,
    mustChangePassword: session.user.user_metadata?.must_change_password === true,
    access: null,
  };
}

/**
 * Chama `onIdle` depois de `ms` sem atividade (rato, teclado, toque, scroll).
 * Devolve a função que desliga o temporizador.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function startIdleTimer(ms: number, onIdle: () => void, target: Pick<Window, "addEventListener" | "removeEventListener"> = window): () => void {
  const events = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"] as const;
  let timer = setTimeout(onIdle, ms);
  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(onIdle, ms);
  };
  for (const e of events) target.addEventListener(e, reset, { passive: true });
  return () => {
    clearTimeout(timer);
    for (const e of events) target.removeEventListener(e, reset);
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Guardado com o dono, para nunca mostrar o acesso de uma sessão anterior.
  const [accessState, setAccessState] = useState<{ userId: string; access: UserAccess } | null>(null);
  const userId = user?.id ?? null;

  // Acesso efetivo: carrega com a sessão e volta a carregar quando a app volta a ter foco (revogações).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = () =>
      apiGet<UserAccess>("/api/me/access")
        .then((a) => !cancelled && setAccessState({ userId, access: { isAdmin: a.isAdmin, portalOnly: a.portalOnly, permissions: a.permissions } }))
        .catch(() => undefined);
    void load();
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  // Fim de sessão por inatividade (Novo RH, configuração security.session.inactivity_minutes).
  // Só área de gestão: no Portal o colaborador pica o ponto e não deve ter de entrar sempre de novo.
  const portalOnly = accessState?.userId === userId ? accessState.access.portalOnly : true;
  useEffect(() => {
    if (!userId || portalOnly) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    apiGet<{ inactivityMinutes: number }>("/api/me/session-policy")
      .catch(() => ({ inactivityMinutes: 30 }))
      .then(({ inactivityMinutes }) => {
        if (cancelled) return;
        stop = startIdleTimer(Math.max(5, inactivityMinutes) * 60_000, () => void supabase.auth.signOut());
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [userId, portalOnly]);

  useEffect(() => {
    // Resolve initial session synchronously if cached, then listen for changes
    supabase.auth.getSession().then(({ data }) => {
      setUser(sessionToUser(data.session));
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(sessionToUser(session));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Mesmo objeto entre renders enquanto nada muda (há providers que recarregam quando `user` muda de identidade).
  const userWithAccess = useMemo(
    () => (user ? { ...user, access: accessState?.userId === user.id ? accessState.access : null } : null),
    [user, accessState],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword, data: { must_change_password: false } });
    if (error) throw new Error(error.message);
  }, []);

  return (
    <AuthContext.Provider value={{ user: userWithAccess, loading, signIn, signOut, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Como `useAuth`, mas devolve null fora do AuthProvider (ecrãs que também correm isolados, ex.: testes). */
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
