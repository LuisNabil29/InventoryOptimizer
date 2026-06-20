import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";

export function Nav() {
  const t = useTranslations();

  const items = [
    { href: "/", label: t("nav.dashboard") },
    { href: "/redistribution", label: t("nav.redistribution") },
    { href: "/purchasing", label: t("nav.purchasing") },
    { href: "/levels", label: t("nav.levels") },
    { href: "/classification", label: t("nav.classification") },
    { href: "/ingestion", label: t("nav.ingestion") },
    { href: "/settings", label: t("nav.settings") },
  ];

  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">{t("app.title")}</span>
          <nav className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
            {items.map((item) => (
              <Link key={item.href} href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
