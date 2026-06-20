import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { Nav } from "@/components/Nav";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true },
  });

  return (
    <>
      <Nav locale={locale} email={session.email} tenantName={tenant?.name ?? ""} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
