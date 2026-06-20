import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClassificationForm } from "@/components/ClassificationForm";
import { getClassifications } from "@/lib/classification";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("classification");

  const data = await getClassifications();
  const hasSchemes = data && data.schemes.length > 0;

  return (
    <section>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      {hasSchemes ? (
        <ClassificationForm data={data} />
      ) : (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t("empty")}</p>
      )}
    </section>
  );
}
