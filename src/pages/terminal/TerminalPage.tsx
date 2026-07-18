import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const APPS = [
  {
    to: "/kiosk",
    label: "Registo de Ponto",
    description: "Entrada e saída de turno",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-14 w-14">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
    color: "from-indigo-600 to-indigo-700",
    shadow: "shadow-indigo-900/50",
  },
  {
    to: "/fecho",
    label: "Fecho de Caixa",
    description: "Registo diário de vendas",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-14 w-14">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
    color: "from-emerald-600 to-emerald-700",
    shadow: "shadow-emerald-900/50",
  },
  {
    to: "/kds",
    label: "KDS Cozinha",
    description: "Ecrã de pedidos em tempo real",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-14 w-14">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-1.5-.75m0-5.25a3.354 3.354 0 0 0 1.5.75 3.354 3.354 0 0 1 3 0 3.354 3.354 0 0 0 3 0 3.354 3.354 0 0 1 3 0 3.354 3.354 0 0 0 3 0 3.354 3.354 0 0 1 1.5-.75M12 12.75h.008v.008H12v-.008Z" />
      </svg>
    ),
    color: "from-orange-500 to-red-600",
    shadow: "shadow-orange-900/50",
  },
  {
    to: "/print-orders",
    label: "Pedidos de Cozinha",
    description: "Impressão de pedidos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-14 w-14">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-6 0h.008v.008H12V10.5Zm-3.75 0h.008v.008H8.25V10.5Z" />
      </svg>
    ),
    color: "from-amber-600 to-amber-700",
    shadow: "shadow-amber-900/50",
  },
] as const;

export function TerminalPage() {
  const navigate = useNavigate();
  useEffect(() => { document.title = "Angry Box"; }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-12 text-center">
          <p className="text-3xl font-bold tracking-tight text-white">Angry Box</p>
          <p className="mt-2 text-slate-400">Seleciona uma aplicação</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {APPS.map((app) => (
            <button
              key={app.to}
              type="button"
              onClick={() => navigate(app.to)}
              className={`flex flex-col items-center gap-5 rounded-3xl bg-gradient-to-b ${app.color} px-6 py-10 text-white shadow-2xl ${app.shadow} transition-transform active:scale-95 hover:brightness-110`}
            >
              {app.icon}
              <div className="text-center">
                <p className="text-lg font-bold leading-tight">{app.label}</p>
                <p className="mt-1 text-sm font-normal text-white/70">{app.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
