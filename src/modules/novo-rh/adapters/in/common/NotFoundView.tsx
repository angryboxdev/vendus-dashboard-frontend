import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { SURFACE } from "../../../../../components/ui/index.ts";

/** FE-006: página não encontrada dentro do Novo RH. A URL mantém-se; o foco vai para o título. */
export function NotFoundView() {
  const { t } = useI18n();
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => h1.current?.focus(), []);
  return (
    <section className={`${SURFACE} space-y-2 p-6 text-center`}>
      <h1 ref={h1} tabIndex={-1} className="text-lg font-semibold text-stone-900 outline-none">
        {t("errors.notFound.title")}
      </h1>
      <p className="text-sm text-stone-600">{t("errors.notFound.body")}</p>
      <Link to="/hr/novo" className="inline-block text-sm font-medium text-[#C2410C] hover:underline">
        {t("errors.home")}
      </Link>
    </section>
  );
}
