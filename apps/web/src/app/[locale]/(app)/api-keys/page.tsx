import { getTranslations, setRequestLocale } from "next-intl/server";

import { ApiKeysManager } from "@/components/ApiKeysManager";
import { listApiKeys } from "@/lib/apikeys";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("apikeys");

  const keys = await listApiKeys();

  return (
    <section>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      {keys ? (
        <ApiKeysManager keys={keys} />
      ) : (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t("error")}</p>
      )}
    </section>
  );
}
