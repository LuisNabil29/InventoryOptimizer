import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/lib/auth-actions";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";

export function Nav({
  locale,
  email,
  tenantName,
}: {
  locale: string;
  email: string;
  tenantName: string;
}) {
  const t = useTranslations();

  const items = [
    { href: "/", label: t("nav.dashboard") },
    { href: "/redistribution", label: t("nav.redistribution") },
    { href: "/purchasing", label: t("nav.purchasing") },
    { href: "/levels", label: t("nav.levels") },
    { href: "/classification", label: t("nav.classification") },
    { href: "/masters", label: t("nav.masters") },
    { href: "/ingestion", label: t("nav.ingestion") },
    { href: "/api-keys", label: t("nav.apikeys") },
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
          {tenantName ? (
            <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">
              {tenantName}
            </span>
          ) : null}
          <LocaleSwitcher />
          <ThemeToggle />
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              title={email}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {t("auth.signOut")}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
