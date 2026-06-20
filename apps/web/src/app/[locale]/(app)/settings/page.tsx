import { getTranslations, setRequestLocale } from "next-intl/server";

import { SettingsForm } from "@/components/SettingsForm";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");

  const settings = await getSettings();

  return (
    <section>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t("error")}</p>
      )}
    </section>
  );
}
