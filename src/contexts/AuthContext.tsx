import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

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
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

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
    <AuthContext.Provider value={{ user, loading, signIn, signOut, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
