import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { LoginForm } from "@/components/LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (session) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations("auth");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t("loginSubtitle")}</h1>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-medium">{t("loginTitle")}</h2>
          <LoginForm locale={locale} />
        </div>
      </div>
    </main>
  );
}
