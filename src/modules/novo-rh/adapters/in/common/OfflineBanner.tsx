import { useEffect, useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";

/** FE-006: sem ligação — aviso imediato; desaparece quando a ligação volta. */
export function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (!offline) return null;
  return (
    <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {t("errors.offline")}
    </p>
  );
}
