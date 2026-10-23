import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Cenário decorativo num chunk à parte: o formulário não espera por ele.
const LoginScene = lazy(() => import("./login/LoginScene"));

/** Se o cenário falhar (chunk ou imagens), fica o fundo simples e o login funciona. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar sessão");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-line bg-surface-card px-3.5 py-2.5 text-sm text-ink outline-none transition-colors hover:border-navy-800/30 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15";

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-brand-50 bg-[radial-gradient(ellipse_at_center,rgb(var(--surface-card))_0%,rgb(var(--brand-50))_55%,rgb(var(--brand-100))_100%)] px-4 py-8">
      <SceneBoundary>
        <Suspense fallback={null}>
          <LoginScene />
        </Suspense>
      </SceneBoundary>

      <div className="relative z-10 w-full max-w-[360px] rounded-2.5xl bg-surface-card/95 p-8 shadow-pop ring-1 ring-white/70">
        <div className="inline-flex rounded-xl bg-navy-900 px-3 py-2">
          <img src="/mezza-erp.png" alt="Mezza ERP" width={80} height={18} className="h-[18px] w-auto" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-navy-950">Angry Box Hub</h1>
        <p className="mt-1 text-sm text-ink-secondary">Iniciar sessão</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "A entrar…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
