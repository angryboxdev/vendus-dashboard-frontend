import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type AppRole = "admin" | "manager" | "hr_viewer";

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** true while the initial session is being resolved */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseRole(session: Session | null): AppRole | null {
  if (!session) return null;
  // The custom_access_token_hook injects app_role into the JWT payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (session.access_token as any)
    ? (() => {
        try {
          const parts = session.access_token.split(".");
          if (parts.length !== 3) return null;
          return JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as {
            app_role?: AppRole;
          };
        } catch {
          return null;
        }
      })()
    : null;
  return payload?.app_role ?? null;
}

function sessionToUser(session: Session | null): AuthUser | null {
  if (!session) return null;
  const role = parseRole(session);
  if (!role) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role,
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

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
