"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function onChange(next: string) {
    router.replace(pathname, { locale: next });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{t("language")}</span>
      <select
        className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
        value={locale}
        onChange={(e) => onChange(e.target.value)}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {loc.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
