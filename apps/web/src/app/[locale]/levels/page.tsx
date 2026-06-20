import { getTranslations, setRequestLocale } from "next-intl/server";

import { PlaceholderPage } from "@/components/PlaceholderPage";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  return <PlaceholderPage title={t("levels")} />;
}
